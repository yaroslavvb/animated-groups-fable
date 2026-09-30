// The Shubnikov page: three levels of tabs over the 990 cyclic colourings, a
// grid of live cards, and one viewer dialog.
//
// The skeleton — tabs, panels, colour-count sections and their counts — is
// stamped into index.html by tools/make_page.py, so it reads without any of
// this.  What happens here is: fetch the census, fill the grid of the one film
// panel that is on screen with canvases, and animate the ones you can see.
//
// Only one film group's cards exist at a time.  Switching films tears the old
// ones down, which keeps the page to a few dozen canvases however long you
// browse.

import {
  loadCensus, expandClass, timeSlice, viewWidth, filmGeometry,
} from './shub-field.mjs';
import { createRenderer, inkBytes, inkCss } from './shub-render.mjs';

const PERIOD_SECONDS = 4;       // wall-clock seconds for one film period
const FRAME_MS = 1000 / 30;     // the animation is throttled to about 30 fps
const NS = [2, 3, 4, 6];
const KEYS = ['ct0', 'ctne'];

const params = new URLSearchParams(location.search);
const phone = window.matchMedia('(max-width: 560px)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const main = document.querySelector('main.shubnikov-page');
const statusEl = main.querySelector('[data-status]');
const motionEl = main.querySelector('[data-motion]');
// The notes that belong under every colour count and every clock group, shipped
// once rather than six hundred times; make_page.py writes the island.
const PROSE = JSON.parse(document.querySelector('#shub-prose')?.textContent || '{}');

const state = {
  census: null,
  names: {},
  filterN: 'all',
  filterKey: 'all',
  view: 'greys',
  playing: !reduceMotion.matches,
  family: null,
  filmOf: new Map(),            // family symbol -> the film shown in it
  t: 0,
  cards: new Map(),             // class id -> the grid card built for it
  hero: null,                   // the card drawn beside the lede, if any
  onScreen: new Set(),          // card records the IntersectionObserver likes
  pending: new Set(),           // card records that need one draw while paused
};

// The hero and a grid card can be the same class, so a class id cannot identify
// a card: the observer and emptyGrid resolve a record from its own figure.
const cardOf = new WeakMap();   // figure element -> card record

/** Every card that exists right now: the hero, then the grid in document order. */
function* liveCards() {
  if (state.hero) yield state.hero;
  yield* state.cards.values();
}

let renderer = null;
let viewer = null;

// The CPU twin costs a thousand times what the GPU does per pixel, so it gets
// one card at a time; frame() also keeps a millisecond budget, below.
const capCards = () => {
  if (renderer && renderer.kind === 'cpu') return 1;
  return phone.matches ? 8 : 24;
};
const FRAME_BUDGET_MS = 8;
const dprCap = () => Math.min(window.devicePixelRatio || 1, phone.matches ? 1.5 : 2);
// Every pixel costs one pass over up to 72 plane waves, so the drawing buffers
// are capped: a card never needs more than a few hundred pixels an edge, and
// the viewer is sharp enough at 900 without asking a weak GPU for four times
// the work on a retina screen.
const CARD_PIXELS = 360;
const VIEWER_PIXELS = 900;

// ------------------------------------------------------------- utilities ---

/** sigma read off the named generators, plus on one period of the film. */
function sigmaText(cls) {
  const parts = Object.entries(cls.col).map(([name, value]) => `${name}↦${value}`);
  return `${parts.join(' ')} · t↦${cls.ct}`;
}

function sigmaWords(cls) {
  const parts = Object.entries(cls.col).map(([name, value]) => `${name} to ${value}`);
  parts.push(`time to ${cls.ct}`);
  return parts.join(', ');
}

const classIndex = (cls) => cls.id.slice(cls.id.lastIndexOf('-') + 1);

function nameOf(cls) {
  const entry = state.names[cls.id];
  if (!entry) return null;
  return (cls.n === 2 && entry.shubnikov) || entry.gs || entry.colored || null;
}

/** Every class of one film, in census order, with the filters applied. */
function classesFor(gid, n, key) {
  const all = state.census.byFilm.get(gid) || [];
  return all.filter((cls) => cls.n === n && cls.key === key);
}

function matchesFilters(n, key) {
  if (state.filterN !== 'all' && n !== state.filterN) return false;
  if (state.filterKey !== 'all' && key !== state.filterKey) return false;
  return true;
}

// ------------------------------------------------- prose written from data --

const VULGAR = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/6': '⅙', '5/6': '⅚',
};
const KIND_WORDS = { glide: 'glide reflection' };
const COUNT_WORDS = { 2: 'two colours', 3: 'three', 4: 'four', 6: 'six' };
const NUMBER_WORDS = { 2: 'two', 3: 'three', 4: 'four', 6: 'six' };

function generatorPhrase(gen) {
  const kind = KIND_WORDS[gen.kind] || gen.kind;
  const shift = gen.timeShift;
  const tail = Number(shift.split('/')[0]) === 0
    ? 'leaves time where it is'
    : `advances time by ${VULGAR[shift] || shift} of a period`;
  return `<span class="gen"><b>${gen.name}</b> — ${kind}, ${tail}</span>`;
}

