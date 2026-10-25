const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu({restoreFocus = false} = {}) {
  if (!toggle) return;
  const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Atidaryti meniu');
  document.body.classList.remove('menu-open');
  if (wasOpen && restoreFocus) toggle.focus();
}
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Uždaryti meniu' : 'Atidaryti meniu');
  document.body.classList.toggle('menu-open', open);
});
navigation?.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu({restoreFocus: navigation?.contains(document.activeElement)});
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
matchMedia('(min-width: 761px)').addEventListener('change', () => closeMenu());

