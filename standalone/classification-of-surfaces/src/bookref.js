// bookref.js — a book citation shows its words on hover (or on the first tap) and opens the book at that page on a
// click. <a class="bk" data-p="94" data-q="words from that page">p. 94</a>. His rule of 2 Nov 2026.
// The scan of the book is served on the tailnet only, so the link works on his devices and nowhere else.

const PDF = 'http://intel/animated-groups/Conway%20J.%2C%20Goodman-Strauss%20C.%20%282008%29%20The%20Symmetries%20of%20Things.pdf';
const OFFSET = 19;            // PDF page = printed page + 19
const BOOK = 'Conway, Burgiel & Goodman-Strauss, The Symmetries of Things';

/** The html of a citation made while the page runs (the popover's handlers are delegated, so it just works). */
export function bookLink(page, words, text = 'p. ' + page) {
  const q = String(words).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<a class="bk" href="${PDF}#page=${page + OFFSET}" target="_blank" rel="noopener" data-p="${page}" data-q="${q}" aria-label="${text}: “${q}”">${text}</a>`;
}

/** open: false for a page meant for everyone: the citation shows its words and names the book, and links nowhere (the scan is on his tailnet only). */
export function initBookRefs(pop, { open = true } = {}) {
  let shown = null, hideTimer = 0;
  for (const a of document.querySelectorAll('a.bk')) {
    if (open) { a.href = `${PDF}#page=${Number(a.dataset.p) + OFFSET}`; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.removeAttribute('href'); a.tabIndex = 0; a.setAttribute('role', 'note'); }
    a.setAttribute('aria-label', `${a.textContent}: “${a.dataset.q}”`);
  }
  function show(a) {
    clearTimeout(hideTimer);
    if (shown === a) return;
    shown = a;
    pop.textContent = '';
    const q = document.createElement('q'); q.textContent = a.dataset.q;
    const src = document.createElement('span'); src.className = 'bkpop-src'; src.textContent = `${BOOK}, ${a.textContent}${open ? ' · ' : ''}`;
    if (open) { const link = document.createElement('a'); link.href = a.href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'open the page'; src.append(link); }
    pop.append(q, src);
    pop.hidden = false;
    const r = a.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.bottom + 8 + h <= vh ? r.bottom + 8 : Math.max(8, r.top - h - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function hide() { shown = null; pop.hidden = true; }
  const later = () => { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 180); };
  document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const a = e.target.closest && e.target.closest('a.bk'); if (a) show(a); else if (pop.contains(e.target)) clearTimeout(hideTimer); });
  document.addEventListener('pointerout', (e) => { if (e.pointerType !== 'mouse') return; if ((e.target.closest && e.target.closest('a.bk')) || pop.contains(e.target)) later(); });
  document.addEventListener('focusin', (e) => { const a = e.target.closest && e.target.closest('a.bk'); if (a) show(a); });
  document.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('a.bk')) later(); });
  // a touch screen has no hover: the first tap shows the words (the popover carries the link), a tap elsewhere closes
  let lastTouch = 0;
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') lastTouch = performance.now(); if (shown && !pop.contains(e.target) && !(e.target.closest && e.target.closest('a.bk'))) hide(); }, true);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.bk');
    if (!a) return;
    if (!open) { e.preventDefault(); if (shown === a && performance.now() - lastTouch < 800) hide(); else show(a); return; }
    if (performance.now() - lastTouch < 800 && shown !== a) { e.preventDefault(); show(a); }
    else if (performance.now() - lastTouch < 800 && shown === a) { e.preventDefault(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shown) hide(); });
  window.addEventListener('scroll', () => { if (shown) hide(); }, { passive: true });
}