/** The paragraph that opens a film panel: what this film group is. */
function filmDescription(gid) {
  const film = state.census.films[gid];
  const counts = NS.map((n) => [n, Number(film.counts[n] || 0)]).filter(([, k]) => k);
  const total = counts.reduce((sum, [, k]) => sum + k, 0);
  const clock = film.N === 1
    ? `Every symmetry of this film keeps time where it is, so the film group is just ${film.family} riding along with the loop.`
    : `Its symmetries move time in steps of 1/${film.N} of a period.`;
  const gens = film.gens.map(generatorPhrase).join('; ');
  const spelled = counts.map(([n, k]) => `${k} with ${COUNT_WORDS[n]}`).join(', ');
  // Some films name translations among their generators — the two slides of
  // P1, the half-cell centring of Pm — so "beside the lattice translations"
  // would contradict the list that follows it.
  const anyTranslation = film.gens.some((gen) => gen.kind === 'translation');
  const allTranslations = film.gens.every((gen) => gen.kind === 'translation');
  let lead;
  if (allTranslations) lead = 'Its symmetries are generated by the translations ';
  else if (anyTranslation) lead = 'Beside the parent lattice translations its symmetries are generated by ';
  else lead = 'Beside the lattice translations its symmetries are generated by ';
  const genText = allTranslations
    ? film.gens.map((gen) => `<span class="gen"><b>${gen.name}</b></span>`).join(' and ') + ' alone'
    : gens;
  return `<b>${gid}</b> is the film group <span class="sym">${film.signature}</span> over `
    + `${film.family}. ${clock} Lifted to three dimensions, with time as the polar axis, it is `
    + `the space group <span class="shub-sg">${film.sgName}</span>. ${lead}${genText}. `
    + `It carries <b>${total}</b> cyclic colourings: ${spelled}.`;
}

/** Put the film's description and the prose notes into a panel, once. */
function decorateFilm(filmEl) {
  if (filmEl.dataset.prose === '1') return;
  filmEl.dataset.prose = '1';
  const description = document.createElement('p');
  description.className = 'shub-filmdesc';
  description.innerHTML = filmDescription(filmEl.dataset.film);
  filmEl.prepend(description);
  for (const details of filmEl.querySelectorAll('details.shub-n')) {
    if (details.dataset.empty === 'true') continue;
    const note = document.createElement('p');
    note.className = 'note';
    note.innerHTML = (PROSE.nNote || {})[details.dataset.n] || '';
    details.querySelector('summary').after(note);
    for (const group of details.querySelectorAll('.shub-ck')) {
      const line = document.createElement('p');
      line.className = 'note';
      line.innerHTML = (PROSE.keyNote || {})[group.dataset.key] || '';
      group.querySelector('h4').after(line);
    }
  }
}

// -------------------------------------------------------------- the cards --

function cardFor(cls, { onOpen = null } = {}) {
  const census = state.census;
  const film = census.films[cls.gid];
  const geom = filmGeometry(film);
  const field = expandClass(census, cls);

  const figure = document.createElement('figure');
  figure.className = 'shub-card';
  figure.tabIndex = 0;
  figure.setAttribute('role', 'button');
  figure.dataset.class = cls.id;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const label = nameOf(cls);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    `Colouring ${classIndex(cls)} of film group ${cls.gid} in ${cls.n} colours; `
    + `sigma sends ${sigmaWords(cls)}; `
    + (cls.m > 1 ? `the coloured film repeats after ${cls.m} periods.` : 'the coloured film repeats every period.'),
  );
  figure.append(canvas);

  const caption = document.createElement('figcaption');
  const idx = document.createElement('span');
  idx.className = 'idx';
  idx.textContent = `#${classIndex(cls)}`;
  const sigma = document.createElement('span');
  sigma.className = 'sigma';
  sigma.textContent = sigmaText(cls);
  caption.append(idx, sigma);
  if (label) {
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label;
    caption.append(name);
  }
  if (cls.m > 1) {
    const repeat = document.createElement('span');
    repeat.className = 'repeat';
    repeat.textContent = `repeats after ${cls.m} periods`;
    caption.append(repeat);
  }
  figure.append(caption);

  const card = {
    cls, film, geom, field, figure, canvas,
    ctx: canvas.getContext('2d'),
    width: viewWidth(census, film),
    slice: new Float32Array(field.count * 4),
    size: 0,
  };
  cardOf.set(figure, card);

  const open = onOpen || (() => openViewer(cls.id, { push: true }));
  figure.addEventListener('click', open);
  figure.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function sizeCard(card) {
  const css = card.canvas.clientWidth;
  if (!css) return false;
  const size = Math.max(48, Math.min(CARD_PIXELS, Math.round(css * dprCap())));
  if (size !== card.size) {
    card.size = size;
    card.canvas.width = size;
    card.canvas.height = size;
    return true;
  }
  return false;
}

