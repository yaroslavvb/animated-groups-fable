// app.js — The Folding: the wiring (SPEC 5.12). OWNER: integrator (round 3: ui-app).
//
// State   { groupId, presetIndex | custom seed, cutIndex, metric, amp, t, anchor }
//   group change        -> preset 0, t = 0, the camera frame jumps to the new tile (its ORIENTATION is kept, the
//                          zoom glides back to 1: a zoom carried into another shape could overflow the pane)
//   seed / preset / amp -> rebuild domain, mesh and fold, keep t: with the shape folded, dragging in the plane makes
//                          the seams slide over it live
//   t                   -> owned by the timeline (src/timeline.js): scrubbing, Fold / Unfold, Space
//   cutIndex            -> the preset last chosen: its metric and its anchor stay while the cut is dragged
//   anchor              -> preset.anchor ?? preset.seed of the chosen preset (SPEC 7 anchor contract, SPEC 8 C3), handed
//                          to every fold as opts.anchor. Set when a group or a preset is chosen (on load and from the URL
//                          hash too); NOT changed by dragging the cut or by the Wavy slider, so the hinge and cross-cap
//                          folds, whose shape at t = 1 depends on the anchor only, keep the folded shape where it is
// Per frame: positions = fold.at(t) over the vertices of fold.mesh -> renderer; lines = the tile's boundary edge by
// edge (the colour of its seam / ink for a mirror), the creases (thin, dashed, fading out as the fold completes), the
// pieces of the motif, the double line of the two shapes that have one; markers = the cone points with their order,
// one label per point of the orbifold (copies of a point keep their dot; their label fades as they meet the first
// copy: sceneMarkers); camera frame = bounding sphere of the positions. Nothing but "reset view" (or a URL that names
// a view) ever resets the 3D orientation. A fold with fold.mirrored === true (the tile lies an odd number of mirrors
// from the anchor: its paper ends up turned over) gets the renderer's front and back colours swapped (C3), blended
// at every drawn t by fold.mirroredAt(t) when the fold has it (SPEC 9 C3 addition; surfaceStyle).
// While the cut is dragged (or Wavy is moved) the frames use core's draft mesh (buildMesh { draft: true }: the same
// boundary samples, about half the triangles); the full mesh is built when the gesture ends (onSeed 'end', the
// Wavy slider's change), so a still picture is always the full mesh.
// fold.mesh is drawn with the pattern's one big comma filled into the sheet (motifTintMesh: tint bit 1, the
// renderer's `fill` colour MOTIF_FILL_3D), for every fold (qa/fill-judge.md; see the note above CREASE_SAMPLES) —
// when the pattern is 'comma'.
//
// THE PATTERN (13 Nov 2026; the owner: "use the Checkerboard choice … I want more of the surface to be covered with
// pattern … Maybe add a selector at the top which allows me to pick different patterns"). state.pattern is a key of
// pattern.js PATTERNS: 'checker' (the default), 'rings', 'comma'. A print ('checker', 'rings') is a two-tone pattern
// of the plane that the group leaves as it is: the plane shows it everywhere (setScene({ print })), the 3D sheet
// carries it as paper does, front teal and back sand, nearly opaque (the renderer evaluates it per pixel at each
// vertex's paper point: setSurface({ uv }), setStyle({ print })); no comma is drawn then. 'comma' is the picture as it
// was: one comma per tile on a translucent sheet. The hash carries it as pat=<key> when it is not the default.
//
// RE-CUT FIRST (13 Nov 2026; the owner: "for the motion use 'Re-cut first' in the cases where there is a
// self-intersection of the surface"). The app asks the folds for it (createFold({ recut: true }); src/folds/recut.js):
// a tile of xx or 22x that is not the group's default cut is first re-cut into it, piece by piece, by elements of the
// group, and then folds with nothing passing through anything. Such a fold has fold.recut; its mesh has no vertex
// shared between two pieces, and brings boundaryRuns (the outline cut where the piece changes: drawn instead of
// boundary, so no line stretches between pieces that are apart) and cuts (where the tile is cut: the home tile's rim,
// drawn as fold.cutStyle(t) says). The plane shows the home tile dotted and the cuts dashed (setScene({ recut })); the
// words of #fold-caption say which piece moves by which element (foldCaption).
//
// The URL (SPEC 7, URL state contract). The whole visible state lives in the hash:
//   #g=<id>&pat=<pattern>&cut=<preset>&seed=<x>/<y>&wavy=<0..1>&t=<0..1>&view=<az>/<el>/<zoom>[/<roll>]
// g always; the others only when they differ from their defaults (pat checker, cut 0, no seed, wavy 0, t 0, view 0/55/1/0). The id
// has * written %2A (#g=%2A632); seed (straight coordinates, 4 decimals) only when the cut was dragged away from the
// preset — cut still names the preset whose metric and anchor apply; t 3 decimals, wavy 2, az / el / roll 1, zoom 2.
// roll (an addition: the trackball turns freely, so az / el alone would lose the view's turn about the line of sight)
// appears only when it is not 0. The kaleidoscopes write no seed and no wavy (nothing to cut). Legacy links #<id>
// (#333, #4*2, #*632, #s632, …) still load. encodeHash / decodeHash are pure and tested in node (test/app-url.test.js).
// Every state change writes the hash (history.replaceState: no history entry) at most every HASH_THROTTLE_MS, at once
// when a drag, a scrub, a play or a turn of the 3D view ends, and posts parent.postMessage({ type: 'ss-hash', hash },
// '*') when the page runs in a frame, so the spacesheep viewer rewrites its address bar (it takes only hashes that
// match WRAPPER_HASH). On load and on hashchange (the viewer forwards a pasted link's hash) the state is applied:
// group, cut (preset, anchor, metric), seed, wavy, t and the 3D view; a hash that names no group leaves the picture
// alone and is rewritten to what is shown. dev/app-frame.html is a stand-in of the viewer.
//
// The page attributes (SPEC 8 C1): #app[data-fold] = group.fold, #app[data-features] = groupFeatures(group). The
// kaleidoscopes have nothing to cut: the plane takes no drags there (setScene({ interactive: false }), C2) and shows
// no hint. #turn-hint ("drag to turn") is hidden after the person's first turn of the 3D view. Without WebGL 2 the
// fold controls are disabled and the plane stays fully usable.
//
// The file has two halves. The first is pure (no DOM): buildScene / mapScene / sceneLines / sceneMarkers turn a
// state into what the renderer draws, and test/folds.test.js runs them in node for every group. The second, start(),
// wires them to the page shell (ids: see the top of src/index.template.html) and runs only where there is a document.
//
// window.__folding — for tools/qa-matrix.mjs and tools/shot.mjs. Every setter applies at once, draws both panes
// before it returns, and returns getState():
//   setGroup(id)   setPreset(i)   setSeed(x, y)   setAmp(a)   setT(t)   setView(az, el[, zoom])   getState()
//   setPattern(key)   (getState().pattern, .print: the print's name or null, .recut: null or { home, pieces, movers,
//                  tau0 }, .foldCaption: the words over the fold pane)
//                  (getState().anchor = the anchor the folds are given; .cut = the preset whose anchor applies;
//                  .view = { az, el, zoom, roll, gliding } as shown now, gliding = the zoom is on its way back to 1
//                  after a group change; .url = the hash this state writes; .hash = the hash the address has now,
//                  which follows within HASH_THROTTLE_MS)
//   ready          promise: the first picture is on screen (resolves to getState())
//   play([target]) promise: the playback has ended     resetView()   openPicker()   closePicker()   flushHash()
//   errors         what was caught while building or drawing (also printed with console.error)
//   counters       { rebuilds, draws, hashWrites, hashPosts } so far
//   renderer, plane, timeline, picker, scene()           the parts, for a closer look
// setSeed is ignored for the kaleidoscopes (nothing to cut, as in the plane).

import { GROUPS, BY_ID, latticeCoords } from './groups.js';
import { apply, inverse } from './geom.js';
import { makeWarp, buildDomain } from './domain.js';
import { buildMesh } from './mesh.js';
import { createFold, foldMeshOptions, foldOptions } from './folds/index.js';
import { PATTERNS, DEFAULT_PATTERN, resolvePattern, printFor, printUniforms } from './pattern.js';
import { createRenderer, viewFromAzEl } from './render3d.js';
import { createPlaneView, assignEdgeColors, CAPTION_SMALL } from './plane.js';
import { motifFor, motifInTile, motifTintMesh } from './motif.js';
import { createHassePicker } from './hasse.js';
import { createTimeline, enhanceRange } from './timeline.js';
import { classColor, hexToRgb, MIRROR_COLOR, CREASE_COLOR, MOTIF_COLOR, INK, SURFACE_FRONT, SURFACE_BACK, SURFACE_GHOST, MOTIF_FILL_3D,
  SURFACE_OPACITY, PRINT_FRONT, PRINT_BACK, PRINT_OPACITY, RECUT_COLOR } from './palette.js';

// ---------------------------------------------------------------------------------------------------------------
// Pure half: from a state to what is drawn
// ---------------------------------------------------------------------------------------------------------------

export const DEFAULT_GROUP = '333';

/** Line widths in css px at a 520 px pane (they shrink a little on a phone, see lineScale). */
export const WIDTHS = { edge: 4.5, crease: 1.6, motif: 1.8, axis: 2.2, cut: 1.9 };
/** Opacity of the motif lines (the commas). */
export const MOTIF_ALPHA = 0.7;
/** How strongly the tile's edges show through the surface (the renderer's x-ray share), and a kaleidoscope's outline. */
export const EDGE_XRAY = 0.42, KALEIDO_EDGE_XRAY = 0.85;
// The comma filled in 3D, for EVERY fold (the owner's ask of 9-10 Nov 2026, "find a way to occupy more space on the
// Orbifold", "I meant for all the examples"; qa/fill-judge.md). The orbifold carries one big comma (motif.js: about 30 %
// of the tile); its outline alone is a thin line on a bent translucent sheet, so the sheet itself carries it:
// motifTintMesh cuts fold.mesh along the comma's outline and sets tint bit 1 inside, which the renderer draws in its
// `fill` colour (MOTIF_FILL_3D, a deep teal, the surface's own hue: the coloured seams keep their contrast), on both
// sides of the sheet alike (across a glide seam the front continues into the back). Tint bit 0 stays what the fold
// gave it: a kaleidoscope star's mirror images (the renderer's `ghost`, see ghostColor), whose flaps carry their
// filled commas onto the copy beneath. The fill is part of the sheet, so nothing changes colour in time.
const CREASE_SAMPLES = 13;
// A kaleidoscope's copy of the motif fades while its flap comes down: from this share of the stage in which the flap
// first moves (the flap is upright half way) to the end of that stage (see motifFades).
const MOTIF_FADE_FROM = 0.45;

// When the creases fade: [from, to] in t. They are where the tile bends on its way, not features of the orbifold, so
// they are gone when the fold is complete. The cross-cap's hinges are done at its middle stop; what follows moves
// the surface without regard to them (its window follows the fold's own times: creaseFade; this entry is for a
// cross-cap without them). The snowflake's creases are mirrors of the pattern: they stay until the last fold, at
// whose end they lie under the tile's outline.
const CREASE_FADE = { hinge: [0.45, 1], crosscap: [0.2, 0.47], snowflake: [0.72, 1] };

const INK_RGB = hexToRgb(MIRROR_COLOR), MARK_RGB = hexToRgb(INK), CREASE_RGB = hexToRgb(CREASE_COLOR);
const MOTIF_RGB = hexToRgb(MOTIF_COLOR), CUT_RGB = hexToRgb(RECUT_COLOR);
const PRINT_FRONT_RGB = PRINT_FRONT.map(hexToRgb), PRINT_BACK_RGB = PRINT_BACK.map(hexToRgb);
/** How far a kaleidoscope star's secondary tiles take the ghost colour under a print (the print shows through). */
export const GHOST_PRINT_MIX = 0.3;

