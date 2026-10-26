import { verifyAdminRequest, requireSameOriginMutation, readAccessConfig } from './auth.mjs';
import { HttpError, unavailable } from './errors.mjs';
import { CmsStore } from './store.mjs';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, MEDIA_ID, readBodyLimited, readImageUpload } from './media.mjs';

const API_PREFIX = '/admin/api/';
const CANONICAL_ALIASES = {
  '/index.html': '/',
  '/apie-mus': '/apie-mus/', '/apie-mus/index.html': '/apie-mus/',
  '/kontaktai': '/kontaktai/', '/kontaktai/index.html': '/kontaktai/',
  '/stovyklos/stovykla-01': '/stovyklos/stovykla-01/', '/stovyklos/stovykla-01/index.html': '/stovyklos/stovykla-01/',
};
const newId = () => crypto.randomUUID().replaceAll('-', '');
const e = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function secure(response, { admin = false, preview = false, html = false, noindex = false } = {}) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (html || admin) {
    headers.set('Content-Security-Policy', `default-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${preview ? "'self'" : "'none'"}; form-action 'self'`);
  }
  if (admin) {
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Pragma', 'no-cache');
    headers.set('Vary', 'Cookie, Cf-Access-Jwt-Assertion');
  }
  if (admin || noindex) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function problem(error) {
  const value = { code: error.code, message: error.message };
  if (error.issues) value.issues = error.issues;
  return json({ error: value }, error.status);
}

function blockedHtml(error, assets) {
  return new Response(`<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Administravimas | Būk arčiau</title><link rel="stylesheet" href="${e(assets.styles)}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"></head><body><main class="section wrap"><p class="eyebrow">BŪK ARČIAU</p><h1>Administravimas</h1><p>${e(error.message)}</p><a class="button button-outline" href="/">Grįžti į svetainę</a></main></body></html>`, { status: error.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    throw new HttpError(415, 'JSON_REQUIRED', 'Užklausa turi būti JSON formato.');
  }
  const bytes = await readBodyLimited(request, 512 * 1024);
  try {
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Object required');
    return parsed;
  } catch {
    throw new HttpError(422, 'JSON_INVALID', 'Nepavyko perskaityti pakeitimų. Atnaujinkite puslapį ir bandykite dar kartą.');
  }
}

function requireRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new HttpError(422, 'REVISION_REQUIRED', 'Trūksta galiojančios turinio versijos. Atnaujinkite puslapį.');
  }
  return value;
}

function requireKeys(input, allowed) {
  if (Object.keys(input).some(key => !allowed.includes(key))) {
    throw new HttpError(422, 'REQUEST_INVALID', 'Užklausoje yra neleistinų laukų.');
  }
}

function conflict() {
  return new HttpError(409, 'REVISION_CONFLICT', 'Turinys jau pakeistas kitame lange. Išsaugokite savo tekstą, atnaujinkite puslapį ir peržiūrėkite naujausią versiją.');
}

