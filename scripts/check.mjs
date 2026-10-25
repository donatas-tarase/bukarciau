import {readFile, readdir, stat, mkdtemp, mkdir, cp, writeFile, rm} from 'node:fs/promises';
import {resolve, dirname, join, relative, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const errors = [];
let assertions = 0;
function check(condition, message) {
  assertions++;
  if (!condition) errors.push(message);
}
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi, entity => {
  const named = {'&amp;':'&', '&quot;':'"', '&apos;':"'", '&lt;':'<', '&gt;':'>', '&#39;':"'"};
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  return String.fromCodePoint(parseInt(entity.slice(entity[2].toLowerCase() === 'x' ? 3 : 2, -1), entity[2].toLowerCase() === 'x' ? 16 : 10));
});
function tags(html) {
  return [...html.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)].map(match => {
    const attrs = {};
    for (const item of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      attrs[item[1].toLowerCase()] = decode(item[2] ?? item[3] ?? item[4] ?? '');
    }
    return {name:match[1].toLowerCase(), attrs};
  });
}
function localAssetUrl(value) {
  try {
    const url = new URL(value, 'https://local.test/');
    return url.origin === 'https://local.test' ? url : null;
  } catch { return null; }
}
function versionedAsset(value, pathname) {
  const url = localAssetUrl(value);
  return url?.pathname === pathname && Boolean(url.searchParams.get('v')?.trim());
}
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(path));
    else result.push(path);
  }
  return result;
}
const documents = new Map();
const allFiles = await filesIn(dist).catch(() => []);
const htmlFiles = allFiles.filter(path => path.endsWith('.html'));
check(htmlFiles.length > 0, 'Nėra sugeneruotų puslapių. Pirmiausia paleiskite npm run build.');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const elements = tags(html);
  const ids = elements.filter(tag => 'id' in tag.attrs).map(tag => tag.attrs.id);
  const label = relative(dist, file);
  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
  check(elements.some(tag => tag.name === 'html' && tag.attrs.lang === 'lt'), `${label}: trūksta lietuvių kalbos žymos.`);
  check(titles.length === 1 && decode(titles[0]?.[1] ?? '').trim().length > 0, `${label}: turi būti viena netuščia antraštė title.`);
  check(elements.some(tag => tag.name === 'meta' && tag.attrs.charset?.toLowerCase() === 'utf-8'), `${label}: trūksta UTF-8.`);
  check(elements.some(tag => tag.name === 'meta' && tag.attrs.name === 'viewport' && /width\s*=\s*device-width/i.test(tag.attrs.content ?? '') && /initial-scale\s*=\s*1(?:\.0)?(?:\s*[,;]|\s*$)/i.test(tag.attrs.content ?? '')), `${label}: netinkama viewport žyma.`);
  check(elements.filter(tag => tag.name === 'h1').length === 1, `${label}: turi būti viena h1 antraštė.`);
  check(elements.filter(tag => tag.name === 'main').length === 1, `${label}: turi būti vienas main elementas.`);
  check(ids.length === new Set(ids).size, `${label}: kartojasi elementų ID.`);
  check(!/[\u2010-\u2015\u2212]/u.test(decode(html.replace(/<[^>]*>/g, ''))), `${label}: tekste brūkšniams naudokite tik paprastą - ženklą.`);
  check(elements.some(tag => tag.name === 'link' && tag.attrs.rel === 'stylesheet' && versionedAsset(tag.attrs.href, '/styles.css')), `${label}: stilių nuorodai trūksta versijos, kad lankytojos gautų atnaujinimus.`);
  check(elements.some(tag => tag.name === 'script' && versionedAsset(tag.attrs.src, '/app.js')), `${label}: programos failo nuorodai trūksta versijos, kad lankytojos gautų atnaujinimus.`);
  for (const {name, attrs} of elements) {
    if (name === 'img') check('alt' in attrs, `${label}: nuotrauka neturi alt atributo (${attrs.src}).`);
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      if (attrs[attr]) for (const id of attrs[attr].split(/\s+/)) check(ids.includes(id), `${label}: ${attr} nurodo neegzistuojantį #${id}.`);
    }
    if (name === 'a' && attrs.target === '_blank') check(['noopener', 'noreferrer'].every(value => attrs.rel?.split(/\s+/).includes(value)), `${label}: naujame lange atidaromai nuorodai trūksta rel apsaugų.`);
  }
  documents.set(file, {html, elements, ids:new Set(ids)});
}

