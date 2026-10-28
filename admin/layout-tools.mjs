import {LAYOUT_DIMENSION_DEFAULTS, LAYOUT_FIELDS, getLayoutTargets, getLayoutTarget, getImageSettings} from '/admin/schema.mjs';
import {renderLayoutRules} from '/admin/render.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp = (value,min,max) => Math.max(min,Math.min(max,Math.round(value)));

export function createLayoutTools(api) {
  const panel = () => document.querySelector('#canvas-layout-inspector');
  let selectedId = null;
  let timer = null;
  let dragging = null;
  let suppressed = false;
  let styled = [];
  let sizeObserver = null;
  const metadata = () => getLayoutTarget(api.content(),selectedId);
  const dimensions = () => ({...LAYOUT_DIMENSION_DEFAULTS,...api.content()?.blockLayouts?.[selectedId]});
  const elementFor = id => api.doc()?.querySelector(`[data-cms-layout="${CSS.escape(id)}"]`);

  function applyStyles(doc = api.doc()) {
    if (!doc || !api.content()) return;
    for (const [element,property] of styled) if (element.isConnected && element.ownerDocument === doc) element.style.removeProperty(property);
    styled = [];
    for (const rule of renderLayoutRules(api.content())) {
      for (const element of doc.querySelectorAll(rule.selector)) {
        for (const [property,value] of Object.entries(rule.properties)) {
          element.style.setProperty(property,value,'important');
          styled.push([element,property]);
        }
      }
    }
  }
  function highlight() {
    const doc = api.doc();
    doc?.querySelectorAll('[data-layout-selected]').forEach(element => element.removeAttribute('data-layout-selected'));
    if (api.mode() === 'edit' && selectedId) elementFor(selectedId)?.setAttribute('data-layout-selected','');
    sizeObserver?.disconnect();
    const selected = selectedId && elementFor(selectedId);
    if (selected) sizeObserver?.observe(selected);
    positionHandles();
  }
  function positionHandles() {
    const doc = api.doc(), overlay = doc?.querySelector('.cms-resize-overlay');
    if (!overlay) return;
    const selected = selectedId && elementFor(selectedId);
    overlay.hidden = !selected || api.mode() !== 'edit' || api.device?.() === 'mobile';
    if (overlay.hidden) return;
    const rect = selected.getBoundingClientRect();
    for (const handle of overlay.children) {
      handle.dataset.layoutFor = selectedId;
      const axis = handle.dataset.layoutResize;
      handle.style.left = `${axis === 'y' ? rect.left+rect.width/2-14 : rect.right-8}px`;
      handle.style.top = `${axis === 'x' ? rect.top+rect.height/2-14 : rect.bottom-8}px`;
    }
  }
  function availableTargets() {
    const present = new Set([...api.doc()?.querySelectorAll('[data-cms-layout]') || []].map(element => element.dataset.cmsLayout));
    return getLayoutTargets(api.content(),api.page()).filter(target => present.has(target.id));
  }
  function renderInspector(force = false) {
    const container = panel();
    if (!container || !api.content()) return;
    container.hidden = api.mode() !== 'edit';
    if (container.hidden) return;
    if (!force && container.contains(document.activeElement)) { highlight(); return; }
    const targets = availableTargets();
    if (selectedId && !targets.some(target => target.id === selectedId)) selectedId = null;
    const target = metadata();
    const current = dimensions();
    const groups = [['section','Puslapio skiltys'],['photo','Nuotraukos'],['block','Pridėti blokai'],['part','Tekstai ir nuorodos']];
    const choices = groups.map(([type,label]) => {
      const values = targets.filter(item => item.type === type);
      return values.length ? `<optgroup label="${label}">${values.map(item => `<option value="${escape(item.id)}"${item.id === selectedId ? ' selected' : ''}>${escape(item.label)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    const fields = target ? LAYOUT_FIELDS.filter(field => target.type !== 'photo' || !field.key.startsWith('padding')).map(field => {
      const value = current[field.key];
      const invalid = value != null && (!Number.isInteger(value) || value < field.min || value > field.max);
      return `<label class="tools-field"><span>${escape(field.label)}</span><div class="layout-number"><input class="input" type="number" data-layout-field="${field.key}" min="${field.min}" max="${field.max}" step="1" value="${value ?? ''}" placeholder="Automatiškai" aria-label="${escape(field.label)} (${field.unit})"${invalid ? ' aria-invalid="true"' : ''}><span>${field.unit}</span></div>${field.key === 'width' ? `<input class="layout-width-range" type="range" min="${field.min}" max="${field.max}" step="1" value="${value ?? 100}" data-layout-range="width" aria-label="Bloko plotis slankikliu">` : ''}</label>`;
    }).join('') : '';
    container.innerHTML = `<div class="layout-inspector-heading"><strong>Bloko matmenys</strong>${target ? `<button type="button" class="icon-button" data-close-layout aria-label="Baigti matmenų redagavimą">×</button>` : ''}</div><label class="tools-field"><span>Pasirinktas blokas</span><select class="input" data-layout-target><option value="">Pasirink puslapyje arba sąraše</option>${choices}</select></label>${target ? `<p class="layout-target-name">${escape(target.label)}</p><div class="layout-fields">${fields}</div><p class="field-help">${target.type === 'photo' ? 'Plotis keičia visą nuotraukos bloką. Nurodytas aukštis turi pirmenybę prieš proporcijas.' : 'Aukštis gali padidėti, jei to reikia tekstui. Nurodžius aukštį automatiniai tarpai sumažinami.'}</p><p class="field-help">${api.device?.() === 'mobile' ? 'Telefono vaizdas prisitaiko automatiškai. Matmenis vilkdama keisk kompiuterio peržiūroje.' : 'Gali keisti matmenis ir vilkdama pažymėto bloko kraštą arba kampą.'}</p><button class="button button-outline layout-reset" type="button" data-reset-layout>Grąžinti matmenis pagal dizainą</button>` : '<p class="field-help">Paspausk nuotrauką, tekstą ar skiltį. Pažymėto bloko kraštus galima tempti pele.</p>'}`;
    highlight();
  }
  function select(id,manual = false) {
    if (!getLayoutTarget(api.content(),id) || !elementFor(id)) return;
    selectedId = id;
    api.revealTools?.();
    if (manual) {
      api.clearOtherSelection?.();
      elementFor(id).scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    }
    renderInspector(true);
  }
  function update(key,value,render = true) {
    if (!selectedId || !metadata() || api.busy()) return;
    api.mutate(content => {
      const next = {...LAYOUT_DIMENSION_DEFAULTS,...content.blockLayouts[selectedId],[key]:value};
      if (Object.values(next).every(item => item == null)) delete content.blockLayouts[selectedId];
      else content.blockLayouts[selectedId] = next;
    });
    applyStyles();
    clearTimeout(timer);
    if (render) timer = setTimeout(() => api.render(),180);
  }
  function syncControls() {
    const current = dimensions();
    for (const field of LAYOUT_FIELDS) {
      const input = panel()?.querySelector(`[data-layout-field="${field.key}"]`);
      if (!input) continue;
      const value = current[field.key];
      if (document.activeElement !== input) input.value = value ?? '';
      input.setAttribute('aria-invalid',String(value != null && (!Number.isInteger(value) || value < field.min || value > field.max)));
      const range = panel().querySelector(`[data-layout-range="${field.key}"]`);
      if (range && document.activeElement !== range) range.value = value ?? 100;
    }
    positionHandles();
  }
  function widthBasis(element,target) {
    if (target.type === 'photo') {
      const view = element.ownerDocument.defaultView;
      const mobile = view.matchMedia('(max-width:760px)').matches;
      const availableWidth = container => {
        const style = view.getComputedStyle(container);
        return Math.max(1,container.clientWidth-(parseFloat(style.paddingLeft) || 0)-(parseFloat(style.paddingRight) || 0));
      };
      const pairedWidth = container => Math.max(1,(availableWidth(container)-(parseFloat(view.getComputedStyle(container).columnGap) || 0))/2);
      const layout = element.closest('.responsive-layout');
      if (layout) {
        const columns = view.getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length;
        if (columns > 1 && layout.matches('.r-position-left,.r-position-right') && !layout.matches('.without-copy,.without-media')) return pairedWidth(layout);
        return availableWidth(element.closest('.responsive-layout-media') || layout);
      }
      const hero = element.closest('.responsive-hero');
      if (hero) {
        if (!mobile && hero.matches('.hero-position-left,.hero-position-right') && !hero.matches('.hero-hidden')) return pairedWidth(hero);
        return availableWidth(hero);
      }
      const campColumn = element.closest('.responsive-camp-left,.responsive-camp-right');
      if (campColumn) {
        const camp = campColumn.closest('.responsive-camp-middle');
        if (!mobile && camp) {
          // A single photo column uses the same original half-width as other
          // paired layouts. Two photo columns retain their existing proportions.
          if (!camp.matches('.has-left.has-right')) return pairedWidth(camp);
          const value = dimensions().width;
          const size = getImageSettings(api.content(),target.path).size;
          const percent = value ?? ({small:55,normal:75,large:100}[size] || 100);
          return Math.max(1,element.getBoundingClientRect().width/(percent/100));
        }
        return availableWidth(campColumn);
      }
      return availableWidth(element.parentElement);
    }
    const parent = element.parentElement;
    const style = element.ownerDocument.defaultView.getComputedStyle(parent);
    return Math.max(1,parent.clientWidth-parseFloat(style.paddingLeft || 0)-parseFloat(style.paddingRight || 0));
  }
  function stopResize(event,cancel = false) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const current = dragging;
    dragging = null;
    try { current.handle.releasePointerCapture(current.pointerId); } catch {}
    current.doc.documentElement.removeAttribute('data-cms-resizing');
    if (current.active) {
      event.preventDefault(); suppressed = true; setTimeout(() => { suppressed = false; },350);
      if (cancel) api.mutate(content => { if (current.original) content.blockLayouts[current.id] = current.original; else delete content.blockLayouts[current.id]; });
      clearTimeout(timer); api.render();
      if (!cancel) api.announce('Bloko matmenys pakeisti. Pakeitimą išsaugok juodraštyje.');
    }
  }
  function bindCanvas(doc) {
    styled = [];
    applyStyles(doc);
    if (api.mode() !== 'edit') { renderInspector(); return; }
    sizeObserver?.disconnect();
    sizeObserver = new doc.defaultView.ResizeObserver(positionHandles);
    const overlay = doc.createElement('div'); overlay.className = 'cms-resize-overlay'; overlay.hidden = true;
    for (const [axis,label] of [['x','Keisti bloko plotį'],['y','Keisti bloko aukštį'],['xy','Keisti bloko plotį ir aukštį']]) {
        const handle = doc.createElement('button');
        handle.type = 'button'; handle.draggable = false;
        handle.className = `cms-resize-handle cms-resize-${axis}`;
        handle.dataset.layoutResize = axis;
        handle.setAttribute('aria-label',label);
        handle.setAttribute('title',label);
        handle.setAttribute('contenteditable','false');
        overlay.append(handle);
    }
    doc.body.append(overlay);
    doc.addEventListener('scroll',positionHandles,true);
    doc.defaultView.addEventListener('resize',positionHandles);
    doc.addEventListener('click',event => {
      if (event.target.closest?.('[data-layout-resize]') || suppressed) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const target = event.target.closest?.('[data-cms-layout]');
      if (target) select(target.dataset.cmsLayout);
    },true);
    doc.addEventListener('pointerdown',event => {
      const handle = event.target.closest?.('[data-layout-resize]');
      if (!handle || dragging || event.button !== 0 || api.busy()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      clearTimeout(timer); api.finish();
      const element = elementFor(handle.dataset.layoutFor);
      if (!element) return;
      select(element.dataset.cmsLayout);
      const target = metadata();
      if (!target) return;
      const rect = element.getBoundingClientRect();
      dragging = {id:selectedId,doc,handle,element,pointerId:event.pointerId,axis:handle.dataset.layoutResize,startX:event.clientX,startY:event.clientY,startWidth:rect.width,startHeight:rect.height,basis:widthBasis(element,target),active:false,original:api.content().blockLayouts[selectedId] ? {...api.content().blockLayouts[selectedId]} : null};
      try { handle.setPointerCapture(event.pointerId); } catch {}
    },true);
    doc.addEventListener('pointermove',event => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      const dx = event.clientX-dragging.startX,dy = event.clientY-dragging.startY;
      if (!dragging.active && Math.hypot(dx,dy) < 3) return;
      dragging.active = true; event.preventDefault(); event.stopImmediatePropagation();
      doc.documentElement.setAttribute('data-cms-resizing','');
      if (dragging.axis.includes('x')) update('width',clamp((dragging.startWidth+dx)/dragging.basis*100,20,100),false);
      if (dragging.axis.includes('y')) update('height',clamp(dragging.startHeight+dy,40,2000),false);
      syncControls();
    },{capture:true,passive:false});
    doc.addEventListener('pointerup',event => stopResize(event),true);
    doc.addEventListener('pointercancel',event => stopResize(event,true),true);
    doc.addEventListener('lostpointercapture',event => stopResize(event,true),true);
    doc.addEventListener('keydown',event => {
      if (event.key === 'Escape' && dragging) stopResize({pointerId:dragging.pointerId,preventDefault() {}},true);
    },true);
    renderInspector();
  }
  document.addEventListener('change',event => {
    if (event.target.matches('[data-layout-target]')) {
      if (event.target.value) select(event.target.value,true);
      else { selectedId = null; renderInspector(true); }
    }
  });
  document.addEventListener('input',event => {
    const input = event.target;
    const key = input.dataset.layoutField || input.dataset.layoutRange;
    if (!key || !LAYOUT_FIELDS.some(field => field.key === key)) return;
    update(key,input.value === '' ? null : Number(input.value));
    syncControls();
  });
  document.addEventListener('click',event => {
    if (event.target.closest('[data-close-layout]')) { selectedId = null; renderInspector(true); }
    if (event.target.closest('[data-reset-layout]') && selectedId && !api.busy()) {
      api.mutate(content => { delete content.blockLayouts[selectedId]; });
      clearTimeout(timer); api.render(); renderInspector(true);
      api.announce('Bloko matmenys grąžinti pagal dizainą.');
    }
  });
  function focusIssue(path,message) {
    const match = /^blockLayouts\.([a-zA-Z0-9-]+)\.(width|height|paddingTop|paddingBottom)$/.exec(path);
    if (!match) return false;
    select(match[1],true);
    const input = panel()?.querySelector(`[data-layout-field="${match[2]}"]`);
    if (!input) return false;
    input.setAttribute('aria-invalid','true');
    const error = document.createElement('small'); error.className = 'field-error'; error.textContent = message || 'Patikrink šį matmenį.';
    input.closest('.tools-field').append(error); input.focus();
    return true;
  }
  return {bindCanvas,renderInspector,applyStyles,focusIssue,cancelPending() { clearTimeout(timer); },clearSelection() { clearTimeout(timer); selectedId = null; renderInspector(true); }};
}
