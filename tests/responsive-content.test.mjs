import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONTENT, CONTENT_FIELDS, CONTENT_PARTS, IMAGE_FIELDS, IMAGE_POSITIONS, IMAGE_ASPECT_RATIOS, IMAGE_SIZES,
  THEME_DEFAULTS, DESIGN_FIELDS, FONT_FAMILIES, CONTENT_ZONES, BLOCK_TYPES,
  LAYOUT_DIMENSION_DEFAULTS, LAYOUT_FIELDS, SECTION_LAYOUT_TARGETS, getLayoutTargets, getLayoutTarget,
  LINK_PARTS, safeLinkUrl,
  ValidationError, parseContent, normalizeContent, getDeviceContent, getImageSettings, getImageReferences, getPath, setPath
} from '../shared/content.mjs';

const clone = value => structuredClone(value);
const source = `/media/${'a'.repeat(32)}.jpg`;
const block = (values = {}) => ({id: 'c'.repeat(32), type: 'text', zone: 'home.afterHero', beforePart: null, text: 'Papildomas tekstas', url: null, source: null, alt: '', ratio: 'auto', size: 'normal', align: 'left', background: null, color: null, ...values});
const issueAt = (content, path) => assert.throws(() => parseContent(content), error => error instanceof ValidationError && error.issues.some(issue => issue.path === path), path);
const removePath = (object, path) => {
  const parts = path.split('.');
  delete parts.slice(0, -1).reduce((value, key) => value[key], object)[parts.at(-1)];
};

test('legacy content gains neutral shared editing defaults without changing editorial values', () => {
  const legacy = clone(DEFAULT_CONTENT);
  for (const key of ['design', 'pageBlocks', 'hiddenParts', 'partOrder', 'blockLayouts', 'linkOverrides']) delete legacy[key];
  for (const slot of IMAGE_FIELDS) { removePath(legacy, slot.positionPath); removePath(legacy, slot.sizePath); }
  const parsed = parseContent(legacy);
  assert.equal(parsed.design, null);
  assert.deepEqual(parsed.pageBlocks, {home: [], about: [], contact: [], camp: []});
  assert.deepEqual(parsed.hiddenParts, []); assert.deepEqual(parsed.partOrder, []);
  assert.deepEqual(parsed.blockLayouts, {});
  assert.deepEqual(parsed.linkOverrides, {});
  for (const slot of IMAGE_FIELDS) { assert.equal(getPath(parsed, slot.positionPath), 'default'); assert.equal(getPath(parsed, slot.sizePath), 'auto'); }
  for (const field of CONTENT_FIELDS) assert.deepEqual(getPath(parsed, field.path), getPath(legacy, field.path));
});

test('photos and editorial values have one shared state at every preview width', () => {
  const content = clone(DEFAULT_CONTENT);
  content.site.heroAccent = 'Bendra antraštė visiems ekranams';
  for (const slot of IMAGE_FIELDS) {
    assert.equal(slot.mobilePath, undefined);
    setPath(content, slot.path, source); setPath(content, slot.altPath, 'Bendra nuotrauka');
    setPath(content, slot.positionPath, 'right'); setPath(content, slot.ratioPath, '3:2');
    const desktop = getImageSettings(content, slot, 'desktop'), mobile = getImageSettings(content, slot, 'mobile');
    assert.deepEqual(mobile, desktop);
    assert.deepEqual(desktop, {source, alt: 'Bendra nuotrauka', ratio: '3:2', hidden: false, position: 'right', size: 'auto'});
    mobile.alt = 'Nesaugota kopija'; assert.equal(getPath(content, slot.altPath), 'Bendra nuotrauka');
  }
  assert.deepEqual(getDeviceContent(content, 'desktop'), getDeviceContent(content, 'mobile'));
  const detached = getDeviceContent(content, 'mobile'); detached.site.heroAccent = 'Kopija';
  assert.equal(content.site.heroAccent, 'Bendra antraštė visiems ekranams');
  assert.throws(() => getImageSettings(content, 'site.unknown'), TypeError);
});