function drawCard(card, t) {
  if (!card.size && !sizeCard(card)) return;
  timeSlice(card.field, t, card.slice);
  renderer.draw(card.ctx, {
    field: card.field,
    slice: card.slice,
    toLattice: card.geom.toLattice,
    width: card.width,
    n: card.cls.n,
    view: state.view,
    size: card.size,
    t,
  });
}

let observer = null;
function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = cardOf.get(entry.target);
      if (!card) continue;
      if (entry.isIntersecting) {
        state.onScreen.add(card);
        state.pending.add(card);
      } else {
        state.onScreen.delete(card);
        state.pending.delete(card);
      }
    }
    report();
    kick();
  }, { rootMargin: '150px' });
  return observer;
}

let resizer = null;
function ensureResizer() {
  if (resizer) return resizer;
  resizer = new ResizeObserver(() => {
    for (const card of liveCards()) {
      if (sizeCard(card) && state.onScreen.has(card)) state.pending.add(card);
    }
    kick();
  });
  return resizer;
}

/** Which classes a grid holds: the film panel, the colour count, the clock group. */
function gridWhere(grid) {
  return {
    gid: grid.closest('.shub-film').dataset.film,
    n: Number(grid.closest('details.shub-n').dataset.n),
    key: grid.closest('.shub-ck').dataset.key,
  };
}

function fillGrid(grid) {
  if (grid.dataset.filled === '1') return;
  const { gid, n, key } = gridWhere(grid);
  const frag = document.createDocumentFragment();
  for (const cls of classesFor(gid, n, key)) {
    const card = cardFor(cls);
    state.cards.set(cls.id, card);
    frag.append(card.figure);
    ensureObserver().observe(card.figure);
  }
  grid.append(frag);
  grid.dataset.filled = '1';
  grid.dataset.count = String(grid.childElementCount);
  ensureResizer().observe(grid);
}

function emptyGrid(grid) {
  if (grid.dataset.filled !== '1') return;
  for (const figure of grid.children) {
    const card = cardOf.get(figure);
    if (!card) continue;
    ensureObserver().unobserve(figure);
    state.onScreen.delete(card);
    state.pending.delete(card);
    // only drop the map entry if it is still this card's: the hero shares a class
    if (state.cards.get(card.cls.id) === card) state.cards.delete(card.cls.id);
    cardOf.delete(figure);
  }
  ensureResizer().unobserve(grid);
  grid.replaceChildren();
  grid.dataset.filled = '0';
}

/** The colouring beside the lede: one of the 990, moving, before any tab is touched. */
function buildHero() {
  const box = main.querySelector('[data-hero]');
  if (!box) return;
  const cls = state.census.byId.get(box.dataset.hero);
  if (!cls) { box.remove(); return; }
  const film = state.census.films[cls.gid];
  const card = cardFor(cls, {
    onOpen: () => {
      // the hero belongs to a film in another panel: go there, then open it
      setHash(`${film.family}/${cls.gid}/${cls.id}`, 'push');
      applyHash({ scroll: false });
    },
  });
  card.figure.classList.add('shub-hero-card');
  const caption = document.createElement('figcaption');
  caption.className = 'shub-hero-caption';
  caption.innerHTML = `One of the 990: <b>${cls.gid}</b> over ${film.family}, `
    + `${cls.n} colours. Open it, or take any tab below.`;
  card.figure.replaceChild(caption, card.figure.querySelector('figcaption'));
  box.replaceChildren(card.figure);
  // deliberately not in state.cards: a grid card for the same class would
  // otherwise displace it, and the observer could never find it again
  state.hero = card;
  ensureObserver().observe(card.figure);
  ensureResizer().observe(box);
}

// ------------------------------------------------------------ the filters --

function countVisible(gid) {
  let total = 0;
  for (const n of NS) {
    for (const key of KEYS) {
      if (!matchesFilters(n, key)) continue;
      total += classesFor(gid, n, key).length;
    }
  }
  return total;
}

/** Apply the filters to the static skeleton and refresh every count. */
function applyFilters() {
  for (const details of main.querySelectorAll('details.shub-n')) {
    const n = Number(details.dataset.n);
    details.hidden = state.filterN !== 'all' && n !== state.filterN;
    for (const group of details.querySelectorAll('.shub-ck')) {
      group.hidden = state.filterKey !== 'all' && group.dataset.key !== state.filterKey;
    }
    const shown = [...details.querySelectorAll('.shub-ck')].filter((g) => !g.hidden);
    const empty = details.dataset.empty === 'true';
    if (!empty) {
      const gid = details.closest('.shub-film').dataset.film;
      const count = shown.reduce(
        (sum, g) => sum + classesFor(gid, n, g.dataset.key).length, 0,
      );
      const badge = details.querySelector('summary > b');
      if (badge) badge.textContent = String(count);
      details.hidden = details.hidden || count === 0;
    }
  }
  // A tab's aria-label overrides its contents, so the count a filter rewrites
  // has to be written into the label too, or the two disagree; and a tab that
  // now leads nowhere has to say so in more than a CSS opacity.
  for (const tab of main.querySelectorAll('.shub-tab')) {
    const hm = tab.dataset.family;
    const total = state.census.families[hm].films.reduce((sum, gid) => sum + countVisible(gid), 0);
    tab.querySelector('[data-tabcount]').textContent = String(total);
    tab.classList.toggle('empty', total === 0);
    relabel(tab, total);
  }
  for (const tab of main.querySelectorAll('.shub-filmtab')) {
    const sub = tab.querySelector('.sub');
    const parts = sub.textContent.split(' · ');
    const total = countVisible(tab.dataset.film);
    parts[parts.length - 1] = String(total);
    sub.textContent = parts.join(' · ');
    tab.classList.toggle('empty', total === 0);
    relabel(tab, total);
  }
}

