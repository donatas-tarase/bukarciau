import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONTENT_FIELDS, IMAGE_FIELDS, parseContent, normalizeContent, getPath, setPath, getImageReferences, ValidationError} from '../shared/content.mjs';
import {renderPage, renderRobots, renderSitemap} from '../shared/render.mjs';

const original = parseContent(JSON.parse(await readFile(new URL('../content.json', import.meta.url), 'utf8')));
const routes = ['/', '/apie-mus/', '/kontaktai/', '/stovyklos/stovykla-01/', '/404.html'];
const copy = () => structuredClone(original);
const publicHtml = content => routes.map(route => renderPage(content, route).html).join('\n');
const image = '/media/0123456789abcdef0123456789abcdef.jpg';

test('initial editor content preserves the reviewed static public pages', () => {
  // These baselines were compared with the previous static build on all five routes.
  // Ignore only the automatic copyright year; CSS is deliberately outside this contract.
  const expected = [
    '97d7f90a83aba18a94e5d367f37a4becf4421d443e19f394a12d51fe3c1f6562',
    'e156d0452ed92d9ead699f9d641b225f95a5d43adaf805b0ebfc377aeccd1488',
    'bfbab07c1a64b016aefb31000317fed91a1ce5527369942c18a198d1b5dc5e55',
    'fb7f708a839a08ffbd03e18139cc7b8d10c77a0f7466e4545f098e11f7e8e070',
    'b7275f75ceeb5620e16519f7d63de0d1570209954fc4acd4b47d3a76e438b103'
  ];
  for (const [index, route] of routes.entries()) {
    const {html} = renderPage(original, route);
    assert.equal(createHash('sha256').update(html.replace(/© \d{4}/g, '© YEAR')).digest('hex'), expected[index], route);
    assert.doesNotMatch(html, /<(?:video|audio)\b|Vieta nuotraukai|Čia bus/);
  }
});

function contentVariants() {
  const pending = copy();
  const open = copy(); open.camps[0].registrationUrl = 'https://forms.gle/veikianti-anketa';
  const detailed = copy();
  Object.assign(detailed.camps[0], {location: 'Vilnius', program: [{title: 'Penktadienis', text: 'Susitikimas'}], included: ['Nakvynė'], notIncluded: ['Kelionė']});
  const priced = copy(); priced.camps[0].price = '250 EUR';
  return [pending, open, detailed, priced];
}
function sampleValue(field, index) {
  const marker = `RedaguotasLaukas${index}`;
  if (field.type === 'boolean') return !getPath(original, field.path);
  if (field.type === 'email') return `redaguotas${index}@example.lt`;
  if (field.type === 'tel') return '+37060' + String(index).padStart(6, '0');
  if (field.type === 'url') return `https://example.lt/redaguotas-${index}`;
  if (['list', 'paragraphs'].includes(field.type)) return [marker];
  if (field.type === 'repeater') return [Object.fromEntries(field.fields.map(child => [child.path, marker + child.path]))];
  return marker;
}
test('every dashboard field changes actual public content in the relevant publication state', async t => {
  for (const [index, field] of CONTENT_FIELDS.entries()) {
    await t.test(field.path, () => {
      const value = sampleValue(field, index);
      const before = [], after = [];
      for (const content of contentVariants()) {
        before.push(publicHtml(content));
        setPath(content, field.path, value);
        after.push(publicHtml(parseContent(content)));
      }
      assert.notDeepEqual(after, before, 'The editor must not offer a field that is ignored by public rendering.');
      if (field.type !== 'boolean') {
        const marker = typeof value === 'string' ? value : field.type === 'repeater' ? value[0][field.fields[0].path] : value[0];
        assert.ok(after.some(html => html.includes(marker)), 'The edited value must reach the public page.');
      }
    });
  }
});

test('legacy content receives editable defaults without changing its existing copy', () => {
  const legacy = {site: {heroAccent: 'Senas pavadinimas'}, camps: [{title: 'Sena stovykla', faq: [{question: 'Kaip?', answer: 'Ruošiame', kind: 'registration'}]}]};
  const normalized = parseContent(legacy);
  assert.equal(normalized.site.heroAccent, legacy.site.heroAccent);
  assert.equal(normalized.camps[0].title, legacy.camps[0].title);
  assert.equal(normalized.camps[0].faq[0].answer, 'Ruošiame');
  assert.ok(normalized.camps[0].faq[0].answerWhenOpen);
  assert.equal(normalized.camps[0].faq[0].kind, undefined);
  assert.equal(normalized.copy.header.camp, original.copy.header.camp);
  assert.deepEqual(parseContent(normalizeContent({})), original);
});