test('all six fixed photo frames validate shared size presets independently, even while empty or hidden', () => {
  assert.equal(new Set(IMAGE_FIELDS.map(slot => slot.sizePath)).size, 6);
  assert.deepEqual(IMAGE_SIZES.map(option => option.value), ['auto', 'small', 'normal', 'large']);
  for (const slot of IMAGE_FIELDS) {
    for (const size of IMAGE_SIZES.map(option => option.value)) {
      const content = clone(DEFAULT_CONTENT); setPath(content, slot.sizePath, size);
      const parsed = parseContent(content);
      assert.equal(getImageSettings(parsed, slot).size, size);
      assert.equal(getImageSettings(parsed, slot, 'mobile').size, size);
      for (const other of IMAGE_FIELDS) if (other.path !== slot.path) assert.equal(getImageSettings(parsed, other).size, 'auto');
    }
    for (const bad of [null, '', 'wide', 'small;display:none', 'SMALL', 0, true, {}, []]) {
      const content = clone(DEFAULT_CONTENT); setPath(content, slot.hiddenPath, true); setPath(content, slot.sizePath, bad);
      issueAt(content, slot.sizePath);
    }
  }
});

test('all six photo positions and ratios use bounded enums', () => {
  for (const slot of IMAGE_FIELDS) {
    for (const position of IMAGE_POSITIONS.map(option => option.value)) {
      const content = clone(DEFAULT_CONTENT); setPath(content, slot.positionPath, position);
      assert.equal(getImageSettings(parseContent(content), slot).position, position);
    }
    for (const ratio of IMAGE_ASPECT_RATIOS.map(option => option.value)) {
      const content = clone(DEFAULT_CONTENT); setPath(content, slot.ratioPath, ratio);
      assert.equal(getImageSettings(parseContent(content), slot).ratio, ratio);
    }
    for (const bad of ['center', 'left;display:none', null, {}, 1]) {
      const content = clone(DEFAULT_CONTENT); setPath(content, slot.positionPath, bad); issueAt(content, slot.positionPath);
    }
  }
});

test('all shared lists and paragraphs can be emptied while present entries still require text', () => {
  const descriptors = CONTENT_FIELDS.filter(field => ['list', 'paragraphs'].includes(field.type));
  for (const descriptor of descriptors) {
    const content = clone(DEFAULT_CONTENT); setPath(content, descriptor.path, []);
    assert.deepEqual(getPath(parseContent(content), descriptor.path), []);
    setPath(content, descriptor.path, ['']); issueAt(content, `${descriptor.path}.0`);
  }
});

test('abandoned independent profiles are rejected rather than creating divergent content', () => {
  for (const key of ['deviceContent', 'hiddenPartsDesktop', 'hiddenPartsMobile', 'partOrderDesktop', 'partOrderMobile']) {
    const content = clone(DEFAULT_CONTENT); content[key] = {}; issueAt(content, key);
  }
  for (const slot of IMAGE_FIELDS) {
    const content = clone(DEFAULT_CONTENT), path = `${slot.path}Mobile`, parts = path.split('.');
    parts.slice(0, -1).reduce((value, key) => value[key], content)[parts.at(-1)] = {source: null};
    issueAt(content, path);
  }
  const theme = clone(DEFAULT_CONTENT); theme.design = {desktop: THEME_DEFAULTS, mobile: THEME_DEFAULTS}; issueAt(theme, 'design.desktop');
  const blocks = clone(DEFAULT_CONTENT); blocks.pageBlocks.desktop = {home: []}; issueAt(blocks, 'pageBlocks.desktop');
});