const clamp01 = (v) => { const x = Number(v); return x > 0 ? (x < 1 ? x : 1) : 0; };   // NaN -> 0
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** A group id from whatever a URL or a person may hold: "*632", "∗632", "s632", "22X" …; null when it names no group. */
export function resolveGroupId(raw) {
  if (raw == null) return null;
  const id = String(raw).trim().replace(/[∗＊]/g, '*').replace(/[×✕]/g, 'x').replace(/[○◯]/g, 'o');
  if (!id) return null;
  for (const c of [id, id.toLowerCase(), id.replace(/s/g, '*'), id.toLowerCase().replace(/s/g, '*')]) {
    if (Object.prototype.hasOwnProperty.call(BY_ID, c)) return c;
  }
  return null;
}

// ---- the URL hash (SPEC 7, URL state contract) ----------------------------------------------------------------

/** The spacesheep viewer takes a hash from the frame only if it matches this (verified 9 Nov 2026). */
export const WRAPPER_HASH = /^#[A-Za-z0-9_.=%&\/-]*$/;
/** The keys of the hash, in the order they are written. `tile` (the replication step, 10 Nov 2026): how far the
 *  plane's replication has come, 0..1, 3 decimals; absent = 1, the tiling as always. */
export const HASH_KEYS = ['g', 'pat', 'cut', 'seed', 'wavy', 'tile', 't', 'view'];
/** While the state keeps changing the hash is written at most once in this many ms (at once when a gesture ends). */
export const HASH_THROTTLE_MS = 250;
/**
 * Safari refuses history.replaceState beyond 100 calls in 30 s (and the viewer calls it once per ss-hash message).
 * The page never writes more than `calls` times in `ms`; and while the state keeps changing, the throttle's interval
 * grows with the writes of the last `ms` beyond `from` (by one interval per `step` writes), so a long drag or play
 * slows the writes down instead of running into the cap: the address keeps following, about every 0.6 s at worst.
 */
export const HASH_BUDGET = Object.freeze({ calls: 90, ms: 30000, from: 30, step: 15 });
/** The throttle's interval after n writes in the last HASH_BUDGET.ms. */
export function hashInterval(n) { return HASH_THROTTLE_MS * (1 + Math.max(0, n - HASH_BUDGET.from) / HASH_BUDGET.step); }
/**
 * How long a hash write must wait (ms, 0 = now). `writes`: the times of the writes in the last HASH_BUDGET.ms, oldest
 * first. A full window waits for its oldest write to leave it; an urgent write (a gesture ended, a click) goes at once
 * otherwise; any other write keeps hashInterval(n) after the last one.
 */
export function hashWriteDelay(now, writes, urgent = false) {
  const n = writes.length;
  if (n >= HASH_BUDGET.calls) return Math.max(1, writes[0] + HASH_BUDGET.ms - now);
  if (urgent || !n) return 0;
  return Math.max(0, writes[n - 1] + hashInterval(n) - now);
}
/** The view of a fresh page (the renderer's default): no view key in the hash. */
export const DEFAULT_VIEW = Object.freeze({ az: 0, el: 55, zoom: 1, roll: 0 });
const ZOOM_LIMITS = [0.5, 3.2];                 // the renderer's (render3d.js ZOOM_MIN / ZOOM_MAX)
const SEED_LIMIT = 1e4;                         // a seed further out is no seed anybody dragged to
const NUM_RE = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;   // a plain decimal: no exponent, no +, no hex, no Infinity
const DEG = 180 / Math.PI;

function urlNumber(s) { return typeof s === 'string' && NUM_RE.test(s) ? Number(s) : NaN; }
function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
/** An angle in degrees, in (-180, 180]. */
function wrap180(a) { let r = ((a + 180) % 360 + 360) % 360 - 180; if (r <= -180) r += 360; return r; }
/** v rounded to `digits` decimals, written without trailing zeros, never "-0", never with an exponent. */
function fmt(v, digits) {
  const k = 10 ** digits;
  let s = (Math.round(v * k) / k).toFixed(digits);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}
/** An angle for the hash: rounded to 0.1 degree, then into (-180, 180] (so 180 and -180 are written the same). */
function fmtAngle(a) { return fmt(wrap180(Math.round(a * 10) / 10), 1); }

/** The group id as the hash writes it: * is %2A (the viewer refuses a raw *). */
export function encodeGroupId(id) { return String(id).replace(/\*/g, '%2A'); }

/**
 * The hash of a state u = { g, pat, cut, seed: [x, y] | null, wavy, t, view: { az, el, zoom, roll } | null }:
 * '#g=<id>' and every other key whose rounded value is not its default (pat: a key of pattern.js PATTERNS, written
 * when it is not DEFAULT_PATTERN; a missing or unknown one is not written). Always matches WRAPPER_HASH.
 */
export function encodeHash(u) {
  const parts = ['g=' + encodeGroupId(u.g)];
  const pat = resolvePattern(u.pat);
  if (pat && pat !== DEFAULT_PATTERN) parts.push('pat=' + pat);
  if (u.cut > 0) parts.push('cut=' + Math.round(u.cut));
  if (u.seed && Number.isFinite(u.seed[0] + u.seed[1])) parts.push('seed=' + fmt(u.seed[0], 4) + '/' + fmt(u.seed[1], 4));
  const w = fmt(clamp01(u.wavy), 2), t = fmt(clamp01(u.t), 3);
  const k = fmt(u.tile === undefined || u.tile === null ? 1 : clamp01(u.tile), 3);
  if (w !== '0') parts.push('wavy=' + w);
  if (k !== '1') parts.push('tile=' + k);
  if (t !== '0') parts.push('t=' + t);
  if (u.view) {
    const az = fmtAngle(u.view.az || 0), el = fmt(Math.max(-90, Math.min(90, u.view.el)), 1);
    const z = fmt(Math.max(ZOOM_LIMITS[0], Math.min(ZOOM_LIMITS[1], u.view.zoom > 0 ? u.view.zoom : 1)), 2), r = fmtAngle(u.view.roll || 0);
    if (!(az === '0' && el === '55' && z === '1' && r === '0')) parts.push('view=' + az + '/' + el + '/' + z + (r === '0' ? '' : '/' + r));
  }
  return '#' + parts.join('&');
}

/**
 * The state a hash asks for, or null when it names none (empty, an unknown group, nothing of ours).
 *   new form  '#g=…&…'  -> { g, legacy: false, cut, seed, wavy, t, view, dropped }: a key that is missing takes its
 *             default (g: DEFAULT_GROUP); a malformed value (not a plain decimal, a cut the group does not have, a
 *             seed or view with the wrong number of parts) is dropped too and named in `dropped`; t and wavy are
 *             clamped to [0, 1], el to [-90, 90], zoom to the renderer's limits, az and roll wrapped into (-180, 180].
 *             Keys are case-insensitive, the first of two equal keys wins, unknown keys are ignored.
 *   legacy    '#<id>' (#333, #4*2, #*632, #%2A632, #s632, #∗632, #22X …) -> { g, legacy: true, …defaults }
 */
export function decodeHash(raw) {
  let h = raw == null ? '' : String(raw);
  if (h[0] === '#') h = h.slice(1);
  if (!h.trim()) return null;
  const base = (g, legacy) => ({ g, legacy, pat: DEFAULT_PATTERN, cut: 0, seed: null, wavy: 0, tile: 1, t: 0, view: null, dropped: [] });
  if (!h.includes('=')) {
    const g = resolveGroupId(safeDecode(h));
    return g ? base(g, true) : null;
  }
  const kv = new Map();
  for (const part of h.split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = safeDecode(part.slice(0, i)).trim().toLowerCase();
    if (!kv.has(k)) kv.set(k, safeDecode(part.slice(i + 1)).trim());
  }
  if (!HASH_KEYS.some((k) => kv.has(k))) return null;
  let g = DEFAULT_GROUP;
  if (kv.has('g')) { g = resolveGroupId(kv.get('g')); if (!g) return null; }
  const out = base(g, false), group = BY_ID[g];
  const drop = (k) => { out.dropped.push(k); };
  if (kv.has('pat')) { const k = resolvePattern(kv.get('pat')); if (k) out.pat = k; else drop('pat'); }
  if (kv.has('cut')) {
    const s = kv.get('cut'), c = /^\d{1,3}$/.test(s) ? Number(s) : -1;
    if (c >= 0 && c < group.presets.length) out.cut = c; else drop('cut');
  }
  if (kv.has('seed')) {
    const p = kv.get('seed').split('/'), x = urlNumber(p[0]), y = urlNumber(p[1]);
    if (p.length === 2 && Math.abs(x) <= SEED_LIMIT && Math.abs(y) <= SEED_LIMIT) out.seed = [x, y]; else drop('seed');
  }
  if (kv.has('wavy')) { const a = urlNumber(kv.get('wavy')); if (Number.isFinite(a)) out.wavy = clamp01(a); else drop('wavy'); }
  if (kv.has('tile')) { const a = urlNumber(kv.get('tile')); if (Number.isFinite(a)) out.tile = clamp01(a); else drop('tile'); }
  if (kv.has('t')) { const t = urlNumber(kv.get('t')); if (Number.isFinite(t)) out.t = clamp01(t); else drop('t'); }
  if (kv.has('view')) {
    const p = kv.get('view').split('/').map(urlNumber);
    if ((p.length === 3 || p.length === 4) && p.every(Number.isFinite)) {
      out.view = { az: wrap180(p[0]), el: Math.max(-90, Math.min(90, p[1])), zoom: Math.max(ZOOM_LIMITS[0], Math.min(ZOOM_LIMITS[1], p[2])), roll: p.length === 4 ? wrap180(p[3]) : 0 };
    } else drop('view');
  }
  return out;
}