/**
 * Keep a tab's accessible name in step with its count.  aria-label overrides
 * the contents, so the number the filters rewrite has to go into the label
 * too, or a screen reader is told 150 while the tab shows 0.  The tab is not
 * marked disabled: an emptied tab still selects its family and still explains
 * itself, and "0 colourings" in the name already says where it leads.
 */
function relabel(tab, total) {
  const stem = tab.dataset.labelStem;
  if (stem) tab.setAttribute('aria-label', `${stem}, ${total} colourings`);
}

/**
 * When the filters empty the film on screen, say so where the cards would be.
 * Without this the panel simply runs into the footer: ten of the seventeen
 * families do that under Colours = 3 and Invisible to the clock.
 */
function showEmptyNote() {
  for (const film of main.querySelectorAll('.shub-film')) {
    const note = film.querySelector('[data-filter-empty]');
    const live = !film.hidden && !film.closest('.shub-panel').hidden;
    if (!live || countVisible(film.dataset.film) > 0) {
      if (note) note.remove();
      continue;
    }
    if (note) continue;
    const box = document.createElement('p');
    box.className = 'shub-empty';
    box.dataset.filterEmpty = '';
    const clauses = [];
    if (state.filterN !== 'all') clauses.push(`has ${NUMBER_WORDS[state.filterN]} colours`);
    if (state.filterKey === 'ct0') clauses.push('is invisible to the clock');
    if (state.filterKey === 'ctne') clauses.push('moves its colours with the clock');
    box.append(`No colouring of ${film.dataset.film} ${clauses.join(' and ')}. `);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'shub-linkbutton';
    reset.textContent = 'Show all of them';
    reset.addEventListener('click', clearFilters);
    box.append(reset);
    film.append(box);
  }
}

function clearFilters() {
  state.filterN = 'all';
  state.filterKey = 'all';
  pressGroup([...main.querySelectorAll('[data-filter-n]')], main.querySelector('[data-filter-n="all"]'));
  pressGroup([...main.querySelectorAll('[data-filter-key]')], main.querySelector('[data-filter-key="all"]'));
  applyFilters();
  syncCards();
}

// ------------------------------------------------------------ mount/unmount

function activeFilm(hm) {
  const films = state.census.families[hm].films;
  const chosen = state.filmOf.get(hm);
  return films.includes(chosen) ? chosen : films[0];
}

/** Build the cards of the one film panel on screen; tear down all the others. */
function syncCards() {
  const liveGid = state.family ? activeFilm(state.family) : null;
  for (const grid of main.querySelectorAll('[data-grid]')) {
    const details = grid.closest('details.shub-n');
    const group = grid.closest('.shub-ck');
    const live = grid.closest('.shub-film').dataset.film === liveGid
      && details.open && !details.hidden && !group.hidden;
    if (live) fillGrid(grid); else emptyGrid(grid);
  }
  showEmptyNote();
  report();
  kick();
}

function report() {
  const totals = state.census.totals;
  // What the panel holds is a fact about the census, not about how much of it
  // happens to be mounted; the hero belongs to no panel and is left out of both.
  const inPanel = state.family ? countVisible(activeFilm(state.family)) : 0;
  let onScreen = 0;
  for (const card of state.onScreen) if (card !== state.hero) onScreen += 1;
  const animating = Math.min(onScreen, capCards());
  // Assigning the same string still mutates the node, and a live region is
  // re-announced on mutation, not on change — so compare before writing.
  const line = `${totals.all} colourings · ${inPanel} on this panel`;
  if (statusEl.textContent !== line) statusEl.textContent = line;
  // The live region says only the part that changes when you choose something.
  // The drawing count changes on every scroll, and a screen reader that read
  // it out each time would talk over the page.
  motionEl.textContent = state.playing ? ` · ${animating} drawing` : ' · paused';
}

// -------------------------------------------------------------- the clock --

let raf = 0;
let lastFrame = 0;