test('visible shared images and detail fallbacks require alternative text while hidden sources remain restorable', () => {
  const content = clone(DEFAULT_CONTENT);
  content.site.statementImage = source; content.site.statementImageAlt = '';
  issueAt(content, 'site.statementImageAlt');
  content.site.statementImageHidden = true;
  assert.equal(parseContent(content).site.statementImageAlt, '');
  content.camps[0].image = source; content.camps[0].imageHidden = true; content.camps[0].imageAlt = '';
  issueAt(content, 'camps.0.imageAlt');
  content.camps[0].detailImageHidden = true;
  assert.equal(parseContent(content).camps[0].imageAlt, '');
  assert.ok(getImageReferences(content).some(item => item.src === source));
});

test('semantic visibility and order have finite unique allowlisted IDs', () => {
  assert.equal(new Set(CONTENT_PARTS.map(part => part.id)).size, CONTENT_PARTS.length);
  for (const part of CONTENT_PARTS) assert.ok(part.label && part.group && Array.isArray(part.paths));
  const content = clone(DEFAULT_CONTENT);
  content.hiddenParts = CONTENT_PARTS.map(part => part.id); content.partOrder = ['home.hero.title', 'home.hero.eyebrow'];
  assert.deepEqual(parseContent(content).hiddenParts, content.hiddenParts);
  assert.deepEqual(parseContent(content).partOrder, content.partOrder);
  for (const key of ['hiddenParts', 'partOrder']) {
    for (const bad of [null, 'home.hero.title', ['unknown'], ['home.hero.title', 'home.hero.title'], [1], ['__proto__']]) {
      const content = clone(DEFAULT_CONTENT); content[key] = bad;
      assert.throws(() => parseContent(content), error => error instanceof ValidationError && error.issues.some(issue => issue.path.startsWith(key)));
    }
  }
});

test('shared theme snapshots are complete and bounded without accepting arbitrary CSS', () => {
  assert.deepEqual(DESIGN_FIELDS.map(field => field.key).sort(), Object.keys(THEME_DEFAULTS).sort());
  for (const font of FONT_FAMILIES) {
    const content = clone(DEFAULT_CONTENT); content.design = {...THEME_DEFAULTS, fontFamily: font.value, background: '#1234Ab', buttonRadius: 0};
    assert.deepEqual(parseContent(content).design, content.design);
  }
  for (const field of DESIGN_FIELDS) {
    const content = clone(DEFAULT_CONTENT); content.design = {...THEME_DEFAULTS}; delete content.design[field.key]; issueAt(content, `design.${field.key}`);
  }
  for (const [key, value] of [['background', 'red'], ['background', '#fff'], ['background', '#123456;display:none'], ['background', 'url(https://attacker.test)'], ['primary', null], ['fontFamily', 'url(evil)'], ['buttonRadius', '12'], ['buttonRadius', -1], ['buttonRadius', 33], ['buttonRadius', NaN], ['buttonRadius', Infinity]]) {
    const content = clone(DEFAULT_CONTENT); content.design = {...THEME_DEFAULTS, [key]: value}; issueAt(content, `design.${key}`);
  }
  const unknown = clone(DEFAULT_CONTENT); unknown.design = {...THEME_DEFAULTS, css: 'body{display:none}'}; issueAt(unknown, 'design.css');
  const prototype = clone(DEFAULT_CONTENT); prototype.design = Object.assign(Object.create({css: 'bad'}), THEME_DEFAULTS); issueAt(prototype, 'design');
});

test('custom blocks use typed page-specific zones and retain image references', () => {
  assert.equal(new Set(CONTENT_ZONES.map(zone => zone.id)).size, CONTENT_ZONES.length);
  for (const zone of CONTENT_ZONES) {
    const content = clone(DEFAULT_CONTENT);
    for (const [index, type] of BLOCK_TYPES.entries()) content.pageBlocks[zone.page].push(block({id: String(index + 1).padStart(32, '0'), type: type.value, zone: zone.id, text: '', url: null}));
    assert.equal(parseContent(content).pageBlocks[zone.page].length, BLOCK_TYPES.length);
  }
  const content = clone(DEFAULT_CONTENT);
  content.pageBlocks.home = [block({type: 'image', source, alt: 'Papildoma nuotrauka', ratio: '2:3', size: 'small'})];
  assert.ok(getImageReferences(parseContent(content)).some(item => item.src === source));
  setPath(content, 'pageBlocks.home', []); assert.deepEqual(parseContent(content).pageBlocks.home, []);
  assert.deepEqual(normalizeContent({}).pageBlocks, {home: [], about: [], contact: [], camp: []});
});