function qMul(a, b) {                           // a ∘ b (b first), as render3d.js
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
/** The angle in degrees between the orientations of two unit quaternions (exact for small angles too). */
export function viewAngle(a, b) {
  const r = qMul([-a[0], -a[1], -a[2], a[3]], b);
  return 2 * Math.atan2(Math.hypot(r[0], r[1], r[2]), Math.abs(r[3])) * DEG;
}

/**
 * A renderer view { q, zoom } (q: world -> camera, render3d.js) as the hash writes it: { az, el, zoom, roll } with
 * q = Rz(roll) ∘ viewFromAzEl(az, el).q, Rz a turn about the line of sight. az and el say where the eye is (as
 * R.setView({ az, el }) takes them); roll is what a free trackball adds. Looking straight down or up, az is 0.
 */
export function viewToUrl(v) {
  if (!v || !v.q || v.q.length !== 4) return { ...DEFAULT_VIEW };
  let [x, y, z, w] = v.q;
  const n = Math.hypot(x, y, z, w);
  if (!(n > 0) || !Number.isFinite(n)) return { ...DEFAULT_VIEW };
  x /= n; y /= n; z /= n; w /= n;
  const dx = 2 * (x * z - w * y), dy = 2 * (y * z + w * x), dz = 1 - 2 * (x * x + y * y);   // the eye's direction
  const el = Math.asin(Math.max(-1, Math.min(1, dz))) * DEG;
  const az = Math.hypot(dx, dy) < 1e-9 ? 0 : Math.atan2(dx, -dy) * DEG;
  const qa = viewFromAzEl(az, el).q;
  const r = qMul([x, y, z, w], [-qa[0], -qa[1], -qa[2], qa[3]]);                             // = Rz(roll)
  const roll = 2 * Math.atan2(r[2], r[3]) * DEG;
  return { az: wrap180(az), el, zoom: v.zoom > 0 ? v.zoom : 1, roll: wrap180(roll) };
}
/** The inverse of viewToUrl: { az, el, zoom, roll } -> { q, zoom } for R.setView. */
export function viewFromUrl(u) {
  const qa = viewFromAzEl(u.az || 0, Number.isFinite(u.el) ? u.el : 55).q, h = ((u.roll || 0) / DEG) / 2;
  const q = qMul([0, 0, Math.sin(h), Math.cos(h)], qa);
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return { q: q.map((c) => c / n), zoom: u.zoom > 0 ? u.zoom : 1 };
}

// ---- presets, page attributes, surface colours ----------------------------------------------------------------

/**
 * What choosing preset i of a group sets (SPEC 8 C3): the seed, the metric, and the anchor = preset.anchor ?? preset.seed.
 * i is rounded and clamped to the presets the group has.
 */
export function presetState(group, i) {
  const k = Math.max(0, Math.min(group.presets.length - 1, Math.round(Number(i)) || 0));
  const p = group.presets[k];
  const a = p.anchor && p.anchor.length >= 2 && Number.isFinite(+p.anchor[0]) && Number.isFinite(+p.anchor[1]) ? p.anchor : p.seed;
  return { presetIndex: k, cutIndex: k, seed: [p.seed[0], p.seed[1]], metric: p.metric ? p.metric.slice() : undefined, anchor: [+a[0], +a[1]] };
}

/** The features of a group for #app[data-features] (SPEC 8 C1), in this order. */
export const FEATURES = ['seams', 'mirrors', 'cones', 'corners', 'double'];
/**
 * Which of FEATURES the group has, read off its orbifold symbol: seams = the tile has glued edges (every group but
 * the four kaleidoscopes); mirrors = a * in the symbol; cones = digits before the *; corners = digits after it;
 * double = the closed shape crosses itself (the Klein bottle xx and the cross-cap 22x).
 */
export function groupFeatures(group) {
  const id = group.id, star = id.indexOf('*');
  const before = star < 0 ? id : id.slice(0, star), after = star < 0 ? '' : id.slice(star + 1);
  const has = {
    seams: group.fold !== 'snowflake', mirrors: star >= 0, cones: /[2-9]/.test(before), corners: /[2-9]/.test(after),
    double: group.fold === 'klein' || group.fold === 'crosscap',
  };
  return FEATURES.filter((f) => has[f]);
}

/**
 * How far the surface colours are swapped at t, in [0, 1] (SPEC 8 C3, SPEC 9 C3 addition): fold.mirroredAt(t) when
 * the fold has it (** : 0 until its page turn nears edge-on, 1 after it), else 1 at every t for fold.mirrored === true
 * (its tile lies an odd number of mirrors away from the anchor, so its paper ends up turned over in the closed shape),
 * else 0. Anything that is not a number counts as 0.
 */
export function surfaceMix(fold, t = 1) {
  if (!fold) return 0;
  if (typeof fold.mirroredAt === 'function') return clamp01(fold.mirroredAt(clamp01(t)));
  return fold.mirrored === true ? 1 : 0;
}

/**
 * The renderer's surface colours for a fold at t: front and back blended by surfaceMix(fold, t), so the folded shape
 * keeps its colours when the cut is dragged across a mirror, and a page that turns over changes colour while it is
 * edge-on, never with a jump. Exact at a mix of 0 and 1.
 */
export function surfaceStyle(fold, t = 1) {
  const m = surfaceMix(fold, t);
  const mix = (a, b) => a.map((c, i) => c * (1 - m) + b[i] * m);
  return { front: mix(SURFACE_FRONT, SURFACE_BACK), back: mix(SURFACE_BACK, SURFACE_FRONT) };
}

/**
 * The same for a printed sheet (pattern.js): { printFront: [light, dark], printBack: [light, dark] }, the paper's two
 * sides blended by surfaceMix(fold, t), so a tile that lies an odd number of mirrors from the anchor shows the closed
 * shape in the same colours as its neighbour does.
 */
export function printStyle(fold, t = 1) {
  const m = surfaceMix(fold, t);
  const mix = (a, b) => a.map((c, i) => c * (1 - m) + b[i] * m);
  return {
    printFront: [mix(PRINT_FRONT_RGB[0], PRINT_BACK_RGB[0]), mix(PRINT_FRONT_RGB[1], PRINT_BACK_RGB[1])],
    printBack: [mix(PRINT_BACK_RGB[0], PRINT_FRONT_RGB[0]), mix(PRINT_BACK_RGB[1], PRINT_FRONT_RGB[1])],
  };
}

/**
 * The words over the fold pane at t for a fold that re-cuts first (fold.recut), '' otherwise: on the flat tile what
 * Fold will do; while a piece moves, which one and by which element of the group; while the home tile folds, why it
 * was re-cut. `short`: the short words (a phone).
 */
export function foldCaption(fold, t, short = false) {
  const R = fold && fold.recut;
  if (!R || !(R.movers > 0) || typeof fold.stage !== 'function') return '';
  const st = fold.stage(clamp01(t)), name = R.home.name;
  if (st.stage === 'flat') return short ? `re-cut into the ${name} first` : `Fold re-cuts the tile into the ${name} (dotted) first`;
  if (st.stage === 'recut') return short ? `re-cut ${st.piece}/${st.of}: ${st.text.replace(/^a /, '').replace(/:.*$/, '')}` : `re-cut, piece ${st.piece} of ${st.of}: ${st.text}`;
  if (st.stage === 'fold') return short ? `the ${name} folds: nothing passes through` : `the ${name} folds: its cut runs along the double line, so no paper passes through paper`;
  return '';
}

// ---- one label per point of the orbifold ----------------------------------------------------------------------

/**
 * A copy of an orbifold point (a corner of the tile that the group identifies with an earlier one) keeps its dot,
 * but its label fades out while it comes nearer than LABEL_FADE[1] to the nearest earlier copy, and is gone at
 * LABEL_FADE[0] (distances in 3D, in tile sizes): one label per point once the seams close, no pop on the way.
 */
export const LABEL_FADE = [0.12, 0.4];
/** The opacity of a copy's label at distance d (tile sizes) from the nearest earlier copy of its point. */
export function labelFade(d) { return smooth((d - LABEL_FADE[0]) / (LABEL_FADE[1] - LABEL_FADE[0])); }
const ZWSP = '​';      // tags the label text of a copy (invisible), so its opacity can be found (see start())

/**
 * The points of the orbifold among the cone points of a tile: cls[i] is the same number for two points exactly when
 * an element of the group carries one onto the other (r(a) - b is a lattice vector for one of the coset reps r).
 */
export function coneClasses(group, cones) {
  const cls = new Array(cones.length).fill(-1), q = [0, 0], L = [0, 0];
  let k = 0;
  const same = (a, b) => {
    for (const r of group.reps) {
      apply(r, a.x, a.y, q);
      latticeCoords(group, q[0] - b.x, q[1] - b.y, L);
      if (Math.abs(L[0] - Math.round(L[0])) < 1e-6 && Math.abs(L[1] - Math.round(L[1])) < 1e-6) return true;
    }
    return false;
  };
  for (let i = 0; i < cones.length; i++) {
    if (cls[i] >= 0) continue;
    cls[i] = k;
    for (let j = i + 1; j < cones.length; j++) {
      if (cls[j] < 0 && cones[j].order === cones[i].order && !!cones[j].onMirror === !!cones[i].onMirror && same(cones[i], cones[j])) cls[j] = k;
    }
    k++;
  }
  return cls;
}

function nearestSample(pts, x, y) {
  let best = 0, bd = Infinity;
  for (let k = 0, m = pts.length >> 1; k < m; k++) {
    const dx = pts[2 * k] - x, dy = pts[2 * k + 1] - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/**
 * When each copy of the motif on a kaleidoscope's star fades out: for every cell i of fold.mesh.cells a window [a, b]
 * of t, or null (the base tile: its copy rides on the lid, the top sheet over the tile, and stays). Every fold lays
 * its flap on the stack that is already there, and a flap folded along a mirror carries its copies of the pattern
 * exactly onto the copies under it: so the moment a cell's flap first lands, its comma lies a sheet away from another
 * one, and a pile of 2n commas (a ribbon) would build up. The landing copy therefore fades while its flap comes down,
 * from MOTIF_FADE_FROM of the stage in which the cell FIRST moves to the end of that stage (stages = the spans
 * between the fold's stops, one per completed crease). Then every pile shows exactly one comma at every stop, and at
 * t = 1 only the tile's own copy is left. The stage is read off the motion itself (fold.at at the stops), so it does
 * not depend on how the fold module orders its folds.
 */
export function motifFades(fold, size) {
  const cells = (fold.mesh && fold.mesh.cells) || [];
  const ts = (fold.stops || []).map((s) => s.t).filter((t) => t >= 0 && t <= 1).sort((a, b) => a - b);
  if (ts.length < 2) return cells.map(() => null);
  const Fs = ts.map((t) => fold.at(t)), p = [0, 0, 0], q = [0, 0, 0], eps = 1e-6 * size;
  return cells.map((c, i) => {
    if (i === 0 || !c || !Array.isArray(c.poly) || !c.poly.length) return null;
    let x = 0, y = 0;
    for (const v of c.poly) { x += v[0] / c.poly.length; y += v[1] / c.poly.length; }
    for (let k = 0; k + 1 < ts.length; k++) {
      Fs[k](x, y, i, p); Fs[k + 1](x, y, i, q);
      if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) > eps) return [ts[k] + MOTIF_FADE_FROM * (ts[k + 1] - ts[k]), ts[k + 1]];
    }
    return null;
  });
}

/** How much of a motif copy is drawn at t (1 = all of it): 1 before its fade window, 0 after it, smooth inside. */
export function motifFade(fade, t) {
  if (!fade) return 1;
  if (!(fade[1] > fade[0])) return t >= fade[1] ? 0 : 1;
  return 1 - smooth((t - fade[0]) / (fade[1] - fade[0]));
}

let warpCache = null;
function warpFor(group, amp) {
  if (!warpCache || warpCache.group !== group || warpCache.amp !== amp) warpCache = { group, amp, warp: makeWarp(group, amp) };
  return warpCache.warp;
}

/**
 * Everything that does not depend on t: the tile, its mesh, its fold, and the points of every line and marker with
 * the piece each belongs to (so that mapScene only has to push them through fold.at(t)).
 *   group        a Group of groups.js
 *   seed, metric, amp   the cut (seed in straight coordinates; buildDomain clamps it)
 *   anchor       [x, y]: the seed of the preset last chosen (SPEC 7), handed to the fold as opts.anchor; omitted or
 *                malformed = none (the fold then takes anchor = seed). scene.anchor is what the fold was given, or null.
 *   draft        true for the frames of a drag (notes/core-round3.md #12): the tile mesh is core's draft mesh (about half
 *                the triangles, the SAME boundary samples), and a roll fold keeps it (density: false) instead of
 *                building a finer one. scene.draft says so. The still picture is always built without it.
 *   prevDomain   the previous tile of the SAME group, or null: its seams keep their colours (plane.js assignEdgeColors)
 *   pattern      a key of pattern.js PATTERNS. 'comma' (the default HERE, the picture as it was before the prints, which
 *                the tests of the pure half were written for): the comma is cut into the mesh and its outline drawn.
 *                'checker' | 'rings' (the app's default is 'checker'): scene.print is the group's print, no comma.
 *   recut        true (the default, as the app asks): xx and 22x re-cut first (src/folds/recut.js); false: the fold
 *                module's own motion for every tile.
 */
export function buildScene(group, { seed, metric, amp = 0, anchor, draft = false, pattern = 'comma', recut = true } = {}, prevDomain = null) {
  const domain = buildDomain(group, { seed, metric, warp: warpFor(group, clamp01(amp)) });
  assignEdgeColors(domain, prevDomain && prevDomain.group === group ? prevDomain : null);
  draft = draft === true && group.fold !== 'snowflake';
  const tileMesh = group.fold === 'snowflake' ? null : buildMesh(group, domain, { ...foldMeshOptions(group), draft });
  const foldOpts = foldOptions(draft ? { anchor, density: false } : { anchor });
  const fold = createFold(group, domain, tileMesh, recut ? { ...foldOpts, recut: true } : foldOpts);
  const patternKey = resolvePattern(pattern) || 'comma';
  const print = printFor(group, patternKey);
  const comma = !print;
  // the comma filled (tint bit 1, the renderer's `fill`: MOTIF_FILL_3D), every fold — when the pattern is the comma
  if (comma) fold.mesh = motifTintMesh(group, fold.mesh, motifFor(group)) || fold.mesh;
  const M = fold.mesh;                         // the mesh to draw: NOT always the tile mesh (see src/folds/index.js)
  const n = M.n, cellOf = M.cell;
  const size = domain.size || Math.sqrt(group.domainArea);

  // the boundary, one polyline per edge of the tile (a re-cut tile: per run of an edge on one piece)
  const edges = [];
  for (const b of M.boundaryRuns || M.boundary) {
    if (!b || !b.pts || b.pts.length < 4) continue;
    const e = domain.edges[b.edge];
    const mirror = !e || e.kind === 'mirror';
    const color = mirror ? INK_RGB : hexToRgb(classColor(e.color === undefined ? e.cls : e.color));
    edges.push({ edge: b.edge, mirror, color, pts: b.pts, cells: b.cells, out: new Float32Array(3 * (b.pts.length >> 1)) });
  }

  // the creases: each hinge segment, subdivided (the puff bends it), carried by the piece on its far side
  const creases = [];
  for (const c of M.creases || []) {
    if (!c || !c.pts || c.pts.length < 4) continue;
    const xy = new Float64Array(2 * CREASE_SAMPLES);
    for (let k = 0; k < CREASE_SAMPLES; k++) {
      const u = k / (CREASE_SAMPLES - 1);
      xy[2 * k] = (1 - u) * c.pts[0] + u * c.pts[2]; xy[2 * k + 1] = (1 - u) * c.pts[1] + u * c.pts[3];
    }
    creases.push({ xy, cell: c.b != null ? c.b : (c.a != null ? c.a : 0), out: new Float32Array(3 * CREASE_SAMPLES) });
  }

  // the motif: the parts of the pattern's commas that lie in the tile, each point with its piece. A kaleidoscope's
  // star gets the comma of every cell (the image of the tile's under the element that carries the tile there):
  // folded, they all land on one. The tile's own copy rides on the lid, the top sheet over the tile; the copy of
  // every other cell fades as its flap lands (motifFades), so a pile of sheets shows one comma, not a ribbon.
  // Each entry: copy = the cell it is drawn on (0 = the tile), part = which polyline of the tile's motif it copies,
  // fade = its fade window or null.
  const motif = [];
  const base = comma ? motifInTile(group, domain, motifFor(group)) : [];
  const pushMotif = (xy, cells, copy, part, fade) => motif.push({ xy, cells, copy, part, fade, out: new Float32Array(3 * (xy.length >> 1)) });
  if (!comma) { /* a print: no comma */ } else if (group.fold === 'snowflake' && Array.isArray(fold.cellMaps)) {
    const q = [0, 0], fades = motifFades(fold, size);
    fold.cellMaps.forEach((g, i) => {
      base.forEach((pl, part) => {
        const m = pl.length >> 1;
        if (i === 0) { pushMotif(pl, new Uint16Array(m).fill(M.lid != null ? M.lid : 0), 0, part, null); return; }
        const xy = new Float32Array(2 * m);
        for (let k = 0; k < m; k++) { apply(g, pl[2 * k], pl[2 * k + 1], q); xy[2 * k] = q[0]; xy[2 * k + 1] = q[1]; }
        pushMotif(xy, new Uint16Array(m).fill(i), i, part, fades[i] || null);
      });
    });
  } else {
    const one = M.cells.length <= 1 || typeof M.locate !== 'function';
    base.forEach((pl, part) => {
      const m = pl.length >> 1, cells = new Uint16Array(m);
      if (!one) for (let k = 0; k < m; k++) cells[k] = M.locate(pl[2 * k], pl[2 * k + 1]);
      if (!M.recut) { pushMotif(pl, cells, 0, part, null); return; }
      // a re-cut tile: the outline is cut where it passes from one piece to the next (they come apart on the way)
      let from = 0;
      for (let k = 1; k <= m; k++) {
        if (k < m && M.cells[cells[k]].part === M.cells[cells[from]].part) continue;
        if (k - from >= 2) pushMotif(pl.subarray(2 * from, 2 * k), cells.subarray(from, k), 0, part, null);
        from = k;
      }
    });
  }

  // where a re-cut tile is cut (the home tile's rim on the pieces: src/folds/recut.js), each point with its piece
  const cuts = [];
  for (const c of M.cuts || []) {
    if (!c || !c.pts || c.pts.length < 4) continue;
    cuts.push({ pts: c.pts, cells: c.cells, out: new Float32Array(3 * (c.pts.length >> 1)) });
  }

  // the cone points: they lie on the boundary; each takes the piece of the nearest boundary sample
  const cones = (domain.conePoints || []).map((c) => {
    let cell = 0, bd = Infinity;
    for (const e of edges) {
      if (!e.cells) continue;
      const k = nearestSample(e.pts, c.x, c.y), d = Math.hypot(e.pts[2 * k] - c.x, e.pts[2 * k + 1] - c.y);
      if (d < bd) { bd = d; cell = e.cells[k]; }
    }
    if (bd === Infinity && typeof M.locate === 'function') cell = M.locate(c.x, c.y);
    return { x: c.x, y: c.y, cell, order: c.order, onMirror: !!c.onMirror, label: (c.onMirror ? '∗' : '') + c.order, p: [c.x, c.y, 0] };
  });
  // which of them are one point of the orbifold (the first copy of each carries the label; see sceneMarkers)
  coneClasses(group, cones).forEach((k, i) => { cones[i].cls = k; });

  return {
    group, domain, tileMesh, fold, M, n, cellOf, size, anchor: foldOpts.anchor || null, draft,
    pattern: patternKey, print, cuts,
    pos: new Float32Array(3 * n), edges, creases, motif, cones,
    stops: fold.stops, duration: fold.duration, star: fold.star || null,
    axis: [], frame: null, nonFinite: 0, t: -1, pairs: null,
  };
}

/** Whatever a fold calls a polyline -> [Float32Array(3k), ...] (klein: a list of arrays; cross-cap: one array, empty at first). */
function toPolylines(v) {
  if (!v) return [];
  if (ArrayBuffer.isView(v)) return v.length >= 6 ? [v] : [];
  if (Array.isArray(v)) {
    if (!v.length) return [];
    if (typeof v[0] === 'number') return v.length >= 6 ? [Float32Array.from(v)] : [];
    return v.flatMap(toPolylines);
  }
  return v.points ? toPolylines(v.points) : [];
}

/**
 * Push the scene through fold.at(t): fills scene.pos, every line's `out`, every cone's `p`, scene.axis (the double
 * line, if the fold has one) and scene.frame = the bounding sphere of the positions. A point the fold returns as
 * NaN / Infinity is left at its flat place and counted in scene.nonFinite.
 */
export function mapScene(scene, t) {
  t = clamp01(t);
  const F = scene.fold.at(t);
  const out = [0, 0, 0];
  const { M, n, cellOf, pos } = scene, xy = M.xy;
  let bad = 0;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let v = 0, j = 0, k = 0; v < n; v++, j += 2, k += 3) {
    const x = xy[j], y = xy[j + 1];
    out[0] = out[1] = out[2] = NaN;
    F(x, y, cellOf[v], out);
    let px = out[0], py = out[1], pz = out[2];
    if (!Number.isFinite(px + py + pz)) { bad++; px = x; py = y; pz = 0; }
    pos[k] = px; pos[k + 1] = py; pos[k + 2] = pz;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
    if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let r2 = 0;
  for (let k = 0; k < 3 * n; k += 3) {
    const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = pos[k + 2] - cz, d = dx * dx + dy * dy + dz * dz;
    if (d > r2) r2 = d;
  }
  scene.frame = n ? { center: [cx, cy, cz], radius: Math.sqrt(r2) || scene.size } : null;

  const put = (x, y, cell, arr, o) => {
    out[0] = out[1] = out[2] = NaN;
    F(x, y, cell, out);
    if (!Number.isFinite(out[0] + out[1] + out[2])) { bad++; out[0] = x; out[1] = y; out[2] = 0; }
    arr[o] = out[0]; arr[o + 1] = out[1]; arr[o + 2] = out[2];
  };
  for (const e of scene.edges) {
    const p = e.pts, c = e.cells;
    for (let k = 0, m = p.length >> 1; k < m; k++) put(p[2 * k], p[2 * k + 1], c ? c[k] : 0, e.out, 3 * k);
  }
  for (const c of scene.creases) for (let k = 0; k < CREASE_SAMPLES; k++) put(c.xy[2 * k], c.xy[2 * k + 1], c.cell, c.out, 3 * k);
  for (const m of scene.motif) {
    const p = m.xy, c = m.cells;
    for (let k = 0, q = p.length >> 1; k < q; k++) put(p[2 * k], p[2 * k + 1], c[k], m.out, 3 * k);
  }
  for (const c of scene.cones) put(c.x, c.y, c.cell, c.p, 0);
  for (const c of scene.cuts || []) {
    const p = c.pts, cl = c.cells;
    for (let k = 0, q = p.length >> 1; k < q; k++) put(p[2 * k], p[2 * k + 1], cl[k], c.out, 3 * k);
  }

  scene.axis = [];
  if (typeof scene.fold.doubleLine === 'function') {
    for (const pl of toPolylines(scene.fold.doubleLine(t))) {
      let ok = true;
      for (let i = 0; i < pl.length; i++) if (!Number.isFinite(pl[i])) { ok = false; break; }
      if (ok) scene.axis.push(pl); else bad++;
    }
  }
  scene.nonFinite = bad;
  scene.t = t;
  return scene;
}

/**
 * When the creases of a fold fade: [from, to] in t. The cross-cap's window follows the fold's own times
 * (fold.times, src/folds/crosscap.js crosscapTimes: a cut without a crease to fold, the Bowl, has its flaps done at
 * 0.17 and its middle stop at 0.22, not 0.42 and 0.49): from half the time its flaps take to its middle stop
 * (notes/crosscap-round3.md). The times depend on the anchor alone, so a drag never moves the window. Other folds,
 * and a cross-cap without usable times, take CREASE_FADE.
 */
export function creaseFade(foldType, fold) {
  const T = foldType === 'crosscap' && fold && fold.times;
  if (T && Number.isFinite(T.hingeEnd) && Number.isFinite(T.halfEnd) && T.hingeEnd > 0 && T.halfEnd > 0.5 * T.hingeEnd && T.halfEnd <= 1) return [0.5 * T.hingeEnd, T.halfEnd];
  return CREASE_FADE[foldType] || null;
}

/** Opacity of the creases at time t (1 while the tile is being bent there, 0 when the fold is complete). */
export function creaseAlpha(foldType, t, fold) {
  const f = creaseFade(foldType, fold);
  if (!f) return 1;
  return 1 - smooth((t - f[0]) / (f[1] - f[0]));
}

/**
 * The lines of the mapped scene for R.setLines, bottom to top: creases, motif, the cut edges in their seam colours,
 * the mirror edges in ink, and last the line of self-intersection of the two shapes that have one (thin, dashed, ink:
 * with the default cuts a closed seam lies exactly on it, and the dashes then sit on the seam's colour). `k` scales
 * the widths (see lineScale).
 */
export function sceneLines(scene, k = 1) {
  const lines = [], thin = Math.max(k, 0.85);
  // (a fold that re-cuts first says itself when its creases show: none before the home tile begins to fold)
  const ca = typeof scene.fold.creaseAlpha === 'function' ? scene.fold.creaseAlpha(scene.t) : creaseAlpha(scene.group.fold, scene.t, scene.fold);
  if (ca > 0.004) for (const c of scene.creases) lines.push({ points: c.out, color: CREASE_RGB, width: WIDTHS.crease * thin, alpha: ca, dashed: true, xray: 0.5 });
  // where a re-cut tile is cut: dashed on the flat tile, the pieces' own edges on the way, faint once the fold closes them
  if (scene.cuts && scene.cuts.length && typeof scene.fold.cutStyle === 'function') {
    const cs = scene.fold.cutStyle(scene.t);
    if (cs && cs.alpha > 0.004) for (const c of scene.cuts) lines.push({ points: c.out, color: CUT_RGB, width: WIDTHS.cut * cs.width * thin, alpha: cs.alpha, dashed: !!cs.dashed, xray: 0.45 });
  }
  for (const m of scene.motif) {
    const a = MOTIF_ALPHA * motifFade(m.fade, scene.t);       // a kaleidoscope's landed copies fade out (motifFades)
    if (a > 0.004) lines.push({ points: m.out, color: MOTIF_RGB, width: WIDTHS.motif * thin, alpha: a, xray: 0.3 });
  }
  for (const e of scene.edges) if (!e.mirror) lines.push({ points: e.out, color: e.color, width: WIDTHS.edge * k, xray: EDGE_XRAY });
  // a kaleidoscope's outline IS the orbifold: a flap passing in front of it (the last fold's hinge, a landing flap's
  // far edge) must not turn a side grey for a moment (finding 5; notes/snowflake-round3.md)
  const mx = scene.group.fold === 'snowflake' ? KALEIDO_EDGE_XRAY : EDGE_XRAY;
  for (const e of scene.edges) if (e.mirror) lines.push({ points: e.out, color: e.color, width: WIDTHS.edge * k, xray: mx });
  // the cross-cap's double line (it is what tells a cross-cap from a pillow) and the Klein bottle's glide axes, which
  // become its double circle
  for (const p of scene.axis) lines.push({ points: p, color: INK_RGB, width: WIDTHS.axis * thin, dashed: true, xray: 0.7 });
  return lines;
}

/**
 * The cone points of the mapped scene for R.setMarkers: a dot labelled with its order; a ring labelled ∗n for a
 * corner on the mirror boundary. One label per point of the orbifold: the first cone point of each class
 * (coneClasses) is always labelled; a later copy of the same point keeps its dot, while its label fades with its
 * distance d to the nearest earlier copy (labelFade(d / size): full beyond LABEL_FADE[1], none below LABEL_FADE[0],
 * continuous in t) and is left out once it is gone (label ''); a copy that has met an earlier one (within 2e-3 tile
 * sizes: the seams are closed) is merged into it. The copies come after the first copies in the list; their label
 * text carries an invisible tag (U+200B, one more per cone index) and `labelAlpha` says how strong it is drawn.
 */
export function sceneMarkers(scene, k = 1) {
  const eps = 2e-3 * scene.size, first = [], later = [];
  const cones = scene.cones;
  for (let i = 0; i < cones.length; i++) {
    const c = cones[i];
    let d = Infinity;
    for (let j = 0; j < i; j++) {
      const o = cones[j];
      if (o.cls === c.cls) d = Math.min(d, Math.hypot(o.p[0] - c.p[0], o.p[1] - c.p[1], o.p[2] - c.p[2]));
    }
    if (d < eps) continue;                                     // on an earlier copy: one marker
    const m = { p: [c.p[0], c.p[1], c.p[2]], color: MARK_RGB, size: (c.onMirror ? 12 : 11) * Math.max(k, 0.8), shape: c.onMirror ? 'ring' : 'dot', label: c.label };
    if (d === Infinity) { first.push(m); continue; }
    const a = labelFade(d / scene.size);
    m.labelAlpha = a;
    m.label = a < 0.02 ? '' : c.label + ZWSP.repeat(i + 1);
    later.push(m);
  }
  return first.concat(later);
}

/**
 * The colour of the secondary tiles of a kaleidoscope's star (the renderer's `ghost`, tint bit 0) at the scene's t.
 * They are grey while the star is being folded, so the tile stands out among its mirror images; during the last fold
 * they take the tile's own colour: folded up, every sheet of the stack IS the tile (and the top sheet, which is what
 * one sees, would otherwise leave the finished orbifold grey). Only a star has secondary tiles; the filled comma is
 * tint bit 1, drawn in the renderer's `fill` colour (MOTIF_FILL_3D, set once in start()), at every t.
 */
export function ghostColor(scene) {
  if (scene.group.fold !== 'snowflake') return SURFACE_GHOST;
  const s = ghostEase(scene);
  return SURFACE_GHOST.map((g, i) => g + (SURFACE_FRONT[i] - g) * s);
}
/** How far a star's secondary tiles have become the tile itself at the scene's t: 0 until the last fold, 1 at its end. */
export function ghostEase(scene) {
  if (scene.group.fold !== 'snowflake') return 0;
  const stops = scene.stops, from = stops.length > 2 ? stops[stops.length - 2].t : 0.5;
  return smooth((scene.t - from) / (1 - from));
}
/**
 * What the plane is told of a re-cut (plane.js setScene({ recut })): { name, home: [[x, y], ...] the home tile,
 * cuts: [Float32Array, ...] where the tile is cut, active }, or null when the fold does not re-cut (no piece moves).
 * active (with a time t): the piece that is being carried at t, { part, from: its outline on the tile, to: where it
 * lands in the home tile }, so the plane can show which part of the tile the 3D pane is moving, and where to; null
 * when no piece moves at t (or no t is given).
 */
export function planeRecut(scene, t = null) {
  const R = scene && scene.fold && scene.fold.recut;
  if (!R || !(R.movers > 0)) return null;
  return { name: R.home.name, home: R.home.poly, cuts: (scene.M.cuts || []).map((c) => c.pts), active: t === null ? null : recutActive(scene, t) };
}
/** The piece of a re-cut tile that is carried at t: { part, from, to } (plane polygons), or null. */
export function recutActive(scene, t) {
  const fold = scene && scene.fold, R = fold && fold.recut;
  if (!R || !(R.movers > 0) || typeof fold.stage !== 'function') return null;
  const st = fold.stage(clamp01(t));
  if (st.stage !== 'recut') return null;
  const p = R.pieces.find((q) => q.part === st.part);
  if (!p || !p.poly || p.poly.length < 3) return null;
  const g = p.element;
  return { part: p.part, from: p.poly, to: p.poly.map((q) => [g.a * q[0] + g.b * q[1] + g.tx, g.c * q[0] + g.d * q[1] + g.ty]) };
}

/** Seconds the zoom takes to glide back to 1 after a group change (as long as the renderer's own reset glide). */
export const ZOOM_HOME_SECONDS = 0.35;

/**
 * The zoom of the glide from z0 to z1 at progress u in [0, 1]: even steps in log zoom (a zoom out reads as steady),
 * eased in and out (smoothstep), exactly z0 at u = 0 and z1 at u = 1, never past either.
 */
export function zoomBetween(z0, z1, u) {
  if (!(u > 0)) return z0;
  if (u >= 1) return z1;
  return Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * smooth(u));
}

