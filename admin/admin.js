import {CONTENT_FIELDS, IMAGE_FIELDS, IMAGE_ASPECT_RATIOS, IMAGE_POSITIONS, getImageSettings, getImageReferences, getPath as rawGetPath, parseContent} from '/admin/schema.mjs';
import {renderPage} from '/admin/render.mjs';
import {createEditorTools} from '/admin/editor-tools.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const clone = value => JSON.parse(JSON.stringify(value));
const idFor = path => `field-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
const groupOrder = ['Pagrindinis puslapis','Stovykla','Apie mus','Kontaktai','Registracija','Meniu ir poraštė','Paieška ir dalijimasis'];
const groups = [...new Set(CONTENT_FIELDS.map(field => field.group))].sort((a,b) => (groupOrder.indexOf(a) < 0 ? 99 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) < 0 ? 99 : groupOrder.indexOf(b)));
const descriptions = {
  'Redaguoti puslapyje':'Paspausk norimą tekstą arba nuotrauką ir keisk tiesiai svetainėje.',
  'Pagrindinis puslapis':'Pirmas įspūdis, prisistatymas ir kvietimas į stovyklą.',
  'Stovykla':'Vienos stovyklos informacija, programa ir atsakymai į klausimus.',
  'Apie mus':'Organizatorių prisistatymas ir jų istorija.',
  'Kontaktai':'Kontaktiniai duomenys ir susisiekimo skilties tekstai.',
  'Registracija':'Registracijos nuoroda ir tekstai, kuriuos matys lankytojos.',
  'Meniu ir poraštė':'Pasikartojantys svetainės užrašai ir mygtukai.',
  'Paieška ir dalijimasis':'Puslapių antraštės ir aprašymai paieškai bei nuorodų dalijimuisi.',
  'Nuotraukos':'Įkelk nuotraukas ir parink, kurioje svetainės vietoje jas rodyti.',
  'Dizainas':'Bendros svetainės spalvos, šriftas ir mygtukai.',
  'Pašalintos dalys':'Grąžink pašalintus tekstus, nuorodas ar nuotraukas.',
  'Versijų istorija':'Ankstesni išsaugoti pakeitimai. Atkurta versija pirmiausia tampa juodraščiu.'
};
const iconPaths = [
  '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  '<path d="m3 20 9-16 9 16H3Zm9-16v16m-5-5h10"/>',
  '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-2a6 6 0 0 1 12 0v2m1-7a5 5 0 0 1 7 5v2"/>',
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  '<path d="M8 3H4v18h16V3h-4M8 3h8v4H8Zm0 10h8m-8 4h5"/>',
  '<path d="M4 6h16M4 12h11M4 18h16"/>',
  '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 5 5 3-3 4 4"/>',
  '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2"/>'
];
const icon = index => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[index] || iconPaths[5]}</svg>`;
let state = null;
let content = null;
let baseline = '';
const visualSection = 'Redaguoti puslapyje';
let section = visualSection;
let dirty = false;
let busy = false;
let media = [];
let mediaLoaded = false;
let versions = [];
let activeSlot = null;
let uploadBusy = false;
let confirmResolve = null;
let canvasMode = 'edit';
let canvasDevice = window.matchMedia('(max-width: 680px)').matches ? 'mobile' : 'desktop';
let canvasEditing = null;
let canvasPhoto = null;
let canvasRenderTimer = null;
let canvasScroll = {x:0,y:0};
let canvasScrollReset = false;
let canvasAssets = {styles:'/styles.css',script:'/app.js'};

function rawSet(path, value) {
  const parts = path.split('.');
  if (parts.some(part => ['__proto__','prototype','constructor'].includes(part))) return;
  let target = content;
  for (let i = 0; i < parts.length - 1; i++) { if (target[parts[i]] == null) target[parts[i]] = /^\d+$/.test(parts[i+1]) ? [] : {}; target = target[parts[i]]; }
  target[parts.at(-1)] = value;
}
function imageFieldFor(path) {
  const keys = {path:'source',altPath:'alt',ratioPath:'ratio',hiddenPath:'hidden',positionPath:'position'};
  for (const slot of IMAGE_FIELDS) for (const [property,key] of Object.entries(keys)) if (slot[property] === path) return {slot,key};
  return null;
}
function getPath(object,path) { return rawGetPath(object,path); }
function setImageSetting(slot,key,value) {
  const property = {source:'path',alt:'altPath',ratio:'ratioPath',hidden:'hiddenPath',position:'positionPath'}[key];
  rawSet(slot[property],value);
  updateDirty();
}
function setValue(path, value) {
  const image = imageFieldFor(path);
  if (image) { setImageSetting(image.slot,image.key,value); return; }
  rawSet(path,value);
  updateDirty();
}

const editorTools = createEditorTools({
  content:() => content,device:() => canvasDevice,page:() => ({'/':'home','/apie-mus/':'about','/kontaktai/':'contact','/stovyklos/stovykla-01/':'camp'}[$('#preview-route').value] || 'home'),
  mode:() => canvasMode,busy:() => busy,doc:() => $('#preview-frame').contentDocument,
  mutate:callback => { callback(content); updateDirty(); },render:() => renderCanvas(),refresh:() => renderSection(),
  announce,notice,finish:() => { clearTimeout(canvasRenderTimer); finishCanvasEditing(); },chooseImage:target => openMediaPicker(target),
  setImage:(path,key,value) => { const slot = IMAGE_FIELDS.find(item => item.path === path); if (slot) setImageSetting(slot,key,value); },
  imageSettings:path => getImageSettings(content,path,canvasDevice),editPhoto:editCanvasPhoto,
  clearPhoto:() => { canvasPhoto = null; renderCanvasPhotoInspector(); },
  selectSection,
  openPage:page => { const route = {home:'/',about:'/apie-mus/',contact:'/kontaktai/',camp:'/stovyklos/stovykla-01/'}[page]; if (route) { $('#preview-route').value = route; section = visualSection; canvasScrollReset = true; renderSection(); } }
});