test('custom blocks reject missing or unknown keys, unsafe URLs, malformed values and wrong page zones', () => {
  for (const key of Object.keys(block())) {
    if (key === 'beforePart') continue;
    const content = clone(DEFAULT_CONTENT), missing = block(); delete missing[key]; content.pageBlocks.home = [missing]; issueAt(content, `pageBlocks.home.0.${key}`);
  }
  for (const [key, value] of [['id', '../secret'], ['id', 'D'.repeat(32)], ['type', 'html'], ['zone', 'contact.beforeContent'], ['text', 'a'.repeat(5001)], ['url', 'javascript:alert(1)'], ['url', 'https://user:pass@example.test'], ['url', 'http://insecure.test'], ['url', ''], ['source', '/assets/logo.svg'], ['source', 'https://attacker.test/a.jpg'], ['ratio', '100/1'], ['size', 'huge'], ['align', 'fixed'], ['background', 'url(evil)'], ['color', 'red']]) {
    const content = clone(DEFAULT_CONTENT); content.pageBlocks.home = [block({[key]: value})]; issueAt(content, `pageBlocks.home.0.${key}`);
  }
  for (const key of ['html', 'javascript', 'style', '__proto__']) {
    const content = clone(DEFAULT_CONTENT); content.pageBlocks.home = [Object.fromEntries([...Object.entries(block()), [key, 'bad']])]; issueAt(content, `pageBlocks.home.0.${key}`);
  }
  const prototype = clone(DEFAULT_CONTENT); prototype.pageBlocks.home = [Object.assign(Object.create({style: 'bad'}), block())]; issueAt(prototype, 'pageBlocks.home.0');
  const image = clone(DEFAULT_CONTENT); image.pageBlocks.home = [block({type: 'image', source, alt: ''})]; issueAt(image, 'pageBlocks.home.0.alt');
});

test('custom block lists and IDs stay bounded, with uniqueness enforced within each page', () => {
  const content = clone(DEFAULT_CONTENT);
  content.pageBlocks.home = [block(), block()]; issueAt(content, 'pageBlocks.home.1.id');
  content.pageBlocks.home = Array.from({length: 41}, (_, index) => block({id: String(index + 1).padStart(32, '0')})); issueAt(content, 'pageBlocks.home');
  content.pageBlocks.home.pop(); assert.equal(parseContent(content).pageBlocks.home.length, 40);
  content.pageBlocks.about = [block({zone: 'about.beforeStory'})]; assert.equal(parseContent(content).pageBlocks.about.length, 1);
});

test('layout targets have stable allowlisted IDs and page-aware metadata for real sections, photos, parts and added blocks', () => {
  const content = clone(DEFAULT_CONTENT);
  content.pageBlocks.home = [block()];
  const targets = getLayoutTargets(content);
  assert.equal(new Set(targets.map(target => target.id)).size, targets.length);
  assert.equal(SECTION_LAYOUT_TARGETS.length, 15);
  assert.equal(getLayoutTarget(content, 'photo-site-heroImage').path, 'site.heroImage');
  assert.equal(getLayoutTarget(content, 'part-home-hero-title').partId, 'home.hero.title');
  assert.equal(getLayoutTarget(content, `block-${block().id}`).blockId, block().id);
  assert.equal(getLayoutTarget(content, 'section-footer').page, 'shared');
  for (const target of targets) { assert.equal(target.kind, target.type); assert.ok(target.label && target.page); }
  const homeTargets = getLayoutTargets(content, 'home').map(target => target.id);
  assert.ok(homeTargets.includes('section-home-hero')); assert.ok(homeTargets.includes('section-footer'));
  assert.ok(homeTargets.includes('part-common-nav-camp')); assert.ok(homeTargets.includes('part-registration-title'));
  assert.ok(!homeTargets.includes('photo-site-togetherImage')); assert.ok(!homeTargets.includes('section-about-story'));
  assert.ok(!getLayoutTargets(content, 'about').some(target => target.id === 'part-registration-title'));
  assert.equal(getLayoutTarget(content, 'unknown'), null); assert.equal(getLayoutTarget(content, null), null);
});

