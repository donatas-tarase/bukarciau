import {LINK_PARTS, getPath, safeLinkUrl} from '/admin/schema.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createLinkTools(api) {
  const panel = () => document.querySelector('#canvas-link-inspector');
  let selectedId = null;
  let timer = null;
  let forceNext = false;
  let pendingIssue = null;
  const anchor = () => selectedId && api.doc()?.querySelector(`[data-cms-link="${CSS.escape(selectedId)}"]`);
  const descriptor = () => LINK_PARTS.find(item => item.id === selectedId);
  const textPath = () => anchor()?.querySelector('[data-cms-field]')?.dataset.cmsField;
  function renderInspector(force = false) {
    const container = panel();
    if (!container) return;
    container.hidden = !descriptor() || (!anchor() && !Object.hasOwn(api.content()?.linkOverrides || {},selectedId)) || api.mode() !== 'edit';
    if (container.hidden) return;
    if (!force && container.contains(document.activeElement)) return;
    const field = textPath();
    const url = api.content().linkOverrides?.[selectedId] ?? anchor()?.getAttribute('href') ?? '';
    container.innerHTML = `<div class="canvas-photo-heading"><div><strong>Mygtukas arba nuoroda</strong><small class="inspector-device">${escape(descriptor().label)}</small></div><button class="icon-button" type="button" data-close-link aria-label="Baigti nuorodos redagavimą">×</button></div>${field ? `<label class="tools-field"><span>Užrašas</span><input class="input" type="text" data-existing-link-text value="${escape(getPath(api.content(),field))}" aria-label="Esamos nuorodos užrašas"></label>` : '<p class="field-help">Užrašą gali keisti pasirinkusi nuorodą puslapyje.</p>'}<label class="tools-field"><span>URL adresas</span><input class="input" type="text" data-existing-link-url value="${escape(url)}" aria-label="Esamos nuorodos URL" spellcheck="false"${safeLinkUrl(url) ? '' : ' aria-invalid="true"'}><small>Naudok https://, vidinį /puslapis/ ar #inkaras, mailto: arba tel: adresą. Tuščias laukas grąžina pradinę nuorodą.</small></label><button class="button button-outline" type="button" data-reset-link-url${Object.hasOwn(api.content().linkOverrides || {},selectedId) ? '' : ' disabled'}>Grąžinti pradinį URL</button>`;
  }
  function select(element) {
    const id = element?.dataset.cmsLink;
    if (!LINK_PARTS.some(item => item.id === id)) return false;
    api.finish();
    selectedId = id;
    api.clearPhoto();
    api.revealTools();
    renderInspector(true);
    panel()?.scrollIntoView({block:'nearest',behavior:'instant'});
    return true;
  }
  function bindCanvas(doc) {
    if (selectedId && !anchor() && !Object.hasOwn(api.content()?.linkOverrides || {},selectedId)) selectedId = null;
    renderInspector(forceNext || Boolean(pendingIssue)); forceNext = false;
    if (pendingIssue) { applyIssue(pendingIssue.url,pendingIssue.message); pendingIssue = null; }
    if (api.mode() !== 'edit') return;
    doc.addEventListener('click',event => {
      if (event.target.closest?.('[data-editor-drag-part],[data-layout-resize]')) return;
      const link = event.target.closest?.('[data-cms-link]');
      if (link) {
        select(link);
        event.preventDefault();
        if (!event.target.closest('[data-cms-field]')) event.stopImmediatePropagation();
      } else if (selectedId) { selectedId = null; renderInspector(); }
    },true);
    doc.addEventListener('keydown',event => {
      if (!['Enter','F2',' '].includes(event.key) || event.target.closest('[data-cms-field]')) return;
      const link = event.target.closest?.('[data-cms-link]');
      if (link) { event.preventDefault(); event.stopImmediatePropagation(); select(link); panel().querySelector('input')?.focus(); }
    },true);
  }
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(() => api.render(),180);
  }
  document.addEventListener('input',event => {
    const input = event.target;
    if (!descriptor() || api.busy()) return;
    if (input.hasAttribute('data-existing-link-text')) {
      const path = textPath();
      if (!path) return;
      api.setText(path,input.value);
      scheduleRender();
    }
    if (input.hasAttribute('data-existing-link-url')) {
      const value = input.value.trim();
      api.mutate(content => {
        content.linkOverrides ||= {};
        if (value) content.linkOverrides[selectedId] = value;
        else delete content.linkOverrides[selectedId];
      });
      const valid = !value || Boolean(safeLinkUrl(value));
      input.setAttribute('aria-invalid',String(!valid));
      if (valid) input.closest('.tools-field').querySelectorAll('.field-error').forEach(element => element.remove());
      panel().querySelector('[data-reset-link-url]').disabled = !value;
      scheduleRender();
    }
  });
  document.addEventListener('click',event => {
    if (event.target.closest('[data-close-link]')) { selectedId = null; renderInspector(); }
    if (event.target.closest('[data-reset-link-url]') && selectedId && !api.busy()) {
      api.finish(); api.mutate(content => { delete content.linkOverrides[selectedId]; });
      clearTimeout(timer); forceNext = true; api.render();
      api.announce('Pradinis nuorodos adresas grąžintas.');
    }
  });
  function applyIssue(isUrl,message) {
    const input = panel()?.querySelector(isUrl ? '[data-existing-link-url]' : '[data-existing-link-text]');
    if (!input) return false;
    api.revealTools(); input.setAttribute('aria-invalid','true');
    input.closest('.tools-field').querySelectorAll('.field-error').forEach(element => element.remove());
    const error = document.createElement('small'); error.className = 'field-error'; error.textContent = message || 'Patikrink nuorodos adresą.';
    input.closest('.tools-field').append(error); input.focus();
    return true;
  }
  function focusIssue(path,message) {
    const isUrl = path.startsWith('linkOverrides.');
    if (!isUrl && (!selectedId || path !== textPath())) return false;
    if (isUrl) {
      const id = path.slice('linkOverrides.'.length);
      if (!LINK_PARTS.some(item => item.id === id)) return false;
      selectedId = id;
      if (!anchor()) { pendingIssue = {url:true,message}; api.openLinkPage(id); }
    }
    renderInspector(true);
    return applyIssue(isUrl,message);
  }
  return {bindCanvas,renderInspector,focusIssue,cancelPending() { clearTimeout(timer); },clearSelection() { clearTimeout(timer); pendingIssue = null; selectedId = null; renderInspector(); }};
}