test('schema rejects unknown keys, executable/layout settings and prototype injection', () => {
  const cases = [
    {...copy(), layout: 'other'},
    {...copy(), css: 'body{display:none}'},
    {...copy(), script: 'alert(1)'},
    {...copy(), site: {...copy().site, colors: {green: 'red'}}},
    {...copy(), copy: {...copy().copy, home: {...copy().copy.home, html: '<script>bad</script>'}}},
    JSON.parse('{"__proto__":{"polluted":true}}'),
    JSON.parse('{"copy":{"home":{"constructor":{"prototype":{"polluted":true}}}}}'),
    {...copy(), camps: [{...copy().camps[0], program: [{title: 'Laikas', text: 'Veikla', layout: 'row'}]}]}
  ];
  const customPrototype = copy(); customPrototype.copy.home = Object.assign(Object.create({secret: true}), customPrototype.copy.home); cases.push(customPrototype);
  for (const content of cases) assert.throws(() => parseContent(content), error => error instanceof ValidationError && error.issues.every(issue => typeof issue.path === 'string' && typeof issue.message === 'string'));
  assert.equal({}.polluted, undefined);
  for (const path of ['__proto__.polluted', 'site.constructor.prototype', 'copy.home.html', 'site.url', 'camps.0.slug', 'camps.1.title']) assert.throws(() => setPath(copy(), path, 'bad'));
});

test('one camp, the canonical origin and public route structure remain fixed', () => {
  for (const mutate of [content => content.camps.push(structuredClone(content.camps[0])), content => content.camps = [], content => content.camps[0].slug = '../admin', content => content.site.url = 'https://attacker.example']) {
    const content = copy(); mutate(content); assert.throws(() => parseContent(content), ValidationError);
  }
  for (const path of ['/admin/', '/stovyklos/stovykla-02/', '/unknown/', '//example.com', '/../admin']) assert.equal(renderPage(original, path), null);
  assert.equal(renderPage(original, '/index.html').html, renderPage(original, '/').html);
  assert.equal(renderPage(original, '/kontaktai/index.html').html, renderPage(original, '/kontaktai/').html);
});

test('unsafe URLs and incorrect contact data are rejected before publishing', () => {
  for (const path of ['site.facebook', 'camps.0.registrationUrl']) {
    for (const value of ['http://example.lt/form', 'javascript:alert(1)', 'data:text/html,bad', '//example.lt/form', 'https://user:password@example.lt/form', 'not a url']) {
      const content = copy(); setPath(content, path, value); assert.throws(() => parseContent(content), ValidationError, `${path}: ${value}`);
    }
  }
  for (const [path, value] of [['site.email', 'broken'], ['site.phone', '+370 600 00000'], ['copy.home.introTitle', 'Tekstas\u2014tekstas']]) {
    const content = copy(); setPath(content, path, value); assert.throws(() => parseContent(content), ValidationError);
  }
  const content = copy(); content.camps[0].registrationUrl = ''; content.camps[0].location = ''; content.camps[0].price = '';
  const normalized = parseContent(content);
  assert.equal(normalized.camps[0].registrationUrl, null);
  assert.equal(normalized.camps[0].location, null);
  assert.equal(normalized.camps[0].price, null);
});

