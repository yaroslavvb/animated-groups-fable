// The controller for the seventeen Monochrome explorer pages. Every
// `monochrome/<family>/index.html` is this same code with a different
// `data-family` on <main>; everything else comes from the catalog.
//
// The ladder is the Colour pages' one rung wider, and the new rung is the whole
// point of the category:
//
//   1 · the film group          the time-shift symmetry hosting the picture
//   2 · the rule                which difference makes the two colours
//   3 · the equation
//   4 · the verified parameters (the <select> and the parameter plane)
//   5 · the picture             thumbnails, in black and white
//
// Step 2 is the rung with no precedent. Inside the **strict** tier — where
// `(s, T/2)` is an exact symmetry of the field — every reading computes
// literally the same function, because `U(s x, t) = U(x, t + T/2)` turns
// `U(x,t) − U(s x,t)` into `U(x,t) − U(x, t+T/2)` by substitution. So the chips
// there do not switch pictures: they switch which true sentence the page tells,
// which operation the marks draw, and which row of the measured table is
// highlighted, and the page says so in as many words. In the **broad** tier the
// involution is free — the antisymmetry is algebra, but waiting half a period
// does not exchange the inks — and the chips DO switch pictures. The two are
// never mixed silently: the tier chip above the row says which one is showing.
//
// Nothing here re-derives a law or a group: the catalog measured them at every
// node-frame by exhaustive search and this page reads them.
import {loadMonoCatalog, MAX_TILES, RULE_LABELS, RULE_ORDER, cellFraction, timeText} from './mono-atlas.mjs?v=20260919-mono-v1';
import {
  channelDisplayVolume, createMonoRenderer, createView, INK, LOOP_SECONDS,
  MAX_SCALE, MIN_SCALE, rangeOf, ruleVolume, scaleFor,
} from './mono-renderer.mjs?v=20260919-mono-v1';
import {createMarkOverlay, legendMarkup, plan as planMarks} from './mono-marks.mjs?v=20260919-mono-v1';
import {createGestures} from './mono-gestures.mjs?v=20260919-mono-v1';
import {readViewState, writeViewHash} from './mono-view-state.mjs?v=20260919-mono-v1';

const VERSION = '20260919-mono-v1';
const root = new URL('./', import.meta.url);
const $ = id => document.getElementById(id);
const page = document.querySelector('main.mono-page');
const FAMILY = page.dataset.family;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const mod1 = value => ((value % 1) + 1) % 1;
const star = text => String(text ?? '').replace(/\*/g, '∗');
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const fixed = value => (Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : '—');
const sci = value => (Number.isFinite(value) ? value.toExponential(2) : '—');
/** A measured fraction of node-frames, as a reader reads it: never rounded down
 * to "0 %", because the whole point of printing it is that it is not zero. */
const percent = value => {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0%';
  if (value < 0.0001) return `${(value * 100).toExponential(1)}%`;
  return `${(value * 100).toPrecision(value < 0.01 ? 2 : 3)}%`;
};
/** A clause from the catalog, promoted to a sentence of its own. */
const sentence = text => {
  const body = String(text ?? '').trim();
  if (!body) return '';
  return body.charAt(0).toUpperCase() + body.slice(1) + (/[.!?]$/.test(body) ? '' : '.');
};
/** The catalog writes its prose in ASCII so the JSON stays greppable; the page
 * is allowed the real characters. */
const pretty = text => String(text ?? '')
  .replace(/->/g, '→').replace(/ -- /g, ' — ').replace(/ x /g, ' × ')
  .replace(/\bSPACETIME\b/g, 'spacetime').replace(/\bsqrt3\b/g, '√3').replace(/\btau\b/g, 'τ');

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

/** The tier filter above step 2. The catalog sorts every reading into one of
 * three measured tiers, and each names a property of the involution *s* against
 * the FIELD — never a property of the picture:
 *
 *   strict   (s, T/2) is an exact spacetime symmetry of the field, so s alone
 *            and the half-period wait alone are two names for one antisymmetry,
 *            and the field has this one picture or none.
 *   broad    it is not: s exchanges the inks by the algebra of subtraction and
 *            by no symmetry of the field. Whether the half-period wait ALSO
 *            exchanges them is a separate measured fact — `laws.halfPeriod` —
 *            and on the phase-symmetric equations it usually does. The label
 *            used to read "exact in space only", which said the opposite on 837
 *            of the 1 510 readings in the tier.
 *   control  the plain threshold, which exchanges nothing.
 *
 * The control is never filtered out: it is the comparison the other two are read
 * against, and hiding it would leave the page with nothing to say "as opposed
 * to" about. The count the "all" chip carries excludes it, so the chip is
 * labelled for what it counts. */
const TIERS = [
  {key: 'all', label: 'Every antisymmetric reading', note: 'both tiers at once; the threshold control is offered besides'},
  {key: 'strict', label: 's is a symmetry of the field', note: '(s, T/2) holds on the saved bytes, so s and the half-period wait are one antisymmetry'},
  {key: 'broad', label: 's is free', note: 's exchanges the inks by algebra alone; whether the half-period wait does too is measured per reading'},
];
const PASSES = {
  all: () => true,
  strict: entry => entry.tier === 'strict' || entry.tier === 'control',
  broad: entry => entry.tier === 'broad' || entry.tier === 'control',
};
/** What a tier chip counts: its own readings, the control excluded. */
const COUNTS = {
  all: entry => entry.tier !== 'control',
  strict: entry => entry.tier === 'strict',
  broad: entry => entry.tier === 'broad',
};

let catalog = null, groups = [], entriesOfFamily = [], fieldsOfFamily = [];
let groupId = null, tier = 'all', ruleKind = null, ruleOptionKey = null, channel = 'u';
let modelId = null, parameterKey = null, selectedId = null, record = null;
let renderer = null, view = null, overlay = null, gestures = null, marks = [];
let wVolume = null, rampVolume = null, rampKey = null, wRange = [0, 1];
let phase = 0, playing = false, lastTime = 0, selectionToken = 0, mapGeometry = null;
// `marksOn` opens false: the annotation is an option under the picture, never
// what the picture opens as. `restoreUrl` then lets a remembered choice or an
// explicit `marks=` in the link say otherwise.
let requested = {phase: 0, play: true}, requestedCamera = null, marksOn = false, notationOn = false;
/** A `rule=` from a link that names a reading this entry folds rather than one
 * it is; applied once the picture has loaded. */
let wantedRule = null;
let needsDraw = true, lastEngine = '', wasFixed = false;

let canvas = $('pattern');
let contextLost = false;
const size = () => [canvas.clientWidth || 1, canvas.clientHeight || 1];

/** A WebGL context is not forever: backgrounding a tab on Android or iOS makes
 * the browser recycle the GPU process, and the canvas then keeps its last pixels
 * while every draw call is silently dropped. `preventDefault` is also what asks
 * the browser for a restore at all. */
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
/** A lost context stays lost on the element that held it, so the retry starts
 * from a fresh canvas cloned out of the one in the markup. */
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
  selectPicture(selectedId, {user: true});
}

// ---- selection --------------------------------------------------------------

/** A picture is filed under **every** film group whose record uses its field,
 * not only the first: 108 of the 370 fields are shared by two or more records
 * and filing by one id alone would hide film groups from step 1 and silently
 * drop a `pattern=` deep link whose entry is catalogued elsewhere. */
const hosts = (entry, id) => entry.groupIds.includes(id);
/** Every distinct picture (field) of this family under a film group. */
function fieldsIn(id = groupId, model = modelId, key = tier) {
  const seen = new Map();
  for (const entry of entriesOfFamily) {
    if (!hosts(entry, id)) continue;
    if (model && entry.model !== model) continue;
    if (!PASSES[key](entry)) continue;
    if (!seen.has(entry.fieldKey)) seen.set(entry.fieldKey, []);
    seen.get(entry.fieldKey).push(entry);
  }
  return [...seen.entries()].map(([fieldKey, list]) => ({fieldKey, entries: list, best: pick(list)}))
    .sort((a, b) => (b.best.featured - a.best.featured) || (b.best.metrics.score ?? 0) - (a.best.metrics.score ?? 0) || a.fieldKey.localeCompare(b.fieldKey));
}
/** Which of a field's readings to show: the rule the reader has chosen if this
 * picture has it, then a featured one, then the most legible. */
function pick(list, kind = ruleKind) {
  return list.find(entry => entry.kind === kind)
    ?? list.find(entry => entry.featured)
    ?? list.slice().sort((a, b) => (b.metrics.score ?? 0) - (a.metrics.score ?? 0))[0];
}
const groupFields = (id, key = tier) => fieldsIn(id, null, key);
/** A field a reader waits behind before the first frame. Above this, the page
 * prefers a lighter opening picture of equal standing; the reader can still
 * pick any of them from step 5, and a `pattern=` link is never overridden. */
const OPENING_BYTES = 3e6;
/** The picture the page opens on when the link named none: the catalog's own
 * first choice among the fields that do not cost a long wait, and null when
 * every candidate is heavy.
 *
 * `/monochrome/p6/` used to open on an 11.06 MB orbit and `/monochrome/p6m/` on
 * a 7.08 MB one, which made the two hexagonal flagships the slowest pages on the
 * site — 16.2 MB before the first frame, behind "∅ Loading saved catalog…" —
 * while every one of those families holds dozens of pictures under a megabyte.
 * The order inside the band is the catalog's (featured, then legibility), so
 * this drops heavy pictures from the opening slot and reorders nothing. Every
 * picture stays one click away in step 5, and a `pattern=` link is never
 * overridden. */
function openingPicture(candidates) {
  const light = candidates.filter(item => (item.best.byteLength ?? 0) <= OPENING_BYTES);
  return light.length ? light[0].best : null;
}
/** When even that fails — a film group all of whose fields are big — the
 * smallest of them still beats the largest. */
