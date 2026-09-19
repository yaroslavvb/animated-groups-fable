// The controller for the two Colour explorer pages. `colour/gyre/index.html`
// and `colour/trefoil/index.html` are the same code with a different
// `data-colouring` on <main>; everything else comes from the catalog.
//
// The ladder is the `../scott-gray/pg/` page's, one rung wider:
//
//   1 · the base film group   + the colouring's own filter chips
//   2 · the equation
//   3 · the verified parameters  (the <select> and the parameter plane)
//   4 · the pattern              (thumbnails, in the three colours)
//
// and then the viewer, the generator marks, the measured symmetry table and the
// numerical record. Nothing here re-derives a colour law or a permutation: the
// catalog measured them at every node-frame and this page reads them.
import {loadColourCatalog, COLOURINGS} from './colour-atlas.mjs?v=20260919-colour-v1';
import {
  colouringParams, createColourRenderer, createView, homeScaleFor,
  LOOP_SECONDS, MAX_SCALE, MIN_SCALE, PALETTE,
} from './colour-renderer.mjs?v=20260919-colour-v1';
import {createGeneratorOverlay, legendMarkup} from './colour-generators.mjs?v=20260919-colour-v1';
import {createGestures} from './colour-gestures.mjs?v=20260919-colour-v1';
import {readViewState, writeViewHash} from './colour-view-state.mjs?v=20260919-colour-v1';

const VERSION = '20260919-colour-v1';
const root = new URL('./', import.meta.url);
const $ = id => document.getElementById(id);
const page = document.querySelector('main.colour-page');
const KIND = page.dataset.colouring;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const mod1 = value => ((value % 1) + 1) % 1;
const star = text => String(text ?? '').replace(/\*/g, '∗');
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const fixed = value => (Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : '—');
const sci = value => (Number.isFinite(value) ? value.toExponential(2) : '—');
const COLOUR_NAMES = ['terracotta', 'teal', 'sand'];
const SUBSCRIPT = {Z3: 'Z₃', S3: 'S₃', Z2: 'Z₂'};
/** The colour group of the entry on screen — never the per-kind constant. 12 of
 * the 200 Gyre entries measure S₃, and the page used to print Z₃ in the header
 * and the group pill while its own table footer said S₃ three inches below. */
const piText = name => SUBSCRIPT[name] ?? String(name ?? '—');
/** float32 little-endian, written explicitly rather than by reinterpreting the
 * typed array's buffer, so the export is the same bytes on any host. */
function base64Of(values) {
  const bytes = new Uint8Array(4 * values.length);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(4 * i, values[i], true);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The filter chips of step 1. They are the two flags the mining report asked
 * to be visible, promoted to a choice; `pairs` is Trefoil's own toggle. */
const FILTERS = {
  gyre: [
    {key: 'featured', label: 'Featured', note: 'chosen by eye'},
    {key: 'entangled', label: 'Fully entangled', note: 'no recolouring survives a frozen frame'},
    {key: 'lattice', label: 'Colour-preserving = lattice', note: 'nothing but the slides keep the colours'},
    {key: 'all', label: 'All', note: 'every admitted centre'},
  ],
  trefoil: [
    {key: 'featured', label: 'Featured', note: 'chosen by eye'},
    {key: 'all', label: 'All', note: 'every admitted field'},
  ],
};
const PASSES = {
  featured: entry => entry.featured,
  entangled: entry => entry.fullyEntangled !== false,
  lattice: entry => entry.latticeOnly === true,
  all: () => true,
};
const FILTER_KEYS = new Set(FILTERS[KIND].map(item => item.key));
/** What a link with no `sub=` opens on. "Featured" is a gallery filter — 30
 * entries spread over 20 film groups — so opening on it gave a four-rung
 * ladder whose bottom three rungs were single-choice, no parameter plane and
 * no thumbnail strip, on a page whose card had just advertised 200 colourings.
 * The page opens on the whole catalog and picks a featured picture inside it;
 * the chip is still the first one in the row. */
const DEFAULT_FILTER = 'all';

let catalog = null, groups = [], entriesOfKind = [], partners = new Map();
let groupId = null, filter = 'all', pairs = KIND === 'trefoil';
let modelId = null, parameterKey = null, selectedId = null, record = null;
let renderer = null, view = null, overlay = null, gestures = null;
let phase = 0, playing = false, lastTime = 0, selectionToken = 0, mapGeometry = null;
let requested = {phase: 0, play: true}, requestedCamera = null, marksOn = true, notationOn = false;
let needsDraw = true, lastEngine = '', wasFixed = false;

let canvas = $('pattern');
let contextLost = false;
const size = () => [canvas.clientWidth || 1, canvas.clientHeight || 1];

/** A WebGL context is not forever. Backgrounding a tab on Android or iOS makes
 * the browser recycle the GPU process, and the canvas then keeps its last
 * pixels — or goes flat black — while every draw call is silently dropped.
 * Without a listener the page went on printing "Saved animation ready" and an
 * engine line over a black square, with the marks still drawn on top of it.
 * `preventDefault` is also what asks the browser for a restore at all. */
function bindCanvas() {
  canvas.onkeydown = event => { if (event.code === 'Space') { event.preventDefault(); togglePlayback(); } };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    ++selectionToken;
    empty({error: 'The graphics context was lost — the browser recycled the GPU for this tab.'});
    $('status').textContent = 'The graphics context was lost. Retry redraws the animation.';
  });
  canvas.addEventListener('webglcontextrestored', () => { if (selectedId) retryAnimation(); });
}
/** A lost context stays lost on the element that held it: `getContext` hands
 * back the same dead context for ever. So the retry starts from a fresh canvas
 * element, cloned from the one in the markup so it keeps its label and size. */
function retryAnimation() {
  if (!catalog || !selectedId) { location.reload(); return; }
  if (contextLost) {
    const fresh = canvas.cloneNode(false);
    delete fresh.dataset.ready;
    canvas.replaceWith(fresh);
    canvas = fresh;
    contextLost = false;
    bindCanvas();
  }
  selectPattern(selectedId, {user: true});
}

// ---- selection ------------------------------------------------------------

/** An entry is filed under **every** film group that hosts it, not only the
 * canonical one the build named. 47 of the 258 entries sit in more than one —
 * the shipped standalone Gyre field is catalogued under both g225 and g247 —
 * and filing by `groupId` alone hid five Gyre groups and two Trefoil groups
 * from step 1, and silently dropped a `pattern=` deep link whose entry was
 * catalogued elsewhere. */
const hosts = (entry, id) => entry.groupIds.includes(id);
const groupEntries = (id, key = filter) => entriesOfKind.filter(entry => hosts(entry, id) && PASSES[key](entry));
/** The film group the page opens on when the link does not name one: the one
 * with the most entries under the current filter, so a reader never lands on a
 * group holding a single pattern. */
const fullestGroup = () => groups.reduce((best, item) =>
  !best || groupEntries(item.id).length > groupEntries(best.id).length ? item : best, null);
/** Where the page opens when the link names nothing at all. Not simply the
 * fullest group: the ladder has four rungs and the reader should meet a choice
 * on each of them, so the opening cell is the (group, equation) pair holding
 * the most saved parameter sets, and among ties the most patterns. Opening on
 * the first featured entry landed on g248 + Brusselator — one parameter set,
 * one pattern, no parameter plane and no thumbnail strip, on a page whose card
 * had just advertised 200 colourings. */
function openingCell() {
  let best = null;
  for (const item of groups) {
    const here = groupEntries(item.id);
    for (const model of new Set(here.map(entry => entry.model))) {
      const patterns = here.filter(entry => entry.model === model);
      const score = [new Set(patterns.map(keyOf)).size, patterns.length];
      if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) {
        best = {id: item.id, model, score};
      }
    }
  }
  return best;
}
/** The pattern list of the current group: its own entries under the filter,
 * and — on Trefoil with the pairs chip on — each one's mirror partner from the
 * opposite chirality directly after it, so a pair reads as a pair. */
function patternList(id = groupId, model = modelId) {
  const own = groupEntries(id).filter(entry => !model || entry.model === model);
  if (!(KIND === 'trefoil' && pairs)) return own;
  const out = [], seen = new Set();
  for (const entry of own) {
    if (!seen.has(entry.id)) { out.push(entry); seen.add(entry.id); }
    const partner = partners.get(entry.id);
    if (partner && !seen.has(partner.id) && (!model || partner.model === model)) { out.push(partner); seen.add(partner.id); }
  }
  return out;
}
const modelEntries = model => patternList(groupId, null).filter(entry => entry.model === model);
const modelsPresent = () => [...new Set(patternList(groupId, null).map(entry => entry.model))]
  .sort((a, b) => modelEntries(b).length - modelEntries(a).length || a.localeCompare(b));

