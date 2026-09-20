/** The Showcase's one script: the per-section quota, the look-alike fold, the
 * mount budget, the video budget, the filter and the reader's place in the page.
 *
 * The served HTML already holds the first QUOTA (50) DEFAULT-VISIBLE cards of
 * every one of the eighteen sections — or all of them, in the groups that hold
 * fewer than fifty — so the page is a real list of pictures in every wallpaper
 * group with JavaScript off, and a crawler sees real links. A <noscript> block
 * in the head then takes away every control on it that only this file can
 * honour. Everything here is about the rest of the cards.
 *
 * Two deduplications, and they are not the same thing:
 *
 *   `siblings` and `alsoIn` are the CATALOGUE's. One clip is carded in every
 *   family that hosts its field, and one card can stand for several records
 *   that share a field. The manifest says so and the card says so; nothing is
 *   hidden.
 *
 *   `look` / `alike` / `alikeOf` are the READER's. Seven verified g54 solutions
 *   at F = .00395 … .00405 are seven records, seven pictures and — to the eye —
 *   one black diamond around one white blob, seven times in a row.
 *   `tools/look-alikes.py` clusters the clips by how they look; per family, one
 *   card per cluster is mounted and the rest wait behind its "+6 alike" chip.
 *   They are ordinary cards with their own parameters and their own links, they
 *   mount directly after their representative, and "Fold look-alikes" in the
 *   kind bar turns the whole thing off.
 *
 * Three budgets, all measured rather than guessed (section B.3.1 of the design
 * note, `mount-test.html`):
 *
 *   MOUNT_CAP   At most 1 000 cards are in the document. Past that, mounting
 *               more unmounts the family furthest from the viewport and leaves
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
 * Four things this file has to keep straight:
 *
 *   *What the reader asked for* and *what is in the document* are different
 *   sets. `want` is the first: it grows with the quota, it survives an eviction,
 *   and it is what a section's "Show 50 more" counts down. `inDom` is the
 *   second, and the mount cap governs it alone. Conflating them made the load
 *   button re-mount families it had just evicted.
 *
 *   A section's quota is per section. There used to be one page-wide cursor
 *   that walked the grids in order, so p1 and p2 were served 240 cards between
 *   them and the other fifteen groups arrived EMPTY under a button. Every
 *   section now owns a number, starting at 50, that only its own two buttons
 *   move — and the quota counts CARDS eligible under the filter and the fold
 *   state that are on now, so unticking the box shows fifty cards a section
 *   rather than fifty clusters' worth of them.
 *
 *   Everything the reader has done to the page is in the hash: the kind, every
 *   section whose quota they raised (`more=p4g:100,p6:all`), every chip they
 *   opened (`open=p2/mono:gray-scott:0011`) and the fold (`unfold=1`). A reload
 *   and a shared link both come back to the same page, folded cards included.
 *
 *   The kind filter used to hide cards and mount nothing, so "Three-colour" —
 *   whose 423 pictures all live in the last five sections — drew a page with no
 *   pictures on it at all. A kind is now counted and quota'd per section like
 *   everything else, and a section with none of it is hidden.
 */

const page = document.body;
const state = {
  rows: [],
  byFamily: new Map(),   // family → its rows, in the manifest's order
  order: new Map(),      // family → per-row display position (folded after its rep)
  index: new Map(),      // family → row id → its index in byFamily
  want: new Map(),       // family → Set of row indices the reader has asked for
  inDom: new Map(),      // family → Set of row indices actually mounted
  heights: new Map(),    // family → the height its grid had when it was evicted
  quota: new Map(),      // family → how many default-visible cards it serves now
  expanded: new Set(),   // "family/cluster id" of every chip the reader opened
  unfold: false,         // "Fold look-alikes" off: every card is its own card
  pinned: '',            // the family the reader expanded by hand: never evicted
  jumped: '',            // the family a rail link or a #hash has just asked for
};
const phone = matchMedia('(max-width: 720px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// The quota the served HTML was stamped with, and the step the button takes.
// `make-manifest.py --per-section` writes the same number into the markup.
const QUOTA = 50;
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
const quotaOf = family => state.quota.get(family) ?? QUOTA;

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
  // With "Fold look-alikes" off the chip is hidden — a control that does
  // nothing is worse than no control — and the count it carried has to go
  // somewhere. The stylesheet said it was here; it was not, until now.
  // `card_title()` in make-manifest.py writes the same clause.
  if (row.alike) {
    line += ` — ${row.alike} more card${row.alike === 1 ? '' : 's'} in this group `
      + `look${row.alike === 1 ? 's' : ''} like this one`;
  }
  return line;
}