test('shared layout dimensions accept only full bounded integer snapshots on existing targets', () => {
  const content = clone(DEFAULT_CONTENT);
  content.pageBlocks.home = [block()];
  content.blockLayouts = {
    'section-home-hero': {width: 100, height: 2000, paddingTop: 0, paddingBottom: 240},
    'photo-site-heroImage': {width: 20, height: 40, paddingTop: null, paddingBottom: null},
    'part-home-hero-title': {...LAYOUT_DIMENSION_DEFAULTS},
    [`block-${block().id}`]: {width: 50, height: null, paddingTop: 20, paddingBottom: 30}
  };
  const parsed = parseContent(content);
  assert.deepEqual(parsed.blockLayouts, content.blockLayouts);
  assert.deepEqual(getDeviceContent(parsed, 'desktop').blockLayouts, getDeviceContent(parsed, 'mobile').blockLayouts);
  setPath(parsed, 'blockLayouts', {}); assert.deepEqual(parseContent(parsed).blockLayouts, {});
  for (const field of LAYOUT_FIELDS) {
    const missing = clone(content); delete missing.blockLayouts['section-home-hero'][field.key];
    issueAt(missing, `blockLayouts.section-home-hero.${field.key}`);
    for (const value of [field.min - 1, field.max + 1, field.min + .5, String(field.min), false, NaN, Infinity, {}, []]) {
      const invalid = clone(content); invalid.blockLayouts['section-home-hero'][field.key] = value;
      issueAt(invalid, `blockLayouts.section-home-hero.${field.key}`);
    }
  }
});

test('layout maps reject unknown or orphaned targets, executable styling keys and prototype objects', () => {
  for (const id of ['body', 'section-home-hero style', 'photo-site-unknown', `block-${'d'.repeat(32)}`, '__proto__']) {
    const content = clone(DEFAULT_CONTENT); content.blockLayouts = Object.fromEntries([[id, {...LAYOUT_DIMENSION_DEFAULTS}]]); issueAt(content, `blockLayouts.${id}`);
  }
  const unknown = clone(DEFAULT_CONTENT); unknown.blockLayouts['section-footer'] = {...LAYOUT_DIMENSION_DEFAULTS, style: 'position:fixed'};
  issueAt(unknown, 'blockLayouts.section-footer.style');
  const prototype = clone(DEFAULT_CONTENT); prototype.blockLayouts['section-footer'] = Object.assign(Object.create({style: 'bad'}), LAYOUT_DIMENSION_DEFAULTS); issueAt(prototype, 'blockLayouts.section-footer');
  const invalidMap = clone(DEFAULT_CONTENT); invalidMap.blockLayouts = []; issueAt(invalidMap, 'blockLayouts');
  const removed = clone(DEFAULT_CONTENT); removed.pageBlocks.home = [block()]; removed.blockLayouts[`block-${block().id}`] = {...LAYOUT_DIMENSION_DEFAULTS};
  parseContent(removed); removed.pageBlocks.home = []; issueAt(removed, `blockLayouts.block-${block().id}`);
  delete removed.blockLayouts[`block-${block().id}`]; assert.deepEqual(parseContent(removed).blockLayouts, {});
});

