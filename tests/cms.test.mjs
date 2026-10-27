import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createHandler } from '../server/app.mjs';
import { createAccessVerifier } from '../server/auth.mjs';
import { CmsStore } from '../server/store.mjs';
import { inspectImage, readBodyLimited } from '../server/media.mjs';
import { DEFAULT_CONTENT, IMAGE_FIELDS, IMAGE_ASPECT_RATIOS, getPath, setPath, parseContent, getImageReferences, getImageSettings, getDeviceContent, THEME_DEFAULTS } from '../shared/content.mjs';
import { renderPage, renderRobots, renderSitemap } from '../shared/render.mjs';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const clone = object => structuredClone(object);
const identity = { email: 'admin@example.test' };
const allow = async () => identity;

class Statement {
  constructor(db, sql, bindings = []) { this.db = db; this.sql = sql; this.bindings = bindings; }
  bind(...bindings) { return new Statement(this.db, this.sql, bindings); }
  execute() {
    const result = this.db.prepare(this.sql).run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
  async first() { return this.db.prepare(this.sql).get(...this.bindings) || null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.bindings) }; }
  async run() { return this.execute(); }
}
class D1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(schema); }
  prepare(sql) { return new Statement(this.sqlite, sql); }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
class R2 {
  objects = new Map();
  async put(id, bytes) { this.objects.set(id, new Uint8Array(bytes)); }
  async get(id) {
    const bytes = this.objects.get(id);
    return bytes ? { body: new Blob([bytes]).stream(), httpEtag: `"${id}"` } : null;
  }
  async delete(id) { this.objects.delete(id); }
}