/** The same markup `card_html()` writes into the HTML, attribute for attribute,
 * so a mounted card and a served one are indistinguishable to the reader and to
 * the tests — which compare the two outerHTMLs of one row and fail on a
 * difference. A card is a <div> and not an <a> because the look-alike chip is a
 * <button>, and a button may not sit inside a link. */
function cardElement(row, index) {
  const card = document.createElement('div');
  card.className = 'loop-card';
  card.dataset.kind = row.kind;
  card.dataset.id = row.id;
  card.dataset.preview = row.preview;
  if (row.featured) card.dataset.featured = '1';
  // A card that stands for more than one catalogue record says so: they are the
  // same animation under different clockworks, or the same two-colour function
  // read by several rules, and the showcase draws each picture once.
  if (row.siblings?.length) card.dataset.siblings = String(row.siblings.length);
  if (row.alsoIn?.length) card.dataset.also = String(row.alsoIn.length);
  if (row.look) card.dataset.look = row.look;
  if (row.alike) card.dataset.alike = String(row.alike);
  if (row.alikeOf) card.dataset.alikeOf = row.alikeOf;
  card.title = cardTitle(row);

  const open = document.createElement('a');
  open.className = 'open';
  open.href = row.href;
  // A copy of this page on another host (tools/make-standalone.py) marks <body>
  // data-external and rewrites every served link to open the site in a new
  // tab; a card mounted here has to do the same, or the two would disagree.
  if (page.dataset.external) { open.target = '_blank'; open.rel = 'noopener'; }
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
  // A folded card says so in its own words as well as in its border: it belongs
  // to the card before it, and a reader who arrived by keyboard never saw the
  // chip that opened it.
  if (row.alikeOf) {
    const word = document.createElement('span');
    word.className = 'det alike-word';
    word.textContent = 'alike';
    meta.append(word);
  }
  open.append(art, meta);
  card.append(open);
  if (row.alike) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'alike';
    chip.setAttribute('aria-expanded', 'false');
    chip.textContent = `+${row.alike} alike`;
    card.append(chip);
  }
  // Last, so a served card (which gets `data-index` written on to it at start)
  // and a mounted one carry their attributes in the same order.
  card.dataset.index = String(index);
  return card;
}

// ---- the fold ---------------------------------------------------------------

const lookKey = (family, look) => `${family}/${look}`;

/** Where each row sits in its section, once and for all — and, on the way,
 * `state.index`, the id → index map the served cards are matched by.
 *
 * A folded row is drawn immediately after its representative, and the manifest
 * does not promise they are neighbours in it: a cluster's members are wherever
 * the catalogue put them. The display order is a property of the manifest, not
 * of what is mounted, so it is computed once and then only read. */
function buildOrder(family, rows) {
  const index = new Map(rows.map((row, i) => [row.id, i]));
  const kids = new Map();
  rows.forEach((row, i) => {
    if (!row.alikeOf) return;
    const rep = index.get(row.alikeOf);
    if (rep === undefined) return;            // orphan: treated as its own card
    if (!kids.has(rep)) kids.set(rep, []);
    kids.get(rep).push(i);
  });
  const order = new Array(rows.length).fill(0);
  let at = 0;
  rows.forEach((row, i) => {
    if (row.alikeOf && index.has(row.alikeOf)) return;
    order[i] = at++;
    for (const kid of kids.get(i) ?? []) order[kid] = at++;
  });
  state.index.set(family, index);
  return order;
}

/** Is this row one the section shows without being asked?
 *
 * With the fold off every row is. With it on, a representative is and a folded
 * row is not — unless the reader has opened its chip, and then it is, and it
 * does not count against the section's quota. */
function opened(family, row) {
  return state.unfold || !row.alikeOf || state.expanded.has(lookKey(family, row.look));
}

// ---- what the reader asked for, and what is in the document -----------------

function matches(row, kind = kindNow()) {
  return kind === 'all' || row.kind === kind;
}

function gridFor(family) {
  return document.querySelector(`.loop-grid[data-family="${CSS.escape(family)}"]`);
}

/** How many cards this section would show if its quota were infinite, under the
 * filter AND the fold state that are on now: one card per look-alike cluster
 * with the fold on, every card with it off. The quota counts against this and
 * "Show all N" prints it, so the button always names the number of cards the
 * press will actually leave in the grid.
 *
 * It used to count representatives whatever the checkbox said, so with the fold
 * off "Show all 72" brought in 253 — the one number on a page whose whole
 * argument is its counts that was smaller than what the click delivered. */