const keyOf = entry => JSON.stringify([entry.model, ...(catalog.models[entry.model]?.parameters ?? []).map(name => entry.params[name]), entry.L]);
function parameterSets(model = modelId) {
  const sets = new Map();
  for (const entry of patternList(groupId, model)) {
    const key = keyOf(entry);
    if (!sets.has(key)) sets.set(key, {key, entry, patterns: []});
    sets.get(key).patterns.push(entry);
  }
  const [x, y] = catalog.models[model]?.axes ?? ['F', 'k'];
  return [...sets.values()].sort((a, b) => b.patterns.length - a.patterns.length
    || (a.entry.params[x] ?? 0) - (b.entry.params[x] ?? 0)
    || (a.entry.params[y] ?? 0) - (b.entry.params[y] ?? 0)
    || a.entry.L - b.entry.L);
}

/** Every dial that names a parameter *set*, in the order a reader should meet
 * them: the two the models table nominates as the plane's axes first, then the
 * rest of its parameters, then `L`. `L` is not a parameter of the equation at
 * all — it is the box the orbit was found in — but it separates two saved sets
 * as surely as any of them, so it belongs at the end of the list.
 *
 * `dx` is deliberately NOT here. A set is exactly what `keyOf` collapses, and
 * that leaves `dx` out: one Gray–Scott set holds the same (F, k, Dᵤ, Dᵥ, L) at
 * 66², 90², 96² and 120², which is four values of `dx`. A label or an axis made
 * from it would be reading one member's grid as the whole set's. The selected
 * entry's own `dx` is in the full readout below the chooser. */
function dialsOf(model) {
  const spec = catalog.models[model] ?? {};
  const names = [...(spec.axes ?? []), ...(spec.parameters ?? [])];
  return [...new Set(names.filter(name => name && name !== 'stencil' && name !== 'dx')), 'L'];
}
const dialValue = (entry, name) => (name === 'L' ? entry?.L : entry?.params?.[name]);
/** The dials that actually differ between these saved sets — the only ones that
 * can tell them apart. The models table decides the *order*; the data decides
 * which of them are worth printing. Without this a λ–ω group lists four sets as
 * four identical lines, because λ₀ and λ₁ (the head of its parameter list) are
 * the same 1 in every orbit the search admitted and the sets differ in ω. */
function varyingDials(model, sets) {
  return dialsOf(model).filter(name => {
    const first = dialValue(sets[0]?.entry, name);
    return sets.some(set => dialValue(set.entry, name) !== first);
  });
}
/** The shortest run of dials, in that same order, that still gives every set
 * its own line — usually two. A set is exactly a value for each dial, so the
 * full list always separates them; stopping as soon as they are separated keeps
 * the chooser inside the width of a phone's `<select>`. */
function namingDials(model, sets) {
  const used = [];
  for (const name of varyingDials(model, sets)) {
    used.push(name);
    if (new Set(sets.map(set => used.map(dial => dialValue(set.entry, dial)).join('|'))).size === sets.length) break;
  }
  return used;
}
/** The axes to plot these sets against: the pair of varying dials that lands
 * the most sets on distinct points, and — because `varyingDials` is in the
 * models table's own order, axes first — the table's declared pair whenever it
 * does as well as any other. Two dials that vary are not enough: six saved
 * Schnakenberg sets take two values of a and two of b and three of L, so a × b
 * draws six sets as two dots with four of them unreachable underneath.
 *
 * Sel'kov's a and b are the same in every admitted orbit, and most Gray–Scott
 * groups hold k fixed and move along F alone. A family that moves along ONE
 * dial is drawn as a strip — the vertical is `null` and the dots sit on the
 * axis itself — and a family that does not move at all has no map. */
function planeAxes(model, sets) {
  const varying = varyingDials(model, sets);
  if (!varying.length) return null;
  if (varying.length === 1) return [varying[0], null];
  const spread = (x, y) => new Set(sets.map(set => `${dialValue(set.entry, x)}|${dialValue(set.entry, y)}`)).size;
  let best = null;
  for (const x of varying) for (const y of varying) {
    if (x === y) continue;
    const score = spread(x, y);
    if (!best || score > best.score) best = {axes: [x, y], score};
  }
  return best.axes;
}

/** `step: true` marks a rung of the ladder — a group tile, a filter chip, an
 * equation pill, a parameter set or a pattern. Those get a history entry, so
 * Back undoes the last choice instead of leaving the page; everything else
 * (the camera, the phase, playback, palette, marks) replaces, because those
 * fire continuously and would bury the page in history. */
function syncUrl({step = false} = {}) {
  if (!groupId) return;
  const [width, height] = size();
  const camera = view && $('framing').value === 'endless'
    ? {x: view.center[0], y: view.center[1], scale: view.scale(width, height), angle: view.angle * 180 / Math.PI}
    : {};
  const hash = writeViewHash({
    groupId, sub: `${filter}${KIND === 'trefoil' && pairs ? ',pairs' : ''}`, model: modelId, patternId: selectedId,
    framing: $('framing').value, tiles: +$('tiles').value, palette: $('palette').value, speed: +$('speed').value,
    marks: marksOn, notation: notationOn, ...(record ? {phase, play: playing} : requested), ...camera,
  });
  // `pushState` does not fire `hashchange`, so restoreUrl() is not re-entered
  // by our own writes; the listener only ever sees a real Back, Forward or a
  // pasted link.
  if (step && hash !== location.hash) history.pushState(null, '', hash);
  else history.replaceState(null, '', hash);
}

// ---- rendering the ladder --------------------------------------------------

function renderGroups() {
  const holder = $('variants');
  holder.style.setProperty('--group-count', Math.min(5, Math.max(1, groups.length)));
  holder.replaceChildren(...groups.map(item => {
    const total = groupEntries(item.id, 'all').length, shown = groupEntries(item.id).length;
    const button = document.createElement('button');
    button.className = 'group'; button.type = 'button'; button.dataset.groupId = item.id;
    button.setAttribute('aria-pressed', String(item.id === groupId));
    // Not `disabled`: a disabled button is skipped by Tab, so a keyboard reader
    // was never told that five of the twenty groups exist at all. They are
    // empty only under the filter chosen below, and choosing one now widens the
    // filter to reach it — so the tile is live, and says what it will do.
    const empty = shown === 0;
    button.classList.toggle('is-empty', empty);
    const name = document.createElement('strong'); name.textContent = star(item.signature);
    const span = document.createElement('span');
    span.textContent = item.id;
    const count = document.createElement('span');
    count.className = 'orbit-count';
    count.textContent = filter === 'all' ? plural(total, 'pattern') : `${shown} of ${total}`;
    span.append(count);
    button.append(name, span);
    const reach = filter === 'all' ? '' : ` · ${shown} of them pass the “${FILTERS[KIND].find(f => f.key === filter)?.label ?? filter}” filter below`;
    button.title = empty
      ? `${item.id} · ${star(item.orbifold)} · ${plural(total, 'catalogued colouring')}, none under this filter — choosing it switches the filter to “All”.`
      : `${item.id} · ${star(item.orbifold)} · ${plural(total, 'catalogued colouring')}${reach}`;
    button.setAttribute('aria-label', button.title);
    button.onclick = () => (empty ? chooseFilter('all', {groupId: item.id}) : chooseGroup(item.id, {user: true}));
    return button;
  }));
  $('variants-note').textContent = filter === 'all'
    ? 'Each tile counts the colourings the catalog holds for that film group.'
    : 'On each tile the first number counts the colourings passing the filter below; the second is everything the catalog holds for that group. Choosing an empty tile switches the filter to “All”.';
}

/** The two kinds of chip in one row. Featured / Fully entangled / … are
 * mutually exclusive and are marked up as a radio group; chirality pairs is an
 * independent switch and is marked up as one. They used to be four identical
 * `aria-pressed` buttons, two of which were pressed at once on load. */
function renderFilters() {
  const holder = $('subvariants');
  const nodes = [];
  const caption = document.createElement('span');
  caption.className = 'subvariant-label';
  caption.textContent = 'Show';
  nodes.push(caption);
  const set = document.createElement('span');
  set.className = 'subvariant-set';
  set.setAttribute('role', 'radiogroup');
  set.setAttribute('aria-label', 'Which colourings to show');
  const radios = [];
  for (const item of FILTERS[KIND]) {
    const count = entriesOfKind.filter(PASSES[item.key]).length;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'subvariant'; button.dataset.filter = item.key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(item.key === filter));
    button.tabIndex = item.key === filter ? 0 : -1;
    button.disabled = count === 0;
    button.append(`${item.label} (${count})`);
    if (item.note) { const small = document.createElement('small'); small.textContent = item.note; button.append(small); }
    button.onclick = () => chooseFilter(item.key);
    radios.push(button);
    set.append(button);
  }
  // One tab stop for the set, arrows to move inside it — the radio pattern.
  set.onkeydown = event => {
    const step = {ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1}[event.key];
    if (!step) return;
    const live = radios.filter(button => !button.disabled);
    const index = live.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = live[(index + step + live.length) % live.length];
    next.focus(); next.click();
  };
  nodes.push(set);
  // The pairs switch exists only where the build actually recorded a mirror
  // partner. With no chirality data it was a control that changed nothing but
  // the URL, and it shipped pressed.
  if (KIND === 'trefoil' && partners.size) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'subvariant toggle'; button.dataset.filter = 'pairs';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(pairs));
    button.append(`Chirality pairs (${partners.size})`);
    const small = document.createElement('small'); small.textContent = 'show each field beside its mirror';
    button.append(small);
    button.onclick = () => { pairs = !pairs; renderFilters(); populate(); syncUrl({step: true}); };
    nodes.push(button);
  } else pairs = false;
  holder.replaceChildren(...nodes);
}