function harness() {
  const db = new D1();
  const media = new R2();
  let staticRequests = 0;
  const env = {
    CMS_DB: db, CMS_MEDIA: media,
    ACCESS_TEAM_DOMAIN: 'cms-tests.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64), ADMIN_EMAILS: identity.email,
    ASSETS: { fetch: async () => { staticRequests++; return new Response('static output'); } },
  };
  const handler = createHandler({ initialContent: clone(DEFAULT_CONTENT), assets: { styles: '/styles.css?v=test', script: '/app.js?v=test' }, parseContent, getImageReferences, renderPage, renderRobots, renderSitemap });
  const request = async (path, { method = 'GET', body, headers = {}, auth = true, origin = 'https://bukarciau.lt' } = {}) => {
    const actualHeaders = new Headers(headers);
    if (body && !(body instanceof FormData)) { actualHeaders.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
    if (!['GET', 'HEAD'].includes(method)) { if (!actualHeaders.has('Origin')) actualHeaders.set('Origin', origin); actualHeaders.set('X-CMS-Request', '1'); }
    return handler(new Request(`${origin}${path}`, { method, headers: actualHeaders, body }), env, {}, auth ? { verifyAccess: allow } : {});
  };
  return { db, media, env, request, handler, staticRequests: () => staticRequests };
}
const state = async h => (await h.request('/admin/api/state')).json();
const png = () => new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V8AAAAASUVORK5CYII=', 'base64'));
const upload = async h => {
  const form = new FormData();
  form.set('file', new File([png()], 'moteru-stovykla.png', { type: 'image/png' }));
  const response = await h.request('/admin/api/media', { method: 'POST', body: form });
  assert.equal(response.status, 201);
  return (await response.json()).item;
};

test('All admin entry points and static assets reject anonymous requests on custom and Pages origins', async () => {
  const h = harness();
  for (const origin of ['https://bukarciau.lt', 'https://bukarciau.pages.dev', 'https://preview.bukarciau.pages.dev']) {
    for (const path of ['/admin', '/admin/', '/admin/app.js', '/admin/api/state', '/admin/preview?path=/']) {
      const response = await h.request(path, { auth: false, origin });
      assert.equal(response.status, origin === 'https://bukarciau.lt' ? 401 : 403, `${origin}${path}`);
      assert.match(response.headers.get('Cache-Control'), /no-store/);
    }
  }
  assert.equal(h.staticRequests(), 0);
  for (const path of ['/%61dmin/index.html', '/admin%2fadmin.js', '/%2561dmin/index.html', '//admin/index.html', '/admin//index.html', '/admin%5cadmin.js']) {
    const response = await h.request(path, { auth: false });
    assert.equal(response.status, 400, path);
  }
  assert.equal(h.staticRequests(), 0, 'ambiguous paths never reach the asset router');
  delete h.env.ACCESS_AUD;
  assert.equal((await h.request('/admin/', { auth: false })).status, 503);
});

test('A valid signed administrator token cannot reach private assets on alternate origins or bypass the origin with headers or environment', async () => {
  const h = harness();
  const keys = await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'origin-test' };
  const verifyAccess = createAccessVerifier({ jwks: createLocalJWKSet({ keys: [jwk] }) });
  const token = await new SignJWT({ email: identity.email }).setProtectedHeader({ alg: 'RS256', kid: 'origin-test' }).setIssuer(`https://${h.env.ACCESS_TEAM_DOMAIN}`).setAudience(h.env.ACCESS_AUD).setSubject('origin-test-user').setIssuedAt().setExpirationTime('6h').sign(keys.privateKey);
  for (const origin of ['https://bukarciau.pages.dev', 'https://preview.bukarciau.pages.dev', 'http://bukarciau.lt', 'https://www.bukarciau.lt']) {
    h.env.ADMIN_ORIGIN = origin;
    h.env.SITE_URL = origin;
    for (const path of ['/admin/', '/admin/admin.js', '/admin/api/state', '/admin/preview?path=/', '/admin/logout']) {
      const response = await h.handler(new Request(`${origin}${path}`, { headers: {
        'Cf-Access-Jwt-Assertion': token,
        Host: 'bukarciau.lt',
        Origin: 'https://bukarciau.lt',
        'X-Forwarded-Host': 'bukarciau.lt',
        'X-Admin-Origin': origin,
      } }), h.env, {}, { verifyAccess });
      assert.equal(response.status, 403, `${origin}${path}`);
      assert.equal(response.headers.has('Set-Cookie'), false);
    }
  }
  assert.equal(h.staticRequests(), 0, 'alternate origins cannot reach private static assets');
  const accepted = await h.handler(new Request('https://bukarciau.lt/admin/admin.js', { headers: { 'Cf-Access-Jwt-Assertion': token } }), h.env, {}, { verifyAccess });
  assert.equal(accepted.status, 200, 'canonical origin still performs the normal JWT check');
  assert.equal(h.staticRequests(), 1);
  const publicPreview = await h.handler(new Request('https://preview.bukarciau.pages.dev/'), h.env, {});
  assert.equal(publicPreview.status, 200, 'public deployment previews remain available without authentication');
  assert.match(await publicPreview.text(), /Moterų savaitgalis/);
});

test('Only an explicit validated loopback preview option can change the admin origin', async () => {
  const h = harness();
  const localRequest = new Request('http://localhost:4324/admin/admin.js');
  assert.equal((await h.handler(localRequest, h.env, {}, { verifyAccess: allow })).status, 403);
  assert.equal(h.staticRequests(), 0);
  assert.equal((await h.handler(localRequest, h.env, {}, { verifyAccess: allow, adminOrigin: 'http://localhost:4324' })).status, 200);
  assert.equal((await h.handler(new Request('http://127.0.0.1:4324/admin/admin.js'), h.env, {}, { verifyAccess: allow, adminOrigin: 'http://127.0.0.1:4324' })).status, 200);
  for (const adminOrigin of ['https://attacker.test', 'http://localhost.attacker.test:4324', 'http://127.0.0.1:4324@attacker.test', 'http://0.0.0.0:4324', 'http://localhost:4324/admin', 'http://localhost:4325']) {
    assert.equal((await h.handler(localRequest, h.env, {}, { verifyAccess: allow, adminOrigin })).status, 503);
  }
});