function eligibleCount(family, kind = kindNow()) {
  const rows = state.byFamily.get(family) ?? [];
  let n = 0;
  for (const row of rows) if ((state.unfold || !row.alikeOf) && matches(row, kind)) n += 1;
  return n;
}

/** What "Show all" will actually leave in the grid: every eligible card, plus
 * the look-alikes riding along behind the chips the reader has opened.
 *
 * Those two are not the same number, and the button used to print the first
 * while the press delivered the second: p2 with one chip open read "Show all
 * 80" and left 89 cards. A chip the reader opened does not count against the
 * quota — that is D4, and it is right, a section that punished looking would be
 * worse — but it is still a card on the screen afterwards, and this label is a
 * promise about the screen. */
function showAllCount(family, kind = kindNow()) {
  const rows = state.byFamily.get(family) ?? [];
  let n = 0;
  for (const row of rows) if (matches(row, kind) && opened(family, row)) n += 1;
  return n;
}

/** This family's row indices under the current filter, in the order the grid
 * draws them — which is the manifest's, except that a folded card goes straight
 * after the card it is folded behind. */
function displayOrder(family, kind = kindNow()) {
  const rows = state.byFamily.get(family) ?? [];
  const order = state.order.get(family) ?? [];
  const mine = [];
  for (let i = 0; i < rows.length; i++) if (matches(rows[i], kind)) mine.push(i);
  return mine.sort((a, b) => order[a] - order[b]);
}

/** The set of row indices this section should be showing: its first `quota`
 * representatives, plus every folded row behind one of them whose chip is open
 * (or all of them, with the fold off).
 *
 * A chip the reader opened never counts against the quota. A section that
 * served forty-nine cards and then swallowed the fiftieth because the reader
 * opened a chip would be a page that punishes looking.
 *
 * With the fold off there are no representatives to count — every row is an
 * ordinary card — so the quota counts CARDS, taken in display order so a run of
 * look-alikes stays with the card it belongs to. Counting representatives there
 * gave p2 a quota of fifty and 193 cards, and one click on the checkbox spent
 * the whole thousand-card budget on the top of the page and left seven sections
 * standing empty under "unloaded to save memory". */
function wantedFor(family) {
  const rows = state.byFamily.get(family) ?? [];
  const kind = kindNow();
  const quota = quotaOf(family);
  const chosen = new Set();
  if (state.unfold) {
    for (const index of displayOrder(family, kind)) {
      if (chosen.size >= quota) break;
      chosen.add(index);
    }
    return chosen;
  }
  const reps = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.alikeOf || !matches(row, kind)) continue;
    if (chosen.size >= quota) break;
    chosen.add(i);
    reps.add(row.id);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.alikeOf || !matches(row, kind)) continue;
    if (!reps.has(row.alikeOf)) continue;
    if (!opened(family, row)) continue;
    chosen.add(i);
  }
  return chosen;
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

/** How many default-visible cards of this family the quota is still holding
 * back, under the filter that is on now. */
function pendingFor(family) {
  return Math.max(0, eligibleCount(family) - quotaOf(family));
}

/** Put these row indices in the grid, in DISPLAY order — which is the
 * manifest's, except that a folded card goes straight after the card it is
 * folded behind, wherever the two happen to sit in the manifest. */
function insertRows(family, indices) {
  const grid = gridFor(family);
  if (!grid || !indices.length) return;
  const rows = state.byFamily.get(family);
  const order = state.order.get(family);
  const existing = [...grid.querySelectorAll(':scope > .loop-card')];
  let at = 0;
  for (const index of [...indices].sort((a, b) => order[a] - order[b])) {
    while (at < existing.length
           && order[Number(existing[at].dataset.index)] < order[index]) at += 1;
    grid.insertBefore(cardElement(rows[index], index), existing[at] ?? null);
  }
}

function cardFor(family, index) {
  return gridFor(family)?.querySelector(`:scope > .loop-card[data-index="${index}"]`) ?? null;
}

/** The spacer and the button that stand in for cards the budget could not
 * hold. Both states go through here, because both are "the reader asked for
 * more of this section than is in the document": a family the cap evicted
 * whole, and one it could only half fill. The height is kept only while the
 * grid is empty — a grid holding two hundred of its cards is its own spacer,
 * and the old height over it would be a screen of nothing. */
