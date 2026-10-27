import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONTENT, IMAGE_FIELDS, IMAGE_POSITIONS, IMAGE_SIZES, CONTENT_PARTS, CONTENT_ZONES, THEME_DEFAULTS, SECTION_LAYOUT_TARGETS, getLayoutTargets, parseContent, setPath} from '../shared/content.mjs';
import {renderPage, renderTheme, renderLayoutRules} from '../shared/render.mjs';

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
  assert.ok(tokens(renderPage(content, '/').html).some(tag => ['responsive-intro-layout','r-position-left'].every(cls => tag.attrs.class?.split(' ').includes(cls))));
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

test('every fixed photo size applies to the complete blank or uploaded frame without changing its ratio', () => {
  assert.deepEqual(IMAGE_SIZES.map(option => option.value), ['auto','small','normal','large']);
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':'/stovyklos/stovykla-01/'};
  for (const slot of IMAGE_FIELDS) {
    for (const size of ['small','normal','large']) {
      for (const uploaded of [false,true]) {
        const content = copy();
        setPath(content, slot.sizePath, size);
        setPath(content, slot.ratioPath, '3:2');
        if (uploaded) { setPath(content, slot.path, image); setPath(content, slot.altPath, 'Keičiamo dydžio nuotrauka'); }
        const valid = parseContent(content);
        const frame = tokens(canvas(valid,pageFor[slot.path])).find(tag => tag.attrs['data-cms-image'] === slot.path);
        assert.ok(frame, `${slot.path}: ${size}, uploaded=${uploaded}`);
        assert.ok(frame.attrs.class.split(' ').includes(`image-size-${size}`));
        assert.ok(frame.attrs.class.split(' ').includes('image-ratio-3-2'));
        const published = renderPage(valid,pageFor[slot.path]).html;
        assert.match(published, new RegExp(`class="[^"]*image-ratio-3-2 image-size-${size}`));
        assert.doesNotMatch(published,/\sstyle=/);
      }
    }
  }
});

test('automatic fixed photo size preserves legacy output and restores its original composition', () => {
  const content = copy();
  for (const slot of IMAGE_FIELDS) { setPath(content,slot.path,image); setPath(content,slot.altPath,'Nuotrauka'); }
  const before = routes.map(route => renderPage(content,route).html);
  for (const slot of IMAGE_FIELDS) setPath(content,slot.sizePath,'small');
  assert.notDeepEqual(routes.map(route => renderPage(content,route).html),before);
  for (const slot of IMAGE_FIELDS) setPath(content,slot.sizePath,'auto');
  assert.deepEqual(routes.map(route => renderPage(content,route).html),before);
  assert.doesNotMatch(before.join('\n'),/image-size-|r-media-size-|hero-photo-size-/);
});

