import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONTENT, CONTENT_FIELDS, CONTENT_PARTS, IMAGE_FIELDS, IMAGE_POSITIONS, IMAGE_ASPECT_RATIOS,
  THEME_DEFAULTS, DESIGN_FIELDS, FONT_FAMILIES, CONTENT_ZONES, BLOCK_TYPES,
  ValidationError, parseContent, normalizeContent, getDeviceContent, getImageSettings, getImageReferences, getPath, setPath
} from '../shared/content.mjs';

const clone = value => structuredClone(value);
const source = `/media/${'a'.repeat(32)}.jpg`;
const block = (values = {}) => ({id: 'c'.repeat(32), type: 'text', zone: 'home.afterHero', text: 'Papildomas tekstas', url: null, source: null, alt: '', ratio: 'auto', size: 'normal', align: 'left', background: null, color: null, ...values});
const issueAt = (content, path) => assert.throws(() => parseContent(content), error => error instanceof ValidationError && error.issues.some(issue => issue.path === path), path);
const removePath = (object, path) => {
  const parts = path.split('.');
  delete parts.slice(0, -1).reduce((value, key) => value[key], object)[parts.at(-1)];
};

test('legacy content gains neutral shared editing defaults without changing editorial values', () => {
  const legacy = clone(DEFAULT_CONTENT);
  for (const key of ['design', 'pageBlocks', 'hiddenParts', 'partOrder']) delete legacy[key];
  for (const slot of IMAGE_FIELDS) removePath(legacy, slot.positionPath);
  const parsed = parseContent(legacy);
  assert.equal(parsed.design, null);
  assert.deepEqual(parsed.pageBlocks, {home: [], about: [], contact: [], camp: []});
  assert.deepEqual(parsed.hiddenParts, []); assert.deepEqual(parsed.partOrder, []);
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(parsed, slot.positionPath), 'default');
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
    assert.deepEqual(desktop, {source, alt: 'Bendra nuotrauka', ratio: '3:2', hidden: false, position: 'right'});
    mobile.alt = 'Nesaugota kopija'; assert.equal(getPath(content, slot.altPath), 'Bendra nuotrauka');
  }
  assert.deepEqual(getDeviceContent(content, 'desktop'), getDeviceContent(content, 'mobile'));
  const detached = getDeviceContent(content, 'mobile'); detached.site.heroAccent = 'Kopija';
  assert.equal(content.site.heroAccent, 'Bendra antraštė visiems ekranams');
  assert.throws(() => getImageSettings(content, 'site.unknown'), TypeError);
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