/** The words of the hint over the plane (the template's #hint holds the same). */
export const HINT_TEXT = 'drag to move the cut';
/**
 * The hint over the plane for a group: { text, hidden }. "drag to move the cut" until the person's first drag. The
 * kaleidoscopes have nothing to cut: no hint (SPEC 8 C1; the static #cut-note under the plane says what Fold does).
 */
export function hintState(group, dragged) {
  return { text: HINT_TEXT, hidden: !!(group && group.fold === 'snowflake') || !!dragged };
}

/** Widths follow the pane as the plane view's do: 1 at 520 px, down to 0.72 on a phone, up to 1.1. */
export function lineScale(cssW, cssH) {
  const m = Math.min(cssW || 520, cssH || 520);
  return Math.max(0.72, Math.min(1.1, m / 520));
}

/**
 * The largest distance between the images of glued boundary points at the scene's current t, in tile sizes
 * (SPEC 5.3, requirement 2, wants it below 1e-6 at t = 1); null when the tile has no cut edge.
 */
export function seamGap(scene) {
  const { domain, fold, M } = scene;
  if (!scene.pairs) {
    const byEdge = new Map(M.boundary.map((b) => [b.edge, b]));
    const pairs = [], q = [0, 0];
    domain.edges.forEach((e, i) => {
      if (e.kind !== 'cut' || e.partner < i) return;          // each seam once; a half-turn edge is its own partner
      const bi = byEdge.get(i), bj = byEdge.get(e.partner);
      if (!bi || !bj || !bi.cells || !bj.cells) return;
      const m = bi.pts.length >> 1, gi = inverse(e.g);
      const P = { m, a: new Float64Array(2 * m), b: new Float64Array(2 * m), ca: new Uint16Array(m), cb: new Uint16Array(m) };
      for (let k = 0; k < m; k++) {
        const x = bi.pts[2 * k], y = bi.pts[2 * k + 1];
        apply(gi, x, y, q);
        P.a[2 * k] = x; P.a[2 * k + 1] = y; P.ca[k] = bi.cells[k];
        P.b[2 * k] = q[0]; P.b[2 * k + 1] = q[1]; P.cb[k] = bj.cells[nearestSample(bj.pts, q[0], q[1])];
      }
      pairs.push(P);
    });
    scene.pairs = pairs;
  }
  if (!scene.pairs.length) return null;
  const F = fold.at(clamp01(scene.t)), u = [0, 0, 0], v = [0, 0, 0];
  let gap = 0;
  for (const P of scene.pairs) {
    for (let k = 0; k < P.m; k++) {
      F(P.a[2 * k], P.a[2 * k + 1], P.ca[k], u);
      F(P.b[2 * k], P.b[2 * k + 1], P.cb[k], v);
      const d = Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
      if (!(d <= gap)) gap = d;                                // NaN shows
    }
  }
  return gap / scene.size;
}

