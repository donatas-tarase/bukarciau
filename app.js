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

// Browsers allow automatic playback when the video starts muted.
const video = document.querySelector('#promo-video');
if (video) {
  const soundButton = document.querySelector('[data-video-sound]');
  const toggleButton = document.querySelector('[data-video-toggle]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function syncVideoControls() {
    const paused = video.paused || video.ended;
    const soundOn = !video.muted;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Išjungti video garsą' : 'Įjungti garsą ir paleisti video nuo pradžios');
    soundButton.querySelector('[data-video-sound-label]').textContent = soundOn ? 'Išjungti garsą' : 'Įjungti garsą';
    soundButton.querySelector('[data-video-muted-icon]').toggleAttribute('hidden', soundOn);
    soundButton.querySelector('[data-video-audio-icon]').toggleAttribute('hidden', !soundOn);
    toggleButton.setAttribute('aria-label', paused ? (video.ended ? 'Paleisti video iš naujo' : 'Paleisti video') : 'Sustabdyti video');
    toggleButton.querySelector('[data-video-play-icon]').toggleAttribute('hidden', !paused);
    toggleButton.querySelector('[data-video-pause-icon]').toggleAttribute('hidden', paused);
  }
  function playVideo() {
    video.play().catch(() => syncVideoControls());
  }
  soundButton.addEventListener('click', () => {
    const enableSound = video.muted;
    video.muted = !enableSound;
    video.loop = !enableSound;
    if (enableSound) video.currentTime = 0;
    playVideo();
    syncVideoControls();
  });
  toggleButton.addEventListener('click', () => {
    if (video.paused || video.ended) playVideo();
    else video.pause();
  });
  for (const event of ['play', 'pause', 'ended', 'volumechange', 'loadedmetadata']) {
    video.addEventListener(event, syncVideoControls);
  }
  video.addEventListener('error', () => {
    document.querySelector('[data-video-error]').hidden = false;
    document.querySelector('.video-actions').hidden = true;
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) video.pause();
  });
  video.muted = true;
  if (reducedMotion.matches) {
    video.autoplay = false;
    video.pause();
  } else playVideo();
  syncVideoControls();
}
