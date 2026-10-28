import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONTENT, IMAGE_FIELDS, IMAGE_POSITIONS, IMAGE_SIZES, CONTENT_PARTS, CONTENT_ZONES, THEME_DEFAULTS, SECTION_LAYOUT_TARGETS, getLayoutTargets, parseContent, setPath} from '../shared/content.mjs';
import * as schema from '../shared/content.mjs';
import {renderPage, renderTheme, renderLayoutRules} from '../shared/render.mjs';
import {CAMP_PATH, PAGE_ROUTES} from '../shared/routes.mjs';

const routes = ['/', '/apie-mus/', '/kontaktai/', CAMP_PATH, '/404.html'];
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
const block = (id, type, zone, options = {}) => ({id:String(id).padStart(32,'0'), type, zone, beforePart:null, text:'Naujas tekstas', url:null, source:null, alt:'', ratio:'auto', size:'normal', align:'left', background:null, color:null, ...options});

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
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':CAMP_PATH};
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
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':CAMP_PATH};
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
  const detail = tokens(canvas(content,CAMP_PATH)).find(tag=>tag.attrs['data-cms-image']==='camps.0.detailImage');
  assert.match(detail.attrs.class,/image-ratio-1-1 image-size-large/);
  assert.match(canvas(content,CAMP_PATH),/alt="Pagrindinė nuotrauka"/);
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
    assert.doesNotMatch(html, /data-cms-part="home.camp.link"/);
    if (!preview) assert.ok(!html.includes(`>${valid.copy.actions.camp} <svg`));
    const contact = renderPage(valid, '/kontaktai/', {preview, previewDevice:'desktop'}).html;
    assert.doesNotMatch(contact, /data-cms-part="contact.phone"/);
  }
  valid.hiddenParts = [];
  assert.match(canvas(valid), /Antraštė Kurią Paslepiame/);
});

test('all added content zones are selectable in preview, while empty zones take no public space', () => {
  const content = copy();
  const pageFor = {home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:CAMP_PATH};
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
  assert.match(renderPage(valid,'/').html, /class="site-polished responsive-site cms-page-home"/);
  assert.match(renderPage(valid,'/apie-mus/').html, /class="site-polished responsive-site cms-page-about"/);
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
  const pageFor = {home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:CAMP_PATH};
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
  assert.equal(own.height,'var(--responsive-photo-height, 220px)'); assert.equal(own['min-height'],'0px'); assert.equal(own['aspect-ratio'],'var(--responsive-photo-ratio,auto)');
  const track = rules.find(rule => rule.selector.includes('.responsive-layout.photo-layout-site-statementImage')).properties;
  assert.equal(track['--manual-image-track'],'0.6fr'); assert.equal(track['--manual-copy-track'],'1.4fr');
  assert.match(renderTheme(valid),/height:var\(--responsive-photo-height, 220px\)!important/);
  assert.match(renderPage(valid,'/').html,/href="\/theme.css"/);
  assert.doesNotMatch(renderPage(valid,'/').html,/\sstyle=/);
  assert.equal(valid.site.statementImageRatio,'1:1','manual dimensions retain the stored crop for resetting');
});

