/** The Showcase's one script: mounting, the video budget, the filter and the
 * reader's place in the page.
 *
 * The served HTML already holds the first BATCH cards as posters, so the page
 * is a real list of pictures with JavaScript off and a crawler sees real links.
 * Everything here is about the rest of them.
 *
 * Three budgets, all measured rather than guessed (section B.3.1 of the design
 * note, `mount-test.html`):
 *
 *   MOUNT_CAP   At most 1 000 cards are in the document. Past that, appending a
 *               batch unmounts the family furthest from the viewport and leaves
 *               a spacer of its measured height, so the scrollbar never jumps.
 *   VIDEO_CAP   At most 48 <video> elements exist at any moment, and every one
 *               of them is playing. A thousand simultaneous videos is not a
 *               thing: Chrome silently refuses about 60 % of them and the page
 *               shows frozen first frames, which is worse than showing posters.
 *   The callback A detached video is paused, has its `src` removed and is
 *               load()ed before it is dropped — that, and not removal, is what
 *               frees the decoder. The observer callback reads no layout and
 *               does no per-frame work; the residual cost at any budget is the
 *               observer churn, not the decode.
 *
 * A poster is always in the markup. An unloaded card looks like a card, never
 * like a black hole.
 *
 * Two things the first cut of this file got wrong, both fixed here:
 *
 *   *What the reader asked for* and *what is in the document* are different
 *   sets. `want` is the first: it only ever grows, it survives an eviction, and
 *   it is what "N more to load" counts down. `inDom` is the second, and the
 *   mount cap governs it alone. Conflating them made the load button re-mount
 *   families it had just evicted, so it ping-ponged between p1 and p2 for ever
 *   and the last three families were unreachable.
 *
 *   The kind filter used to hide cards and mount nothing, so "Three-colour" —
 *   whose 423 pictures all live in the last five sections — drew a page with no
 *   pictures on it at all. Choosing a kind now walks the whole manifest from
 *   the top and mounts that kind, and a section with none of it is hidden.
 */

