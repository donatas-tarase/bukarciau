import {CONTENT_PARTS, CONTENT_ZONES, BLOCK_TYPES, BLOCK_SIZES, BLOCK_ALIGNMENTS, IMAGE_FIELDS, IMAGE_ASPECT_RATIOS, IMAGE_POSITIONS, THEME_DEFAULTS, DESIGN_FIELDS} from '/admin/schema.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone = value => JSON.parse(JSON.stringify(value));
const mime = 'application/x-bukarciau-editor';
const idPattern = /^[a-f0-9]{32}$/;
const colors = /^#[0-9a-f]{6}$/i;
const options = (values,current) => values.map(option => `<option value="${escape(option.value ?? option.id)}"${(option.value ?? option.id) === current ? ' selected' : ''}>${escape(option.label)}</option>`).join('');
const themeVars = {background:'--cream',surface:'--paper',primary:'--green',text:'--ink',muted:'--muted',accent:'--sage',buttonBackground:'--button-background',buttonText:'--button-text',buttonRadius:'--button-radius',fontFamily:'--font'};
const fontValues = {Montserrat:'Montserrat,Arial,sans-serif',Arial:'Arial,sans-serif',Georgia:'Georgia,serif'};

export function createEditorTools(api) {
  const $ = selector => document.querySelector(selector);
  let selectedPart = null;
  let selectedBlock = null;
  let drag = null;
  let activeSection = null;
  let blockTimer = null;
  let pointer = null;
  let ghost = null;
  let suppressedSource = null;
  let scrollFrame = 0;
  const blocks = (page = api.page()) => api.content().pageBlocks[page];
  const partKey = () => 'hiddenParts';
  const orderKey = () => 'partOrder';
  const zones = () => CONTENT_ZONES.filter(zone => zone.page === api.page());
  const selected = () => blocks().find(block => block.id === selectedBlock);
  const validPayload = payload => payload && payload.page === api.page() && ['palette','block','part','photo'].includes(payload.kind);
  const refresh = () => { api.render(); renderSelection(); renderBlockInspector(); };
  const changed = message => { refresh(); if (message) api.announce(message); };
  const field = (label,key,value,{type='text',help='',nullable=false,min,max}={}) => `<label class="tools-field"><span>${escape(label)}</span>${type === 'textarea' ? `<textarea class="input" rows="4" data-block-field="${key}">${escape(value)}</textarea>` : `<input class="input" type="${type}" data-block-field="${key}" value="${escape(value)}"${min == null ? '' : ` min="${min}"`}${max == null ? '' : ` max="${max}"`}${nullable ? ' data-nullable="true"' : ''}>`}${help ? `<small>${escape(help)}</small>` : ''}</label>`;
  const select = (label,key,value,values) => `<label class="tools-field"><span>${escape(label)}</span><select class="input" data-block-field="${key}">${options(values,value)}</select></label>`;

  function addBlock(type,zone,beforeId = null) {
    if (api.busy() || !BLOCK_TYPES.some(option => option.value === type) || !zones().some(option => option.id === zone)) return;
    if (blocks().length >= 40) return api.notice('Šiame puslapyje jau yra 40 papildomų blokų. Pašalink nereikalingą bloką prieš pridėdamas naują.','warning');
    api.finish();
    const id = crypto.randomUUID().replaceAll('-','');
    const block = {id,type,zone,text:'',url:null,source:null,alt:'',ratio:'auto',size:'normal',align:'left',background:null,color:null};
    api.mutate(() => { const list = blocks(); const before = list.findIndex(item => item.id === beforeId); list.splice(before < 0 ? list.length : before,0,block); });
    selectedBlock = id; selectedPart = null;
    changed('Blokas pridėtas į puslapį.');
    $('#canvas-extra-inspector')?.scrollIntoView({block:'nearest'});
    $('#canvas-extra-inspector textarea, #canvas-extra-inspector input')?.focus();
  }
  function renderPalette() {
    if (!api.content()) return;
    const panel = $('#canvas-palette');
    panel.hidden = api.mode() !== 'edit';
    panel.innerHTML = `<div class="palette-heading"><strong>Pridėti bloką</strong><span>Vilk į puslapį arba pasirink vietą žemiau.</span></div><div class="palette-types">${BLOCK_TYPES.map(type => `<button class="palette-item" type="button" draggable="false" data-palette-type="${type.value}" aria-label="Pridėti: ${type.label}"><span aria-hidden="true">${({text:'T',image:'▧',button:'▰',link:'↗',spacer:'↕'})[type.value]}</span>${type.label}</button>`).join('')}</div><div class="palette-add"><label for="new-block-type">Blokas<select id="new-block-type">${options(BLOCK_TYPES,'text')}</select></label><label for="new-block-zone">Vieta<select id="new-block-zone">${zones().map(zone => `<option value="${zone.id}">${escape(zone.label)}</option>`).join('')}</select></label><button type="button" class="button button-outline" data-add-block>Pridėti</button></div>`;
  }
  function selectPart(element) {
    const part = element?.closest('[data-cms-part]');
    selectedPart = part && CONTENT_PARTS.some(item => item.id === part.dataset.cmsPart) ? part.dataset.cmsPart : null;
    selectedBlock = null;
    renderSelection(); renderBlockInspector();
  }
  function renderSelection() {
    const panel = $('#canvas-part-tools');
    panel.hidden = !selectedPart || api.mode() !== 'edit';
    if (panel.hidden) return;
    const descriptor = CONTENT_PARTS.find(part => part.id === selectedPart);
    panel.innerHTML = `<div><strong>${escape(descriptor?.label || 'Pasirinkta dalis')}</strong><small>Automatiškai pritaikoma kompiuteriui ir telefonui.</small></div><div class="part-actions"><button class="button button-outline" type="button" data-move-part="up" aria-label="Perkelti pasirinktą dalį aukštyn">↑ Aukštyn</button><button class="button button-outline" type="button" data-move-part="down" aria-label="Perkelti pasirinktą dalį žemyn">↓ Žemyn</button><button type="button" class="slot-remove" data-hide-selected-part>Pašalinti šią dalį</button></div>`;
  }
  function hidePart(id) {
    if (api.busy() || !CONTENT_PARTS.some(part => part.id === id)) return;
    api.finish();
    api.mutate(content => { if (!content[partKey()].includes(id)) content[partKey()].push(id); });
    selectedPart = null;
    changed('Dalis pašalinta iš puslapio. Ją gali grąžinti skiltyje „Pašalintos dalys“.');
  }
  function sortParts(fromId,toId,after = false) {
    const doc = api.doc();
    const from = doc?.querySelector(`[data-cms-part="${CSS.escape(fromId)}"]`);
    const to = doc?.querySelector(`[data-cms-part="${CSS.escape(toId)}"]`);
    const zone = from?.closest('[data-cms-sort-zone]');
    if (!from || !to || from === to || !zone || zone !== to.closest('[data-cms-sort-zone]')) return;
    const ids = [...zone.querySelectorAll('[data-cms-part]')].filter(element => element.closest('[data-cms-sort-zone]') === zone).map(element => element.dataset.cmsPart);
    const ordered = ids.filter(id => id !== fromId);
    ordered.splice(ordered.indexOf(toId)+(after ? 1 : 0),0,fromId);
    api.finish();
    api.mutate(content => { content[orderKey()] = [...content[orderKey()].filter(id => !ids.includes(id)),...ordered]; });
    changed('Dalių eiliškumas pakeistas puslapyje.');
  }
  function moveSelectedPart(direction) {
    const doc = api.doc();
    const current = doc?.querySelector(`[data-cms-part="${CSS.escape(selectedPart || '')}"]`);
    const zone = current?.closest('[data-cms-sort-zone]');
    if (!zone) return api.announce('Šios dalies eiliškumas šiame bloke nekeičiamas.');
    const items = [...zone.querySelectorAll('[data-cms-part]')].filter(element => element.closest('[data-cms-sort-zone]') === zone);
    const index = items.indexOf(current);
    const next = items[index+(direction === 'up' ? -1 : 1)];
    if (next) sortParts(selectedPart,next.dataset.cmsPart,direction === 'down');
  }
  function selectBlock(id) {
    if (!blocks().some(block => block.id === id)) return;
    api.clearPhoto();
    api.finish(); selectedBlock = id; selectedPart = null;
    renderSelection(); renderBlockInspector();
    $('#canvas-extra-inspector')?.scrollIntoView({block:'nearest'});
  }
  function renderBlockInspector() {
    const panel = $('#canvas-extra-inspector');
    const block = selected();
    panel.hidden = !block || api.mode() !== 'edit';
    if (panel.hidden) return;
    const type = BLOCK_TYPES.find(item => item.value === block.type)?.label || 'Blokas';
    panel.innerHTML = `<div class="canvas-photo-heading"><div><strong>${escape(type)}</strong><small class="inspector-device">Bendras svetainės turinys</small></div><button class="icon-button" type="button" data-close-block aria-label="Baigti bloko redagavimą">×</button></div><div class="block-settings-grid">${block.type === 'spacer' ? '' : block.type === 'image' ? `<div class="block-image-choice">${block.source ? `<img src="/admin/api/media/${escape(block.source.split('/').at(-1))}" alt="" width="140" height="100">` : '<span>Nuotrauka dar nepasirinkta</span>'}<button type="button" class="button button-outline" data-choose-block-image>${block.source ? 'Pakeisti nuotrauką' : 'Pasirinkti nuotrauką'}</button></div>${field('Nuotraukos aprašymas','alt',block.alt,{help:'Trumpai aprašyk, kas matoma nuotraukoje.'})}${select('Proporcijos','ratio',block.ratio,IMAGE_ASPECT_RATIOS)}` : field(block.type === 'text' ? 'Tekstas' : 'Nuorodos užrašas','text',block.text,{type:block.type === 'text' ? 'textarea' : 'text'})}${['button','link'].includes(block.type) ? field('Nuoroda','url',block.url || '',{type:'url',nullable:true,help:'Pilnas adresas su https://. Mygtukas bus rodomas užpildžius nuorodą.'}) : ''}${select('Vieta puslapyje','zone',block.zone,zones())}${select('Dydis','size',block.size,BLOCK_SIZES)}${select('Lygiavimas','align',block.align,BLOCK_ALIGNMENTS)}${field('Fono spalva (nebūtina)','background',block.background || '',{nullable:true,help:'Pvz. #ffffff. Tuščias laukas išlaiko puslapio foną.'})}${field('Teksto spalva (nebūtina)','color',block.color || '',{nullable:true,help:'Pvz. #173e2c.'})}</div><div class="canvas-photo-actions"><button class="button button-outline" type="button" data-move-block="up">↑ Aukštyn</button><button class="button button-outline" type="button" data-move-block="down">↓ Žemyn</button><button type="button" class="slot-remove" data-delete-block>Pašalinti bloką</button></div>`;
  }
  function changeBlock(key,value) {
    const block = selected();
    if (!block || api.busy()) return;
    if (!['text','url','alt','ratio','size','align','background','color','zone'].includes(key)) return;
    if (['url','background','color'].includes(key)) value = value.trim() || null;
    api.mutate(() => { block[key] = value; });
    clearTimeout(blockTimer);
    blockTimer = setTimeout(() => api.render(),180);
  }
  function moveBlock(id,zone,beforeId = null) {
    if (!zones().some(item => item.id === zone)) return;
    const block = blocks().find(item => item.id === id);
    if (!block || id === beforeId) return;
    api.mutate(() => { const list = blocks(); list.splice(list.indexOf(block),1); block.zone = zone; const before = list.findIndex(item => item.id === beforeId); list.splice(before < 0 ? list.length : before,0,block); });
    changed('Blokas perkeltas puslapyje.');
  }
  function blockImage(id,source,page = api.page()) {
    const list = api.content().pageBlocks[page];
    const block = list?.find(item => item.id === id);
    if (!block) return;
    api.mutate(() => { if (block.source !== source) block.alt = ''; block.source = source; });
    if (api.page() === page) { selectedBlock = id; selectedPart = null; changed(); $('#canvas-extra-inspector [data-block-field="alt"]')?.focus(); }
  }
  function theme() { return api.content().design || THEME_DEFAULTS; }
  function updateTheme(key,value) {
    const descriptor = DESIGN_FIELDS.find(field => field.key === key);
    if (!descriptor || api.busy()) return;
    if (descriptor.type === 'color' && !colors.test(value)) return;
    if (descriptor.type === 'number') { value = Number(value); if (!Number.isFinite(value) || value < descriptor.min || value > descriptor.max) return; }
    if (descriptor.type === 'select' && !descriptor.options.some(option => option.value === value)) return;
    api.mutate(content => { if (!content.design) content.design = clone(THEME_DEFAULTS); content.design[key] = value; });
    applyStyles(api.doc());
    const pair = document.querySelector(`[data-theme-hex="${CSS.escape(key)}"]`); if (pair) pair.value = value;
    const color = document.querySelector(`[data-theme-key="${CSS.escape(key)}"][type="color"]`); if (color) color.value = value;
  }
  function renderDesign() {
    const current = theme();
    return `<div class="help-panel">Spalvos ir šriftas taikomi visai svetainei. Maketas automatiškai prisitaiko prie ekrano pločio.</div><section class="form-card"><div class="card-heading"><h2>Spalvos ir šriftas</h2></div><div class="design-grid">${DESIGN_FIELDS.map(field => `<label class="tools-field"><span>${escape(field.label)}</span>${field.type === 'color' ? `<div class="color-control"><input type="color" data-theme-key="${field.key}" value="${current[field.key]}" aria-label="${escape(field.label)}"><input class="input" type="text" data-theme-hex="${field.key}" value="${current[field.key]}" maxlength="7" aria-label="${escape(field.label)}: HEX kodas" spellcheck="false"></div>` : field.type === 'select' ? `<select class="input" data-theme-key="${field.key}">${options(field.options,current[field.key])}</select>` : `<input class="input" type="number" min="${field.min}" max="${field.max}" data-theme-key="${field.key}" value="${current[field.key]}">`}</label>`).join('')}</div><button type="button" class="button button-outline" data-reset-theme>Grąžinti pradinį dizainą</button></section>`;
  }
  function renderRemoved() {
    const ids = api.content()[partKey()];
    const hiddenPhotos = IMAGE_FIELDS.filter(slot => api.imageSettings(slot.path).hidden);
    const rows = ids.map(id => ({id,label:CONTENT_PARTS.find(part => part.id === id)?.label || id,photo:false})).concat(hiddenPhotos.map(slot => ({id:slot.path,label:slot.label,photo:true})));
    return `<div class="help-panel">Pašalintos svetainės dalys. Grąžinus tekstas ir nuotraukos išliks.</div>${rows.length ? `<div class="history-list">${rows.map(row => `<div class="history-item"><div class="history-content"><strong>${escape(row.label)}</strong></div><button class="button button-outline" type="button" ${row.photo ? 'data-restore-photo' : 'data-restore-part'}="${escape(row.id)}">Grąžinti</button></div>`).join('')}</div>` : '<div class="library-empty"><h3>Pašalintų dalių nėra</h3><p>Pasirink tekstą puslapyje ir spausk „Pašalinti šią dalį“, jei norėsi jį paslėpti.</p></div>'}`;
  }
  function renderSection(section) {
    activeSection = section;
    $('#tools-section').innerHTML = section === 'Dizainas' ? renderDesign() : renderRemoved();
  }
  function applyStyles(doc) {
    if (!doc?.documentElement || !api.content()) return;
    const current = theme();
    for (const [key,variable] of Object.entries(themeVars)) {
      const value = key === 'fontFamily' ? fontValues[current[key]] : key === 'buttonRadius' ? `${current[key]}px` : current[key];
      if (value) doc.documentElement.style.setProperty(variable,value);
    }
    doc.body.classList.toggle('cms-themed',Boolean(api.content().design));
    for (const block of blocks()) {
      const element = doc.querySelector(`[data-cms-block="${block.id}"],.cms-block-${block.id}`);
      if (!element) continue;
      element.style.setProperty('background-color',block.background && colors.test(block.background) ? block.background : 'transparent');
      element.style.setProperty('color',block.color && colors.test(block.color) ? block.color : 'inherit');
      element.style.setProperty('--block-color',block.color && colors.test(block.color) ? block.color : 'var(--button-text,#fff)');
    }
  }
  function endDrag() {
    cancelAnimationFrame(scrollFrame); scrollFrame = 0;
    drag = null;
    const doc = api.doc();
    doc?.documentElement.removeAttribute('data-cms-dragging');
    doc?.body.classList.remove('cms-dragging-image');
    doc?.querySelectorAll('[data-cms-image-zones]').forEach(element => { element.hidden = false; });
    doc?.querySelectorAll('.cms-drop-active,.cms-part-drop-active').forEach(element => element.classList.remove('cms-drop-active','cms-part-drop-active'));
  }
  function beginDrag(event,payload) {
    if (api.busy() || api.mode() !== 'edit') { event.preventDefault(); return; }
    api.finish();
    drag = {...payload,device:api.device(),page:api.page()};
    if (event.dataTransfer) { event.dataTransfer.setData(mime,JSON.stringify(drag)); event.dataTransfer.effectAllowed = payload.kind === 'palette' ? 'copy' : 'move'; }
    api.doc()?.documentElement.setAttribute('data-cms-dragging',payload.kind);
    api.doc()?.body.classList.toggle('cms-dragging-image',payload.kind === 'photo');
    if (payload.kind === 'photo') api.doc()?.querySelectorAll('[data-cms-image-zones]').forEach(element => { element.hidden = element.dataset.cmsImageZones !== payload.id; });
  }
  function payloadFor(event) {
    if (drag) return drag;
    try { const payload = JSON.parse(event.dataTransfer.getData(mime)); return validPayload(payload) ? payload : null; } catch { return null; }
  }
  function targetFor(event,payload) {
    const target = event.target.closest?.('[data-cms-image-drop],[data-cms-block],[data-cms-drop-zone],[data-cms-part]');
    if (!payload) return null;
    if (payload.kind === 'photo') return target?.closest('[data-cms-image-drop]');
    if (payload.kind === 'part') { const part = event.target.closest('[data-cms-part]'); const from = api.doc()?.querySelector(`[data-cms-part="${CSS.escape(payload.id)}"]`); return part && from?.closest('[data-cms-sort-zone]') === part.closest('[data-cms-sort-zone]') ? part : null; }
    const direct = target?.closest('[data-cms-block]') || target?.closest('[data-cms-drop-zone]');
    if (direct) return direct;
    if (!event.target.closest?.('main')) return null;
    return [...api.doc().querySelectorAll('[data-cms-drop-zone]')].filter(element => zones().some(zone => zone.id === element.dataset.cmsDropZone)).sort((a,b) => Math.abs(a.getBoundingClientRect().top-event.clientY)-Math.abs(b.getBoundingClientRect().top-event.clientY))[0] || null;
  }
  function applyDrop(payload,target,clientY,clientX) {
    if (!validPayload(payload) || !target) return;
    if (payload.kind === 'part') {
      const rect = target.getBoundingClientRect();
      let layout = target.closest('[data-cms-sort-zone]');
      let style = layout && layout.ownerDocument.defaultView.getComputedStyle(layout);
      while (layout?.parentElement && style?.display === 'contents') {
        layout = layout.parentElement;
        style = layout.ownerDocument.defaultView.getComputedStyle(layout);
      }
      let after = clientY > rect.top+rect.height/2;
      if (Number.isFinite(clientX) && style?.display.includes('flex') && ['row','row-reverse'].includes(style.flexDirection)) {
        after = clientX > rect.left+rect.width/2;
        if (style.flexDirection === 'row-reverse') after = !after;
      }
      sortParts(payload.id,target.dataset.cmsPart,after);
    }
    else if (payload.kind === 'photo') {
      if (target.dataset.cmsImageDrop === payload.id && IMAGE_POSITIONS.some(position => position.value === target.dataset.cmsPosition)) { api.setImage(payload.id,'position',target.dataset.cmsPosition); api.editPhoto(payload.id); changed('Nuotraukos vieta pakeista puslapyje.'); }
      else api.announce('Nuotrauką vilk į tos pačios nuotraukos pažymėtą vietą.');
    } else {
      const zone = target.dataset.cmsBlockZone || target.dataset.cmsDropZone;
      if (payload.kind === 'palette') addBlock(payload.type,zone,target.dataset.cmsBlock || null);
      else moveBlock(payload.id,zone,target.dataset.cmsBlock || null);
    }
  }
  function pointerPoint(event,source) {
    if (source.ownerDocument === document) return {x:event.clientX,y:event.clientY};
    const frame = $('#preview-frame'), rect = frame.getBoundingClientRect();
    return {x:rect.left+event.clientX*rect.width/frame.contentWindow.innerWidth,y:rect.top+event.clientY*rect.height/frame.contentWindow.innerHeight};
  }
  function pointerHit(point,payload) {
    const frame = $('#preview-frame'), rect = frame.getBoundingClientRect();
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return null;
    const x = (point.x-rect.left)*frame.contentWindow.innerWidth/rect.width;
    const y = (point.y-rect.top)*frame.contentWindow.innerHeight/rect.height;
    const element = api.doc()?.elementFromPoint(x,y);
    const target = element && targetFor({target:element,clientX:x,clientY:y},payload);
    return target ? {target,x,y} : null;
  }
  function updatePointerHit(point) {
    if (!pointer?.active) return;
    pointer.hit = pointerHit(point,drag);
    api.doc()?.querySelectorAll('.cms-drop-active').forEach(element => element.classList.remove('cms-drop-active'));
    pointer.hit?.target.classList.add('cms-drop-active');
    if (ghost) { ghost.textContent = pointer.hit ? 'Paleisk čia' : 'Vilk į puslapį'; ghost.classList.toggle('is-valid',Boolean(pointer.hit)); ghost.style.left = `${point.x+15}px`; ghost.style.top = `${point.y+15}px`; }
  }
  function scrollDuringDrag() {
    if (!pointer?.active) return;
    const frame = $('#preview-frame'), rect = frame.getBoundingClientRect(), point = pointer.point;
    if (point && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
      const edge = Math.min(45,rect.height/5);
      const delta = point.y < rect.top+edge ? -18 : point.y > rect.bottom-edge ? 18 : 0;
      if (delta) { frame.contentWindow.scrollBy(0,delta); updatePointerHit(point); }
    }
    scrollFrame = requestAnimationFrame(scrollDuringDrag);
  }
  function bindPointer(doc) {
    doc.addEventListener('pointerdown',event => {
      if (pointer || event.button !== 0 || api.busy() || api.mode() !== 'edit') return;
      const source = event.target.closest?.('[data-palette-type],[data-editor-drag-part],[data-editor-drag-photo],[data-editor-drag-block]');
      if (!source) return;
      clearTimeout(blockTimer);
      api.finish();
      const payload = source.dataset.paletteType ? {kind:'palette',type:source.dataset.paletteType} : source.dataset.editorDragPart ? {kind:'part',id:source.dataset.editorDragPart} : source.dataset.editorDragPhoto ? {kind:'photo',id:source.dataset.editorDragPhoto} : {kind:'block',id:source.dataset.editorDragBlock};
      const point = pointerPoint(event,source);
      pointer = {source,payload,pointerId:event.pointerId,start:point,point,active:false,hit:null};
      try { source.setPointerCapture(event.pointerId); } catch {}
    });
    doc.addEventListener('pointermove',event => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      const point = pointerPoint(event,pointer.source);
      pointer.point = point;
      if (!pointer.active && Math.hypot(point.x-pointer.start.x,point.y-pointer.start.y) < 7) return;
      if (!pointer.active) {
        pointer.active = true; beginDrag(event,pointer.payload);
        ghost = document.createElement('div'); ghost.className = 'cms-pointer-ghost'; ghost.setAttribute('aria-hidden','true'); document.body.append(ghost);
        scrollFrame = requestAnimationFrame(scrollDuringDrag);
      }
      event.preventDefault();
      updatePointerHit(point);
    },{passive:false});
    const finish = (event,cancel = false) => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      const current = pointer; pointer = null;
      const point = pointerPoint(event,current.source);
      const hit = current.active ? pointerHit(point,drag) : null;
      const payload = drag;
      if (current.active) { event.preventDefault(); suppressedSource = current.source; setTimeout(() => { suppressedSource = null; },500); }
      try { current.source.releasePointerCapture(current.pointerId); } catch {}
      ghost?.remove(); ghost = null; endDrag();
      if (!cancel && current.active && hit) applyDrop(payload,hit.target,hit.y,hit.x);
    };
    doc.addEventListener('pointerup',event => finish(event),{passive:false});
    doc.addEventListener('pointercancel',event => finish(event,true),{passive:false});
    doc.addEventListener('lostpointercapture',event => finish(event,true));
    doc.addEventListener('click',event => { if (suppressedSource && (event.target === suppressedSource || suppressedSource.contains(event.target))) { event.preventDefault(); event.stopImmediatePropagation(); } },true);
  }
  function bindCanvas(doc) {
    applyStyles(doc);
    if (!$('#canvas-palette').contains(document.activeElement)) renderPalette();
    if (!$('#canvas-part-tools').contains(document.activeElement)) renderSelection();
    if (!$('#canvas-extra-inspector').contains(document.activeElement)) renderBlockInspector();
    if (api.mode() !== 'edit') return;
    doc.querySelectorAll('[data-cms-part]').forEach(element => {
      if (!element.closest('[data-cms-sort-zone]')) return;
      const handle = doc.createElement('button'); handle.type = 'button'; handle.className = 'cms-editor-drag-handle'; handle.draggable = false;
      handle.dataset.editorDragPart = element.dataset.cmsPart; handle.textContent = '⠿'; handle.setAttribute('aria-label','Vilk, kad pakeistum eiliškumą'); handle.title = 'Vilk, kad pakeistum eiliškumą'; element.append(handle);
    });
    doc.querySelectorAll('[data-cms-image]').forEach(element => {
      const handle = doc.createElement('button'); handle.type = 'button'; handle.className = 'cms-editor-photo-handle'; handle.draggable = false;
      handle.dataset.editorDragPhoto = element.dataset.cmsImage; handle.textContent = '⠿'; handle.setAttribute('aria-label','Vilk nuotrauką į kitą vietą'); element.append(handle);
    });
    doc.querySelectorAll('[data-cms-block]').forEach(element => {
      const handle = doc.createElement('button'); handle.type = 'button'; handle.className = 'cms-editor-block-handle'; handle.draggable = false;
      handle.dataset.editorDragBlock = element.dataset.cmsBlock; handle.textContent = '⠿'; handle.setAttribute('aria-label','Vilk papildomą bloką'); element.prepend(handle);
      element.tabIndex = 0;
    });
    bindPointer(doc);
    doc.addEventListener('dragstart',event => {
      event.preventDefault(); event.stopPropagation();
    },true);
    doc.addEventListener('dragover',event => {
      if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); return; }
      const payload = payloadFor(event); if (!validPayload(payload)) return;
      const target = targetFor(event,payload); if (!target) return;
      event.preventDefault(); event.dataTransfer.dropEffect = payload.kind === 'palette' ? 'copy' : 'move';
      doc.querySelectorAll('.cms-drop-active').forEach(element => element.classList.remove('cms-drop-active'));
      target.classList.add('cms-drop-active');
    });
    doc.addEventListener('dragleave',event => { if (event.target?.classList) event.target.classList.remove('cms-drop-active'); });
    doc.addEventListener('drop',event => {
      if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); event.stopImmediatePropagation(); api.announce('Nuotrauką įkelk per nuotraukų biblioteką.'); return; }
      const payload = payloadFor(event); if (!validPayload(payload)) return;
      const target = targetFor(event,payload); if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      applyDrop(payload,target,event.clientY,event.clientX);
      endDrag();
    });
    doc.addEventListener('dragend',endDrag);
    doc.addEventListener('keydown',event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const block = event.target.closest('[data-cms-block]');
      if (block && event.target === block) { event.preventDefault(); event.stopImmediatePropagation(); selectBlock(block.dataset.cmsBlock); }
    },true);
  }
  function handleCanvasClick(event) {
    if (api.mode() !== 'edit') return false;
    const handle = event.target.closest('[data-editor-drag-part],[data-editor-drag-photo],[data-editor-drag-block]');
    if (handle) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (handle.dataset.editorDragPart) { selectedPart = handle.dataset.editorDragPart; selectedBlock = null; renderSelection(); renderBlockInspector(); }
      else if (handle.dataset.editorDragPhoto) api.editPhoto(handle.dataset.editorDragPhoto);
      else selectBlock(handle.dataset.editorDragBlock);
      return true;
    }
    const block = event.target.closest('[data-cms-block]');
    if (block) { event.preventDefault(); event.stopImmediatePropagation(); selectBlock(block.dataset.cmsBlock); return true; }
    const drop = event.target.closest('[data-cms-image-drop]');
    if (drop && IMAGE_POSITIONS.some(position => position.value === drop.dataset.cmsPosition)) { event.preventDefault(); event.stopImmediatePropagation(); api.setImage(drop.dataset.cmsImageDrop,'position',drop.dataset.cmsPosition); changed('Nuotraukos vieta pakeista.'); return true; }
    const part = event.target.closest('[data-cms-part]');
    if (part) selectPart(part);
    return false;
  }
  function focusIssue(path,message) {
    const match = /^pageBlocks\.(home|about|contact|camp)\.(\d+)\.([a-zA-Z]+)$/.exec(path);
    let input = null;
    if (match) {
      const block = api.content().pageBlocks[match[1]]?.[Number(match[2])];
      if (!block) return false;
      api.openPage(match[1]); selectedBlock = block.id; selectedPart = null;
      renderSelection(); renderBlockInspector();
      input = document.querySelector(`[data-block-field="${CSS.escape(match[3])}"]`);
    } else if (path.startsWith('design.')) {
      api.selectSection('Dizainas');
      input = document.querySelector(`[data-theme-key="${CSS.escape(path.slice(7))}"],[data-theme-hex="${CSS.escape(path.slice(7))}"]`);
    }
    if (!input) return false;
    input.setAttribute('aria-invalid','true');
    const error = document.createElement('small'); error.className = 'field-error'; error.textContent = message || 'Patikrink šį lauką.';
    input.closest('label')?.append(error);
    input.focus(); return true;
  }
  bindPointer(document);
  document.addEventListener('dragstart',event => { if (event.target.closest('[data-palette-type]')) event.preventDefault(); });
  document.addEventListener('dragend',endDrag);
  document.addEventListener('click',event => {
    const target = event.target.closest('button'); if (!target || !api.content() || api.busy()) return;
    if (target.hasAttribute('data-add-block')) addBlock($('#new-block-type').value,$('#new-block-zone').value);
    if (target.dataset.paletteType) { $('#new-block-type').value = target.dataset.paletteType; $('#new-block-zone').focus(); api.announce('Pasirink vietą ir spausk „Pridėti“ arba vilk bloką į puslapį.'); }
    if (target.hasAttribute('data-hide-selected-part')) hidePart(selectedPart);
    if (target.dataset.movePart) moveSelectedPart(target.dataset.movePart);
    if (target.dataset.restorePart) { api.mutate(content => { content[partKey()] = content[partKey()].filter(id => id !== target.dataset.restorePart); }); renderSection('Pašalintos dalys'); api.announce('Dalis grąžinta į puslapį.'); }
    if (target.dataset.restorePhoto) { api.setImage(target.dataset.restorePhoto,'hidden',false); renderSection('Pašalintos dalys'); }
    if (target.hasAttribute('data-close-block')) { selectedBlock = null; renderBlockInspector(); }
    if (target.hasAttribute('data-choose-block-image')) { const block = selected(); if (block) api.chooseImage({kind:'block',blockId:block.id,page:api.page(),device:api.device(),label:'Papildomo bloko nuotrauka'}); }
    if (target.hasAttribute('data-delete-block')) { const block = selected(); if (block) { api.mutate(() => blocks().splice(blocks().indexOf(block),1)); selectedBlock = null; changed('Papildomas blokas pašalintas.'); } }
    if (target.dataset.moveBlock) { const block = selected(); const list = blocks().filter(item => item.zone === block?.zone); const index = list.indexOf(block); const next = list[index+(target.dataset.moveBlock === 'up' ? -1 : 1)]; if (block && next) { if (target.dataset.moveBlock === 'up') moveBlock(block.id,block.zone,next.id); else { const following = list[index+2]; moveBlock(block.id,block.zone,following?.id || null); } } }
    if (target.hasAttribute('data-reset-theme')) { api.mutate(content => { content.design = null; }); renderSection('Dizainas'); api.render(); api.announce('Pradinis svetainės dizainas grąžintas.'); }
  });
  document.addEventListener('input',event => {
    const input = event.target;
    if (!api.content()) return;
    if (input.dataset.blockField) changeBlock(input.dataset.blockField,input.value);
    if (input.dataset.themeKey) updateTheme(input.dataset.themeKey,input.value);
    if (input.dataset.themeHex) { const valid = colors.test(input.value); input.setAttribute('aria-invalid',String(!valid)); if (valid) updateTheme(input.dataset.themeHex,input.value); }
  });
  return {renderPalette,renderSection,selectPart,bindCanvas,handleCanvasClick,blockImage,applyStyles,focusIssue,clearSelection() { selectedPart = null; selectedBlock = null; renderSelection(); renderBlockInspector(); },isMediaUsed(src) { return Object.values(api.content().pageBlocks).some(list => list.some(block => block.source === src)); }};
}
