/* Play the Showcase clips of the "Visualizations" section while they are on
 * screen, and only then.
 *
 * The section (enumerate/correspondence_visualizations.py) ships posters, which
 * is the whole page without this file: a still picture behind every link.  Here
 * each poster that is actually being looked at gets a <video> laid over it and
 * played, and loses it again the moment it leaves — when the reader scrolls
 * away, when another clockwork tab is shown (the panels are hidden, so the
 * observer stops seeing them), or when the tab goes to the background.
 *
 * Dropping the element is not enough to free a decoder; pausing, removing the
 * src and calling load() is, which is what docs/showcase/showcase.mjs does and
 * why it is done the same way here.  A reader who asks for reduced motion never
 * gets a video at all, and changes their mind without reloading.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const ROOT_MARGIN = '100px';

const playing = new Map();          // .viz-clip-art -> its <video>
const onScreen = new Set();

function wanted() {
  return !REDUCED.matches && document.visibilityState !== 'hidden';
}

function attach(art) {
  if (playing.has(art) || art.querySelector('video')) return;
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.preload = 'auto';
  video.poster = art.querySelector('img')?.src ?? '';
  video.src = art.dataset.preview;
  art.prepend(video);
  playing.set(art, video);
  const started = video.play();
  if (started && started.catch) started.catch(() => { /* a refused autoplay leaves the poster */ });
}

function detach(art) {
  const video = playing.get(art) ?? art.querySelector('video');
  playing.delete(art);
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();                     // this, not the removal, frees the decoder
  video.remove();
}

function reconcile() {
  if (!wanted()) {
    for (const art of [...playing.keys()]) detach(art);
    return;
  }
  for (const art of [...playing.keys()]) {
    if (!onScreen.has(art) || !art.isConnected || art.offsetParent === null) detach(art);
  }
  for (const art of onScreen) {
    if (!art.isConnected) continue;
    if (art.offsetParent === null) continue;   // its clockwork tab is not the shown one
    attach(art);
  }
}

function start() {
  const arts = document.querySelectorAll('.viz-clip-art[data-preview]');
  if (!arts.length) return;
  if (typeof IntersectionObserver !== 'function') return;   // the posters stay
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) onScreen.add(entry.target);
      else onScreen.delete(entry.target);
    }
    reconcile();
  }, { rootMargin: ROOT_MARGIN });
  for (const art of arts) observer.observe(art);

  const listen = (target, type) => target.addEventListener(type, reconcile);
  if (REDUCED.addEventListener) listen(REDUCED, 'change');
  else if (REDUCED.addListener) REDUCED.addListener(reconcile);
  listen(document, 'visibilitychange');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