function markShort(family, short) {
  const grid = gridFor(family);
  if (!grid) return;
  const empty = (state.inDom.get(family)?.size ?? 0) === 0;
  grid.dataset.unloaded = String(short);
  grid.style.minHeight = empty && state.heights.has(family)
    ? `${state.heights.get(family)}px` : '';
  let note = grid.querySelector('.remount-note');
  if (!note) {
    note = document.createElement('button');
    note.type = 'button';
    note.className = 'remount-note';
    note.dataset.family = family;
    note.onclick = () => remount(family);
    grid.prepend(note);
  }
  const what = empty ? `picture${short === 1 ? '' : 's'}` : 'more';
  note.textContent = `${short} ${what} unloaded to save memory — show them`;
  countsDirty = true;
  shells?.observe(grid);
}

function clearShort(family) {
  const grid = gridFor(family);
  if (!grid) return;
  grid.style.minHeight = '';
  if (!grid.dataset.unloaded) return;
  delete grid.dataset.unloaded;
  const note = grid.querySelector('.remount-note');
  if (note?.contains(document.activeElement)) handBack(family);
  note?.remove();
  shells?.unobserve(grid);
  countsDirty = true;
}

/** Move the focus out of a control this section is about to take away.
 *
 * "Show all" always empties its own bar, so every keyboard use of the
 * redesign's main control used to drop the focus on to <body>: in Chrome the
 * ring vanished, and in WebKit the next Tab restarted at the skip link, forty
 * thousand pixels above where the reader was standing. It goes to the FIRST
 * card the press brought in — which is the card that took the bar's own place
 * on the screen, so the reader carries on reading from where the button was,
 * and the next Tab walks the cards they asked for rather than the far end of a
 * section that may now be forty screens long. Failing that (nothing new
 * arrived, because the budget could not hold it) it goes to the section's own
 * heading, which at least says where it is.
 *
 * `preventScroll`, because the first new card is already where the reader is
 * looking and a scroll here would be the page moving under someone who only
 * pressed a button. */
const freshHead = new Map();          // family → the first index its last fill mounted
function handBack(family) {
  const first = freshHead.get(family);
  const card = first === undefined ? null : cardFor(family, first);
  const link = card?.offsetParent === null ? null : card?.querySelector('a.open');
  if (link) { link.focus({preventScroll: true}); return; }
  const heading = document.getElementById(`${family}-title`);
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({preventScroll: true});
}

/** Mount as much of what the reader has asked for as the budget allows, and
 * say so where it cannot manage all of it.
 *
 * In DISPLAY order, which is not the manifest's: 821 of the folded rows sit
 * BEFORE their representative in the manifest, so a walk in index order that
 * stopped at the cap mounted the member and dropped the card it belongs behind
 * — and `insertRows()` then put that orphan where the display order says, which
 * is behind a card it has nothing to do with. A dashed card reading "alike"
 * under a stranger is the fold's one claim ("they mount directly after their
 * representative") failing on screen. Walked in display order, a cut can only
 * ever fall AFTER a representative; the sweep below is the belt to that
 * braces, because eviction and a part-filled remount can each leave a gap the
 * walk never saw. */
function fill(family, {evict = true} = {}) {
  const want = state.want.get(family) ?? new Set();
  const have = setOf(state.inDom, family);
  const rows = state.byFamily.get(family) ?? [];
  const order = state.order.get(family) ?? [];
  const fresh = [];
  for (const index of [...want].sort((a, b) => order[a] - order[b])) {
    if (have.has(index)) continue;
    // `have` is `state.inDom`, so `mountedCount()` is already the running total
    // and adding this loop's own cards to it would count them twice — which is
    // how the ceiling once came down on the page at half of MOUNT_CAP.
    if (mountedCount() >= MOUNT_CAP && !(evict && unmountFurthest(family))) break;
    fresh.push(index);
    have.add(index);
  }
  // No folded card without the card it is folded behind, whatever the budget
  // did: it is worse to show a look-alike under a stranger than not to show it.
  for (let n = fresh.length - 1; n >= 0; n -= 1) {
    const row = rows[fresh[n]];
    if (!row?.alikeOf) continue;
    // `rep === undefined` is a row whose representative is not in this family
    // at all, which `buildOrder()` already treats as a card of its own.
    const rep = state.index.get(family)?.get(row.alikeOf);
    if (rep === undefined || have.has(rep)) continue;
    have.delete(fresh[n]);
    fresh.splice(n, 1);
  }
  // Every fresh card is built by `cardElement()`, which always writes a closed
  // chip — so a card rebuilt by a remount or by the kind filter arrived saying
  // "+10 alike" over ten look-alikes that were already on screen, and the next
  // click folded them instead of opening them. The chips are reconciled against
  // `state.expanded` here, which is the one place every mount goes through.
  if (fresh.length) {
    insertRows(family, fresh);
    updateChips(family);
    // The first of them in the order the GRID draws them, which is where the
    // reader's eye and `handBack()` both go: the card that takes the place the
    // button was standing in.
    const order = state.order.get(family) ?? [];
    freshHead.set(family, fresh.reduce((a, b) => (order[b] < order[a] ? b : a)));
    countsDirty = true;
  }
  const short = want.size - have.size;
  if (short > 0) markShort(family, short);
  else clearShort(family);
  return fresh.length;
}