function lightestPicture(candidates) {
  return candidates.slice()
    .sort((a, b) => (a.best.byteLength ?? 0) - (b.best.byteLength ?? 0))[0]?.best ?? null;
}
const modelsPresent = () => [...new Set(groupFields(groupId).map(item => item.best.model))]
  .sort((a, b) => fieldsIn(groupId, b).length - fieldsIn(groupId, a).length || a.localeCompare(b));

/** The readings of the picture on screen, by rule kind — the chips of step 2.
 *
 * Two different things end up in this map, and the distinction IS the category:
 *
 *  * a **separate entry** — a broad reading, or the control. Its involution is
 *    free, so it draws a genuinely different picture and picking it loads one.
 *  * a **folded reading** — one of the involutions on a strict entry's
 *    `strictReadings`. Every one of them satisfies `U(s x, t) = U(x, t + T/2)`,
 *    so `U(x,t) − U(s x,t)` and the half-period difference are the same
 *    function; the catalog therefore ships ONE entry for all of them. Picking
 *    one changes the sentence the page tells, the operation the marks lead
 *    with, and nothing at all on the canvas — which the page says outright.
 *
 * Each option carries `folded`: null for an entry of its own, the reading
 * otherwise. */
function ruleOptions(fieldKey = record?.fieldKey ?? catalog?.get(selectedId)?.fieldKey, current = record) {
  const out = new Map();
  if (!fieldKey) return out;
  const add = option => {
    if (!out.has(option.kind)) out.set(option.kind, []);
    out.get(option.kind).push(option);
  };
  for (const entry of catalog.ofField(fieldKey)) {
    if (!PASSES[tier](entry)) continue;
    add({kind: entry.kind, entry, folded: null, key: entry.id, tier: entry.tier});
  }
  if (current?.strict && PASSES[tier](current)) {
    for (const reading of current.strictReadings) {
      add({kind: reading.kind, entry: current, folded: reading, tier: current.tier,
        key: `${current.id}|${reading.kind}|${reading.op}|${reading.v.join(',')}`});
    }
  }
  return out;
}
/** Every reading of the field, tier and all — what a disabled chip's reason is
 * read off. */
function allReadings(fieldKey = record?.fieldKey ?? catalog?.get(selectedId)?.fieldKey) {
  const out = new Map();
  if (!fieldKey) return out;
  for (const entry of catalog.ofField(fieldKey)) {
    if (!out.has(entry.kind)) out.set(entry.kind, []);
    out.get(entry.kind).push(entry);
  }
  if (record?.strict) for (const reading of record.strictReadings) {
    if (!out.has(reading.kind)) out.set(reading.kind, []);
    out.get(reading.kind).push(record);
  }
  return out;
}
/** Which of a kind's options a chip means: the one the reader last picked, then
 * any reading of the picture ALREADY on screen, then the first.
 *
 * The middle clause is what makes the strict tier's promise true. A field
 * usually carries both a strict half-turn (folded onto its half-period entry)
 * and free half-turns of its own; picking the chip while the strict picture is
 * up must stay on that picture and change the sentence, not swap in a broad
 * entry that looks different. */
const preferred = (options = []) => options.find(option => option.key === ruleOptionKey)
  ?? options.find(option => option.entry.id === selectedId)
  ?? options[0] ?? null;
/** The option currently in step 2: the selected entry, or one of its folded
 * readings when the reader has picked one. */
const currentOption = () => preferred(ruleOptions().get(ruleKind) ?? []);

const keyOf = entry => JSON.stringify([entry.model, ...(catalog.models[entry.model]?.parameters ?? []).map(name => entry.params[name]), entry.L]);
function parameterSets(model = modelId) {
  const sets = new Map();
  for (const item of fieldsIn(groupId, model)) {
    const key = keyOf(item.best);
    if (!sets.has(key)) sets.set(key, {key, entry: item.best, pictures: []});
    sets.get(key).pictures.push(item);
  }
  const [x, y] = catalog.models[model]?.axes ?? ['F', 'k'];
  return [...sets.values()].sort((a, b) => b.pictures.length - a.pictures.length
    || (a.entry.params[x] ?? 0) - (b.entry.params[x] ?? 0)
    || (a.entry.params[y] ?? 0) - (b.entry.params[y] ?? 0)
    || a.entry.L - b.entry.L);
}

/** Every dial that names a parameter SET, in the order a reader should meet
 * them: the plane's two axes first, then the rest, then `L` — the box the orbit
 * was found in, which is not a parameter of the equation but separates two saved
 * sets as surely as any of them. `dx` is deliberately not here: one set holds
 * the same (F, k, Dᵤ, Dᵥ, L) at several grid resolutions, so a label made from
 * `dx` would read one member's grid as the whole set's. */
function dialsOf(model) {
  const spec = catalog.models[model] ?? {};
  const names = [...(spec.axes ?? []), ...(spec.parameters ?? [])];
  return [...new Set(names.filter(name => name && name !== 'stencil' && name !== 'dx')), 'L'];
}
const dialValue = (entry, name) => (name === 'L' ? entry?.L : entry?.params?.[name]);
function varyingDials(model, sets) {
  return dialsOf(model).filter(name => {
    const first = dialValue(sets[0]?.entry, name);
    return sets.some(set => dialValue(set.entry, name) !== first);
  });
}
/** The shortest run of dials that still gives every set its own line. */
function namingDials(model, sets) {
  const used = [];
  for (const name of varyingDials(model, sets)) {
    used.push(name);
    if (new Set(sets.map(set => used.map(dial => dialValue(set.entry, dial)).join('|'))).size === sets.length) break;
  }
  return used;
}
/** The axes to plot these sets against: the pair of varying dials that lands the
 * most sets on distinct points, and the models table's declared pair whenever it
 * does as well as any other. A family that moves along one dial is drawn as a
 * strip; one that does not move at all has no map. */
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

/** `step: true` marks a rung of the ladder — a group tile, a tier or rule chip,
 * an equation pill, a parameter set or a thumbnail. Those get a history entry,
 * so Back undoes the last choice instead of leaving the page; everything else
 * (the camera, the phase, playback, palette, marks) replaces, because those fire
 * continuously and would bury the page in history. */
function syncUrl({step = false} = {}) {
  if (!groupId) return;
  const [width, height] = size();
  const camera = view && $('framing').value === 'endless'
    ? {x: view.center[0], y: view.center[1], scale: view.scale(width, height), angle: view.angle * 180 / Math.PI}
    : {};
  const hash = writeViewHash({
    groupId, rule: ruleKind, tier, model: modelId, patternId: selectedId,
    channel,
    framing: $('framing').value, tiles: +$('tiles').value, palette: $('palette').value, speed: +$('speed').value,
    marks: marksOn, notation: notationOn, ...(record ? {phase, play: playing} : requested), ...camera,
  });
  // `pushState` does not fire `hashchange`, so restoreUrl() is not re-entered by
  // our own writes; the listener only ever sees a real Back, Forward or a link.
  if (step && hash !== location.hash) history.pushState(null, '', hash);
  else history.replaceState(null, '', hash);
}

// ---- rung 1 · the film group ------------------------------------------------

function renderGroups() {
  const holder = $('groups');
  holder.style.setProperty('--group-count', Math.min(5, Math.max(1, groups.length)));
  holder.replaceChildren(...groups.map(item => {
    const total = groupFields(item.id, 'all').length, shown = groupFields(item.id).length;
    const button = document.createElement('button');
    button.className = 'group'; button.type = 'button'; button.dataset.groupId = item.id;
    button.setAttribute('aria-pressed', String(item.id === groupId));
    // Not `disabled`: a disabled button is skipped by Tab, so a keyboard reader
    // would never be told the film group exists. It is empty only under the tier
    // chosen below, and choosing it now widens the tier to reach it.
    const empty = shown === 0;
    button.classList.toggle('is-empty', empty);
    const name = document.createElement('strong'); name.textContent = star(item.signature);
    const span = document.createElement('span');
    span.textContent = item.id;
    const count = document.createElement('span');
    count.className = 'orbit-count';
    count.textContent = tier === 'all' ? plural(total, 'picture') : `${shown} of ${total}`;
    span.append(count);
    button.append(name, span);
    button.title = empty
      ? `${item.id} · ${star(item.orbifold)} · ${plural(total, 'catalogued picture')}, none in the tier chosen below — choosing it widens step 2 to every reading.`
      : `${item.id} · ${star(item.orbifold)} · ${plural(total, 'catalogued picture')}${tier === 'all' ? '' : `, ${shown} of them in the tier chosen below`}`;
    button.setAttribute('aria-label', button.title);
    button.onclick = () => (empty ? chooseTier('all', {groupId: item.id}) : chooseGroup(item.id, {user: true}));
    return button;
  }));
}

// ---- rung 2 · the rule ------------------------------------------------------

function renderTiers() {
  const holder = $('rule-tiers');
  const caption = document.createElement('span');
  caption.textContent = 'Show';
  const set = document.createElement('span');
  set.setAttribute('role', 'radiogroup');
  set.setAttribute('aria-label', 'Which readings to show');
  set.style.display = 'contents';
  const buttons = TIERS.map(item => {
    const count = entriesOfFamily.filter(COUNTS[item.key]).length;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'tier'; button.dataset.tier = item.key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(item.key === tier));
    button.tabIndex = item.key === tier ? 0 : -1;
    button.disabled = count === 0;
    button.textContent = `${item.label} (${count})`;
    const descriptor = catalog.tiers[item.key];
    button.title = descriptor ? `${descriptor.law} — ${descriptor.blurb}` : item.note;
    button.onclick = () => chooseTier(item.key);
    set.append(button);
    return button;
  });
  const control = document.createElement('span');
  control.className = 'small';
  control.style.margin = '0';
  control.textContent = '· the threshold control is always offered';
  set.append(control);
  set.onkeydown = event => {
    const step = {ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1}[event.key];
    if (!step) return;
    const live = buttons.filter(button => !button.disabled);
    const index = live.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = live[(index + step + live.length) % live.length];
    next.focus(); next.click();
  };
  holder.replaceChildren(caption, set);
}