test('Draft, preview, publish, stale writes and restore keep public content isolated', async () => {
  const h = harness();
  let current = await state(h);
  assert.equal(current.revision, 1);
  assert.equal(current.publishedRevision, 1);
  const original = current.content.site.heroAccent;
  const edited = clone(current.content);
  edited.site.heroAccent = 'Susitikime gruodį.';
  let response = await h.request('/admin/api/draft', { method: 'POST', body: { content: edited, revision: 1 } });
  assert.equal(response.status, 200);
  current = await response.json();
  assert.equal(current.revision, 2);
  assert.equal(current.publishedRevision, 1);
  assert.equal(current.identity.email, identity.email);
  assert.doesNotMatch(await (await h.request('/')).text(), /Susitikime gruodį\./);
  response = await h.request('/admin/preview?path=/');
  assert.match(await response.text(), /Susitikime gruodį\./);
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'self'/);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: 1 } })).status, 409);
  assert.equal((await h.request('/admin/api/draft', { method: 'POST', body: { revision: 1, content: edited } })).status, 409);
  response = await h.request('/admin/api/publish', { method: 'POST', body: { revision: 2 } });
  assert.equal(response.status, 200);
  assert.match(await (await h.request('/')).text(), /Susitikime gruodį\./);
  const history = await (await h.request('/admin/api/history')).json();
  assert.equal(history.versions.length, 2);
  assert.equal(history.versions[0].author, identity.email);
  const initialVersion = history.versions.find(version => version.revision === 1);
  response = await h.request('/admin/api/restore', { method: 'POST', body: { versionId: initialVersion.id, revision: 2 } });
  current = await response.json();
  assert.equal(current.revision, 3);
  assert.equal(current.publishedRevision, 2);
  assert.equal(current.content.site.heroAccent, original);
  assert.match(await (await h.request('/')).text(), /Susitikime gruodį\./);
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: 3 } })).status, 200);
  assert.doesNotMatch(await (await h.request('/')).text(), /Susitikime gruodį\./);
});

test('Server-side schema rejects layout keys, extra camps and unsafe links', async () => {
  const h = harness();
  for (const alter of [content => { content.styles = 'body{display:none}'; }, content => content.camps.push(clone(content.camps[0])), content => { content.site.facebook = 'javascript:alert(1)'; }, content => { content.camps[0].registrationUrl = 'http://example.test/insecure'; }]) {
    const content = clone(DEFAULT_CONTENT);
    alter(content);
    const response = await h.request('/admin/api/draft', { method: 'POST', body: { content, revision: 1 } });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, 'CONTENT_INVALID');
    assert.ok(body.error.issues.length);
  }
  assert.equal((await state(h)).revision, 1);
});

test('Concurrent edits use an atomic revision precondition and preserve the winning draft', async () => {
  const h = harness();
  const current = await state(h);
  const first = clone(current.content), second = clone(current.content);
  first.site.heroAccent = 'Pirmas pakeitimas';
  second.site.heroAccent = 'Antras pakeitimas';
  const responses = await Promise.all([first, second].map(content => h.request('/admin/api/draft', { method: 'POST', body: { content, revision: current.revision } })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const latest = await state(h);
  assert.equal(latest.revision, 2);
  assert.equal(latest.publishedRevision, 1);
  assert.ok(['Pirmas pakeitimas', 'Antras pakeitimas'].includes(latest.content.site.heroAccent));
});

test('Canonical aliases and custom 404 copy use the published CMS version', async () => {
  const h = harness();
  let current = await state(h);
  current.content.copy.notFound.title = 'Ieškomo puslapio nėra.';
  current = await (await h.request('/admin/api/draft', { method: 'POST', body: { content: current.content, revision: current.revision } })).json();
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: current.revision } })).status, 200);
  for (const [alias, canonical] of [['/index.html', '/'], ['/kontaktai/index.html', '/kontaktai/'], ['/apie-mus', '/apie-mus/']]) {
    const response = await h.request(`${alias}?from=test`);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), `https://bukarciau.lt${canonical}?from=test`);
  }
  h.env.ASSETS.fetch = async () => new Response('static 404', { status: 404 });
  const response = await h.request('/nerastas-puslapis');
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Ieškomo puslapio nėra\./);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
});