test('layout record count is bounded even when every target is valid', () => {
  const content = clone(DEFAULT_CONTENT);
  let index = 1;
  for (const page of ['home', 'about', 'contact', 'camp']) {
    const zone = CONTENT_ZONES.find(zone => zone.page === page).id;
    content.pageBlocks[page] = Array.from({length: 40}, () => block({id: (index++).toString(16).padStart(32, '0'), zone}));
  }
  const targets = getLayoutTargets(content);
  content.blockLayouts = Object.fromEntries(targets.slice(0, 401).map(target => [target.id, {...LAYOUT_DIMENSION_DEFAULTS}]));
  issueAt(content, 'blockLayouts');
  delete content.blockLayouts[targets[400].id]; assert.equal(Object.keys(parseContent(content).blockLayouts).length, 400);
});

test('safe links support external, local, anchor, email and telephone destinations with stable normalization', () => {
  const values = [
    'https://example.com', ' https://example.com/path?q=viena%20diena#toliau ',
    'https://example.com:8443/path', '/apie-mus/', '/kontaktai/?x=1#susisiekime', '/#stovykla', '#stovykla', '#susipažinkime',
    'mailto:info@bukarciau.lt', 'mailto:info@bukarciau.lt?subject=Stovyklos%20klausimas', 'tel:+37060571562'
  ];
  for (const value of values) {
    const result = safeLinkUrl(value);
    assert.equal(typeof result, 'string', value);
    assert.equal(safeLinkUrl(result), result, value);
    const content = clone(DEFAULT_CONTENT); content.pageBlocks.home = [block({type: 'link', url: value})];
    assert.equal(typeof parseContent(content).pageBlocks.home[0].url, 'string');
  }
  assert.equal(safeLinkUrl('https://example.com'), 'https://example.com/');
  assert.equal(safeLinkUrl('/apie-mus/'), '/apie-mus/');
});

test('unsafe URL schemes, credentials, HTML, backslashes and encoded controls cannot bypass safe link validation', () => {
  const values = [
    '', ' ', 'http://example.com', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test',
    'https%3A%2F%2Fexample.com', '//evil.test', '/\\evil.test', '/%5cevil.test', '/%255cevil.test', '/%2f%2fevil.test', '/%252f%252fevil.test',
    '/.%2f%2f%2fevil.test', '\nhttps://example.com', 'https://example.com/\tfoo', 'https://example.com/%0afoo', 'https://example.com/%250d%250afoo',
    'https://user:password@example.com', 'https://good.example@evil.example', 'https://example.com/<script>', 'https://example.com/%253Cscript%253E',
    'https://example.com/"onclick=', "https://example.com/'onclick=", 'https://example.com/\\path', 'https://example.com/%5cpath',
    'mailto:bad-email', 'mailto:a..b@example.com', 'mailto:info@bukarciau.lt?cc=other@example.com',
    'mailto:info@bukarciau.lt?subject=Labas&bcc=other@example.com', 'mailto:info@bukarciau.lt?subject=a&subject=b',
    'mailto:info@bukarciau.lt?subject=Labas%0d%0aBcc:other@example.com', 'mailto:info@bukarciau.lt#extra',
    'tel:37060571562', 'tel:+0', 'tel:+37060571562?extra=1', '#', '#bad anchor', '#foo%0abar'
  ];
  for (const value of values) {
    assert.equal(safeLinkUrl(value), null, value);
    if (!value.trim()) continue;
    const content = clone(DEFAULT_CONTENT); content.pageBlocks.home = [block({type: 'button', url: value})];
    issueAt(content, 'pageBlocks.home.0.url');
  }
  for (const value of [null, {}, [], 1, false, 'https://example.com/' + 'a'.repeat(2000)]) assert.equal(safeLinkUrl(value), null);
});