/** The sub-label under a chip: where the operation actually acts. `v` is the
 * translation part, never a place, so a rotation names the centre that
 * translation puts the turn about and a reflection names its axis. */
function chipDetail(option) {
  const entry = option.entry ?? option;
  const motion = option.folded ?? option;
  const kind = motion.kind ?? entry.kind;
  const N = entry.N, v = motion.v ?? entry.v, op = motion.op ?? entry.op;
  if (kind === 'half-period') return 'the universal rule';
  if (kind === 'threshold') return 'no antisymmetry';
  if (kind === 'half-shift') return `slide (${cellFraction(v[0], N)}, ${cellFraction(v[1], N)})`;
  if (kind === 'half-turn') return `about (${cellFraction(v[0], 2 * N)}, ${cellFraction(v[1], 2 * N)})`;
  const slide = v[0] || v[1] ? `, slide (${v[0]}, ${v[1]})` : '';
  return `${op}${slide}`;
}

function renderRules() {
  const holder = $('rules');
  const options = ruleOptions(), everything = allReadings();
  holder.replaceChildren(...RULE_ORDER.map(kind => {
    const here = options.get(kind) ?? [], all = everything.get(kind) ?? [];
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'rule'; button.dataset.rule = kind;
    button.append(RULE_LABELS[kind] ?? kind);
    const small = document.createElement('small');
    if (!here.length) {
      button.disabled = true;
      // The absence is information: a kind with no reading here is shown
      // disabled with the reason, never hidden.
      small.textContent = all.length ? 'not in this tier' : 'none on this picture';
      button.title = all.length
        ? `This picture has a ${(RULE_LABELS[kind] ?? kind).toLowerCase()} reading, but it is in the ${all[0].tier} tier — choose “Every reading” above to reach it.`
        : `The exhaustive sweep found no ${(RULE_LABELS[kind] ?? kind).toLowerCase()} reading of this picture.`;
    } else {
      const chosen = preferred(here);
      const folded = !!chosen.folded;
      small.textContent = chipDetail(chosen) + (here.length > 1 ? ` · ${here.length} readings` : '');
      button.setAttribute('aria-pressed', String(kind === ruleKind));
      button.classList.toggle('folded', !!folded);
      button.title = folded
        ? `The same picture as the half-period rule: this involution and the half-period wait are two names for one antisymmetry on this field, so picking it changes the sentence and the marks, not the canvas.`
        : pretty(chosen.entry.ruleDescription);
      button.onclick = () => chooseRule(kind, {user: true});
    }
    button.append(small);
    return button;
  }));
  renderRuleVariants();
}

/** When a picture carries more than one reading of the same kind — two half-turn
 * centres, say — they are genuinely different pictures in the broad tier, so
 * they are a choice rather than a footnote. */
function renderRuleVariants() {
  const holder = $('rule-variants'), select = $('rule-variant'), label = $('rule-variants-label');
  const here = ruleOptions().get(ruleKind) ?? [];
  holder.hidden = here.length < 2;
  if (here.length < 2) return;
  const allFolded = here.every(option => option.folded);
  label.textContent = allFolded
    ? 'All of these compute the same picture; pick the one you want the page to talk about:'
    : 'This rule has more than one reading here:';
  const chosen = preferred(here);
  select.replaceChildren(...here.map(option => {
    const item = new Option(`${chipDetail(option)}${option.folded ? ' · folded onto the half-period picture' : ` · ${catalog.tiers[option.tier]?.title ?? option.tier}`}`, option.key);
    item.selected = option.key === chosen.key;
    return item;
  }));
}

