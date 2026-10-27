import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../server/app.mjs';
import {DEFAULT_CONTENT, THEME_DEFAULTS, parseContent, getImageReferences} from '../shared/content.mjs';
import {renderPage, renderRobots, renderSitemap, renderTheme} from '../shared/render.mjs';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return {results: this.db.prepare(this.sql).all(...this.args)}; }
  async run() { const result = this.db.prepare(this.sql).run(...this.args); return {success: true, meta: {changes: Number(result.changes)}}; }
}
function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const database = {
    prepare: sql => new Statement(db, sql),
    async batch(statements) {
      db.exec('BEGIN');
      try { const result = []; for (const statement of statements) result.push(await statement.run()); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
  const runtime = {initialContent: structuredClone(DEFAULT_CONTENT), assets: {}, parseContent, getImageReferences, renderPage, renderRobots, renderSitemap, renderTheme};
  const handle = createHandler(runtime);
  const env = {CMS_DB: database, ASSETS: {fetch: async () => new Response('Nerasta', {status: 404})}};
  const request = (path, {method = 'GET', body, admin = true, origin = 'https://bukarciau.lt'} = {}) => handle(new Request(origin + path, {
    method,
    headers: {...(body ? {'Content-Type': 'application/json', Origin: origin, 'X-CMS-Request': '1'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})
  }), env, {}, admin ? {verifyAccess: async () => ({email: 'admin@example.test'})} : {});
  return {request, close: () => db.close()};
}

test('Theme CSS keeps draft colours private until publication and preserves the restrictive CSP', async () => {
  const h = harness();
  try {
    const state = await (await h.request('/admin/api/state')).json();
    state.content.design = {...THEME_DEFAULTS, background: '#feeedd', buttonBackground: '#ab12ef'};
    const save = await h.request('/admin/api/draft', {method: 'POST', body: {content: state.content, revision: state.revision}});
    assert.equal(save.status, 200);
    const draft = await save.json();
    const publicCss = await h.request('/theme.css?draft=1');
    assert.equal(publicCss.status, 200);
    assert.match(publicCss.headers.get('Content-Type'), /^text\/css/);
    assert.doesNotMatch(await publicCss.text(), /#ab12ef/i);
    const privateCss = await h.request('/admin/theme.css');
    assert.equal(privateCss.status, 200);
    assert.match(privateCss.headers.get('Cache-Control'), /private.*no-store/);
    assert.match(await privateCss.text(), /#ab12ef/i);
    const preview = await h.request('/admin/preview?path=/&device=mobile');
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /href="\/admin\/theme\.css/);
    const csp = preview.headers.get('Content-Security-Policy');
    assert.match(csp, /style-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: draft.revision}})).status, 200);
    const published = await h.request('/theme.css');
    assert.match(published.headers.get('Cache-Control'), /must-revalidate/);
    assert.match(await published.text(), /#ab12ef/i);
    const publicPage = await h.request('/');
    assert.match(await publicPage.text(), /href="\/theme\.css/);
  } finally { h.close(); }
});

test('Private theme and device preview routes stay authenticated and validate their inputs', async () => {
  const h = harness();
  try {
    assert.equal((await h.request('/admin/theme.css', {admin: false})).status, 503);
    assert.equal((await h.request('/admin/theme.css', {origin: 'https://bukarciau.pages.dev'})).status, 403);
    assert.equal((await h.request('/theme.css', {method: 'POST'})).status, 405);
    assert.equal((await h.request('/admin/theme.css', {method: 'POST'})).status, 405);
    assert.equal((await h.request('/admin/preview?device=unknown')).status, 422);
    assert.equal(await (await h.request('/theme.css', {method: 'HEAD'})).text(), '');
    assert.equal(await (await h.request('/admin/theme.css', {method: 'HEAD'})).text(), '');
  } finally { h.close(); }
});

test('Manual block dimensions stay private until their saved draft is published', async () => {
  const h = harness();
  try {
    const state = await (await h.request('/admin/api/state')).json();
    state.content.blockLayouts['section-home-hero'] = {width: 83, height: 347, paddingTop: 9, paddingBottom: 13};
    const save = await h.request('/admin/api/draft', {method: 'POST', body: {content: state.content, revision: state.revision}});
    assert.equal(save.status, 200);
    const draft = await save.json();
    assert.doesNotMatch(await (await h.request('/theme.css?draft=1')).text(), /347px/);
    const privateCss = await h.request('/admin/theme.css');
    assert.match(privateCss.headers.get('Cache-Control'), /private.*no-store/);
    assert.match(await privateCss.text(), /347px/);
    assert.equal((await h.request('/admin/api/publish', {method: 'POST', body: {revision: draft.revision}})).status, 200);
    assert.match(await (await h.request('/theme.css')).text(), /347px/);
    assert.match(await (await h.request('/')).text(), /href="\/theme\.css/);
  } finally { h.close(); }
});

test('Public theme requests have a static fallback when database bindings are unavailable', async () => {
  const initialContent = structuredClone(DEFAULT_CONTENT);
  const handler = createHandler({initialContent, assets: {}, renderTheme});
  const response = await handler(new Request('https://bukarciau.lt/theme.css'), {}, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), renderTheme(initialContent));
});