function renderEquations() {
  const present = modelsPresent();
  const order = [...present, ...Object.keys(catalog.models).filter(model => !present.includes(model))];
  $('equations').replaceChildren(...order.map(model => {
    const count = modelEntries(model).length, button = document.createElement('button');
    button.type = 'button'; button.className = 'equation'; button.dataset.model = model; button.disabled = !count;
    button.setAttribute('aria-pressed', String(model === modelId));
    const small = document.createElement('small'); small.textContent = count ? plural(count, 'pattern') : 'none here';
    button.append(catalog.models[model]?.name ?? model, small);
    button.title = (catalog.models[model]?.equation ?? '').replace('\n', '; ');
    button.onclick = () => chooseModel(model, {user: true});
    return button;
  }));
  $('equation-description').textContent = modelId ? catalog.models[modelId]?.equation ?? '' : '';
  $('equation-note').textContent = modelId ? catalog.models[modelId]?.description ?? '' : '';
}

function renderParameterMap(sets) {
  const map = $('parameter-map'), context = map.getContext('2d');
  map.parentElement.hidden = sets.length < 2; mapGeometry = null;
  if (sets.length < 2) return;
  // The backing store follows the element, not a fixed 660 × 320: in the
  // sidebar the canvas is about 294 CSS px wide, so a fixed store was being
  // scaled down 0.44× and the 18 px axis names landed at 8 px on screen.
  const css = map.clientWidth || 300;
  const ratio = Math.min(3, Math.max(1, devicePixelRatio || 1));
  const width = Math.round(css * ratio), height = Math.round(css * 0.48 * ratio);
  if (map.width !== width || map.height !== height) { map.width = width; map.height = height; }
  map.style.height = `${Math.round(css * 0.48)}px`;
  const px = value => value * ratio * (css / 300);
  const labels = catalog.models[modelId]?.labels ?? {};
  const named = name => labels[name] ?? name;
  const axes = planeAxes(modelId, sets);
  // One dial, or a dial the catalog does not carry, is nothing to plot against;
  // the `<select>` above already carries every choice, in the same order.
  if (!axes) { map.parentElement.hidden = true; return; }
  const [xName, vertical] = axes;
  const strip = vertical === null;
  const points = sets.map(set => ({set, x: dialValue(set.entry, xName), y: strip ? 0 : dialValue(set.entry, vertical)}));
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) { map.parentElement.hidden = true; return; }
  const extent = axis => { const lo = Math.min(...points.map(p => p[axis])), hi = Math.max(...points.map(p => p[axis])); const pad = Math.max((hi - lo) * .15, Math.abs(lo) * .04, 1e-5); return [lo - pad, hi + pad]; };
  const [xmin, xmax] = extent('x'), [ymin, ymax] = strip ? [-1, 1] : extent('y');
  const margin = {left: px(strip ? 34 : 62), right: px(30), top: px(20), bottom: px(40)};
  const project = p => [margin.left + (p.x - xmin) / (xmax - xmin) * (width - margin.left - margin.right), height - margin.bottom - (p.y - ymin) / (ymax - ymin) * (height - margin.top - margin.bottom)];
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height); context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
  // A one-dial family is a strip: the dots sit on the one axis they move along,
  // and there is no vertical axis to invent.
  const axisY = strip ? project({x: xmin, y: 0})[1] : height - margin.bottom;
  context.strokeStyle = '#dfdbe8'; context.lineWidth = Math.max(1, px(1)); context.beginPath();
  if (!strip) { context.moveTo(margin.left, margin.top); context.lineTo(margin.left, axisY); } else context.moveTo(margin.left, axisY);
  context.lineTo(width - margin.right, axisY);
  context.stroke();
  // A tick at every distinct value the sets take, not only at the two ends:
  // four Gray–Scott sets inside a 40 px band were three unlabelled dots.
  const ticks = axis => [...new Set(points.map(p => p[axis]))].sort((a, b) => a - b);
  context.strokeStyle = '#efecf4';
  context.beginPath();
  if (!strip) for (const x of ticks('x')) { const [sx] = project({x, y: ymin}); context.moveTo(sx, margin.top); context.lineTo(sx, axisY); }
  if (!strip) for (const y of ticks('y')) { const [, sy] = project({x: xmin, y}); context.moveTo(margin.left, sy); context.lineTo(width - margin.right, sy); }
  context.stroke();
  context.fillStyle = '#5b6370'; context.font = `600 ${px(13)}px system-ui`; context.textAlign = 'center';
  context.fillText(named(xName), (margin.left + width - margin.right) / 2, height - px(6));
  if (!strip) { context.save(); context.translate(px(13), (margin.top + axisY) / 2); context.rotate(-Math.PI / 2); context.fillText(named(vertical), 0, 0); context.restore(); }
  context.font = `${px(11)}px system-ui`; context.fillStyle = '#6b7280';
  // The end ticks are pulled inside the canvas rather than centred on the axis
  // ends: a six-figure F is wider than the margin and would be clipped.
  const xs = ticks('x');
  context.textAlign = 'left'; context.fillText(fixed(xs[0]), margin.left, axisY + px(16));
  if (xs.length > 1) { context.textAlign = 'right'; context.fillText(fixed(xs[xs.length - 1]), width - margin.right, axisY + px(16)); }
  if (!strip) { const ys = ticks('y'); for (const y of [ys[0], ys[ys.length - 1]]) { context.textAlign = 'right'; context.fillText(fixed(y), margin.left - px(5), project({x: xmin, y})[1] + px(4)); } }
  // A strip has room to spare and one thing worth saying in it: what is NOT
  // moving between these sets.
  if (strip) {
    const held = dialsOf(modelId).filter(name => name !== xName)
      .map(name => `${named(name)} ${fixed(dialValue(sets[0].entry, name))}`).join(' · ');
    context.textAlign = 'center'; context.fillStyle = '#9aa1ad'; context.font = `${px(11)}px system-ui`;
    if (held) context.fillText(`${held} — the same in all ${sets.length}`, width / 2, axisY - px(26));
  }
  // The dot's area carries how many patterns the set holds, so a set of eleven
  // does not read as a set of one.
  const most = Math.max(...sets.map(set => set.patterns.length));
  for (const point of points) {
    const [x, y] = project(point), selected = point.set.key === parameterKey;
    const weight = most > 1 ? Math.sqrt(point.set.patterns.length / most) : 1;
    const r = px(3.2 + 2.6 * weight) * (selected ? 1.25 : 1);
    context.beginPath(); context.arc(x, y, r, 0, 2 * Math.PI);
    context.fillStyle = selected ? '#3b6ea5' : '#9db4d0'; context.fill();
    if (selected) { context.lineWidth = px(2.4); context.strokeStyle = '#d3e0ef'; context.stroke(); }
  }
  mapGeometry = points.map(p => ({set: p.set, point: project(p)}));
  const drawnAgainst = strip ? `along ${named(xName)} alone` : `${named(xName)} versus ${named(vertical)}`;
  map.setAttribute('aria-label', `Saved ${catalog.models[modelId]?.name ?? modelId} parameter sets, ${drawnAgainst}. Click to select the closest verified point, or use arrow keys.`);
  $('parameter-map-caption').textContent = `${plural(sets.length, 'saved set')}, ${drawnAgainst}. Dot area is how many patterns the set holds.`;
}
/** Names the set nearest the pointer, so a dot is readable without clicking. */
function nearestSet(event) {
  if (!mapGeometry?.length) return null;
  const map = $('parameter-map'), rect = map.getBoundingClientRect();
  const point = [(event.clientX - rect.left) / rect.width * map.width, (event.clientY - rect.top) / rect.height * map.height];
  return mapGeometry.reduce((best, item) => {
    const distance = (point[0] - item.point[0]) ** 2 + (point[1] - item.point[1]) ** 2;
    return !best || distance < best.distance ? {...item, distance} : best;
  }, null);
}

const patternLabel = entry => `${entry.name} · T ${entry.period.toFixed(2)} · ${entry.N}²`;

/** The chooser's own name for a saved parameter set — also what the hover
 * readout over the plane prints, so the two agree. */
let setLabel = () => '';