function renderRuleLaw() {
  const law = $('rule-law');
  if (!record) { law.textContent = 'Choose a picture to see the rule it is drawn by.'; return; }
  const option = currentOption();
  const fold = option?.folded ?? null;
  const same = record.sameAs ?? [];
  const spatial = fold ? true : record.spatial;
  const formula = pretty(fold ? catalog.ruleKinds[fold.kind]?.rule ?? record.ruleFormula : record.ruleFormula);
  const residual = record.laws?.s?.[0];
  const exact = record.laws?.s?.[1] === 1;
  const nodeFrames = (record.N * record.N * record.M).toLocaleString('en-GB');
  const lines = [];
  lines.push(`<b>White where <code>w &gt; 0</code>, black where <code>w &lt; 0</code>, with <code>${formula}</code>.</b>`);
  if (fold) {
    // What was measured, not a literal zero. `(s, T/2)` holds on the saved
    // float32 samples to the search's residual, so 225 of the 923 strict
    // readings are not bit-identical and 61 draw a handful of nodes a frame
    // differently. The chip the reader picked is the claim, so its own numbers
    // are the ones printed.
    lines.push(` Here <i>s</i> is <b>${fold.op}</b>${fold.v[0] || fold.v[1] ? ` with the slide (${fold.v.join(', ')}) of ${record.N} nodes` : ' through the lattice origin'}, `
      + (fold.exact
        ? `and <code>U(s x, t) = U(x, t + T/2)</code> holds on the saved bytes <b>bit for bit</b> — so this difference and the half-period difference are the <b>same function</b>, node-frame by node-frame.`
        : `and <code>U(s x, t) = U(x, t + T/2)</code> holds on the saved bytes at relative residual <b>${sci(fold.residual)}</b> — the search's own tolerance, not the last bit — so this difference and the half-period difference are the same function to that residual.`));
    lines.push(fold.drawnExact
      ? ` The two inks are exchanged at every one of the ${nodeFrames} node-frames, so the canvas did not change when you picked this chip, and that is the point.`
      : ` The drawn inks are <b>not</b> exchanged at ${percent(fold.drawnDiffers)} of the ${nodeFrames} node-frames — samples where <code>|w|</code> is at the float32 noise floor — so picking this chip moved a handful of pixels rather than nothing at all.`);
  } else if (record.kind === 'threshold') {
    lines.push(` This is the control: the plain picture of the wave against its own median. No motion exchanges the two colours, so every symmetry of the field <b>preserves</b> them — which is exactly what the ${record.preserve} measured rows below say.`);
  } else if (spatial) {
    // The description is a sentence of its own, so it starts with a capital:
    // it used to be pasted straight after the bolded lede and read
    // "…U(g x, t). compare with the glide reflection Mx: …".
    lines.push(` ${sentence(pretty(record.ruleDescription))} The operation is an involution of the saved cell in integer arithmetic, so <b>it exchanges black and white by algebra</b> — for any field and any reconstruction filter, since <code>w(s x, t) = −w(x, t)</code> is the same expression twice`);
    lines.push(exact ? `; measured here at residual <b>0</b> on all ${nodeFrames} node-frames.` : `; measured here at relative residual ${sci(residual)}.`);
  } else {
    lines.push(` Every orbit has this reading: compare each frame with the frame half a period later. It is the one rule that needs no spatial operation at all.`);
  }
  if (record.tier === 'strict') {
    lines.push(` <b>Waiting half a period exchanges them too</b>, and doing both leaves the colours where they were — a proper two-colour <i>spacetime</i> group, which is what <code>${pretty(catalog.tiers.strict?.law ?? 'U(s x, t + T/2) = U(x, t)')}</code> says.`);
    // The readings the builder proved compute THIS function: on a v2 catalog
    // `strictReadings`, on a v1 one the `sameAs` list is the nearest thing.
    // Each carries its own measurement, and they do not all hold equally — so
    // the sentence says which of them was bit-exact instead of claiming all.
    const family = record.strictReadings.length ? record.strictReadings : same;
    const names = [...new Set(family.map(item => item.title))].filter(Boolean);
    if (names.length) {
      const measured = record.strictReadings.length ? record.strictReadings : [];
      const drawnOff = measured.filter(item => !item.drawnExact);
      const notBit = measured.filter(item => !item.exact);
      lines.push(` On this picture the ${names.join(', ')} reading${names.length === 1 ? '' : 's'} and this one compute the <b>same function</b>, node-frame by node-frame — because <code>U(s x, t) = U(x, t + T/2)</code> turns one difference into the other by substitution. They are ${family.length + 1} readings of one antisymmetry, not ${family.length + 1} pictures: the chip you pick decides which sentence the page tells and which operations the marks draw.`);
      if (!measured.length) {
        lines.push(` (This catalog lists them as coincidences rather than measuring each; a v2 build measures every one.)`);
      } else if (!drawnOff.length && !notBit.length) {
        lines.push(` Every one of them was re-derived from the saved bytes and holds <b>bit for bit</b>, so the canvas does not move between the chips.`);
      } else if (!drawnOff.length) {
        lines.push(` ${notBit.length === measured.length ? 'Each' : `${notBit.length} of the ${measured.length}`} holds to the search's residual rather than to the last bit — largest ${sci(Math.max(...notBit.map(item => item.residual)))} — but the <b>drawn</b> inks are exchanged at every node-frame, so the canvas does not move between the chips.`);
      } else {
        lines.push(` They are not all perfect on the saved samples: ${drawnOff.length} of the ${measured.length} draw a different ink at up to ${percent(Math.max(...drawnOff.map(item => item.drawnDiffers)))} of the node-frames, where <code>|w|</code> is at the float32 noise floor. The canvas moves by those few samples and by nothing else.`);
      }
    }
  } else if (record.tier === 'broad') {
    // `tier` is a fact about the involution against the FIELD; whether waiting
    // half a period also exchanges the inks is a different, measured fact, and
    // on the phase-symmetric equations it usually does. Printing "the residual
    // is 0.00e+0, not zero" on 837 of the 1 510 broad readings, three
    // paragraphs above their own table of colour-swapping waits, is what this
    // branch exists to avoid.
    const at = record.sIsFieldSymmetryAt;
    const hp = record.laws?.halfPeriod ?? [];
    const swapsWithAWait = record.symmetries.some(row => !row.keep && row.frames !== 0);
    if (hp[1] === 1) {
      lines.push(` <b>Waiting half a period exchanges them as well</b> — <code>w(x, t + T/2) = −w(x, t)</code> on all ${nodeFrames} node-frames, at residual <b>0</b>. Nothing in this tier promised that: it is a property of the field, not of the involution${record.model === 'ginzburg-landau' || record.model === 'lambda-omega' || record.model === 'cgl-quintic' ? ` — on this equation a constant phase is an exact symmetry, so <code>U(x, t + T/2) = −U(x, t)</code> identically and every rule's difference inherits it` : ''}. So the film here <b>is</b> a two-colour spacetime pattern${swapsWithAWait ? ', and the measured table below lists the operations that exchange the inks after a wait' : ''}.`);
    } else {
      lines.push(` <b>Waiting half a period does not</b> — the residual of <code>w(x, t + T/2) = −w(x, t)</code> is ${sci(hp[0])}, not zero. So this is a two-colour <i>wallpaper</i> group on each frozen frame and not a spacetime one.`);
    }
    if (spatial) {
      lines.push(at === -1
        ? ` What puts the reading in this tier is <i>s</i> itself: it is a symmetry of the field at no time shift at all, so it exchanges the inks by the algebra of subtraction and by nothing else.`
        : ` What puts the reading in this tier is <i>s</i> itself: it is not a spacetime symmetry of the field at half a period.`);
      lines.push(` Here the chips really do switch pictures.`);
    } else {
      lines.push(` This field is one of the ${catalog.manifest.counts?.fieldsWithoutAStrictPicture ?? 'few'} with no involution of its own lattice that is a spacetime symmetry, which is why its half-period reading sits in this tier rather than the strict one.`);
    }
  }
  const foot = record.kind === 'threshold' ? ''
    : `<span class="small"><b>Threshold</b> is the one genuine alternative: <code>sign(U − median U)</code>, a different picture that carries no antisymmetry at all.</span>`;
  law.innerHTML = lines.join('') + foot;
}

// ---- rung 3 · the equation --------------------------------------------------

function renderEquations() {
  const present = modelsPresent();
  const order = [...present, ...Object.keys(catalog.models).filter(model => !present.includes(model))];
  $('equations').replaceChildren(...order.map(model => {
    const count = fieldsIn(groupId, model).length, button = document.createElement('button');
    button.type = 'button'; button.className = 'equation'; button.dataset.model = model; button.disabled = !count;
    button.setAttribute('aria-pressed', String(model === modelId));
    const small = document.createElement('small'); small.textContent = count ? plural(count, 'picture') : 'none here';
    button.append(catalog.models[model]?.name ?? model, small);
    button.title = (catalog.models[model]?.equation ?? '').replace('\n', '; ');
    button.onclick = () => chooseModel(model, {user: true});
    return button;
  }));
  $('equation-description').textContent = modelId ? catalog.models[modelId]?.equation ?? '' : '';
  $('equation-note').textContent = modelId ? catalog.models[modelId]?.description ?? '' : '';
}

// ---- rung 4 · the verified parameters ---------------------------------------

function renderParameterMap(sets) {
  const map = $('parameter-map'), context = map.getContext('2d');
  map.parentElement.hidden = sets.length < 2; mapGeometry = null;
  if (sets.length < 2) return;
  // The backing store follows the element, not a fixed 660 × 320: in the sidebar
  // the canvas is about 294 CSS px wide, so a fixed store was scaled down 0.44×
  // and the axis names landed at 8 px on screen.
  const css = map.clientWidth || 300;
  const ratio = Math.min(3, Math.max(1, devicePixelRatio || 1));
  const width = Math.round(css * ratio), height = Math.round(css * 0.48 * ratio);
  if (map.width !== width || map.height !== height) { map.width = width; map.height = height; }
  map.style.height = `${Math.round(css * 0.48)}px`;
  const px = value => value * ratio * (css / 300);
  const labels = catalog.models[modelId]?.labels ?? {};
  const named = name => labels[name] ?? name;
  const axes = planeAxes(modelId, sets);
  if (!axes) { map.parentElement.hidden = true; return; }
  const [xName, vertical] = axes;
  const strip = vertical === null;
  const points = sets.map(set => ({set, x: dialValue(set.entry, xName), y: strip ? 0 : dialValue(set.entry, vertical)}));
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) { map.parentElement.hidden = true; return; }
  const extent = axis => { const lo = Math.min(...points.map(p => p[axis])), hi = Math.max(...points.map(p => p[axis])); const pad = Math.max((hi - lo) * .15, Math.abs(lo) * .04, 1e-5); return [lo - pad, hi + pad]; };
  const [xmin, xmax] = extent('x'), [ymin, ymax] = strip ? [-1, 1] : extent('y');
  const ticks = axis => [...new Set(points.map(p => p[axis]))].sort((a, b) => a - b);
  // The left margin is measured, not guessed. A fixed 62 px fits "0.06" and not
  // "0.02005", so on a degenerate axis — the twelve p4g sets span
  // k ∈ [0.01995, 0.02005] — the tick text ran back over the rotated axis name
  // and the three strings printed on top of each other.
  context.font = `${px(11)}px system-ui`;
  const yValues = strip ? [] : ticks('y');
  // The plot's height does not depend on the left margin, so whether the two y
  // ticks would collide can be decided before the margin is chosen — and only
  // one of the two label sets ever has to be made room for.
  const spanY = (height - px(20) - px(40)) * (yValues.length > 1
    ? (yValues[yValues.length - 1] - yValues[0]) / (ymax - ymin) : 0);
  const collapseY = yValues.length > 1 && spanY < px(13);
  const midY = yValues.length ? (yValues[0] + yValues[yValues.length - 1]) / 2 : 0;
  const yTexts = collapseY
    ? [`${fixed(midY)} ± ${sci((yValues[yValues.length - 1] - yValues[0]) / 2)}`]
    : yValues.map(fixed);
  const widestY = Math.max(px(24), ...yTexts.map(text => context.measureText(text).width + px(8)));
  const margin = {left: strip ? px(34) : Math.min(px(140), px(22) + widestY),
                  right: px(30), top: px(20), bottom: px(40)};
  const project = p => [margin.left + (p.x - xmin) / (xmax - xmin) * (width - margin.left - margin.right), height - margin.bottom - (p.y - ymin) / (ymax - ymin) * (height - margin.top - margin.bottom)];
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height); context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
  const axisY = strip ? project({x: xmin, y: 0})[1] : height - margin.bottom;
  context.strokeStyle = '#d9d7d2'; context.lineWidth = Math.max(1, px(1)); context.beginPath();
  if (!strip) { context.moveTo(margin.left, margin.top); context.lineTo(margin.left, axisY); } else context.moveTo(margin.left, axisY);
  context.lineTo(width - margin.right, axisY);
  context.stroke();
  context.strokeStyle = '#efeeeb';
  context.beginPath();
  if (!strip) for (const x of ticks('x')) { const [sx] = project({x, y: ymin}); context.moveTo(sx, margin.top); context.lineTo(sx, axisY); }
  if (!strip) for (const y of ticks('y')) { const [, sy] = project({x: xmin, y}); context.moveTo(margin.left, sy); context.lineTo(width - margin.right, sy); }
  context.stroke();
  context.fillStyle = '#4a4741'; context.font = `600 ${px(13)}px system-ui`; context.textAlign = 'center';
  context.fillText(named(xName), (margin.left + width - margin.right) / 2, height - px(6));
  if (!strip) { context.save(); context.translate(px(13), (margin.top + axisY) / 2); context.rotate(-Math.PI / 2); context.fillText(named(vertical), 0, 0); context.restore(); }
  context.font = `${px(11)}px system-ui`; context.fillStyle = '#6b7280';
  const xs = ticks('x');
  context.textAlign = 'left'; context.fillText(fixed(xs[0]), margin.left, axisY + px(16));
  if (xs.length > 1) { context.textAlign = 'right'; context.fillText(fixed(xs[xs.length - 1]), width - margin.right, axisY + px(16)); }
  if (!strip) {
    context.textAlign = 'right';
    if (collapseY) {
      // The whole axis is narrower than one label, so it gets one label that
      // says the same thing instead of two printed on top of each other.
      context.fillText(yTexts[0], margin.left - px(5), project({x: xmin, y: midY})[1] + px(4));
    } else {
      for (const y of [yValues[0], yValues[yValues.length - 1]]) {
        context.fillText(fixed(y), margin.left - px(5), project({x: xmin, y})[1] + px(4));
      }
    }
  }
  if (strip) {
    const held = dialsOf(modelId).filter(name => name !== xName)
      .map(name => `${named(name)} ${fixed(dialValue(sets[0].entry, name))}`).join(' · ');
    context.textAlign = 'center'; context.fillStyle = '#9aa1ad'; context.font = `${px(11)}px system-ui`;
    if (held) context.fillText(`${held} — the same in all ${sets.length}`, width / 2, axisY - px(26));
  }
  // The dot's area carries how many pictures the set holds, so a set of eleven
  // does not read as a set of one.
  const most = Math.max(...sets.map(set => set.pictures.length));
  for (const point of points) {
    const [x, y] = project(point), selected = point.set.key === parameterKey;
    const weight = most > 1 ? Math.sqrt(point.set.pictures.length / most) : 1;
    const r = px(3.2 + 2.6 * weight) * (selected ? 1.25 : 1);
    context.beginPath(); context.arc(x, y, r, 0, 2 * Math.PI);
    context.fillStyle = selected ? '#111111' : '#b3b0a9'; context.fill();
    if (selected) { context.lineWidth = px(2.4); context.strokeStyle = '#d8d5cf'; context.stroke(); }
  }
  mapGeometry = points.map(p => ({set: p.set, point: project(p)}));
  const drawnAgainst = strip ? `along ${named(xName)} alone` : `${named(xName)} versus ${named(vertical)}`;
  map.setAttribute('aria-label', `Saved ${catalog.models[modelId]?.name ?? modelId} parameter sets, ${drawnAgainst}. Click to select the closest verified point, or use arrow keys.`);
  $('parameter-map-caption').textContent = `${plural(sets.length, 'saved set')}, ${drawnAgainst}. Dot area is how many pictures the set holds.`;
}
function nearestSet(event) {
  if (!mapGeometry?.length) return null;
  const map = $('parameter-map'), rect = map.getBoundingClientRect();
  const point = [(event.clientX - rect.left) / rect.width * map.width, (event.clientY - rect.top) / rect.height * map.height];
  return mapGeometry.reduce((best, item) => {
    const distance = (point[0] - item.point[0]) ** 2 + (point[1] - item.point[1]) ** 2;
    return !best || distance < best.distance ? {...item, distance} : best;
  }, null);
}