const page = document.body;
const state = {
  rows: [],
  byFamily: new Map(),   // family → its rows, in the manifest's order
  want: new Map(),       // family → Set of row indices the reader has asked for
  inDom: new Map(),      // family → Set of row indices actually mounted
  heights: new Map(),    // family → the height its grid had when it was evicted
  cursor: 0,             // the grid "Load more" resumes at, in document order
  pinned: '',            // the family the reader expanded by hand: never evicted
  jumped: '',            // the family a rail link or a #hash has just asked for
};
const phone = matchMedia('(max-width: 720px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const BATCH = () => (phone.matches ? 120 : 240);
const VIDEO_CAP = () => (phone.matches ? 12 : 48);
// A phone pays for every clip it attaches, and it attaches them as it scrolls:
// a 600 px margin on a 844 px screen fetches most of a page ahead of the thumb.
const ROOT_MARGIN = () => (phone.matches ? '200px' : '600px');
const MOUNT_CAP = 1000;
const KINDS = new Set(['all', 'ember', 'colour', 'mono', 'viewer']);
const KIND_LABEL = {ember: 'field', colour: 'three-colour', mono: 'black & white',
                    viewer: 'viewer'};

const $ = id => document.getElementById(id);
const grids = () => [...document.querySelectorAll('.loop-grid[data-family]')];
const cards = () => document.querySelectorAll('.loop-card');
const kindNow = () => page.dataset.kind || 'all';
const setOf = (map, family) => {
  if (!map.has(family)) map.set(family, new Set());
  return map.get(family);
};

// ---- cards ------------------------------------------------------------------

/** Everything the card cannot fit, for the reader who hovers it. */
function cardTitle(row) {
  const parts = [row.name, row.reading, row.equation, row.groupId,
                 row.dims, row.params].filter(Boolean);
  let line = parts.join(' · ');
  if (row.siblings?.length) {
    const what = row.kind === 'ember' ? 'the same wave catalogued under'
      : 'the same two-colour function also read as';
    line += ` — ${what} ${row.siblings.length} more: `
      + row.siblings.slice(0, 4).join(', ') + (row.siblings.length > 4 ? '…' : '');
  }
  // The same picture is carded under every wallpaper group that hosts it, which
  // is a placement and not a second picture. The card says so rather than
  // letting the reader count it twice.
  if (row.alsoIn?.length) line += ` — the same picture is also in ${row.alsoIn.join(', ')}`;
  return line;
}

/** The same markup the builder writes into the HTML, so a mounted card and a
 * served one are indistinguishable to the reader and to the tests. */
function cardElement(row, index) {
  const a = document.createElement('a');
  a.className = 'loop-card';
  a.href = row.href;
  a.dataset.kind = row.kind;
  a.dataset.id = row.id;
  a.dataset.preview = row.preview;
  a.dataset.index = String(index);
  if (row.featured) a.dataset.featured = '1';
  // A card that stands for more than one catalogue record says so: they are the
  // same animation under different clockworks, or the same two-colour function
  // read by several rules, and the showcase draws each picture once.
  if (row.siblings?.length) a.dataset.siblings = String(row.siblings.length);
  if (row.alsoIn?.length) a.dataset.also = String(row.alsoIn.length);
  a.title = cardTitle(row);
  const art = document.createElement('span');
  art.className = 'art';
  const img = document.createElement('img');
  img.src = row.poster; img.alt = ''; img.width = 176; img.height = 176;
  img.loading = 'lazy'; img.decoding = 'async';
  const badge = document.createElement('span');
  badge.className = `badge ${row.kind}`;
  badge.textContent = KIND_LABEL[row.kind];
  art.append(img, badge);
  if (row.signature) {
    const sig = document.createElement('span');
    sig.className = 'sig'; sig.textContent = row.signature;
    art.append(sig);
  }
  const meta = document.createElement('span');
  meta.className = 'meta';
  const name = document.createElement('strong');
  name.textContent = row.name;
  const where = document.createElement('span');
  where.className = 'where';
  where.textContent = [row.groupId, row.equation].filter(Boolean).join(' · ');
  meta.append(name, where);
  // The last line is what tells two neighbouring cards apart: three p6 waves at
  // F = 0.00406, 0.00407 and 0.00408 draw almost the same picture and are three
  // different verified solutions — and a two-colour card's `reading` is the
  // rule, which is the whole difference between twenty cards of one wave.
  const head = [row.reading, row.params, row.dims].filter(Boolean).join(' · ');
  const detail = head + (row.siblings?.length ? `${head ? ' · ' : ''}+${row.siblings.length}` : '');
  if (detail) {
    const line = document.createElement('span');
    line.className = 'det';
    line.textContent = detail;
    meta.append(line);
  }
  a.append(art, meta);
  return a;
}

// ---- what the reader asked for, and what is in the document -----------------

function matches(row, kind = kindNow()) {
  return kind === 'all' || row.kind === kind;
}

function gridFor(family) {
  return document.querySelector(`.loop-grid[data-family="${CSS.escape(family)}"]`);
}

function inDomCount() {
  let total = 0;
  for (const set of state.inDom.values()) total += set.size;
  return total;
}

/** Every card in the document, which is what the budget is about.
 *
 * The nine pinned viewers are served in the HTML, are never evicted and never
 * enter `state.inDom`, so `inDomCount()` does not see them. The ceiling used to
 * be tested against that number while the readout printed this one, and the
 * page ended a full walk holding 1 009 cards under the line that says a card
 * leaves the page again once 1 000 are mounted. One number, both places. */
function mountedCount() {
  return inDomCount() + (state.byFamily.get('viewers')?.length ?? 0);
}

/** How many of this family's rows the reader has not asked for yet, under the
 * filter that is on now. */
function pendingFor(family) {
  const rows = state.byFamily.get(family) ?? [];
  const want = state.want.get(family);
  let left = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!want?.has(i) && matches(rows[i])) left += 1;
  }
  return left;
}