// ---------------------------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------------------------

/** Degrees the 3D view must turn under the person's hand before the "drag to turn" hint goes. */
export const TURN_MIN_DEG = 2;
/**
 * The replication's frame on a phone (the final fix, 10 Nov 2026: findings 2 and 6). While the step's bar is open on
 * a plane pane whose short side is under CAPTION_SMALL, the plane frames the tile and its first layer between the
 * words at the pane's head and the bar at its foot (plane.js setStepFrame): STEP_INSETS css px are theirs (the words:
 * 6 px from the top, 21 px high; the bar: 2 px from the bottom, 44 px high; a few px of air each).
 */
export const STEP_INSETS = Object.freeze({ top: 30, bottom: 48 });

function start(doc, win) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    app: $('app'), chip: $('chip'), chipSymbol: $('chip-symbol'), chipMeta: $('chip-meta'), caption: $('caption'),
    planeCanvas: $('plane-canvas'), hint: $('hint'), presets: $('presets'), wavy: $('wavy'),
    foldCanvas: $('fold-canvas'), foldLabels: $('fold-labels'), foldBtn: $('fold-btn'), scrubber: $('scrubber'),
    resetView: $('reset-view'), pickerMount: $('picker-mount'),
  };
  const missing = Object.entries(el).filter(([, node]) => !node).map(([k]) => k);
  if (missing.length) throw new Error('The Folding: the page lacks ' + missing.join(', '));
  const turnHint = $('turn-hint');                // the shell's "drag to turn" (SPEC 8 C1); the page works without it
  // the replication step: the Tile button, its scrubber, the words for what acts; the page works without them
  const tileEl = { bar: $('tile-bar'), btn: $('tile-btn'), slider: $('tile-slider'), caption: $('tile-caption') };
  // the pattern selector and the words over the fold pane (13 Nov 2026); the page works without them
  const patEl = { box: $('pattern-box'), select: $('pattern'), label: $('pattern-label') }, foldCap = $('fold-caption');

  const state = { groupId: null, presetIndex: 0, cutIndex: 0, seed: [0, 0], metric: undefined, amp: 0, t: 0, anchor: null, tile: 1, pattern: DEFAULT_PATTERN };
  const errors = [];
  let scene = null;
  let dragged = false;              // the person has moved the cut once: "drag to move the cut" has done its job
  let lastError = '';
  let ghostKey = '';                // the ghost colour the renderer was last given (see ghostColor)
  let surfaceKey = '';              // the front colour the renderer was last given (surfaceStyle: follows t)
  let turned = false;               // the person has turned the 3D view: "drag to turn" is gone for good
  let turnFrom = null;              // the view when the person last put a hand on the 3D view (null: a script moved it)
  const counters = { rebuilds: 0, draws: 0, hashWrites: 0, hashPosts: 0 };   // for the QA

  function report(where, e) {
    const text = where + ': ' + (e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' | ') : String(e));
    if (text !== lastError) { console.error('The Folding — ' + text); lastError = text; }
    if (errors.length < 50) errors.push(text);
  }

  // ---- the parts ------------------------------------------------------------------------------------------------
  const R = createRenderer(el.foldCanvas, { labelLayer: el.foldLabels });
  R.setStyle({ fill: MOTIF_FILL_3D });             // tint bit 1: the comma filled into the sheet (motifTintMesh)
  const P = createPlaneView(el.planeCanvas, { onSeed, hint: false, onTilingPlan: (info) => tilePlanChanged(info) });     // the shell's #hint is the one hint
  const later = typeof win.queueMicrotask === 'function' ? (f) => win.queueMicrotask(f) : (f) => Promise.resolve().then(f);
  const timeline = createTimeline({
    slider: el.scrubber, button: el.foldBtn,
    onChange: (t) => { state.t = t; drawFold(false); scheduleHash(); },
    // a play has ended or been paused: write the URL once the frame's last t is in (onState comes before onChange)
    onState: (st) => { if (st !== 'pause') later(flushHash); },
  });
  const picker = createHassePicker({ mount: el.pickerMount, groups: GROUPS, onPick: (id) => { setGroup(id); flushHash(); } });

  // ---- the replication step (10 Nov 2026, qa/rep-judge.md; src/replicate.js, plane.js renderTiling) -------------
  // state.tile = u in [0, 1]: how far the copies of the tile have been made (1 = the tiling as always). It has its own
  // timeline (the scrubber in the plane's bar, magnets at the end of every layer; Space stays with Fold) and its own
  // button: Tile plays on from where it is, or, when the tiling is complete, fades the copies out (REPLAY_FADE s) and
  // makes them again from the tile alone; Pause pauses. The bar shows its scrubber while u < 1 or while it plays,
  // and folds away BAR_LINGER ms after the end. A group change completes it (u = 1); a cut, a preset or Wavy keep u
  // (the plane plans the new tile's copies; a drag or a wave also keeps the length, so u keeps its moment: plane.js
  // preparePlan). The hash carries u as tile=<u> when it is not 1. On a phone's plane (short side under CAPTION_SMALL)
  // the plane frames the first layer between the words and the bar while the bar is open (syncStepFrame).
  const REPLAY_FADE = 0.35, BAR_LINGER = 1400;
  let tileFade = 0, fadeRaf = 0, barTimer = 0;
  const tileTL = tileEl.slider ? createTimeline({
    slider: tileEl.slider, button: null, keyTarget: null,
    onChange: (u) => { state.tile = u; showTile(); scheduleHash(); },
    onState: (st) => { syncTileBar(); if (st !== 'pause') later(flushHash); },
  }) : null;
  if (tileTL) tileTL.set(1);
  // the magnets: the end of a layer, but never closer than TILE_STOP_GAP of the track to the last one kept or to the
  // end (a kaleidoscope's 12 layers on a phone's 100 px track would leave no stretch without a detent)
  const TILE_STOP_GAP = 0.08;
  function tilePlanChanged(info) {
    if (!tileTL || !info) return;
    tileTL.setDuration(info.duration);
    const kept = [];
    let last = 0;
    for (const s of info.stops) if (s.t >= last + TILE_STOP_GAP && s.t <= 1 - TILE_STOP_GAP) { kept.push(s); last = s.t; }
    tileTL.setStops(kept);                                   // (the timeline adds 0 and 1)
    syncCaption();
  }
  function tileOpen() { return tilePlaying() || state.tile < 1 - 1e-4; }
  function stopFade() { if (fadeRaf) { win.cancelAnimationFrame(fadeRaf); fadeRaf = 0; } tileFade = 0; }
  function tilePlaying() { return !!fadeRaf || (tileTL ? tileTL.isPlaying() : false); }
  function showTile() { P.setTiling(state.tile, tileFade); P.render(); syncTileBar(); }
  function syncTileButton() {
    if (!tileEl.btn) return;
    const playing = tilePlaying();
    tileEl.btn.dataset.state = playing ? 'pause' : 'play';
    const label = tileEl.btn.querySelector('[data-label]');
    const text = playing ? 'Pause' : 'Tile';
    if (label && label.textContent !== text) label.textContent = text;
    const aria = playing ? 'Pause the tiling' : state.tile < 1 - 1e-4 ? 'Go on making the tiling' : 'Show how the tiling is made';
    if (tileEl.btn.getAttribute('aria-label') !== aria) tileEl.btn.setAttribute('aria-label', aria);
  }
  function syncCaption() {
    if (!tileEl.caption) return;
    const text = tileOpen() ? P.tilingCaption(tileFade > 0 ? 0 : state.tile) : '';
    if (tileEl.caption.textContent !== text) tileEl.caption.textContent = text;
    tileEl.caption.hidden = !text;
  }
  function syncTileBar() {
    if (tileEl.bar) {
      if (tileOpen()) {
        if (barTimer) { win.clearTimeout(barTimer); barTimer = 0; }
        if (!tileEl.bar.hasAttribute('data-open')) tileEl.bar.setAttribute('data-open', '');
      } else if (tileEl.bar.hasAttribute('data-open') && !barTimer) {
        barTimer = win.setTimeout(() => { barTimer = 0; if (!tileOpen()) { tileEl.bar.removeAttribute('data-open'); syncHint(); syncStepFrame(); } }, BAR_LINGER);
      }
    }
    syncStepFrame();
    syncCaption();
    syncHint();
    syncTileButton();
  }
  /** On a phone's plane, while the bar is open, the plane frames the first layer between the words and the bar. */
  function syncStepFrame() {
    if (!P.setStepFrame) return;
    const open = !!(tileEl.bar && tileEl.bar.hasAttribute('data-open'));
    const w = el.planeCanvas.clientWidth, h = el.planeCanvas.clientHeight;
    P.setStepFrame(open && w > 0 && h > 0 && Math.min(w, h) < CAPTION_SMALL ? STEP_INSETS : null);
  }
  /** The Tile button: pause; or go on from where it is; or, when the tiling is complete, fade the copies and replay. */
  function tileToggle() {
    if (!tileTL) return;
    if (tilePlaying()) {
      if (fadeRaf) { stopFade(); state.tile = 1; tileTL.set(1); showTile(); } else tileTL.stop();
      syncTileBar();
      return;
    }
    if (state.tile < 1 - 1e-4) { tileTL.play(1); syncTileBar(); return; }
    tilePlanChanged(P.tilingPlan());                         // the plan of the tile on screen: the timeline's duration
    let still = false;
    try { still = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* none */ }
    const t0 = win.performance.now();
    const step = () => {
      const x = still ? 1 : Math.min(1, (win.performance.now() - t0) / (REPLAY_FADE * 1000));
      // (the thumb goes back with the fade, so it does not snap from the end to 0 when the copies are made again;
      // finding 14. Silent: u itself stays 1 until the fade is over)
      if (x < 1) { tileFade = x * x * (3 - 2 * x); tileTL.set(1 - tileFade); P.setTiling(1, tileFade); P.render(); fadeRaf = win.requestAnimationFrame(step); return; }
      fadeRaf = 0; tileFade = 0;
      state.tile = 0; tileTL.set(0); P.setTiling(0, 0); P.render();
      tileTL.play(1);
      syncTileBar();
    };
    tileFade = 1e-4;
    fadeRaf = win.requestAnimationFrame(step);
    syncTileBar();
  }
  if (tileEl.btn) tileEl.btn.addEventListener('click', tileToggle);
  /** The replication's state set from outside (a group change, the URL, the test handle): no play, no fade. */
  function setTileState(u) {
    stopFade();
    if (tileTL) { tileTL.stop(); tileTL.set(clamp01(u)); state.tile = tileTL.get(); } else state.tile = 1;
    P.setTiling(state.tile, 0);
    syncTileBar();
  }

  // ---- drawing --------------------------------------------------------------------------------------------------
  // A copy of an orbifold point carries its label with a tag of n invisible U+200B (sceneMarkers); labelAlpha maps n
  // to the opacity that copy's label is drawn with. The renderer draws labels as spans in the label layer and has no
  // opacity of its own for them, so it is set here, right after each draw and whenever the renderer rewrites a label.
  const labelAlpha = new Map();
  const tagOf = (s) => { let n = 0; while (n < s.length && s.charCodeAt(s.length - 1 - n) === 0x200b) n++; return n; };
  function applyLabelAlpha() {
    const spans = el.foldLabels.getElementsByClassName('r3d-label');
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i], n = tagOf(s.textContent || ''), a = n ? labelAlpha.get(n) : undefined;
      const v = a === undefined || a >= 0.999 ? '' : String(Math.round(a * 1000) / 1000);
      if (s.style.opacity !== v) s.style.opacity = v;
    }
  }
  if (win.MutationObserver) new win.MutationObserver(applyLabelAlpha).observe(el.foldLabels, { childList: true, characterData: true, subtree: true });

  /** Map the scene at state.t and hand it to the renderer. `immediate`: the camera frame jumps instead of easing. */
  function drawFold(immediate, fresh = false) {
    if (!scene) return;
    counters.draws++;
    try {
      mapScene(scene, state.t);
      // the surface colours follow t: a tile whose paper turns over swaps front and back while it does (C3). A print
      // is paper (two-sided, nearly opaque); the comma's sheet is the translucent one
      if (scene.print) {
        const ps = printStyle(scene.fold, state.t), skey = 'print|' + scene.group.id + '|' + scene.pattern + '|' + ps.printFront[0].join();
        if (skey !== surfaceKey) { surfaceKey = skey; R.setStyle({ print: printUniforms(scene.print), printFront: ps.printFront, printBack: ps.printBack, opacity: PRINT_OPACITY }); }
      } else {
        const st = surfaceStyle(scene.fold, state.t), skey = 'plain|' + st.front.join();
        if (skey !== surfaceKey) { surfaceKey = skey; R.setStyle({ front: st.front, back: st.back, print: null, opacity: SURFACE_OPACITY }); }
      }
      if (scene.nonFinite) report(`fold ${scene.group.id} at t = ${state.t}`, `${scene.nonFinite} points are not finite (drawn flat)`);
      const k = lineScale(el.foldCanvas.clientWidth, el.foldCanvas.clientHeight);
      // (uv: every vertex's point of the paper, where the print is evaluated)
      if (fresh) R.setSurface({ positions: scene.pos, indices: scene.M.tri, tint: scene.M.tint && scene.M.tint.length >= scene.n ? scene.M.tint : undefined, uv: scene.M.xy });
      else R.updatePositions(scene.pos);
      if (scene.frame) R.setFrame(scene.frame, immediate);
      // a star's secondary tiles: grey (the comma), or the print seen through a veil of grey, until the last fold
      const ghost = scene.print ? SURFACE_GHOST : ghostColor(scene), mixG = scene.print ? GHOST_PRINT_MIX * (1 - ghostEase(scene)) : 1;
      const gkey = ghost.join() + '|' + mixG.toFixed(4);
      if (gkey !== ghostKey) { ghostKey = gkey; R.setStyle({ ghost, ghostMix: mixG }); }
      R.setLines(sceneLines(scene, k));
      const marks = sceneMarkers(scene, k);
      labelAlpha.clear();
      for (const m of marks) if (m.label && m.labelAlpha !== undefined) labelAlpha.set(tagOf(m.label), m.labelAlpha);
      R.setMarkers(marks);
      R.render();
      applyLabelAlpha();
      syncFoldCaption();
    } catch (e) { report(`drawing ${scene.group.id} at t = ${state.t}`, e); }
  }

  /** The words over the fold pane: what a fold that re-cuts first is doing now (foldCaption); nothing otherwise. And
   *  the plane shows the piece that is being carried, and where it lands (told only when the piece changes). */
  let shownPart = -1;
  const recutPartNow = () => { const a = scene ? recutActive(scene, state.t) : null; return a ? a.part : -1; };
  function syncFoldCaption() {
    const part = recutPartNow();
    if (part !== shownPart) {
      shownPart = part;
      if (P.setRecutActive) { P.setRecutActive(part < 0 ? null : recutActive(scene, state.t)); P.render(); }
    }
    if (!foldCap) return;
    const w = el.foldCanvas.clientWidth || 0;
    const text = scene ? foldCaption(scene.fold, state.t, w > 0 && w < 430) : '';
    if (foldCap.textContent !== text) foldCap.textContent = text;
    foldCap.hidden = !text;
  }

  function drawPlane(now) {
    if (!scene) return;
    try {
      // the kaleidoscopes have nothing to cut: no handle, no drags (SPEC 8 C2)
      P.setScene({ group: scene.group, domain: scene.domain, motif: motifFor(scene.group), star: scene.star || undefined, interactive: scene.group.fold !== 'snowflake',
        print: scene.print || null, recut: planeRecut(scene, state.t) });
      shownPart = recutPartNow();
      if (now) P.render();
    } catch (e) { report(`plane ${scene.group.id}`, e); }
  }

  /**
   * Rebuild tile, mesh and fold from the state; keep t. Returns false (and keeps the old picture) if that fails.
   * `recolour`: number the seams afresh (a named cut always shows in the same colours). Otherwise a seam keeps the
   * colour it had in the tile before, so nothing changes colour under the finger while the cut is dragged or waved.
   * `colourFrom`: a tile of the same group whose seams lend their colours instead (applyUrl: the preset's tile).
   * `draft`: a frame of a drag or of the Wavy slider (buildScene: the draft mesh); the gesture's end builds the full one.
   */
  function rebuild({ immediate = false, recolour = false, colourFrom = null, draft = false } = {}) {
    const group = BY_ID[state.groupId];
    let next;
    try {
      const prev = colourFrom && colourFrom.group === group ? colourFrom : (scene && !recolour ? scene.domain : null);
      next = buildScene(group, { seed: state.seed, metric: state.metric, amp: state.amp, anchor: state.anchor, draft, pattern: state.pattern }, prev);
    } catch (e) { report(`building ${group.id} for the seed ${state.seed}`, e); return false; }
    scene = next;
    counters.rebuilds++;
    syncFeatures();
    // (a tile whose paper ends up turned over: the surface colours follow t, see drawFold)
    timeline.setStops(scene.stops);
    timeline.setDuration(scene.duration);
    drawPlane(true);
    drawFold(immediate, true);
    if (state.tile < 1) syncCaption();                         // the new tile's copies: their words
    return true;
  }

  // ---- the shell ------------------------------------------------------------------------------------------------
  function syncPresets() {
    [...el.presets.children].forEach((chip, i) => chip.setAttribute('aria-pressed', String(i === state.presetIndex)));
  }
  function syncHint() {
    const h = hintState(BY_ID[state.groupId], dragged);
    if (el.hint.textContent !== h.text) el.hint.textContent = h.text;
    // the replication's bar and words take the hint's place while they show
    el.hint.hidden = h.hidden || !!(tileEl.bar && tileEl.bar.hasAttribute('data-open'));
  }
  /** #app[data-features]: the group's (SPEC 8 C1), and `recut` while the tile on screen is re-cut first. */
  function syncFeatures() {
    const group = BY_ID[state.groupId];
    if (!group) return;
    const f = groupFeatures(group);
    if (scene && scene.group === group && planeRecut(scene)) f.push('recut');
    const v = f.join(' ');
    if (el.app.getAttribute('data-features') !== v) el.app.setAttribute('data-features', v);
  }
  /** The selector shows the pattern; #app[data-pattern] names it (the legend and the swatch read it). */
  function syncPattern() {
    if (el.app.getAttribute('data-pattern') !== state.pattern) el.app.setAttribute('data-pattern', state.pattern);
    if (patEl.select && patEl.select.value !== state.pattern) patEl.select.value = state.pattern;
    const P0 = PATTERNS.find((q) => q.key === state.pattern);
    if (patEl.label && P0 && patEl.label.textContent !== P0.label) patEl.label.textContent = P0.label;
    if (patEl.box && P0) patEl.box.title = 'Pattern: ' + P0.label + ' — ' + P0.hint;
  }
  function fillShell(group) {
    el.chipSymbol.textContent = group.label;
    el.chipMeta.textContent = group.hm + ' · ' + group.shape;
    el.chip.setAttribute('aria-label', `Orbifold ${group.label}: ${group.hm}, ${group.shape}. Pick another`);
    el.caption.textContent = group.topology;
    el.presets.replaceChildren(...group.presets.map((p, i) => {
      const chip = doc.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = p.name; chip.title = p.name;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => { setPreset(i); flushHash(); });
      return chip;
    }));
    el.wavy.disabled = group.fold === 'snowflake';          // every edge is a mirror: the wave slides along them, nothing changes
    el.wavy.value = String(state.amp);
    // what the legend and the cut controls show (SPEC 8 C1: styles.css reads these)
    el.app.setAttribute('data-fold', group.fold);
    el.app.setAttribute('data-features', groupFeatures(group).join(' '));
    syncPattern();
  }

  // ---- the URL (SPEC 7): written at most every HASH_THROTTLE_MS, at once when a gesture ends ------------------------
  let inFrame = false;
  try { inFrame = win.parent != null && win.parent !== win; } catch (e) { inFrame = true; }
  let hashTimer = 0, lastPosted = null, lastWritten = null, quiet = 0;
  const writeTimes = [];                               // of the replaceState calls in the last HASH_BUDGET.ms
  const nowMs = () => win.performance.now();
  function currentHash() { try { return win.location.hash || ''; } catch (e) { return ''; } }
  /** What the hash says about the state shown now (encodeHash takes it). */
  function urlState() {
    const group = BY_ID[state.groupId], snow = group.fold === 'snowflake';
    return {
      g: state.groupId, pat: state.pattern, cut: state.cutIndex,
      seed: !snow && state.presetIndex < 0 && scene ? [scene.domain.seed[0], scene.domain.seed[1]] : null,
      wavy: snow ? 0 : state.amp, tile: state.tile, t: state.t, view: viewToUrl(R.getView ? R.getView() : null),
    };
  }
  /** Write the hash of what is shown (and tell the viewer), now or as soon as hashWriteDelay allows. */
  function writeHashNow(urgent = false) {
    if (hashTimer) { win.clearTimeout(hashTimer); hashTimer = 0; }
    if (quiet || !state.groupId || !scene) return;     // in the middle of a change: its end writes
    let h;
    try { h = encodeHash(urlState()); } catch (e) { report('writing the URL', e); return; }
    if (h !== currentHash()) {
      const now = nowMs();
      while (writeTimes.length && now - writeTimes[0] >= HASH_BUDGET.ms) writeTimes.shift();
      const wait = hashWriteDelay(now, writeTimes, urgent);
      if (wait > 0) { hashTimer = win.setTimeout(() => { hashTimer = 0; writeHashNow(urgent); }, wait); return; }
      writeTimes.push(now);
      lastWritten = h;
      counters.hashWrites++;
      try { win.history.replaceState(win.history.state, '', h); }
      catch (e) { try { win.location.replace(h); } catch (e2) { /* a host without a history: the page works without it */ } }
    }
    if (inFrame && h !== lastPosted) {                 // the spacesheep viewer rewrites its address bar on this message
      lastPosted = h;
      counters.hashPosts++;
      try { win.parent.postMessage({ type: 'ss-hash', hash: h }, '*'); } catch (e) { /* nobody to tell */ }
    }
  }
  function scheduleHash() { if (!hashTimer) writeHashNow(false); }
  function flushHash() { writeHashNow(true); }

  // ---- state changes --------------------------------------------------------------------------------------------
  // the only place the anchor is set: a group or a preset is chosen (a drag or the wave never get here)
  function usePreset(group, i) { Object.assign(state, presetState(group, i)); }

  function setGroup(raw) {
    const id = resolveGroupId(raw);
    if (!id) return getState();
    const group = BY_ID[id];
    const before = { ...state, seed: state.seed.slice(), anchor: state.anchor && state.anchor.slice() }, old = scene;
    const changed = id !== state.groupId;
    quiet++;
    try {
      state.groupId = id;
      usePreset(group, 0);
      state.t = 0;
      if (changed) setTileState(1);                             // another pattern: shown tiled, as always
      scene = null;                                             // seams of another group lend no colours
      timeline.set(0);
      fillShell(group);
      if (!rebuild({ immediate: true })) {                      // (never seen: the presets are tested) go back
        Object.assign(state, before); scene = old;
        if (state.groupId) { fillShell(BY_ID[state.groupId]); timeline.set(state.t); }
      } else if (changed) zoomHome();                           // another shape: same orientation, zoom back to 1
      syncPresets(); syncHint();
    } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  function setPreset(i) {
    const group = BY_ID[state.groupId];
    quiet++;
    try { usePreset(group, i); rebuild({ recolour: true }); syncPresets(); syncHint(); } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  /** Another pattern on the same tile, at the same t: the sheet is built again (the comma is cut into it; a print is not). */
  function setPattern(raw) {
    const key = resolvePattern(raw);
    if (!key || key === state.pattern) { syncPattern(); return getState(); }
    const before = state.pattern;
    state.pattern = key;
    quiet++;
    try { if (scene && !rebuild()) state.pattern = before; syncPattern(); } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  function setSeed(x, y) {
    x = Number(x); y = Number(y);
    if (!Number.isFinite(x + y) || !scene || scene.group.fold === 'snowflake') return getState();   // nothing to cut there
    state.seed = [x, y];
    state.presetIndex = -1;                                   // a custom cut: no chip is lit (the metric of the last one stays)
    quiet++;
    try { rebuild(); syncPresets(); syncHint(); } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  function setAmp(a, draft = false) {
    state.amp = Math.round(clamp01(a) * 1000) / 1000;
    if (Number(el.wavy.value) !== state.amp) el.wavy.value = String(state.amp);
    quiet++;
    try { rebuild({ draft }); } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  function setT(t) {
    quiet++;
    try { timeline.set(clamp01(t)); state.t = timeline.get(); drawFold(true); } finally { quiet--; }
    scheduleHash();
    return getState();
  }

  function setView(az, el2, zoom) {
    if (zoom > 0) stopZoomHome();                             // a zoom set on purpose wins over the glide; az / el alone
    turnFrom = null;                                          // leave it running (it sets the zoom only). A script's turn
    const v = {};                                             // is not the person's (the turn hint stays)
    if (Number.isFinite(Number(az)) && az != null) v.az = Number(az);
    if (Number.isFinite(Number(el2)) && el2 != null) v.el = Number(el2);
    if (zoom > 0) v.zoom = Number(zoom);
    if (v.az === undefined && v.el !== undefined) v.az = viewAngles().az;
    if (v.el === undefined && v.az !== undefined) v.el = viewAngles().el;
    R.setView(v);
    R.render();
    scheduleHash();
    return getState();
  }

  /**
   * Show what a decoded hash (decodeHash, the new form) asks for: group, cut (preset, metric, anchor), seed, wavy, t
   * and the 3D view, rebuilding only if the cut or the group differs from what is shown. Returns false, changing
   * nothing, if it cannot be built.
   */
  function applyUrl(u) {
    const group = BY_ID[u.g];
    if (!group) return false;
    const snow = group.fold === 'snowflake', custom = !snow && !!u.seed;
    const p = presetState(group, u.cut);
    const want = { ...p, presetIndex: custom ? -1 : p.presetIndex, seed: custom ? [u.seed[0], u.seed[1]] : p.seed, amp: snow ? state.amp : clamp01(u.wavy),
      pattern: resolvePattern(u.pat) || DEFAULT_PATTERN };
    const changed = u.g !== state.groupId;
    const before = { ...state, seed: state.seed.slice(), anchor: state.anchor && state.anchor.slice() }, old = scene;
    const same = !changed && !!scene && state.cutIndex === want.cutIndex && state.presetIndex === want.presetIndex &&
      state.seed[0] === want.seed[0] && state.seed[1] === want.seed[1] && state.amp === want.amp && state.pattern === want.pattern;
    quiet++;
    try {
      stopZoomHome();
      turnFrom = null;
      state.t = clamp01(u.t);
      timeline.set(state.t);
      setTileState(u.tile === undefined || u.tile === null ? 1 : u.tile);
      if (!same) {
        if (changed) { state.groupId = u.g; scene = null; }
        Object.assign(state, want);
        if (changed) fillShell(group); else if (Number(el.wavy.value) !== state.amp) el.wavy.value = String(state.amp);
        syncPattern();
        // A dragged cut (seed in the hash): its seams take their colours from the preset's tile, as along the drag
        // that made it (a seam keeps its colour while the cut moves; plane.js assignEdgeColors), so the link shows
        // the colours of the session it was copied from (round-3 check: 89 % of drags from a preset, against 59 %
        // when numbered afresh; 99.7 % of drags of 5 % of a tile).
        let colourFrom = null;
        if (custom) {
          try { colourFrom = assignEdgeColors(buildDomain(group, { seed: p.seed, metric: p.metric, warp: warpFor(group, clamp01(state.amp)) }), null); } catch (e) { colourFrom = null; }
        }
        if (!rebuild({ immediate: true, recolour: true, colourFrom })) {
          Object.assign(state, before); scene = old;
          if (state.groupId) { fillShell(BY_ID[state.groupId]); timeline.set(state.t); }
          syncFeatures();
          return false;
        }
      }
      state.t = timeline.get();
      R.setView(viewFromUrl(u.view || DEFAULT_VIEW));
      drawFold(true);
      P.render();
      syncPresets(); syncTileBar();
    } finally { quiet--; }
    return true;
  }

  // ---- the zoom after a group change ------------------------------------------------------------------------------
  // The new shape keeps the view's orientation, but the zoom glides back to 1 (the frame sphere just fits) in
  // ZOOM_HOME_SECONDS: a pinch made on another shape could leave this one overflowing the pane. Only the zoom is set
  // (R.setView({ zoom }) leaves the orientation alone); preset, seed, wave and t never touch it. The glide gives way
  // at once to the person's hand on the 3D view (pointer, wheel, keys, Safari's pinch), to "reset view" and to
  // __folding.setView with a zoom (setView(az, el) alone turns the view and lets the glide finish). With
  // prefers-reduced-motion the zoom is set at once.
  let zoomGlide = null;
  function stopZoomHome() {
    if (!zoomGlide) return;
    win.cancelAnimationFrame(zoomGlide.raf);
    zoomGlide = null;
  }
  function zoomHome() {
    stopZoomHome();
    const v = R.getView ? R.getView() : null;
    if (!v || !(v.zoom > 0) || Math.abs(Math.log(v.zoom)) < 1e-4) return;
    let still = false;
    try { still = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* no media queries */ }
    if (still) { R.setView({ zoom: 1 }); R.render(); return; }
    const g = { z0: v.zoom, t0: win.performance.now(), raf: 0 };
    const step = () => {
      if (zoomGlide !== g) return;
      const u = Math.min(1, (win.performance.now() - g.t0) / (ZOOM_HOME_SECONDS * 1000));
      R.setView({ zoom: zoomBetween(g.z0, 1, u) });
      if (u < 1) g.raf = win.requestAnimationFrame(step); else zoomGlide = null;
    };
    zoomGlide = g;
    g.raf = win.requestAnimationFrame(step);
  }
  for (const type of ['pointerdown', 'wheel', 'keydown', 'gesturestart']) el.foldCanvas.addEventListener(type, stopZoomHome, { capture: true, passive: true });

  function viewAngles() {
    const v = viewToUrl(R.getView ? R.getView() : null), r1 = (a) => Math.round(a * 10) / 10 + 0;
    return { az: r1(v.az), el: r1(v.el), zoom: Math.round(v.zoom * 1000) / 1000, roll: r1(v.roll), gliding: !!zoomGlide };
  }

  function getState() {
    const group = BY_ID[state.groupId] || null;
    let gap = null, url = '';
    try { if (scene) gap = seamGap(scene); } catch (e) { gap = NaN; }
    try { if (group && scene) url = encodeHash(urlState()); } catch (e) { url = ''; }
    return {
      groupId: state.groupId, presetIndex: state.presetIndex, cut: state.cutIndex,
      preset: group && state.presetIndex >= 0 ? group.presets[state.presetIndex].name : null,
      seed: scene ? [scene.domain.seed[0], scene.domain.seed[1]] : state.seed.slice(),
      anchor: state.anchor ? state.anchor.slice() : null,
      metric: state.metric ? state.metric.slice() : null, amp: state.amp, t: state.t,
      playing: timeline.isPlaying(), button: el.foldBtn.textContent.trim(),
      stops: scene ? scene.stops.map((s) => ({ t: s.t, label: s.label })) : [], duration: scene ? scene.duration : null,
      foldType: group ? group.fold : null, vertices: scene ? scene.n : 0, triangles: scene ? scene.M.tri.length / 3 : 0,
      seamGap: Number.isNaN(gap) ? 'not finite' : gap, nonFinite: scene ? scene.nonFinite : 0,
      frame: scene && scene.frame ? { center: scene.frame.center.slice(), radius: scene.frame.radius } : null,
      mirrored: !!(scene && scene.fold.mirrored === true), surfaceMix: scene ? surfaceMix(scene.fold, state.t) : 0,
      draft: !!(scene && scene.draft),
      // the pattern (pattern.js): its key, the print's name ('checks', 'triangles', 'hexagons', 'stripes', 'rings') or null
      pattern: state.pattern, print: scene && scene.print ? scene.print.name : null,
      // re-cut first (src/folds/recut.js): null, or the home tile's name, the pieces and when the fold itself begins
      recut: scene && scene.fold.recut && scene.fold.recut.movers > 0
        ? { home: scene.fold.recut.home.name, pieces: scene.fold.recut.pieces.map((q) => ({ type: q.type, share: q.area / scene.group.domainArea, from: q.from, to: q.to })), movers: scene.fold.recut.movers, tau0: scene.fold.recut.tau0 }
        : null,
      foldCaption: foldCap && !foldCap.hidden ? foldCap.textContent : '',
      tile: state.tile, tilePlaying: tilePlaying(), tileCaption: tileEl.caption && !tileEl.caption.hidden ? tileEl.caption.textContent : '',
      tileBarOpen: !!(tileEl.bar && tileEl.bar.hasAttribute('data-open')),
      // the replication's frame on a phone's plane (plane.js setStepFrame): 0 the window as always .. 1 the step's
      tileFrame: P.getStepFrame ? P.getStepFrame().mix : 0,
      view: viewAngles(), webgl: R.ok !== false, url, hash: currentHash(),
      pickerOpen: picker.isOpen(), errors: errors.length,
    };
  }

  // ---- input ----------------------------------------------------------------------------------------------------
  // The frames of a drag are built with the draft mesh (rebuild({ draft: true })); when the drag ends the same cut is
  // built again with the full mesh (the same boundary samples: the seams stay where they are, the facets get finer).
  function onSeed(x, y, phase) {
    if (!scene || scene.group.fold === 'snowflake') return;  // nothing to cut (the plane takes no drags there either)
    if (phase === 'end') {
      if (scene.draft) { quiet++; try { rebuild(); } finally { quiet--; } }
      flushHash();
      return;
    }
    if (phase !== 'move') return;
    dragged = true;
    state.seed = [x, y];
    state.presetIndex = -1;
    quiet++;
    try { rebuild({ draft: true }); syncPresets(); syncHint(); } finally { quiet--; }
    scheduleHash();
  }

  enhanceRange(el.wavy);
  let ampFrame = 0;
  el.wavy.addEventListener('input', () => {                   // at most one rebuild per animation frame, a draft
    if (ampFrame) return;
    ampFrame = win.requestAnimationFrame(() => { ampFrame = 0; const a = Number(el.wavy.value); if (a !== state.amp) setAmp(a, true); });
  });
  // released: the full mesh (also when the value did not change since the last draft frame)
  el.wavy.addEventListener('change', () => {
    if (ampFrame) { win.cancelAnimationFrame(ampFrame); ampFrame = 0; }
    const a = Number(el.wavy.value);
    if (a !== state.amp || (scene && scene.draft)) setAmp(a);
    flushHash();
  });
  el.scrubber.addEventListener('change', () => { flushHash(); });
  if (patEl.select) {
    if (!patEl.select.options || !patEl.select.options.length) {
      for (const q of PATTERNS) { const o = doc.createElement('option'); o.value = q.key; o.textContent = q.label; patEl.select.appendChild(o); }
    }
    patEl.select.addEventListener('change', () => { setPattern(patEl.select.value); flushHash(); });
  }
  el.chip.addEventListener('click', () => picker.open(state.groupId));
  el.resetView.addEventListener('click', () => { stopZoomHome(); turnFrom = null; R.resetView(); });

  // The 3D view: the person's first turn hides "drag to turn" for the rest of the session (SPEC 8 C1); a turn
  // that ends writes the URL at once (the momentum after it is caught by the throttle's last write).
  const handOn =() => { if (!turned && R.getView) turnFrom = R.getView().q; };
  el.foldCanvas.addEventListener('pointerdown', handOn, { capture: true, passive: true });
  el.foldCanvas.addEventListener('keydown', handOn, { capture: true, passive: true });
  for (const type of ['pointerup', 'pointercancel']) el.foldCanvas.addEventListener(type, () => { flushHash(); });
  R.onChange(() => {
    if (!turned && turnFrom && viewAngle(R.getView().q, turnFrom) > TURN_MIN_DEG) {
      turned = true; turnFrom = null;
      if (turnHint) turnHint.hidden = true;
    }
    scheduleHash();
  });

  // The URL: a hash the viewer forwards (a pasted link) or the person edits is applied; one that names nothing
  // leaves the picture alone. Either way the hash is then rewritten to what is shown (and the viewer told).
  win.addEventListener('hashchange', () => {
    const raw = currentHash();
    if (raw === lastWritten) return;                          // our own write (the location.replace fallback)
    const u = decodeHash(raw);
    if (u && u.legacy) { if (u.g !== state.groupId) setGroup(u.g); } else if (u) applyUrl(u);
    lastPosted = null;
    flushHash();
  });

  // the widths of the lines follow the pane
  if (win.ResizeObserver) {
    let k0 = 0;
    new win.ResizeObserver(() => {
      const k = lineScale(el.foldCanvas.clientWidth, el.foldCanvas.clientHeight);
      if (k !== k0) { k0 = k; drawFold(true); } else syncFoldCaption();
    }).observe(el.foldCanvas);
    // a phone turned on its side (or a window made larger) while the step shows: its frame on small panes only
    new win.ResizeObserver(() => syncStepFrame()).observe(el.planeCanvas);
  }

  // Without WebGL 2 the 3D pane only shows the renderer's message: nothing to play, scrub or reset there. The plane,
  // the presets, Wavy and the picker work as ever.
  if (R.ok === false) {
    for (const b of [el.foldBtn, el.scrubber, el.resetView]) b.disabled = true;
    timeline.destroy();                                       // Space and the scrubber then do nothing either
    if (turnHint) turnHint.hidden = true;
  }

  // ---- go -------------------------------------------------------------------------------------------------------
  const frames = () => new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    win.requestAnimationFrame(() => win.requestAnimationFrame(fin));
    win.setTimeout(fin, 300);
  });
  const api = {
    setGroup, setPreset, setSeed, setAmp, setT, setView, getState, setPattern,
    /** The replication's progress u (0 = the tile alone, 1 = tiled), drawn at once. */
    setTile(u) { quiet++; try { setTileState(u); P.render(); } finally { quiet--; } scheduleHash(); return getState(); },
    /** Press the Tile button; resolves when the play has ended. */
    playTile() {
      tileToggle();
      return new Promise((resolve) => { const poll = () => { if (tilePlaying()) win.setTimeout(poll, 30); else resolve(getState()); }; poll(); });
    },
    tilePlan: () => P.tilingPlan(),
    ready: null,
    play(target) {
      timeline.play(target);
      return new Promise((resolve) => {
        const poll = () => { if (timeline.isPlaying()) win.setTimeout(poll, 30); else resolve(getState()); };
        poll();
      });
    },
    resetView() { stopZoomHome(); turnFrom = null; R.resetView(true); R.render(); scheduleHash(); return getState(); },
    openPicker() { picker.open(state.groupId); return picker.isOpen(); },
    closePicker() { picker.close(); return picker.isOpen(); },
    flushHash() { lastPosted = null; writeHashNow(true); return getState(); },
    errors, counters, renderer: R, plane: P, timeline, picker,
    scene: () => scene,
  };
  win.__folding = api;

  // the state of the URL the page was opened with (a legacy #<id> names the group only), else the default group
  quiet++;
  try {
    const first = decodeHash(currentHash());
    let shown = false;
    if (first && !first.legacy) shown = applyUrl(first);
    else if (first) { setGroup(first.g); shown = state.groupId === first.g; }
    if (!shown || !state.groupId) setGroup(DEFAULT_GROUP);
  } finally { quiet--; }
  flushHash();
  api.ready = frames().then(() => getState());
  return api;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('app')) {
  try { start(document, window); } catch (e) { console.error('The Folding cannot start: ' + (e && e.stack ? e.stack : e)); }
}