// ---- rung 5 · the picture ---------------------------------------------------

const pictureLabel = entry => `${entry.name} · T ${entry.period.toFixed(2)} · ${entry.N}²`;
let setLabel = () => '';

function populate() {
  const sets = parameterSets();
  const chosen = sets.find(set => set.key === parameterKey) ?? sets[0] ?? null;
  parameterKey = chosen?.key ?? null;
  const pictures = chosen?.pictures ?? [];
  const names = catalog.models[modelId]?.parameters ?? [];
  const labels = catalog.models[modelId]?.labels ?? {};
  const text = (entry, list) => list.map(name => `${labels[name] ?? name} ${fixed(dialValue(entry, name))}`).join(' · ');
  const varying = namingDials(modelId, sets);
  const naming = varying.length ? varying : [...new Set([...(catalog.models[modelId]?.axes ?? []), 'L'])];
  setLabel = set => `${text(set.entry, naming)} · ${plural(set.pictures.length, 'picture')}`;
  $('parameter-set').replaceChildren(...(sets.length ? sets.map(set => {
    const option = document.createElement('option'); option.value = set.key;
    option.textContent = setLabel(set);
    option.selected = set.key === parameterKey;
    return option;
  }) : [new Option('No verified parameters', '')]));
  const readout = pictures.find(item => item.best.id === selectedId)?.best ?? record ?? chosen?.entry ?? null;
  $('parameter-values').textContent = readout
    ? `${text(readout, names)} · L ${fixed(readout.L)} · dx ${fixed(readout.params.dx)} · stencil ${readout.params.stencil} · N ${readout.N} · M ${readout.M} · T ${readout.period.toFixed(6)}`
    : 'No verified parameter sets';
  $('solution').replaceChildren(...(pictures.length ? pictures.map(item => {
    const option = new Option(pictureLabel(item.best), item.best.id);
    option.selected = item.entries.some(entry => entry.id === selectedId);
    return option;
  }) : [new Option('No verified pictures', '')]));
  $('pattern-thumbnails').replaceChildren(...pictures.map((item, index) => {
    const entry = item.best;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pattern-thumb'; button.dataset.patternId = entry.id;
    button.dataset.fieldKey = item.fieldKey;
    button.setAttribute('aria-pressed', String(item.entries.some(other => other.id === selectedId)));
    button.setAttribute('aria-label', `Picture ${index + 1}: ${pictureLabel(entry)}`);
    const image = document.createElement('img');
    image.src = entry.thumbnail; image.alt = ''; image.width = 160; image.height = 160; image.loading = 'lazy'; image.decoding = 'async';
    const caption = document.createElement('span');
    caption.textContent = `${index + 1}. ${entry.name}`;
    const tag = document.createElement('span');
    tag.className = 'thumb-tag';
    tag.textContent = `${entry.preserve} + ${entry.swap} · ${(entry.metrics.runLengthNodes ?? 0).toFixed(1)} nodes`;
    button.append(image, caption, tag);
    button.onclick = () => selectPicture(entry.id, {user: true});
    return button;
  }));
  $('pattern-count').textContent = `${plural(pictures.length, 'verified picture')}${pictures.length ? ` · one card per distinct picture, drawn at the rule above` : ''}`;
  $('solution-count').textContent = record
    ? `${plural(groupFields(groupId).length, 'picture')} · ${record.preserve} preserving + ${record.swap} swapping operations`
    : `${plural(groupFields(groupId).length, 'picture')}`;
  renderGroups(); renderTiers(); renderRules(); renderEquations(); renderParameterMap(sets); controls();
}

function controls() {
  for (const id of ['play', 'rewind', 'phase', 'export']) $(id).disabled = !record;
  $('parameter-set').disabled = !groupFields(groupId).length;
  $('solution').disabled = !groupFields(groupId).length;
  $('tiles').disabled = $('framing').value !== 'simulation';
  const hasMarks = !!record && marks.length > 0;
  $('show-marks').disabled = !hasMarks;
  $('show-marks').parentElement.title = record && !hasMarks
    ? 'This picture’s catalog record carries no operations to draw, so no marks can be shown.' : '';
  $('notation-open').disabled = !hasMarks;
  $('reset-view').disabled = !record || $('framing').value !== 'endless';
}

// ---- the viewer -------------------------------------------------------------

function engineLabel() {
  if (!record || !renderer) { $('engine-label').textContent = 'No orbit loaded'; lastEngine = ''; return; }
  const text = `${renderer.backend} · ${record.N}²→${2 * record.N}² × ${record.M} · T ${record.period.toFixed(2)} · ${renderer.taps} taps/px`;
  if (text !== lastEngine) { $('engine-label').textContent = text; lastEngine = text; }
}

function updateScaleLabel() {
  if (!view || !record) { $('scale-label').textContent = ''; return; }
  const [width, height] = size();
  const scale = view.scale(width, height);
  const strand = scale * (record.strandCells ?? 0);
  const strandText = strand > 0 ? ` · strand ${strand.toFixed(0)} px` : '';
  $('scale-label').textContent = $('framing').value === 'simulation'
    ? `Fixed frame · ${$('tiles').value === '1' ? 'L' : `${$('tiles').value} L`} across${strandText}`
    : `${Math.round(scale)} CSS px per lattice length${view.angle ? ` · turned ${(view.angle * 180 / Math.PI).toFixed(0)}°` : ''}${strandText}`;
}

/** The framing the picture opens at: the catalog's own `view.tiles`, dropped by
 * one on a narrow screen where the strand would otherwise fall under 14 CSS px.
 * A fine picture at 358 px is a grey smudge. */
function homeTiles(entry) {
  const [width, height] = size();
  const shorter = Math.min(width || 760, height || 760);
  // The catalog chooses `view.tiles` so the strand lands ~34 CSS px wide in a
  // box of `gates.framing.tilePixels` (380). A desktop canvas is twice that, so
  // taking the number literally would draw every strand twice as wide as the
  // builder measured it — the p6 orbits came out at 81 px, well outside the
  // 20–60 band. Scaling the tile count with the canvas reproduces the strand
  // width the catalog actually chose, on any canvas.
  const box = catalog.manifest.gates?.framing?.tilePixels || 380;
  const span = catalog.manifest.gates?.framing?.tilesMax || MAX_TILES;
  let tiles = Math.min(span, Math.max(1, Math.round(entry.view.tiles * shorter / box)));
  // A per-entry framing matters more on a phone than anywhere: a fine picture
  // at 358 px is a grey smudge, so the tile count drops until the strand clears
  // 14 CSS pixels or the frame is down to one cell.
  while (tiles > 1 && shorter / tiles * (entry.strandCells ?? 0) < 14) tiles -= 1;
  return tiles;
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
    $('viewer-hint').textContent = 'Fixed frame — the simulation’s own width, so this picture is comparable with the same orbit on its wallpaper page.';
  } else {
    if (wasFixed) view.reset();
    $('viewer-hint').textContent = matchMedia('(hover: none)').matches
      ? 'Drag to pan · pinch to zoom · two fingers to turn · Reset view below'
      : 'Drag to pan · scroll to zoom · two fingers to turn · 0 resets';
  }
  wasFixed = framing === 'simulation';
  controls(); updateScaleLabel(); needsDraw = true; drawMarks(true);
}

function drawMarks(force = false) {
  const layer = $('marks');
  if (!overlay) { layer.replaceChildren(); layer.style.display = 'none'; return; }
  const [width, height] = size();
  layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const on = marksOn && marks.length > 0;
  layer.style.display = on ? '' : 'none';
  if (on) overlay.update(width, height, {force});
  else overlay.update(0, 0);
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
  const shares = `white ${(record.metrics.white * 100).toFixed(2)} %`;
  if (mode === 'mono') {
    $('display-range').textContent = `w ∈ [${fixed(wRange[0])}, ${fixed(wRange[1])}] · ${shares} · ${(record.metrics.tieFraction * 100).toFixed(2)} % of nodes exactly on the contour`;
    return;
  }
  const channelName = catalog.models[record.model]?.channels?.[mode === 'concentration' ? 1 : 0] ?? (mode === 'concentration' ? 'V' : 'U');
  const range = rampVolume ? rangeOf(rampVolume) : wRange;
  $('display-range').textContent = `${channelName} ∈ [${fixed(range[0])}, ${fixed(range[1])}] · the wave the rule reads · ${shares} in the two-tone picture`;
}

/** The Channel selector, and the sentence that keeps it honest: V is not a
 * second picture, it is the U picture at a lag, and the catalog measured how
 * close and at which lag. */
function updateChannel() {
  const select = $('channel');
  const other = record?.channelV ?? null;
  const option = [...select.options].find(item => item.value === 'v');
  if (option) {
    option.disabled = !other;
    option.textContent = other && Number.isFinite(other.lagFrames)
      ? `V — the same picture, lag ${other.lagFrames}/${record.M} T`
      : 'V — the second channel';
    option.title = other
      ? `Measured: the V reading of this rule reproduces the U reading at a lag of ${other.lagFrames} saved frames on ${(100 * (other.agreement ?? 0)).toFixed(1)} % of the node-frames${other.inverted ? ', with the inks exchanged' : ''}.`
      : 'The rule vanishes identically on the V channel of this field.';
  }
  if (!other && channel === 'v') channel = 'u';
  select.value = channel;
  const note = $('channel-note');
  if (!note) return;
  note.textContent = !record ? ''
    : channel === 'v'
      ? `Drawn on the V channel. ${other?.sameFunction ? 'It is exactly the U picture shifted' : 'It reproduces the U picture'} at a lag of ${other?.lagFrames ?? '—'}/${record.M} of a period, on ${(100 * (other?.agreement ?? 0)).toFixed(1)} % of the node-frames${other?.inverted ? ', with the inks exchanged' : ''} — so it is one picture seen at another moment, not a second one.`
      : other
        ? `The same rule on the V channel is this picture at a lag of ${other.lagFrames}/${record.M} of a period (${(100 * (other.agreement ?? 0)).toFixed(1)} % agreement), which is why V is an option here and not an entry of its own.`
        : 'The rule vanishes on the V channel of this field, so only U is offered.';
}