/** Put these row indices in the grid, in the manifest's order, whatever order
 * they were mounted in: a card mounted by the filter must not land after the
 * cards that came before it. */
function insertRows(family, indices) {
  const grid = gridFor(family);
  if (!grid || !indices.length) return;
  const rows = state.byFamily.get(family);
  const existing = [...grid.querySelectorAll(':scope > .loop-card')];
  let at = 0;
  for (const index of indices) {
    while (at < existing.length && Number(existing[at].dataset.index) < index) at += 1;
    grid.insertBefore(cardElement(rows[index], index), existing[at] ?? null);
  }
  grid.style.minHeight = '';
  delete grid.dataset.unloaded;
  grid.querySelector('.remount-note')?.remove();
  shells?.unobserve(grid);
}

/** Ask for up to `count` more of this family, and mount them. Returns how many
 * the reader now has that they did not have before. */
function addWanted(family, count) {
  const rows = state.byFamily.get(family) ?? [];
  const want = setOf(state.want, family);
  const have = setOf(state.inDom, family);
  const fresh = [];
  for (let i = 0; i < rows.length && fresh.length < count; i++) {
    if (want.has(i) || !matches(rows[i])) continue;
    // `have.add` below writes straight into `state.inDom`, so `mountedCount()`
    // ALREADY counts everything this loop has taken: adding `fresh.length` to
    // it counted each of them twice and brought the ceiling down on the page at
    // half of MOUNT_CAP. It went unseen while no section was large enough to
    // reach it; the broad tier's p6 holds 640 cards and "Show all" stopped at
    // 500 — the point where 240 static + 2 × fresh crosses a thousand.
    if (mountedCount() >= MOUNT_CAP && !unmountFurthest(family)) break;
    fresh.push(i);
    want.add(i);
    have.add(i);
  }
  insertRows(family, fresh);
  countsDirty = countsDirty || fresh.length > 0;
  return fresh.length;
}

/** Give the whole of a family back to the document — everything the reader has
 * already asked for, and nothing they have not. */
function remount(family) {
  const want = state.want.get(family);
  const have = setOf(state.inDom, family);
  if (!want?.size) return 0;
  const fresh = [];
  for (const index of [...want].sort((a, b) => a - b)) {
    if (have.has(index)) continue;
    // As in `addWanted`: `have` is `state.inDom`, so `mountedCount()` is
    // already the running total and `+ fresh.length` would count this loop's
    // own cards a second time.
    if (mountedCount() >= MOUNT_CAP && !unmountFurthest(family)) break;
    fresh.push(index);
    have.add(index);
  }
  insertRows(family, fresh);
  countsDirty = true;
  observeAll();
  report();
  return fresh.length;
}

/** Take a family's cards out of the document, keeping its height so nothing
 * under the reader's thumb moves, and leaving a button that says what happened
 * and brings them back. The reader's `want` is untouched: an eviction is a
 * memory decision, never a decision about what they have seen. */
function unmountFurthest(except) {
  let worst = null, worstDistance = -1;
  for (const grid of grids()) {
    const family = grid.dataset.family;
    if (family === except || family === state.pinned || family === state.jumped) continue;
    if (!state.inDom.get(family)?.size) continue;
    // The GAP to the viewport, not the distance to the grid's middle. A section
    // of 640 cards is ten screens tall: measured from its centre it looks miles
    // away while the reader is standing in it, and jumping into an evicted
    // family could evict it again the moment its neighbour came back — the
    // grid emptied, filled, emptied and filled again over about a second. A
    // grid with any part of it on screen now has a gap of zero and is never the
    // worst.
    const box = grid.getBoundingClientRect();
    const distance = Math.max(0, box.top - innerHeight, -box.bottom);
    if (distance > worstDistance) { worstDistance = distance; worst = grid; }
  }
  if (!worst || worstDistance < innerHeight) return false;
  const family = worst.dataset.family;
  const n = state.inDom.get(family).size;
  state.heights.set(family, worst.offsetHeight);
  for (const card of [...worst.querySelectorAll(':scope > .loop-card')]) {
    detach(card);
    card.remove();
  }
  state.inDom.set(family, new Set());
  worst.style.minHeight = `${state.heights.get(family)}px`;
  worst.dataset.unloaded = String(n);
  const note = document.createElement('button');
  note.type = 'button';
  note.className = 'remount-note';
  note.dataset.family = family;
  note.textContent = `${n} picture${n === 1 ? '' : 's'} unloaded to save memory — show them`;
  note.onclick = () => remount(family);
  worst.prepend(note);
  countsDirty = true;
  shells?.observe(worst);
  return true;
}