function populate() {
  const sets = parameterSets();
  const chosen = sets.find(set => set.key === parameterKey) ?? sets[0] ?? null;
  parameterKey = chosen?.key ?? null;
  const patterns = chosen?.patterns ?? [];
  const names = catalog.models[modelId]?.parameters ?? [];
  const labels = catalog.models[modelId]?.labels ?? {};
  const text = (entry, list) => list.map(name => `${labels[name] ?? name} ${fixed(dialValue(entry, name))}`).join(' · ');
  // Name each saved set by the dials that tell these particular sets apart —
  // never by a fixed pair, which on λ–ω would print four identical lines.
  // With one set there is nothing to separate, so it is named by the plane's
  // own axes, which is what the reader has just been reading about.
  const varying = namingDials(modelId, sets);
  const naming = varying.length ? varying : [...new Set([...(catalog.models[modelId]?.axes ?? []), 'L'])];
  setLabel = set => `${text(set.entry, naming)} · ${plural(set.patterns.length, 'pattern')}`;
  $('parameter-set').replaceChildren(...(sets.length ? sets.map(set => {
    const option = document.createElement('option'); option.value = set.key;
    option.textContent = setLabel(set);
    option.selected = set.key === parameterKey;
    return option;
  }) : [new Option('No verified parameters', '')]));
  // The full reading belongs to the entry on screen, not to the set's first
  // member: two patterns of one set can be the same equation at two grid
  // resolutions, and then `dx` is the one number that differs.
  const readout = patterns.find(entry => entry.id === selectedId) ?? chosen?.entry ?? null;
  $('parameter-values').textContent = readout
    ? `${text(readout, names)} · L ${fixed(readout.L)} · dx ${fixed(readout.params.dx)} · stencil ${readout.params.stencil}`
    : 'No verified parameter sets';
  $('solution').replaceChildren(...(patterns.length ? patterns.map(entry => {
    const option = new Option(patternLabel(entry), entry.id); option.selected = entry.id === selectedId; return option;
  }) : [new Option('No verified patterns', '')]));
  $('pattern-thumbnails').replaceChildren(...patterns.map((entry, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pattern-thumb'; button.dataset.patternId = entry.id;
    button.setAttribute('aria-pressed', String(entry.id === selectedId));
    button.setAttribute('aria-label', `Pattern ${index + 1}: ${patternLabel(entry)}`);
    const image = document.createElement('img');
    image.src = entry.thumbnail; image.alt = ''; image.width = 160; image.height = 160; image.loading = 'lazy'; image.decoding = 'async';
    const caption = document.createElement('span');
    caption.textContent = `${index + 1}. ${entry.name}`;
    const tag = document.createElement('span');
    tag.className = 'thumb-tag';
    tag.textContent = hosts(entry, groupId)
      ? `${entry.exactSymmetryCount} exact · ${entry.metrics.boundaryDensity.toFixed(3)} edges`
      : `mirror partner · ${entry.groupId}`;
    button.append(image, caption, tag);
    button.onclick = () => selectPattern(entry.id, {user: true});
    return button;
  }));
  $('pattern-count').textContent = plural(patterns.length, 'verified pattern');
  $('solution-count').textContent = `${plural(modelsPresent().length, 'equation')} · ${plural(patternList(groupId, null).length, 'pattern')}`;
  renderGroups(); renderEquations(); renderParameterMap(sets); controls();
}

function controls() {
  for (const id of ['play', 'rewind', 'phase', 'export']) $(id).disabled = !record;
  $('parameter-set').disabled = !patternList().length;
  $('solution').disabled = !patternList().length;
  $('tiles').disabled = $('framing').value !== 'simulation';
  $('show-marks').disabled = !record || !record.generators;
  $('show-marks').parentElement.title = record && !record.generators
    ? 'This entry’s catalog record does not carry its generator marks yet, so none can be drawn.' : '';
  $('reset-view').disabled = !record || $('framing').value !== 'endless';
}

// ---- the viewer ------------------------------------------------------------

function engineLabel() {
  if (!record || !renderer) { $('engine-label').textContent = 'No orbit loaded'; lastEngine = ''; return; }
  const text = `${renderer.backend} · ${record.N}² × ${record.M} · T ${record.period.toFixed(2)} · ${renderer.taps} taps/px`;
  if (text !== lastEngine) { $('engine-label').textContent = text; lastEngine = text; }
}

function updateScaleLabel() {
  if (!view) { $('scale-label').textContent = ''; return; }
  const [width, height] = size();
  const scale = view.scale(width, height);
  $('scale-label').textContent = $('framing').value === 'simulation'
    ? `Fixed frame · ${$('tiles').value === '1' ? 'L' : `${$('tiles').value} L`} across`
    : `${Math.round(scale)} CSS px per lattice length${view.angle ? ` · turned ${(view.angle * 180 / Math.PI).toFixed(0)}°` : ''}`;
}

function applyFraming() {
  if (!view) return;
  const framing = $('framing').value;
  const wrapper = document.querySelector('.canvas-wrap');
  wrapper.classList.toggle('endless', framing === 'endless');
  wrapper.classList.toggle('simulation', framing === 'simulation');
  if (gestures) gestures.enabled = framing === 'endless';
  if (framing === 'simulation') {
    const [width, height] = size();
    view.fix(+$('tiles').value, width, height);
    $('viewer-hint').textContent = 'Fixed frame — the simulation’s own width, so this entry is comparable with the same orbit on its wallpaper page.';
  } else {
    // Coming back from the fixed frame, the camera starts at home rather than
    // at whatever scale the fixed width happened to pin it to.
    if (wasFixed) view.reset();
    // A touch device has no scroll wheel and no 0 key; the gestures it does
    // have are already implemented, only the caption was wrong.
    $('viewer-hint').textContent = matchMedia('(hover: none)').matches
      ? 'Drag to pan · pinch to zoom · two fingers to turn · Reset view below'
      : 'Drag to pan · scroll to zoom · two fingers to turn · 0 resets';
  }
  wasFixed = framing === 'simulation';
  $('tile-label').textContent = 'Width';
  controls(); updateScaleLabel(); needsDraw = true; drawMarks(true);
}

function drawMarks(force = false) {
  if (!overlay) return;
  const [width, height] = size();
  $('marks').setAttribute('viewBox', `0 0 ${width} ${height}`);
  $('marks').style.display = marksOn && record?.generators ? '' : 'none';
  if (marksOn && record?.generators) overlay.update(width, height, {force});
}

function draw() {
  if (!record || !renderer) return;
  if ($('framing').value === 'simulation') { const [width, height] = size(); view.fix(+$('tiles').value, width, height); }
  renderer.draw(phase, {continuous: true, moving: playing, time: lastTime});
  $('phase').value = phase;
  $('phase-label').textContent = `${phase.toFixed(3)} T`;
  engineLabel(); updateScaleLabel();
}

function setPlaying(value) {
  playing = !!record && !!value;
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}

function updateDisplayRange() {
  if (!record) { $('display-range').textContent = ''; return; }
  const mode = $('palette').value;
  const channel = mode === 'concentration' ? 1 : 0;
  const range = record.ranges[channel ? 'v' : 'u'] ?? record.ranges.u;
  const name = catalog.models[record.model]?.channels?.[channel] ?? (channel ? 'V' : 'U');
  const shares = record.metrics.areaFractions.map(value => value.toFixed(3)).join(' / ');
  // The shares belong to the colouring, not to what is on screen. Beside a
  // monochrome Ember or second-channel render they invited the reader to look
  // for three colours that are not there.
  $('display-range').textContent = `${name} ${fixed(range[0])} – ${fixed(range[1])}`
    + (mode === 'colour' ? ` · colour shares ${shares}` : ` · the colouring these bytes carry: ${shares}`);
}

/** Some search records save only the channel the colouring reads, so the second
 * channel is offered only where its range was recorded. */
function updateAppearanceOptions() {
  const option = [...$('palette').options].find(item => item.value === 'concentration');
  if (!option) return;
  const available = !!record?.hasSecondChannel;
  option.disabled = !available;
  option.title = available ? '' : 'This record saved only the channel the colouring reads.';
  if (!available && $('palette').value === 'concentration') $('palette').value = 'colour';
}

// ---- the evidence blocks ---------------------------------------------------

const timeText = (frames, M) => {
  if (!frames) return '0';
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(frames, M);
  return `${frames / d === 1 ? '' : frames / d}T${M / d === 1 ? '' : `/${M / d}`}`;
};
/** The colour column of the symmetry table, read off the permutation itself.
 * The catalog used to ship a `permName` beside it — "identity", "+1", "−1" —
 * only because this page read it; it no longer does, on either side of the
 * table. The permutation is what was measured, and the three colours have
 * names here. */
const permText = perm => {
  const moved = [0, 1, 2].filter(c => perm[c] !== c);
  if (!moved.length) return 'unchanged';
  if (perm[0] === 1 && perm[1] === 2) return 'each steps forward one';
  if (perm[0] === 2 && perm[1] === 0) return 'each steps back one';
  return moved.length === 2 ? `${COLOUR_NAMES[moved[0]]} ↔ ${COLOUR_NAMES[moved[1]]}` : `(${perm.join(' ')})`;
};
/** The catalog writes its prose in ASCII so the JSON stays greppable; the page
 * is allowed the real characters. */