export function createHandler(runtime) {
  const { initialContent, assets, renderPage, renderRobots, renderSitemap, parseContent, getImageReferences } = runtime;

  function parse(input) {
    try { return parseContent(input); }
    catch (error) {
      if (Array.isArray(error?.issues)) throw new HttpError(422, 'CONTENT_INVALID', 'Peržiūrėkite pažymėtus turinio laukus.', error.issues);
      throw error;
    }
  }

  function refIds(content) {
    return new Set(getImageReferences(content).map(image => typeof image === 'string' ? image.replace(/^\/media\//, '') : image.id));
  }

  function stateResponse(state, identity, env) {
    return {
      content: state.content,
      revision: state.revision,
      publishedRevision: state.publishedRevision,
      updatedAt: state.updatedAt,
      publishedAt: state.publishedAt,
      identity,
      capabilities: {
        media: Boolean(env.CMS_MEDIA),
        upload: Boolean(env.CMS_MEDIA),
        maxUploadBytes: MAX_UPLOAD_BYTES,
        imageTypes: IMAGE_TYPES,
      },
    };
  }

  function mediaItem(row, state) {
    return {
      id: row.id,
      name: row.name,
      url: `/media/${row.id}`,
      previewUrl: `/admin/api/media/${row.id}`,
      type: row.content_type,
      size: row.size,
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
      author: row.author,
      usedInDraft: refIds(state.content).has(row.id),
      usedInPublished: refIds(state.published).has(row.id),
    };
  }

  async function imageResponse(request, env, store, id, { privateImage = false } = {}) {
    if (!MEDIA_ID.test(id)) return new Response('Nerasta', { status: 404 });
    const state = await store.state();
    const row = await store.media(id);
    if (!row || row.deleted_at || (!privateImage && !refIds(state.published).has(id))) {
      if (privateImage) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Nuotrauka nerasta.');
      return new Response('Nerasta', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!env.CMS_MEDIA) throw unavailable();
    const object = await env.CMS_MEDIA.get(id);
    if (!object) {
      if (privateImage) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Nuotrauka nerasta.');
      return new Response('Nerasta', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const headers = new Headers({
      'Content-Type': row.content_type,
      'Content-Length': String(row.size),
      'Content-Disposition': 'inline',
      'Cache-Control': privateImage ? 'private, no-store' : 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    if (!privateImage && object.httpEtag && request.headers.get('If-None-Match') === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  }

  async function handleAdmin(request, env, identity, url) {
    if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/`, 308);
    if (url.pathname === '/admin/logout') {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Šis veiksmas neleidžiamas.');
      const { team } = readAccessConfig(env);
      const headers = new Headers({ Location: `https://${team}/cdn-cgi/access/logout` });
      // Access scopes its application cookie to /admin. Its root logout URL
      // cannot receive that cookie, so remove local variants before global SSO
      // revocation. No cookie values are read or forwarded by this endpoint.
      for (const name of ['CF_Authorization', 'CF_Binding']) {
        for (const path of ['/admin', '/admin/', '/']) {
          for (const domain of ['', `; Domain=${url.hostname}`]) {
            headers.append('Set-Cookie', `${name}=; Path=${path}${domain}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax`);
          }
        }
      }
      return new Response(null, { status: 303, headers });
    }
    if (url.pathname === '/admin/preview') {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Šis veiksmas neleidžiamas.');
      if (!env.CMS_DB) throw unavailable();
      const store = new CmsStore(env.CMS_DB, initialContent);
      const state = await store.state();
      const path = url.searchParams.get('path') || '/';
      if (!/^\/(?!\/)[^?#]*$/.test(path) || path.startsWith('/admin')) throw new HttpError(422, 'PREVIEW_PATH_INVALID', 'Pasirinkite svetainės puslapį peržiūrai.');
      const content = parse(state.content);
      // The shared renderer rewrites draft photographs to protected media URLs.
      const rendered = renderPage(content, path, { assets, preview: true });
      if (!rendered) throw new HttpError(404, 'PAGE_NOT_FOUND', 'Šio puslapio nėra.');
      return secure(new Response(request.method === 'HEAD' ? null : rendered.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }), { admin: true, preview: true, html: true });
    }
    if (!url.pathname.startsWith(API_PREFIX)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Šis veiksmas neleidžiamas.');
      return env.ASSETS.fetch(request);
    }
    if (!env.CMS_DB) throw unavailable();
    const store = new CmsStore(env.CMS_DB, initialContent);
    const path = url.pathname.slice(API_PREFIX.length).replace(/\/$/, '');
    if (request.method !== 'GET' && request.method !== 'HEAD') requireSameOriginMutation(request);

    if (path === 'state' && request.method === 'GET') {
      const state = await store.state();
      state.content = parse(state.content);
      return json(stateResponse(state, identity, env));
    }
    if (path === 'draft' && request.method === 'POST') {
      const body = await readJson(request);
      requireKeys(body, ['content', 'revision']);
      const revision = requireRevision(body.revision);
      const content = parse(body.content);
      const state = await store.state();
      if (state.revision !== revision) throw conflict();
      if (!(await store.saveDraft(content, revision, identity.email))) {
        if ((await store.state()).revision !== revision) throw conflict();
        throw new HttpError(422, 'MEDIA_NOT_FOUND', 'Viena iš pasirinktų nuotraukų nebepasiekiama. Pasirinkite ją iš naujo.');
      }
      return json(stateResponse(await store.state(), identity, env));
    }
    if (path === 'publish' && request.method === 'POST') {
      const body = await readJson(request);
      requireKeys(body, ['revision']);
      const revision = requireRevision(body.revision);
      const state = await store.state();
      if (state.revision !== revision) throw conflict();
      parse(state.content);
      if (state.publishedRevision !== revision && !(await store.publish(revision, identity.email))) throw conflict();
      return json(stateResponse(await store.state(), identity, env));
    }
    if (path === 'history' && request.method === 'GET') {
      await store.state();
      return json({ versions: await store.history() });
    }
    if (path === 'restore' && request.method === 'POST') {
      const body = await readJson(request);
      requireKeys(body, ['versionId', 'revision']);
      const revision = requireRevision(body.revision);
      if (typeof body.versionId !== 'string' || !/^[a-f0-9]{32}$/.test(body.versionId)) throw new HttpError(422, 'VERSION_INVALID', 'Pasirinkite galiojančią turinio versiją.');
      const state = await store.state();
      if (state.revision !== revision) throw conflict();
      const content = await store.version(body.versionId);
      if (!content) throw new HttpError(404, 'VERSION_NOT_FOUND', 'Ši versija neberandama.');
      const clean = parse(content);
      if (!(await store.saveDraft(clean, revision, identity.email, { restore: true, imageIds: [...refIds(clean)] }))) {
        if ((await store.state()).revision !== revision) throw conflict();
        throw new HttpError(422, 'MEDIA_NOT_FOUND', 'Versijos nuotraukos nebepasiekiamos.');
      }
      return json(stateResponse(await store.state(), identity, env));
    }
    if (path === 'media' && request.method === 'GET') {
      const state = await store.state();
      return json({ items: (await store.mediaList()).map(row => mediaItem(row, state)) });
    }
    if (path === 'media' && request.method === 'POST') {
      if (!env.CMS_MEDIA) throw new HttpError(503, 'MEDIA_UNAVAILABLE', 'Nuotraukų įkėlimas dar neparuoštas.');
      await store.state();
      const image = await readImageUpload(request);
      const id = `${newId()}.${image.ext}`;
      const item = { id, name: image.name, content_type: image.type, size: image.bytes.length, width: image.width, height: image.height, created_at: new Date().toISOString(), author: identity.email };
      await env.CMS_MEDIA.put(id, image.bytes, { httpMetadata: { contentType: image.type, contentDisposition: 'inline' } });
      try { await store.addMedia(item); }
      catch (error) {
        try { await env.CMS_MEDIA.delete(id); } catch { /* The object remains private without its database record. */ }
        throw error;
      }
      return json({ item: mediaItem(item, await store.state()) }, 201);
    }
    if (path.startsWith('media/')) {
      const id = path.slice('media/'.length);
      if (!MEDIA_ID.test(id)) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Nuotrauka nerasta.');
      if (request.method === 'GET' || request.method === 'HEAD') return imageResponse(request, env, store, id, { privateImage: true });
      if (request.method === 'DELETE') {
        await store.state();
        const item = await store.media(id);
        if (!item || item.deleted_at) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Nuotrauka nerasta.');
        if (!(await store.deleteMedia(id, identity.email))) throw new HttpError(409, 'MEDIA_IN_USE', 'Nuotrauka naudojama juodraštyje arba paskelbtoje svetainėje. Pirmiausia pakeiskite ją turinyje.');
        return json({ deleted: true, id });
      }
    }
    throw new HttpError(404, 'API_NOT_FOUND', 'Šis veiksmas nerastas.');
  }

  return async function handleRequest(request, env, ctx, { verifyAccess = verifyAdminRequest } = {}) {
    const url = new URL(request.url);
    // Asset routers may decode or collapse a pathname after the Worker runs.
    // Refuse ambiguous paths before any asset fallback can expose /admin files.
    if (/%|\/\/|\\/.test(url.pathname)) {
      return secure(json({ error: { code: 'PATH_INVALID', message: 'Netinkamas puslapio adresas.' } }, 400), { admin: true });
    }
    const admin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    try {
      if (admin) {
        const identity = await verifyAccess(request, env);
        return secure(await handleAdmin(request, env, identity, url), { admin: true, preview: url.pathname === '/admin/preview', html: !url.pathname.startsWith(API_PREFIX) });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return secure(new Response('Šis veiksmas neleidžiamas.', { status: 405, headers: { Allow: 'GET, HEAD' } }));
      }
      if (url.pathname.startsWith('/media/')) {
        if (!env.CMS_DB) return secure(new Response('Nerasta', { status: 404, headers: { 'Cache-Control': 'no-store' } }));
        try { return secure(await imageResponse(request, env, new CmsStore(env.CMS_DB, initialContent), url.pathname.slice('/media/'.length))); }
        catch { return secure(new Response('Nerasta', { status: 404, headers: { 'Cache-Control': 'no-store' } })); }
      }
      const pagePath = url.pathname;
      if (Object.prototype.hasOwnProperty.call(CANONICAL_ALIASES, pagePath)) {
        return secure(Response.redirect(`${url.origin}${CANONICAL_ALIASES[pagePath]}${url.search}`, 308));
      }
      const pageRoutes = ['/', '/apie-mus/', '/kontaktai/', '/stovyklos/stovykla-01/', '/404.html'];
      const textRoute = pagePath === '/robots.txt' || pagePath === '/sitemap.xml';
      if (!pageRoutes.includes(pagePath) && !textRoute) {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404 || !env.CMS_DB || /\.[a-z0-9]{1,12}$/i.test(pagePath)) return secure(response);
        try {
          const state = await new CmsStore(env.CMS_DB, initialContent).state();
          const content = parse(state.published);
          const rendered = renderPage(content, '/404.html', { assets });
          if (rendered) return secure(new Response(request.method === 'HEAD' ? null : rendered.html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }), { html: true, noindex: true });
        } catch { /* A missing database must not break static 404 handling. */ }
        return secure(response);
      }
      if (!env.CMS_DB) return secure(await env.ASSETS.fetch(request), { html: !textRoute });
      try {
        const state = await new CmsStore(env.CMS_DB, initialContent).state();
        const content = parse(state.published);
        if (textRoute) {
          const text = pagePath === '/robots.txt' ? renderRobots(content) : renderSitemap(content);
          if (!text) return secure(new Response('Nerasta', { status: 404 }));
          return secure(new Response(request.method === 'HEAD' ? null : text, { headers: { 'Content-Type': pagePath === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } }));
        }
        const rendered = renderPage(content, pagePath, { assets });
        if (!rendered) return secure(await env.ASSETS.fetch(request), { html: true });
        return secure(new Response(request.method === 'HEAD' ? null : rendered.html, { status: pagePath === '/404.html' ? 404 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', 'ETag': `"content-${state.publishedRevision}-${pagePath}"` } }), { html: true, noindex: content.site?.draft || pagePath === '/404.html' });
      } catch {
        // Published static output remains available if the content database is down.
        return secure(await env.ASSETS.fetch(request), { html: !textRoute });
      }
    } catch (error) {
      const failure = error instanceof HttpError ? error : unavailable();
      if (!(error instanceof HttpError)) console.error('CMS request failed', error?.name || 'Error');
      const response = admin && !url.pathname.startsWith(API_PREFIX) ? blockedHtml(failure, assets) : problem(failure);
      return secure(response, { admin, html: admin && !url.pathname.startsWith(API_PREFIX) });
    }
  };
}
