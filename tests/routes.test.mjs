import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../server/app.mjs';
import {CmsStore} from '../server/store.mjs';
import {DEFAULT_CONTENT, parseContent, normalizeContent, getImageReferences, ValidationError, safeLinkUrl, setPath} from '../shared/content.mjs';
import {renderPage, renderRobots, renderSitemap, renderTheme} from '../shared/render.mjs';
import {CAMP_SLUG, LEGACY_CAMP_SLUG, CAMP_PATH, LEGACY_CAMP_PATH, PAGE_PATHS, PAGE_ROUTES, SITEMAP_PATHS, ROUTE_REDIRECTS, canonicalPagePath, canonicalContentLink} from '../shared/routes.mjs';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const clone = value => structuredClone(value);
const identity = {email: 'admin@example.test'};
class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return {results: this.db.prepare(this.sql).all(...this.args)}; }
  execute() { const result = this.db.prepare(this.sql).run(...this.args); return {success: true, meta: {changes: Number(result.changes)}}; }
  async run() { return this.execute(); }
}
function harness() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(schema);
  const db = {
    prepare: sql => new Statement(sqlite, sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
  let assetRequests = 0;
  const env = {CMS_DB: db, ASSETS: {fetch: async () => {assetRequests++; return new Response('static fallback');}}};
  const handler = createHandler({initialContent: clone(DEFAULT_CONTENT), assets: {}, parseContent, getImageReferences, renderPage, renderRobots, renderSitemap, renderTheme});
  const request = (path, {method = 'GET', body, admin = false, origin = 'https://bukarciau.lt'} = {}) => handler(new Request(origin + path, {
    method,
    headers: body ? {'Content-Type': 'application/json', Origin: origin, 'X-CMS-Request': '1'} : {},
    ...(body ? {body: JSON.stringify(body)} : {})
  }), env, {}, admin ? {verifyAccess: async () => identity} : {});
  return {sqlite, db, env, handler, request, assetRequests: () => assetRequests, close: () => sqlite.close()};
}
const customBlock = url => ({id: 'a'.repeat(32), type: 'link', zone: 'home.afterHero', beforePart: null, text: 'Išsaugota nuoroda', url, source: null, alt: '', ratio: 'auto', size: 'normal', align: 'left', background: null, color: null});

test('one canonical camp route is shared by page, sitemap and alias contracts', () => {
  assert.equal(CAMP_PATH, '/stovyklos/moteru-savaitgalio-stovykla/');
  assert.equal(PAGE_ROUTES.camp, CAMP_PATH);
  assert.ok(PAGE_PATHS.includes(CAMP_PATH)); assert.ok(!PAGE_PATHS.includes(LEGACY_CAMP_PATH));
  assert.ok(SITEMAP_PATHS.includes(CAMP_PATH)); assert.ok(!SITEMAP_PATHS.includes('/404.html'));
  for (const path of PAGE_PATHS) assert.equal(canonicalPagePath(path), path);
  for (const [path, redirect] of Object.entries(ROUTE_REDIRECTS)) assert.equal(canonicalPagePath(path + '?source=fb#registracija'), redirect.path);
  for (const path of ['/admin/', '//attacker.test', '/unknown/', '/stovyklos/unknown/']) assert.equal(canonicalPagePath(path), null);
});

test('retired camp URLs redirect directly with 301 and retain query and fragment without database or assets', async () => {
  const h = harness();
  h.env.CMS_DB = {prepare() { throw Error('Redirects must not query content.'); }};
  try {
    for (const slug of [LEGACY_CAMP_SLUG, 'stovykla-02']) {
      for (const suffix of ['', '/', '/index.html']) {
        for (const method of ['GET', 'HEAD']) {
          const response = await h.request(`/stovyklos/${slug}${suffix}?utm_source=facebook&next=a%2Fb#registracija`, {method});
          assert.equal(response.status, 301);
          assert.equal(response.headers.get('Location'), `https://bukarciau.lt${CAMP_PATH}?utm_source=facebook&next=a%2Fb#registracija`);
          assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
          assert.equal(await response.text(), '');
        }
      }
    }
    for (const alias of [CAMP_PATH.slice(0, -1), CAMP_PATH + 'index.html']) {
      const response = await h.request(alias + '?from=menu');
      assert.equal(response.status, 308); assert.equal(response.headers.get('Location'), `https://bukarciau.lt${CAMP_PATH}?from=menu`);
    }
    assert.equal(h.assetRequests(), 0);
    assert.equal((await h.request(LEGACY_CAMP_PATH, {method: 'POST'})).status, 405);
  } finally { h.close(); }
});

test('only retired same-origin camp destinations migrate and preserve their query and hash', () => {
  for (const path of [LEGACY_CAMP_PATH, LEGACY_CAMP_PATH.slice(0, -1), LEGACY_CAMP_PATH + 'index.html', '/stovyklos/stovykla-02/']) {
    assert.equal(canonicalContentLink(path + '?from=fb#registracija'), CAMP_PATH + '?from=fb#registracija');
    assert.equal(canonicalContentLink('https://bukarciau.lt' + path + '?from=fb#registracija'), 'https://bukarciau.lt' + CAMP_PATH + '?from=fb#registracija');
    assert.equal(safeLinkUrl(path + '#registracija'), CAMP_PATH + '#registracija');
  }
  for (const value of ['https://external.test' + LEGACY_CAMP_PATH + '?x=1#registracija', 'http://bukarciau.lt' + LEGACY_CAMP_PATH, '//bukarciau.lt' + LEGACY_CAMP_PATH, '/apie-mus', '#stovykla', 'mailto:info@bukarciau.lt', 'tel:+37060571562']) assert.equal(canonicalContentLink(value), value);
});

test('saved slug and own camp links normalize without changing text, images or original input', () => {
  const legacy = clone(DEFAULT_CONTENT);
  legacy.camps[0].slug = LEGACY_CAMP_SLUG;
  legacy.site.heroAccent = 'Moterų įrašyta antraštė';
  legacy.site.heroImage = `/media/${'b'.repeat(32)}.jpg`; legacy.site.heroImageAlt = 'Moterų įkelta nuotrauka';
  legacy.linkOverrides = {'home.camp.link': LEGACY_CAMP_PATH + '?source=fb#registracija', 'about.cta': 'https://outside.test' + LEGACY_CAMP_PATH};
  legacy.pageBlocks.home = [customBlock('https://bukarciau.lt' + LEGACY_CAMP_PATH + '#registracija')];
  const original = clone(legacy), clean = parseContent(legacy);
  const expected = clone(legacy);
  expected.camps[0].slug = CAMP_SLUG;
  expected.linkOverrides['home.camp.link'] = CAMP_PATH + '?source=fb#registracija';
  expected.pageBlocks.home[0].url = 'https://bukarciau.lt' + CAMP_PATH + '#registracija';
  assert.deepEqual(clean, expected); assert.deepEqual(legacy, original);
  assert.deepEqual(getImageReferences(clean), getImageReferences(original));
  assert.deepEqual(normalizeContent(clean), clean);
  for (const slug of ['other-camp', '../admin', 'stovykla-02', 'constructor']) {
    const invalid = clone(DEFAULT_CONTENT); invalid.camps[0].slug = slug;
    assert.throws(() => parseContent(invalid), error => error instanceof ValidationError && error.issues.some(issue => issue.path === 'camps.0.slug'));
  }
  assert.throws(() => setPath(clean, 'camps.0.slug', LEGACY_CAMP_SLUG), TypeError);
  const unsafe = clone(DEFAULT_CONTENT); unsafe.linkOverrides['home.camp.link'] = LEGACY_CAMP_PATH + '?x=%0a';
  assert.throws(() => parseContent(unsafe), ValidationError, 'Route migration must not sanitize unsafe URLs into accepted input.');
});

test('legacy published data and admin history render through the new canonical route without writes on read', async () => {
  const h = harness();
  try {
    const legacy = clone(DEFAULT_CONTENT); legacy.camps[0].slug = LEGACY_CAMP_SLUG; legacy.site.heroAccent = 'Esamas moterų tekstas';
    legacy.linkOverrides['home.camp.link'] = LEGACY_CAMP_PATH + '#registracija';
    await new CmsStore(h.db, legacy).state();
    const before = h.sqlite.prepare('SELECT draft_json, published_json, revision, published_revision FROM cms_state').get();
    const response = await h.request(CAMP_PATH);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`rel="canonical" href="https://bukarciau.lt${CAMP_PATH}"`));
    const stateResponse = await h.request('/admin/api/state', {admin: true});
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(state.content.camps[0].slug, CAMP_SLUG);
    assert.equal(state.content.linkOverrides['home.camp.link'], CAMP_PATH + '#registracija');
    assert.deepEqual(h.sqlite.prepare('SELECT draft_json, published_json, revision, published_revision FROM cms_state').get(), before);
    for (const path of [CAMP_PATH, LEGACY_CAMP_PATH, LEGACY_CAMP_PATH + 'index.html']) {
      const preview = await h.request('/admin/preview?path=' + encodeURIComponent(path), {admin: true});
      assert.equal(preview.status, 200); assert.match(preview.headers.get('Cache-Control'), /private.*no-store/);
      assert.ok((await preview.text()).includes(`href="https://bukarciau.lt${CAMP_PATH}"`));
    }
    state.content.site.heroAccent = 'Privatus juodraštis';
    let save = await h.request('/admin/api/draft', {method: 'POST', admin: true, body: {content: state.content, revision: state.revision}});
    assert.equal(save.status, 200);
    const saved = await save.json();
    const restore = await h.request('/admin/api/restore', {method: 'POST', admin: true, body: {versionId: '0'.repeat(32), revision: saved.revision}});
    assert.equal(restore.status, 200);
    const restored = await restore.json();
    assert.equal(restored.content.camps[0].slug, CAMP_SLUG);
    assert.equal(restored.content.site.heroAccent, 'Esamas moterų tekstas');
    assert.equal(h.sqlite.prepare('SELECT published_json FROM cms_state').get().published_json, before.published_json, 'Restoring history updates a draft only.');
  } finally { h.close(); }
});

test('static redirect and admin selector destinations match the shared canonical route', async () => {
  const redirects = await readFile(new URL('../_redirects', import.meta.url), 'utf8');
  const entries = redirects.trim().split('\n').map(line => line.trim().split(/\s+/));
  for (const [path, redirect] of Object.entries(ROUTE_REDIRECTS).filter(([, item]) => item.status === 301)) assert.ok(entries.some(entry => entry[0] === path && entry[1] === redirect.path && entry[2] === '301'));
  const admin = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.ok(admin.includes(`value="${CAMP_PATH}"`)); assert.ok(!admin.includes(`value="${LEGACY_CAMP_PATH}"`));
});