async function localReference(value, from) {
  const label = relative(dist, from);
  if (/^(?:mailto:|tel:|data:)/i.test(value)) return;
  let url;
  try { url = new URL(value, `https://local.test/${relative(dist, from).split(sep).join('/')}`); }
  catch { check(false, `${label}: netinkama nuoroda ${value}.`); return; }
  check(['http:', 'https:'].includes(url.protocol), `${label}: neleidžiamas nuorodos protokolas ${value}.`);
  if (url.origin !== 'https://local.test') return;
  let target;
  try {
    target = resolve(dist, '.' + decodeURIComponent(url.pathname));
    check(target === dist || target.startsWith(dist + sep), `${label}: nuoroda išeina iš dist: ${value}.`);
    if (target !== dist && !target.startsWith(dist + sep)) return;
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
    check((await stat(target)).isFile(), `${label}: nėra failo ${value}.`);
  } catch { check(false, `${label}: nėra failo ${value}.`); return; }
  if (url.hash && extname(target) === '.html') {
    check(documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1))), `${label}: nuoroda ${value} nurodo neegzistuojantį inkarą.`);
  }
}
for (const file of allFiles) {
  if (['.html', '.svg'].includes(extname(file))) {
    const elements = documents.get(file)?.elements ?? tags(await readFile(file, 'utf8'));
    for (const {attrs} of elements) for (const key of ['href', 'src', 'poster']) if (key in attrs) await localReference(attrs[key], file);
  } else if (extname(file) === '.css') {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await localReference(match[1].trim(), file);
  }
}

const original = await readFile(join(root, 'assets/logo-original.jpeg'));
check(createHash('sha256').update(original).digest('hex') === '9a37cd7deb5b67efac919f447c7e461cd42c843935ba4b8cef55242a9779ee93', 'Gauto logotipo originalo baitai pasikeitė.');
check(original.equals(await readFile(join(dist, 'assets/logo-original.jpeg'))), 'Build rezultato logotipo originalas skiriasi nuo šaltinio.');
for (const name of ['logo.svg', 'favicon.svg']) {
  const svg = await readFile(join(dist, 'assets', name), 'utf8');
  const embedded = [...svg.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)];
  check(embedded.length === 1 && original.equals(Buffer.from(embedded[0]?.[1] ?? '', 'base64')), `${name}: įterptas logotipas turi būti tikslus originalas.`);
}