/** Everything this family holds, under the filter that is on now. */
function mountFamily(family) {
  const left = pendingFor(family);
  const back = remount(family);
  if (!left) { report(); return back; }
  const added = addWanted(family, left);
  observeAll();
  report();
  return added + back;
}

/** Append more cards, resuming where the last click left off.
 *
 * The cursor is what keeps this monotone. Restarting the walk at the first grid
 * — which is what this did first — re-asks for the cards an eviction has just
 * taken out of the document, so the button spends for ever on p1 and p2 and the
 * reader never reaches p31m, p6 or p6m at all.
 */
function mountMore(count) {
  const all = grids();
  if (!all.length) return 0;
  let left = count;
  let index = state.cursor % all.length;
  for (let step = 0; step < all.length && left > 0; step++) {
    const family = all[index].dataset.family;
    const added = addWanted(family, left);
    left -= added;
    // Stay here only while this family is still giving: a family that gave
    // nothing (the filter has none of it, or the cap refused) must not be able
    // to park the cursor and make the button a no-op.
    if (added > 0 && pendingFor(family) > 0) break;
    index = (index + 1) % all.length;
  }
  state.cursor = index;
  observeAll();
  report();
  return count - left;
}

/** A rail anchor or a `#family` on load forces its section to be mounted before
 * the page scrolls to it: a deep link must never land on an empty section.
 *
 * The jump target is exempt from eviction for a beat, the way an expanded
 * family is for good. A rail click mounts the section from wherever the reader
 * is standing — the browser scrolls afterwards — so for a moment the target is
 * the furthest grid on the page and the next remount would take it straight
 * back out again. */
let jumpTimer = 0;
function ensureMounted(family) {
  if (!state.byFamily.has(family) || !gridFor(family)) return;
  state.jumped = family;
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(() => { state.jumped = ''; }, 3000);
  mountFamily(family);
}

// ---- the video budget -------------------------------------------------------

const attached = new Set();
const visible = new Set();
let observer = null, shells = null, pending = 0, playPreviews = !reduced.matches;

function attach(card) {
  if (attached.has(card) || card.querySelector('video')) return;
  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.poster = card.querySelector('img')?.src ?? '';
  video.src = card.dataset.preview;
  card.querySelector('.art').prepend(video);
  attached.add(card);
  const play = video.play();
  if (play && play.catch) play.catch(() => { /* a refused autoplay leaves the poster */ });
}

function detach(card) {
  const video = card.querySelector('video');
  attached.delete(card);
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();                       // this, not the removal, frees the decoder
  video.remove();
}

/** Within a screen and a bit of the viewport, measured now.
 *
 * The observer is what keeps this cheap, but its callback is delivered when the
 * engine gets round to it, and after a long jump WebKit can be a scroll behind:
 * `visible` then still names cards that are thousands of pixels away, and every
 * one of them would be handed a decoder. The set is the hint; the rectangle is
 * the fact, and the observer corrects the set a moment later either way. */
function near(card) {
  const box = card.getBoundingClientRect();
  return box.bottom > -900 && box.top < innerHeight + 900;
}