function announce(message) { $('#live-status').textContent = message; }
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('lt-LT',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Vilnius'}).format(date);
}
function byteLabel(size) { return size >= 1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.max(1,Math.round(size/1024))} KB`; }
function notice(message, kind = 'success', action = '') {
  const area = $('#notice');
  area.className = `notice${kind === 'error' ? ' notice-error' : kind === 'warning' ? ' notice-warning' : ''}`;
  area.innerHTML = `<div class="notice-content"><p>${escape(message)}</p>${action}</div><button class="icon-button" type="button" data-dismiss-notice aria-label="Uždaryti pranešimą">×</button>`;
  area.hidden = false;
  area.setAttribute('role',kind === 'error' ? 'alert' : 'status');
  announce(message);
}
function clearNotice() { $('#notice').hidden = true; }
class ApiError extends Error {
  constructor(message, status, detail = {}) { super(message); this.status = status; this.detail = detail; }
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept','application/json');
  headers.set('X-Requested-With','XMLHttpRequest');
  if (options.method && options.method !== 'GET') headers.set('X-CMS-Request','1');
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type','application/json');
    options.body = JSON.stringify(options.body);
  }
  let response;
  try { response = await fetch(`/admin/api/${path}`,{...options,headers,credentials:'same-origin',cache:'no-store'}); }
  catch { throw new ApiError('Nepavyko susisiekti su serveriu. Patikrink interneto ryšį ir bandyk dar kartą.',0); }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError(response.status === 401 || response.status === 403 ? 'Prisijungimo sesija baigėsi arba šiai paskyrai nesuteikta prieiga.' : 'Serveris pateikė netikėtą atsakymą. Pakeitimai liko šiame lange.',response.status); }
  if (!response.ok) throw new ApiError(data.error?.message || 'Veiksmo atlikti nepavyko. Bandyk dar kartą.',response.status,data.error || {});
  return data;
}
function handleError(error) {
  const reauthenticate = error.status === 401 || error.status === 403;
  const conflict = error.status === 409;
  const action = reauthenticate ? '<a href="/admin/">Prisijungti iš naujo</a>' : conflict ? '<button type="button" class="notice-link" data-reload-state>Įkelti naujausią versiją</button>' : '';
  const issues = error.issues || error.detail?.issues;
  if (Array.isArray(issues) && issues.length) {
    const path = Array.isArray(issues[0].path) ? issues[0].path.join('.') : String(issues[0].path || '').replace(/^content\./,'');
    if (editorTools.focusIssue(path,issues[0].message)) { notice(error.message || 'Patikrink pažymėtą lauką.','error',action); return; }
    const descriptor = CONTENT_FIELDS.find(field => path === field.path || path.startsWith(`${field.path}.`));
    const image = IMAGE_FIELDS.find(field => path === field.path || path === field.altPath || path === field.ratioPath || path === field.hiddenPath);
    const nextSection = image ? 'Nuotraukos' : descriptor?.group;
    if (nextSection && nextSection !== section) { section = nextSection; renderSection(); if (nextSection === 'Nuotraukos') loadMedia().catch(handleError); }
    showIssues(issues);
  }
  notice(error.message || 'Veiksmo atlikti nepavyko.', 'error', action);
}
function showIssues(issues) {
  document.querySelectorAll('.field-error').forEach(element => element.remove());
  document.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
  let first = null;
  for (const issue of issues) {
    const path = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || '');
    const field = [...document.querySelectorAll(`[data-field-path="${CSS.escape(path.replace(/^content\./,''))}"]`)].find(element => element.getClientRects().length > 0);
    if (!field) continue;
    const input = field.querySelector('input,textarea,select');
    if (input) input.setAttribute('aria-invalid','true');
    const paragraph = document.createElement('p');
    paragraph.className = 'field-error';
    paragraph.textContent = issue.message || 'Patikrink šį lauką.';
    field.append(paragraph);
    first ||= input;
  }
  first?.focus();
}
function updateDirty() {
  dirty = content !== null && JSON.stringify(content) !== baseline;
  updateStatus();
}
function updateStatus() {
  if (!state) return;
  $('#editor-form').inert = busy;
  $('#media-section').inert = busy;
  $('#history-section').inert = busy;
  $('#tools-section').inert = busy;
  $('#canvas-section').inert = busy;
  $('#main').setAttribute('aria-busy',String(busy));
  document.querySelectorAll('[data-section]').forEach(button => { button.disabled = busy; });
  const unpublished = state.revision !== state.publishedRevision;
  $('#save-status-title').textContent = busy ? 'Vykdomas veiksmas...' : dirty ? 'Neišsaugoti pakeitimai' : unpublished ? 'Juodraštis paruoštas' : 'Pakeitimai paskelbti';
  $('#save-status-detail').textContent = dirty ? 'Pirmiausia išsaugok juodraštį.' : unpublished ? 'Svetainėje atsiras paspaudus „Paskelbti pakeitimus“.' : `Išsaugota${state.updatedAt ? ` ${dateLabel(state.updatedAt)}` : ''}.`;
  $('#save-indicator').classList.toggle('is-dirty',dirty || unpublished);
  $('#save-indicator').classList.toggle('is-busy',busy);
  $('#save-draft').disabled = busy || !dirty;
  $('#publish').disabled = busy || dirty || !unpublished;
  $('#publish').title = dirty ? 'Pirmiausia išsaugok juodraštį.' : !unpublished ? 'Visi išsaugoti pakeitimai jau paskelbti.' : '';
  $('#preview-note').textContent = 'Pakeitimai matomi iškart. Svetainės lankytojai juos matys tik paskelbus.';
  $('#preview-note').classList.toggle('is-stale',dirty);
  $('#canvas-draft-status').textContent = dirty ? 'Neišsaugoti pakeitimai' : unpublished ? 'Nepaskelbtas juodraštis' : 'Paskelbta versija';
  $('#canvas-draft-status').classList.toggle('is-dirty',dirty);
}
function applyState(next) {
  state = next;
  content = parseContent(next.content);
  baseline = JSON.stringify(content);
  dirty = false;
  $('#identity-email').textContent = next.identity?.email || 'Prieiga patvirtinta';
  $('.avatar').textContent = (next.identity?.email || 'A').slice(0,1).toUpperCase();
  $('#loading-state').hidden = true;
  $('#save-bar').hidden = false;
  renderSection();
  updateStatus();
}

function renderNavigation() {
  $('#section-nav').innerHTML = `<button type="button" class="nav-item nav-item-visual" data-section="${visualSection}"${section === visualSection ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 8v13m4-5 5-5 2 2-5 5h-2Z"/></svg><span>${visualSection}</span></button><div class="nav-divider" aria-hidden="true"></div>` + groups.map((group,index) => `<button type="button" class="nav-item" data-section="${escape(group)}"${section === group ? ' aria-current="page"' : ''}>${icon(index)}<span>${escape(group)}</span></button>`).join('') + '<div class="nav-divider" aria-hidden="true"></div>' + ['Nuotraukos','Dizainas','Pašalintos dalys','Versijų istorija'].map((name,index) => `<button type="button" class="nav-item" data-section="${name}"${section === name ? ' aria-current="page"' : ''}>${icon(index === 0 ? 7 : index === 3 ? 8 : 5)}<span>${name}</span></button>`).join('');
}
function scalarInput(field, path, value) {
  const id = idFor(path);
  const helpId = `${id}-help`;
  const length = field.maxLength ? ` maxlength="${field.maxLength}"` : '';
  const required = field.required ? ' required' : '';
  const help = field.help ? `<span id="${helpId}" class="field-help">${escape(field.help)}</span>` : '';
  if (field.type === 'boolean') return `<div class="field toggle-field" data-field-path="${escape(path)}"><input class="toggle-control" id="${id}" type="checkbox" data-path="${escape(path)}" data-type="boolean"${value ? ' checked' : ''}${help ? ` aria-describedby="${helpId}"` : ''}><div><label class="field-label" for="${id}">${escape(field.label)}</label>${help}</div></div>`;
  const attributes = `id="${id}" class="input" data-path="${escape(path)}" data-type="${escape(field.type)}"${length}${required}${help ? ` aria-describedby="${helpId}"` : ''}`;
  const control = field.type === 'textarea' || field.type === 'paragraph' ? `<textarea ${attributes} rows="${field.type === 'paragraph' ? 4 : 3}">${escape(value)}</textarea>` : `<input ${attributes} type="${['email','tel','url'].includes(field.type) ? field.type : 'text'}" value="${escape(value)}"${field.type === 'url' || field.type === 'email' ? ' spellcheck="false"' : ''}>`;
  return `<div class="field" data-field-path="${escape(path)}"><label class="field-label" for="${id}">${escape(field.label)}${field.required ? '<span class="required-mark" aria-hidden="true">*</span>' : ''}</label>${control}<div class="field-meta">${help}${field.maxLength ? `<span class="char-count" data-count-for="${id}">${String(value ?? '').length} / ${field.maxLength}</span>` : ''}</div></div>`;
}
function fieldMarkup(field, path = field.path, value = getPath(content,path)) {
  if (!['paragraphs','list','repeater'].includes(field.type)) return scalarInput(field,path,value);
  const items = Array.isArray(value) ? value : [];
  const singular = field.type === 'paragraphs' ? 'Pastraipa' : field.type === 'repeater' ? 'Įrašas' : 'Punktas';
  return `<div class="field" data-field-path="${escape(path)}"><span class="field-label">${escape(field.label)}${field.required ? '<span class="required-mark" aria-hidden="true">*</span>' : ''}</span>${field.help ? `<p class="field-help">${escape(field.help)}</p>` : ''}<div class="array-items">${items.length ? items.map((item,index) => `<div class="array-row"><div class="array-row-heading"><span class="array-row-title">${singular} ${index+1}</span><div class="array-row-actions"><button class="icon-button" type="button" data-array-action="up" data-array-path="${escape(path)}" data-index="${index}" aria-label="${singular} ${index+1}: perkelti aukštyn"${index === 0 ? ' disabled' : ''}>↑</button><button class="icon-button" type="button" data-array-action="down" data-array-path="${escape(path)}" data-index="${index}" aria-label="${singular} ${index+1}: perkelti žemyn"${index === items.length-1 ? ' disabled' : ''}>↓</button><button class="icon-button remove-row" type="button" data-array-action="remove" data-array-path="${escape(path)}" data-index="${index}" aria-label="${singular} ${index+1}: pašalinti">×</button></div></div>${field.type === 'repeater' ? field.fields.map(child => fieldMarkup(child,`${path}.${index}.${child.path || child.key}`,item?.[child.path || child.key] ?? '')).join('') : scalarInput({...field,type:field.type === 'paragraphs' ? 'paragraph' : 'text',label:field.type === 'paragraphs' ? 'Tekstas' : 'Punkto tekstas',help:'',required:true},`${path}.${index}`,item)}</div>`).join('') : '<div class="empty-list">Dar nėra įrašų. Ši dalis svetainėje nebus rodoma, kol jos neužpildysi.</div>'}</div><button class="add-row" type="button" data-array-action="add" data-array-path="${escape(path)}"${items.length >= (field.maxItems || 99) ? ' disabled' : ''}><span aria-hidden="true">+</span>${field.type === 'paragraphs' ? 'Pridėti pastraipą' : field.type === 'repeater' ? 'Pridėti įrašą' : 'Pridėti punktą'}</button></div>`;
}
function cardFor(field) {
  if (field.path.startsWith('seo.')) return `seo.${field.path.split('.')[1]}`;
  if (field.path.startsWith('copy.')) return `copy.${field.path.split('.')[1]}`;
  if (['repeater','list','paragraphs'].includes(field.type)) return field.path;
  return 'content';
}
function cardLabel(key, fields) {
  const labels = {'content':'Pagrindinė informacija','copy.header':'Meniu užrašai','copy.footer':'Poraštės užrašai','copy.actions':'Mygtukai ir nuorodos','copy.home':'Puslapio skilčių užrašai','copy.about':'Kvietimo tekstas','copy.contact':'Kontaktų skilties užrašai','copy.camp':'Skilčių užrašai ir nepatikslinta informacija','copy.registration':'Registracijos būsenų tekstai','copy.notFound':'Nerasto puslapio tekstas','seo.home':'Pagrindinis puslapis','seo.about':'Apie mus','seo.contact':'Kontaktai','seo.camp':'Stovykla','seo.notFound':'Nerastas puslapis'};
  return labels[key] || fields[0]?.label || 'Turinys';
}
function renderSection() {
  renderNavigation();
  $('#editor-title').textContent = section;
  $('#editor-description').textContent = descriptions[section] || 'Keisk svetainės turinį. Dizainas ir puslapių išdėstymas išlieka tokie patys.';
  $('#section-number').textContent = String([visualSection,...groups,'Nuotraukos','Dizainas','Pašalintos dalys','Versijų istorija'].indexOf(section)+1).padStart(2,'0');
  document.querySelectorAll('[data-preview-size]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.previewSize === canvasDevice)));
  $('#main').classList.toggle('visual-editor',section === visualSection);
  $('#canvas-section').hidden = section !== visualSection;
  $('#editor-form').hidden = [visualSection,'Nuotraukos','Dizainas','Pašalintos dalys','Versijų istorija'].includes(section);
  $('#media-section').hidden = section !== 'Nuotraukos';
  $('#history-section').hidden = section !== 'Versijų istorija';
  $('#tools-section').hidden = !['Dizainas','Pašalintos dalys'].includes(section);
  if (section !== 'Nuotraukos') $('#media-section').replaceChildren();
  if (section !== visualSection) { $('#canvas-image-inspector').replaceChildren(); $('#canvas-image-inspector').hidden = true; }
  if (section === visualSection) { editorTools.renderPalette(); renderCanvas(); renderCanvasPhotoInspector(); return; }
  if (['Dizainas','Pašalintos dalys'].includes(section)) { editorTools.renderSection(section); return; }
  if (section === 'Nuotraukos') { renderMediaSection(); return; }
  if (section === 'Versijų istorija') { renderHistory(); return; }
  const fields = CONTENT_FIELDS.filter(field => field.group === section);
  const cards = new Map();
  for (const field of fields) { const key = cardFor(field); if (!cards.has(key)) cards.set(key,[]); cards.get(key).push(field); }
  const help = section === 'Registracija' ? '<div class="help-panel"><strong>Viena nuoroda atidaro registraciją.</strong> Įrašius Google Forms nuorodą ir paskelbus pakeitimus, registracijos mygtukai ves į anketą. Palikus lauką tuščią, bus rodoma ruošiamos registracijos informacija.</div>' : '';
  const imageHelp = IMAGE_FIELDS.some(field => field.group === section) ? '<div class="help-panel">Šio puslapio nuotraukas gali parinkti skiltyje <button class="notice-link" type="button" data-section="Nuotraukos">Nuotraukos</button>.</div>' : '';
  $('#editor-fields').innerHTML = help + [...cards].map(([key,cardFields]) => `<section class="form-card" aria-label="${escape(cardLabel(key,cardFields))}"><div class="card-heading"><h2>${escape(cardLabel(key,cardFields))}</h2></div>${cardFields.map(field => fieldMarkup(field)).join('')}</section>`).join('') + imageHelp;
}
function selectSection(next) {
  if (busy) return;
  if (![visualSection,...groups,'Nuotraukos','Dizainas','Pašalintos dalys','Versijų istorija'].includes(next)) return;
  finishCanvasEditing();
  section = next;
  renderSection();
  $('#editor-title').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
  if (next === 'Nuotraukos') loadMedia().catch(handleError);
  if (next === 'Versijų istorija') loadHistory().catch(handleError);
}
function findDescriptor(path) { return CONTENT_FIELDS.find(field => field.path === path); }
function handleArrayAction(button) {
  if (busy) return;
  const path = button.dataset.arrayPath;
  const descriptor = findDescriptor(path);
  if (!descriptor) return;
  const items = clone(getPath(content,path) || []);
  const index = Number(button.dataset.index);
  const action = button.dataset.arrayAction;
  if (action === 'add' && items.length < (descriptor.maxItems || 99)) items.push(descriptor.type === 'repeater' ? Object.fromEntries(descriptor.fields.map(field => [field.path || field.key,field.type === 'boolean' ? false : ''])) : '');
  if (action === 'remove') items.splice(index,1);
  if (action === 'up' && index > 0) [items[index-1],items[index]] = [items[index],items[index-1]];
  if (action === 'down' && index < items.length-1) [items[index+1],items[index]] = [items[index],items[index+1]];
  setValue(path,items);
  renderSection();
  const position = action === 'add' ? items.length-1 : action === 'up' ? index-1 : action === 'down' ? index+1 : Math.min(index,items.length-1);
  const field = document.querySelector(`[data-field-path="${CSS.escape(path)}"]`);
  const row = field?.querySelectorAll('.array-row')[Math.max(0,position)];
  (row?.querySelector('input,textarea') || field?.querySelector('.add-row'))?.focus();
  announce(action === 'remove' ? 'Įrašas pašalintas iš juodraščio.' : action === 'add' ? 'Pridėtas naujas įrašas.' : 'Įrašų tvarka pakeista.');
}

async function saveDraft() {
  finishCanvasEditing();
  if (busy || !dirty) return;
  clearNotice();
  let validated;
  try { validated = parseContent(content); }
  catch (error) { handleError(error); return; }
  busy = true; updateStatus();
  try {
    const next = await api('draft',{method:'POST',body:{content:validated,revision:state.revision}});
    applyState(next.content ? next : await api('state'));
    refreshPreview();
    notice('Juodraštis išsaugotas. Svetainės lankytojams pakeitimai pasirodys juos paskelbus.');
  } catch (error) { handleError(error); }
  finally { busy = false; updateStatus(); }
}
function askConfirmation(title, description, label = 'Patvirtinti', danger = false) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-action').textContent = label;
  $('#confirm-action').classList.toggle('button-danger',danger);
  $('#confirm-dialog').showModal();
  return new Promise(resolve => { confirmResolve = resolve; });
}
function closeConfirmation(result) {
  $('#confirm-dialog').close();
  const resolve = confirmResolve; confirmResolve = null; resolve?.(result);
}
async function publish() {
  if (busy || dirty || state.revision === state.publishedRevision) return;
  if (!await askConfirmation('Paskelbti pakeitimus?','Paskutinis išsaugotas juodraštis pakeis dabartinį svetainės turinį. Pakeitimai taps matomi visiems lankytojams.','Paskelbti')) return;
  busy = true; clearNotice(); updateStatus();
  try { const next = await api('publish',{method:'POST',body:{revision:state.revision}}); applyState(next.content ? next : await api('state')); notice('Pakeitimai paskelbti svetainėje.'); }
  catch (error) { handleError(error); }
  finally { busy = false; updateStatus(); }
}
async function reloadState() {
  if (busy) return;
  if (dirty && !await askConfirmation('Įkelti naujausią versiją?','Šiame lange neišsaugoti pakeitimai bus pakeisti naujausiu serveryje išsaugotu juodraščiu.','Įkelti versiją')) return;
  busy = true; updateStatus();
  try { applyState(await api('state')); clearNotice(); refreshPreview(); announce('Įkeltas naujausias juodraštis.'); }
  catch (error) { handleError(error); }
  finally { busy = false; updateStatus(); }
}
function refreshPreview() { renderCanvas(); }
function showPreview() { finishCanvasEditing(); canvasMode = 'view'; section = visualSection; renderSection(); $('#preview-frame').focus(); }