// ---- the evidence blocks ----------------------------------------------------

/** Where a row's operation acts, in the same words the chips use. */
function opText(row, entry) {
  const N = entry.N;
  if (row.op === '1') {
    if (!row.v[0] && !row.v[1]) return row.frames ? 'wait alone' : 'the identity';
    return `slide (${cellFraction(row.v[0], N)}, ${cellFraction(row.v[1], N)}) of a cell`;
  }
  if (row.centre) return `${row.op} about (${row.centre[0].toFixed(3)}, ${row.centre[1].toFixed(3)})`;
  return row.v[0] || row.v[1] ? `${row.op}, slide (${row.v[0]}, ${row.v[1]}) of ${N}` : `${row.op} through the origin`;
}

const MAX_ROWS = 8;
/** The first `MAX_ROWS` rows must be a fair sample, not the first eight of an
 * order that begins with eight translations. Rows are taken round-robin over the
 * point operation, so every operation that occurs has a representative before
 * any operation has two. */
function sampleRows(rows, limit) {
  // The sample has to be fair in two directions at once, and both were learned
  // by looking at it. Round-robin over the point operation, so an entry whose
  // table begins with eight translations does not show eight translations; and
  // half the budget to each ink behaviour, because the packed table lists every
  // preserving row before every swapping one and an entry with eight preserving
  // point operations filled all eight slots with keeps — on a page whose entire
  // claim is that the other half exchanges the two colours.
  const half = side => {
    const byOp = new Map();
    for (const row of rows) {
      if (row.keep !== side) continue;
      if (!byOp.has(row.op)) byOp.set(row.op, []);
      // The identity at no time shift is true of every picture and says
      // nothing; it goes last so a real operation never loses its place to it.
      const trivial = row.op === '1' && !row.v[0] && !row.v[1] && !row.frames;
      if (trivial) byOp.get(row.op).push(row); else byOp.get(row.op).unshift(row);
    }
    return [...byOp.values()];
  };
  const take = (queues, want) => {
    const out = [];
    while (out.length < want && queues.some(queue => queue.length)) {
      for (const queue of queues) {
        if (out.length >= want) break;
        if (queue.length) out.push(queue.shift());
      }
    }
    return out;
  };
  const keeps = half(true), swaps = half(false);
  const wantSwaps = Math.min(Math.floor(limit / 2), rows.filter(row => !row.keep).length);
  const swapRows = take(swaps, wantSwaps);
  const keepRows = take(keeps, limit - swapRows.length);
  // …and once more for the swaps, in case the keeps could not fill their share.
  const extra = take(swaps, limit - swapRows.length - keepRows.length);
  const out = [...keepRows, ...swapRows, ...extra].sort((a, b) => Number(b.keep) - Number(a.keep));
  return {rows: out, ops: new Set(rows.map(row => row.op)).size};
}

function renderTwoColour() {
  const body = $('two-colour-rows');
  if (!record) { body.replaceChildren(); return; }
  const sample = sampleRows(record.symmetries, MAX_ROWS);
  body.replaceChildren(...sample.rows.map(row => {
    const tr = document.createElement('tr');
    tr.className = row.keep ? 'keep' : 'swap';
    tr.title = `w(${row.op} x + (${row.v.join(', ')})/${record.N}, t + ${row.frames}/${record.M}) = ${row.keep ? '' : '−'}w(x, t)`;
    const first = document.createElement('td');
    const swatch = document.createElement('span');
    swatch.className = `swatch ${row.keep ? 'keep' : 'swap'}`;
    first.append(swatch, opText(row, record));
    const cells = [timeText(row.frames, record.M), row.keep ? 'keep' : 'swap', '0'];
    tr.append(first);
    for (const [index, text] of cells.entries()) {
      const td = document.createElement('td');
      td.dataset.label = ['wait', 'colours', 'residual'][index];
      td.textContent = text;
      tr.append(td);
    }
    return tr;
  }));
  $('two-colour-count').textContent = `${record.preserve} + ${record.swap}`;
  const total = record.preserve + record.swap;
  const ops = (catalog.pointOps[record.lattice]?.ops ?? []).length;
  $('two-colour-lede').innerHTML = `Found by an exhaustive search over the ${ops} ${record.lattice} point operations, all ${record.N} × ${record.N} node translations and all ${record.M} time shifts, then re-checked directly on the saved bytes: `
    + `<b>${record.preserve} operations preserve</b> the two colours and <b>${record.swap} exchange</b> them, every one at residual <b>0</b>. `
    + (record.swap
      ? 'The preserving half is an index-2 subgroup, so this is a proper antisymmetry (two-colour) spacetime group and not a decorative bicolouring.'
      : 'Nothing exchanges them: the threshold picture carries no antisymmetry, which is why it is here as the control.');
  $('two-colour-more').textContent = total > sample.rows.length
    ? `${sample.rows.length} of ${total} shown, at least one for each of the ${plural(sample.ops, 'point operation')} that occur; the full list travels with the export.`
    : '';
  const keep = record.keepGroup, pic = record.picGroup;
  const finer = part => (part?.[2] ? ', on a lattice finer than the saved cell' : '');
  $('two-colour-foot').innerHTML = `The picture's own wallpaper group is <b>${pic ? `${pic[1]} ${pic[0]}` : 'none of the 68 forward film groups'}</b>${finer(pic)}; `
    + `the colour-preserving subgroup is <b>${keep ? `${keep[1]} ${keep[0]}` : 'none of them'}</b>${finer(keep)}. `
    + `Black and white take <b>${(record.metrics.white * 100).toFixed(2)} %</b> and <b>${(record.metrics.black * 100).toFixed(2)} %</b> of the nodes — `
    + (record.swap ? 'equal by force, since an exact operation carries one onto the other' : 'a plain threshold, so nothing forces them equal')
    + ` — with ${(record.metrics.tieFraction * 100).toFixed(2)} % of the samples sitting exactly on the contour.`;
}

function renderRecord() {
  if (!record) return;
  const m = record.metrics;
  const provenance = catalog.manifest.provenance ?? {};
  const nodeFrames = record.N * record.N * record.M;
  $('caption').textContent = `${record.name} · ${record.modelName} · ${record.N}² nodes, ${record.M} frames over one period T = ${record.period.toFixed(3)} · `
    + `the two-colour law re-derived from the saved bytes at ${nodeFrames.toLocaleString('en-GB')} node-frames in integer index arithmetic.`;
  const cells = [
    ['Antisymmetry residual', record.laws?.s ? (record.laws.s[1] === 1 ? '0' : sci(record.laws.s[0])) : '—'],
    ['Half-period residual', record.laws?.halfPeriod ? (record.laws.halfPeriod[1] === 1 ? '0' : sci(record.laws.halfPeriod[0])) : '—'],
    ['Preserving + swapping', `${record.preserve} + ${record.swap}`],
    ['Strand width', `${(m.runLengthNodes ?? 0).toFixed(2)} nodes`],
    ['White share', (m.white ?? 0).toFixed(4)],
    ['Speckle', sci(m.speckle ?? 0)],
    ['Boundary density', (m.boundaryDensity ?? 0).toFixed(4)],
    ['Frame-to-frame churn', (m.churn ?? 0).toFixed(4)],
  ];
  $('metrics').replaceChildren(...cells.map(([name, value]) => {
    const div = document.createElement('div');
    const span = document.createElement('span'); span.textContent = name;
    const strong = document.createElement('strong'); strong.textContent = value;
    div.append(span, strong); return div;
  }));
  const bytes = record.byteLength.toLocaleString('en-GB');
  $('provenance').innerHTML = `Orbit ${record.atlasIds.map(id => `<code>${id}</code>`).join(', ') || '<code>—</code>'} · field sha256 `
    + `<code title="${record.fieldSha256}">${record.shortSha}…</code> · ${bytes} bytes, float32 LE, `
    + `${pretty(catalog.manifest.shape?.fieldUrl ?? 'M frames × 2 channels (U then V) × N × N, x fastest')} · `
    + `catalog <code>${catalog.manifest.schema}</code> generated ${catalog.manifest.generated ?? '—'} by builder <code>${String(provenance.builderSha256 ?? '—').slice(0, 12)}…</code> `
    + `from wallpaper atlas <code>${String(provenance.atlasSha256 ?? '—').slice(0, 12)}…</code>. `
    + `The field bytes themselves are the wallpaper atlas's own audited orbit — no bytes were copied for this category.`;
}

/** What step 2 is currently talking about — the entry's own rule, or the folded
 * reading the reader picked. */
function optionTitle() {
  const option = currentOption();
  if (!record) return '—';
  return option?.folded ? (catalog.ruleKinds[option.folded.kind]?.title ?? option.folded.kind) : record.ruleTitle;
}