function reconcile() {
  pending = 0;
  if (!playPreviews) { for (const card of [...attached]) detach(card); report(); return; }
  for (const card of [...attached]) {
    if (!visible.has(card) || card.offsetParent === null || !near(card)) detach(card);
  }
  const cap = VIDEO_CAP();
  if (attached.size >= cap) { report(); return; }
  for (const card of visible) {
    if (attached.size >= cap) break;
    if (card.offsetParent === null) continue;      // hidden by the kind filter
    if (!near(card)) continue;                     // the observer is a scroll behind
    attach(card);
  }
  report();
}

function schedule() {
  if (pending) return;
  pending = requestAnimationFrame(reconcile);
}

function observeAll() {
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else { visible.delete(entry.target); }
      }
      schedule();
    }, {rootMargin: ROOT_MARGIN()});
  }
  for (const card of cards()) {
    if (card.dataset.observed) continue;
    card.dataset.observed = '1';
    observer.observe(card);
  }
}

/** An evicted grid is watched too: scroll back to it and its cards come back on
 * their own, which is what makes the spacer a pause and not a hole. */
function watchShells() {
  shells = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const family = entry.target.dataset.family;
      if (entry.target.dataset.unloaded) remount(family);
    }
  }, {rootMargin: '300px'});
}

// ---- the readouts, the filter and the reader's place ------------------------

function wantedMatching() {
  let total = 0;
  for (const [family, want] of state.want) {
    const rows = state.byFamily.get(family) ?? [];
    for (const index of want) if (matches(rows[index])) total += 1;
  }
  return total;
}

function report() {
  const kind = kindNow();
  const viewers = state.byFamily.get('viewers') ?? [];
  const pinnedShown = viewers.filter(row => matches(row, kind)).length;
  const total = kind === 'all' ? state.rows.length
    : state.rows.filter(row => row.kind === kind).length;
  const shown = [...cards()].filter(card => card.offsetParent !== null).length;
  $('mounted').textContent =
    `${mountedCount()} of ${state.rows.length} mounted · `
    + `${attached.size} playing${shown === cards().length ? '' : ` · ${shown} shown`}`;
  // What is left is counted against what the reader has ASKED for, not against
  // what survived the mount cap, so it falls with every click and reaches zero.
  const left = Math.max(0, total - wantedMatching() - pinnedShown);
  $('global-more').hidden = left <= 0;
  $('next-count').textContent = String(Math.min(BATCH(), left));
  const noun = kind === 'all' ? 'loops' : KIND_LABEL[kind];
  $('more-noun').textContent = noun;
  $('budget').firstChild.textContent =
    `${left} more to load · a card leaves the page again once ${MOUNT_CAP} are mounted · `;
  updateSectionCounts();
}

/** A section's heading and its "Show all" button say what the filter will
 * actually do, not what the unfiltered page holds: "Show all 76 in pmm" that
 * brings in 42 is worse than no button. */
let countsDirty = true;
function updateSectionCounts() {
  if (!countsDirty) return;
  countsDirty = false;
  const kind = kindNow();
  for (const [family, rows] of state.byFamily) {
    if (family === 'viewers') continue;           // "9 pages", whatever is on
    const mine = kind === 'all' ? rows : rows.filter(row => row.kind === kind);
    const readout = document.querySelector(`.n[data-count="${CSS.escape(family)}"]`);
    if (readout) {
      if (!readout.dataset.all) readout.dataset.all = readout.textContent;
      const text = kind === 'all' ? readout.dataset.all
        : `${mine.length} ${KIND_LABEL[kind]}`;
      if (readout.textContent !== text) readout.textContent = text;
    }
    const button = document.querySelector(`.show-all[data-family="${CSS.escape(family)}"]`);
    if (!button) continue;
    const unloaded = gridFor(family)?.dataset.unloaded;
    const wrapper = button.closest('.load-more');
    const gone = pendingFor(family) === 0 && !unloaded;
    if (wrapper.hidden !== gone) wrapper.hidden = gone;
    const label = kind === 'all'
      ? `Show all ${mine.length} in ${family}`
      : `Show all ${mine.length} ${KIND_LABEL[kind]} in ${family}`;
    if (button.textContent !== label) button.textContent = label;
  }
}

