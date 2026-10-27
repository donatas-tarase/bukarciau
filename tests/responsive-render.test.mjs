import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONTENT, IMAGE_FIELDS, IMAGE_POSITIONS, CONTENT_PARTS, CONTENT_ZONES, THEME_DEFAULTS, parseContent, setPath} from '../shared/content.mjs';
import {renderPage, renderTheme} from '../shared/render.mjs';

const routes = ['/', '/apie-mus/', '/kontaktai/', '/stovyklos/stovykla-01/', '/404.html'];
const image = '/media/0123456789abcdef0123456789abcdef.jpg';
const copy = () => structuredClone(DEFAULT_CONTENT);
const canvas = (content, route = '/', device = 'desktop') => renderPage(content, route, {preview:true, previewDevice:device}).html;
function tokens(html) {
  const stack = [], records = [];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)) {
    const name = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(tag => tag.name === name);
      if (index >= 0) stack.length = index;
      continue;
    }
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
    const record = {name, attrs, parents:[...stack]};
    records.push(record);
    if (!voids.has(name)) stack.push(record);
  }
  return records;
}
const block = (id, type, zone, options = {}) => ({id:String(id).padStart(32,'0'), type, zone, text:'Naujas tekstas', url:null, source:null, alt:'', ratio:'auto', size:'normal', align:'left', background:null, color:null, ...options});

test('the editor and publication use one content tree and unique document landmarks', () => {
  const content = copy();
  content.site.statementImagePosition = 'left';
  for (const route of routes) {
    const desktop = canvas(content, route, 'desktop');
    const mobile = canvas(content, route, 'mobile');
    assert.equal(desktop.replace('data-cms-device="desktop"',''), mobile.replace('data-cms-device="mobile"',''), `${route}: screen size changes geometry, never editorial content`);
    const html = renderPage(content, route).html;
    const elements = tokens(html);
    const ids = elements.flatMap(tag => tag.attrs.id ? [tag.attrs.id] : []);
    assert.equal(ids.length, new Set(ids).size, route);
    assert.equal(elements.filter(tag => tag.name === 'h1').length, 1, route);
    assert.equal(elements.filter(tag => tag.name === 'main').length, 1, route);
    assert.doesNotMatch(html, /data-cms-(?:field|part|image|block|sort-zone|drop-zone)|cms-device-(?:desktop|mobile)/);
  }
});

test('each editable text belongs to a real removable semantic part', () => {
  const content = copy();
  content.camps[0].program = [{title:'Susitikimas', text:'Pokalbis'}];
  content.camps[0].included = ['Nakvynė'];
  content.camps[0].notIncluded = ['Kelionė'];
  const known = new Set(CONTENT_PARTS.map(part => part.id));
  for (const route of routes) {
    for (const element of tokens(canvas(content, route))) {
      if (!element.attrs['data-cms-field']) continue;
      const part = [...element.parents].reverse().find(parent => parent.attrs['data-cms-part']);
      assert.ok(part && known.has(part.attrs['data-cms-part']), `${route}: ${element.attrs['data-cms-field']} must have a removable ancestor`);
      assert.notEqual(part, element, 'the editing marker is inside a separately removable semantic element');
    }
  }
});

test('all image positions affect the actual adjacent media layout and preserve source, alt and ratio', () => {
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':'/stovyklos/stovykla-01/'};
  for (const slot of IMAGE_FIELDS) {
    for (const {value:position} of IMAGE_POSITIONS) {
      const content = copy();
      setPath(content, slot.path, image); setPath(content, slot.altPath, 'Sava nuotrauka');
      setPath(content, slot.ratioPath, '3:2'); setPath(content, slot.positionPath, position);
      const html = canvas(parseContent(content), pageFor[slot.path]);
      const frame = tokens(html).find(tag => tag.attrs['data-cms-image'] === slot.path);
      assert.ok(frame, `${slot.path}: ${position}`);
      assert.match(frame.attrs.class, /image-ratio-3-2/);
      assert.match(html, /src="\/admin\/api\/media\/0123456789abcdef0123456789abcdef.jpg" alt="Sava nuotrauka"/);
      const targets = tokens(html).filter(tag => tag.attrs['data-cms-image-drop'] === slot.path);
      assert.deepEqual(new Set(targets.map(tag => tag.attrs['data-cms-position'])), new Set(IMAGE_POSITIONS.map(option => option.value)));
    }
  }
  const content = copy(); content.site.statementImagePosition = 'left';
  assert.match(renderPage(content, '/').html, /responsive-intro-layout r-position-left/);
});

