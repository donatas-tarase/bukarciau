import {readFile, writeFile, mkdir, rm, cp} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const {site, camps} = JSON.parse(await readFile('content.json', 'utf8'));
if (!camps.length) throw new Error('Pridėkite vieną stovyklą į content.json.');
const camp = camps[0];
// Give changed files new URLs, even when a visitor has the previous release cached.
const assetVersions = new Map();
for (const path of ['/styles.css', '/app.js', site.video.src, site.video.poster]) {
  const bytes = await readFile('.' + path);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  assetVersions.set(path, `${path}?v=${hash}`);
}
const asset = path => assetVersions.get(path) || path;

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const photoIcon = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" aria-hidden="true"><rect x="6" y="6" width="28" height="28" rx="2"/><circle cx="15" cy="15" r="3"/><path d="m6 29 9-9 7 6 5-5 7 8"/></svg>';
const mail = `mailto:${site.email}?subject=${encodeURIComponent('Domina moterų stovykla · ' + camp.date)}`;
function formUrl(c) {
  if (!c.registrationUrl) return null;
  const url = new URL(c.registrationUrl);
  if (url.protocol !== 'https:') throw new Error('Registracijos nuoroda turi prasidėti https://');
  return c.registrationUrl;
}
function cta(c, {label, cls = 'button button-solid', local = false} = {}) {
  const url = formUrl(c);
  return url
    ? `<a class="${cls}" href="${e(url)}" data-registration-link target="_blank" rel="noopener noreferrer">${e(label || 'Registruotis')} ${arrow}<span class="sr-only"> (atsidaro naujame lange)</span></a>`
    : `<a class="${cls}" href="${local ? '' : '/'}#registracija" data-registration-intent>${e(label || 'Noriu dalyvauti')} ${arrow}</a>`;
}
function photo(src, label) {
  return src
    ? `<div class="photo"><img src="${e(src)}" alt="${e(label)}" loading="lazy" width="1000" height="750"></div>`
    : `<div class="photo placeholder" role="img" aria-label="Vieta nuotraukai: ${e(label)}"><span>${photoIcon}<span>Čia bus stovyklos nuotrauka</span></span><small>${e(label)}</small></div>`;
}
function header(current) {
  return `<a class="skip-link" href="#turinys">Pereiti prie turinio</a><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Būk arčiau — pradžia"><img src="/assets/logo.svg" width="104" height="80" alt="Arčiau"></a><button class="menu-toggle" aria-controls="navigation" aria-expanded="false" aria-label="Atidaryti meniu"><span></span><span></span></button><nav id="navigation" aria-label="Pagrindinis meniu"><a href="/#stovykla" ${current === 'camp' ? 'aria-current="page"' : ''}>Apie stovyklą</a><a href="/#kvietimas">Miglių kvietimas</a><a href="/kontaktai/" ${current === 'contact' ? 'aria-current="page"' : ''}>Kontaktai</a>${cta(camp, {cls:'button button-solid nav-cta', label:formUrl(camp) ? 'Registruotis' : 'Registracija'})}</nav></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="footer-main wrap"><a class="footer-brand" href="/" aria-label="Būk arčiau — pradžia"><img src="/assets/logo.svg" width="150" height="116" alt="Arčiau"></a><div class="footer-links"><span class="eyebrow">Susisiekime</span><a href="mailto:${e(site.email)}">${e(site.email)}</a><a href="tel:${e(site.phone)}">${e(site.phoneDisplay)}</a></div><div class="footer-links"><span class="eyebrow">Susipažinkime</span><a href="/apie-mus/">Miglė ir Miglė</a><a href="${e(site.facebook)}" target="_blank" rel="noopener noreferrer">Facebook ↗<span class="sr-only"> (atsidaro naujame lange)</span></a></div></div><div class="footer-bottom wrap"><span>© ${new Date().getUTCFullYear()} ${e(site.name)}</span><span>Bendrystė · Saviugda · Ryšiai</span></div></footer>`;
}
function facts(c, cls = '') {
  return `<dl class="event-facts ${cls}"><div><dt>Kada</dt><dd>${e(c.date)}</dd></div><div><dt>Kur</dt><dd>${e(c.location || 'Vieta dar tikslinama')}</dd></div><div><dt>Kaina</dt><dd>${e(c.price || 'Dar tikslinama')}</dd></div></dl>`;
}
function faq(c) {
  return `<div class="faq">${c.faq.map(f => `<details><summary>${e(f.question)}<span aria-hidden="true">+</span></summary><p>${e(f.kind === 'registration' && formUrl(c) ? 'Užpildyk registracijos anketą — jos nuorodą rasi registracijos skiltyje. Jei turi klausimų, parašyk mums.' : f.answer)}</p></details>`).join('')}</div>`;
}
function registration(c) {
  const url = formUrl(c);
  return `<section id="registracija" class="registration-section"><div class="registration-inner wrap"><div><span class="eyebrow">${e(c.date)} · Miglė ir Miglė</span><h2>Susitinkam?</h2><p>Jei tau artima mūsų idėja, kviečiame į moterų bendrystės stovyklą.</p></div><div class="registration-status" data-registration-status="${url ? 'open' : 'pending'}">${url
    ? `<span class="status-label">Registracija atidaryta</span><p>Užpildyk registracijos anketą.</p>${cta(c, {label:'Registruotis į stovyklą'})}<small>Anketa atsidarys naujame lange.</small>`
    : `<span class="status-label"><span class="status-dot" aria-hidden="true"></span>Registracija ruošiama</span><p>Registracijos anketą paskelbsime čia. Kol kas apie stovyklą gali pasiteirauti tiesiai mūsų.</p><a class="button button-solid" href="${e(mail)}">Parašyti Miglėms ${arrow}</a><a class="registration-phone" href="tel:${e(site.phone)}">${e(site.phoneDisplay)}</a>`}</div></div></section>`;
}
function transcript() {
  return `<details class="transcript"><summary>Kvietimo tekstas <span aria-hidden="true">+</span></summary><div>${site.video.transcript.map(t => `<p><strong>${e(t.speaker)}:</strong> ${e(t.text)}</p>`).join('')}</div></details>`;
}
function promoVideo() {
  return `<figure class="promo-figure" id="kvietimas"><div class="video-frame"><video id="promo-video" autoplay muted loop playsinline preload="auto" poster="${e(asset(site.video.poster))}" width="720" height="1280" aria-label="${e(site.video.title)}" aria-describedby="video-caption"><source src="${e(asset(site.video.src))}" type="video/mp4">Tavo naršyklė neatkuria vaizdo įrašo. <a href="${e(asset(site.video.src))}">Atidaryti video</a>.</video><div class="video-actions"><button type="button" class="video-sound" data-video-sound aria-controls="promo-video" aria-pressed="false" aria-label="Įjungti garsą ir paleisti video nuo pradžios"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6m0-6-5 6" data-video-muted-icon/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" data-video-audio-icon hidden/></svg><span data-video-sound-label>Įjungti garsą</span></button><button type="button" class="video-toggle" data-video-toggle aria-controls="promo-video" aria-label="Sustabdyti video"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z" data-video-pause-icon/><path d="m8 5 11 7-11 7z" data-video-play-icon hidden/></svg></button></div><p class="video-error" data-video-error hidden>Nepavyko paleisti įrašo. <a href="${e(asset(site.video.src))}">Atidaryti video</a></p></div><figcaption id="video-caption"><span>Miglė ir Miglė kviečia</span><span>${e(site.video.durationLabel)}</span></figcaption></figure>`;
}