/** Choosing a kind mounts that kind. The filter used to hide and mount nothing,
 * which for "Three-colour" — whose pictures are all in the last five sections —
 * meant a page with no pictures on it. */
function fillFor(kind) {
  if (kind === 'all') return 0;
  const have = document.querySelectorAll(`.loop-card[data-kind="${kind}"]`).length;
  return have < BATCH() ? mountMore(BATCH() - have) : 0;
}

function setKind(kind, {write = true, fill = true} = {}) {
  if (!KINDS.has(kind)) kind = 'all';
  const changed = page.dataset.kind !== kind;
  page.dataset.kind = kind;
  for (const button of document.querySelectorAll('.kind-bar button[data-kind]')) {
    button.setAttribute('aria-pressed', String(button.dataset.kind === kind));
  }
  // A section is hidden when the CATALOG has none of this kind in it, not when
  // the document happens not to have mounted any: eleven empty headings over a
  // page with no pictures on it was the old behaviour, and it was a lie about
  // where the pictures are.
  for (const section of document.querySelectorAll('.showcase-section')) {
    const rows = state.byFamily.get(section.id) ?? [];
    section.hidden = kind !== 'all' && !rows.some(row => row.kind === kind);
  }
  // …and so is its rail pill: an anchor to a section that is not on the page is
  // a link to nowhere, and the counts on it would be the wrong ones anyway.
  // Every write here is guarded: rewriting a text node with the same string
  // still invalidates layout, and doing that to a sticky rail on load made
  // WebKit hand the video budget stale rectangles for a whole scroll.
  for (const anchor of document.querySelectorAll('.group-rail a')) {
    const id = anchor.getAttribute('href').slice(1);
    const rows = state.byFamily.get(id) ?? [];
    const mine = kind === 'all' ? rows : rows.filter(row => row.kind === kind);
    if (anchor.hidden !== (mine.length === 0)) anchor.hidden = mine.length === 0;
    const readout = anchor.querySelector('span');
    if (!readout) continue;
    if (!readout.dataset.all) readout.dataset.all = readout.textContent;
    const text = kind === 'all' ? readout.dataset.all : String(mine.length);
    if (readout.textContent !== text) readout.textContent = text;
  }
  if (changed) state.cursor = 0;               // a new kind is a new walk
  countsDirty = true;
  if (fill) fillFor(kind);
  if (write) writeHash();
  report();
  schedule();
}

let hashTimer = 0, currentFamily = '';
function writeHash() {
  const query = new URLSearchParams();
  if (page.dataset.kind && page.dataset.kind !== 'all') query.set('kind', page.dataset.kind);
  const batch = Math.max(1, Math.ceil(wantedMatching() / BATCH()));
  if (batch > 1) query.set('batch', String(batch));
  const text = query.toString();
  const hash = `#${currentFamily || 'viewers'}${text ? `?${text}` : ''}`;
  if (hash !== location.hash) history.replaceState(null, '', hash);
}