const pretty = text => String(text)
  .replace(/\bN\^2\b/g, 'N²').replace(/ x /g, ' × ')
  .replace(/\btau\b/g, 'τ').replace(/\bGamma\b/g, 'Γ');
/** Where a row's rotation actually turns about.
 *
 * A row is `colour(M x + v, t + frames) = perm(colour(x, t))`, so `v` is the
 * translation part — *not* a location. The fixed point of x ↦ M x + v/N solves
 * (I − M) p = v/N, which for a rotation is a single point modulo the lattice
 * (three of them for a third-turn, since det(I − M) = 3). Printing `v` as
 * "at (0, 11) of 66" read as a place and was not one: the same centre came out
 * as two different "locations" on two rows of one table. */
function turnCentre(sym, pointOps, N) {
  const M = pointOps?.[sym.name];
  if (!Array.isArray(M) || sym.name === '1') return null;
  const a = 1 - M[0][0], b = -M[0][1], c = -M[1][0], d = 1 - M[1][1];
  const det = a * d - b * c;
  if (!det) return null;                       // a mirror fixes a line, not a point
  const [vx, vy] = sym.v;
  return [mod1((d * vx - b * vy) / det / N), mod1((-c * vx + a * vy) / det / N)];
}
function opText(sym, record) {
  const [a, b] = sym.v, N = record.N;
  if (sym.name === '1') return a || b ? `slide by (${a}, ${b}) of ${N} nodes` : 'the identity';
  const centre = turnCentre(sym, catalog.pointOps, N);
  if (centre) return `${sym.name} about (${centre[0].toFixed(3)}, ${centre[1].toFixed(3)})`;
  return a || b ? `${sym.name}, slide (${a}, ${b}) of ${N}` : `${sym.name} through the origin`;
}
const opTitle = (sym, record) => `colour(${sym.name} x + (${sym.v.join(', ')})/${record.N}, t + ${sym.frames}/${record.M}) = perm(colour(x, t))`;

const MAX_ROWS = 14;
/** The first `MAX_ROWS` rows must be a fair sample, not the first fourteen of
 * an order that begins with twelve translations. Rows are taken round-robin
 * over the point operation, so every operation that occurs in the list has a
 * representative before any operation has two. (The old cut sat inside the
 * R240 block on an 18-symmetry entry and inside the translations on a
 * 72-symmetry one, and the page then claimed the unseen rows were products of
 * what was shown — which was false on every entry that triggered it.) */
function sampleRows(exact, limit) {
  const byOp = new Map();
  for (const sym of exact) {
    if (!byOp.has(sym.name)) byOp.set(sym.name, []);
    byOp.get(sym.name).push(sym);
  }
  const out = [], queues = [...byOp.values()];
  while (out.length < limit && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      if (out.length >= limit) break;
      if (queue.length) out.push(queue.shift());
    }
  }
  return {rows: out, ops: byOp.size};
}
function renderSymmetryTable() {
  const body = $('symmetry-rows');
  if (!record) { body.replaceChildren(); return; }
  const rows = [];
  const exact = record.symmetries;
  const sample = sampleRows(exact, MAX_ROWS);
  for (const sym of sample.rows) {
    const tr = document.createElement('tr'); tr.className = 'exact';
    tr.title = opTitle(sym, record);
    for (const [text, cls] of [[opText(sym, record), 'sym-symbol'], [timeText(sym.frames, record.M), ''], [permText(sym.perm), ''], [sym.agreement.toFixed(6), '']]) {
      const td = document.createElement('td');
      if (cls) { const span = document.createElement('span'); span.className = cls; span.textContent = text; td.append(span); } else td.textContent = text;
      tr.append(td);
    }
    rows.push(tr);
  }
  for (const failure of record.failures) {
    const tr = document.createElement('tr'); tr.className = 'fails';
    const best = failure.best ?? {};
    const cells = [
      pretty(failure.what),
      best.frames !== undefined ? timeText(best.frames, record.M) : 'any',
      // Named the same way as the exact rows above, so the two halves of the
      // table can be read against each other.
      best.perm ? permText(best.perm) : best.permName ?? 'best of 6',
      failure.agreement.toFixed(6),
    ];
    for (const text of cells) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    rows.push(tr);
  }
  body.replaceChildren(...rows);
  const shown = sample.rows.length;
  $('symmetry-more').textContent = exact.length > shown
    ? `${shown} of the ${exact.length} exact symmetries are shown, at least one for each of the ${plural(sample.ops, 'point operation')} that occur; the full list travels with the export below.`
    : '';
  const cp = record.colourPreservingGroup, pg = record.pictureGroup;
  const violations = record.law === null ? '—' : String(Math.round((1 - record.law) * record.N * record.N * record.M));
  $('symmetry-foot').innerHTML = `Each row reads <i>colour</i>(<b>M</b> <i>x</i> + <i>v</i>, <i>t</i> + frames) = perm(<i>colour</i>(<i>x</i>, <i>t</i>)), with <i>v</i> in whole saved nodes; `
    + `a rotation row names the centre that translation puts the turn about. `
    + `Measured at all ${(record.N * record.N * record.M).toLocaleString('en-GB')} node-frames, ${record.exactSymmetryCount} exact symmetries per saved cell, `
    + `<b>${violations}</b> colour-law violations and <b>${record.ties}</b> argmax ties. Colour group Π = <b>${piText(record.colourGroup)}</b>; `
    + `the coloured picture's own film group is <code>${pg.groupId ?? '—'}</code> (${star(pg.signature ?? '')}${pg.onFinerLattice ? ', on a lattice finer than the saved cell' : ''}); `
    + `the colour-preserving subgroup is <code>${cp.groupId ?? '—'}</code> (${star(cp.signature ?? '')}) — measured, not assumed.`;
}

function renderRecord() {
  if (!record) return;
  const m = record.metrics;
  const provenance = catalog.manifest.provenance ?? {};
  const nodeFrames = record.N * record.N * record.M;
  // Both numbers come off the entry. They are gated in `colour-atlas.mjs`, so
  // they are always 0 here — but a literal would go on saying 0 if a future
  // build shipped an entry that is not exact, which is the one thing this page
  // exists to rule out.
  const violations = record.law === null ? '—' : Math.round((1 - record.law) * nodeFrames);
  $('caption').textContent = `${record.name} · ${record.modelName} · ${record.N}² nodes, ${record.M} frames · `
    + `colour law re-derived from the saved bytes at ${nodeFrames.toLocaleString('en-GB')} node-frames, ${violations} violations, ${record.ties} argmax ties.`;
  const cells = [
    ['Colour-law violations', String(violations)],
    ['Argmax ties', String(record.ties)],
    ['Exact symmetries', String(record.exactSymmetryCount)],
    ['Per-frame colour share', m.areaFractions.map(v => v.toFixed(3)).join(' / ')],
    ['Worst area deviation', m.areaImbalance.toFixed(4)],
    ['Boundary density', m.boundaryDensity.toFixed(4)],
    ['Speckle nodes', sci(m.speckle)],
    ['Argmax margin (σ)', m.margin.toFixed(3)],
  ];
  $('metrics').replaceChildren(...cells.map(([name, value]) => {
    const div = document.createElement('div');
    const span = document.createElement('span'); span.textContent = name;
    const strong = document.createElement('strong'); strong.textContent = value;
    div.append(span, strong); return div;
  }));
  const bytes = record.byteLength.toLocaleString('en-GB');
  // What "verified" means is not the same for the two origins, and the catalog
  // carries both sentences. Printing the one that applies is the difference
  // between a claim and a citation.
  const gate = catalog.manifest.gates?.[record.origin] ?? null;
  $('provenance').innerHTML = `Orbit ${record.atlasIds.map(id => `<code>${id}</code>`).join(', ')} · field sha256 `
    + `<code title="${record.fieldSha256}">${record.shortSha}…</code> · ${bytes} bytes, float32 LE, `
    + `${pretty(catalog.manifest.shape?.fieldLayout ?? 'frame-major; planar channel 0 then channel 1; x-fast')} · `
    + `catalog <code>${catalog.manifest.schema}</code> built ${provenance.date ?? '—'} by <code>${provenance.builder ?? '—'}</code>.`
    + (gate ? `<br>How this orbit was verified (<code>${record.origin}</code>): ${pretty(gate)}.` : '');
}

