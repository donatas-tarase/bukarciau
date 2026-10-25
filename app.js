const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#navigation');
function closeMenu(){if(!toggle)return;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Atidaryti meniu');document.body.classList.remove('menu-open');}
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Uždaryti meniu':'Atidaryti meniu');document.body.classList.toggle('menu-open',open);});
nav?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();}});
document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))closeMenu();});
const media=matchMedia('(min-width: 761px)');media.addEventListener('change',()=>closeMenu());
const dialog=document.querySelector('#registration-dialog');
document.querySelectorAll('[data-registration-pending]').forEach(button=>button.addEventListener('click',()=>dialog.showModal()));
dialog?.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