test('CSRF checks apply to every administrative mutation and no CORS permission is emitted', async () => {
  const h = harness();
  for (const [path, method] of [['draft', 'POST'], ['publish', 'POST'], ['restore', 'POST'], ['media', 'POST'], [`media/${'a'.repeat(32)}.jpg`, 'DELETE']]) {
    const response = await h.request(`/admin/api/${path}`, { method, headers: { Origin: 'https://attacker.test' }, body: method === 'POST' ? {} : undefined });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'CSRF_REJECTED');
    assert.equal(response.headers.has('Access-Control-Allow-Origin'), false);
  }
});

test('Logout clears path-scoped and legacy cookies before the fixed global logout without database access', async () => {
  const h = harness();
  delete h.env.CMS_DB;
  delete h.env.CMS_MEDIA;
  for (const method of ['GET', 'HEAD']) {
    const response = await h.request('/admin/logout?returnTo=https://attacker.test', { method });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), 'https://cms-tests.cloudflareaccess.com/cdn-cgi/access/logout');
    assert.equal(await response.text(), '');
    assert.match(response.headers.get('Cache-Control'), /private, no-store/);
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 12, 'every cookie and scope has its own Set-Cookie header');
    for (const name of ['CF_Authorization', 'CF_Binding']) {
      for (const path of ['/admin', '/admin/', '/']) {
        for (const domain of ['', '; Domain=bukarciau.lt']) {
          assert.ok(cookies.includes(`${name}=; Path=${path}${domain}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax`));
        }
      }
    }
    assert.equal(h.staticRequests(), 0);
  }
});

test('Logout remains authenticated, rejects unsupported methods and fails closed on invalid team configuration', async () => {
  const h = harness();
  let response = await h.request('/admin/logout', { auth: false });
  assert.equal(response.status, 401);
  assert.equal(response.headers.has('Set-Cookie'), false);
  assert.equal(response.headers.has('Location'), false);
  response = await h.request('/admin/logout', { method: 'POST', body: {} });
  assert.equal(response.status, 405);
  assert.equal(response.headers.has('Set-Cookie'), false);
  h.env.ACCESS_TEAM_DOMAIN = 'attacker.test';
  response = await h.request('/admin/logout');
  assert.equal(response.status, 503);
  assert.equal(response.headers.has('Location'), false);
  assert.equal(response.headers.has('Set-Cookie'), false);
  assert.equal(h.staticRequests(), 0);
});