test('hidden image frames and their drag targets disappear without losing nearby copy', () => {
  const content = copy(); content.site.statementImagePosition = 'left';
  for (const slot of IMAGE_FIELDS) setPath(content, slot.hiddenPath, true);
  for (const route of routes) {
    assert.doesNotMatch(canvas(content, route), /data-cms-image(?:=|-drop=|-zones=)/);
    assert.doesNotMatch(renderPage(content, route).html, /responsive-layout-media|responsive-hero-media|camp-visual/);
  }
  assert.ok(renderPage(content, '/').html.includes(content.site.aboutText[0]));
});

test('parts can be removed and sibling parts reordered with the same result in preview and public output', () => {
  const content = copy();
  content.site.aboutText = ['Pastraipa Pirma', 'Pastraipa Antra'];
  content.copy.home.introTitle = 'Antraštė Kurią Paslepiame';
  content.hiddenParts = ['home.intro.title', 'home.camp.link', 'contact.phone'];
  content.partOrder = ['home.intro.paragraph.1', 'home.intro.paragraph.0'];
  const valid = parseContent(content);
  for (const preview of [false,true]) {
    const html = renderPage(valid, '/', {preview, previewDevice:'desktop'}).html;
    assert.doesNotMatch(html, /Antraštė Kurią Paslepiame/);
    assert.ok(html.indexOf('Pastraipa Antra') < html.indexOf('Pastraipa Pirma'));
    assert.doesNotMatch(html, /href="\/stovyklos\/stovykla-01\/"/);
    const contact = renderPage(valid, '/kontaktai/', {preview, previewDevice:'desktop'}).html;
    assert.doesNotMatch(contact, /data-cms-part="contact.phone"/);
  }
  valid.hiddenParts = [];
  assert.match(canvas(valid), /Antraštė Kurią Paslepiame/);
});

test('all added content zones are selectable in preview, while empty zones take no public space', () => {
  const content = copy();
  const pageFor = {home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:'/stovyklos/stovykla-01/'};
  for (const [page, route] of Object.entries(pageFor)) {
    const html = canvas(content, route);
    for (const zone of CONTENT_ZONES.filter(zone => zone.page === page)) assert.ok(html.includes(`data-cms-drop-zone="${zone.id}"`), zone.id);
    assert.doesNotMatch(renderPage(content, route).html, /cms-content-zone/);
  }
});