test('existing link overrides accept only the finite link allowlist and string values, with empty values restoring defaults', () => {
  const partIds = new Set(CONTENT_PARTS.map(part => part.id));
  assert.equal(LINK_PARTS.length, 21);
  assert.equal(new Set(LINK_PARTS.map(part => part.id)).size, LINK_PARTS.length);
  for (const part of LINK_PARTS) {
    assert.ok(partIds.has(part.id) && part.label);
    const content = clone(DEFAULT_CONTENT); content.linkOverrides[part.id] = '/kontaktai/';
    assert.equal(parseContent(content).linkOverrides[part.id], '/kontaktai/');
    content.linkOverrides[part.id] = ''; assert.equal(parseContent(content).linkOverrides[part.id], '');
    for (const invalid of [null, {}, [], true, 123, 'javascript:alert(1)', '/%252f%252fevil.test', '\n']) {
      content.linkOverrides[part.id] = invalid; issueAt(content, `linkOverrides.${part.id}`);
    }
  }
  for (const id of ['home.hero.title', 'unknown', '__proto__', 'constructor', 'prototype']) {
    const content = clone(DEFAULT_CONTENT); content.linkOverrides = Object.fromEntries([[id, '/']]); issueAt(content, `linkOverrides.${id}`);
  }
  for (const map of [null, [], false, 'https://example.com', Object.assign(Object.create({inherited: '/'}), {'home.hero.cta': '/'})]) {
    const content = clone(DEFAULT_CONTENT); content.linkOverrides = map; issueAt(content, 'linkOverrides');
  }
  const content = clone(DEFAULT_CONTENT); setPath(content, 'linkOverrides', {'home.hero.cta': 'mailto:info@bukarciau.lt?subject=Klausimas'});
  assert.equal(parseContent(content).linkOverrides['home.hero.cta'], 'mailto:info@bukarciau.lt?subject=Klausimas');
});

test('inside zones expose bounded registered semantic anchors and preserve old boundary locations', () => {
  const parts = new Set(CONTENT_PARTS.map(part => part.id));
  const inside = CONTENT_ZONES.filter(zone => zone.inside);
  assert.equal(inside.length, 18);
  assert.equal(CONTENT_ZONES.filter(zone => !zone.inside).length, 21);
  for (const zone of inside) {
    assert.ok(zone.sortZone && zone.partIds.length);
    assert.equal(new Set(zone.partIds).size, zone.partIds.length);
    for (const id of zone.partIds) assert.ok(parts.has(id), `${zone.id}: ${id}`);
    for (const beforePart of [null, zone.partIds[0], zone.partIds.at(-1)]) {
      const content = clone(DEFAULT_CONTENT); content.pageBlocks[zone.page] = [block({zone: zone.id, beforePart})];
      assert.equal(parseContent(content).pageBlocks[zone.page][0].beforePart, beforePart);
    }
  }
  assert.ok(CONTENT_ZONES.find(zone => zone.id === 'camp.program').partIds.includes('detail.program.39'));
  assert.ok(CONTENT_ZONES.find(zone => zone.id === 'camp.faq').partIds.includes('detail.faq.39'));
});

test('block insertion normalizes only legacy beforePart and rejects cross-zone anchors', () => {
  const content = clone(DEFAULT_CONTENT), legacy = block(); delete legacy.beforePart;
  content.pageBlocks.home = [legacy];
  const normalized = parseContent(content).pageBlocks.home[0];
  assert.equal(normalized.beforePart, null);
  const {beforePart, ...rest} = normalized; assert.deepEqual(rest, legacy);
  for (const [zone, anchor] of [['home.afterHero', 'home.hero.title'], ['home.hero', 'about.title'], ['home.heroBottom', 'home.hero.cta'], ['home.introHeading', 'home.intro.paragraph.0']]) {
    const invalid = clone(DEFAULT_CONTENT); invalid.pageBlocks.home = [block({zone, beforePart: anchor})]; issueAt(invalid, 'pageBlocks.home.0.beforePart');
  }
  for (const beforePart of ['', 1, {}, [], 'unknown', 'constructor']) {
    const invalid = clone(DEFAULT_CONTENT); invalid.pageBlocks.home = [block({zone: 'home.hero', beforePart})]; issueAt(invalid, 'pageBlocks.home.0.beforePart');
  }
  delete legacy.url; content.pageBlocks.home = [legacy]; issueAt(content, 'pageBlocks.home.0.url');
});