test('Media stays private until published; referenced photos cannot be deleted; restore only creates a draft', async () => {
  const h = harness();
  const item = await upload(h);
  assert.match(item.id, /^[a-f0-9]{32}\.png$/);
  assert.equal(item.type, 'image/png');
  assert.equal(item.width, 1);
  assert.equal((await h.request(item.url)).status, 404);
  assert.equal((await h.request(item.previewUrl)).status, 200);
  assert.equal((await (await h.request('/admin/api/media')).json()).items.length, 1);
  let current = await state(h);
  current.content.site.heroImage = item.url;
  current.content.site.heroImageAlt = 'Moterų stovykla';
  let response = await h.request('/admin/api/draft', { method: 'POST', body: { content: current.content, revision: current.revision } });
  assert.equal(response.status, 200);
  current = await response.json();
  assert.equal((await h.request(item.url)).status, 404);
  assert.match(await (await h.request('/admin/preview?path=/')).text(), new RegExp(item.previewUrl));
  assert.equal((await h.request(`/admin/api/media/${item.id}`, { method: 'DELETE' })).status, 409);
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: current.revision } })).status, 200);
  response = await h.request(item.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal((await h.request(item.url, { headers: { 'If-None-Match': response.headers.get('ETag') } })).status, 304);
  const photoVersion = (await (await h.request('/admin/api/history')).json()).versions[0];
  current = await state(h);
  current.content.site.heroImage = null;
  current.content.site.heroImageAlt = '';
  current = await (await h.request('/admin/api/draft', { method: 'POST', body: { content: current.content, revision: current.revision } })).json();
  assert.equal((await h.request(`/admin/api/media/${item.id}`, { method: 'DELETE' })).status, 409);
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: current.revision } })).status, 200);
  assert.equal((await h.request(`/admin/api/media/${item.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await h.request(item.url)).status, 404);
  assert.equal((await h.request(item.previewUrl)).status, 404);
  assert.equal((await (await h.request('/admin/api/media')).json()).items.length, 0);
  assert.ok(h.media.objects.has(item.id), 'soft deletion preserves rollback objects');
  current = await state(h);
  response = await h.request('/admin/api/restore', { method: 'POST', body: { versionId: photoVersion.id, revision: current.revision } });
  assert.equal(response.status, 200);
  assert.equal((await h.request(item.url)).status, 404);
  assert.equal((await h.request(item.previewUrl)).status, 200);
});

test('Photo ratios persist independently through draft, publish and history restore, including legacy versions', async () => {
  const h = harness();
  let current = await state(h);
  const legacy = clone(current.content);
  for (const slot of IMAGE_FIELDS) {
    const parts = slot.ratioPath.split('.');
    delete getPath(legacy, parts.slice(0, -1).join('.'))[parts.at(-1)];
  }
  const initialVersion = '00000000000000000000000000000000';
  h.db.sqlite.prepare('UPDATE cms_versions SET content_json = ? WHERE id = ?').run(JSON.stringify(legacy), initialVersion);
  const item = await upload(h);
  const selected = IMAGE_ASPECT_RATIOS.slice(1);
  for (const [index, slot] of IMAGE_FIELDS.entries()) {
    setPath(current.content, slot.path, item.url);
    setPath(current.content, slot.altPath, `Nuotrauka ${index + 1}`);
    setPath(current.content, slot.ratioPath, selected[index].value);
  }
  let response = await h.request('/admin/api/draft', { method: 'POST', body: { content: current.content, revision: current.revision } });
  assert.equal(response.status, 200);
  current = await response.json();
  for (const [index, slot] of IMAGE_FIELDS.entries()) assert.equal(getPath(current.content, slot.ratioPath), selected[index].value);
  assert.doesNotMatch(await (await h.request('/')).text(), /image-ratio-/);
  response = await h.request('/admin/api/publish', { method: 'POST', body: { revision: current.revision } });
  assert.equal(response.status, 200);
  const ratioVersion = (await (await h.request('/admin/api/history')).json()).versions[0];
  const pages = await Promise.all(['/', '/apie-mus/', '/stovyklos/stovykla-01/'].map(async path => (await h.request(path)).text()));
  for (const option of selected) assert.ok(pages.some(html => html.includes(`image-ratio-${option.value.replace(':', '-')}`)), option.value);
  current = await state(h);
  current.content.site.heroImageRatio = '16:9';
  current = await (await h.request('/admin/api/draft', { method: 'POST', body: { content: current.content, revision: current.revision } })).json();
  assert.equal(current.content.site.heroImageRatio, '16:9');
  for (const [index, slot] of IMAGE_FIELDS.entries()) if (index) assert.equal(getPath(current.content, slot.ratioPath), selected[index].value);
  assert.match(await (await h.request('/')).text(), /class="hero-media image-ratio-1-1"/);
  current = await (await h.request('/admin/api/restore', { method: 'POST', body: { versionId: ratioVersion.id, revision: current.revision } })).json();
  for (const [index, slot] of IMAGE_FIELDS.entries()) assert.equal(getPath(current.content, slot.ratioPath), selected[index].value);
  response = await h.request('/admin/api/restore', { method: 'POST', body: { versionId: initialVersion, revision: current.revision } });
  assert.equal(response.status, 200);
  current = await response.json();
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(current.content, slot.ratioPath), 'auto');
  assert.match(await (await h.request('/')).text(), /class="hero-media image-ratio-1-1"/, 'Restoring legacy history creates a draft until explicitly published.');
  assert.equal((await h.request('/admin/api/publish', { method: 'POST', body: { revision: current.revision } })).status, 200);
  assert.doesNotMatch(await (await h.request('/')).text(), /image-ratio-|src="\/media\//);
});

test('Photo placement removal is draft-only until published and restores through current and legacy history', async () => {
  const h = harness();
  let current = await state(h);
  const legacy = clone(current.content);
  for (const slot of IMAGE_FIELDS) {
    const parts = slot.hiddenPath.split('.');
    delete getPath(legacy, parts.slice(0, -1).join('.'))[parts.at(-1)];
  }
  const initialVersion = '00000000000000000000000000000000';
  h.db.sqlite.prepare('UPDATE cms_versions SET content_json = ? WHERE id = ?').run(JSON.stringify(legacy), initialVersion);
  const item = await upload(h);
  for (const [index, slot] of IMAGE_FIELDS.entries()) {
    setPath(current.content, slot.path, item.url);
    setPath(current.content, slot.altPath, `Nuotrauka ${index + 1}`);
    setPath(current.content, slot.ratioPath, '16:9');
  }
  current = await (await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}})).json();
  assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: current.revision}})).status, 200);
  const visibleVersion = (await (await h.request('/admin/api/history')).json()).versions[0];
  for (const slot of IMAGE_FIELDS) setPath(current.content, slot.hiddenPath, true);
  current = await (await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}})).json();
  for (const slot of IMAGE_FIELDS) {
    assert.equal(getPath(current.content, slot.hiddenPath), true);
    assert.equal(getPath(current.content, slot.path), item.url);
    assert.equal(getPath(current.content, slot.ratioPath), '16:9');
  }
  assert.match(await (await h.request('/')).text(), /class="hero-media image-ratio-16-9"/);
  assert.doesNotMatch(await (await h.request('/admin/preview?path=/')).text(), /data-cms-image|hero-media|class="statement|camp-visual/);
  assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: current.revision}})).status, 200);
  for (const path of ['/', '/apie-mus/', '/stovyklos/stovykla-01/']) assert.doesNotMatch(await (await h.request(path)).text(), /src="\/media\/|hero-media|class="statement|camp-visual|detail-cover/);
  const hiddenVersion = (await (await h.request('/admin/api/history')).json()).versions[0];
  current = await (await h.request('/admin/api/restore', {method: 'POST', body: {versionId: visibleVersion.id, revision: current.revision}})).json();
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(current.content, slot.hiddenPath), false);
  assert.doesNotMatch(await (await h.request('/')).text(), /hero-media/);
  assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: current.revision}})).status, 200);
  assert.match(await (await h.request('/')).text(), /hero-media/);
  current = await (await h.request('/admin/api/restore', {method: 'POST', body: {versionId: hiddenVersion.id, revision: current.revision}})).json();
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(current.content, slot.hiddenPath), true);
  current = await (await h.request('/admin/api/restore', {method: 'POST', body: {versionId: initialVersion, revision: current.revision}})).json();
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(current.content, slot.hiddenPath), false, 'Legacy history defaults to visible placements.');
});

test('Removing a newly uploaded photo placement saves without alt text, while showing it again requires a description', async () => {
  const h = harness();
  const item = await upload(h);
  let current = await state(h);
  current.content.site.statementImage = item.url;
  current.content.site.statementImageAlt = '';
  current.content.site.statementImageHidden = true;
  let response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 200);
  current = await response.json();
  assert.equal(current.content.site.statementImage, item.url);
  current.content.site.statementImageHidden = false;
  response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 422);
  assert.ok((await response.json()).error.issues.some(issue => issue.path === 'site.statementImageAlt'));
  assert.equal((await state(h)).revision, current.revision);
  current.content.site.statementImageAlt = 'Moterų stovyklos nuotrauka';
  response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 200);
  current = await response.json();
  current.content.camps[0].image = item.url;
  current.content.camps[0].imageAlt = '';
  current.content.camps[0].imageHidden = true;
  response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 422, 'The visible detail cover still uses the hidden main photo as its fallback.');
  assert.ok((await response.json()).error.issues.some(issue => issue.path === 'camps.0.imageAlt'));
  current.content.camps[0].detailImageHidden = true;
  response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 200);
});

test('Shared media, text, design, extra blocks and removable parts persist through draft, publish, stale writes and history restore', async () => {
  const h = harness();
  let current = await state(h);
  const legacy = clone(current.content);
  for (const key of ['design', 'pageBlocks', 'partOrder', 'hiddenParts']) delete legacy[key];
  for (const slot of IMAGE_FIELDS) {
    const pieces = slot.positionPath.split('.'); delete getPath(legacy, pieces.slice(0, -1).join('.'))[pieces.at(-1)];
  }
  const initialVersion = '00000000000000000000000000000000';
  h.db.sqlite.prepare('UPDATE cms_versions SET content_json = ? WHERE id = ?').run(JSON.stringify(legacy), initialVersion);
  const main = await upload(h), hidden = await upload(h), custom = await upload(h);
  current.content.site.heroImage = main.url;
  current.content.site.heroImageAlt = 'Bendra nuotrauka visiems ekranams';
  current.content.site.heroImagePosition = 'right';
  current.content.site.statementImage = hidden.url;
  current.content.site.statementImageAlt = '';
  current.content.site.statementImageHidden = true;
  current.content.site.heroAccent = 'Bendra antraštė';
  current.content.site.aboutText = [];
  current.content.camps[0].program = [{title: 'Rytas', text: 'Pokalbiai'}];
  current.content.hiddenParts = ['home.hero.subtitle', 'detail.programHeading', 'registration.phone'];
  current.content.partOrder = ['home.hero.title', 'home.hero.eyebrow'];
  current.content.design = {...THEME_DEFAULTS, primary: '#123456', fontFamily: 'Georgia', buttonRadius: 4};
  current.content.pageBlocks.home = [
    {id: 'e'.repeat(32), type: 'button', zone: 'home.afterHero', text: 'Dalyvauti', url: 'https://forms.gle/example', source: null, alt: '', ratio: 'auto', size: 'normal', align: 'left', background: null, color: null},
    {id: 'f'.repeat(32), type: 'image', zone: 'home.beforeFooter', text: '', url: null, source: custom.url, alt: 'Papildoma bendra nuotrauka', ratio: '2:3', size: 'small', align: 'center', background: '#aabbcc', color: null}
  ];
  const expected = clone(current.content);
  let response = await h.request('/admin/api/draft', {method: 'POST', body: {content: current.content, revision: current.revision}});
  assert.equal(response.status, 200);
  current = await response.json();
  assert.deepEqual(current.content, expected);
  assert.equal(getDeviceContent(current.content).site.heroAccent, 'Bendra antraštė');
  assert.deepEqual(getDeviceContent(current.content, 'mobile'), getDeviceContent(current.content, 'desktop'));
  assert.equal(getImageSettings(current.content, 'site.heroImage').source, main.url);
  assert.equal(getImageSettings(current.content, 'site.heroImage', 'mobile').source, main.url);
  assert.equal((await h.request(main.url)).status, 404);
  assert.equal((await h.request(hidden.url)).status, 404);
  assert.equal((await h.request(custom.url)).status, 404);
  assert.equal((await h.request(`/admin/api/media/${custom.id}`, {method: 'DELETE'})).status, 409, 'Additional image blocks retain their media.');
  assert.equal((await h.request(`/admin/api/media/${hidden.id}`, {method: 'DELETE'})).status, 409, 'Hidden references protect restoration media.');
  assert.equal((await h.request('/admin/api/draft', {method: 'POST', body: {content: expected, revision: current.revision - 1}})).status, 409);
  assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: current.revision}})).status, 200);
  assert.equal((await h.request(main.url)).status, 200);
  assert.equal((await h.request(hidden.url)).status, 200);
  assert.equal((await h.request(custom.url)).status, 200);
  const publishedVersion = (await (await h.request('/admin/api/history')).json()).versions[0];
  response = await h.request('/admin/api/restore', {method: 'POST', body: {versionId: initialVersion, revision: current.revision}});
  assert.equal(response.status, 200);
  current = await response.json();
  assert.deepEqual(current.content.hiddenParts, []); assert.deepEqual(current.content.partOrder, []);
  assert.equal(current.content.design, null);
  assert.deepEqual(current.content.pageBlocks.home, []);
  for (const slot of IMAGE_FIELDS) assert.equal(getPath(current.content, slot.positionPath), 'default');
  assert.equal((await h.request(hidden.url)).status, 200, 'History restoration creates a private draft until explicitly published.');
  assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: current.revision}})).status, 200);
  assert.equal((await h.request(hidden.url)).status, 404);
  assert.equal((await h.request(custom.url)).status, 404);
  assert.equal((await h.request(`/admin/api/media/${hidden.id}`, {method: 'DELETE'})).status, 200);
  response = await h.request('/admin/api/restore', {method: 'POST', body: {versionId: publishedVersion.id, revision: current.revision}});
  assert.equal(response.status, 200);
  current = await response.json();
  assert.deepEqual(current.content, expected);
  assert.equal((await h.request(hidden.previewUrl)).status, 200, 'Restoring history recovers soft-deleted retained media.');
  assert.equal((await h.request(hidden.url)).status, 404);
});

test('Server rejects unsafe shared settings, abandoned profiles and nonexistent custom media without changing the draft revision', async () => {
  const h = harness();
  const initial = await state(h);
  for (const alter of [
    content => { content.site.heroImageMobile = {source: null}; },
    content => { content.site.heroImagePosition = 'fixed'; },
    content => { content.deviceContent = {mobile: {'site.facebook': 'javascript:alert(1)'}}; },
    content => { content.hiddenParts = ['admin.login']; },
    content => { content.partOrder = ['body.css']; },
    content => { content.design = {...THEME_DEFAULTS, background: 'url(javascript:alert(1))'}; },
    content => { content.pageBlocks.home = [{id: 'e'.repeat(32), type: 'image', zone: 'home.afterHero', text: '', url: null, source: `/media/${'f'.repeat(32)}.png`, alt: 'Neįkelta nuotrauka', ratio: 'auto', size: 'normal', align: 'left', background: null, color: null}]; }
  ]) {
    const content = clone(initial.content); alter(content);
    const response = await h.request('/admin/api/draft', {method: 'POST', body: {content, revision: initial.revision}});
    assert.equal(response.status, 422);
    assert.equal((await state(h)).revision, initial.revision);
  }
});

test('Unknown media, SVG disguised as JPEG, oversized bodies and external previews are rejected', async () => {
  const h = harness();
  const content = clone(DEFAULT_CONTENT);
  content.site.heroImage = `/media/${'b'.repeat(32)}.jpg`;
  content.site.heroImageAlt = 'Stovykla';
  assert.equal((await h.request('/admin/api/draft', { method: 'POST', body: { content, revision: 1 } })).status, 422);
  const form = new FormData();
  form.set('file', new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'photo.jpg', { type: 'image/jpeg' }));
  assert.equal((await h.request('/admin/api/media', { method: 'POST', body: form })).status, 422);
  await assert.rejects(readBodyLimited(new Request('https://example.test', { method: 'POST', body: 'elevenbytes' }), 5), error => error.status === 413);
  assert.throws(() => inspectImage(new TextEncoder().encode('<html>evil</html>')), error => error.status === 422);
  assert.equal((await h.request('/admin/preview?path=https://attacker.test')).status, 422);
  assert.equal((await h.request('/admin/preview?path=//attacker.test')).status, 422);
});

test('Published history is limited to 30 versions and author metadata is retained', async () => {
  const h = harness();
  const store = new CmsStore(h.db, clone(DEFAULT_CONTENT));
  await store.state();
  for (let index = 1; index <= 33; index++) {
    const content = clone(DEFAULT_CONTENT);
    content.site.heroAccent = `Kvietimas ${index}`;
    assert.equal(await store.saveDraft(content, index, identity.email), true);
    assert.equal(await store.publish(index + 1, identity.email), true);
  }
  const versions = await store.history();
  assert.equal(versions.length, 30);
  assert.equal(versions[0].revision, 34);
  assert.equal(versions.at(-1).revision, 5);
  assert.ok(versions.every(version => version.author === identity.email && version.createdAt));
});

test('Public static content survives unavailable database bindings while admin APIs fail closed', async () => {
  const h = harness();
  h.env.CMS_DB = { prepare() { throw new Error('database offline'); } };
  assert.equal(await (await h.request('/')).text(), 'static output');
  assert.equal((await h.request('/admin/api/state')).status, 503);
  delete h.env.CMS_DB;
  assert.equal(await (await h.request('/')).text(), 'static output');
  assert.equal((await h.request('/admin/api/state')).status, 503);
});