function renderSelected() {
  const group = groups.find(item => item.id === groupId);
  const about = catalog.colourings?.[KIND] ?? COLOURINGS[KIND];
  // The measured colour group of the entry on screen; the per-kind constant
  // only until one is loaded, where it names the rule rather than an entry.
  const pi = record ? piText(record.colourGroup) : about.colourGroup;
  $('selected-id').textContent = `${groupId} · ${COLOURINGS[KIND].name}`;
  $('selected-title').textContent = pi;
  // As a heading, "Z₃" alone says nothing out of context.
  $('selected-title').setAttribute('aria-label', `Now showing: ${COLOURINGS[KIND].name} on ${groupId}, colour group ${pi}`);
  $('selected-title').title = record && record.colourGroup !== 'Z3' && KIND === 'gyre'
    ? `Measured on this entry: the colour group is ${pi}, not the Z₃ the Gyre rule usually gives.` : '';
  $('selected-description').textContent = group
    ? `${star(group.signature)} · ${plural(group.phaseOrder, 'phase')} per period. ${about.blurb}`
    : about.blurb;
  $('group-label').textContent = group ? `${groupId} · ${star(group.signature)} · Π = ${pi}` : groupId ?? '';
  const badges = [];
  if (record) {
    if (KIND === 'gyre') {
      badges.push(record.fullyEntangled
        ? {text: 'fully entangled', cls: 'yes', title: 'No exact symmetry realises a recolouring at a time shift the colour-preserving subgroup can absorb.'}
        : {text: 'colour group splits', cls: 'no', title: 'Some recolouring is realised without an entangled time shift — an honest entry, but not the Gyre character.'});
      const cp = record.colourPreservingGroup;
      const extra = cp.subTranslations?.length ?? 0;
      badges.push(record.latticeOnly
        ? {text: 'colour-preserving = the lattice alone', cls: 'yes', title: 'Nothing but the translations of the saved cell keeps the three colours where they are — the quality gate this catalog was built around.'}
        : cp.groupId === 'g1'
          ? {text: 'colour-preserving = p1 on a finer lattice', cls: 'no', title: `Still only translations, but ${extra} more of them than the saved cell has: the field's own screw translations keep the colours too.`}
          : {text: `colour-preserving ${cp.groupId} · ${star(cp.signature ?? '')}`, cls: 'no', title: 'More than the translations keeps the colours.'});
    } else {
      badges.push(record.swapEntangled
        ? {text: 'swaps entangled', cls: 'yes', title: 'Every transposition of the three colours needs a time shift; none is purely spatial.'}
        : {text: 'a swap is free', cls: 'no', title: 'Some transposition needs no time shift.'});
      const partner = catalog.partnerOf(record);
      // Only where the catalog carries chirality at all: on a build with no
      // partner data the negative read as a data failure on every entry.
      if (partner) badges.push({text: `mirror partner ${partner.groupId}`, cls: 'pick', title: `The same picture at the opposite chirality: ${partner.id}`});
      else if (partners.size) badges.push({text: 'no mirror partner', cls: 'no', title: `The build paired ${partners.size} of the ${entriesOfKind.length} admitted Trefoil fields with an opposite-chirality twin; this one has none.`});
    }
    if (record.colourGroup !== (KIND === 'gyre' ? 'Z3' : 'S3')) {
      badges.push({text: `colour group ${piText(record.colourGroup)}`, cls: 'no',
        title: `Measured, not assumed: the exhaustive search realises ${piText(record.colourGroup)} on this field, not the ${KIND === 'gyre' ? 'Z₃' : 'S₃'} the rule usually gives.`});
    }
    if (record.featured) badges.push({text: 'featured', cls: 'pick', title: record.featuredWhy ?? 'Chosen by eye from the thumbnails.'});
    if (record.shippedPage) badges.push({text: 'the shipped standalone page', cls: 'pick', title: 'This is the entry the site already publishes as its own page.'});
  }
  $('selected-badges').replaceChildren(...badges.map(badge => {
    const span = document.createElement('span');
    span.className = `colour-badge ${badge.cls}`; span.textContent = badge.text; span.title = badge.title;
    return span;
  }));
}

function renderMarksText() {
  const rule = document.querySelector('.phase-rule');
  rule.hidden = !record;
  if (!record) return;
  const lead = record.generators?.find(item => item.kind !== 'translation') ?? record.generators?.[0] ?? null;
  $('generator-description').innerHTML = lead
    ? `<b>${lead.html ?? lead.symbol ?? lead.name}</b> — ${lead.reading ?? ''}. Re-tested at all ${(record.N * record.N * record.M).toLocaleString('en-GB')} node-frames, ${lead.violations ?? 0} violations.`
    : KIND === 'gyre'
      ? `The turn centre is <i>p</i> = (${record.colouring.p.map(v => v.toFixed(4)).join(', ')}), a point of no symmetry of the field, reached by the whole node vector <i>w</i> = (${record.colouring.w.join(', ')}) — so <i>g</i> carries saved nodes to saved nodes and every claim is integer arithmetic. Generator marks for this entry are not yet in the catalog, so none are drawn.`
      : `The three compared samples are <i>b</i> = (⅓, ⅔) apart — a whole (${record.colouring.bNodes.join(', ')}) nodes — and the swap is carried by ${record.colouring.swapOp.name} at half a period. Generator marks for this entry are not yet in the catalog, so none are drawn.`;
  // The miner kept, per Gyre field, up to four further tie-free turn centres,
  // de-duplicated by metric fingerprint and by a minimum separation. They are
  // not separately published entries — no symmetry table was measured for
  // them — so they are named here rather than offered as a choice.
  const alternates = record.runnersUp ?? [];
  $('alternates').innerHTML = KIND === 'gyre' && alternates.length
    ? `Other tie-free turn centres the sweep found on this same field, each giving a different picture: `
      + alternates.slice(0, 4).map(item => `<i>p</i> = (${item.p.map(v => v.toFixed(3)).join(', ')})`).join(', ')
      + '. They are alternates, not entries: the exhaustive symmetry search was run on the published centre.'
    : KIND === 'trefoil'
      ? `Swaps come from ${plural(record.colouring.swapOpsVerified.length, 'operation')} of the field itself — `
        + `${record.colouring.swapOpsVerified.map(op => `${op.name} at ${op.frames}/${record.M} of a period`).join(', ')} — `
        + (record.colouring.swapOp.maxRelDiff > 0
          ? `each checked against the saved samples, worst deviation ${record.colouring.swapOp.maxRelDiff.toExponential(1)} relative, inside the 2e−7 the orbits were certified to. `
          : 'each holding bit-exactly on the saved samples. ')
        + 'The <i>colouring</i>’s own exactness is not a tolerance: all six recolourings were confirmed by exhaustive search in integer arithmetic.'
      : '';
  // On 123 of the 200 Gyre fields the threefold screw collapses the three
  // compared samples into three points of ONE frame. The catalog measures it
  // and the mining report calls it the headline surprise; nothing on the page
  // said it, while the copy insisted on the wait.
  const same = KIND === 'gyre' ? record.sameInstant : null;
  $('same-instant').innerHTML = same
    ? `On this field the threefold screw makes the three compared samples three points of a <i>single</i> frame — at `
      + `${same.offsets.map(offset => `(${offset.join(', ')})`).join(', ')} nodes — so the rule is computable from one frozen frame. `
      + `The wait is still what makes the law a symmetry, and ${same.translationOrbit
        ? 'the three points are a translation orbit, which is exactly the Trefoil reading of the same field.'
        : 'this is not a disguised Trefoil: the three points are not a translation orbit.'}`
    : '';
  $('same-instant').hidden = !same;
  $('notation').innerHTML = `<div class="notation-head"><h2 class="notation-title">Reading the generator marks — clockwork-colour notation</h2>`
    + `<button type="button" id="notation-close">Close</button></div>`
    + legendMarkup({
      generators: record.generators, symbol: record.symbol, kind: KIND,
      pictureGroup: record.pictureGroup, colourPreservingGroup: record.colourPreservingGroup, colourGroup: record.colourGroup,
      symbolNote: catalog.notation?.entrySymbol ?? null,
    });
  $('notation-close').onclick = () => setNotation(false);
}

/** The refusal list lives in `colour-atlas-build.json`, a 253 KB side file whose
 * only job on this page is the inside of a `<details>` most readers never open.
 * It is fetched the first time the block is opened, and not before. */
let buildRecord = null;
function renderRefusals() {
  const list = catalog.refusals(KIND);
  $('refusals').hidden = false;
  $('refusal-list').replaceChildren(...list.map(item => {
    const li = document.createElement('li');
    li.textContent = `${item.count} ${item.count === 1 ? 'field' : 'fields'} — ${pretty(item.why)}`;
    return li;
  }));
  $('refusal-count').textContent = list.length
    ? `${list.reduce((sum, item) => sum + item.count, 0)} fields refused`
    : 'the reasons, with their counts';
}
function loadRefusals() {
  buildRecord ??= catalog.loadBuildRecord(new URL(`data/colour-atlas-build.json?v=${VERSION}`, root))
    .then(ok => { if (ok) renderRefusals(); return ok; });
  return buildRecord;
}

// ---- loading one entry -----------------------------------------------------