test('retired hero-arrow settings migrate safely from published content and history without losing unrelated edits', () => {
  const retired = 'home.hero.next';
  const legacy = clone(DEFAULT_CONTENT);
  legacy.site.heroAccent = 'Išsaugota antraštė';
  legacy.hiddenParts = [retired, 'home.intro.title'];
  legacy.partOrder = ['home.hero.title', retired, 'home.hero.eyebrow'];
  legacy.linkOverrides = {[retired]: '/apie-mus/', 'home.hero.cta': 'mailto:info@bukarciau.lt?subject=Stovykla'};
  legacy.blockLayouts = {
    'part-home-hero-next': {width: 80, height: 100, paddingTop: 10, paddingBottom: 20},
    'part-home-hero-title': {width: 70, height: null, paddingTop: null, paddingBottom: 0}
  };
  legacy.pageBlocks.home = [
    block({zone: 'home.heroBottom', beforePart: retired, text: 'Išsaugotas papildomas tekstas'}),
    block({id: 'd'.repeat(32), zone: 'home.heroBottom', beforePart: 'home.hero.values', text: 'Tekstas prieš vertybes'})
  ];
  const original = clone(legacy);
  const normalized = parseContent(legacy);
  assert.deepEqual(legacy, original, 'Migration must not mutate the loaded snapshot.');
  assert.equal(normalized.site.heroAccent, 'Išsaugota antraštė');
  assert.deepEqual(normalized.hiddenParts, ['home.intro.title']);
  assert.deepEqual(normalized.partOrder, ['home.hero.title', 'home.hero.eyebrow']);
  assert.deepEqual(normalized.linkOverrides, {'home.hero.cta': 'mailto:info@bukarciau.lt?subject=Stovykla'});
  assert.deepEqual(normalized.blockLayouts, {'part-home-hero-title': legacy.blockLayouts['part-home-hero-title']});
  assert.deepEqual(normalized.pageBlocks.home, [{...legacy.pageBlocks.home[0], beforePart: null}, legacy.pageBlocks.home[1]]);
  assert.deepEqual(parseContent(normalized), normalized, 'Migration is idempotent for reads and restored history.');
  assert.ok(!CONTENT_PARTS.some(part => part.id === retired));
  assert.ok(!LINK_PARTS.some(part => part.id === retired));
  assert.ok(!CONTENT_ZONES.find(zone => zone.id === 'home.heroBottom').partIds.includes(retired));
  assert.equal(getLayoutTarget(normalized, 'part-home-hero-next'), null);
});

test('retired-arrow compatibility does not accept unrelated unknown IDs, wrong-zone anchors or unsafe remaining values', () => {
  const content = clone(DEFAULT_CONTENT);
  content.linkOverrides = {'home.hero.next': '/', 'home.hero.next2': '/'}; issueAt(content, 'linkOverrides.home.hero.next2');
  content.linkOverrides = {'home.hero.next': '/', 'home.hero.cta': 'javascript:alert(1)'}; issueAt(content, 'linkOverrides.home.hero.cta');
  content.linkOverrides = {'home.hero.next': '/'};
  content.hiddenParts = ['home.hero.next', 'unknown']; issueAt(content, 'hiddenParts.0');
  content.hiddenParts = [];
  content.blockLayouts = {'part-home-hero-next2': {...LAYOUT_DIMENSION_DEFAULTS}}; issueAt(content, 'blockLayouts.part-home-hero-next2');
  content.blockLayouts = {};
  content.pageBlocks.home = [block({zone: 'home.hero', beforePart: 'home.hero.next'})]; issueAt(content, 'pageBlocks.home.0.beforePart');
  content.pageBlocks.home = [];
  content.linkOverrides = Object.fromEntries([['home.hero.next', '/'], ['__proto__', '/']]); issueAt(content, 'linkOverrides.__proto__');
});