/** Every section the budget left short, filled again while there is headroom —
 * in document order, and without evicting anybody.
 *
 * Choosing a kind drops thousands of cards at once, and a section the cap
 * emptied while "All" was on would otherwise stand as a spacer under its own
 * heading over a page with two hundred cards on it and eight hundred spare
 * slots. Nothing here takes a card away from anybody: it stops at the ceiling
 * rather than pushing a neighbour out, so it cannot start a ping-pong. */
function reflow() {
  for (const grid of grids()) {
    if (mountedCount() >= MOUNT_CAP) break;
    if (!grid.dataset.unloaded) continue;
    if (grid.closest('.showcase-section')?.hidden) continue;
    fill(grid.dataset.family, {evict: false});
  }
}

/** Bring what the section should be showing into line with what it is showing.
 *
 * Raising a quota, opening or closing a chip, turning the fold off, choosing a
 * kind: every one of them is this. `want` is what the reader asked for and
 * survives an eviction; `inDom` is what the budget could hold, and `fill` is
 * the only thing that decides it. */
function refresh(family) {
  if (!gridFor(family)) return 0;
  // Whatever the last press mounted here is no longer "the new cards": the
  // focus must never be handed to a card from two presses ago.
  freshHead.delete(family);
  const want = setOf(state.want, family);
  const have = setOf(state.inDom, family);
  const next = wantedFor(family);
  for (const index of [...want]) {
    if (next.has(index)) continue;
    want.delete(index);
    const card = cardFor(family, index);
    if (card) { detach(card); card.remove(); have.delete(index); }
    countsDirty = true;
  }
  for (const index of next) {
    if (want.has(index)) continue;
    want.add(index);
    countsDirty = true;
  }
  return fill(family);
}

/** Give the whole of a family back to the document — everything the reader has
 * already asked for, and nothing they have not. */
function remount(family) {
  const added = fill(family);
  observeAll();
  report();
  return added;
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
  state.heights.set(family, worst.offsetHeight);
  for (const card of [...worst.querySelectorAll(':scope > .loop-card')]) {
    detach(card);
    card.remove();
  }
  state.inDom.set(family, new Set());
  markShort(family, state.want.get(family)?.size ?? 0);
  return true;
}

/** Raise one section's quota, and mount what that asks for. `Infinity` is
 * "Show all": the quota is a number the hash carries, and `all` is how it
 * writes that one. */
function setQuota(family, quota) {
  state.quota.set(family, quota);
  state.pinned = family;
  refresh(family);
  reflow();
  observeAll();
  report();
  writeHash();
  schedule();
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
  refresh(family);
  reflow();
  observeAll();
  report();
}

// ---- the chip ----------------------------------------------------------------

/** Every chip in a section says whether its cluster is open, in the label and
 * in `aria-expanded`. Called after anything that can change that, including a
 * remount, which builds the chips afresh. */
function updateChips(family) {
  const families = family ? [family] : [...state.byFamily.keys()];
  for (const id of families) {
    const grid = gridFor(id);
    if (!grid) continue;
    for (const chip of grid.querySelectorAll(':scope > .loop-card > .alike')) {
      const card = chip.parentElement;
      const n = Number(card.dataset.alike) || 0;
      const open = state.expanded.has(lookKey(id, card.dataset.look));
      const label = open ? `fold ${n}` : `+${n} alike`;
      if (chip.textContent !== label) chip.textContent = label;
      chip.setAttribute('aria-expanded', String(open));
    }
  }
}