function empty({loading = false, error = null} = {}) {
  renderer?.dispose(); renderer = null;
  gestures?.dispose(); gestures = null;
  overlay = null; record = null; setPlaying(false);
  delete canvas.dataset.ready;
  $('empty-state').hidden = false;
  $('empty-state').querySelector('h2').textContent = loading ? 'Loading saved animation…' : error ? 'Animation unavailable' : 'No verified colouring here';
  $('empty-description').textContent = loading ? 'Downloading the saved field.' : error ?? 'No field in this film group hosts this colouring under the current filter.';
  $('retry-animation').hidden = !error;
  $('mode-label').textContent = loading ? 'Loading saved animation' : error ? 'Download failed' : 'Nothing selected';
  // The mark layer is SVG and survives whatever happens to the canvas under it,
  // so it has to be taken down with the picture — otherwise a lost context left
  // coins and chips floating over a black square.
  $('marks').replaceChildren();
  $('marks').style.display = 'none';
  $('phase-label').textContent = '—'; $('display-range').textContent = '';
  $('caption').textContent = error ?? 'Only colourings whose law was re-derived from the saved bytes at every node-frame appear here.';
  $('metrics').replaceChildren(); $('provenance').textContent = ''; $('symmetry-rows').replaceChildren();
  $('symmetry-foot').textContent = ''; $('symmetry-more').textContent = '';
  document.querySelector('.phase-rule').hidden = true;
  engineLabel(); controls();
}

async function selectPattern(id, {user = false, view: wanted = null} = {}) {
  const summary = catalog.get(id);
  if (!summary || summary.kind !== KIND) return;
  const token = ++selectionToken;
  selectedId = id; modelId = summary.model; parameterKey = keyOf(summary);
  if (!hosts(summary, groupId) && !(KIND === 'trefoil' && pairs)) groupId = summary.groupId;
  requested = wanted ? {phase: wanted.phase, play: wanted.play} : {phase: 0, play: !reducedMotion.matches};
  requestedCamera = wanted && wanted.x !== null ? {x: wanted.x, y: wanted.y, scale: wanted.scale, angle: wanted.angle} : null;
  empty({loading: true}); populate(); renderSelected();
  $('status').textContent = 'Loading saved animation…';
  if (user) syncUrl({step: true});
  try {
    const loaded = await catalog.load(id);
    if (token !== selectionToken) return;
    if (!catalog.isVerified(loaded)) throw Error('The field is not part of the verified catalog.');
    record = loaded;
    phase = requested.phase;
    const params = colouringParams(record);
    view = createView({
      tilePixels: homeScaleFor(KIND),
      center: params.centre,
      minScale: Math.max(MIN_SCALE, record.N / (devicePixelRatio || 1)),
      maxScale: MAX_SCALE,
      overshoot: 1.04,
    });
    renderer = createColourRenderer(canvas, record.field, {
      config: {N: record.N, M: record.M, period: record.period, loopSeconds: LOOP_SECONDS, channels: record.raw.source.channels ?? 2},
      colouring: params, view, palette: catalog.palette ?? PALETTE,
    });
    gestures = createGestures(canvas, {
      view, size, reducedMotion,
      onChange: () => { needsDraw = true; drawMarks(); updateScaleLabel(); },
      onSettle: syncUrl,
      onTouch: () => renderer?.touched(),
    });
    overlay = createGeneratorOverlay($('marks'), view, {
      generators: record.generators ?? [], cellSixths: record.cellSixths,
      palette: catalog.palette ?? PALETTE,
    });
    $('marks').setAttribute('aria-label', overlay.description());
    if (requestedCamera) {
      view.restore({center: [requestedCamera.x, requestedCamera.y], scale: requestedCamera.scale, angle: requestedCamera.angle * Math.PI / 180});
    }
    $('empty-state').hidden = true;
    $('mode-label').textContent = `Numerically verified entangled colour law · ${(catalog.colourings?.[KIND] ?? COLOURINGS[KIND]).rule}`;
    lastEngine = '';
    updateAppearanceOptions(); applyPalette();
    renderSelected(); renderMarksText(); renderSymmetryTable(); renderRecord(); updateDisplayRange();
    applyFraming(); populate();
    lastTime = performance.now(); setPlaying(requested.play); controls();
    needsDraw = true; drawMarks(true); draw(); needsDraw = false;
    // The site's own readiness flag: the browser tests wait on it rather than
    // on a timer, so a slow download never reads as a blank canvas.
    canvas.dataset.ready = 'true';
    // The one live region on the page. It used to say "Saved animation ready."
    // after every change, which told a non-sighted reader nothing about what
    // they had just chosen.
    $('status').textContent = `${groupId} · ${record.modelName} · ${setLabel(parameterSets().find(set => set.key === parameterKey) ?? {entry: record, patterns: [record]})} · ${record.name} — ready.`;
    syncUrl();
  } catch (error) {
    if (token !== selectionToken) return;
    empty({error: error.message}); $('status').textContent = error.message;
  }
}

function applyPalette() {
  if (!renderer) return;
  const mode = $('palette').value;
  const channel = mode === 'concentration' && record.hasSecondChannel ? 1 : 0;
  const range = record.ranges[channel ? 'v' : 'u'] ?? record.ranges.u;
  renderer.setAppearance(mode === 'colour' ? 'colour' : 'field', channel, range, mode === 'concentration' ? 'concentration' : 'ember');
  needsDraw = true;
}

function chooseModel(model, {user = false} = {}) {
  if (!modelEntries(model).length) return;
  modelId = model; parameterKey = null;
  const first = parameterSets(model)[0]?.patterns[0]?.id ?? null;
  if (first) selectPattern(first, {user});
  else { selectedId = null; empty(); populate(); if (user) syncUrl({step: user}); }
}

function chooseFilter(key, {groupId: wantGroup = null} = {}) {
  if (!FILTER_KEYS.has(key)) return;
  filter = key;
  renderFilters();
  if (wantGroup && groupEntries(wantGroup).length) groupId = wantGroup;
  if (!groupEntries(groupId).length) {
    const next = fullestGroup();
    if (next) groupId = next.id;
  }
  const first = patternList(groupId, null)[0];
  renderGroups(); renderSelected();
  if (first) { modelId = first.model; parameterKey = null; selectPattern(first.id, {user: true}); }
  else { selectedId = null; empty(); populate(); syncUrl({step: true}); }
}

function chooseGroup(id, {user = false, view: wanted = null} = {}) {
  // A `pattern=` in the link is followed, not dropped. An entry the catalog
  // files under both g247 and g225 used to be silently replaced by a different
  // one when the link named the other of its own two groups, and an entry the
  // current filter excludes was replaced without a word. Both now move the page
  // to where the link points.
  let asked = wanted?.patternId ? catalog.get(wanted.patternId) : null;
  if (asked && asked.kind !== KIND) asked = null;
  if (asked && !PASSES[filter](asked)) { filter = 'all'; renderFilters(); }
  const opening = id ? null : openingCell();
  const next = (asked && groups.find(item => item.id === id && hosts(asked, item.id)))
    ?? (asked && groups.find(item => hosts(asked, item.id)))
    ?? groups.find(item => item.id === id && groupEntries(item.id).length)
    ?? (opening && groups.find(item => item.id === opening.id))
    ?? fullestGroup()
    ?? groups[0];
  if (!next) { empty(); return; }
  groupId = next.id; ++selectionToken;
  renderGroups(); renderSelected();
  const usable = asked && patternList(groupId, null).some(entry => entry.id === asked.id) ? asked : null;
  const present = modelsPresent();
  // With no model in the link, the equation the opening cell nominates — the
  // one with the most saved parameter sets here — rather than whichever
  // happens to sort first.
  modelId = usable ? usable.model
    : present.includes(wanted?.model) ? wanted.model
      : opening && opening.id === groupId && present.includes(opening.model) ? opening.model
        : present[0] ?? null;
  parameterKey = null;
  // Inside the chosen set, a featured picture if there is one: the ladder is
  // the whole catalog, the picture is still one that was chosen by eye.
  const sets = parameterSets(modelId);
  const first = usable
    ?? sets[0]?.patterns.find(entry => entry.featured) ?? sets[0]?.patterns[0]
    ?? patternList(groupId, null)[0] ?? null;
  populate();
  if (first) selectPattern(first.id, {user, view: wanted});
  else { selectedId = null; empty(); $('status').textContent = 'No verified colouring in this film group.'; if (user) syncUrl({step: true}); }
}

function setNotation(value) {
  notationOn = !!value;
  $('notation').hidden = !notationOn;
  $('notation-open').setAttribute('aria-expanded', String(notationOn));
  syncUrl();
}

function setMarks(value) {
  marksOn = !!value;
  $('show-marks').checked = marksOn;
  try { localStorage.setItem(`colour:${KIND}:marks`, marksOn ? '1' : '0'); } catch { /* private windows refuse storage */ }
  drawMarks(true); syncUrl();
}

function restoreUrl() {
  const state = readViewState(location.hash);
  // A reader who has asked for reduced motion gets a still picture unless the
  // link they followed says otherwise, exactly as the standalone pages do.
  if (reducedMotion.matches && !/[?&]play=/.test(location.hash)) state.play = false;
  const [key, ...rest] = (state.sub ?? '').split(',');
  filter = FILTER_KEYS.has(key) ? key : DEFAULT_FILTER;
  if (KIND === 'trefoil') pairs = rest.includes('pairs') || !state.sub;
  $('framing').value = state.framing;
  $('tiles').value = String(state.tiles);
  $('palette').value = state.palette;
  $('speed').value = String(state.speed);
  marksOn = state.marks;
  if (!location.hash.includes('marks=')) {
    try { const saved = localStorage.getItem(`colour:${KIND}:marks`); if (saved !== null) marksOn = saved === '1'; } catch { /* ignore */ }
  }
  $('show-marks').checked = marksOn;
  notationOn = state.notation;
  $('notation').hidden = !notationOn;
  $('notation-open').setAttribute('aria-expanded', String(notationOn));
  renderFilters();
  chooseGroup(state.groupId, {view: state});
}