test('manual photo dimensions work for every fixed frame and turn background or overlay photos into independent frames', () => {
  const pageFor = {'site.heroImage':'/', 'site.statementImage':'/', 'site.togetherImage':'/apie-mus/', 'camps.0.image':'/', 'camps.0.secondaryImage':'/', 'camps.0.detailImage':CAMP_PATH};
  for (const slot of IMAGE_FIELDS) {
    const content=copy(),id=`photo-${slot.path.replaceAll('.','-')}`;
    content.blockLayouts[id]=dimensions({width:65,height:180,paddingTop:10,paddingBottom:15});
    const frame=tokens(canvas(parseContent(content),pageFor[slot.path])).find(tag=>tag.attrs['data-cms-image']===slot.path);
    assert.ok(frame.attrs.class.split(' ').includes('cms-layout-has-padding'));
    const rule=renderLayoutRules(content).find(rule=>rule.selector===`.cms-layout-${id}`).properties;
    assert.equal(rule.height,'var(--responsive-photo-height, 180px)'); assert.equal(rule['--layout-photo-padding-top'],'10px'); assert.equal(rule['--layout-photo-padding-bottom'],'15px');
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
    assert.match(own(id)['min-height'],/^var\(--responsive-block-min-height, \d+px\)$/,id);
  }
  assert.equal(own('section-home-hero')['padding-top'],'12px');
  assert.equal(own('section-home-hero')['padding-bottom'],'0px');
  assert.equal(own('section-home-intro')['padding-top'],'0px');
  assert.equal(own('section-home-intro')['padding-bottom'],'18px');
  assert.equal(own('section-home-intro').width,'var(--responsive-block-width, 80%)');
  assert.ok(rules.some(rule=>rule.selector.includes('>.hero-content')&&rule.properties['padding-top']==='0px'));
  assert.equal(own('block-00000000000000000000000000000001')['min-height'],'var(--responsive-block-min-height, 40px)','manual spacer height can shrink the old large preset');
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
  assert.match(css,/width:var\(--responsive-block-width, 20%\)!important/); assert.match(css,/min-height:var\(--responsive-block-min-height, 40px\)!important/); assert.match(css,/padding-bottom:240px!important/);
  assert.notDeepEqual(routes.map(route=>renderPage(content,route).html),original);
  content.blockLayouts={};
  assert.deepEqual(routes.map(route=>renderPage(content,route).html),original);
  assert.equal(renderTheme(content),'');
});

test('existing link destinations are editable on real anchors without changing their labels', () => {
  assert.ok(schema.LINK_PARTS?.length,'the link registry must be available');
  const content=copy();
  content.linkOverrides=Object.fromEntries(schema.LINK_PARTS.map(({id})=>[id,'https://example.lt/nauja?x=1&y=2']));
  const valid=parseContent(content),seen=new Set();
  for (const route of routes) {
    const original=tokens(canvas(copy(),route));
    const edited=tokens(canvas(valid,route));
    for (const anchor of edited.filter(tag=>tag.attrs['data-cms-link'])) {
      const id=anchor.attrs['data-cms-link']; seen.add(id);
      assert.equal(anchor.name,'a',id);
      assert.equal(anchor.attrs.href,'https://example.lt/nauja?x=1&amp;y=2',id);
      assert.equal(anchor.attrs.target,'_blank',id);
      assert.equal(anchor.attrs.rel,'noopener noreferrer',id);
      const before=original.find(tag=>tag.attrs['data-cms-link']===id);
      assert.ok(before,id);
      const beforeFields=original.filter(tag=>tag.parents.includes(before)&&tag.attrs['data-cms-field']).map(tag=>tag.attrs['data-cms-field']);
      const afterFields=edited.filter(tag=>tag.parents.includes(anchor)&&tag.attrs['data-cms-field']).map(tag=>tag.attrs['data-cms-field']);
      assert.deepEqual(afterFields,beforeFields,`${id}: URL changes preserve editable label fields`);
    }
    assert.doesNotMatch(renderPage(valid,route).html,/data-cms-link/);
  }
  assert.deepEqual(seen,new Set(schema.LINK_PARTS.map(({id})=>id)));
});

