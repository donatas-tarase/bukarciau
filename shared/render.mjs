import {normalizeContent, getPath, CONTENT_FIELDS, IMAGE_FIELDS, getImageSettings} from './content.mjs';
import * as editorial from './content.mjs';

const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const newWindow = '<span class="sr-only"> (atsidaro naujame lange)</span>';
const mediaPattern = /^\/media\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;
const imageRatioClasses = new Map([
  ['1:1', 'image-ratio-1-1'], ['2:3', 'image-ratio-2-3'], ['3:2', 'image-ratio-3-2'],
  ['4:3', 'image-ratio-4-3'], ['9:16', 'image-ratio-9-16'], ['16:9', 'image-ratio-16-9']
]);
const explicitImageSize = value => ['small', 'normal', 'large'].includes(value) ? value : null;

function routeFor(pathname) {
  const path = String(pathname || '/').split(/[?#]/, 1)[0];
  const aliases = {'/': '/', '/index.html': '/', '/apie-mus': '/apie-mus/', '/apie-mus/': '/apie-mus/', '/apie-mus/index.html': '/apie-mus/', '/kontaktai': '/kontaktai/', '/kontaktai/': '/kontaktai/', '/kontaktai/index.html': '/kontaktai/', '/stovyklos/stovykla-01': '/stovyklos/stovykla-01/', '/stovyklos/stovykla-01/': '/stovyklos/stovykla-01/', '/stovyklos/stovykla-01/index.html': '/stovyklos/stovykla-01/', '/404.html': '/404.html'};
  return aliases[path] || null;
}

function renderLegacyPage(input, pathname, {assets = {}, preview = false} = {}) {
  const path = routeFor(pathname);
  if (!path) return null;
  const content = normalizeContent(input);
  const {site, camps, copy, seo} = content;
  const camp = camps[0];
  const descriptorFor = path => {
    const exact = CONTENT_FIELDS.find(field => field.path === path);
    if (exact) return exact;
    for (const field of CONTENT_FIELDS) {
      if (!path.startsWith(field.path + '.')) continue;
      const remainder = path.slice(field.path.length + 1).split('.');
      if (field.type === 'repeater' && remainder.length === 2 && /^\d+$/.test(remainder[0])) return field.fields.find(child => child.path === remainder[1]) || field;
      if (['list', 'paragraphs'].includes(field.type) && remainder.length === 1 && /^\d+$/.test(remainder[0])) return field;
    }
    return {label: 'Tekstas', type: 'text'};
  };
  const text = (field, type, lineBreaks = false) => {
    const value = e(getPath(content, field));
    const rendered = lineBreaks ? value.replace(/\r?\n/g, '<br>') : value;
    if (!preview) return rendered;
    const descriptor = descriptorFor(field);
    const editorType = type || (['textarea', 'paragraphs'].includes(descriptor.type) ? 'textarea' : 'text');
    return `<span data-cms-field="${e(field)}" data-cms-type="${e(editorType)}" tabindex="0" aria-label="Redaguoti: ${e(descriptor.label)}">${rendered}</span>`;
  };
  const paragraphs = (values, field) => values.map((value, index) => `<p>${text(`${field}.${index}`, 'textarea')}</p>`).join('');
  const imageHidden = field => {
    const slot = IMAGE_FIELDS.find(image => image.path === field);
    return Boolean(slot && getPath(content, slot.hiddenPath) === true);
  };
  const imageAttributes = field => {
    if (!preview || imageHidden(field)) return '';
    const label = IMAGE_FIELDS.find(image => image.path === field)?.label || 'Nuotrauka';
    return ` data-cms-image="${e(field)}" data-cms-label="${e(label)}" tabindex="0" aria-label="Keisti nuotrauką: ${e(label)}"`;
  };
  const imageSource = source => {
    const match = typeof source === 'string' && mediaPattern.exec(source);
    return match ? `${preview ? '/admin/api/media/' : '/media/'}${match[1]}` : null;
  };
  const imageRatioClass = field => {
    if (imageHidden(field)) return '';
    const slot = IMAGE_FIELDS.find(image => image.path === field);
    const cls = slot && imageRatioClasses.get(getPath(content, slot.ratioPath));
    return cls ? ` ${cls}` : '';
  };
  const photo = (source, alt, cls = '', field) => {
    if (imageHidden(field)) return '';
    const src = imageSource(source);
    return src
      ? `<div class="photo ${cls}${imageRatioClass(field)}"${imageAttributes(field)}><img src="${e(src)}" alt="${e(alt)}" loading="lazy" decoding="async"></div>`
      : `<div class="photo ${cls}${imageRatioClass(field)}"${preview ? '' : ' aria-hidden="true"'}${imageAttributes(field)}></div>`;
  };
  const registrationUrl = (() => {
    if (!camp.registrationUrl) return null;
    try { const url = new URL(camp.registrationUrl); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  })();
  const cta = ({labelPath, cls = 'button button-solid', local = false} = {}) => registrationUrl
    ? `<a class="${cls}" href="${e(registrationUrl)}" data-registration-link target="_blank" rel="noopener noreferrer">${text(labelPath || 'copy.actions.register')} ${arrow}${newWindow}</a>`
    : `<a class="${cls}" href="${local ? '' : '/'}#registracija" data-registration-intent>${text(labelPath || 'copy.actions.participate')} ${arrow}</a>`;
  const mail = `mailto:${site.email}?subject=${encodeURIComponent(copy.registration.emailSubject + ' · ' + camp.date)}`;
  const values = separator => site.values.map((value, index) => text(`site.values.${index}`)).join(separator);

  function header(current) {
    return `<a class="skip-link" href="#turinys">Pereiti prie turinio</a><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="${e(site.name)} - pradžia"><img src="/assets/logo.svg" width="104" height="80" alt="Arčiau"></a><button class="menu-toggle" aria-controls="navigation" aria-expanded="false" aria-label="Atidaryti meniu"><span></span><span></span></button><nav id="navigation" aria-label="Pagrindinis meniu"><a href="/#stovykla" ${current === 'camp' ? 'aria-current="page"' : ''}>${text('copy.header.camp')}</a><a href="/apie-mus/" ${current === 'about' ? 'aria-current="page"' : ''}>${text('copy.header.about')}</a><a href="/kontaktai/" ${current === 'contact' ? 'aria-current="page"' : ''}>${text('copy.header.contact')}</a><a class="nav-contact" href="mailto:${e(site.email)}">${text('copy.header.write')} ${arrow}</a></nav></div></header>`;
  }
  function footer() {
    return `<footer class="site-footer"><div class="footer-main wrap"><a class="footer-brand" href="/" aria-label="${e(site.name)} - pradžia"><img src="/assets/logo.svg" width="150" height="116" alt="Arčiau"></a><div class="footer-links"><span class="eyebrow">${text('copy.footer.contact')}</span><a href="mailto:${e(site.email)}">${text('site.email')}</a><a href="tel:${e(site.phone)}">${text('site.phoneDisplay')}</a></div><div class="footer-links"><span class="eyebrow">${text('copy.footer.about')}</span><a href="/apie-mus/">${text('site.organizers')}</a><a href="${e(site.facebook)}" target="_blank" rel="noopener noreferrer">${text('copy.footer.facebook')} ↗${newWindow}</a></div></div><div class="footer-bottom wrap"><span>© ${new Date().getUTCFullYear()} ${text('site.name')}</span><span>${values(' · ')}</span></div></footer>`;
  }
  function facts() {
    return `<dl class="event-facts "><div><dt>${text('copy.camp.date')}</dt><dd>${text('camps.0.date')}</dd></div><div><dt>${text('copy.camp.location')}</dt><dd>${text(camp.location ? 'camps.0.location' : 'copy.camp.locationPending')}</dd></div><div><dt>${text('copy.camp.price')}</dt><dd>${text(camp.price ? 'camps.0.price' : 'copy.camp.pricePending')}</dd></div></dl>`;
  }
  function faq() {
    return `<div class="faq">${camp.faq.map((item, index) => `<details><summary>${text(`camps.0.faq.${index}.question`)}<span aria-hidden="true">+</span></summary><p>${text(`camps.0.faq.${index}.${registrationUrl && item.answerWhenOpen ? 'answerWhenOpen' : 'answer'}`)}</p></details>`).join('')}</div>`;
  }
  function registration() {
    return `<section id="registracija" class="registration-section"><div class="registration-inner wrap"><div><span class="eyebrow">${text('camps.0.date')} · ${text('site.organizers')}</span><h2>${text('copy.registration.title')}</h2><p>${text('copy.registration.intro')}</p></div><div class="registration-status" data-registration-status="${registrationUrl ? 'open' : 'pending'}">${registrationUrl
      ? `<span class="status-label">${text('copy.registration.openLabel')}</span><p>${text('copy.registration.openText')}</p>${cta({labelPath: 'copy.registration.openButton'})}<small>${text('copy.registration.openNote')}</small>`
      : `<span class="status-label"><span class="status-dot" aria-hidden="true"></span>${text('copy.registration.pendingLabel')}</span><p>${text('copy.registration.pendingText')}</p><a class="button button-solid" href="${e(mail)}">${text('copy.registration.pendingButton')} ${arrow}</a><a class="registration-phone" href="tel:${e(site.phone)}">${text('site.phoneDisplay')}</a>`}</div></div></section>`;
  }
  const practical = !camp.location && !camp.price
    ? text('copy.camp.practicalPending')
    : `${text(camp.location ? 'camps.0.location' : 'copy.camp.locationPending')}. ${camp.price ? text('copy.camp.price') + ': ' + text('camps.0.price') : text('copy.camp.pricePendingSentence')}.`;

  let body, current = '', metadata;
  if (path === '/') {
    current = 'camp'; metadata = seo.home;
    const hero = imageHidden('site.heroImage') ? null : imageSource(site.heroImage);
    const statement = imageSource(site.statementImage);
    const heroRatioClass = imageRatioClass('site.heroImage');
    const heroImage = hero ? `<img class="hero-image" src="${e(hero)}" alt="${e(site.heroImageAlt)}" decoding="async" fetchpriority="high">` : '';
    const heroMedia = heroRatioClass ? `<div class="hero-media${heroRatioClass}"${imageAttributes('site.heroImage')}>${heroImage}</div>` : heroImage;
    const statementBlock = imageHidden('site.statementImage') ? '' : `<div class="statement${imageRatioClass('site.statementImage')}"${statement || preview ? '' : ' aria-hidden="true"'}${imageAttributes('site.statementImage')}>${statement ? `<img class="hero-image" src="${e(statement)}" alt="${e(site.statementImageAlt)}" loading="lazy" decoding="async">` : ''}</div>`;
    const mainHidden = imageHidden('camps.0.image');
    const secondaryHidden = imageHidden('camps.0.secondaryImage');
    const campPhotosHidden = mainHidden && secondaryHidden;
    const campVisual = campPhotosHidden ? '' : `<div class="camp-visual${mainHidden || secondaryHidden ? ' is-standalone' : ''}"${(!mainHidden && camp.image) || (!secondaryHidden && camp.secondaryImage) || preview ? '' : ' aria-hidden="true"'}>${photo(camp.image, camp.imageAlt, '', 'camps.0.image')}${photo(camp.secondaryImage, camp.secondaryImageAlt, mainHidden ? 'photo-standalone' : 'photo-small', 'camps.0.secondaryImage')}</div>`;
    body = `
<section class="hero${hero ? ' has-image' : ''}${heroRatioClass ? ' hero-ratio-layout' : ''}"${heroRatioClass ? '' : imageAttributes('site.heroImage')}>${heroMedia}<div class="hero-content"><span class="eyebrow">${text('copy.home.heroEyebrow')}</span><h1>${text('site.heroAccent')}</h1><p class="hero-subtitle">${text('site.heroTitle')} ${text('camps.0.date')}</p>${cta({local: true})}</div><div class="hero-bottom"><span>${values(' <i>·</i> ')}</span><a href="#susipazinkime" aria-label="Toliau - susipažinkime">↓</a></div></section>
<section class="intro wrap section" id="susipazinkime"><div><span class="eyebrow">${text('copy.home.introEyebrow')}</span><h2>${text('copy.home.introTitle')}</h2><a class="text-link" href="/apie-mus/">${text('copy.actions.about')} ${arrow}</a></div><div class="intro-copy">${paragraphs(site.aboutText, 'site.aboutText')}</div></section>
${statementBlock}
<section id="stovykla" class="camps"><span id="stovyklos" class="legacy-anchor" aria-hidden="true"></span><div class="section-heading wrap"><div><span class="eyebrow">${text('copy.home.campEyebrow')}</span><h2>${text('copy.home.campTitle')}</h2></div></div><article class="camp-row${campPhotosHidden ? ' without-photos' : ''}"><div class="camp-inner wrap${campPhotosHidden ? ' without-photos' : ''}"><div class="camp-copy"><span class="eyebrow">${text('camps.0.date')}</span><h3>${text('camps.0.title')}</h3><div class="camp-meta"><span>${practical}</span></div><p>${text('camps.0.description.0', 'textarea')}</p><a class="button" href="/stovyklos/stovykla-01/">${text('copy.actions.camp')} ${arrow}</a></div>${campVisual}</div></article></section>
${registration()}`;
  } else if (path === '/apie-mus/') {
    current = 'about'; metadata = seo.about;
    const togetherHidden = imageHidden('site.togetherImage');
    const aboutPhoto = togetherHidden ? '' : `<div>${photo(site.togetherImage, site.togetherImageAlt, '', 'site.togetherImage')}</div>`;
    body = `<section class="page-heading wrap"><span class="eyebrow">${text('site.name')}</span><h1>${text('site.storyTitle')}</h1></section><section class="about-story wrap${togetherHidden ? ' without-photo' : ''}">${aboutPhoto}<div class="story-copy">${paragraphs(site.story, 'site.story')}<a class="text-link" href="/#stovykla">${text('copy.actions.camp')} ${arrow}</a></div></section><section class="contact-strip wrap"><div><span class="eyebrow">${text('camps.0.date')}</span><h2>${text('copy.about.invitation')}</h2></div>${cta()}</section>`;
  } else if (path === '/kontaktai/') {
    current = 'contact'; metadata = seo.contact;
    body = `<section class="contact-page wrap"><div><span class="eyebrow">${text('site.name')}</span><h1>${text('copy.contact.title')}</h1><p class="contact-intro">${text('copy.contact.intro')}</p><div class="contact-item"><span>${text('copy.contact.email')}</span><a href="mailto:${e(site.email)}">${text('site.email')} ${arrow}</a></div><div class="contact-item"><span>${text('copy.contact.phone')}</span><a href="tel:${e(site.phone)}">${text('site.phoneDisplay')} ${arrow}</a></div><div class="contact-item"><span>${text('copy.contact.social')}</span><a href="${e(site.facebook)}" target="_blank" rel="noopener noreferrer">${text('copy.footer.facebook')} ↗${newWindow}</a></div></div><div class="contact-brand"><img src="/assets/logo-original.jpeg" alt="${e(copy.contact.logoAlt)}" width="1181" height="1181"></div></section>`;
  } else if (path === '/stovyklos/stovykla-01/') {
    current = 'camp'; metadata = {...seo.camp, title: seo.camp.title || `${camp.title} · ${camp.date}`};
    const included = camp.included.length || camp.notIncluded.length ? `<div class="included-grid">${camp.included.length ? `<div><h3>${text('copy.camp.included')}</h3><ul>${camp.included.map((item, index) => `<li>${text(`camps.0.included.${index}`)}</li>`).join('')}</ul></div>` : ''}${camp.notIncluded.length ? `<div><h3>${text('copy.camp.notIncluded')}</h3><ul>${camp.notIncluded.map((item, index) => `<li>${text(`camps.0.notIncluded.${index}`)}</li>`).join('')}</ul></div>` : ''}</div>` : '';
    const coverHidden = imageHidden('camps.0.detailImage');
    const detailCover = coverHidden ? '' : `<div class="detail-cover wrap">${photo(camp.detailImage || camp.image, camp.detailImage ? camp.detailImageAlt : camp.imageAlt, '', 'camps.0.detailImage')}</div>`;
    body = `<section class="camp-detail-heading wrap"><a class="text-link back-link" href="/#stovykla">← ${text('copy.actions.back')}</a><span class="eyebrow">${text('camps.0.date')} · ${text('site.organizers')}</span><h1>${text('camps.0.title')}</h1><p>${text('camps.0.summary')}</p>${facts()}<div class="detail-heading-action">${cta({local: true})}</div></section>${detailCover}<div class="detail-layout wrap section${coverHidden ? ' without-cover' : ''}"><section><span class="eyebrow">${text('copy.camp.about')}</span><h2>${text('camps.0.introTitle')}</h2>${paragraphs(camp.description, 'camps.0.description')}<h3 class="program-title">${text('copy.camp.program')}</h3>${camp.program.length ? `<div class="program">${camp.program.map((item, index) => `<div><h4>${text(`camps.0.program.${index}.title`)}</h4><p>${text(`camps.0.program.${index}.text`)}</p></div>`).join('')}</div>` : `<p>${text('copy.camp.programPending')}</p>`}${included}</section><section><span class="eyebrow">${text('copy.camp.faqEyebrow')}</span><h2>${text('copy.camp.faqTitle')}</h2>${faq()}</section></div>${registration()}`;
  } else {
    metadata = seo.notFound;
    body = `<section class="not-found wrap"><span class="eyebrow">404</span><h1>${text('copy.notFound.title', 'textarea', true)}</h1><a class="button button-solid" href="/">${text('copy.actions.back')} ${arrow}</a></section>`;
  }

  const title = `${metadata.title} | ${site.name}`;
  const canonical = path === '/404.html' ? '' : `<link rel="canonical" href="${e(site.url + path)}">`;
  const html = `<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(metadata.description)}">${site.draft || preview ? '<meta name="robots" content="noindex, nofollow">' : ''}<meta name="theme-color" content="#bfebac"><meta property="og:type" content="website"><meta property="og:locale" content="lt_LT"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(metadata.description)}">${canonical}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${e(assets.styles || '/styles.css')}">${preview ? '<link rel="stylesheet" href="/admin/visual.css">' : ''}<script src="${e(assets.script || '/app.js')}" defer></script></head><body>${header(current)}<main id="turinys" tabindex="-1">${body}</main>${footer()}</body></html>`;
  return {html, title};
}

export function renderRobots(input) {
  const {site} = normalizeContent(input);
  return site.draft ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`;
}

export function renderSitemap(input) {
  const {site} = normalizeContent(input);
  if (site.draft) return null;
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/apie-mus/', '/kontaktai/', '/stovyklos/stovykla-01/'].map(path => `<url><loc>${e(site.url + path)}</loc></url>`).join('')}</urlset>`;
}

const pageKeys = {'/': 'home', '/apie-mus/': 'about', '/kontaktai/': 'contact', '/stovyklos/stovykla-01/': 'camp'};
const safeColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
const blockId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const layoutBounds = {width:[20,100], height:[40,2000], paddingTop:[0,240], paddingBottom:[0,240]};
const boundedLayout = (content, id) => Object.fromEntries(Object.entries(layoutBounds).map(([key, [min,max]]) => {
  const value = content.blockLayouts?.[id]?.[key];
  return [key, Number.isInteger(value) && value >= min && value <= max ? value : null];
}));
const withClass = (html, value) => html.replace(/^(\s*<[a-z][\w-]*)([^>]*>)/i, (all, tag, rest) => /\bclass="/.test(rest) ? tag + rest.replace(/\bclass="/, `class="${value} `) : `${tag} class="${value}"${rest}`);
const withAttributes = (html, attributes) => html.replace(/^(\s*<[a-z][\w-]*)(?=[\s>])/i, `$1${attributes}`);
const safeUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
};

function hasResponsiveContent(content) {
  return Boolean(content.hiddenParts?.length || content.partOrder?.length || content.design || Object.keys(content.blockLayouts || {}).length || Object.keys(content.linkOverrides || {}).length || Object.values(content.pageBlocks || {}).some(blocks => Array.isArray(blocks) && blocks.length) || IMAGE_FIELDS.some(slot => (getPath(content, slot.positionPath) || 'default') !== 'default' || (slot.sizePath && explicitImageSize(getPath(content, slot.sizePath)))) || ['site.values', 'site.aboutText', 'site.story', 'camps.0.description'].some(path => getPath(content, path)?.length === 0));
}

// Defaults continue through the reviewed renderer. The responsive renderer is opt-in
// for publication. Preview uses the same content and lets CSS adapt its geometry.
export function renderPage(input, pathname, options = {}) {
  const content = normalizeContent(input);
  if (!hasResponsiveContent(content) && !(options.preview && Object.hasOwn(options, 'previewDevice'))) return renderLegacyPage(content, pathname, options);
  return renderResponsivePage(content, pathname, options);
}

function renderResponsivePage(content, pathname, {assets = {}, preview = false, previewDevice = 'desktop'} = {}) {
  const path = routeFor(pathname);
  if (!path) return null;
  const selectedDevice = previewDevice === 'mobile' ? 'mobile' : 'desktop';
  const pageKey = pageKeys[path];
  const knownParts = new Set((editorial.CONTENT_PARTS || []).map(part => part.id));
  const knownLinks = new Set((editorial.LINK_PARTS || []).map(part => part.id));
  const zoneMetadata = (editorial.CONTENT_ZONES || []).filter(zone => zone.page === pageKey);
  const knownZones = new Set(zoneMetadata.map(zone => zone.id));
  const knownLayouts = new Map((editorial.getLayoutTargets?.(content) || []).map(target => [target.id, target]));
  const photoLayoutId = field => `photo-${field.replaceAll('.', '-')}`;
  const photoDimensions = field => boundedLayout(content, photoLayoutId(field));
  const hasPhotoDimensions = field => ['width', 'height'].some(key => typeof photoDimensions(field)[key] === 'number');
  function markLayout(id, html) {
    if (!html) return '';
    const target = knownLayouts.get(id);
    if (!target || !/^[a-zA-Z0-9-]+$/.test(id)) return html;
    const dimensions = boundedLayout(content, id);
    const flags = ['width','height'].filter(key => typeof dimensions[key] === 'number').map(key => ` cms-layout-has-${key}`).join('');
    const padding = ['paddingTop','paddingBottom'].some(key => typeof dimensions[key] === 'number');
    const marked = withClass(html, `cms-layout cms-layout-${target.type} cms-layout-${id}${flags}${padding ? ' cms-layout-has-padding' : ''}`);
    return preview ? withAttributes(marked, ` data-cms-layout="${id}"`) : marked;
  }
  function profile(device) {
    const data = content;
    const {site, camps, copy} = data;
    const camp = camps[0];
    const hidden = new Set(data.hiddenParts || []);
    const order = new Map((data.partOrder || []).map((id, index) => [id, index]));
    function text(field, lineBreaks = false) {
      const value = e(getPath(data, field));
      const rendered = lineBreaks ? value.replace(/\r?\n/g, '<br>') : value;
      if (!preview) return rendered;
      const descriptor = CONTENT_FIELDS.find(item => item.path === field || field.startsWith(item.path + '.'));
      const textarea = descriptor && ['textarea', 'paragraphs', 'repeater'].includes(descriptor.type);
      return `<span data-cms-field="${e(field)}" data-cms-type="${textarea ? 'textarea' : 'text'}" tabindex="0" aria-label="Redaguoti: ${e(descriptor?.label || 'Tekstas')}">${rendered}</span>`;
    }
    function part(id, html) {
      if (!html || hidden.has(id)) return '';
      if (knownLinks.has(id)) {
        const url = editorial.safeLinkUrl?.(data.linkOverrides?.[id]);
        html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/i, (anchor, attrs, inner) => {
          if (url) {
            const changed = !attrs.includes(`href="${e(url)}"`);
            attrs = attrs.replace(/\s(?:href|target|rel)="[^"]*"/g, '');
            if (changed) attrs = attrs.replace(/\s(?:data-registration-(?:link|intent)(?:="[^"]*")?|aria-current="[^"]*")/g, '');
            const external = /^https:/i.test(url);
            inner = inner.replace(newWindow, '');
            attrs += ` href="${e(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
            if (external) inner += newWindow;
          }
          return `<a${attrs}${preview ? ` data-cms-link="${e(id)}"` : ''}>${inner}</a>`;
        });
      }
      const marked = preview && knownParts.has(id) ? withAttributes(html, ` data-cms-part="${e(id)}"`) : html;
      return markLayout(`part-${id.replaceAll('.', '-')}`, marked);
    }
    function group(zone, entries, cls = '', tag = 'div') {
      const sorted = entries.map((entry, index) => ({id:entry[0], html:entry[1], index})).sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.index - b.index);
      const target = zoneMetadata.find(target => target.inside && target.sortZone === zone);
      const blocks = target ? (data.pageBlocks?.[pageKey] || []).filter(block => block.zone === target.id) : [];
      const seen = new Set(sorted.map(entry => entry.id));
      const before = id => blocks.filter(block => block.beforePart === id).map(block => renderBlock(block, target.id)).join('');
      const html = sorted.map(entry => before(entry.id) + part(entry.id, entry.html)).join('') + blocks.filter(block => block.beforePart == null || !seen.has(block.beforePart)).map(block => renderBlock(block,target.id)).join('');
      if (!html && !(preview && target)) return '';
      const classes = [cls, blocks.length ? 'cms-group-with-blocks' : ''].filter(Boolean).join(' ');
      return `<${tag}${classes ? ` class="${classes}"` : ''}${preview ? ` data-cms-sort-zone="${e(zone)}"${target ? ` data-cms-drop-zone="${e(target.id)}"` : ''}` : ''}>${html}</${tag}>`;
    }
    const registrationUrl = safeUrl(camp.registrationUrl);
    const cta = ({labelPath, cls = 'button button-solid', local = false} = {}) => registrationUrl
      ? `<a class="${cls}" href="${e(registrationUrl)}" data-registration-link target="_blank" rel="noopener noreferrer">${text(labelPath || 'copy.actions.register')} ${arrow}${newWindow}</a>`
      : `<a class="${cls}" href="${local ? '' : '/'}#registracija" data-registration-intent>${text(labelPath || 'copy.actions.participate')} ${arrow}</a>`;
    const values = separator => site.values.map((value, index) => text(`site.values.${index}`)).join(separator);
    function settings(field) {
      const value = getImageSettings(data, field);
      if (field === 'camps.0.detailImage' && !value.source) {
        const main = getImageSettings(data, 'camps.0.image');
        return {...value, source:main.source, alt:main.alt};
      }
      return value;
    }
    function source(value) {
      const match = typeof value === 'string' && mediaPattern.exec(value);
      return match ? `${preview ? '/admin/api/media/' : '/media/'}${match[1]}` : null;
    }
    function photo(field, cls = 'photo') {
      const image = settings(field);
      if (image.hidden) return '';
      const src = source(image.source);
      const ratio = imageRatioClasses.get(image.ratio);
      const size = explicitImageSize(image.size);
      const label = IMAGE_FIELDS.find(slot => slot.path === field)?.label || 'Nuotrauka';
      return markLayout(photoLayoutId(field), `<div class="${cls}${ratio ? ` ${ratio}` : ''}${size ? ` image-size-${size}` : ''}"${preview ? ` data-cms-image="${e(field)}" data-cms-label="${e(label)}" tabindex="0" aria-label="Keisti nuotrauką: ${e(label)}"` : src ? '' : ' aria-hidden="true"'}>${src ? `<img src="${e(src)}" alt="${e(image.alt)}" loading="${field === 'site.heroImage' ? 'eager' : 'lazy'}" decoding="async"${field === 'site.heroImage' ? ' fetchpriority="high"' : ''}>` : ''}</div>`);
    }
    function imageTargets(field) {
      if (!preview || settings(field).hidden) return '';
      const label = IMAGE_FIELDS.find(slot => slot.path === field)?.label || 'Nuotrauka';
      return `<div class="cms-image-drop-targets" data-cms-image-zones="${e(field)}">${['above', 'left', 'default', 'right', 'below'].map(position => `<span data-cms-image-drop="${e(field)}" data-cms-position="${position}" aria-label="${e(label)}: ${e(({above:'virš teksto', left:'kairėje', default:'pagal dizainą', right:'dešinėje', below:'po tekstu'})[position])}"></span>`).join('')}</div>`;
    }
    function layout(field, html, cls = '', fallback = 'below') {
      const image = settings(field), media = photo(field);
      const position = image.position === 'default' ? fallback : image.position;
      const size = explicitImageSize(image.size);
      const hasCopy = Boolean(html.replace(/<[^>]*>/g, '').trim() || /class="[^"]*\bcms-custom-block\b|data-cms-drop-zone=/.test(html));
      return `<div class="responsive-layout ${cls} photo-layout-${field.replaceAll('.', '-')} r-position-${e(position)}${size ? ` r-media-size-${size}` : ''}${media ? '' : ' without-media'}${hasCopy ? '' : ' without-copy'}">${media ? `<div class="responsive-layout-media">${media}</div>` : ''}${hasCopy ? `<div class="responsive-layout-copy">${html}</div>` : ''}${imageTargets(field)}</div>`;
    }
    function renderBlock(block, id) {
        if (!blockId(block.id) || !['text', 'image', 'button', 'link', 'spacer'].includes(block.type)) return '';
        const size = ['small', 'normal', 'large'].includes(block.size) ? block.size : 'normal';
        const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'left';
        const cls = `cms-custom-block cms-block-${block.id} cms-block-${block.type} cms-size-${size} cms-align-${align}`;
        const attrs = preview ? ` data-cms-block="${block.id}" data-cms-block-zone="${e(id)}"` : '';
        let inner = '';
        if (block.type === 'text') inner = block.text ? `<p>${e(block.text).replace(/\r?\n/g, '<br>')}</p>` : preview ? '<p class="cms-incomplete-block">Įrašyk tekstą</p>' : '';
        if (block.type === 'image') {
          const src = source(block.source), ratio = imageRatioClasses.get(block.ratio);
          inner = src ? `<div class="photo${ratio ? ` ${ratio}` : ''}"><img src="${e(src)}" alt="${e(block.alt)}" loading="lazy" decoding="async"></div>` : preview ? '<div class="photo cms-block-placeholder" aria-hidden="true"></div>' : '';
        }
        if (['button', 'link'].includes(block.type)) {
          const url = typeof editorial.safeLinkUrl === 'function' ? editorial.safeLinkUrl(block.url) : safeUrl(block.url);
          const external = /^https:/i.test(url || '');
          inner = block.text && url ? `<a class="${block.type === 'button' ? 'button button-solid' : 'text-link'}" href="${e(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(block.text)} ${arrow}${external ? newWindow : ''}</a>` : preview ? '<span class="cms-incomplete-block">Įrašyk nuorodos tekstą ir adresą</span>' : '';
        }
        if (block.type === 'spacer') inner = '<span aria-hidden="true"></span>';
        return inner ? markLayout(`block-${block.id}`, `<div class="${cls}"${attrs}>${inner}</div>`) : '';
    }
    function zone(id) {
      if (!knownZones.has(id) || zoneMetadata.find(zone => zone.id === id)?.inside) return '';
      const blocks = (data.pageBlocks?.[pageKey] || []).filter(block => block.zone === id);
      const rendered = blocks.map(block => renderBlock(block, id)).join('');
      return rendered || preview ? `<div class="cms-content-zone wrap"${preview ? ` data-cms-drop-zone="${e(id)}" aria-label="${e(editorial.CONTENT_ZONES.find(zone => zone.id === id)?.label || id)}"` : ''}>${rendered}</div>` : '';
    }
    return {device, data, site, camp, copy, hidden, order, text, part, group, cta, values, registrationUrl, settings, photo, layout, imageTargets, zone};
  }
  const active = profile('desktop');
  const variant = render => render(active);
  const zone = id => active.zone(id);
  function heading(id, field, cls = '') {
    return active.part(id, `<h1${cls ? ` class="${cls}"` : ''}>${active.text(field, true)}</h1>`);
  }
  const sharedPart = (id, render) => active.part(id, render(active));
  function header() {
    const links = variant(c => c.group('header.links', [
      ['common.nav.camp', `<a href="/#stovykla"${pageKey === 'home' || pageKey === 'camp' ? ' aria-current="page"' : ''}>${c.text('copy.header.camp')}</a>`],
      ['common.nav.about', `<a href="/apie-mus/"${pageKey === 'about' ? ' aria-current="page"' : ''}>${c.text('copy.header.about')}</a>`],
      ['common.nav.contact', `<a href="/kontaktai/"${pageKey === 'contact' ? ' aria-current="page"' : ''}>${c.text('copy.header.contact')}</a>`],
      ['common.nav.write', `<a class="nav-contact" href="mailto:${e(c.site.email)}">${c.text('copy.header.write')} ${arrow}</a>`]
    ], 'responsive-nav-links'));
    return `<a class="skip-link" href="#turinys">Pereiti prie turinio</a><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="${e(content.site.name)} - pradžia"><img src="/assets/logo.svg" width="104" height="80" alt="Arčiau"></a><button class="menu-toggle" aria-controls="navigation" aria-expanded="false" aria-label="Atidaryti meniu"><span></span><span></span></button><nav id="navigation" aria-label="Pagrindinis meniu">${links}</nav></div></header>`;
  }
  function footer(c) {
    const main = `<div class="footer-main wrap"><a class="footer-brand" href="/" aria-label="${e(c.site.name)} - pradžia"><img src="/assets/logo.svg" width="150" height="116" alt="Arčiau"></a>${c.group('footer.contact', [
      ['common.footer.contactHeading', `<span class="eyebrow">${c.text('copy.footer.contact')}</span>`], ['common.footer.email', `<a href="mailto:${e(c.site.email)}">${c.text('site.email')}</a>`], ['common.footer.phone', `<a href="tel:${e(c.site.phone)}">${c.text('site.phoneDisplay')}</a>`]
    ], 'footer-links')}${c.group('footer.about', [
      ['common.footer.aboutHeading', `<span class="eyebrow">${c.text('copy.footer.about')}</span>`], ['common.footer.organizers', `<a href="/apie-mus/">${c.text('site.organizers')}</a>`], ['common.footer.facebook', `<a href="${e(safeUrl(c.site.facebook) || 'https://www.facebook.com/')}" target="_blank" rel="noopener noreferrer">${c.text('copy.footer.facebook')} ↗${newWindow}</a>`]
    ], 'footer-links')}</div>`;
    return `<footer class="site-footer">${markLayout('section-footer', main)}${c.group('footer.bottom', [['common.footer.copyright', `<span>© ${new Date().getUTCFullYear()} ${c.text('site.name')}</span>`], ['common.footer.values', c.site.values.length ? `<span>${c.values(' · ')}</span>` : '']], 'footer-bottom wrap')}</footer>`;
  }
  function facts(c) {
    return c.group('detail.facts', [
      ['detail.fact.date', `<div><dt>${c.text('copy.camp.date')}</dt><dd>${c.text('camps.0.date')}</dd></div>`],
      ['detail.fact.location', `<div><dt>${c.text('copy.camp.location')}</dt><dd>${c.text(c.camp.location ? 'camps.0.location' : 'copy.camp.locationPending')}</dd></div>`],
      ['detail.fact.price', `<div><dt>${c.text('copy.camp.price')}</dt><dd>${c.text(c.camp.price ? 'camps.0.price' : 'copy.camp.pricePending')}</dd></div>`]
    ], 'event-facts', 'dl');
  }
  function registration(c) {
    const intro = c.group('registration.intro', [['registration.eyebrow', `<span class="eyebrow">${c.text('camps.0.date')} · ${c.text('site.organizers')}</span>`], ['registration.title', `<h2>${c.text('copy.registration.title')}</h2>`], ['registration.intro', `<p>${c.text('copy.registration.intro')}</p>`]], 'registration-copy');
    const mail = `mailto:${c.site.email}?subject=${encodeURIComponent(c.copy.registration.emailSubject + ' · ' + c.camp.date)}`;
    const entries = c.registrationUrl ? [
      ['registration.status', `<span class="status-label">${c.text('copy.registration.openLabel')}</span>`], ['registration.text', `<p>${c.text('copy.registration.openText')}</p>`], ['registration.cta', c.cta({labelPath:'copy.registration.openButton'})], ['registration.note', `<small>${c.text('copy.registration.openNote')}</small>`]
    ] : [
      ['registration.status', `<span class="status-label"><span class="status-dot" aria-hidden="true"></span>${c.text('copy.registration.pendingLabel')}</span>`], ['registration.text', `<p>${c.text('copy.registration.pendingText')}</p>`], ['registration.cta', `<a class="button button-solid" href="${e(mail)}">${c.text('copy.registration.pendingButton')} ${arrow}</a>`], ['registration.phone', `<a class="registration-phone" href="tel:${e(c.site.phone)}">${c.text('site.phoneDisplay')}</a>`]
    ];
    const status = withAttributes(c.group('registration.status', entries, 'registration-status'), ` data-registration-status="${c.registrationUrl ? 'open' : 'pending'}"`);
    return intro || status ? `<div class="registration-inner wrap${!intro || !status ? ' responsive-single-column' : ''}">${intro}${status}</div>` : '';
  }
  const registrationSection = (id = pageKey === 'home' ? 'section-home-registration' : 'section-camp-registration') => {
    const inner = variant(registration);
    return inner ? markLayout(id, `<section id="registracija" class="registration-section">${inner}</section>`) : '<div id="registracija"></div>';
  };
  function hero() {
    const c = active, image = c.settings('site.heroImage');
    const size = explicitImageSize(image.size);
    const position = (size || hasPhotoDimensions('site.heroImage')) && image.position === 'default' ? 'right' : image.position;
    const classes = `hero-position-${position} photo-layout-site-heroImage${size ? ` hero-photo-size-${size}` : ''}${image.hidden ? ' hero-hidden' : ''}${image.ratio !== 'auto' ? ' hero-custom-ratio' : ''}${image.source && !image.hidden ? ' hero-has-photo' : ''}`;
    const media = c.photo('site.heroImage', 'hero-media responsive-hero-media');
    const copy = c.group('home.hero', [
      ['home.hero.eyebrow', `<span class="eyebrow">${c.text('copy.home.heroEyebrow')}</span>`],
      ['home.hero.title', `<h1>${c.text('site.heroAccent')}</h1>`],
      ['home.hero.subtitle', `<p class="hero-subtitle">${c.text('site.heroTitle')} ${c.text('camps.0.date')}</p>`],
      ['home.hero.cta', c.cta({local:true})]
    ], 'hero-content');
    const bottom = c.group('home.heroBottom', [
      ['home.hero.values', c.site.values.length ? `<span class="responsive-hero-values">${c.values(' <i>·</i> ')}</span>` : ''],
      ['home.hero.next', '<a class="responsive-hero-next" href="#susipazinkime" aria-label="Toliau - susipažinkime">↓</a>']
    ], 'hero-bottom responsive-hero-bottom');
    return markLayout('section-home-hero', `<section class="hero responsive-hero ${classes}">${media}${copy}${bottom}${c.imageTargets('site.heroImage')}</section>`);
  }
  function homeIntro(c) {
    const heading = c.group('home.introHeading', [['home.intro.eyebrow', `<span class="eyebrow">${c.text('copy.home.introEyebrow')}</span>`], ['home.intro.title', `<h2>${c.text('copy.home.introTitle')}</h2>`], ['home.intro.link', `<a class="text-link" href="/apie-mus/">${c.text('copy.actions.about')} ${arrow}</a>`]], 'intro-heading');
    const paragraphs = c.group('home.introParagraphs', c.site.aboutText.map((value, index) => [`home.intro.paragraph.${index}`, `<p>${c.text(`site.aboutText.${index}`)}</p>`]), 'intro-copy');
    if (c.settings('site.statementImage').position === 'default') {
      const copy = heading || paragraphs ? markLayout('section-home-intro', `<div class="intro wrap section${!heading || !paragraphs ? ' responsive-single-column' : ''}">${heading}${paragraphs}</div>`) : '';
      return `<div class="responsive-intro-profile responsive-intro-default">${copy}${c.photo('site.statementImage', 'statement responsive-statement')}${c.imageTargets('site.statementImage')}</div>`;
    }
    return markLayout('section-home-intro', `<div class="responsive-intro-profile wrap section">${c.layout('site.statementImage', `<div class="intro${!heading || !paragraphs ? ' responsive-single-column' : ''}">${heading}${paragraphs}</div>`, 'responsive-intro-layout', 'below')}</div>`);
  }
  function campCard(c) {
    const practical = !c.camp.location && !c.camp.price ? c.text('copy.camp.practicalPending') : `${c.text(c.camp.location ? 'camps.0.location' : 'copy.camp.locationPending')}. ${c.camp.price ? c.text('copy.camp.price') + ': ' + c.text('camps.0.price') : c.text('copy.camp.pricePendingSentence')}.`;
    const copy = c.group('home.campCopy', [['home.camp.date', `<span class="eyebrow">${c.text('camps.0.date')}</span>`], ['home.camp.title', `<h3>${c.text('camps.0.title')}</h3>`], ['home.camp.meta', `<div class="camp-meta"><span>${practical}</span></div>`], ['home.camp.description', c.camp.description.length ? `<p>${c.text('camps.0.description.0')}</p>` : ''], ['home.camp.link', `<a class="button" href="/stovyklos/stovykla-01/">${c.text('copy.actions.camp')} ${arrow}</a>`]], 'camp-copy');
    const main = c.settings('camps.0.image'), secondary = c.settings('camps.0.secondaryImage');
    const photos = [['camps.0.image', main], ['camps.0.secondaryImage', secondary]].filter(([, image]) => !image.hidden);
    let layout;
    if (main.position === 'default' && secondary.position === 'default' && !explicitImageSize(main.size) && !explicitImageSize(secondary.size) && !hasPhotoDimensions('camps.0.image') && !hasPhotoDimensions('camps.0.secondaryImage')) {
      const media = photos.length ? `<div class="camp-visual${photos.length === 1 ? ' is-standalone' : ''}">${c.photo('camps.0.image')}${c.photo('camps.0.secondaryImage', main.hidden ? 'photo photo-standalone' : 'photo photo-small')}</div>` : '';
      layout = `<div class="responsive-layout responsive-camp-default r-position-${'right'}${media ? '' : ' without-media'}">${media ? `<div class="responsive-layout-media">${media}</div>` : ''}<div class="responsive-layout-copy">${copy}</div></div>`;
    } else {
      const positions = {above:[], below:[], left:[], right:[]};
      for (const [field, image] of photos) {
        const position = image.position === 'default' ? (field === 'camps.0.secondaryImage' ? 'below' : 'right') : image.position;
        positions[position].push({field, image});
      }
      const sizes = ['small', 'normal', 'large'];
      const columnSize = position => sizes[Math.max(...positions[position].map(({image}) => sizes.indexOf(explicitImageSize(image.size) || 'large')))];
      const column = position => positions[position].length ? `<div class="responsive-camp-${position}${['left','right'].includes(position) ? ` r-camp-column-${columnSize(position)}` : ''}">${positions[position].map(({field}) => c.photo(field)).join('')}</div>` : '';
      const manualWidth = ['camps.0.image','camps.0.secondaryImage'].some(field => photoDimensions(field).width != null);
      layout = `${column('above')}<div class="responsive-camp-middle${manualWidth ? ' cms-camp-manual-width' : ''}${positions.left.length ? ` has-left r-left-size-${columnSize('left')}` : ''}${positions.right.length ? ` has-right r-right-size-${columnSize('right')}` : ''}">${column('left')}<div class="responsive-layout-copy">${copy}</div>${column('right')}</div>${column('below')}`;
    }
    return `<article class="camp-row"><div class="responsive-camp-profile wrap">${layout}${c.imageTargets('camps.0.image')}${c.imageTargets('camps.0.secondaryImage')}</div></article>`;
  }
  function aboutStory(c) {
    const copy = c.group('about.story', [...c.site.story.map((value, index) => [`about.paragraph.${index}`, `<p>${c.text(`site.story.${index}`)}</p>`]), ['about.link', `<a class="text-link" href="/#stovykla">${c.text('copy.actions.camp')} ${arrow}</a>`]], 'story-copy');
    return markLayout('section-about-story', `<div class="responsive-about-profile wrap">${c.layout('site.togetherImage', copy, 'responsive-about-layout', 'left')}</div>`);
  }
  function aboutInvitation(c) {
    return markLayout('section-about-invitation', c.group('about.invitation', [['about.invitationDate', `<span class="eyebrow">${c.text('camps.0.date')}</span>`], ['about.invitationTitle', `<h2>${c.text('copy.about.invitation')}</h2>`], ['about.cta', c.cta()]], 'contact-strip wrap responsive-invitation'));
  }
  function detailBody(c) {
    const description = c.group('detail.description', [['detail.aboutEyebrow', `<span class="eyebrow">${c.text('copy.camp.about')}</span>`], ['detail.introTitle', `<h2>${c.text('camps.0.introTitle')}</h2>`], ...c.camp.description.map((value, index) => [`detail.paragraph.${index}`, `<p>${c.text(`camps.0.description.${index}`)}</p>`])], 'detail-description');
    const program = c.group('detail.programExtras', [
      ['detail.programHeading', `<h3 class="program-title">${c.text('copy.camp.program')}</h3>`],
      ...c.camp.program.map((value, index) => [`detail.program.${index}`, `<div class="program-item"><h4>${c.text(`camps.0.program.${index}.title`)}</h4><p>${c.text(`camps.0.program.${index}.text`)}</p></div>`]),
      ['detail.programPending', c.camp.program.length ? '' : `<p>${c.text('copy.camp.programPending')}</p>`]
    ], 'program-extras');
    const included = (field, key) => c.camp[field].length ? `<div>${c.part(`detail.${key}Heading`, `<h3>${c.text(`copy.camp.${key}`)}</h3>`)}${c.group(`detail.${key}`, c.camp[field].map((value, index) => [`detail.${key}.${index}`, `<li>${c.text(`camps.0.${field}.${index}`)}</li>`]), '', 'ul')}</div>` : '';
    const faq = c.group('detail.faqExtras', [
      ['detail.faqEyebrow', `<span class="eyebrow">${c.text('copy.camp.faqEyebrow')}</span>`], ['detail.faqTitle', `<h2>${c.text('copy.camp.faqTitle')}</h2>`],
      ...c.camp.faq.map((item, index) => [`detail.faq.${index}`, `<details><summary>${c.text(`camps.0.faq.${index}.question`)}<span aria-hidden="true">+</span></summary><p>${c.text(`camps.0.faq.${index}.${c.registrationUrl && item.answerWhenOpen ? 'answerWhenOpen' : 'answer'}`)}</p></details>`])
    ], 'faq');
    const body = `<div class="detail-layout">${markLayout('section-camp-description', `<section>${description}${markLayout('section-camp-program', `<div class="detail-program">${program}</div>`)}<div class="included-grid">${included('included', 'included')}${included('notIncluded', 'notIncluded')}</div></section>`)}${markLayout('section-camp-faq', `<section>${faq}</section>`)}</div>`;
    return markLayout('section-camp-content', `<div class="responsive-detail-profile wrap section">${c.layout('camps.0.detailImage', body, 'responsive-detail-layout', 'above')}</div>`);
  }
  let body = '', metadata;
  if (pageKey === 'home') {
    metadata = content.seo.home;
    const campHeading = variant(c => c.group('home.campHeading', [['home.camp.eyebrow', `<span class="eyebrow">${c.text('copy.home.campEyebrow')}</span>`], ['home.camp.heading', `<h2>${c.text('copy.home.campTitle')}</h2>`]], 'section-heading wrap responsive-section-heading'));
    body = `${hero()}${zone('home.afterHero')}${zone('home.beforeIntro')}<section id="susipazinkime" class="responsive-intro">${variant(homeIntro)}</section>${zone('home.afterIntro')}${zone('home.beforeCamp')}${markLayout('section-home-camp', `<section id="stovykla" class="camps"><span id="stovyklos" class="legacy-anchor" aria-hidden="true"></span>${campHeading}${variant(campCard)}</section>`)}${zone('home.afterCamp')}${zone('home.beforeRegistration')}${registrationSection()}${zone('home.afterRegistration')}`;
  } else if (pageKey === 'about') {
    metadata = content.seo.about;
    body = `${markLayout('section-about-heading', active.group('about.heading', [['about.eyebrow', `<span class="eyebrow">${active.text('site.name')}</span>`], ['about.title', `<h1>${active.text('site.storyTitle')}</h1>`]], 'page-heading wrap', 'section'))}${zone('about.beforeStory')}${aboutStory(active)}${zone('about.afterStory')}${zone('about.beforeInvitation')}${aboutInvitation(active)}${zone('about.afterInvitation')}`;
  } else if (pageKey === 'contact') {
    metadata = content.seo.contact;
    const c = active;
    const facebook = safeUrl(c.site.facebook);
    const copy = c.group('contact.copy', [
      ['contact.eyebrow', `<span class="eyebrow">${c.text('site.name')}</span>`], ['contact.title', `<h1>${c.text('copy.contact.title')}</h1>`],
      ['contact.intro', `<p class="contact-intro">${c.text('copy.contact.intro')}</p>`],
      ['contact.email', `<div class="contact-item"><span>${c.text('copy.contact.email')}</span><a href="mailto:${e(c.site.email)}">${c.text('site.email')} ${arrow}</a></div>`],
      ['contact.phone', `<div class="contact-item"><span>${c.text('copy.contact.phone')}</span><a href="tel:${e(c.site.phone)}">${c.text('site.phoneDisplay')} ${arrow}</a></div>`],
      ['contact.facebook', `<div class="contact-item"><span>${c.text('copy.contact.social')}</span>${facebook ? `<a href="${e(facebook)}" target="_blank" rel="noopener noreferrer">${c.text('copy.footer.facebook')} ↗${newWindow}</a>` : `<span>${c.text('copy.footer.facebook')}</span>`}</div>`]
    ], 'contact-copy');
    body = `${zone('contact.beforeContent')}${markLayout('section-contact-content', `<section class="contact-page wrap${copy ? '' : ' responsive-single-column'}">${copy}<div class="contact-brand"><img src="/assets/logo-original.jpeg" alt="${e(c.copy.contact.logoAlt)}" width="1181" height="1181"></div></section>`)}${zone('contact.afterContent')}`;
  } else if (pageKey === 'camp') {
    metadata = {...content.seo.camp, title:content.seo.camp.title || `${content.camps[0].title} · ${content.camps[0].date}`};
    const c = active;
    const top = c.group('detail.heading', [
      ['detail.back', `<a class="text-link back-link" href="/#stovykla">← ${c.text('copy.actions.back')}</a>`],
      ['detail.eyebrow', `<span class="eyebrow">${c.text('camps.0.date')} · ${c.text('site.organizers')}</span>`],
      ['detail.title', `<h1>${c.text('camps.0.title')}</h1>`], ['detail.summary', `<p>${c.text('camps.0.summary')}</p>`],
      ['detail.cta', `<div class="detail-heading-action">${c.cta({local:true})}</div>`]
    ], 'detail-heading-copy');
    body = `${markLayout('section-camp-heading', `<section class="camp-detail-heading wrap">${top}${facts(c)}</section>`)}${zone('camp.beforeDescription')}${detailBody(c)}${zone('camp.afterDescription')}${zone('camp.beforeRegistration')}${registrationSection()}${zone('camp.afterRegistration')}`;
  } else {
    metadata = content.seo.notFound;
    body = active.group('notFound.copy', [['notFound.eyebrow', '<span class="eyebrow">404</span>'], ['notFound.title', `<h1>${active.text('copy.notFound.title', true)}</h1>`], ['notFound.back', `<a class="button button-solid" href="/">${active.text('copy.actions.back')} ${arrow}</a>`]], 'not-found wrap', 'section');
  }
  if (pageKey) body += zone(`${pageKey}.beforeFooter`);
  const title = `${metadata.title} | ${content.site.name}`;
  const canonical = path === '/404.html' ? '' : `<link rel="canonical" href="${e(content.site.url + path)}">`;
  const theme = renderTheme(content);
  const themed = Boolean(content.design);
  const html = `<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(metadata.description)}">${content.site.draft || preview ? '<meta name="robots" content="noindex, nofollow">' : ''}<meta name="theme-color" content="#bfebac"><meta property="og:type" content="website"><meta property="og:locale" content="lt_LT"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(metadata.description)}">${canonical}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${e(assets.styles || '/styles.css')}">${theme ? `<link rel="stylesheet" href="${e(assets.theme || '/theme.css')}">` : ''}${preview ? '<link rel="stylesheet" href="/admin/visual.css">' : ''}<script src="${e(assets.script || '/app.js')}" defer></script></head><body class="responsive-site cms-page-${pageKey || 'not-found'}${themed ? ' cms-themed' : ''}"${preview ? ` data-cms-device="${selectedDevice}"` : ''}>${header()}<main id="turinys" tabindex="-1">${body}</main>${variant(footer)}</body></html>`;
  return {html, title};
}

export function renderLayoutRules(input) {
  const content = normalizeContent(input);
  const targets = new Map((editorial.getLayoutTargets?.(content) || []).map(target => [target.id, target]));
  const rules = [];
  const add = (selector, properties) => { if (Object.keys(properties).length) rules.push({selector, properties}); };
  for (const id of Object.keys(content.blockLayouts || {})) {
    const target = targets.get(id);
    if (!target || !/^[a-zA-Z0-9-]+$/.test(id)) continue;
    const dimensions = boundedLayout(content, id);
    const selector = `.cms-layout-${id}`;
    const properties = {};
    const photo = target.type === 'photo';
    if (dimensions.width != null) {
      if (photo) properties['--layout-image-width'] = `${dimensions.width}%`;
      else properties.width = `${dimensions.width}%`;
      Object.assign(properties, {'max-width':'100%', 'min-width':'0px', 'margin-left':'auto', 'margin-right':'auto'});
    }
    if (dimensions.height != null) {
      properties.height = photo ? `${dimensions.height}px` : 'auto';
      properties['min-height'] = photo ? '0px' : `${dimensions.height}px`;
      properties['max-height'] = 'none';
      if (photo) properties['aspect-ratio'] = 'auto';
    }
    for (const [key, property] of [['paddingTop','padding-top'], ['paddingBottom','padding-bottom']]) {
      const value = dimensions[key] ?? (dimensions.height != null ? 0 : null);
      if (value == null) continue;
      properties[property] = `${value}px`;
      if (photo) properties[`--layout-photo-${property}`] = `${value}px`;
    }
    if (Object.keys(properties).length) properties['box-sizing'] = 'border-box';
    add(selector, properties);
    if (photo && dimensions.width != null) {
      const fraction = dimensions.width / 100;
      const path = target.path.replaceAll('.', '-');
      add(`.responsive-layout.photo-layout-${path},.responsive-hero.photo-layout-${path}`, {
        '--manual-image-track':`${fraction}fr`, '--manual-copy-track':`${2 - fraction}fr`
      });
    }
    const clearTop = dimensions.height != null || dimensions.paddingTop != null;
    const clearBottom = dimensions.height != null || dimensions.paddingBottom != null;
    const innerPadding = {};
    if (clearTop) innerPadding['padding-top'] = '0px';
    if (clearBottom) innerPadding['padding-bottom'] = '0px';
    if (id === 'section-home-hero') add(`${selector}>.hero-content,${selector}>.hero-bottom`, innerPadding);
    if (id === 'section-home-camp') {
      if (clearTop) add(`${selector}>.section-heading`, {'padding-top':'0px'});
      add(`${selector}>.camp-row,${selector} .camp-copy`, innerPadding);
    }
  }
  // The two camp photos can share a side column. Use its widest frame to size
  // the column, then express each individual width relative to that column.
  const campFields = ['camps.0.image','camps.0.secondaryImage'];
  const manualCamp = campFields.some(path => boundedLayout(content, `photo-${path.replaceAll('.', '-')}`).width != null);
  if (manualCamp) {
    const columns = {left:[], right:[]};
    for (const path of campFields) {
      const image = getImageSettings(content, path);
      if (image.hidden) continue;
      const position = image.position === 'default' ? (path === 'camps.0.image' ? 'right' : 'below') : image.position;
      if (!columns[position]) continue;
      const dimensions = boundedLayout(content, `photo-${path.replaceAll('.', '-')}`);
      const width = dimensions.width ?? ({small:55,normal:75,large:100})[image.size] ?? 100;
      columns[position].push({path, width});
    }
    const properties = {};
    const both = columns.left.length && columns.right.length;
    for (const position of ['left','right']) {
      const column = columns[position];
      if (!column.length) continue;
      const width = Math.max(...column.map(item => item.width));
      properties[`--manual-camp-${position}-track`] = `${width / 100 * (both ? .8 : 1)}fr`;
      if (!both) properties['--manual-camp-copy-track'] = `${2 - width / 100}fr`;
      for (const image of column) add(`.cms-layout-photo-${image.path.replaceAll('.', '-')}`, {
        '--layout-camp-effective-width':`${image.width / width * 100}%`, '--layout-image-width':`${image.width}%`
      });
    }
    add('.cms-page-home .responsive-camp-middle', properties);
  }
  return rules;
}

export function renderTheme(input) {
  const content = normalizeContent(input);
  const defaults = editorial.THEME_DEFAULTS || {background:'#fafbf5', surface:'#ffffff', primary:'#006e40', text:'#173e2c', muted:'#53634e', accent:'#bfebac', buttonBackground:'#006e40', buttonText:'#ffffff', buttonRadius:32, fontFamily:'Montserrat'};
  const mapping = {background:'--cream', surface:'--paper', primary:'--green', text:'--ink', muted:'--muted', accent:'--sage', buttonBackground:'--button-background', buttonText:'--button-text'};
  const fonts = {Montserrat:'Montserrat,Arial,sans-serif', Arial:'Arial,sans-serif', Georgia:'Georgia,serif'};
  const theme = content.design;
  const declarations = [];
  if (theme) {
    for (const [key, variable] of Object.entries(mapping)) declarations.push(`${variable}:${safeColor(theme[key]) ? theme[key] : defaults[key]}`);
    const radius = typeof theme.buttonRadius === 'number' && Number.isFinite(theme.buttonRadius) && theme.buttonRadius >= 0 && theme.buttonRadius <= 32 ? theme.buttonRadius : defaults.buttonRadius;
    declarations.push(`--button-radius:${radius}px`, `--font:${fonts[theme.fontFamily] || fonts.Montserrat}`);
  }
  let css = declarations.length ? `:root{${declarations.join(';')}}` : '';
  for (const [page, blocks] of Object.entries(content.pageBlocks || {})) {
    if (!['home', 'about', 'contact', 'camp'].includes(page)) continue;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!blockId(block.id)) continue;
      const properties = ['background', 'color'].filter(key => safeColor(block[key])).map(key => `${key}:${block[key]}`);
      if (safeColor(block.color)) properties.push(`--block-color:${block.color}`);
      if (properties.length) css += `.cms-page-${page} .cms-block-${block.id}{${properties.join(';')}}`;
    }
  }
  for (const {selector, properties} of renderLayoutRules(content)) css += `${selector}{${Object.entries(properties).map(([key,value]) => `${key}:${value}!important`).join(';')}}`;
  return css;
}