function toggleAlike(chip) {
  const card = chip.closest('.loop-card');
  const grid = card?.closest('.loop-grid[data-family]');
  if (!grid || !card?.dataset.look) return;
  const family = grid.dataset.family;
  const key = lookKey(family, card.dataset.look);
  if (state.expanded.has(key)) state.expanded.delete(key);
  else state.expanded.add(key);
  refresh(family);
  updateChips(family);
  observeAll();
  report();
  writeHash();
  schedule();
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
  visible.delete(card);
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
    if (!card.isConnected) continue;               // removed by a refold
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

function report() {
  const shown = [...cards()].filter(card => card.offsetParent !== null).length;
  $('mounted').textContent =
    `${mountedCount()} of ${state.rows.length} mounted · `
    + `${attached.size} playing${shown === cards().length ? '' : ` · ${shown} shown`}`;
  updateSectionCounts();
}

/** A section's heading and its two buttons say what the filter will actually
 * do, not what the unfiltered page holds: "Show all 76" that brings in 42 is
 * worse than no button.
 *
 * The "N distinct of M" spelling is `heading_text()` in `make-manifest.py`,
 * word for word, so that switching to a kind and back puts the served string
 * back rather than a paraphrase of it. */
let countsDirty = true;
function updateSectionCounts() {
  if (!countsDirty) return;
  countsDirty = false;
  const kind = kindNow();
  for (const [family, rows] of state.byFamily) {
    if (family === 'viewers') continue;           // "9 pages", whatever is on
    const mine = kind === 'all' ? rows : rows.filter(row => row.kind === kind);
    // The fold is a property of the catalogue, not of the reader's checkbox:
    // unticking "Fold look-alikes" shows more cards, it does not make the
    // section hold fewer look-alikes.
    const distinct = mine.filter(row => !row.alikeOf).length;
    const readout = document.querySelector(`.n[data-count="${CSS.escape(family)}"]`);
    if (readout) {
      const noun = kind === 'all' ? 'loops' : KIND_LABEL[kind];
      const head = distinct < mine.length
        ? `${distinct} distinct of ${mine.length} ${noun}` : `${mine.length} ${noun}`;
      const text = kind === 'all' ? `${head} · ${breakdown(rows)}` : head;
      if (readout.textContent !== text) readout.textContent = text;
    }
    const wrapper = document.querySelector(`.load-more[data-family="${CSS.escape(family)}"]`);
    if (!wrapper) continue;
    const unloaded = gridFor(family)?.dataset.unloaded;
    const pending = pendingFor(family);
    const gone = pending === 0 && !unloaded;
    if (wrapper.hidden !== gone) {
      // The bar is about to disappear from under the reader's finger. Hand the
      // focus on before it does, or it goes to <body>.
      if (gone && wrapper.contains(document.activeElement)) handBack(family);
      wrapper.hidden = gone;
    }
    const more = wrapper.querySelector('.show-more');
    const all = wrapper.querySelector('.show-all');
    // …and the step says what pressing it will do. p2 with 22 left under a
    // button promising 50 is the same lie as "Show all 76" bringing in 42.
    // Under fifty left, the step IS "all of them": two buttons that mount the
    // same cards are one button and a decision the reader has to make for
    // nothing, so only "Show all N" is drawn.
    const step = `Show ${pending > 0 ? Math.min(QUOTA, pending) : QUOTA} more`;
    if (more) {
      if (more.textContent !== step) more.textContent = step;
      const same = pending <= QUOTA;
      if (more.hidden !== same) {
        if (same && more.contains(document.activeElement)) all?.focus({preventScroll: true});
        more.hidden = same;
      }
    }
    const label = `Show all ${showAllCount(family, kind)}`;
    if (all && all.textContent !== label) all.textContent = label;
  }
}

function breakdown(rows) {
  return ['ember', 'colour', 'mono']
    .map(kind => [kind, rows.filter(row => row.kind === kind).length])
    .filter(([, n]) => n)
    .map(([kind, n]) => `${n} ${KIND_LABEL[kind]}`)
    .join(' · ');
}

/** Choosing a kind mounts that kind, everywhere it lives. Each section's own
 * quota now counts that kind's cards, so "Three-colour" — whose pictures are
 * all in the last five sections — gives fifty of them in each of those five
 * rather than a page with nothing on it. */
function setKind(kind, {write = true, mount = true} = {}) {
  if (!KINDS.has(kind)) kind = 'all';
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
    // `:scope >`, not `span`. A pill is `<b><span>2222</span></b><span>182</span>`
    // — p1's orbifold is a lone ring and the stylesheet needs a span of its own
    // to draw it larger — so the first span in the anchor is the SIGNATURE, and
    // writing the count into it replaced every orbifold on the rail with a
    // number the pill was already showing twice.
    const readout = anchor.querySelector(':scope > span');
    if (!readout || id === 'viewers') continue;
    // The pill counts what the section will SHOW, which is one card per
    // look-alike cluster, and its title carries the total it stands for.
    const distinct = mine.filter(row => !row.alikeOf).length;
    const text = String(distinct);
    if (readout.textContent !== text) readout.textContent = text;
    const noun = kind === 'all' ? 'loops' : KIND_LABEL[kind];
    const title = `${distinct} distinct-looking of ${mine.length} ${noun} in ${id}`;
    if (anchor.title !== title) anchor.title = title;
  }
  countsDirty = true;
  if (mount) {
    for (const family of state.byFamily.keys()) if (family !== 'viewers') refresh(family);
    reflow();
  }
  if (write) writeHash();
  observeAll();
  report();
  schedule();
}