// ---- controls --------------------------------------------------------------

function togglePlayback() { if (!record) return; setPlaying(!playing); needsDraw = true; syncUrl(); }
$('play').onclick = togglePlayback;
bindCanvas();
$('rewind').onclick = () => { phase = 0; needsDraw = true; syncUrl(); };
$('phase').oninput = () => { phase = Math.min(Math.max(+$('phase').value, 0), 1 - 1e-6); setPlaying(false); needsDraw = true; syncUrl(); };
$('speed').onchange = syncUrl;
$('framing').onchange = () => { applyFraming(); syncUrl(); };
$('tiles').onchange = () => { applyFraming(); syncUrl(); };
$('palette').onchange = () => { applyPalette(); updateDisplayRange(); syncUrl(); };
$('show-marks').onchange = () => setMarks($('show-marks').checked);
$('notation-open').onclick = () => setNotation(!notationOn);
$('reset-view').onclick = () => { gestures?.interrupt(); view?.reset(); needsDraw = true; drawMarks(true); updateScaleLabel(); syncUrl(); };
$('retry-animation').onclick = retryAnimation;
$('parameter-set').onchange = () => { const set = parameterSets().find(item => item.key === $('parameter-set').value); if (set) selectPattern(set.patterns[0].id, {user: true}); };
$('solution').onchange = () => selectPattern($('solution').value, {user: true});
$('parameter-map').onclick = event => {
  const nearest = nearestSet(event);
  if (nearest) selectPattern(nearest.set.patterns[0].id, {user: true});
};
$('parameter-map').onpointermove = event => {
  const nearest = nearestSet(event);
  $('parameter-map').title = nearest ? `${setLabel(nearest.set)} — click to select` : '';
};
$('parameter-map').onkeydown = event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const sets = parameterSets(), index = sets.findIndex(set => set.key === parameterKey);
  const step = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1;
  if (sets.length) selectPattern(sets[(index + step + sets.length) % sets.length].patterns[0].id, {user: true});
};
$('export').onclick = () => {
  if (!record) return;
  // Self-contained: the build hoists the equation, the colour law, the failure
  // prose and the point operations out of every entry and into the manifest, so
  // an exported entry alone would carry bare indices. The tables it indexes
  // travel with it — the equation and colouring it uses, in full, and the two
  // lookup tables — and the file can be read without the catalog.
  const payload = {
    schema: 'colour-verified-orbit-export-v1',
    exported: new Date().toISOString(),
    catalog: {
      ...catalog.manifest,
      models: {[record.model]: catalog.models[record.model]},
      colourings: {[record.kind]: catalog.colourings[record.kind]},
      notation: catalog.notation,
      failureLabels: catalog.failureLabels,
      pointOps: catalog.pointOps,
    },
    entry: record.raw,
    // The bytes as they were downloaded and hashed, base64'd. A JSON array of
    // 1.77 M decimals was tens of megabytes and, worse, could not be checked
    // against `entry.source.fieldSha256` without re-encoding it to float32-LE
    // in exactly the right order — a convention the file did not state.
    field: {
      encoding: 'base64-float32-le',
      layout: 'frame-major; planar channel 0 then channel 1; x-fast; lattice nodes i/N, j/N',
      valueCount: record.field.length,
      byteLength: record.field.byteLength,
      sha256: record.fieldSha256,
      base64: base64Of(record.field),
    },
  };
  const blob = new Blob([JSON.stringify(payload)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${record.id.replace(/[^a-z0-9._-]/gi, '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('fullscreen').onclick = async () => {
  const wrapper = document.querySelector('.canvas-wrap');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapper.requestFullscreen?.();
  } catch { /* a sandboxed frame may refuse fullscreen */ }
};
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (event.key === 'g' || event.key === 'G') { if (record?.generators) setMarks(!marksOn); }
  else if (event.key === 'n' || event.key === 'N') setNotation(!notationOn);
  else if (event.key === 'Escape' && notationOn) setNotation(false);
  else if (event.key === '0' && $('framing').value === 'endless') { gestures?.interrupt(); view?.reset(); needsDraw = true; drawMarks(true); updateScaleLabel(); syncUrl(); }
  else return;
  event.preventDefault();
});
new ResizeObserver(() => { needsDraw = true; drawMarks(true); updateScaleLabel(); }).observe(document.querySelector('.canvas-wrap'));
// The parameter plane now sizes its backing store from the element, so it has
// to be redrawn when the element changes width.
new ResizeObserver(() => { if (catalog && modelId) renderParameterMap(parameterSets()); })
  .observe(document.querySelector('.parameter-map-wrap'));
window.addEventListener('hashchange', () => { if (catalog) restoreUrl(); });

function animate(now) {
  const gliding = gestures?.advance(now) ?? false;
  if (playing && record) { phase = mod1(phase + Math.max(0, Math.min(now - lastTime, 100)) / (1000 * LOOP_SECONDS) * +$('speed').value); needsDraw = true; }
  if (gliding) { needsDraw = true; drawMarks(); }
  lastTime = now;
  if (needsDraw) { needsDraw = false; draw(); }
  requestAnimationFrame(animate);
}

// ---- boot ------------------------------------------------------------------

try {
  catalog = await loadColourCatalog({baseUrl: root, version: VERSION});
  entriesOfKind = catalog.all(KIND);
  if (!entriesOfKind.length) throw Error(`The catalog has no ${KIND} colourings.`);
  const seen = new Set();
  groups = [];
  // Every hosting film group, not only the canonical one: the catalog's own
  // `groupIds` reaches all 20 triangular groups for Gyre and all 4 for Trefoil,
  // which is the coverage the landing page and the mining report both claim.
  for (const entry of entriesOfKind) {
    for (const id of entry.groupIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const meta = catalog.groupMeta(id);
      groups.push({id, signature: meta?.signature ?? id, orbifold: meta?.orbifold ?? '', family: meta?.family ?? '', phaseOrder: meta?.phaseOrder ?? entry.raw.source.opCount ?? 1});
    }
  }
  groups.sort((a, b) => groupEntries(b.id, 'all').length - groupEntries(a.id, 'all').length || a.id.localeCompare(b.id));
  // The chirality pairs: two admitted fields that are the same picture at
  // opposite handedness, linked by the build through the partner's field
  // SHA-256 rather than guessed at from matching metrics.
  for (const entry of entriesOfKind) {
    const partner = catalog.partnerOf(entry);
    if (partner) partners.set(entry.id, partner);
  }
  $('policy-label').textContent = 'Precomputed, verified colourings';
  // The Gyre character is what this catalog was selected for, not what every
  // admitted field does, and the counts are the honest way to say so.
  const of = entriesOfKind.length;
  $('character-note').textContent = KIND === 'gyre'
    ? `Of the ${of} admitted Gyre colourings, ${entriesOfKind.filter(entry => entry.fullyEntangled !== false).length} are fully entangled — no recolouring at all survives a frozen frame — `
      + `${entriesOfKind.filter(entry => entry.latticeOnly === true).length} have nothing but the lattice keeping the colours, and ${entriesOfKind.filter(entry => entry.colourGroup !== 'Z3').length} leak to a colour group larger than Z₃. `
      + 'Every entry says which it is, in the badges beside it and in its own symmetry table; the rule is the same on all of them.'
    : (() => {
      const free = entriesOfKind.filter(entry => entry.swapEntangled === false).length;
      const notS3 = entriesOfKind.filter(entry => entry.colourGroup !== 'S3').length;
      return `All ${of} admitted Trefoil colourings carry the 3-cycle as a plain slide and every swap welded to a half-turn at half a period. `
        + `${free ? `${free} of them have a free swap` : 'None of them has a free swap'}, and ${notS3 ? `${notS3} measure a colour group smaller than S₃` : 'all of them measure S₃'} — `
        + 'so the catalog offers no counterexample to the theorem, and says where it looked.';
    })();
  renderRefusals();
  $('refusals').addEventListener('toggle', () => { if ($('refusals').open) loadRefusals(); });
  restoreUrl();
  requestAnimationFrame(animate);
  // `?show=refusals` is how the landing page's "with reasons" link lands here.
  // A query rather than a fragment: the fragment is the view state, and
  // `#refusals` would be read as a film group.
  if (new URLSearchParams(location.search).get('show') === 'refusals') {
    $('refusals').open = true;
    await loadRefusals();
    $('refusals').scrollIntoView({block: 'start', behavior: 'smooth'});
  }
} catch (error) {
  empty({error: error.message});
  $('status').textContent = error.message;
}