function kick() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function frame(now) {
  raf = 0;
  if (document.hidden) return;
  const gap = lastFrame ? now - lastFrame : FRAME_MS;
  if (gap < FRAME_MS - 1) {
    raf = requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(gap, 250) / 1000;
  lastFrame = now;

  if (state.playing) state.t += dt / PERIOD_SECONDS;
  if (viewer && viewer.open && viewer.playing) {
    viewer.t = (viewer.t + (dt / PERIOD_SECONDS) * viewer.speed) % viewer.card.cls.m;
    drawViewer();
    syncScrub();
  }

  // Document order, so the row you are looking at wins the animation budget;
  // whatever falls outside it still gets its one still frame from `pending`.
  // Both loops also stop at FRAME_BUDGET_MS: on the CPU twin a single card can
  // cost tens of milliseconds, and a scroll that mounts twenty of them must
  // not turn one callback into a two-second freeze.  What is left over stays
  // in `pending` and is drawn by the frames after this one.
  const started = performance.now();
  const overBudget = () => performance.now() - started > FRAME_BUDGET_MS;
  if (state.playing) {
    const cap = capCards();
    let drawn = 0;
    for (const card of liveCards()) {
      if (!state.onScreen.has(card)) continue;
      if (drawn >= cap) break;
      drawCard(card, state.t);
      state.pending.delete(card);
      drawn += 1;
      if (overBudget()) break;
    }
  }
  for (const card of state.pending) {
    drawCard(card, state.t);
    state.pending.delete(card);
    if (overBudget()) break;
  }

  const busy = (state.playing && state.onScreen.size > 0)
    || state.pending.size > 0
    || (viewer && viewer.open && viewer.playing);
  if (busy) raf = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
  } else {
    lastFrame = 0;
    kick();
  }
});

// --------------------------------------------------------------- the tabs --

// Tabs replace the URL rather than push it: the ARIA pattern activates on
// arrow, so arrowing across the seventeen groups would otherwise bury the
// referring page under seventeen Back presses.  Only opening a card pushes.
function selectFamily(hm, { focus = false, hash = 'replace' } = {}) {
  if (!state.census.families[hm]) return false;
  state.family = hm;
  for (const tab of main.querySelectorAll('.shub-tab')) {
    const on = tab.dataset.family === hm;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  }
  for (const panel of main.querySelectorAll('.shub-panel')) {
    panel.hidden = panel.dataset.family !== hm;
  }
  selectFilm(hm, activeFilm(hm), { hash: null });
  if (hash) setHash(`${hm}/${activeFilm(hm)}`, hash);
  return true;
}

function selectFilm(hm, gid, { focus = false, hash = 'replace' } = {}) {
  const films = state.census.families[hm].films;
  if (!films.includes(gid)) return false;
  state.filmOf.set(hm, gid);
  const panel = main.querySelector(`#panel-${CSS.escape(hm)}`);
  for (const tab of panel.querySelectorAll('.shub-filmtab')) {
    const on = tab.dataset.film === gid;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  }
  for (const film of panel.querySelectorAll('.shub-film')) {
    if (films.length > 1) film.hidden = film.dataset.film !== gid;
    if (film.dataset.film === gid) decorateFilm(film);
  }
  syncCards();
  if (hash) setHash(`${hm}/${gid}`, hash);
  return true;
}

function wireTablist(tabs, onSelect) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => onSelect(tab, { focus: false }));
    tab.addEventListener('keydown', (event) => {
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      onSelect(tabs[next], { focus: true });
    });
  });
}

function wireTabs() {
  const tabs = [...main.querySelectorAll('.shub-tabstrip .shub-tab')];
  wireTablist(tabs, (tab, opts) => selectFamily(tab.dataset.family, opts));
  for (const panel of main.querySelectorAll('.shub-panel')) {
    const filmTabs = [...panel.querySelectorAll('.shub-filmtabs .shub-filmtab')];
    if (!filmTabs.length) continue;
    wireTablist(filmTabs, (tab, opts) => selectFilm(panel.dataset.family, tab.dataset.film, opts));
  }
  for (const details of main.querySelectorAll('details.shub-n')) {
    if (details.dataset.empty === 'true') {
      details.addEventListener('click', (event) => {
        if (event.target.closest('summary')) event.preventDefault();
      });
    }
    details.addEventListener('toggle', syncCards);
  }
}

// ----------------------------------------------------------- the controls --

function pressGroup(buttons, chosen) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button === chosen));
}

function wireControls() {
  const nButtons = [...main.querySelectorAll('[data-filter-n]')];
  for (const button of nButtons) {
    button.addEventListener('click', () => {
      const value = button.dataset.filterN;
      state.filterN = value === 'all' ? 'all' : Number(value);
      pressGroup(nButtons, button);
      applyFilters();
      syncCards();
    });
  }
  const keyButtons = [...main.querySelectorAll('[data-filter-key]')];
  for (const button of keyButtons) {
    button.addEventListener('click', () => {
      state.filterKey = button.dataset.filterKey;
      pressGroup(keyButtons, button);
      applyFilters();
      syncCards();
    });
  }
  const viewButtons = [...main.querySelectorAll('[data-view]')];
  for (const button of viewButtons) {
    button.addEventListener('click', () => setView(button.dataset.view));
  }
  const play = main.querySelector('[data-play-all]');
  play.addEventListener('click', () => setPlaying(!state.playing));
  setPlaying(state.playing);
}