function renderSelected() {
  const group = groups.find(item => item.id === groupId);
  $('selected-id').textContent = record ? `${groupId} · ${optionTitle()}` : groupId ?? '';
  $('selected-title').textContent = group ? star(group.signature) : groupId ?? '—';
  $('selected-title').setAttribute('aria-label', `Now showing: ${groupId}${group ? `, signature ${star(group.signature)}` : ''}`);
  // Not the rule's blurb: the `.rule-law` panel three inches above has just
  // said that. This slot is about the film group the picture is filed under.
  const tierSentence = pretty(catalog.tiers[record?.tier]?.blurb ?? '').split('. ')[0];
  $('selected-description').textContent = group
    ? `${star(group.signature)} · ${plural(group.phaseOrder, 'phase')} per period`
      + (record ? `. ${record.preserve} of this picture's operations keep the two inks and ${record.swap} exchange them. ${tierSentence}.` : '.')
    : record ? pretty(record.ruleBlurb) : '';
  $('group-label').textContent = group ? `${star(group.signature)} ${groupId}` : groupId ?? '';
  $('mode-label').textContent = record
    ? `${optionTitle()} · ${channel.toUpperCase()} channel · ${catalog.tiers[record.tier]?.title ?? record.tier}`
    : 'Loading catalog';
}

function renderNotation() {
  const panel = $('notation');
  if (!record || !marks.length) { panel.innerHTML = ''; return; }
  panel.innerHTML = `<div class="notation-head"><h2>Reading the generator marks</h2><button type="button" id="notation-close">Close</button></div>`
    + legendMarkup(record, marks);
  $('notation-close').onclick = () => setNotation(false);
}

// ---- loading one picture ----------------------------------------------------

function empty({loading = false, error = null} = {}) {
  renderer?.dispose(); renderer = null;
  gestures?.dispose(); gestures = null;
  overlay = null; record = null; marks = []; wVolume = null; rampVolume = null; rampKey = null;
  setPlaying(false);
  delete canvas.dataset.ready;
  $('empty-state').hidden = false;
  $('empty-state').querySelector('h2').textContent = loading ? 'Loading saved animation…' : error ? 'Animation unavailable' : 'No verified picture here';
  $('empty-description').textContent = loading ? 'Downloading the saved field.' : error ?? 'No field in this film group carries a picture under the current tier.';
  $('retry-animation').hidden = !error;
  $('mode-label').textContent = loading ? 'Loading saved animation' : error ? 'Download failed' : 'Nothing selected';
  // The mark layer is SVG and survives whatever happens to the canvas under it,
  // so it has to be taken down with the picture.
  $('marks').replaceChildren();
  $('marks').style.display = 'none';
  $('phase-label').textContent = '—'; $('display-range').textContent = '';
  $('caption').textContent = error ?? 'Only pictures whose two-colour law was re-derived from the saved bytes at every node-frame appear here.';
  $('metrics').replaceChildren(); $('provenance').textContent = '';
  $('two-colour-rows').replaceChildren(); $('two-colour-foot').textContent = ''; $('two-colour-more').textContent = '';
  $('notation').innerHTML = '';
  engineLabel(); controls();
}

async function selectPicture(id, {user = false, view: wanted = null} = {}) {
  const summary = catalog.get(id);
  if (!summary || !summary.families.includes(FAMILY)) return;
  const token = ++selectionToken;
  selectedId = id; modelId = summary.model; ruleKind = summary.kind; ruleOptionKey = summary.id; parameterKey = keyOf(summary);
  if (!hosts(summary, groupId)) groupId = groups.find(item => hosts(summary, item.id))?.id ?? groupId;
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
    // The whole rule, in one call: the channel the builder chose, the
    // involution's integer matrix and node translation, and the spectral
    // doubling the contour is reconstructed on.
    wVolume = ruleVolume(record.field, {
      N: record.N, M: record.M, channels: 2, channel: channel === 'v' ? 1 : 0,
      kind: record.kind, S: record.S, v: record.v,
    });
    wRange = rangeOf(wVolume);
    if (!(wRange[1] > wRange[0])) throw Error('The difference field is flat — this picture would be one colour.');
    const tiles = wanted?.tilesAsked ? wanted.tiles : homeTiles(record);
    if (!requestedCamera && $('framing').value === 'simulation') $('tiles').value = String(tiles);
    view = createView({
      tilePixels: scaleFor(tiles),
      center: record.view.centre,
      minScale: Math.max(MIN_SCALE, record.N / (devicePixelRatio || 1)),
      maxScale: MAX_SCALE,
      overshoot: 1.04,
      lattice: record.latticeSpec,
    });
    renderer = createMonoRenderer(canvas, wVolume, {
      N: record.N, M: record.M, view, loopSeconds: LOOP_SECONDS, ink: INK,
      boundarySpeed: record.metrics.boundarySpeed ?? undefined,
    });
    gestures = createGestures(canvas, {
      view, size, reducedMotion,
      onChange: () => { needsDraw = true; drawMarks(); updateScaleLabel(); },
      onSettle: syncUrl,
      onTouch: () => renderer?.touched(),
    });
    marks = planMarks(record, {lead: currentOption()?.folded ?? null});
    overlay = createMarkOverlay($('marks'), view, {marks});
    $('marks').setAttribute('aria-label', overlay.description());
    if (requestedCamera) {
      view.restore({center: [requestedCamera.x, requestedCamera.y], scale: requestedCamera.scale, angle: requestedCamera.angle * Math.PI / 180});
    }
    $('empty-state').hidden = true;
    lastEngine = '';
    applyPalette();
    renderSelected(); renderRuleLaw(); renderTwoColour(); renderRecord(); renderNotation(); updateChannel(); updateDisplayRange();
    applyFraming(); populate();
    lastTime = performance.now(); setPlaying(requested.play); controls();
    needsDraw = true; drawMarks(true); draw(); needsDraw = false;
    // The site's own readiness flag: the browser tests wait on it rather than on
    // a timer, so a slow download never reads as a blank canvas.
    canvas.dataset.ready = 'true';
    $('status').textContent = `${groupId} · ${record.modelName} · ${optionTitle()} · ${record.name} — ready.`;
    syncUrl();
    // A link may name a rule this entry folds rather than one it is: the entry
    // is right and only the sentence has to follow, so it is applied after the
    // load rather than being allowed to pick a different entry.
    if (wantedRule && wantedRule !== ruleKind && (ruleOptions().get(wantedRule) ?? []).some(option => option.folded)) {
      const asked = wantedRule; wantedRule = null;
      chooseRule(asked);
    } else wantedRule = null;
  } catch (error) {
    if (token !== selectionToken) return;
    empty({error: error.message}); $('status').textContent = error.message;
  }
}

/** The Appearance selector. The two tones draw w itself; ember and the second
 * channel draw a channel of the orbit through a ramp — the wave the rule is
 * reading — on the same doubled grid, the same camera and the same shutter. */
function applyPalette() {
  if (!renderer || !record) return;
  const mode = $('palette').value;
  if (mode === 'mono') {
    renderer.setAppearance('mono', null, 'ember', wVolume);
    rampVolume = null; rampKey = null;
    needsDraw = true;
    return;
  }
  const channel = mode === 'concentration' ? 1 : 0;
  const key = `${record.id}:${channel}`;
  if (key !== rampKey) {
    rampVolume = channelDisplayVolume(record.field, {N: record.N, M: record.M, channels: 2, channel});
    rampKey = key;
  }
  renderer.setAppearance('field', rangeOf(rampVolume), mode === 'concentration' ? 'concentration' : 'ember', rampVolume);
  needsDraw = true;
}

// ---- the choosers -----------------------------------------------------------

function chooseModel(model, {user = false} = {}) {
  if (!fieldsIn(groupId, model).length) return;
  modelId = model; parameterKey = null;
  const first = parameterSets(model)[0]?.pictures[0]?.best?.id ?? null;
  if (first) selectPicture(first, {user});
  else { selectedId = null; empty(); populate(); if (user) syncUrl({step: user}); }
}

function chooseTier(key, {groupId: wantGroup = null} = {}) {
  if (!PASSES[key]) return;
  tier = key;
  if (wantGroup && groupFields(wantGroup).length) groupId = wantGroup;
  if (!groupFields(groupId).length) {
    const next = groups.find(item => groupFields(item.id).length);
    if (next) groupId = next.id;
  }
  // Keep the picture on screen whenever the new tier still carries a reading of
  // it: switching "show" must not throw away what the reader was looking at.
  const field = record?.fieldKey ?? catalog.get(selectedId)?.fieldKey ?? null;
  const here = field ? catalog.ofField(field).filter(PASSES[tier]) : [];
  const keep = here.find(entry => entry.id === selectedId)
    ?? here.find(entry => entry.kind === ruleKind)
    ?? here[0];
  const first = keep ?? groupFields(groupId)[0]?.best ?? null;
  renderTiers(); renderGroups();
  if (first) {
    // The picture may already be the right one — a strict entry survives every
    // tier — and then only the chips and the link have to follow.
    if (first.id === selectedId && record) { populate(); renderRuleLaw(); syncUrl({step: true}); }
    else selectPicture(first.id, {user: true});
  } else { selectedId = null; empty(); populate(); syncUrl({step: true}); }
}

/** Step 2. A folded reading of a strict entry changes the sentence, the lead
 * mark and the highlighted row — and NOTHING on the canvas, because it is the
 * same function. So it must not reload the picture: a reload would rebuild the
 * volume, flash the empty state and make the reader doubt a claim the page has
 * just made in bold. A separate entry is a different picture and does load. */
function chooseRule(kind, {user = false, key = null} = {}) {
  const here = ruleOptions().get(kind) ?? [];
  if (!here.length) return;
  const option = (key && here.find(item => item.key === key)) ?? preferred(here);
  ruleKind = kind; ruleOptionKey = option.key;
  if (option.folded) {
    marks = planMarks(record, {lead: option.folded});
    if (overlay) { overlay.dispose(); overlay = createMarkOverlay($('marks'), view, {marks}); $('marks').setAttribute('aria-label', overlay.description()); }
    renderRules(); renderRuleLaw(); renderSelected(); renderNotation(); renderTwoColour(); controls();
    drawMarks(true);
    if (user) syncUrl({step: true});
    return;
  }
  selectPicture(option.entry.id, {user});
}

