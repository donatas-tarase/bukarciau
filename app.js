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

// One silent background video becomes the full, audible invitation on request.
const video = document.querySelector('#promo-video');
if (video) {
  const stage = video.closest('.video-stage');
  const home = document.querySelector('[data-video-home]');
  const dialog = document.querySelector('#video-dialog');
  const dialogMount = document.querySelector('[data-video-dialog-mount]');
  const listenButton = document.querySelector('[data-video-sound]');
  const soundButton = document.querySelector('[data-dialog-sound]');
  const toggleButtons = document.querySelectorAll('[data-video-toggle], [data-dialog-toggle]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let wasPaused = false;
  function syncVideoControls() {
    const paused = video.paused || video.ended;
    for (const button of toggleButtons) {
      button.setAttribute('aria-label', paused ? (video.ended ? 'Paleisti video iš naujo' : 'Paleisti video') : 'Sustabdyti video');
      button.querySelector('[data-video-play-icon]').toggleAttribute('hidden', !paused);
      button.querySelector('[data-video-pause-icon]').toggleAttribute('hidden', paused);
    }
    const soundOn = !video.muted;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Išjungti video garsą' : 'Įjungti video garsą');
    soundButton.querySelector('[data-video-sound-label]').textContent = soundOn ? 'Išjungti garsą' : 'Įjungti garsą';
    soundButton.querySelector('[data-video-muted-icon]').toggleAttribute('hidden', soundOn);
    soundButton.querySelector('[data-video-audio-icon]').toggleAttribute('hidden', !soundOn);
  }
  function playVideo() {
    if (video.ended) video.currentTime = 0;
    video.play().catch(syncVideoControls);
  }
  listenButton.addEventListener('click', () => {
    wasPaused = video.paused;
    dialogMount.append(stage);
    dialog.showModal();
    document.body.classList.add('video-open');
    video.muted = false;
    video.loop = false;
    video.currentTime = 0;
    playVideo();
    syncVideoControls();
  });
  document.querySelector('[data-close-video]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    video.muted = true;
    video.loop = true;
    home.append(stage);
    document.body.classList.remove('video-open');
    if (wasPaused || reducedMotion.matches) video.pause();
    else playVideo();
    syncVideoControls();
    listenButton.focus({preventScroll:true});
  });
  soundButton.addEventListener('click', () => {
    video.muted = !video.muted;
    syncVideoControls();
  });
  for (const button of toggleButtons) button.addEventListener('click', () => {
    if (video.paused || video.ended) playVideo();
    else video.pause();
  });
  for (const event of ['play', 'pause', 'ended', 'volumechange', 'loadedmetadata']) video.addEventListener(event, syncVideoControls);
  function showVideoError() {
    document.querySelector('[data-video-error]').hidden = false;
  }
  video.addEventListener('error', showVideoError);
  video.querySelector('source').addEventListener('error', showVideoError);
  reducedMotion.addEventListener('change', event => {
    if (event.matches && !dialog.open) video.pause();
  });
  video.muted = true;
  if (reducedMotion.matches) {
    video.autoplay = false;
    video.pause();
  } else playVideo();
  syncVideoControls();
}