function setView(view) {
  state.view = view;
  for (const button of main.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  for (const card of state.onScreen) state.pending.add(card);
  if (viewer && viewer.open) {
    viewer.viewButton.textContent = view === 'greys' ? 'One colour' : 'Greys';
    fillLegend();
    drawViewer();
  }
  kick();
}

function setPlaying(playing) {
  state.playing = playing;
  const play = main.querySelector('[data-play-all]');
  play.textContent = playing ? 'Pause all' : 'Play all';
  play.setAttribute('aria-pressed', String(playing));
  lastFrame = 0;
  for (const card of state.onScreen) state.pending.add(card);
  report();
  kick();
}

// ------------------------------------------------------------- the viewer --

function buildViewer() {
  const dialog = document.querySelector('#shub-viewer');
  viewer = {
    dialog,
    open: false,
    card: null,
    t: 0,
    speed: 1,
    playing: !reduceMotion.matches,
    scrubbing: false,
    title: dialog.querySelector('#shub-viewer-title'),
    where: dialog.querySelector('[data-viewer-where]'),
    canvas: dialog.querySelector('[data-viewer-canvas]'),
    playButton: dialog.querySelector('[data-viewer-play]'),
    scrub: dialog.querySelector('[data-viewer-scrub]'),
    timeEl: dialog.querySelector('[data-viewer-time]'),
    speedEl: dialog.querySelector('[data-viewer-speed]'),
    viewButton: dialog.querySelector('[data-viewer-view]'),
    legend: dialog.querySelector('[data-viewer-legend]'),
    algebra: dialog.querySelector('[data-viewer-algebra]'),
    size: 0,
  };
  viewer.ctx = viewer.canvas.getContext('2d');

  viewer.playButton.addEventListener('click', () => {
    viewer.playing = !viewer.playing;
    viewer.playButton.textContent = viewer.playing ? 'Pause' : 'Play';
    viewer.playButton.setAttribute('aria-pressed', String(viewer.playing));
    lastFrame = 0;
    kick();
  });
  viewer.scrub.addEventListener('input', () => {
    viewer.scrubbing = true;
    viewer.t = (Number(viewer.scrub.value) / 1000) * viewer.card.cls.m;
    drawViewer();
    syncScrub(true);
  });
  viewer.scrub.addEventListener('change', () => { viewer.scrubbing = false; });
  viewer.speedEl.addEventListener('change', () => {
    viewer.speed = Number(viewer.speedEl.value);
  });
  viewer.viewButton.addEventListener('click', () => {
    setView(state.view === 'greys' ? 'one' : 'greys');
  });
  // A click on the backdrop closes it, as a modal overlay is expected to.
  // `closedby="any"` does this natively where it is supported; this covers
  // the rest, and both end in the same close handler.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;          // a click on the box itself
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) dialog.close();
  });
  dialog.addEventListener('close', () => {
    viewer.open = false;
    if (parseHash().classId) setHash(`${state.family}/${activeFilm(state.family)}`, 'push');
    if (viewer.opener && document.contains(viewer.opener)) viewer.opener.focus();
  });
  window.addEventListener('resize', () => {
    if (viewer.open) { sizeViewer(); drawViewer(); }
  });
}

function sizeViewer() {
  const css = viewer.canvas.clientWidth;
  if (!css) return;
  const size = Math.max(64, Math.min(VIEWER_PIXELS, Math.round(css * dprCap())));
  if (size !== viewer.size) {
    viewer.size = size;
    viewer.canvas.width = size;
    viewer.canvas.height = size;
  }
}

function drawViewer() {
  const card = viewer.card;
  if (!card) return;
  if (!viewer.size) sizeViewer();
  if (!viewer.size) return;
  const slice = timeSlice(card.field, viewer.t, card.viewerSlice);
  renderer.draw(viewer.ctx, {
    field: card.field,
    slice,
    toLattice: card.geom.toLattice,
    width: card.width,
    n: card.cls.n,
    view: state.view,
    size: viewer.size,
    t: viewer.t,
  });
}

function syncScrub(force = false) {
  const m = viewer.card.cls.m;
  if (!viewer.scrubbing || force) {
    viewer.scrub.value = String(Math.round((viewer.t / m) * 1000));
  }
  viewer.timeEl.textContent = `t = ${viewer.t.toFixed(2)} / ${m}`;
}

function fillLegend() {
  const n = viewer.card.cls.n;
  const inks = inkBytes(n, state.view);
  viewer.legend.replaceChildren(...inks.map((rgb, k) => {
    const span = document.createElement('span');
    span.className = 'swatch';
    const swatch = document.createElement('i');
    swatch.style.background = inkCss(rgb);
    span.append(swatch, document.createTextNode(`colour ${k}`));
    return span;
  }));
}