function registrationState(html, configuredUrl, label) {
  const elements = tags(html);
  const status = elements.filter(tag => 'data-registration-status' in tag.attrs);
  const intents = elements.filter(tag => 'data-registration-intent' in tag.attrs);
  const links = elements.filter(tag => 'data-registration-link' in tag.attrs);
  check(elements.some(tag => tag.attrs.id === 'registracija'), `${label}: trūksta registracijos skilties.`);
  check(status.length === 1, `${label}: turi būti viena aiški registracijos būsena.`);
  check(!elements.some(tag => 'data-registration-pending' in tag.attrs || tag.attrs.id === 'registration-dialog'), `${label}: liko senas registracijos mygtukas arba modalinis langas.`);
  check(intents.every(tag => tag.name === 'a' && ['#registracija', '/#registracija'].includes(tag.attrs.href)), `${label}: kvietimas dalyvauti turi vesti į registracijos informaciją.`);
  if (configuredUrl) {
    check(status.every(tag => tag.attrs['data-registration-status'] === 'open'), `${label}: paskelbus formą turi būti rodoma atvira registracija.`);
    check(links.length >= 1 && links.every(tag => tag.name === 'a' && tag.attrs.href === configuredUrl), `${label}: registracijos nuorodos turi atidaryti nurodytą formą.`);
    check(links.every(tag => tag.attrs.target === '_blank' && tag.attrs.rel?.includes('noopener') && tag.attrs.rel?.includes('noreferrer')), `${label}: formos turi saugiai atsidaryti naujame lange.`);
  } else {
    check(status.every(tag => tag.attrs['data-registration-status'] === 'pending'), `${label}: be formos turi būti rodoma laukiama registracija.`);
    check(intents.length >= 1 && links.length === 0, `${label}: be formos kvietimas turi vesti į informaciją, o ne į neegzistuojančią anketą.`);
    check(!elements.some(tag => tag.name === 'a' && /^https:\/\/(?:forms\.gle\/|docs\.google\.com\/forms\/)/i.test(tag.attrs.href ?? '')), `${label}: be formos negali būti pavyzdinės Google Forms nuorodos.`);
    check(elements.some(tag => tag.name === 'a' && tag.attrs.href?.startsWith('mailto:info@bukarciau.lt')), `${label}: laukiant registracijos turi būti tikras kontaktas.`);
  }
}
async function videoState(document, directory, label) {
  const videos = document.elements.filter(tag => tag.name === 'video');
  check(videos.length === 1, `${label}: turi būti vienas Miglių kvietimo video.`);
  for (const {attrs} of videos) {
    check(attrs.id === 'promo-video', `${label}: vienintelis video turi būti susietas su puslapio valdymu.`);
    check(['autoplay', 'muted', 'loop', 'playsinline'].every(key => key in attrs), `${label}: video turi automatiškai kartotis be garso ir veikti puslapyje telefone.`);
    check(!('controls' in attrs), `${label}: video turi naudoti puslapio valdymo mygtukus be naršyklės grotuvo juostos.`);
    check(attrs.preload === 'auto', `${label}: automatiškai paleidžiamas video turi būti parsiunčiamas iš anksto.`);
    check(versionedAsset(attrs.poster, '/assets/migliu-kvietimas-poster.jpg'), `${label}: trūksta kvietimo video viršelio arba jo versijos.`);
  }
  const soundButtons = document.elements.filter(tag => 'data-video-sound' in tag.attrs);
  check(soundButtons.length === 1 && soundButtons.every(tag => tag.name === 'button' && tag.attrs.type === 'button' && tag.attrs['aria-controls'] === 'video-dialog' && tag.attrs['aria-haspopup'] === 'dialog'), `${label}: kvietimo klausymo mygtukas turi atidaryti prieinamą video dialogą.`);
  const toggleButtons = document.elements.filter(tag => 'data-video-toggle' in tag.attrs);
  check(toggleButtons.length === 1 && toggleButtons.every(tag => tag.name === 'button' && tag.attrs.type === 'button' && tag.attrs['aria-controls'] === 'promo-video'), `${label}: video pristabdymas turi būti tikras mygtukas, susietas su kvietimo video.`);
  const dialogs = document.elements.filter(tag => tag.name === 'dialog');
  check(dialogs.length === 1 && dialogs[0].attrs.id === 'video-dialog' && Boolean(dialogs[0].attrs['aria-labelledby']) && !('open' in dialogs[0].attrs), `${label}: visas kvietimas turi atsidaryti viename pavadintame, iš pradžių uždarytame naršyklės dialoge.`);
  const dialogHtml = document.html.match(/<dialog\b[^>]*id="video-dialog"[^>]*>([\s\S]*?)<\/dialog>/i)?.[1] ?? '';
  const dialogElements = tags(dialogHtml);
  for (const attribute of ['data-dialog-toggle', 'data-dialog-sound']) {
    const buttons = dialogElements.filter(tag => attribute in tag.attrs);
    check(buttons.length === 1 && buttons.every(tag => tag.name === 'button' && tag.attrs.type === 'button' && tag.attrs['aria-controls'] === 'promo-video'), `${label}: ${attribute} turi leisti valdyti tą patį video ir atidarytame dialoge.`);
  }
  const closeButtons = dialogElements.filter(tag => 'data-close-video' in tag.attrs);
  const closeText = decode(dialogHtml.match(/<button\b[^>]*data-close-video\b[^>]*>([\s\S]*?)<\/button>/i)?.[1]?.replace(/<[^>]*>/g, '') ?? '').trim();
  check(closeButtons.length === 1 && closeButtons.every(tag => tag.name === 'button' && tag.attrs.type === 'button' && Boolean(tag.attrs['aria-label']?.trim() || closeText)), `${label}: video dialogas turi turėti aiškiai pavadintą uždarymo mygtuką.`);
  const sources = document.elements.filter(tag => tag.name === 'source' && localAssetUrl(tag.attrs.src)?.pathname === '/assets/migliu-kvietimas.mp4');
  check(sources.length === 1 && sources[0].attrs.type === 'video/mp4', `${label}: trūksta MP4 kvietimo video šaltinio.`);
  check(sources.every(tag => versionedAsset(tag.attrs.src, '/assets/migliu-kvietimas.mp4')), `${label}: video nuorodai trūksta versijos, kad lankytojos matytų naują įrašą.`);
  check([...document.html.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>/gi)].some(match => decode(match[1].replace(/<[^>]*>/g, '')).trim().startsWith('Kvietimo tekstas')), `${label}: šalia video turi būti išskleidžiamas kvietimo tekstas.`);
  const video = await stat(join(directory, 'assets/migliu-kvietimas.mp4')).catch(() => null);
  check(Boolean(video?.isFile() && video.size > 0 && video.size <= 25 * 1024 * 1024), `${label}: optimizuotas MP4 turi egzistuoti ir neviršyti 25 MiB.`);
  check(Boolean((await stat(join(directory, 'assets/migliu-kvietimas-poster.jpg')).catch(() => null))?.isFile()), `${label}: nėra video viršelio failo.`);
}
const content = JSON.parse(await readFile(join(root, 'content.json'), 'utf8'));
async function indexingState(directory, isDraft, label) {
  const files = (await filesIn(directory)).filter(file => file.endsWith('.html'));
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const noindex = tags(html).some(tag => tag.name === 'meta' && tag.attrs.name === 'robots' && /\bnoindex\b/i.test(tag.attrs.content ?? ''));
    check(noindex === isDraft, `${label}: netinkama indeksavimo būsena ${relative(directory, file)}.`);
  }
  const robots = await readFile(join(directory, 'robots.txt'), 'utf8');
  check(/Disallow:\s*\/(?:\s|$)/i.test(robots) === isDraft, `${label}: robots.txt neatitinka maketo būsenos.`);
  const sitemap = await readFile(join(directory, 'sitemap.xml'), 'utf8').catch(() => null);
  check(isDraft ? sitemap === null : Boolean(sitemap?.includes('<urlset') && sitemap.includes(content.site.url + '/') && !sitemap.includes('404.html')), `${label}: sitemap.xml neatitinka maketo būsenos.`);
  if (!isDraft) check(robots.includes(`Sitemap: ${content.site.url}/sitemap.xml`), `${label}: robots.txt trūksta svetainės žemėlapio nuorodos.`);
}
await indexingState(dist, Boolean(content.site.draft), 'Sugeneruota svetainė');
check(content.camps.length === 1, 'Svetainėje turi būti tik viena dabartinė stovykla.');
check(!allFiles.includes(join(dist, 'stovyklos/stovykla-02/index.html')), 'Build rezultate liko antros stovyklos puslapis.');
const redirects = await readFile(join(dist, '_redirects'), 'utf8').catch(() => '');
const redirectRules = redirects.split(/\r?\n/).map(line => line.trim().split(/\s+/));
for (const oldPath of ['/stovyklos/stovykla-02', '/stovyklos/stovykla-02/']) {
  check(redirectRules.some(([from, to, code]) => from === oldPath && to === '/#stovykla' && code === '301'), `${oldPath}: senas adresas turi nukreipti į vienintelę stovyklą.`);
}
const home = documents.get(join(dist, 'index.html'));
if (home && content.camps[0]) {
  registrationState(home.html, content.camps[0].registrationUrl, 'Pradžios puslapis');
  await videoState(home, dist, 'Pradžios puslapis');
}
for (const camp of content.camps) {
  const path = join(dist, 'stovyklos', camp.slug, 'index.html');
  const document = documents.get(path);
  check(Boolean(document), `Nėra stovyklos puslapio ${camp.slug}.`);
  if (document) registrationState(document.html, camp.registrationUrl, camp.slug);
}