function descriptorForCanvas(path) {
  const exact = CONTENT_FIELDS.find(field => field.path === path);
  if (exact) return exact;
  const parent = CONTENT_FIELDS.find(field => path.startsWith(`${field.path}.`));
  if (!parent) return null;
  if (parent.type === 'repeater') {
    const key = path.slice(parent.path.length+1).split('.').slice(1).join('.');
    return parent.fields.find(field => (field.path || field.key) === key) || parent;
  }
  return {...parent,type:parent.type === 'paragraphs' ? 'textarea' : 'text'};
}
function rememberCanvasScroll() {
  const view = $('#preview-frame').contentWindow;
  try { if (view) canvasScroll = {x:view.scrollX,y:view.scrollY}; } catch {}
}
function canvasText(element) {
  const value = element.innerText.replace(/\u00a0/g,' ').replace(/\r\n/g,'\n');
  return element.dataset.cmsType === 'textarea' ? value : value.replace(/\n+/g,' ');
}
function updateCanvasMatches(path, value, except = null) {
  const doc = $('#preview-frame').contentDocument;
  doc?.querySelectorAll(`[data-cms-field="${CSS.escape(path)}"]`).forEach(element => { if (element !== except) element.textContent = value; });
}
function commitCanvasInput(element) {
  const path = element.dataset.cmsField;
  if (!descriptorForCanvas(path)) return;
  const value = canvasText(element);
  const descriptor = CONTENT_FIELDS.find(field => field.path === path);
  setValue(path,descriptor?.nullable && !value.trim() ? null : value);
  updateCanvasMatches(path,value,element);
}
function finishCanvasEditing(cancel = false, rebuild = false) {
  if (!canvasEditing) return;
  const selected = canvasEditing;
  canvasEditing = null;
  if (cancel) {
    setValue(selected.path,selected.original);
    selected.element.textContent = selected.original ?? '';
    updateCanvasMatches(selected.path,selected.original ?? '',selected.element);
  } else commitCanvasInput(selected.element);
  selected.element.contentEditable = 'false';
  selected.element.removeAttribute('data-cms-selected');
  selected.element.setAttribute('role','button');
  selected.element.removeAttribute('aria-multiline');
  $('#canvas-instruction').textContent = canvasMode === 'edit' ? 'Paspausk tekstą ir rašyk. Paspausk nuotraukos bloką, kad keistum jo dydį arba nuotrauką.' : 'Peržiūros režimas. Norėdamas keisti tekstą, pasirink „Redaguoti“.';
  if (rebuild) renderCanvas();
}
function beginCanvasEditing(element) {
  if (busy || canvasMode !== 'edit') return;
  if (canvasEditing?.element === element) return;
  finishCanvasEditing();
  const path = element.dataset.cmsField;
  const descriptor = descriptorForCanvas(path);
  if (!descriptor) return;
  canvasPhoto = null;
  renderCanvasPhotoInspector();
  canvasEditing = {element,path,original:getPath(content,path)};
  element.textContent = getPath(content,path) ?? '';
  element.contentEditable = 'plaintext-only';
  element.setAttribute('data-cms-selected','');
  element.setAttribute('role','textbox');
  element.setAttribute('aria-multiline',String(element.dataset.cmsType === 'textarea'));
  element.focus();
  const selection = element.ownerDocument.getSelection();
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element); range.collapse(false);
  selection.removeAllRanges(); selection.addRange(range);
  $('#canvas-instruction').textContent = `${descriptor.label}. Rašyk tiesiai puslapyje. Esc atšaukia šio redagavimo pakeitimus.`;
  announce(`Redaguojama: ${descriptor.label}.`);
}
function placeCanvasCaret(element, event) {
  const doc = element.ownerDocument;
  let range = null;
  if (doc.caretPositionFromPoint) {
    const point = doc.caretPositionFromPoint(event.clientX,event.clientY);
    if (point && element.contains(point.offsetNode)) { range = doc.createRange(); range.setStart(point.offsetNode,point.offset); range.collapse(true); }
  } else if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(event.clientX,event.clientY);
  if (range && element.contains(range.startContainer)) { const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
}
function insertPlainText(element, text) {
  const doc = element.ownerDocument;
  const plain = element.dataset.cmsType === 'textarea' ? text : text.replace(/[\r\n]+/g,' ');
  if (!doc.execCommand('insertText',false,plain)) {
    const selection = doc.getSelection();
    if (selection.rangeCount) { const range = selection.getRangeAt(0); range.deleteContents(); const node = doc.createTextNode(plain); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
  }
  commitCanvasInput(element);
}
function setCanvasLoading(status) {
  const ready = status === 'ready';
  const failed = status === 'error';
  $('#canvas-stage').classList.toggle('is-loading',!ready);
  $('#canvas-stage').setAttribute('aria-busy',String(!ready && !failed));
  $('#canvas-loading').hidden = ready;
  $('#canvas-loading-message').textContent = failed ? 'Puslapio nepavyko paruošti. Pabandyk įkelti dar kartą.' : 'Įkeliamas puslapis...';
  $('#canvas-loading .spinner').hidden = failed;
  $('[data-reload-canvas]').hidden = !failed;
  $('#preview-frame').inert = !ready;
  $('#preview-frame').tabIndex = ready ? 0 : -1;
}
function bindCanvasDocument() {
  try { bindCanvasHandlers(); setCanvasLoading('ready'); }
  catch { setCanvasLoading('error'); }
}
function bindCanvasHandlers() {
  const frame = $('#preview-frame');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('Canvas document unavailable.');
  doc.documentElement.dataset.cmsEditing = String(canvasMode === 'edit');
  doc.querySelectorAll('[data-cms-field],[data-cms-image]').forEach(element => {
    element.tabIndex = canvasMode === 'edit' ? 0 : -1;
    element.contentEditable = 'false';
    if (canvasMode === 'edit') element.setAttribute('role','button');
    else { element.removeAttribute('role'); element.removeAttribute('aria-label'); }
  });
  highlightCanvasPhoto();
  editorTools.bindCanvas(doc);
  doc.addEventListener('click',event => {
    if (editorTools.handleCanvasClick(event)) return;
    const field = event.target.closest('[data-cms-field]');
    const photo = event.target.closest('[data-cms-image]');
    if (canvasMode === 'edit' && field) {
      event.stopImmediatePropagation();
      if (canvasEditing?.element === field) { if (field.closest('a')) { event.preventDefault(); placeCanvasCaret(field,event); } }
      else { event.preventDefault(); beginCanvasEditing(field); placeCanvasCaret(field,event); }
      return;
    }
    if (canvasMode === 'edit' && photo) { event.preventDefault(); event.stopImmediatePropagation(); finishCanvasEditing(); editCanvasPhoto(photo.dataset.cmsImage); return; }
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.getAttribute('href'),location.origin);
    if (url.origin !== location.origin) {
      if (canvasMode === 'edit') { event.preventDefault(); event.stopImmediatePropagation(); announce('Nuorodos redaguojamos turinio skyriuose kairėje.'); }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (url.hash && (url.pathname === $('#preview-route').value || link.getAttribute('href').startsWith('#'))) { doc.querySelector(url.hash)?.scrollIntoView({behavior:'smooth'}); return; }
    const allowed = [...$('#preview-route').options].some(option => option.value === url.pathname);
    if (canvasMode === 'view' && allowed) { finishCanvasEditing(); canvasScrollReset = true; $('#preview-route').value = url.pathname; renderCanvas(); }
    else announce('Kitą puslapį pasirink viršuje esančiame puslapių sąraše.');
  },true);
  doc.addEventListener('input',event => { const element = event.target.closest('[data-cms-field]'); if (element && canvasEditing?.element === element) commitCanvasInput(element); });
  doc.addEventListener('paste',event => { const element = event.target.closest('[data-cms-field]'); if (element && canvasEditing?.element === element) { event.preventDefault(); insertPlainText(element,event.clipboardData.getData('text/plain')); } });
  doc.addEventListener('drop',event => { if (event.target.closest('[data-cms-field]')) event.preventDefault(); });
  doc.addEventListener('focusout',event => {
    if (canvasEditing?.element !== event.target) return;
    const selected = canvasEditing;
    const nextEditable = event.relatedTarget?.closest?.('[data-cms-field],[data-cms-image]');
    setTimeout(() => { if (canvasEditing === selected && doc.activeElement !== selected.element) finishCanvasEditing(false,!nextEditable && doc.hasFocus()); },0);
  });
  doc.addEventListener('keydown',event => {
    const element = event.target.closest('[data-cms-field],[data-cms-image]');
    if (event.key === 'Escape' && canvasEditing) { event.preventDefault(); const current = canvasEditing.element; finishCanvasEditing(true); current.focus(); announce('Šio redagavimo pakeitimai atšaukti.'); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveDraft(); return; }
    if (!element || canvasMode !== 'edit') return;
    if (canvasEditing?.element === element) {
      if (event.key === 'Enter' && (element.dataset.cmsType !== 'textarea' || event.ctrlKey || event.metaKey)) { event.preventDefault(); finishCanvasEditing(false,true); }
    } else if (event.key === 'Enter' || event.key === 'F2' || event.key === ' ') {
      event.preventDefault();
      if (element.dataset.cmsField) beginCanvasEditing(element);
      else editCanvasPhoto(element.dataset.cmsImage);
    }
  },true);
  frame.contentWindow.scrollTo(canvasScroll.x,canvasScroll.y);
  fitCanvas();
}
function renderCanvas() {
  if (!content || section !== visualSection) return;
  clearTimeout(canvasRenderTimer);
  if (canvasScrollReset) { canvasScroll = {x:0,y:0}; canvasScrollReset = false; }
  else rememberCanvasScroll();
  const rendered = renderPage(content,$('#preview-route').value,{assets:{...canvasAssets,theme:'/admin/theme.css'},preview:true,previewDevice:canvasDevice});
  if (!rendered) return;
  canvasEditing = null;
  setCanvasLoading('loading');
  $('#preview-frame').srcdoc = rendered.html;
  $('#preview-frame').title = `${canvasMode === 'edit' ? 'Redaguojamas puslapis' : 'Juodraščio peržiūra'}: ${$('#preview-route').selectedOptions[0].textContent}`;
  document.querySelectorAll('[data-canvas-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.canvasMode === canvasMode)));
  document.querySelectorAll('[data-preview-size]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.previewSize === canvasDevice)));
  $('#canvas-instruction').textContent = canvasMode === 'edit' ? 'Paspausk tekstą ir rašyk. Paspausk nuotraukos bloką, kad keistum jo dydį arba nuotrauką.' : 'Peržiūros režimas. Norėdamas keisti tekstą, pasirink „Redaguoti“.';
  $('#canvas-section').classList.toggle('is-viewing',canvasMode === 'view');
  fitCanvas();
}
function scheduleCanvasRender() { clearTimeout(canvasRenderTimer); canvasRenderTimer = setTimeout(() => { if (!canvasEditing) renderCanvas(); },180); }
function fitCanvas() {
  if ($('#canvas-section').hidden) return;
  const stage = $('#canvas-stage');
  const frame = $('#preview-frame');
  const width = canvasDevice === 'mobile' ? 390 : 1280;
  const scale = Math.min(1,Math.max(.1,(stage.clientWidth-32)/width));
  frame.style.width = `${width}px`;
  frame.style.height = `${Math.max(360,(stage.clientHeight-32)/scale)}px`;
  frame.style.zoom = String(scale);
  stage.classList.toggle('is-mobile',canvasDevice === 'mobile');
}
function imageRatioControls(slot) {
  const value = getPath(content,slot.ratioPath) || 'auto';
  const id = idFor(slot.ratioPath);
  return `<fieldset class="field image-ratio-field" data-field-path="${escape(slot.ratioPath)}" aria-describedby="${id}-help"><legend class="field-label">Bloko proporcijos</legend><div class="image-ratio-options">${IMAGE_ASPECT_RATIOS.map(option => `<label class="image-ratio-option${option.value === 'auto' ? ' image-ratio-auto' : ''}"><input class="image-ratio-input" type="radio" name="${id}" value="${escape(option.value)}" data-image-ratio="${escape(slot.ratioPath)}"${value === option.value ? ' checked' : ''}><span class="image-ratio-content"><span class="image-ratio-icon ratio-icon-${option.value.replace(':','-')}" aria-hidden="true"></span><span>${escape(option.label)}</span></span></label>`).join('')}</div><p class="field-help" id="${id}-help">Keičia viso bloko aukštį pagal jo plotį. Nuotrauka užpildo bloką be ištempimo.</p></fieldset><label class="tools-field"><span>Nuotraukos vieta</span><select class="input" data-image-position="${escape(slot.path)}">${IMAGE_POSITIONS.map(position => `<option value="${position.value}"${getPath(content,slot.positionPath) === position.value ? ' selected' : ''}>${escape(position.label)}</option>`).join('')}</select><small>Telefone blokai automatiškai išdėstomi vienas po kito.</small></label>`;
}
function editCanvasPhoto(path) {
  const slot = IMAGE_FIELDS.find(field => field.path === path);
  if (!slot) return;
  editorTools.clearSelection();
  canvasPhoto = path;
  renderCanvasPhotoInspector();
  document.querySelector('#canvas-image-inspector input[data-image-ratio]:checked')?.focus({preventScroll:true});
  $('#canvas-image-inspector').scrollIntoView({block:'nearest',behavior:'instant'});
  announce(`Redaguojama: ${slot.label}. Gali keisti viso bloko proporcijas, nuotrauką arba pašalinti bloką.`);
}
function highlightCanvasPhoto() {
  $('#preview-frame').contentDocument?.querySelectorAll('[data-cms-image]').forEach(element => element.toggleAttribute('data-cms-photo-selected',canvasMode === 'edit' && section === visualSection && element.dataset.cmsImage === canvasPhoto));
}
function renderCanvasPhotoInspector() {
  highlightCanvasPhoto();
  const panel = $('#canvas-image-inspector');
  panel.hidden = !canvasPhoto || section !== visualSection;
  if (panel.hidden) return;
  const slot = IMAGE_FIELDS.find(field => field.path === canvasPhoto);
  if (!slot) return;
  if (getPath(content,slot.hiddenPath)) { panel.hidden = true; return; }
  const ownSrc = getPath(content,slot.path);
  const inherited = slot.path === 'camps.0.detailImage' && !ownSrc && getPath(content,'camps.0.image');
  const description = ownSrc ? scalarInput({label:'Trumpas nuotraukos aprašymas',type:'text',required:true,maxLength:500,help:'Aprašyk, kas matoma nuotraukoje. Tai padeda ekrano skaitytuvą naudojančioms lankytojoms.'},slot.altPath,getPath(content,slot.altPath) || '') : `<p class="field-help">${inherited ? 'Rodoma pagrindinė stovyklos nuotrauka su jos aprašymu. Šio bloko proporcijas gali keisti atskirai.' : 'Nuotrauka dar nepasirinkta. Gali keisti viso tuščio bloko proporcijas, įkelti nuotrauką arba pašalinti bloką.'}</p>`;
  panel.innerHTML = `<div class="canvas-photo-heading"><strong>${escape(slot.label)}</strong><button class="icon-button" type="button" data-close-photo-inspector aria-label="Baigti nuotraukos redagavimą">×</button></div><div class="canvas-photo-fields">${description}${imageRatioControls(slot)}</div><div class="canvas-photo-actions"><button type="button" class="button button-outline" data-choose-slot="${escape(slot.path)}">${inherited ? 'Pasirinkti atskirą nuotrauką' : ownSrc ? 'Pakeisti nuotrauką' : 'Pasirinkti nuotrauką'}</button><button type="button" class="slot-remove" data-remove-slot="${escape(slot.path)}">Pašalinti bloką</button></div>`;
}
function setPhotoBlockHidden(path, hidden) {
  if (busy || !content) return;
  const slot = IMAGE_FIELDS.find(field => field.path === path);
  if (!slot) return;
  finishCanvasEditing();
  setValue(slot.hiddenPath,hidden);
  canvasPhoto = null;
  renderSection();
  const message = hidden ? `${slot.label}: nuotraukos blokas pašalintas. Jo vietoje tuščio rėmelio neliks.` : `${slot.label}: blokas grąžintas. Nuotrauka ir proporcijos išsaugotos.`;
  notice(message,'success',hidden ? `<button class="notice-link" type="button" data-restore-slot="${escape(path)}">Grąžinti bloką</button>` : '');
}
async function loadCanvasAssets() {
  try {
    const response = await fetch('/admin/preview?path=/',{credentials:'same-origin',cache:'no-store',headers:{'X-Requested-With':'XMLHttpRequest'}});
    if (!response.ok) return;
    const doc = new DOMParser().parseFromString(await response.text(),'text/html');
    const styles = doc.querySelector('link[rel="stylesheet"][href*="styles.css"]')?.getAttribute('href');
    const script = doc.querySelector('script[src*="app.js"]')?.getAttribute('src');
    if (styles?.startsWith('/') && !styles.startsWith('//')) canvasAssets.styles = styles;
    if (script?.startsWith('/') && !script.startsWith('//')) canvasAssets.script = script;
  } catch {}
}

function publicMediaUrl(item) { return item.url || item.src || `/media/${item.id}`; }
function previewMediaUrl(item) { return item.previewUrl || `/admin/api/media/${encodeURIComponent((item.url || item.src || item.id).split('/').at(-1))}`; }
function sourcePreview(src) { const item = media.find(item => publicMediaUrl(item) === src); return item ? previewMediaUrl(item) : `/admin/api/media/${encodeURIComponent(src.split('/').at(-1))}`; }
function isInDraft(item) { return getImageReferences(content).some(reference => reference.src === publicMediaUrl(item)) || editorTools.isMediaUsed(publicMediaUrl(item)); }
function uploadsAllowed() { return state?.capabilities?.upload !== false && state?.capabilities?.mediaUploads !== false; }
function uploadMarkup() {
  if (!uploadsAllowed()) return '<div class="help-panel"><strong>Nuotraukų įkėlimas dar neįjungtas.</strong> Tekstus gali redaguoti ir skelbti. Nuotraukas bus galima įkelti, kai bus prijungta svetainės failų saugykla.</div>';
  return `<div class="upload-zone"><div><h3>Įkelk savo nuotrauką</h3><p>JPG, PNG arba WebP. Nuotrauka bus automatiškai sumažinta.<br>HEIC failą pirmiausia eksportuok į JPG.</p></div><label class="button button-outline upload-label">+ Įkelti nuotrauką<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-file${uploadBusy ? ' disabled' : ''}></label></div><div class="upload-progress" data-upload-progress hidden><span class="spinner" aria-hidden="true"></span><span data-upload-label>Ruošiama nuotrauka...</span><progress max="100" value="0" aria-label="Nuotraukos įkėlimo eiga"></progress></div>`;
}
function libraryMarkup(picker = false) {
  if (!mediaLoaded) return '<div class="loading-state"><span class="spinner" aria-hidden="true"></span><p>Įkeliama nuotraukų biblioteka...</p></div>';
  if (!media.length) return '<div class="library-empty"><h3>Biblioteka dar tuščia</h3><p>Įkeltos nuotraukos bus pasiekiamos čia. Jas galėsi panaudoti keliose svetainės vietose.</p></div>';
  return `<div class="media-grid">${media.map(item => {
    const used = isInDraft(item) || item.usedInDraft || item.usedInPublished;
    return `<article class="media-item"><img src="${escape(previewMediaUrl(item))}" alt="" loading="lazy" width="320" height="240"><div class="media-info"><span class="media-name" title="${escape(item.name || item.filename || item.id)}">${escape(item.name || item.filename || item.id)}</span><div class="media-details"><span>${byteLabel(item.size || 0)}${item.width && item.height ? ` · ${item.width} × ${item.height}` : ''}</span><span>${item.type === 'image/webp' ? 'WebP' : item.type === 'image/png' ? 'PNG' : 'JPG'}</span></div></div><div class="media-item-actions">${picker ? `<button class="button button-outline" type="button" data-select-media="${escape(item.id)}">Pasirinkti</button>` : used ? '<span class="media-in-use">Naudojama svetainėje</span>' : '<span class="media-details">Nenaudojama</span>'}${!used ? `<button class="media-delete" type="button" data-delete-media="${escape(item.id)}">Ištrinti</button>` : ''}</div></article>`;
  }).join('')}</div>`;
}
function renderMediaSection() {
  const slots = IMAGE_FIELDS.map(field => {
    if (getPath(content,field.hiddenPath)) return `<article class="image-slot is-removed"><div class="slot-preview slot-removed"><span>Blokas pašalintas</span></div><div class="slot-body"><h2>${escape(field.label)}</h2><p class="field-help">Šio nuotraukos bloko svetainėje nėra. Pasirinkta nuotrauka ir proporcijos išsaugotos.</p>${getPath(content,field.path) ? scalarInput({label:'Nuotraukos aprašymas',type:'text',required:false,maxLength:500,help:'Aprašymas išsaugomas ir gali būti naudojamas kitame bloke.'},field.altPath,getPath(content,field.altPath) || '') : ''}<button class="button button-outline" type="button" data-restore-slot="${escape(field.path)}">Grąžinti bloką</button></div></article>`;
    const ownSrc = getPath(content,field.path);
    const inherited = field.path === 'camps.0.detailImage' && !ownSrc && getPath(content,'camps.0.image');
    const src = ownSrc || inherited;
    const alt = getPath(content,inherited ? 'camps.0.imageAlt' : field.altPath);
    const ratio = getPath(content,field.ratioPath) || 'auto';
    return `<article class="image-slot"><div class="slot-preview${src ? '' : ' empty'}"${IMAGE_ASPECT_RATIOS.some(option => option.value === ratio && ratio !== 'auto') ? ` data-preview-ratio="${ratio.replace(':','-')}"` : ''}>${src ? `<img src="${escape(sourcePreview(src))}" alt="${escape(alt)}" width="520" height="325">` : '<span class="slot-empty-label">Nuotrauka nepasirinkta</span>'}</div><div class="slot-body"><h2>${escape(field.label)}</h2><p class="field-help">${escape(inherited ? 'Rodoma pagrindinė stovyklos nuotrauka. Čia gali pasirinkti atskiras proporcijas arba kitą nuotrauką.' : field.help || field.group || '')}</p><div class="slot-actions"><button class="button button-outline" type="button" data-choose-slot="${escape(field.path)}">${inherited ? 'Pasirinkti atskirą nuotrauką' : ownSrc ? 'Pakeisti nuotrauką' : 'Pasirinkti nuotrauką'}</button><button class="slot-remove" type="button" data-remove-slot="${escape(field.path)}">Pašalinti bloką</button></div>${ownSrc ? scalarInput({label:'Trumpai aprašyk, kas nuotraukoje',type:'text',required:true,maxLength:500,help:'Aprašymas skirtas lankytojoms, kurios naudoja ekrano skaitytuvą. Pvz. „Miglė ir Miglė stovyklavietės sode“.'},field.altPath,getPath(content,field.altPath) || '') : ''}${imageRatioControls(field)}</div></article>`;
  }).join('');
  $('#media-section').innerHTML = '<div class="help-panel">Kiekvieno nuotraukos bloko proporcijas gali keisti ir be nuotraukos. Nereikalingą bloką pašalink, kad neliktų tuščios vietos. <strong>Pakeitimai lankytojoms matomi tik juos paskelbus.</strong> Tuščios vietos gali likti be nuotraukų.</div>' + `<div class="image-slots">${slots}</div><div class="library-heading"><h2>Nuotraukų biblioteka<span class="library-count">${mediaLoaded ? media.length : ''}</span></h2></div>${uploadMarkup()}${libraryMarkup()}`;
}
function renderMediaPicker() {
  $('#media-picker-title').textContent = activeSlot?.label || 'Pasirink nuotrauką';
  $('#media-picker-content').innerHTML = uploadMarkup() + libraryMarkup(true);
}
async function loadMedia() {
  const result = await api('media');
  media = Array.isArray(result) ? result : result.items || [];
  mediaLoaded = true;
  if (section === 'Nuotraukos') renderMediaSection();
  if ($('#media-picker').open) renderMediaPicker();
}
async function openMediaPicker(path) {
  activeSlot = typeof path === 'object' ? path : IMAGE_FIELDS.find(field => field.path === path);
  if (!activeSlot) return;
  renderMediaPicker();
  $('#media-picker').showModal();
  try { await loadMedia(); } catch (error) { $('#media-picker').close(); handleError(error); }
}
async function preparePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Tinka JPG, PNG arba WebP failai. HEIC nuotrauką pirmiausia eksportuok į JPG.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Nuotrauka per didelė apdoroti naršyklėje. Pirmiausia eksportuok mažesnį, iki 40 MB failą.');
  let bitmap;
  try { bitmap = await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch { throw new Error('Šios nuotraukos nepavyko perskaityti. Pabandyk ją eksportuoti kaip JPG arba PNG.'); }
  try {
    if (bitmap.width * bitmap.height > 100000000) throw new Error('Nuotraukos matmenys per dideli. Eksportuok mažesnę, iki 100 megapikselių nuotrauką.');
    let ratio = Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    let blob;
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1,Math.round(bitmap.width*ratio));
      canvas.height = Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',attempt === 0 ? .85 : .78));
      if (!blob) throw new Error('Nepavyko paruošti nuotraukos. Pabandyk kitą naršyklę arba JPG failą.');
      if (blob.size <= 2*1024*1024) break;
      ratio *= .8;
    }
    if (blob.size > 8*1024*1024) throw new Error('Nuotrauka po sumažinimo vis dar per didelė. Pabandyk mažesnį failą.');
    const extension = blob.type === 'image/webp' ? '.webp' : '.png';
    return new File([blob],`${file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,100) || 'nuotrauka'}${extension}`,{type:blob.type});
  } finally { bitmap.close(); }
}
async function uploadPhoto(file) {
  if (!file || uploadBusy || !uploadsAllowed()) return;
  uploadBusy = true;
  document.querySelectorAll('[data-upload-file]').forEach(input => { input.disabled = true; });
  document.querySelectorAll('[data-upload-progress]').forEach(element => { element.hidden = false; });
  let completed = false;
  try {
    const prepared = await preparePhoto(file);
    document.querySelectorAll('[data-upload-label]').forEach(element => { element.textContent = 'Įkeliama nuotrauka...'; });
    const result = await new Promise((resolve,reject) => {
      const request = new XMLHttpRequest();
      request.open('POST','/admin/api/media');
      request.setRequestHeader('X-CMS-Request','1');
      request.setRequestHeader('X-Requested-With','XMLHttpRequest');
      request.setRequestHeader('Accept','application/json');
      request.responseType = 'json';
      request.upload.addEventListener('progress',event => { if (event.lengthComputable) document.querySelectorAll('[data-upload-progress] progress').forEach(progress => { progress.value = Math.round(event.loaded/event.total*100); }); });
      request.addEventListener('load',() => { if (request.status >= 200 && request.status < 300) resolve(request.response); else reject(new ApiError(request.response?.error?.message || 'Nuotraukos įkelti nepavyko. Bandyk dar kartą.',request.status,request.response?.error)); });
      request.addEventListener('error',() => reject(new Error('Ryšys nutrūko. Nuotraukos įkelti nepavyko. Bandyk dar kartą.')));
      const form = new FormData(); form.append('file',prepared); request.send(form);
    });
    const item = result.item || result;
    if (!item.id) throw new Error('Nepavyko patvirtinti nuotraukos įkėlimo. Atnaujink biblioteką.');
    await loadMedia();
    completed = true;
    if (activeSlot && $('#media-picker').open) selectMedia(item.id);
    notice('Nuotrauka įkelta į biblioteką. Parink jos vietą ir užpildyk trumpą aprašymą.');
  } catch (error) {
    if ($('#media-picker').open) $('#media-picker').close();
    handleError(error);
  } finally {
    uploadBusy = false;
    if (!completed || section === 'Nuotraukos') renderMediaSection();
    if ($('#media-picker').open) renderMediaPicker();
  }
}
function selectMedia(id) {
  const item = media.find(item => item.id === id);
  if (!item || !activeSlot) return;
  if (activeSlot.kind === 'block') {
    const target = activeSlot;
    $('#media-picker').close(); activeSlot = null;
    editorTools.blockImage(target.blockId,publicMediaUrl(item),target.page);
    return;
  }
  const changed = getPath(content,activeSlot.path) !== publicMediaUrl(item);
  setValue(activeSlot.path,publicMediaUrl(item));
  setValue(activeSlot.hiddenPath,false);
  if (changed) setValue(activeSlot.altPath,'');
  const altPath = activeSlot.altPath;
  if (section === visualSection) canvasPhoto = activeSlot.path;
  $('#media-picker').close();
  activeSlot = null;
  renderSection();
  document.getElementById(idFor(altPath))?.focus();
  announce('Nuotrauka pasirinkta. Pridėk trumpą jos aprašymą ir išsaugok juodraštį.');
}
async function deleteMedia(id) {
  const item = media.find(item => item.id === id);
  if (!item || isInDraft(item) || item.usedInDraft || item.usedInPublished || uploadBusy) return;
  if (!await askConfirmation('Ištrinti nuotrauką iš bibliotekos?','Nuotrauka nebebus rodoma bibliotekoje. Svetainėje naudojamų nuotraukų ištrinti negalima.','Ištrinti',true)) return;
  try { await api(`media/${encodeURIComponent((publicMediaUrl(item)).split('/').at(-1))}`,{method:'DELETE'}); await loadMedia(); notice('Nuotrauka ištrinta iš bibliotekos.'); }
  catch (error) { if ($('#media-picker').open) $('#media-picker').close(); handleError(error); }
}
async function loadHistory() {
  const result = await api('history');
  versions = Array.isArray(result) ? result : result.versions || [];
  if (section === 'Versijų istorija') renderHistory();
}
function renderHistory() {
  $('#history-section').innerHTML = '<p class="history-intro">Gali grįžti prie ankstesnės turinio versijos. Ji bus įkelta kaip juodraštis. Svetainėje ji pasirodys tik atskirai paskelbus pakeitimus.</p>' + (versions.length ? `<div class="history-list">${versions.map(version => `<article class="history-item"><span class="history-icon" aria-hidden="true">↶</span><div class="history-content"><strong>${escape(dateLabel(version.createdAt) || 'Išsaugota versija')}${version.revision === state.publishedRevision ? '<span class="history-badge">Paskelbta versija</span>' : version.revision === state.revision ? '<span class="history-badge">Dabartinis juodraštis</span>' : ''}</strong><p>${escape(typeof version.author === 'object' ? version.author.email || 'Administratorius' : version.author || 'Administratorius')}</p></div><button class="button button-outline" type="button" data-restore-version="${escape(version.id)}"${version.revision === state.revision || busy ? ' disabled' : ''}>Atkurti</button></article>`).join('')}</div>` : '<div class="library-empty"><h3>Versijų istorija dar tuščia</h3><p>Išsaugojus juodraštį, ankstesnės versijos atsiras čia.</p></div>');
}
async function restoreVersion(versionId) {
  if (busy) return;
  if (!await askConfirmation('Atkurti ankstesnę versiją?',`Pasirinkta versija pakeis dabartinį juodraštį.${dirty ? ' Šiame lange neišsaugoti pakeitimai bus prarasti.' : ''} Paskelbta svetainė kol kas nesikeis.`,'Atkurti juodraštį')) return;
  busy = true; updateStatus();
  try { const next = await api('restore',{method:'POST',body:{versionId,revision:state.revision}}); applyState(next.content ? next : await api('state')); await loadHistory(); refreshPreview(); notice('Versija atkurta kaip juodraštis. Peržiūrėk ją ir paskelbk, kai būsi pasiruošęs.'); }
  catch (error) { handleError(error); }
  finally { busy = false; updateStatus(); if (section === 'Versijų istorija') renderHistory(); }
}

document.addEventListener('click',event => {
  const target = event.target.closest('button,[data-section]');
  if (!target) return;
  if (target.dataset.section) selectSection(target.dataset.section);
  if (target.dataset.arrayAction) handleArrayAction(target);
  if (target.hasAttribute('data-dismiss-notice')) clearNotice();
  if (target.hasAttribute('data-reload-state')) reloadState();
  if (target.hasAttribute('data-close-confirm')) closeConfirmation(false);
  if (target.dataset.chooseSlot) openMediaPicker(target.dataset.chooseSlot);
  if (target.dataset.selectMedia) selectMedia(target.dataset.selectMedia);
  if (target.dataset.deleteMedia) deleteMedia(target.dataset.deleteMedia);
  if (target.dataset.restoreVersion) restoreVersion(target.dataset.restoreVersion);
  if (target.dataset.removeSlot) setPhotoBlockHidden(target.dataset.removeSlot,true);
  if (target.dataset.restoreSlot) setPhotoBlockHidden(target.dataset.restoreSlot,false);
  if (target.hasAttribute('data-close-photo-inspector')) { canvasPhoto = null; renderCanvasPhotoInspector(); }
  if (target.hasAttribute('data-reload-canvas')) renderCanvas();
  if (target.dataset.previewSize) { finishCanvasEditing(); canvasDevice = target.dataset.previewSize; renderSection(); }
  if (target.dataset.canvasMode) { finishCanvasEditing(); canvasMode = target.dataset.canvasMode; renderCanvas(); }
});
document.addEventListener('input',event => {
  const input = event.target.closest('[data-path]');
  if (!input || !content) return;
  const descriptor = findDescriptor(input.dataset.path);
  setValue(input.dataset.path,input.dataset.type === 'boolean' ? input.checked : descriptor?.nullable && !input.value.trim() ? null : input.value);
  input.removeAttribute('aria-invalid');
  input.closest('.field')?.querySelector('.field-error')?.remove();
  const count = document.querySelector(`[data-count-for="${CSS.escape(input.id)}"]`);
  if (count) count.textContent = `${input.value.length} / ${input.maxLength}`;
  scheduleCanvasRender();
});
document.addEventListener('change',event => {
  if (event.target.matches('[data-upload-file]')) uploadPhoto(event.target.files[0]);
  if (event.target.dataset.imagePosition) { const slot = IMAGE_FIELDS.find(field => field.path === event.target.dataset.imagePosition); if (slot && IMAGE_POSITIONS.some(position => position.value === event.target.value)) { setImageSetting(slot,'position',event.target.value); renderCanvas(); announce('Nuotraukos vieta pakeista.'); } }
  const input = event.target.closest('[data-image-ratio]');
  if (!input || !content || busy || !input.checked) return;
  const slot = IMAGE_FIELDS.find(field => field.ratioPath === input.dataset.imageRatio);
  if (!slot || !IMAGE_ASPECT_RATIOS.some(option => option.value === input.value)) return;
  setValue(slot.ratioPath,input.value);
  input.closest('.field')?.querySelector('.field-error')?.remove();
  input.closest('.field')?.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
  const thumbnail = input.closest('.image-slot')?.querySelector('.slot-preview');
  if (thumbnail) {
    if (input.value === 'auto') delete thumbnail.dataset.previewRatio;
    else thumbnail.dataset.previewRatio = input.value.replace(':','-');
  }
  renderCanvas();
  announce(`${slot.label}: ${IMAGE_ASPECT_RATIOS.find(option => option.value === input.value).label}. Pakeitimas dar neišsaugotas.`);
});
$('#editor-form').addEventListener('submit',event => { event.preventDefault(); saveDraft(); });
$('#save-draft').addEventListener('click',saveDraft);
$('#publish').addEventListener('click',publish);
$('#confirm-action').addEventListener('click',() => closeConfirmation(true));
$('#confirm-dialog').addEventListener('cancel',event => { event.preventDefault(); closeConfirmation(false); });
$('#media-picker-close').addEventListener('click',() => $('#media-picker').close());
$('#media-picker').addEventListener('close',() => { activeSlot = null; });
$('#preview-toggle').addEventListener('click',showPreview);
$('#preview-route').addEventListener('change',() => { finishCanvasEditing(); canvasPhoto = null; renderCanvasPhotoInspector(); canvasScrollReset = true; renderCanvas(); });
$('#preview-frame').addEventListener('load',bindCanvasDocument);
$('#preview-frame').addEventListener('error',() => setCanvasLoading('error'));
new ResizeObserver(fitCanvas).observe($('#canvas-stage'));
document.addEventListener('keydown',event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!$('#confirm-dialog').open && !$('#media-picker').open) saveDraft(); }
});
window.addEventListener('beforeunload',event => { if (dirty || busy || uploadBusy) { event.preventDefault(); event.returnValue = ''; } });
renderNavigation();
try { const [next] = await Promise.all([api('state'),loadCanvasAssets()]); applyState(next); }
catch (error) { $('#loading-state').hidden = true; handleError(error); }