/** "Fold look-alikes" off page-wide: every folded row is mounted as a card of
 * its own and counted by the quota like any other, so a section still holds its
 * fifty and the budget is still spread over all seventeen. It keeps its dashed
 * border and its "alike" word, because it is still a card that belongs to the
 * one before it — what the checkbox turns off is the hiding, not the kinship.
 * Back on, the folded rows leave the document again, all but the ones whose
 * chip the reader had opened. Quotas are untouched either way. */
function setUnfold(unfold, {write = true} = {}) {
  state.unfold = Boolean(unfold);
  page.dataset.unfold = state.unfold ? '1' : '';
  const box = $('fold-alike');
  if (box) box.checked = !state.unfold;
  for (const family of state.byFamily.keys()) {
    if (family === 'viewers') continue;
    refresh(family);
  }
  reflow();
  updateChips();
  observeAll();
  report();
  if (write) writeHash();
  schedule();
}

let hashTimer = 0, currentFamily = '';

/** `#p4g?kind=mono&more=p4g:100,p6:all&unfold=1` — the reader's place, their
 * filter, every section whose quota they raised and whether they unfolded. It
 * is written by hand rather than by `URLSearchParams.toString()`, which escapes
 * the `:` and the `,` and turns a legible link into `p4g%3A100%2Cp6%3Aall`. */
function writeHash() {
  const parts = [];
  if (page.dataset.kind && page.dataset.kind !== 'all') parts.push(`kind=${page.dataset.kind}`);
  const more = [];
  for (const grid of grids()) {
    const family = grid.dataset.family;
    const quota = state.quota.get(family);
    if (quota === undefined || quota === QUOTA) continue;
    more.push(`${family}:${quota === Infinity ? 'all' : quota}`);
  }
  if (more.length) parts.push(`more=${more.join(',')}`);
  if (state.unfold) parts.push('unfold=1');
  // Every chip the reader opened, `<family>/<cluster>`, so a reload or a shared
  // link lands on the folded card and not on the card that was hiding it — the
  // folded cards had no address at all. Capped at twelve: a hash is
  // something a reader can read, and twelve clusters is already a long one.
  const open = [...state.expanded].slice(0, 12);
  if (open.length) parts.push(`open=${open.join(',')}`);
  const text = parts.join('&');
  const hash = `#${currentFamily || 'viewers'}${text ? `?${text}` : ''}`;
  if (hash !== location.hash) history.replaceState(null, '', hash);
}

/** …and read back, with every field validated and anything else ignored: a
 * hash is something a reader can type, and a typo must cost them a default and
 * not a broken page. */