test('added blocks retain their zone and order and incomplete links never become live public anchors', () => {
  const content = copy();
  content.pageBlocks.home = [block(1,'text','home.afterHero',{text:'Pirmas papildomas blokas'}),block(2,'button','home.afterHero',{text:'Tikra nuoroda',url:'https://example.lt/anketa'}),block(3,'link','home.afterHero',{text:'Dar be adreso'})];
  const valid = parseContent(content);
  const html = renderPage(valid, '/').html;
  assert.ok(html.indexOf('Pirmas papildomas blokas') < html.indexOf('Tikra nuoroda'));
  assert.ok(html.indexOf('Pirmas papildomas blokas') < html.indexOf('id="susipazinkime"'));
  assert.doesNotMatch(html, /Dar be adreso|cms-block-00000000000000000000000000000003/);
  assert.match(html, /href="https:\/\/example.lt\/anketa" target="_blank" rel="noopener noreferrer"/);
  assert.match(canvas(valid), /data-cms-block="00000000000000000000000000000001" data-cms-block-zone="home.afterHero"/);
  valid.pageBlocks.home.reverse();
  assert.ok(renderPage(valid, '/').html.indexOf('Tikra nuoroda') < renderPage(valid, '/').html.indexOf('Pirmas papildomas blokas'));
  valid.pageBlocks.home[1].url = 'javascript:alert(1)';
  assert.doesNotMatch(canvas(valid), /href="javascript:/);
});

test('new block image URLs, text and CSS remain safe even in unsaved previews', () => {
  const content = copy();
  content.pageBlocks.home = [block(1,'text','home.afterHero',{text:'<script>alert(1)</script>'}),block(2,'image','home.afterHero',{source:image,alt:'Mano nuotrauka',ratio:'1:1'})];
  const html = canvas(content);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /class="photo image-ratio-1-1"/);
  assert.match(html, /alt="Mano nuotrauka"/);
  assert.doesNotMatch(html, /\sstyle=/);
  content.pageBlocks.home[0].background = 'red;}body{display:none';
  content.pageBlocks.home[1].source = 'javascript:alert(1)';
  assert.doesNotMatch(renderTheme(content), /display:none|javascript:/);
  assert.doesNotMatch(canvas(content), /src="javascript:/);
});

test('shared design changes produce a safe external theme and custom block styles', () => {
  const content = copy();
  content.design = {...THEME_DEFAULTS, background:'#f1f2f3', buttonRadius:8, fontFamily:'Georgia'};
  content.pageBlocks.home = [block(1,'text','home.afterHero',{background:'#123456',color:'#ffffff'})];
  const valid = parseContent(content);
  const css = renderTheme(valid);
  assert.match(css, /:root\{[^}]*--cream:#f1f2f3/);
  assert.match(css, /--button-radius:8px/);
  assert.match(css, /--font:Georgia,serif/);
  assert.match(css, /\.cms-block-00000000000000000000000000000001\{background:#123456;color:#ffffff;--block-color:#ffffff\}/);
  assert.doesNotMatch(css, /@media/);
  assert.match(renderPage(valid,'/').html, /href="\/theme.css"/);
  assert.match(renderPage(valid,'/',{preview:true,previewDevice:'mobile',assets:{theme:'/admin/theme.css'}}).html, /href="\/admin\/theme.css"/);
  content.design.buttonRadius = '1px;display:none';
  content.design.fontFamily = 'evil;url(https://example.lt)';
  assert.doesNotMatch(renderTheme(content), /display:none|evil|url\(/);
});

test('block colors are scoped to their page when an editorial block ID is reused', () => {
  const content = copy();
  content.pageBlocks.home = [block(1,'text','home.afterHero',{color:'#112233'})];
  content.pageBlocks.about = [block(1,'text','about.afterStory',{color:'#aabbcc'})];
  const valid = parseContent(content);
  const css = renderTheme(valid);
  assert.match(css, /\.cms-page-home \.cms-block-00000000000000000000000000000001\{color:#112233;--block-color:#112233\}/);
  assert.match(css, /\.cms-page-about \.cms-block-00000000000000000000000000000001\{color:#aabbcc;--block-color:#aabbcc\}/);
  assert.match(renderPage(valid,'/').html, /class="responsive-site cms-page-home"/);
  assert.match(renderPage(valid,'/apie-mus/').html, /class="responsive-site cms-page-about"/);
});

test('removing every paragraph or list item leaves no ghost editing fields or undefined text', () => {
  const content = copy();
  content.site.values = []; content.site.aboutText = []; content.site.story = []; content.camps[0].description = [];
  const valid = parseContent(content);
  const all = routes.map(route => canvas(valid,route)).join('\n');
  assert.doesNotMatch(all, /data-cms-field="(?:site\.(?:values|aboutText|story)|camps\.0\.description)\.\d+"|>undefined</);
  assert.doesNotMatch(renderPage(valid,'/').html, /<p><\/p>|responsive-hero-values/);
});
