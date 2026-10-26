import { HttpError } from './errors.mjs';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MEDIA_ID = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function readBodyLimited(request, maxBytes) {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
    throw new HttpError(413, 'BODY_TOO_LARGE', 'Failas arba užklausa per didelė.');
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'BODY_TOO_LARGE', 'Failas arba užklausa per didelė.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const ascii = (bytes, start, text) => [...text].every((char, i) => bytes[start + i] === char.charCodeAt(0));
const u16 = (bytes, start) => (bytes[start] << 8) | bytes[start + 1];
const le24 = (bytes, start) => bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16);

/** Identify the actual image format and dimensions rather than trusting file names or MIME headers. */
export function inspectImage(bytes) {
  let image;
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value) && ascii(bytes, 12, 'IHDR')) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    image = { type: 'image/png', ext: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  } else if (bytes.length >= 24 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = u16(bytes, offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        image = { type: 'image/jpeg', ext: 'jpg', height: u16(bytes, offset + 3), width: u16(bytes, offset + 5) };
        break;
      }
      offset += length;
    }
  } else if (bytes.length >= 30 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(4, true) + 8 !== bytes.length) throw invalidImage();
    if (ascii(bytes, 12, 'VP8X') && bytes.length >= 30) {
      // Animated WebP is deliberately excluded from the photograph fields.
      if (bytes[20] & 0x02) throw new HttpError(422, 'IMAGE_ANIMATED', 'Įkelkite neanimuotą nuotrauką.');
      image = { type: 'image/webp', ext: 'webp', width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
    } else if (ascii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
      const packed = view.getUint32(21, true);
      image = { type: 'image/webp', ext: 'webp', width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
    } else if (ascii(bytes, 12, 'VP8 ') && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      image = { type: 'image/webp', ext: 'webp', width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
  }
  if (!image || !image.width || !image.height) throw invalidImage();
  if (image.width > 10000 || image.height > 10000 || image.width * image.height > 40000000) {
    throw new HttpError(422, 'IMAGE_DIMENSIONS', 'Nuotrauka per didelės raiškos. Sumažinkite ją iki 40 megapikselių.');
  }
  return image;
}

const invalidImage = () => new HttpError(422, 'IMAGE_INVALID', 'Tinka tik galiojantys JPG, PNG arba WebP nuotraukų failai.');

export async function readImageUpload(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!/^multipart\/form-data\s*;/i.test(type)) {
    throw new HttpError(415, 'MULTIPART_REQUIRED', 'Nuotrauką įkelkite naudodami failo pasirinkimą.');
  }
  const body = await readBodyLimited(request, MAX_UPLOAD_BYTES + 128 * 1024);
  let form;
  try {
    form = await new Response(body, { headers: { 'Content-Type': type } }).formData();
  } catch {
    throw new HttpError(422, 'UPLOAD_INVALID', 'Nepavyko perskaityti nuotraukos. Pasirinkite failą iš naujo.');
  }
  const entries = [...form.entries()];
  const file = form.get('file');
  if (entries.length !== 1 || !file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw invalidImage();
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Nuotrauka turi būti mažesnė nei 8 MB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = inspectImage(bytes);
  const name = String(file.name || `nuotrauka.${image.ext}`).split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || `nuotrauka.${image.ext}`;
  return { bytes, name, ...image };
}