test('all photo slots stay blank until supplied and require safe media references and descriptions', () => {
  assert.deepEqual(getImageReferences(original), []);
  assert.doesNotMatch(publicHtml(original), /src="\/media\//);
  for (const slot of IMAGE_FIELDS) {
    const content = copy(); setPath(content, slot.path, image);
    assert.throws(() => parseContent(content), ValidationError, `${slot.path} requires alternative text`);
    setPath(content, slot.altPath, 'Įkeltos nuotraukos aprašymas');
    const valid = parseContent(content);
    assert.ok(publicHtml(valid).includes(`src="${image}"`), slot.path);
    assert.ok(publicHtml(valid).includes('alt="Įkeltos nuotraukos aprašymas"'), slot.path);
    for (const bad of ['https://example.lt/photo.jpg', '/media/../photo.jpg', '/media/0123456789abcdef0123456789abcdef.svg', '/assets/photo.jpg', image + '?x=1', image.replace('.jpg', '.gif')]) {
      setPath(content, slot.path, bad); assert.throws(() => parseContent(content), ValidationError, bad);
    }
  }
  const duplicate = copy();
  for (const slot of IMAGE_FIELDS) { setPath(duplicate, slot.path, image); setPath(duplicate, slot.altPath, 'Nuotrauka'); }
  assert.deepEqual(getImageReferences(parseContent(duplicate)), [{id: image.split('/').at(-1), src: image}]);
});

test('draft preview uses authenticated image URLs and never changes public indexing settings', () => {
  const content = copy(); content.site.draft = false; content.site.heroImage = image; content.site.heroImageAlt = 'Bendra nuotrauka';
  const live = renderPage(content, '/');
  const preview = renderPage(content, '/', {preview: true});
  assert.ok(live.html.includes(`src="${image}"`));
  assert.doesNotMatch(live.html, /name="robots"/);
  assert.ok(preview.html.includes('src="/admin/api/media/0123456789abcdef0123456789abcdef.jpg"'));
  assert.match(preview.html, /name="robots" content="noindex, nofollow"/);
  assert.equal(content.site.draft, false);
  assert.match(renderRobots(content), /Allow: \/\nSitemap: https:\/\/bukarciau\.lt\/sitemap\.xml/);
  assert.match(renderSitemap(content), /<loc>https:\/\/bukarciau\.lt\/stovyklos\/stovykla-01\/<\/loc>/);
  content.site.draft = true;
  assert.ok(renderPage(content, '/').html.includes(content.site.heroAccent), 'SEO draft does not make the public site private.');
  assert.match(renderRobots(content), /Disallow: \//);
  assert.equal(renderSitemap(content), null);
  for (const field of ['draft', 'published', 'publishedContent', 'admin']) assert.throws(() => parseContent({...content, [field]: {secret: true}}), ValidationError);
});

test('registration automatically switches actual actions and editable FAQ answers', () => {
  const content = copy();
  const pending = renderPage(content, '/').html;
  assert.match(pending, /data-registration-status="pending"/);
  assert.doesNotMatch(pending, /data-registration-link/);
  content.site.email = 'admin@example.lt';
  content.camps[0].registrationUrl = 'https://forms.gle/veikianti-anketa';
  content.camps[0].faq = [{question: 'Registracija?', answer: 'Dar uždaryta', answerWhenOpen: 'Jau galima registruotis'}];
  for (const route of ['/', '/stovyklos/stovykla-01/']) {
    const html = renderPage(content, route).html;
    assert.match(html, /data-registration-status="open"/);
    assert.ok(html.includes('href="https://forms.gle/veikianti-anketa" data-registration-link target="_blank" rel="noopener noreferrer"'));
  }
  assert.ok(renderPage(content, '/stovyklos/stovykla-01/').html.includes('Jau galima registruotis'));
  content.camps[0].registrationUrl = null;
  assert.ok(renderPage(content, '/stovyklos/stovykla-01/').html.includes('Dar uždaryta'));
  assert.ok(renderPage(content, '/').html.includes('href="mailto:admin@example.lt?subject='));
});

test('editorial input is rendered as escaped text rather than executable markup', () => {
  const content = copy();
  const attack = '<img src=x onerror="alert(1)"> & <script>alert(1)</script>';
  content.copy.home.introTitle = attack;
  content.site.aboutText = [attack];
  content.camps[0].program = [{title: attack, text: attack}];
  content.camps[0].faq = [{question: attack, answer: attack, answerWhenOpen: ''}];
  content.site.heroImage = image; content.site.heroImageAlt = attack;
  const html = publicHtml(parseContent(content));
  assert.doesNotMatch(html, /<img src=x|<script>alert\(1\)<\/script>/);
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('alt="&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
});

const decodeText = value => value.replace(/<br>/g, '\n').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const annotatedFields = html => [...html.matchAll(/<span data-cms-field="([^"]+)" data-cms-type="([^"]+)" tabindex="0" aria-label="([^"]+)">([\s\S]*?)<\/span>/g)].map(match => ({path: match[1], type: match[2], label: decodeText(match[3]), text: decodeText(match[4])}));

test('visual editing markers are available only in the authenticated preview', () => {
  for (const route of routes) {
    const live = renderPage(original, route).html;
    const preview = renderPage(original, route, {preview: true}).html;
    assert.doesNotMatch(live, /data-cms-(?:field|type|image|label)|\/admin\/visual\.css/);
    assert.match(preview, /<link rel="stylesheet" href="\/admin\/visual\.css">/);
    assert.ok(annotatedFields(preview).length > 0, route);
    for (const field of annotatedFields(preview)) {
      assert.ok(['text', 'textarea'].includes(field.type));
      assert.match(field.label, /^Redaguoti: /);
      assert.equal(field.text, getPath(original, field.path), field.path);
      assert.match(field.path, /^[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*$/);
    }
  }
});

test('visible editorial values map to their real content paths in every display state', () => {
  const collected = new Set();
  for (const content of contentVariants()) {
    for (const route of routes) {
      const {html} = renderPage(content, route, {preview: true});
      for (const field of annotatedFields(html)) {
        assert.equal(field.text, getPath(content, field.path), `${route}: ${field.path}`);
        collected.add(field.path);
      }
    }
  }
  const attributesOrMetadata = new Set(['site.phone', 'site.facebook', 'site.draft', 'camps.0.registrationUrl', 'copy.contact.logoAlt', 'copy.registration.emailSubject']);
  for (const field of CONTENT_FIELDS) {
    if (field.path.startsWith('seo.') || attributesOrMetadata.has(field.path)) continue;
    if (field.type === 'repeater') {
      for (const child of field.fields) assert.ok([...collected].some(path => path.startsWith(field.path + '.') && path.endsWith('.' + child.path)), `${field.path}.${child.path}`);
    } else if (['list', 'paragraphs'].includes(field.type)) assert.ok(collected.has(`${field.path}.0`), field.path);
    else assert.ok(collected.has(field.path), field.path);
  }
  assert.ok(collected.has('camps.0.faq.2.answerWhenOpen'));
  assert.ok(collected.has('camps.0.program.0.text'));
});

test('all six photo containers can be selected while empty and after an upload', () => {
  const emptyPreview = routes.map(route => renderPage(original, route, {preview: true}).html).join('\n');
  for (const slot of IMAGE_FIELDS) {
    const marker = `data-cms-image="${slot.path}" data-cms-label="${slot.label}" tabindex="0" aria-label="Keisti nuotrauką: ${slot.label}"`;
    assert.ok(emptyPreview.includes(marker), slot.path);
    const content = copy(); setPath(content, slot.path, image); setPath(content, slot.altPath, 'Nuotrauka');
    const uploadedPreview = routes.map(route => renderPage(content, route, {preview: true}).html).join('\n');
    assert.ok(uploadedPreview.includes(marker), slot.path);
    assert.ok(uploadedPreview.includes('src="/admin/api/media/0123456789abcdef0123456789abcdef.jpg"'), slot.path);
  }
});

test('visual markers cannot be forged through editable text and attribute values stay escaped', () => {
  const content = copy();
  const attack = '"><span data-cms-field="site.hacked" onclick="alert(1)"> & <script>alert(1)</script>';
  content.site.heroAccent = attack;
  content.site.aboutText = [attack];
  const {html} = renderPage(parseContent(content), '/', {preview: true});
  assert.doesNotMatch(html, /data-cms-field="site\.hacked"|<script>alert\(1\)<\/script>/);
  const fields = annotatedFields(html);
  assert.equal(fields.find(field => field.path === 'site.heroAccent').text, attack);
  assert.equal(fields.find(field => field.path === 'site.aboutText.0').text, attack);
  assert.ok(fields.filter(field => ['site.heroAccent', 'site.aboutText.0'].includes(field.path)).every(field => !field.label.includes('onclick')));
});

test('visual editing safely updates existing list and paragraph entries without admitting arbitrary paths', () => {
  const content = copy();
  content.camps[0].included = ['Nakvynė'];
  for (const path of ['site.values.1', 'site.aboutText.0', 'site.story.2', 'camps.0.description.1', 'camps.0.included.0']) {
    setPath(content, path, 'Pakeistas įrašas');
    assert.equal(getPath(content, path), 'Pakeistas įrašas');
  }
  const parsed = parseContent(content);
  assert.ok(publicHtml(parsed).includes('Pakeistas įrašas'));
  for (const path of ['site.values.3', 'site.values.01', 'site.values.-1', 'site.values.1.extra', 'site.values.length', 'site.aboutText.999', 'site.aboutText.0.__proto__', 'camps.0.included.1', 'camps.0.notIncluded.0', 'camps.0.title.0']) assert.throws(() => setPath(content, path, 'Neleistinas'), path);
  assert.equal(content.site.values.length, 3);
  assert.equal(content.site.values[1], 'Pakeistas įrašas');
});