test('local, email and telephone overrides stay in the current tab and changed registration links lose stale behavior', () => {
  const content=copy();
  content.linkOverrides={
    'home.hero.cta':'/kontaktai/#parasykite',
    'registration.cta':'mailto:info@bukarciau.lt?subject=Klausimas',
    'home.intro.link':'tel:+37060571562',
    'common.footer.facebook':'#registracija'
  };
  const valid=parseContent(content),html=canvas(valid),elements=tokens(html);
  for (const [id,url] of Object.entries(valid.linkOverrides)) {
    const anchor=elements.find(tag=>tag.attrs['data-cms-link']===id);
    assert.equal(anchor.attrs.href,url,id); assert.equal(anchor.attrs.target,undefined,id); assert.equal(anchor.attrs.rel,undefined,id);
  }
  const hero=elements.find(tag=>tag.attrs['data-cms-link']==='home.hero.cta');
  assert.equal(hero.attrs['data-registration-intent'],undefined);
  assert.doesNotMatch(html.match(/<a\b[^>]*data-cms-link="home.hero.cta"[\s\S]*?<\/a>/)[0],/data-registration-(?:intent|link)|atsidaro naujame lange/);
  content.camps[0].registrationUrl='https://docs.google.com/forms/d/e/example/viewform';
  assert.doesNotMatch(canvas(content).match(/<a\b[^>]*data-cms-link="registration.cta"[\s\S]*?<\/a>/)[0],/data-registration-(?:intent|link)|target="_blank"|atsidaro naujame lange/);
});