function algebraRow(term, value, prose = false) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  if (prose) dd.className = 'prose';
  if (value instanceof Node) dd.append(value); else dd.textContent = value;
  return [dt, dd];
}

function fillAlgebra() {
  const cls = viewer.card.cls;
  const film = viewer.card.film;
  const rows = [];
  rows.push(...algebraRow(
    'σ on the generators',
    Object.entries(cls.col).map(([name, value]) => `${name} ↦ ${value}`).join('   ') || '—',
  ));
  rows.push(...algebraRow('σ on one period', `t ↦ ${cls.ct}   (mod ${cls.n})`));
  // u is sigma on the two parent basis translations only.  Half- and
  // quarter-cell centrings are lattice translations of the film group too, and
  // they can shift colour while u is (0, 0): g10-n6-9 reads "α ↦ 3" one row
  // above, and α is the (½, ½) centring.  So this row must not be readable as
  // "no translation shifts colour".
  rows.push(...algebraRow('σ on the parent lattice', `u = (${cls.u[0]}, ${cls.u[1]})`));
  rows.push(...algebraRow('cₜ', String(cls.ct)));
  rows.push(...algebraRow('repeats after', `${cls.m} film period${cls.m === 1 ? '' : 's'}`));
  rows.push(...algebraRow('orbit size', String(cls.size)));
  rows.push(...algebraRow('film group', `${film.signature}   ${cls.gid}   ${film.sgName}`));
  const audit = cls.audit;
  rows.push(...algebraRow(
    'audit',
    audit.ok
      ? `full symmetry group checked in exact arithmetic: exactly ${film.signature}, `
        + `with colour shifts exactly σ; ${viewer.card.field.count} waves in `
        + `${audit.orbits} orbit${audit.orbits === 1 ? '' : 's'}.`
      : 'not verified',
    true,
  ));
  const link = document.createElement('a');
  link.className = 'permalink';
  const href = `${location.pathname}#${film.family}/${cls.gid}/${cls.id}`;
  link.href = href;
  link.textContent = href;
  rows.push(...algebraRow('permalink', link, true));
  const name = nameOf(cls);
  if (name) rows.unshift(...algebraRow('name', name, true));
  viewer.algebra.replaceChildren(...rows);
}

function openViewer(classId, { push = true } = {}) {
  const cls = state.census.byId.get(classId);
  if (!cls) return false;
  let card = state.cards.get(classId);
  if (!card) card = cardFor(cls);           // deep link into a grid not built yet
  if (!card.viewerSlice) card.viewerSlice = new Float32Array(card.field.count * 4);
  viewer.card = card;
  viewer.opener = state.cards.has(classId) ? state.cards.get(classId).figure : null;
  viewer.t = state.t % cls.m;
  viewer.open = true;
  viewer.size = 0;
  viewer.title.textContent = `${cls.gid} · ${cls.n} colours · #${classIndex(cls)}`;
  viewer.where.textContent = `${card.film.family} · ${card.film.signature} · ${card.film.sgName}`;
  viewer.viewButton.textContent = state.view === 'greys' ? 'One colour' : 'Greys';
  viewer.playButton.textContent = viewer.playing ? 'Pause' : 'Play';
  viewer.playButton.setAttribute('aria-pressed', String(viewer.playing));
  fillLegend();
  fillAlgebra();
  if (!viewer.dialog.open) viewer.dialog.showModal();
  requestAnimationFrame(() => { sizeViewer(); drawViewer(); syncScrub(true); });
  if (push) setHash(`${card.film.family}/${cls.gid}/${cls.id}`, 'push');
  kick();
  return true;
}

// ---------------------------------------------------------------- routing --

let appliedHash = null;