async function page(path, title, body, current = '', description = 'Moterų savaitgalio stovykla gruodžio 5 d. Atokvėpiui, tikriems pokalbiams ir bendrystei kviečia Miglė ir Miglė.') {
  const canonical = path === '404.html' ? '' : `<link rel="canonical" href="${e(site.url)}${path ? '/' + path.replace(/index.html$/, '') : '/'}">`;
  const html = `<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)} | Būk arčiau</title><meta name="description" content="${e(description)}">${site.draft ? '<meta name="robots" content="noindex, nofollow">' : ''}<meta name="theme-color" content="#bfebac"><meta property="og:type" content="website"><meta property="og:locale" content="lt_LT"><meta property="og:title" content="${e(title)} | Būk arčiau"><meta property="og:description" content="${e(description)}">${canonical}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${e(asset('/styles.css'))}"><script src="${e(asset('/app.js'))}" defer></script></head><body>${header(current)}<main id="turinys" tabindex="-1">${body}</main>${footer()}</body></html>`;
  await mkdir(join('dist', path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''), {recursive:true});
  await writeFile(join('dist', path || 'index.html'), html);
}

await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
for (const f of ['styles.css', 'app.js', '_headers', '_redirects']) await cp(f, join('dist', f));
await cp('assets', 'dist/assets', {recursive:true});