function readHash() {
  const raw = location.hash.replace(/^#/, '');
  const cut = raw.indexOf('?');
  const family = cut < 0 ? raw : raw.slice(0, cut);
  const query = new URLSearchParams(cut < 0 ? '' : raw.slice(cut + 1));
  const kind = query.get('kind');
  const more = new Map();
  for (const piece of (query.get('more') ?? '').split(',')) {
    const [name, size] = piece.split(':');
    if (!name || !state.byFamily.has(name) || name === 'viewers') continue;
    if (size === 'all') { more.set(name, Infinity); continue; }
    const n = Number(size);
    if (Number.isInteger(n) && n > 0 && n <= 100000) more.set(name, n);
  }
  const open = [];
  for (const piece of (query.get('open') ?? '').split(',')) {
    const cut = piece.indexOf('/');
    if (cut < 1 || cut === piece.length - 1) continue;
    const name = piece.slice(0, cut);
    if (!state.byFamily.has(name) || name === 'viewers') continue;
    open.push(piece);
  }
  return {
    family: state.byFamily.has(family) || family === 'viewers' ? family : '',
    kind: KINDS.has(kind) ? kind : 'all',
    more,
    open,
    unfold: query.get('unfold') === '1',
  };
}

/** The hash is the reader's place: `#p4` is written as they scroll past each
 * section, throttled, so a reload returns them to the same group. */
let settleTimer = 0;
function watchScroll() {
  addEventListener('scroll', () => {
    // One measurement after the scroll STOPS, whatever the throttle below and
    // the observer did on the way. The site scrolls smoothly, so a jump of four
    // thousand pixels arrives over about half a second: a budget reconciled
    // mid-flight hands decoders to the cards it was passing, and the last
    // rectangle it read is wrong by the time the page comes to rest.
    clearTimeout(settleTimer);
    settleTimer = setTimeout(schedule, 120);
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
  for (const [family, rows] of state.byFamily) state.order.set(family, buildOrder(family, rows));

  // The served cards are the first `--per-section` DEFAULT-VISIBLE rows of
  // their family, which is not the first n rows of it: a folded row sits in the
  // manifest between two served ones. Each card is matched by its id, so the
  // index it carries is the one `state.byFamily` knows it by.
  for (const grid of grids()) {
    const family = grid.dataset.family;
    const index = state.index.get(family) ?? new Map();
    const want = setOf(state.want, family);
    const have = setOf(state.inDom, family);
    for (const card of grid.querySelectorAll(':scope > .loop-card')) {
      const at = index.get(card.dataset.id);
      if (at === undefined) continue;
      card.dataset.index = String(at);
      want.add(at); have.add(at);
    }
    state.quota.set(family, Math.max(QUOTA, want.size));
  }

  watchShells();
  const wanted = readHash();
  for (const [family, quota] of wanted.more) state.quota.set(family, quota);
  for (const key of wanted.open) state.expanded.add(key);
  state.unfold = wanted.unfold;
  page.dataset.unfold = state.unfold ? '1' : '';
  const fold = $('fold-alike');
  if (fold) {
    fold.checked = !state.unfold;
    fold.onchange = () => setUnfold(!fold.checked);
  }
  setKind(wanted.kind, {write: false, mount: true});
  if (wanted.family && wanted.family !== 'viewers') {
    ensureMounted(wanted.family);
    // Instant, not smooth: a deep link is a fragment navigation, and the site's
    // smooth scrolling would spend a second and a half travelling ten thousand
    // pixels the reader never asked to see.
    document.getElementById(wanted.family)?.scrollIntoView({behavior: 'instant', block: 'start'});
    currentFamily = wanted.family;
  }
  updateChips();

  // The buttons are never removed: a family can be evicted again, and a reader
  // who came back to an emptied section needs the way back to still be there.
  for (const button of document.querySelectorAll('.show-more')) {
    button.onclick = () => setQuota(button.dataset.family,
                                    quotaOf(button.dataset.family) + QUOTA);
  }
  for (const button of document.querySelectorAll('.show-all')) {
    button.onclick = () => setQuota(button.dataset.family, Infinity);
  }
  // Delegated, because a chip can arrive with a card the script mounted, with a
  // card it remounted after an eviction, or in the served HTML.
  document.addEventListener('click', event => {
    const chip = event.target.closest?.('.alike');
    if (chip) toggleAlike(chip);
  });
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
    let moved = false;
    for (const [family, quota] of next.more) {
      if (quotaOf(family) === quota) continue;
      state.quota.set(family, quota);
      moved = true;
    }
    // The open chips are a set, so both what the hash gained and what it lost
    // have to be refreshed — a link with no `open=` folds everything back.
    const open = new Set(next.open);
    const sameOpen = open.size === state.expanded.size
      && [...open].every(key => state.expanded.has(key));
    if (!sameOpen) {
      const touched = new Set([...open, ...state.expanded].map(key => key.split('/')[0]));
      state.expanded = open;
      for (const family of touched) refresh(family);
      moved = true;
    }
    if (next.unfold !== state.unfold) setUnfold(next.unfold, {write: false});
    else if (moved) for (const [family] of next.more) refresh(family);
    if (next.kind !== page.dataset.kind) setKind(next.kind, {write: false});
    if (next.family) { ensureMounted(next.family); currentFamily = next.family; }
    updateChips();
    observeAll();
    report();
  });

  observeAll();
  watchScroll();
  report();
  page.dataset.ready = '1';
  const spaced = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  $('status').textContent =
    `${spaced(doc.counts.clips)} pictures in ${spaced(state.rows.length)} cards · `
    + `${spaced(doc.counts.distinct)} distinct-looking, `
    + `${spaced(doc.counts.folded)} folded behind them · `
    + 'previews attach only where you are looking.';
}

start().catch(error => {
  $('status').textContent = `The manifest did not load: ${error.message}`;
  page.dataset.ready = 'error';
});