function parseHash() {
  const encoded = location.hash.replace(/^#/, '');
  // "#%" is a legal URL and an illegal escape; applyHash is the last thing
  // start() does, so throwing here would leave the page without its readiness
  // flag and without a viewer.
  let raw;
  try { raw = decodeURIComponent(encoded); } catch { raw = encoded; }
  const [family, gid, classId] = raw.split('/');
  return { family: family || null, gid: gid || null, classId: classId || null };
}

function setHash(path, how = 'push') {
  const next = `#${path}`;
  if (location.hash === next) return;
  appliedHash = next;
  if (how === 'replace') history.replaceState(null, '', next);
  else history.pushState(null, '', next);
}

function applyHash({ scroll = false } = {}) {
  const { family, gid, classId } = parseHash();
  appliedHash = location.hash;
  // The gid decides the family: #p1/g130/... names a p4m film, and following
  // the stale family segment would leave the tab, the permalink and the
  // close-hash disagreeing about where the reader is.
  const film = gid ? state.census.films[gid] : null;
  const hm = film ? film.family
    : (family && state.census.families[family] ? family : state.census.order[0]);
  selectFamily(hm, { hash: null });
  if (film) selectFilm(hm, gid, { hash: null });
  if (classId && state.census.byId.has(classId)) {
    const cls = state.census.byId.get(classId);
    // a deep link has to open the colour-count section that holds the card
    const details = main.querySelector(`#sec-${CSS.escape(cls.gid)}-n${cls.n}`);
    if (details) {
      details.open = true;
      // A filter that would hide the linked class is stood down — both of
      // them: a clock filter left on hides the group, so the grid is never
      // filled and the card the dialog names is not even mounted.
      let repaired = false;
      if (state.filterN !== 'all' && state.filterN !== cls.n) {
        state.filterN = 'all';
        pressGroup([...main.querySelectorAll('[data-filter-n]')], main.querySelector('[data-filter-n="all"]'));
        repaired = true;
      }
      if (state.filterKey !== 'all' && state.filterKey !== cls.key) {
        state.filterKey = 'all';
        pressGroup([...main.querySelectorAll('[data-filter-key]')], main.querySelector('[data-filter-key="all"]'));
        repaired = true;
      }
      if (repaired) applyFilters();
      syncCards();
    }
    openViewer(classId, { push: false });
  } else if (viewer && viewer.dialog.open) {
    viewer.dialog.close();
  }
  if (scroll) {
    // A shared link that names only a family is still a link to the tabs; no
    // element carries the id #pmm, so nothing would move without this.
    const anchor = main.querySelector('#groups');
    if (anchor) anchor.scrollIntoView({ block: 'start' });
  }
}

function wireRouting() {
  const onNavigation = () => {
    if (location.hash === appliedHash) return;
    applyHash({ scroll: false });   // Back and Forward keep the reader's place
  };
  window.addEventListener('popstate', onNavigation);
  window.addEventListener('hashchange', onNavigation);

  // The Counts table links to #p1 ... #p6m, and nothing carries those ids, so
  // the browser's own anchor jump is a no-op: the panel would switch a
  // screenful below the fold while the reader went on looking at the table.
  // Chrome fires popstate for a fragment link as well as hashchange, so which
  // event arrived cannot tell a link apart from a Back press; the link says so
  // itself instead.
  for (const link of main.querySelectorAll('.shub-counts a[href^="#"]')) {
    link.addEventListener('click', (event) => {
      const hm = link.getAttribute('href').slice(1);
      if (!state.census.families[hm]) return;
      event.preventDefault();
      selectFamily(hm, { hash: 'push' });   // a deliberate step, so Back returns here
      main.querySelector('#groups').scrollIntoView({ block: 'start' });
    });
  }
}

// ------------------------------------------------------------------ start --

/**
 * The sticky filter bar wraps to two or three rows as the window narrows, so
 * the band that a focused element has to clear is not a constant.  Publishing
 * its height lets one scroll-margin rule cover every focusable thing on the
 * page (shubnikov.css) instead of guessing at each breakpoint.
 */
function watchBar() {
  const bar = main.querySelector('.shub-controls');
  if (!bar || typeof ResizeObserver !== 'function') return;
  const publish = () => {
    const stuck = getComputedStyle(bar).position === 'sticky';
    main.style.setProperty('--shub-bar-h', `${stuck ? Math.round(bar.getBoundingClientRect().height) : 0}px`);
  };
  new ResizeObserver(publish).observe(bar);
  window.addEventListener('resize', publish);
  publish();
}

async function start() {
  try {
    state.census = await loadCensus(main.dataset.census);
  } catch (error) {
    statusEl.textContent = '';
    const box = document.createElement('p');
    box.className = 'shub-error';
    box.textContent = `The census did not load (${error.message}). The pictures need data/census.json; `
      + 'try reloading, or check the browser console.';
    main.querySelector('#groups').prepend(box);
    return;
  }
  if (main.dataset.names) {
    try {
      const response = await fetch(main.dataset.names);
      if (response.ok) {
        const payload = await response.json();
        state.names = payload.names || {};
      }
    } catch { /* names are a bonus, never a blocker */ }
  }

  renderer = createRenderer({ prefer: params.get('renderer') === 'cpu' ? 'cpu' : 'auto' });
  if (renderer.kind === 'webgl') {
    // A lost context draws nothing and says nothing: every card would go
    // black for the rest of the session.  Fall back to the CPU twin, and take
    // the GPU back the moment the browser offers it.
    const redrawAll = () => {
      for (const card of liveCards()) { card.size = 0; state.pending.add(card); }
      if (viewer && viewer.open) { viewer.size = 0; drawViewer(); }
      report();
      kick();
    };
    const gl = renderer;
    gl.onLost = () => { renderer = createRenderer({ prefer: 'cpu' }); redrawAll(); };
    gl.onRestored = () => { renderer = gl; redrawAll(); };
  }
  buildViewer();
  watchBar();
  wireTabs();
  wireControls();
  buildHero();
  wireRouting();
  applyFilters();
  applyHash({ scroll: Boolean(location.hash) });
  report();
  // a handle for the browser tests: renderer kind, the clock, the live cards
  window.shubnikov = { state, get renderer() { return renderer; }, openViewer, get viewer() { return viewer; } };
  main.removeAttribute('aria-busy');
  main.dataset.ready = renderer.kind;
}

start();