const home = `
<section class="launch-hero"><div class="launch-grid wrap"><div class="launch-copy"><span class="event-date">${e(camp.date)} <span aria-hidden="true">·</span> Moterų bendrystės stovykla</span><h1>${e(site.heroTitle)}<em>${e(site.heroAccent)}</em></h1><p class="launch-description">${e(site.heroText)}</p><div class="hero-actions">${cta(camp, {local:true})}<a class="text-link" href="#stovykla">Apie stovyklą ${arrow}</a></div>${!formUrl(camp) ? '<p class="hero-status">Registracija ruošiama. Jau gali susipažinti su mumis.</p>' : ''}<span class="launch-tagline">Bendrystė <i>·</i> Saviugda <i>·</i> Ryšiai</span></div><div class="launch-media">${promoVideo()}</div></div></section>
<div class="transcript-wrap wrap">${transcript()}</div>
<section class="intro wrap section" id="susipazinkime"><div><span class="eyebrow">Kas kviečia?</span><h2>Labas.<br>Mes abi — Miglės.</h2><a class="text-link" href="/apie-mus/">Susipažinkime ${arrow}</a></div><div class="intro-copy">${site.aboutText.map(t => `<p>${e(t)}</p>`).join('')}</div></section>
<section class="camp-section" id="stovykla"><span id="stovyklos" class="legacy-anchor" aria-hidden="true"></span><div class="wrap"><div class="camp-section-heading"><span class="eyebrow">${e(camp.date)} · Moterų savaitgalis</span><h2>Laikas sau.<br>Ir pabuvimui kartu.</h2><p>${e(camp.description[0])}</p></div><div class="themes">${site.themes.map((t, i) => `<article><span class="theme-number">0${i + 1}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></article>`).join('')}</div>${facts(camp)}<div class="camp-section-bottom"><a class="text-link" href="/stovyklos/${e(camp.slug)}/">Visa stovyklos informacija ${arrow}</a>${cta(camp, {local:true, cls:'button'})}</div></div></section>
<section class="faq-section wrap section"><div><span class="eyebrow">Prieš susitinkant</span><h2>Gali kilti klausimų.</h2></div>${faq(camp)}</section>
${registration(camp)}`;
await page('', 'Moterų savaitgalis · Gruodžio 5 d.', home, 'camp');

await page('apie-mus/index.html', 'Miglė ir Miglė', `<section class="page-heading wrap"><span class="eyebrow">Būk arčiau</span><h1>${e(site.storyTitle)}</h1></section><section class="about-story wrap"><div class="about-mark"><img src="/assets/logo-original.jpeg" alt="Arčiau. Bendrystė, saviugda, ryšiai." width="1181" height="1181"></div><div class="story-copy">${site.story.map(t => `<p>${e(t)}</p>`).join('')}<a class="text-link" href="/#kvietimas">Pažiūrėk mūsų kvietimą ${arrow}</a></div></section><section class="contact-strip wrap"><div><span class="eyebrow">${e(camp.date)}</span><h2>Susitikime stovykloje.</h2></div>${cta(camp)}</section>`);

await page('kontaktai/index.html', 'Kontaktai', `<section class="contact-page wrap"><div><span class="eyebrow">Būk arčiau</span><h1>Susisiekime.</h1><p class="contact-intro">Turi klausimų apie stovyklą? Parašyk arba paskambink.</p><div class="contact-item"><span>El. paštas</span><a href="mailto:${e(site.email)}">${e(site.email)} ${arrow}</a></div><div class="contact-item"><span>Telefonas</span><a href="tel:${e(site.phone)}">${e(site.phoneDisplay)} ${arrow}</a></div><div class="contact-item"><span>Socialiniai tinklai</span><a href="${e(site.facebook)}" target="_blank" rel="noopener noreferrer">Facebook ↗<span class="sr-only"> (atsidaro naujame lange)</span></a></div></div><div class="contact-brand"><img src="/assets/logo-original.jpeg" alt="Arčiau. Bendrystė, saviugda, ryšiai." width="1181" height="1181"></div></section>`, 'contact');

for (const c of camps) {
  await page(`stovyklos/${c.slug}/index.html`, `${c.title} · ${c.date}`, `<section class="camp-detail-heading wrap"><a class="text-link back-link" href="/#stovykla">← Į pradžią</a><span class="eyebrow">${e(c.date)} · Miglė ir Miglė</span><h1>${e(c.title)}</h1><p>${e(c.summary)}</p>${facts(c)}<div class="detail-heading-action">${cta(c, {local:true})}</div></section><div class="detail-cover wrap">${photo(c.image, 'STOVYKLOS NUOTRAUKA')}</div><div class="detail-layout wrap section"><section><span class="eyebrow">Apie stovyklą</span><h2>${e(c.introTitle)}</h2>${c.description.map(t => `<p>${e(t)}</p>`).join('')}<h3 class="program-title">Programa</h3>${c.program.length ? `<div class="program">${c.program.map(d => `<div><h4>${e(d.title)}</h4><p>${e(d.text)}</p></div>`).join('')}</div>` : '<p>Programą ir tikslius laikus dar ruošiame. Juos paskelbsime čia.</p>'}</section><section><span class="eyebrow">Verta žinoti</span><h2>Klausimai ir atsakymai</h2>${faq(c)}</section></div>${registration(c)}`, 'camp');
}
await page('404.html', 'Puslapis nerastas', `<section class="not-found wrap"><span class="eyebrow">404</span><h1>Šio puslapio<br>neradome.</h1><a class="button button-solid" href="/">Į pradžią ${arrow}</a></section>`);
await writeFile('dist/robots.txt', site.draft ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
if (!site.draft) await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/apie-mus/', '/kontaktai/', ...camps.map(c => '/stovyklos/' + c.slug + '/')].map(p => '<url><loc>' + e(site.url + p) + '</loc></url>').join('')}</urlset>`);
console.log(`Sukurti ${camps.length + 4} puslapiai kataloge dist/.`);