test('unsafe unsaved link overrides fall back safely and clearing overrides restores the default site', () => {
  const content=copy(),original=routes.map(route=>renderPage(content,route).html);
  for (const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','//evil.lt/x','https://name:password@example.lt/']) {
    content.linkOverrides={'home.hero.cta':url,'contact.email':url};
    const html=canvas(content);
    const anchor=tokens(html).find(tag=>tag.attrs['data-cms-link']==='home.hero.cta');
    assert.equal(anchor.attrs.href,'#registracija');
    assert.doesNotMatch(html,/href="(?:javascript:|data:|\/\/evil|https:\/\/name:password)/);
  }
  content.linkOverrides={'home.hero.cta':'/kontaktai/'};
  assert.notDeepEqual(routes.map(route=>renderPage(content,route).html),original);
  content.linkOverrides={};
  assert.deepEqual(routes.map(route=>renderPage(content,route).html),original);
});

test('every inside zone inserts valid sibling blocks directly into its existing group', () => {
  const content=copy(),inside=CONTENT_ZONES.filter(zone=>zone.inside);
  assert.ok(inside.length>=15,'inside zones cover the existing page groups');
  const pageFor={home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:CAMP_PATH};
  let next=100;
  for (const zone of inside) {
    const base=tokens(canvas(content,pageFor[zone.page]));
    const group=base.find(tag=>tag.attrs['data-cms-drop-zone']===zone.id);
    assert.ok(group,zone.id);
    const first=base.find(tag=>tag.parents.includes(group)&&zone.partIds.includes(tag.attrs['data-cms-part']));
    content.pageBlocks[zone.page].push(block(next++,'text',zone.id,{beforePart:first?.attrs['data-cms-part']||null,text:`Papildyta ${zone.id}`}));
  }
  const valid=parseContent(content);
  for (const [page,route] of Object.entries(pageFor)) {
    const records=tokens(canvas(valid,route));
    for (const added of valid.pageBlocks[page]) {
      const custom=records.find(tag=>tag.attrs['data-cms-block']===added.id);
      const parent=custom.parents.at(-1);
      assert.equal(parent.attrs['data-cms-drop-zone'],added.zone);
      assert.equal(parent.attrs['data-cms-sort-zone'],inside.find(zone=>zone.id===added.zone).sortZone);
      assert.ok(!custom.parents.some(tag=>['p','a','h1','h2','h3','span','ul','dl','details'].includes(tag.name)),`${added.zone}: added DIVs never nest inside phrasing content or lists`);
      if (added.beforePart) assert.ok(records.indexOf(custom)<records.findIndex(tag=>tag.attrs['data-cms-part']===added.beforePart));
    }
    const desktop=canvas(valid,route,'desktop').replace('data-cms-device="desktop"','');
    const mobile=canvas(valid,route,'mobile').replace('data-cms-device="mobile"','');
    assert.equal(desktop,mobile,'the same group content adapts to screen width');
    const publicHtml=renderPage(valid,route).html;
    for (const added of valid.pageBlocks[page]) assert.ok(publicHtml.includes(added.text));
    assert.doesNotMatch(publicHtml,/data-cms-(?:drop-zone|sort-zone|block)/);
  }
});

test('insertions follow their chosen part through reordering and remain visible after every original part is hidden', () => {
  const content=copy();
  content.pageBlocks.home=[
    block(1,'text','home.introHeading',{beforePart:'home.intro.title',text:'Prieš antraštę'}),
    block(2,'link','home.introHeading',{beforePart:'home.intro.link',text:'Prieš nuorodą',url:'/kontaktai/'}),
    block(3,'image','home.introParagraphs',{source:image,alt:'Vienintelė prisistatymo nuotrauka',beforePart:null})
  ];
  content.partOrder=['home.intro.link','home.intro.title','home.intro.eyebrow'];
  let valid=parseContent(content),elements=tokens(canvas(valid));
  for (const id of [1,2]) {
    const added=valid.pageBlocks.home[id-1];
    const index=elements.findIndex(tag=>tag.attrs['data-cms-block']===added.id);
    const targetIndex=elements.findIndex(tag=>tag.attrs['data-cms-part']===added.beforePart);
    assert.equal(elements[index].parents.at(-1),elements[targetIndex].parents.at(-1),'custom content is a direct sibling of the chosen part');
    assert.ok(index<targetIndex);
  }
  content.hiddenParts=CONTENT_PARTS.filter(part=>part.id.startsWith('home.intro.')).map(part=>part.id);
  content.site.statementImagePosition='left';
  valid=parseContent(content);
  const html=renderPage(valid,'/').html;
  assert.ok(html.includes('Prieš antraštę')); assert.ok(html.includes('Prieš nuorodą')); assert.match(html,/alt="Vienintelė prisistatymo nuotrauka"/);
  assert.doesNotMatch(html,/href="\/apie-mus\/"[^>]*>Apie mus/);
});

const formUrl='https://docs.google.com/forms/d/e/example/viewform';
function authoredRegistration() {
  const content=copy();
  content.hiddenParts=['registration.status'];
  content.copy.registration.pendingText='Užpildyk registracijos anketą ir mes su tavimi susisieksime!';
  content.pageBlocks.home=[block(1,'button','home.registrationStatus',{text:'REGISTRACIJA ČIA',url:formUrl,beforePart:'registration.text'})];
  content.pageBlocks.camp=[block(2,'link','camp.registrationStatus',{text:'REGISTRACIJA ČIA',url:formUrl,beforePart:'registration.cta'})];
  return parseContent(content);
}

test('an authored Google Forms link becomes the single primary registration action without rewriting content',()=>{
  const content=authoredRegistration(),before=structuredClone(content);
  content.camps[0].faq[0].answer='Patvirtintas atsakymas';
  content.camps[0].faq[0].answerWhenOpen='Kitas atsakymas';
  before.camps[0].faq=structuredClone(content.camps[0].faq);
  for (const route of ['/',CAMP_PATH]) {
    const html=canvas(content,route),records=tokens(html);
    const section=records.find(tag=>tag.attrs.id==='registracija');
    const inside=records.filter(tag=>tag.parents.includes(section));
    const primary=inside.filter(tag=>tag.name==='a'&&tag.attrs.class?.split(' ').includes('registration-primary-link'));
    assert.equal(primary.length,1,route); assert.equal(primary[0].attrs.href,formUrl);
    const formAnchors=inside.filter(tag=>tag.name==='a'&&tag.attrs.href===formUrl);
    assert.equal(formAnchors.length,1,'the existing authored form is reused, rather than copied');
    assert.match(html,/REGISTRACIJA ČIA/); assert.ok(html.includes(content.copy.registration.pendingText));
    assert.ok(inside.some(tag=>tag.attrs['data-registration-status']==='open'));
    const support=inside.filter(tag=>tag.name==='a'&&tag.attrs.class?.split(' ').includes('registration-support-link'));
    assert.equal(support.length,2); assert.ok(support.some(tag=>tag.attrs.href.startsWith('mailto:'))); assert.ok(support.some(tag=>tag.attrs.href.startsWith('tel:')));
    assert.ok(support.every(tag=>!tag.attrs.class.split(' ').includes('button')));
    const top=records.find(tag=>tag.attrs['data-cms-link']===(route==='/'?'home.hero.cta':'detail.cta'));
    assert.equal(top.attrs.href,'#registracija','the first action retains registration context on the current page');
    if (route===CAMP_PATH) { assert.ok(html.includes('Patvirtintas atsakymas')); assert.ok(!html.includes('Kitas atsakymas'),'inferring an authored form never switches approved FAQ copy'); }
  }
  assert.deepEqual(content,before,'rendering does not mutate authored text, media or settings');
});

test('configured forms preserve context links and do not duplicate an authored registration button',()=>{
  const content=authoredRegistration(); content.camps[0].registrationUrl=formUrl;
  for (const route of ['/',CAMP_PATH]) {
    const html=renderPage(content,route).html;
    const formAnchors=tokens(html).filter(tag=>tag.name==='a'&&tag.attrs.href===formUrl);
    assert.equal(formAnchors.length,1);
    assert.ok(!html.includes(content.copy.registration.openButton),'no generated duplicate registration label is inserted');
    assert.match(html,/href="#registracija" data-registration-intent/);
  }
  const about=tokens(canvas(content,PAGE_ROUTES.about)).find(tag=>tag.attrs['data-cms-link']==='about.cta');
  assert.equal(about.attrs.href,`${CAMP_PATH}#registracija`);
});

test('a page without its own authored form can reuse the shared invitation once',()=>{
  const content=authoredRegistration(); content.pageBlocks.camp=[];
  const html=canvas(content,CAMP_PATH),anchors=tokens(html).filter(tag=>tag.name==='a'&&tag.attrs.href===formUrl);
  assert.equal(anchors.length,1); assert.match(html,/REGISTRACIJA ČIA/);
  assert.match(anchors[0].attrs.class,/registration-primary-link/);
  assert.doesNotMatch(html,/data-cms-block="00000000000000000000000000000001"/,'a borrowed action is not presented as an editable local block');
});

test('camp navigation uses the canonical page while the detail back action retains the home overview',()=>{
  const content=authoredRegistration();
  for (const route of ['/',PAGE_ROUTES.about,CAMP_PATH]) {
    const records=tokens(canvas(content,route));
    const nav=records.find(tag=>tag.attrs['data-cms-link']==='common.nav.camp');
    assert.equal(nav.attrs.href,CAMP_PATH);
    assert.equal(nav.attrs['aria-current'],route===CAMP_PATH?'page':undefined);
    if(route===CAMP_PATH) assert.equal(records.find(tag=>tag.attrs['data-cms-link']==='detail.back').attrs.href,'/#stovykla');
  }
});

test('hidden camp photo dimensions do not change the visible photo composition',()=>{
  const content=copy(); content.camps[0].secondaryImageHidden=true;
  content.blockLayouts['photo-camps-0-secondaryImage']=dimensions({width:62,height:138});
  const records=tokens(canvas(content));
  assert.ok(records.some(tag=>tag.attrs.class?.split(' ').includes('camp-visual')));
  assert.ok(!records.some(tag=>tag.attrs.class?.split(' ').includes('cms-camp-manual-width')));
  assert.ok(!renderLayoutRules(content).some(rule=>rule.selector==='.cms-page-home .responsive-camp-middle'));
});