test('explicit hero and secondary sizes use independent inline frames while the detail fallback keeps its own size', () => {
  const content = copy();
  content.site.heroImageSize='small';
  content.camps[0].secondaryImageSize='normal';
  content.camps[0].image=image; content.camps[0].imageAlt='Pagrindinė nuotrauka';
  content.camps[0].detailImageSize='large'; content.camps[0].detailImageRatio='1:1';
  const home = canvas(parseContent(content));
  assert.ok(tokens(home).some(tag => ['hero-position-right','hero-photo-size-small'].every(cls => tag.attrs.class?.split(' ').includes(cls))));
  assert.doesNotMatch(home,/class="camp-visual|class="photo photo-small/);
  assert.match(home,/class="responsive-camp-below"/);
  const detail = tokens(canvas(content,'/stovyklos/stovykla-01/')).find(tag=>tag.attrs['data-cms-image']==='camps.0.detailImage');
  assert.match(detail.attrs.class,/image-ratio-1-1 image-size-large/);
  assert.match(canvas(content,'/stovyklos/stovykla-01/'),/alt="Pagrindinė nuotrauka"/);
  content.site.heroImageHidden=true;
  assert.doesNotMatch(canvas(content),/data-cms-image="site.heroImage"|data-cms-image-drop="site.heroImage"/);
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

const dimensions = options => ({width:null,height:null,paddingTop:null,paddingBottom:null,...options});

test('layout selection identifies whole sections, photos, semantic parts and added blocks', () => {
  const content = copy();
  content.pageBlocks.home = [block(1,'text','home.afterHero')];
  const known = new Map(getLayoutTargets(content).map(target => [target.id,target]));
  const pageFor = {home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:'/stovyklos/stovykla-01/'};
  const seenSections = new Set();
  for (const [page,route] of Object.entries(pageFor)) {
    const elements = tokens(canvas(content,route));
    const marked = elements.filter(tag => tag.attrs['data-cms-layout']);
    assert.equal(marked.length,new Set(marked.map(tag => tag.attrs['data-cms-layout'])).size,`${page}: selectable layout targets are unique`);
    for (const tag of marked) {
      const id = tag.attrs['data-cms-layout'];
      assert.ok(known.has(id),id);
      assert.ok(tag.attrs.class.split(' ').includes(`cms-layout-${id}`),id);
      if (known.get(id).type === 'section') seenSections.add(id);
    }
    for (const section of SECTION_LAYOUT_TARGETS.filter(target => [page,'shared'].includes(target.page))) assert.ok(marked.some(tag => tag.attrs['data-cms-layout'] === section.id),section.id);
    for (const tag of elements.filter(tag => tag.attrs['data-cms-image'])) assert.equal(tag.attrs['data-cms-layout'],`photo-${tag.attrs['data-cms-image'].replaceAll('.','-')}`);
    for (const tag of elements.filter(tag => tag.attrs['data-cms-part'])) assert.equal(tag.attrs['data-cms-layout'],`part-${tag.attrs['data-cms-part'].replaceAll('.','-')}`);
  }
  assert.equal(seenSections.size,15);
  assert.match(canvas(content),/data-cms-layout="block-00000000000000000000000000000001"/);
  assert.doesNotMatch(renderPage(content,'/').html,/data-cms-layout/);
});

test('manual photo dimensions override size without changing the chosen crop or shrinking twice', () => {
  const content = copy();
  content.site.statementImagePosition='left'; content.site.statementImageRatio='1:1'; content.site.statementImageSize='small';
  content.blockLayouts['photo-site-statementImage']=dimensions({width:60,height:220});
  const valid = parseContent(content);
  const frame = tokens(canvas(valid)).find(tag => tag.attrs['data-cms-image']==='site.statementImage');
  assert.match(frame.attrs.class,/cms-layout-has-width cms-layout-has-height/);
  assert.match(frame.attrs.class,/image-ratio-1-1 image-size-small/);
  const rules = renderLayoutRules(valid);
  const own = rules.find(rule => rule.selector === '.cms-layout-photo-site-statementImage').properties;
  assert.equal(own['--layout-image-width'],'60%');
  assert.equal(own.width,undefined,'paired frames fill their resized track, rather than multiplying its width again');
  assert.equal(own.height,'220px'); assert.equal(own['min-height'],'0px'); assert.equal(own['aspect-ratio'],'auto');
  const track = rules.find(rule => rule.selector.includes('.responsive-layout.photo-layout-site-statementImage')).properties;
  assert.equal(track['--manual-image-track'],'0.6fr'); assert.equal(track['--manual-copy-track'],'1.4fr');
  assert.match(renderTheme(valid),/height:220px!important/);
  assert.match(renderPage(valid,'/').html,/href="\/theme.css"/);
  assert.doesNotMatch(renderPage(valid,'/').html,/\sstyle=/);
  assert.equal(valid.site.statementImageRatio,'1:1','manual dimensions retain the stored crop for resetting');
});

test('manual photo dimensions work for every fixed frame and turn background or overlay photos into independent frames', () => {
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':'/stovyklos/stovykla-01/'};
  for (const slot of IMAGE_FIELDS) {
    const content=copy(),id=`photo-${slot.path.replaceAll('.','-')}`;
    content.blockLayouts[id]=dimensions({width:65,height:180,paddingTop:10,paddingBottom:15});
    const frame=tokens(canvas(parseContent(content),pageFor[slot.path])).find(tag=>tag.attrs['data-cms-image']===slot.path);
    assert.ok(frame.attrs.class.split(' ').includes('cms-layout-has-padding'));
    const rule=renderLayoutRules(content).find(rule=>rule.selector===`.cms-layout-${id}`).properties;
    assert.equal(rule.height,'180px'); assert.equal(rule['--layout-photo-padding-top'],'10px'); assert.equal(rule['--layout-photo-padding-bottom'],'15px');
    if (slot.path==='site.heroImage') assert.ok(tokens(canvas(content)).some(tag=>tag.attrs.class?.split(' ').includes('hero-position-right')));
    if (slot.path==='camps.0.image'||slot.path==='camps.0.secondaryImage') assert.ok(!tokens(canvas(content)).some(tag=>tag.attrs.class?.split(' ').includes('camp-visual')),'resized camp photos no longer use an overlapping frame');
  }
});

test('section and text heights remain minimums, reduce automatic padding, and preserve explicit spacing', () => {
  const content=copy();
  content.pageBlocks.home=[block(1,'spacer','home.afterHero',{size:'large'})];
  content.blockLayouts={
    'section-home-hero':dimensions({height:180,paddingTop:12}),
    'section-home-intro':dimensions({width:80,height:120,paddingBottom:18}),
    'part-home-intro-paragraph-0':dimensions({width:75,height:60}),
    'block-00000000000000000000000000000001':dimensions({height:40})
  };
  const valid=parseContent(content),rules=renderLayoutRules(valid);
  const own=id=>rules.find(rule=>rule.selector===`.cms-layout-${id}`).properties;
  for (const id of Object.keys(valid.blockLayouts)) {
    assert.equal(own(id).height,'auto',id);
    assert.equal(own(id)['max-height'],'none',id);
    assert.ok(Number.parseInt(own(id)['min-height'])>=40,id);
  }
  assert.equal(own('section-home-hero')['padding-top'],'12px');
  assert.equal(own('section-home-hero')['padding-bottom'],'0px');
  assert.equal(own('section-home-intro')['padding-top'],'0px');
  assert.equal(own('section-home-intro')['padding-bottom'],'18px');
  assert.equal(own('section-home-intro').width,'80%');
  assert.ok(rules.some(rule=>rule.selector.includes('>.hero-content')&&rule.properties['padding-top']==='0px'));
  assert.equal(own('block-00000000000000000000000000000001')['min-height'],'40px','manual spacer height can shrink the old large preset');
});

test('only bounded known layout values enter CSS, including unsaved drafts, and resetting restores the original site', () => {
  const content=copy(),original=routes.map(route=>renderPage(content,route).html);
  content.blockLayouts={
    'section-home-intro':dimensions({width:101,height:'200px;display:none',paddingTop:-1,paddingBottom:241}),
    'section-home-hero':dimensions({width:50.5,height:Infinity,paddingTop:NaN}),
    'unknown-target':dimensions({width:80,height:200}),
    'section-home-intro}body{display:none':dimensions({width:80,height:200})
  };
  assert.deepEqual(renderLayoutRules(content),[]);
  assert.doesNotMatch(renderTheme(content),/display:none|Infinity|NaN|unknown-target/);
  content.blockLayouts={'section-home-intro':dimensions({width:20,height:40,paddingTop:0,paddingBottom:240})};
  const css=renderTheme(parseContent(content));
  assert.match(css,/width:20%!important/); assert.match(css,/min-height:40px!important/); assert.match(css,/padding-bottom:240px!important/);
  assert.notDeepEqual(routes.map(route=>renderPage(content,route).html),original);
  content.blockLayouts={};
  assert.deepEqual(routes.map(route=>renderPage(content,route).html),original);
  assert.equal(renderTheme(content),'');
});