// Build edited fixtures only in a temporary directory; real content and dist stay untouched.
const fixture = await mkdtemp(join(tmpdir(), 'bukarciau-check-'));
try {
  await mkdir(join(fixture, 'scripts'));
  for (const file of ['scripts/build.mjs', 'styles.css', 'app.js', '_headers', '_redirects', 'assets']) await cp(join(root, file), join(fixture, file), {recursive:true});
  check(content.camps.length > 0, 'Registracijos šablonui patikrinti reikia bent vienos stovyklos.');
  if (content.camps.length) {
    const fixtureContent = structuredClone(content);
    fixtureContent.site.draft = true;
    const configuredUrl = 'https://forms.gle/bukarciau-check?camp=1&source=website';
    fixtureContent.camps = [{...structuredClone(content.camps[0]), registrationUrl:null}];
    for (const registrationUrl of [null, configuredUrl]) {
      fixtureContent.camps[0].registrationUrl = registrationUrl;
      await writeFile(join(fixture, 'content.json'), JSON.stringify(fixtureContent));
      const build = spawnSync(process.execPath, ['scripts/build.mjs'], {cwd:fixture, encoding:'utf8'});
      const label = registrationUrl ? 'Bandymas su HTTPS forma' : 'Bandymas su null';
      check(build.status === 0, `${label}: build nepavyko: ${build.stderr}`);
      if (build.status === 0) {
        for (const path of ['index.html', `stovyklos/${fixtureContent.camps[0].slug}/index.html`]) {
          registrationState(await readFile(join(fixture, 'dist', path), 'utf8'), registrationUrl, `${label}, ${path}`);
        }
        await indexingState(join(fixture, 'dist'), true, label);
      }
    }
    fixtureContent.site.draft = false;
    await writeFile(join(fixture, 'content.json'), JSON.stringify(fixtureContent));
    const publicBuild = spawnSync(process.execPath, ['scripts/build.mjs'], {cwd:fixture, encoding:'utf8'});
    check(publicBuild.status === 0, `Viešos svetainės bandymo build nepavyko: ${publicBuild.stderr}`);
    if (publicBuild.status === 0) await indexingState(join(fixture, 'dist'), false, 'Viešos svetainės bandymas');
    fixtureContent.camps[0].registrationUrl = 'http://forms.gle/bukarciau-check';
    await writeFile(join(fixture, 'content.json'), JSON.stringify(fixtureContent));
    const unsafeBuild = spawnSync(process.execPath, ['scripts/build.mjs'], {cwd:fixture, encoding:'utf8'});
    check(unsafeBuild.status !== 0 && /https:\/\//i.test(unsafeBuild.stderr), 'HTTP registracijos nuoroda turi būti atmesta aiškiu pranešimu.');
  }
} finally {
  await rm(fixture, {recursive:true, force:true});
}
if (errors.length) {
  console.error(`Patikra nepavyko (${errors.length}):\n${errors.map(error => '• ' + error).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Patikra sėkminga: ${htmlFiles.length} puslapiai, ${assertions} patikros; failai, inkarai, video, originalus logotipas ir registracijos būsenos tvarkingi.`);