function readHash() {
  const raw = location.hash.replace(/^#/, '');
  const cut = raw.indexOf('?');
  const family = cut < 0 ? raw : raw.slice(0, cut);
  const query = new URLSearchParams(cut < 0 ? '' : raw.slice(cut + 1));
  const batch = Number(query.get('batch'));
  return {family, kind: query.get('kind') ?? 'all',
          batch: Number.isFinite(batch) && batch > 1 && batch < 40 ? Math.floor(batch) : 1};
}

/** The hash is the reader's place: `#p4` is written as they scroll past each
 * section, throttled, so a reload returns them to the same group. */
function watchScroll() {
  addEventListener('scroll', () => {
    if (hashTimer) return;
    hashTimer = setTimeout(() => {
      hashTimer = 0;
      // Four times a second, whatever the observer has or has not delivered.
      // An IntersectionObserver callback is the engine's to schedule, and after
      // a long jump it can arrive a whole scroll late; the budget must not be
      // left holding decoders for cards nobody is looking at until it does.
      schedule();
      // A section scrolled to by its anchor comes to rest a little under the
      // top of the viewport — its own scroll-margin, plus the sticky rail — so
      // the mark has to sit below that, or a deep link to a section would be
      // rewritten to the one above it the moment it arrived.
      let seen = currentFamily;
      for (const section of document.querySelectorAll('.showcase-section')) {
        if (section.hidden) continue;
        if (section.getBoundingClientRect().top <= 160) seen = section.id;
      }
      for (const anchor of document.querySelectorAll('.group-rail a')) {
        anchor.setAttribute('aria-current', String(anchor.getAttribute('href') === `#${seen}`));
      }
      if (seen !== currentFamily) { currentFamily = seen; writeHash(); }
    }, 250);
  }, {passive: true});
}

// ---- start ------------------------------------------------------------------

async function start() {
  const response = await fetch(new URL('data/showcase.json', location.href));
  if (!response.ok) throw new Error(`the manifest did not load (${response.status})`);
  const doc = await response.json();
  state.rows = doc.rows;
  for (const row of doc.rows) {
    if (!state.byFamily.has(row.family)) state.byFamily.set(row.family, []);
    state.byFamily.get(row.family).push(row);
  }
  // The served cards are the first n of their family, in the manifest's order.
  for (const grid of grids()) {
    const family = grid.dataset.family;
    const want = setOf(state.want, family);
    const have = setOf(state.inDom, family);
    [...grid.querySelectorAll(':scope > .loop-card')].forEach((card, index) => {
      card.dataset.index = String(index);
      want.add(index); have.add(index);
    });
  }
  // "Load more" resumes at the first family that still owes the reader cards.
  state.cursor = Math.max(0, grids().findIndex(grid => pendingFor(grid.dataset.family) > 0));

  watchShells();
  const wanted = readHash();
  setKind(wanted.kind, {write: false, fill: false});
  if (wanted.batch > 1) mountMore((wanted.batch - 1) * BATCH());
  fillFor(wanted.kind);
  if (wanted.family && wanted.family !== 'viewers') {
    ensureMounted(wanted.family);
    // Instant, not smooth: a deep link is a fragment navigation, and the site's
    // smooth scrolling would spend a second and a half travelling ten thousand
    // pixels the reader never asked to see.
    document.getElementById(wanted.family)?.scrollIntoView({behavior: 'instant', block: 'start'});
    currentFamily = wanted.family;
  }

  $('global-more').onclick = () => { mountMore(BATCH()); writeHash(); };
  // The button is never removed: a family can be evicted again, and a reader
  // who came back to an emptied section needs the way back to still be there.
  for (const button of document.querySelectorAll('.show-all')) {
    button.onclick = () => {
      state.pinned = button.dataset.family;
      mountFamily(button.dataset.family);
      writeHash();
    };
  }
  for (const button of document.querySelectorAll('.kind-bar button[data-kind]')) {
    button.onclick = () => setKind(button.dataset.kind);
  }
  for (const anchor of document.querySelectorAll('.group-rail a')) {
    anchor.addEventListener('click', () => ensureMounted(anchor.getAttribute('href').slice(1)));
  }
  const toggle = $('play-previews');
  toggle.checked = playPreviews;
  toggle.onchange = () => { playPreviews = toggle.checked; schedule(); };
  addEventListener('hashchange', () => {
    const next = readHash();
    if (next.kind !== page.dataset.kind) setKind(next.kind, {write: false});
    if (next.family) { ensureMounted(next.family); currentFamily = next.family; }
  });

  observeAll();
  watchScroll();
  report();
  page.dataset.ready = '1';
  const spaced = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  $('status').textContent =
    `${spaced(doc.counts.clips)} pictures in ${spaced(state.rows.length)} cards · `
    + 'previews attach only where you are looking.';
}

start().catch(error => {
  $('status').textContent = `The manifest did not load: ${error.message}`;
  page.dataset.ready = 'error';
});