function chooseGroup(id, {user = false, view: wanted = null} = {}) {
  // A `pattern=` in the link is followed, not dropped: a picture the current
  // tier excludes moves the page to where the link points rather than being
  // silently replaced.
  let asked = wanted?.patternId ? catalog.get(wanted.patternId) : null;
  if (asked && !asked.families.includes(FAMILY)) asked = null;
  if (asked && !PASSES[tier](asked)) { tier = 'all'; renderTiers(); }
  const next = (asked && groups.find(item => item.id === id && hosts(asked, item.id)))
    ?? (asked && groups.find(item => hosts(asked, item.id)))
    ?? groups.find(item => item.id === id && groupFields(item.id).length)
    ?? groups.find(item => groupFields(item.id).length)
    ?? groups[0];
  if (!next) { empty(); return; }
  groupId = next.id; ++selectionToken;
  renderGroups(); renderSelected();
  const usable = asked && hosts(asked, groupId) ? asked : null;
  const present = modelsPresent();
  modelId = usable ? usable.model : present.includes(wanted?.model) ? wanted.model : present[0] ?? null;
  parameterKey = null;
  if (wanted?.rule) { ruleKind = wanted.rule; wantedRule = wanted.rule; }
  const sets = parameterSets(modelId);
  const first = usable
    ?? openingPicture(fieldsIn(groupId, modelId))
    ?? openingPicture(groupFields(groupId))
    ?? lightestPicture(fieldsIn(groupId, modelId))
    ?? sets[0]?.pictures.find(item => item.best.featured)?.best
    ?? sets[0]?.pictures[0]?.best
    ?? groupFields(groupId)[0]?.best ?? null;
  populate();
  if (first) selectPicture(first.id, {user, view: wanted});
  else { selectedId = null; empty(); $('status').textContent = 'No verified picture in this film group.'; if (user) syncUrl({step: true}); }
}

function setNotation(value) {
  notationOn = !!value && marks.length > 0;
  $('notation').hidden = !notationOn;
  $('notation-open').setAttribute('aria-expanded', String(notationOn));
  syncUrl();
}

function setMarks(value) {
  marksOn = !!value && marks.length > 0;
  $('show-marks').checked = marksOn;
  try { localStorage.setItem(`mono:${FAMILY}:marks`, marksOn ? '1' : '0'); } catch { /* private windows refuse storage */ }
  drawMarks(true); syncUrl();
}

function restoreUrl() {
  const state = readViewState(location.hash);
  // A reader who has asked for reduced motion gets a still picture unless the
  // link they followed says otherwise.
  if (reducedMotion.matches && !/[?&]play=/.test(location.hash)) state.play = false;
  tier = state.tier ?? 'all';
  ruleKind = state.rule ?? null;
  channel = state.channel === 'v' ? 'v' : 'u';
  $('channel').value = channel;
  $('framing').value = state.framing;
  $('tiles').value = String(state.tiles);
  $('palette').value = state.palette;
  $('speed').value = String(state.speed);
  // Off unless asked for: `state.marks` defaults to false, a link that names
  // `marks=` decides the visit outright, and otherwise a reader who ticked the
  // box last time keeps it ticked.
  marksOn = state.marks;
  if (!location.hash.includes('marks=')) {
    try { const saved = localStorage.getItem(`mono:${FAMILY}:marks`); if (saved !== null) marksOn = saved === '1'; } catch { /* ignore */ }
  }
  $('show-marks').checked = marksOn;
  notationOn = state.notation;
  $('notation').hidden = !notationOn;
  $('notation-open').setAttribute('aria-expanded', String(notationOn));
  renderTiers();
  // A `tiles=` the link actually carried is the reader's framing, not a default
  // to be replaced. Without this the page took the catalog's own framing every
  // time and rewrote the hash, so a shared link that named a width — or a
  // showcase card, whose preview is framed at two cells — never round-tripped:
  // it opened somewhere else and then changed the address bar to say so.
  chooseGroup(state.groupId, {view: {...state, tilesAsked: /[?&]tiles=/.test(location.hash)}});
}

// ---- controls ---------------------------------------------------------------

function togglePlayback() { if (!record) return; setPlaying(!playing); needsDraw = true; syncUrl(); }
$('play').onclick = togglePlayback;
bindCanvas();
$('rewind').onclick = () => { phase = 0; needsDraw = true; syncUrl(); };
$('phase').oninput = () => { phase = Math.min(Math.max(+$('phase').value, 0), 1 - 1e-6); setPlaying(false); needsDraw = true; syncUrl(); };
$('speed').onchange = syncUrl;
$('framing').onchange = () => { applyFraming(); syncUrl(); };
$('tiles').onchange = () => { applyFraming(); syncUrl(); };
$('palette').onchange = () => { applyPalette(); updateDisplayRange(); syncUrl(); };
// A channel change is a different difference field, so it rebuilds the volume —
// the bytes are already cached, so nothing is downloaded again.
$('channel').onchange = () => { channel = $('channel').value === 'v' ? 'v' : 'u'; if (selectedId) selectPicture(selectedId, {user: true}); };
$('rule-variant').onchange = () => chooseRule(ruleKind, {user: true, key: $('rule-variant').value});
$('show-marks').onchange = () => setMarks($('show-marks').checked);
$('notation-open').onclick = () => setNotation(!notationOn);
$('reset-view').onclick = () => { gestures?.interrupt(); view?.reset(); needsDraw = true; drawMarks(true); updateScaleLabel(); syncUrl(); };
$('retry-animation').onclick = retryAnimation;
$('parameter-set').onchange = () => { const set = parameterSets().find(item => item.key === $('parameter-set').value); if (set) selectPicture(set.pictures[0].best.id, {user: true}); };
$('solution').onchange = () => selectPicture($('solution').value, {user: true});
$('parameter-map').onclick = event => {
  const nearest = nearestSet(event);
  if (nearest) selectPicture(nearest.set.pictures[0].best.id, {user: true});
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
  if (sets.length) selectPicture(sets[(index + step + sets.length) % sets.length].pictures[0].best.id, {user: true});
};
$('export').onclick = () => {
  if (!record) return;
  // Self-contained: the build hoists the equation, the rule prose, the notes and
  // the point operations out of every entry and into the manifest, so an
  // exported entry alone would carry bare indices. The tables it indexes travel
  // with it, and the file can be read without the catalog.
  const payload = {
    schema: 'monochrome-verified-picture-export-v1',
    exported: new Date().toISOString(),
    catalog: {
      ...catalog.manifest,
      models: {[record.model]: catalog.models[record.model]},
      ruleKinds: {[record.kind]: catalog.ruleKinds[record.kind]},
      pointOps: {[record.lattice]: catalog.pointOps[record.lattice]},
    },
    entry: record.raw,
    source: record.rawField,
    rule: {
      kind: record.kind, channel, matrix: record.S, translation: record.v,
      identity: record.ruleFormula,
      note: 'w is taken on the saved node grid, where x -> S x + v is exact integer indexing, then spectrally doubled for the drawn contour.',
    },
    twoColour: {
      preserving: record.preserve, swapping: record.swap,
      rows: record.symmetries.map(row => ({op: row.op, M: row.M, v: row.v, frames: row.frames, colours: row.keep ? 'keep' : 'swap', residual: 0})),
    },
    field: {
      encoding: 'base64-float32-le',
      layout: 'frame-major; planar channel 0 then channel 1; x-fast; lattice nodes i/N',
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
  if (event.key === 'g' || event.key === 'G') { if (marks.length) setMarks(!marksOn); }
  else if (event.key === 'n' || event.key === 'N') setNotation(!notationOn);
  else if (event.key === 'Escape' && notationOn) setNotation(false);
  else if (event.key === '0' && $('framing').value === 'endless') { gestures?.interrupt(); view?.reset(); needsDraw = true; drawMarks(true); updateScaleLabel(); syncUrl(); }
  else return;
  event.preventDefault();
});
new ResizeObserver(() => { needsDraw = true; drawMarks(true); updateScaleLabel(); }).observe(document.querySelector('.canvas-wrap'));
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

// ---- boot -------------------------------------------------------------------

try {
  catalog = await loadMonoCatalog({baseUrl: root, version: VERSION});
  entriesOfFamily = catalog.all(FAMILY);
  if (!entriesOfFamily.length) throw Error(`The catalog has no ${FAMILY} pictures.`);
  fieldsOfFamily = [...new Set(entriesOfFamily.map(entry => entry.fieldKey))];
  // Step 1 lists the film groups OF THIS FAMILY that host one of its pictures.
  // A field filed under two families reaches both pages, and each page shows
  // only its own family's time-shift symmetries.
  const seen = new Set();
  for (const entry of entriesOfFamily) {
    for (const id of entry.groupIds) {
      if (seen.has(id)) continue;
      const meta = catalog.groupMeta(id);
      if (!meta || meta.family !== FAMILY) continue;
      seen.add(id);
      groups.push({id, signature: meta.signature ?? id, orbifold: meta.orbifold ?? '', family: meta.family, phaseOrder: meta.phaseOrder ?? 1});
    }
  }
  groups.sort((a, b) => groupFields(b.id, 'all').length - groupFields(a.id, 'all').length || a.id.localeCompare(b.id));
  if (!groups.length) throw Error(`No ${FAMILY} film group hosts a picture.`);
  $('policy-label').textContent = 'Precomputed, re-measured pictures';
  const byTier = key => entriesOfFamily.filter(entry => entry.tier === key).length;
  const halfPeriodExact = entriesOfFamily.filter(entry => entry.laws?.halfPeriod?.[1] === 1).length;
  $('character-note').textContent = `${plural(fieldsOfFamily.length, 'saved field')} of this family carry ${plural(entriesOfFamily.length, 'admitted reading')}: `
    + `${byTier('strict')} where the involution is itself a spacetime symmetry of the field, ${byTier('broad')} where it is free, ${byTier('control')} plain thresholds for comparison. `
    + `Separately measured, and not the same question: ${halfPeriodExact} of the ${entriesOfFamily.length} exchange the two inks after half a period exactly. `
    + 'Every reading was measured on the saved bytes in integer index arithmetic, not assumed.';
  restoreUrl();
  requestAnimationFrame(animate);
} catch (error) {
  empty({error: error.message});
  $('status').textContent = error.message;
}
