// Clockwork-colour generator marks, drawn on the picture they generate.
//
// This is `../trefoil/generators.mjs` with the data made arguments — the copy
// `../../colour/colour-generators.mjs` made for the catalog explorers, lifted
// back here so this page stands alone and carries its own entry's data:
// the artwork — `GLYPH`, `glyphMarkup`, `dial`, `triad`, `chip`, `sense`,
// `label`, `markerMarkup`, `translationMarkup`, `anatomySvg`, `screenOf`,
// `unitsInView`, `createGeneratorOverlay` — is kept as it was, and `GENERATORS`,
// `SYMBOL` and the group names are this entry's, frozen in below from the
// catalog record colour:gyre:a767fbcc68c0 and re-derived from the field itself
// in tests/crosslet.test.mjs.
//
// Three things ARE this page's own, because this entry's geometry is not
// Trefoil's: `MARK_SEPARATION` and the crowding derived from it (Trefoil thins
// by a sixth of a lattice length; here the shortest gap in the annotation is
// |p|, the turn centre to its cell corner), `SHARED_SHIFT` (two coins on one
// centre, pushed 1.7 coin radii apart instead of 1.28), and the shedding order
// in `markScale`, which goes by CENTRE rather than by rotation so that g and g²
// arrive and leave together.
//
// Notation — "clockwork-colour", the site's clockwork orbifold symbol (see
// ../../notation.html) with one new decoration:
//
//     n_k^(σ)   a gyration of order n whose ANTICLOCKWISE generator advances
//               the film by k/n of a period and permutes the colours by σ,
//               written in cycle notation over the colour digits 0 terracotta,
//               1 teal, 2 sand. The superscript is omitted when σ is the
//               identity, exactly as the subscript is omitted when k = 0.
//
// THE MASTER RULE, which the catalog builder applies and this module only
// draws: for the rotation by R_m (m sixths of a turn, anticlockwise) about a
// point p, put v = (I − R_m)p. Then v ≡ j b (mod L) for a unique j in {0, 1, 2};
// the time shift is −m/6 of a period and the colour permutation is
//
//     σ(c) = (−1)^m · c − j   (mod 3).
//
// Every transposition has m odd, so a colour swap always costs an ODD sixth of
// a period. This page never evaluates that rule — `GENERATORS` carries the
// answer and tests/crosslet.test.mjs re-derives it — and on Crosslet no mark
// transposes anything: the colour group is Z3 and every mark either cycles all
// three colours or leaves them alone.
import {PALETTE, toPlane} from './renderer.mjs';

export const INK = '#14110f', PAPER = '#f7f2ea';
export const TIME = '#cdb4fe', TIME_DIM = '#2f2740';

/** The three colour stations on a chip, fixed for ever: 0 terracotta at twelve,
 * 1 teal at four, 2 sand at eight o'clock, so σ(c) = c + 1 runs CLOCKWISE. */
export const STATION = [0, 120, 240];
export const COIN = 30, CHIP = 23, CHIP_AT = 58;

/** The site's own rotation-order artwork (wallpaper-groups.json: rotation-6-5,
 * rotation-3-2, rotation-2-1), with the International Tables screw tails. The
 * first subpath of each is the BODY and the rest are the tails. */
export const GLYPH = {
  6: {path: 'M0,-12 L-10.39,-6 L-10.39,6 L0,12 L10.39,6 L10.39,-6 Z M-0.68,-9.18 L7.49,-13.9 L6.44,-15.72 L-1.73,-11 Z M-8.29,-4 L-8.29,-13.44 L-10.39,-13.44 L-10.39,-4 Z M-7.61,5.18 L-15.79,0.46 L-16.84,2.28 L-8.66,7 Z M0.68,9.18 L-7.49,13.9 L-6.44,15.72 L1.73,11 Z M8.29,4 L8.29,13.44 L10.39,13.44 L10.39,4 Z M7.61,-5.18 L15.79,-0.46 L16.84,-2.28 L8.66,-7 Z', scale: 1},
  3: {path: 'M0,-15.24 L-13.2,7.62 L13.2,7.62 Z M0.82,-12.46 L6.74,-22.71 L4.92,-23.76 L-1,-13.51 Z M-11.2,5.52 L-23.04,5.52 L-23.04,7.62 L-11.2,7.62 Z M10.38,6.94 L16.3,17.19 L18.12,16.14 L12.2,5.89 Z', scale: 0.72},
  2: {path: 'M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z M0.3,-9.2 L1.24,-10.27 L2.28,-11.24 L3.41,-12.1 L4.62,-12.85 L5.9,-13.48 L7.23,-13.99 L8.6,-14.36 L8.15,-16.41 L6.58,-15.98 L5.06,-15.41 L3.6,-14.69 L2.22,-13.83 L0.93,-12.84 L-0.26,-11.74 L-1.34,-10.52 Z M-0.3,9.2 L-1.24,10.27 L-2.28,11.24 L-3.41,12.1 L-4.62,12.85 L-5.9,13.48 L-7.23,13.99 L-8.6,14.36 L-8.15,16.41 L-6.58,15.98 L-5.06,15.41 L-3.6,14.69 L-2.22,13.83 L-0.93,12.84 L0.26,11.74 L1.34,10.52 Z', scale: 1},
};

/** How many sixths of a lattice length the marks' grid uses. The catalog's
 * `cellSixths` for this entry: the translations are given in sixths, the turn
 * centre in lattice coordinates. */
export const CELL_SIXTHS = 6;

/** This entry's four generators, copied from the catalog record
 * colour:gyre:a767fbcc68c0 (`entry.generators`) with nothing added and nothing
 * taken away. The two rotations share the SAME centre p — they are g and g², the
 * only two non-identity elements of the film group that are not translations —
 * so the overlay draws them as two coins tethered to one ring; see
 * `SHARED_SHIFT`. The two slides are the lattice itself, and recolour nothing.
 *
 * `centre` is in lattice coordinates on the basis a₁ = (1, 0), a₂ = (−1/2,
 * −√3/2); `turn` is the rotation in those coordinates, an integer matrix;
 * `frames` is the time shift in saved frames out of 96 and `sixths` the same in
 * sixths of a period; `perm[c]` is the colour c becomes. Every one of them is
 * re-derived from the field and re-checked at all 96 × 36 × 36 = 124 416
 * node-frames in tests/crosslet.test.mjs, with 0 violations. */
export const GENERATORS = [
  {
    name: 'g', glyph: 'g', kind: 'rotation', order: 3, k: 1, n: 3,
    centre: [17 / 54, 35 / 108], centreExact: [[17, 54], [35, 108]],
    turn: [[-1, 1], [-1, 0]], op: 'R240', degrees: 240, msixths: 4,
    v: [11, 23], frames: 32, sixths: 2, timeFraction: [1, 3],
    perm: [2, 0, 1], cycle: '(021)', j: 1,
    symbol: '3₁⁽⁰²¹⁾', html: '3<sub>1</sub><sup>(021)</sup>', ascii: '3_1^(021)',
    base: '3', sub: '1', sup: '(021)',
    chipDeg: 300, labelDeg: 322, labelR: 120,
    rotationShort: '240° ↺', timeShort: '⅓ T', colourShort: 'each steps back one',
    rotationText: 'two thirds of a turn anticlockwise, about the turn centre p',
    timeText: '⅓ of the loop', colourText: 'every colour steps back one',
    reading: 'turn two thirds of a turn anticlockwise about the turn centre p, run the film on ⅓ of the loop, and step every colour back one',
  },
  {
    name: 'gSquared', glyph: 'g²', kind: 'rotation', order: 3, k: 2, n: 3,
    centre: [17 / 54, 35 / 108], centreExact: [[17, 54], [35, 108]],
    turn: [[0, -1], [1, -1]], op: 'R120', degrees: 120, msixths: 2,
    v: [23, 12], frames: 64, sixths: 4, timeFraction: [2, 3],
    perm: [1, 2, 0], cycle: '(012)', j: 2,
    symbol: '3₂⁽⁰¹²⁾', html: '3<sub>2</sub><sup>(012)</sup>', ascii: '3_2^(012)',
    base: '3', sub: '2', sup: '(012)',
    chipDeg: 60, labelDeg: 38, labelR: 120,
    rotationShort: '120° ↺', timeShort: '⅔ T', colourShort: 'each steps on one',
    rotationText: 'a third of a turn anticlockwise, about the same centre p',
    timeText: '⅔ of the loop', colourText: 'every colour steps on one',
    reading: 'turn a third of a turn anticlockwise about the same centre p, run the film on ⅔ of the loop, and step every colour on one',
  },
  {
    name: 'tau1', glyph: 'τ', kind: 'translation',
    vector: [1, 0], vectorSixths: [6, 0],
    turn: [[1, 0], [0, 1]], op: '1', degrees: 0, msixths: 0,
    v: [0, 0], frames: 0, sixths: 0, timeFraction: [0, 1],
    perm: [0, 1, 2], cycle: '', j: 0,
    symbol: 'τ₁', html: 'τ<sub>1</sub>', ascii: 'tau1', base: 'τ', sub: '1', sup: null,
    side: -1, lead: true,
    rotationShort: 'slide, one motif', timeShort: 'none', colourShort: 'unchanged',
    rotationText: 'no turn at all — a slide of one step of the picture’s own lattice',
    timeText: 'nothing: the clock is empty', colourText: 'nothing: the colours stay put',
    reading: 'slide the picture by one step of its own lattice, with no waiting at all, and leave the colours alone',
  },
  {
    name: 'tau2', glyph: 'τ', kind: 'translation',
    vector: [0, 1], vectorSixths: [0, 6],
    turn: [[1, 0], [0, 1]], op: '1', degrees: 0, msixths: 0,
    v: [0, 0], frames: 0, sixths: 0, timeFraction: [0, 1],
    perm: [0, 1, 2], cycle: '', j: 0,
    symbol: 'τ₂', html: 'τ<sub>2</sub>', ascii: 'tau2', base: 'τ', sub: '2', sup: null,
    side: 1, lead: false,
    rotationShort: 'slide', timeShort: 'none', colourShort: 'unchanged',
    rotationText: 'no turn at all — a slide of one step of the picture’s own lattice',
    timeText: 'nothing: the clock is empty', colourText: 'nothing: the colours stay put',
    reading: 'slide the picture by one step of its own lattice, with no waiting at all, and leave the colours alone',
  },
];
export const byName = name => GENERATORS.find(item => item.name === name);

/** The entry's symbol: a presentation, not an orbifold symbol — the two coins
 * are one centre written twice, once for each power of g. */
export const SYMBOL = {
  unicode: '3₁⁽⁰²¹⁾ 3₂⁽⁰¹²⁾ · τ₁ τ₂',
  html: '3<sub>1</sub><sup>(021)</sup> 3<sub>2</sub><sup>(012)</sup> · τ<sub>1</sub> τ<sub>2</sub>',
  ascii: '3_1^(021) 3_2^(012) . tau1 tau2',
};
export const SYMBOL_NOTE = 'Four symbols for the four marks, the free slides after the centre dot. This is a presentation of the film group and not an orbifold symbol: the orbifold of the coloured picture is 333, the first two symbols name ONE centre twice — once for each power of the third-turn about it — and each subscript is the time numerator of THAT element, not of the smallest anticlockwise rotation about its centre.';
/** The groups the footnote names, from the same record. */
export const PICTURE_GROUP = {groupId: 'g225', family: 'p3', orbifold: '333', signature: '³3³3³3'};
export const COLOUR_PRESERVING_GROUP = {groupId: 'g1', family: 'p1', orbifold: '◦'};
export const COLOUR_GROUP = 'Z3';

const mod3 = c => ((c % 3) + 3) % 3;
const mod6 = s => ((s % 6) + 6) % 6;
/** The master rule as a function — exported for the tests, never called by the
 * page: the time shift (in sixths of a period) and the colour permutation of
 * the rotation by m sixths about a centre of class j. */
export const symmetryFor = (m, j) => ({
  sixths: mod6(-m),
  perm: [0, 1, 2].map(c => mod3((m % 2 ? -c : c) - j)),
});

/** Lattice coordinates of a generator's centre (or, for a translation, of the
 * far end of its arrow), on the coarse basis.
 *
 * A mark usually sits on the sixths grid — `centreSixths` / `vectorSixths`, with
 * `cellSixths` of them to a lattice length — because the centres of a hexagonal
 * group do. A Gyre turn centre does not: it lies on the 1/(3N) grid and is a
 * point of no symmetry of the field, so those marks give their place as lattice
 * coordinates instead, and both are accepted. */
export function centreOf(item, cellSixths = CELL_SIXTHS) {
  const sixths = item.centreSixths ?? item.vectorSixths;
  if (Array.isArray(sixths)) return sixths.map(s => s / cellSixths);
  const exact = item.centre ?? item.vector;
  return Array.isArray(exact) ? [...exact] : [0, 0];
}

/** Where a lattice point lands on screen, in CSS pixels, through the viewer's
 * own camera — the same transform the shader uses, so a mark drawn here stays
 * glued to the pattern under a pan, a zoom, a turn, a glide or a resize. */
export function screenOf([u, v], view, width, height) {
  const scale = view.scale(width, height), [cu, cv] = view.center;
  const [x, y] = toPlane([u - cu, v - cv]);
  const c = Math.cos(view.angle), s = Math.sin(view.angle);
  return [width / 2 + scale * (c * x - s * y), height / 2 + scale * (s * x + c * y)];
}

/** The shortest gap between two distinct pieces of the annotation, in lattice
 * lengths — what `spacing` below measures the crowding by. On Trefoil that was
 * the fundamental triangle's short side, a flat sixth of a lattice length; here
 * the only two anchors in a cell are the lattice point the two slides run from
 * and the turn centre p the two coins share, and p sits |p| = 0.3195 lattice
 * lengths from it. (The other candidates, |p − a₁| = 0.8925 and |p − a₂| =
 * 0.8768, and the lattice length itself, are all far longer.) */
export const MARK_SEPARATION = (() => {
  const [x, y] = toPlane([17 / 54, 35 / 108]);
  return Math.hypot(x, y);
})();

/** The hard ceiling on how many repeats may be built at once. The fade below is
 * derived FROM it, so on any viewport the layer fades out before it bites.
 *
 * The nearest n repeats cover a disc of area n·(√3/2)·r², r being one lattice
 * length = spacing / MARK_SEPARATION; asking that disc to reach the corner of a
 * w × h window gives spacing ≥ √(π/(2√3))·MARK_SEPARATION·hypot(w, h)/√n, and
 * the constant carries a 12 % margin on top of that. With Trefoil's sixth this
 * formula returns its shipped 0.178 exactly. */
export const MAX_UNITS = 320;
export const COVER_K = 1.12 * Math.sqrt(Math.PI / (2 * Math.sqrt(3))) * MARK_SEPARATION;
/** `spacing` reaches FULL_SPACING at the home framing of a desktop window — 380
 * CSS pixels per lattice length × MARK_SEPARATION = 121.4 — so the marks are
 * drawn at full size there and shrink from the first turn of the wheel outward.
 * A phone, whose home framing is half a window (195 px per lattice length),
 * draws them at 0.51 and is the densest view the page has. */
export const FULL_SPACING = 122;
/** The floor under the fade, in the same units as `spacing`: below 36 px of it
 * one unit of the annotation is as wide as the repeat it belongs to, and the
 * layer reads as texture rather than as notation — Trefoil's flat 18 was the
 * same judgement made by hand for its own geometry. It is under the spacing of
 * the tightest home framing this page has (a 320 px phone: 160 CSS px per
 * lattice length, 51 px of spacing) by more than FADE_SPAN, so no device ever
 * opens on a faded layer.
 *
 * The marks shrink in proportion right down to that point and stop there, which
 * is why the floor under `markScale` is the same number over FULL_SPACING: an
 * annotation is never drawn at a size the fade has already decided against. */
export const HIDE_FLOOR = 36, FADE_SPAN = 12;
export const MIN_MARK_SCALE = HIDE_FLOOR / FULL_SPACING;
export function fadeWindow(width, height, max = MAX_UNITS) {
  const hide = Math.max(HIDE_FLOOR, COVER_K * Math.hypot(width, height) / Math.sqrt(max));
  return {hide, fade: hide + FADE_SPAN};
}

/** How far out from its cell origin one unit of the annotation reaches, in
 * lattice lengths — the Trefoil page's hard-coded 0.94, computed instead from
 * the generators actually present. */
export function unitReach(generators = GENERATORS, cellSixths = CELL_SIXTHS) {
  let reach = 0.35;
  for (const item of generators ?? []) {
    const [x, y] = toPlane(centreOf(item, cellSixths));
    reach = Math.max(reach, Math.hypot(x, y) + 0.12);
  }
  return reach;
}

/** The marks repeat with the COARSE lattice L: translating by b carries a
 * centre to a centre but conjugates the permutation, so one repeat of the
 * annotation is one L-cell. */
export function unitsInView(view, width, height, {max = MAX_UNITS, reach = 0.94} = {}) {
  const scale = view.scale(width, height);
  const margin = 60 + reach * scale;
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(p => view.latticeAt(p, width, height));
  const pad = margin / Math.max(1, scale);
  const lo = [0, 1].map(i => Math.floor(Math.min(...corners.map(c => c[i])) - pad - 1));
  const hi = [0, 1].map(i => Math.ceil(Math.max(...corners.map(c => c[i])) + pad + 1));
  const found = [];
  for (let u = lo[0]; u <= hi[0]; u++) for (let v = lo[1]; v <= hi[1]; v++) {
    const [x, y] = screenOf([u, v], view, width, height);
    if (x < -margin || y < -margin || x > width + margin || y > height + margin) continue;
    found.push({cell: [u, v], at: [x, y], from: Math.hypot(x - width / 2, y - height / 2)});
    if (found.length > 2400) break;
  }
  found.sort((a, b) => a.from - b.from);
  return found.slice(0, max);
}

/** How large to draw the marks, how solid, and which of them to draw at all.
 *
 * The fundamental domain is fixed by the group, so the marks crowd together as
 * the view zooms out and there is nothing to be done about it but shrink, thin
 * and finally give up. The thinning is driven by the size the marks are drawn
 * at rather than by the gap, because what stops being legible is a mark.
 *
 * Which mark goes first is by CENTRE, the last-listed one first — the Trefoil
 * page's γ then β, generalised. Rotations that share a centre are one mark of
 * the picture written twice, so they thin together and are shed together: on
 * this page g and g² are both powers of the same third-turn about p, and a view
 * showing one of them without the other would say that p carries a third-turn
 * and not a threefold centre. There is one centre here, so nothing is ever
 * shed: only the labels thin, and then the whole layer goes. */
// `lead` is a shade wider than the catalog explorer's [0.46, 0.58] so that a
// phone at its home framing — 0.51, the densest view this page has — lands at
// the top of it and keeps its labels whole, rather than holding them at 42 %
// for ever.
export const RAMPS = {label: [0.74, 0.88], second: [0.66, 0.78], third: [0.50, 0.62], lead: [0.40, 0.50]};
const clamp01 = x => Math.max(0, Math.min(1, x));
/** The distinct rotation centres among `rotations`, in drawing order. */
const centreKey = item => centreOf(item).map(v => v.toFixed(9)).join(',');
export function centreClasses(rotations) {
  const keys = [];
  for (const item of rotations) { const key = centreKey(item); if (!keys.includes(key)) keys.push(key); }
  return keys;
}

/** The marks of an entry, in drawing order: rotations by descending order, then
 * translations. The shedding order is the reverse. */
export function orderMarks(generators = GENERATORS) {
  const list = generators ?? [];
  const rotations = list.filter(item => item.kind !== 'translation').slice()
    .sort((a, b) => (b.order ?? 1) - (a.order ?? 1));
  const translations = list.filter(item => item.kind === 'translation');
  return {rotations, translations};
}

export function markScale(view, width, height, {max = MAX_UNITS, generators = GENERATORS} = {}) {
  const spacing = view.scale(width, height) * MARK_SEPARATION;
  const scale = Math.min(1, Math.max(MIN_MARK_SCALE, spacing / FULL_SPACING));
  const ramp = ([out, into]) => clamp01((scale - out) / (into - out));
  const {rotations, translations} = orderMarks(generators);
  const centres = centreClasses(rotations);
  const strength = {};
  rotations.forEach(item => {
    const at = centres.indexOf(centreKey(item));
    const fromEnd = centres.length - 1 - at;
    strength[item.name] = fromEnd === 0 && centres.length > 1 ? ramp(RAMPS.second)
      : fromEnd === 1 && centres.length > 2 ? ramp(RAMPS.third) : 1;
    // Labels follow the coins: two symbols over two coins that name ONE centre
    // have to arrive and leave together, or the surviving one reads as the name
    // of both. Across centres they still thin one at a time.
    strength[`${item.name}Label`] = at === 0 ? ramp(RAMPS.lead) : ramp(RAMPS.label);
  });
  for (const item of translations) { strength[item.name] = 1; strength[`${item.name}Label`] = ramp(RAMPS.lead); }
  const {hide, fade} = fadeWindow(width, height, max);
  const marks = rotations.filter(item => strength[item.name] > 0).map(item => item.name);
  const labels = Object.fromEntries([...rotations, ...translations].map(item => [item.name, strength[`${item.name}Label`] > 0]));
  return {
    spacing, scale, strength, marks, labels,
    lean: centres.length > 1 && strength[rotations[rotations.length - 1].name] <= 0,
    opacity: clamp01((spacing - hide) / (fade - hide)),
    key: `${marks.join(',')}|${Object.entries(labels).filter(([, on]) => on).map(([name]) => name).join(',')}`,
  };
}

// ---- the artwork -----------------------------------------------------------

const n2 = x => Number(x.toFixed(2));
const pol = (r, deg) => [n2(r * Math.sin(deg * Math.PI / 180)), n2(-r * Math.cos(deg * Math.PI / 180))];
const arcPath = (r, a0, a1) => `M${pol(r, a0)} A${n2(r)} ${n2(r)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${pol(r, a1)}`;
const head = (r, a, dir, len = 6, half = 3) => {
  const p = pol(r, a), t = pol(1, a + dir * 90);
  return `M${p} L${n2(p[0] - t[0] * len - t[1] * half)},${n2(p[1] - t[1] * len + t[0] * half)} L${n2(p[0] - t[0] * len + t[1] * half)},${n2(p[1] - t[1] * len - t[0] * half)} Z`;
};
const tipAt = ([px, py], [ux, uy], len = 6.6, half = 3.7) =>
  `M${n2(px)},${n2(py)} L${n2(px - ux * len - uy * half)},${n2(py - uy * len + ux * half)} L${n2(px - ux * len + uy * half)},${n2(py - uy * len - ux * half)} Z`;
const stroked = (d, w, colour = PAPER, halo = null) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${n2(halo ?? w + 2.6)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="${n2(w)}" stroke-linecap="round"/>`;
/** A disc of ink to stand the artwork on, nearly opaque rather than translucent. */
const plate = r => `<circle r="${n2(r)}" fill="${INK}" fill-opacity=".93"/><circle r="${n2(r)}" fill="none" stroke="${PAPER}" stroke-opacity=".34" stroke-width="1.3"/>`;

/** The rotation-order glyph: the body solid, the screw tails drawn back behind
 * it, so the polygon the legend names survives. */
export function glyphMarkup(order) {
  const g = GLYPH[order] ?? GLYPH[3];
  const parts = g.path.split(/(?=M)/).map(s => s.trim()).filter(Boolean);
  const [body, ...tails] = parts;
  return `<g class="cc-order" transform="scale(${g.scale})">` +
    (tails.length ? `<path class="cc-tail" d="${tails.join(' ')}" fill="${PAPER}" fill-opacity=".5" stroke="${INK}" stroke-width="${n2(1.8 / g.scale)}" paint-order="stroke" stroke-linejoin="round"/>` : '') +
    `<path class="cc-body" d="${body}" fill="${PAPER}" stroke="${INK}" stroke-width="${n2(2.2 / g.scale)}" paint-order="stroke" stroke-linejoin="round"/></g>`;
}

/** The clock dial on the coin's rim: a wedge from twelve o'clock, CLOCKWISE,
 * filling k/n of a turn. An empty ring means no waiting at all. */
export function dial(k, n, {r = 25, w = 5.4} = {}) {
  const sweep = (k / n) * 360, ro = r + w / 2, ri = r - w / 2, big = sweep > 180 ? 1 : 0;
  let out = `<circle r="${n2(r)}" fill="none" stroke="${INK}" stroke-width="${n2(w + 2.4)}"/><circle r="${n2(r)}" fill="none" stroke="${TIME_DIM}" stroke-width="${n2(w)}"/>`;
  if (k) out += `<path d="M${pol(ro, 0)} A${n2(ro)} ${n2(ro)} 0 ${big} 1 ${pol(ro, sweep)} L${pol(ri, sweep)} A${n2(ri)} ${n2(ri)} 0 ${big} 0 ${pol(ri, 0)} Z" fill="${TIME}"/>`;
  out += `<circle r="${n2(ro)}" fill="none" stroke="${PAPER}" stroke-opacity=".38" stroke-width=".9"/><circle r="${n2(ri)}" fill="none" stroke="${PAPER}" stroke-opacity=".38" stroke-width=".9"/><path d="M${pol(ri - 2.6, 0)} L${pol(ro + 2.6, 0)}" stroke="${INK}" stroke-width="3.4"/><path d="M${pol(ri - 2.6, 0)} L${pol(ro + 2.6, 0)}" stroke="${PAPER}" stroke-width="1.6"/>`;
  return `<g class="cc-dial" data-time="${k}/${n}">${out}</g>`;
}

/** The colour triad: three dots at the fixed stations, and what moves them. A
 * swap is a straight double-headed arrow through the two dots it exchanges,
 * with a ringed dot for the one left alone; a cycle is three chasing arrows;
 * the identity is three plain dots. */
export function triad(perm, {r = 10.6, dot = 4.6, band = 18.4, digits = false, palette = PALETTE} = {}) {
  const moved = [0, 1, 2].filter(i => perm[i] !== i);
  let marks = '';
  if (moved.length === 3) {
    const cw = perm[0] === 1;
    for (let i = 0; i < 3; i++) {
      const a0 = STATION[i] + (cw ? 22 : -22), a1 = STATION[i] + (cw ? 98 : -98);
      marks += stroked(arcPath(band, a0, a1), 2.1, PAPER, 3.6) +
        `<path d="${head(band, a1, a1 > a0 ? 1 : -1, 7.4, 3.9)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    }
  } else if (moved.length === 2) {
    const [i, j] = moved, fixed = [0, 1, 2].find(c => perm[c] === c);
    const p = pol(r, STATION[i]), q = pol(r, STATION[j]);
    const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const u = [(q[0] - p[0]) / span, (q[1] - p[1]) / span], over = dot + 6.4;
    const ends = [[p[0] - u[0] * over, p[1] - u[1] * over], [q[0] + u[0] * over, q[1] + u[1] * over]];
    marks += stroked(`M${n2(ends[0][0])},${n2(ends[0][1])} L${n2(ends[1][0])},${n2(ends[1][1])}`, 2.2, PAPER, 3.8) +
      `<path d="${tipAt(ends[1], u, 7.2, 3.8)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="${tipAt(ends[0], [-u[0], -u[1]], 7.2, 3.8)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const fp = pol(r, STATION[fixed]);
    marks += `<circle cx="${fp[0]}" cy="${fp[1]}" r="${n2(dot + 3.2)}" fill="none" stroke="${INK}" stroke-width="3"/>` +
             `<circle cx="${fp[0]}" cy="${fp[1]}" r="${n2(dot + 3.2)}" fill="none" stroke="${PAPER}" stroke-width="1.4" stroke-dasharray="2.4 2.4"/>`;
  }
  const dots = [0, 1, 2].map(i => {
    const p = pol(r, STATION[i]);
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${n2(dot + 1.6)}" fill="${INK}"/><circle cx="${p[0]}" cy="${p[1]}" r="${n2(dot)}" fill="${palette[i]}"/>`;
  }).join('');
  const numbers = digits ? [0, 1, 2].map(i => {
    const p = pol(r, STATION[i]);
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="central" font-size="${n2(dot * 1.5)}" font-weight="700" fill="${INK}" font-family="ui-serif, Georgia, serif">${i}</text>`;
  }).join('') : '';
  return `<g class="cc-triad" data-perm="${perm.join('')}">${marks}${dots}${numbers}</g>`;
}

export const chip = (perm, {r = CHIP, digits = false, palette = PALETTE} = {}) =>
  `<g class="cc-chip">${plate(r)}${triad(perm, {r: r * (digits ? 0.48 : 0.44), dot: r * (digits ? 0.22 : 0.165), band: r * 0.9, digits, palette})}</g>`;

/** The generator's own sense, just outside the coin: the clockwork convention
 * fixes it as the counter-clockwise turn. */
export function sense({r = COIN + 8, from = 18, span = 74} = {}) {
  const a0 = -from, a1 = -(from + span);
  return `<g class="cc-sense">${stroked(arcPath(r, a0, a1), 3, PAPER, 6.4)}<path d="${head(r, a1, -1, 8, 4)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
}

/** A mark's label, set with real tspans rather than Unicode sub/superscripts:
 * U+2085 and the superscript parentheses have no glyph in the serif stack on
 * WebKit, and even where they render, 6₅ is not distinguishable from 65. */
export function label(item, {size = 20} = {}) {
  const small = n2(size * 0.62), lift = n2(size * 0.52), drop = n2(size * 0.2);
  let inner = `${!item.glyph || item.glyph === item.base ? '' : `${item.glyph} `}${item.base ?? ''}`;
  if (item.sub) inner += `<tspan class="cc-sub" font-size="${small}" dy="${drop}">${item.sub}</tspan>`;
  if (item.sup) inner += `<tspan class="cc-sup" font-size="${small}" dy="${n2(-(lift + (item.sub ? Number(drop) : 0)))}">${item.sup}</tspan>`;
  return `<text class="cc-text" text-anchor="middle" y="${n2(size * 0.34)}" font-size="${size}" font-weight="600" fill="${PAPER}" stroke="${INK}" stroke-width="5" paint-order="stroke" font-family="ui-serif, Georgia, 'Times New Roman', serif">${inner}</text>`;
}

/** How far a coin is pushed off a shared centre, in local units. Two generators
 * can be rotations about the SAME point — Gyre's g and g² are, and the catalog
 * places their chips on opposite sides (210° and 330°) expecting it. Drawn one
 * on top of the other only the upper coin's shape and clock would be visible,
 * and the mark would read as one rotation with two colour outcomes. So each
 * coin at a shared centre slides out along its own chip's direction, its chip
 * slides out with it, and a small ring is left behind on the true centre.
 *
 * 1.7 coin radii rather than the catalog explorer's 1.28: with two coins 120°
 * apart that is 88 CSS pixels between their centres, which clears the 38-unit
 * sense arcs (76) as well as the 30-unit plates. */
export const SHARED_SHIFT = COIN * 1.7;

/** One complete gyration mark, in its own local frame, whose ORIGIN is the true
 * rotation centre: the coin at the origin (or pushed off it by `shift` when the
 * centre is shared), the chip on a stub beyond it, the label outside. Only the
 * order glyph turns with the view — its screw tails point along lattice
 * directions. */
export function markerMarkup(item, {text = true, chipDeg = item.chipDeg ?? 180, labelDeg = item.labelDeg ?? 180, labelR = item.labelR ?? 100, shift = 0, palette = PALETTE} = {}) {
  const [ox, oy] = shift ? pol(shift, chipDeg) : [0, 0];
  const [cx, cy] = pol(CHIP_AT + shift, chipDeg), [lx, ly] = pol(labelR, labelDeg);
  // The stub spans the GAP between the two discs only; drawn across the whole
  // distance it shows through both plates as a bar over the artwork.
  const [sx, sy] = pol(COIN - 2 + shift, chipDeg), [ex, ey] = pol(CHIP_AT + shift - CHIP + 2, chipDeg);
  return `<g class="cc-marker" data-name="${item.name}" data-order="${item.order}" data-k="${item.k}" data-perm="${item.perm.join('')}" data-cycle="${item.cycle ?? ''}"${shift ? ' data-shared="true"' : ''}>` +
    `<path d="M${sx},${sy} L${ex},${ey}" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="M${sx},${sy} L${ex},${ey}" stroke="${PAPER}" stroke-opacity=".5" stroke-width="2"/>` +
    (shift ? `<path class="cc-tether" d="M0,0 L${ox},${oy}" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`
      + `<path d="M0,0 L${ox},${oy}" stroke="${PAPER}" stroke-opacity=".55" stroke-width="1.6"/>`
      + `<circle class="cc-centre" r="4.6" fill="${INK}"/><circle r="4.6" fill="none" stroke="${PAPER}" stroke-width="1.6"/>` : '') +
    `<g transform="translate(${ox} ${oy})">${plate(COIN)}` +
    `<g class="cc-turn">${glyphMarkup(item.order)}</g>` +
    dial(item.k ?? 0, item.n ?? item.order ?? 1) + sense() + `</g>` +
    `<g transform="translate(${cx} ${cy})">${chip(item.perm, {palette})}</g>` +
    (text ? `<g class="cc-label" transform="translate(${lx} ${ly})">${label(item)}</g>` : '') +
    `</g>`;
}

/** The translation mark, in a local frame running along +x: a plain line with a
 * FULL arrowhead, a chip beside it, and NO DIAL AT ALL — the empty clock is how
 * the page shows that this generator is free. */
export function translationMarkup(item, {text = true, palette = PALETTE} = {}) {
  // A slide whose chip is three plain dots says "and the colours do not move".
  // It is the mark with the least to say, and on a Gyre entry there are two of
  // them, a whole lattice vector long, at every repeat — drawn at full strength
  // they lay a grid of white rules over the picture and read as a frame rather
  // than as an annotation. So an identity slide is drawn quietly; one that
  // recolours, like Trefoil's τ⁽⁰²¹⁾, keeps its full weight.
  const quiet = item.perm.every((c, i) => c === i);
  return `<g class="cc-translation" data-name="${item.name}" data-perm="${item.perm.join('')}" data-cycle="${item.cycle ?? ''}"`
    + `${quiet ? ' data-quiet="true" opacity="0.5"' : ''}>` +
    `<line class="cc-shaft-halo" x1="0" y1="0" x2="0" y2="0" stroke="${INK}" stroke-opacity=".84" stroke-linecap="round"/>` +
    `<line class="cc-shaft" x1="0" y1="0" x2="0" y2="0" stroke="${PAPER}" stroke-linecap="round"/>` +
    `<path class="cc-head-mid" d="M0,0 L-13,-5.8 L-13,5.8 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" display="none"/>` +
    `<path class="cc-head" d="M0,0 L-17,-7.5 L-17,7.5 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<g class="cc-chip-at"><g class="cc-upright">${chip(item.perm, {palette})}</g></g>` +
    (text ? `<g class="cc-label-at"><g class="cc-upright">${label(item)}</g></g>` : '') +
    `</g>`;
}

/** The anatomy diagram: one mark with its three channels named, in exactly the
 * arrangement the artwork uses, so the diagram teaches the thing the reader is
 * looking at. */
export function anatomySvg(item) {
  const model = item ?? {name: 'anatomy', order: 6, k: 5, n: 6, perm: [0, 2, 1], chipDeg: 180, labelDeg: 180, labelR: 100};
  const leader = (x1, y1, x2, y2) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${PAPER}" stroke-opacity=".5" stroke-width="1.1" fill="none"/>`;
  const note = (x, y, anchor, text) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="${PAPER}" fill-opacity=".8" font-family="inherit">${text}</text>`;
  return `<svg class="cc-anatomy" viewBox="-124 -58 248 152" width="100%" aria-hidden="true">` +
    `<g transform="translate(6 -12)">${markerMarkup({...model, chipDeg: 180, labelDeg: 180, labelR: 100}, {text: false})}</g>` +
    leader(48, -44, 26, -24) + note(52, -47, 'start', 'the shape') +
    leader(62, -12, 44, -12) + note(66, -12, 'start', 'the clock') +
    leader(-34, 54, -18, 46) + note(-38, 57, 'end', 'the dots') +
    `</svg>`;
}

const box = (inner, half, size) => `<svg viewBox="${-half} ${-half} ${2 * half} ${2 * half}" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
const swatch = c => `<span class="swatch" style="background:${PALETTE[c]}"></span>`;

const CLOSING = {
  gyre: `<p><b>Two coins, one centre.</b> The turn centre <i>p</i> carries both rotations — <b>g</b>, two thirds of a turn
  anticlockwise, and <b>g²</b>, a third — so the two coins are drawn either side of the small ring that marks the true centre,
  each tethered to it. There is one centre there, not two. Nothing in a still frame marks it: <i>p</i> sits 0.32 lattice lengths
  from the nearest threefold centre of the wave, and the field has no symmetry there at all.</p>
  <p><b>Why nothing at all survives in one frame.</b> Every mark here but the slides carries a wait: the colour group is
  <b>Z₃</b> and the homomorphism from the film group onto it has no kernel beyond the lattice, so a symmetry that keeps the
  colours also keeps the clock still, and a symmetry that moves them cannot. Freeze the film and the picture has nothing left but
  its translations. That is what <i>fully entangled</i> means, and it is exactly what a cyclic colour group is allowed to do.</p>`,
  trefoil: `<p><b>Why the swap needs the half period.</b> A turn by <i>m</i> sixths about a centre recolours by
  σ(c) = (−1)<sup><i>m</i></sup>c − <i>j</i>, where <i>j</i> ∈ {0, 1, 2} says which of the three classes of centre it is (not the
  subscript of the symbol, which is the wait). A <i>swap</i> of two colours therefore needs <i>m</i> odd — an odd sixth of a
  period — while the even turns and the free slide only ever cycle the three. There is no way to exchange two colours without
  turning the picture and waiting as well.</p>`,
};

/** The legend the Notation button opens: what the symbol says, this entry's
 * generators as a table, then the anatomy of a mark. Everything specific to the
 * entry — the symbol, the rows, the closing paragraph, the group names in the
 * footnote — comes from the catalog. */
export function legendMarkup({generators = GENERATORS, symbol = SYMBOL, kind = 'gyre', pictureGroup = PICTURE_GROUP, colourPreservingGroup = COLOUR_PRESERVING_GROUP, colourGroup = COLOUR_GROUP, symbolNote = SYMBOL_NOTE} = {}) {
  const list = generators ?? [];
  const rows = list.map(g => `<tr><td>${g.kind === 'translation' || !g.glyph ? '' : `${g.glyph} `}${g.html ?? g.symbol ?? g.name}</td><td>${g.rotationShort ?? ''}</td><td>${g.timeShort ?? ''}</td><td>${g.colourShort ?? ''}</td></tr>`).join('');
  const lead = list.find(g => g.kind !== 'translation') ?? null;
  // The symbol is a presentation, not an orbifold symbol — the catalog says so
  // in `notation.entrySymbol`, and until now nothing rendered it. Without it a
  // reader who has just come from the notation page sees one order-3 centre
  // written twice with two different subscripts and no explanation.
  const caveat = symbolNote
    ? `<p class="foot symbol-note">${String(symbolNote).replace(/\bsigma\b/g, 'σ').replace(/\bTHAT\b/g, '<b>that</b>')}</p>` : '';
  const table = list.length ? `
<p class="symbol">${symbol?.html ?? ''}</p>
${caveat}
<table>
  <thead><tr><th>Generator</th><th>Rotation</th><th>Time</th><th>Colour</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>Round any relation of the group the time subscripts add to a whole number of periods <i>and</i> the colour superscripts
compose to the identity. Both are the same statement, once in time and once in colour.</p>`
    : `<p class="foot">This entry's catalog record does not yet carry its generator marks, so none are drawn on the picture. The
notation below is how they are read wherever they do appear — on <a href="../trefoil/">Trefoil</a> and
<a href="../gyre/">Gyre</a>, and on every entry once the catalog carries the field.</p>`;
  const foot = pictureGroup ? `<p class="foot">Strip the superscripts and the picture's own film group is
<code>${pictureGroup.groupId ?? '—'}</code>, ${pictureGroup.family ?? ''}, orbifold ${pictureGroup.orbifold ?? ''}. Keep only the
symmetries whose superscript is empty — the kernel of the colour homomorphism — and it is
<code>${colourPreservingGroup?.groupId ?? '—'}</code>, ${colourPreservingGroup?.family ?? ''}. The superscripts between them
realise ${colourGroup === 'S3' ? 'all six permutations of three colours, so the colour group is the whole of S₃' : 'the three cyclic recolourings, so the colour group is Z₃'}.</p>` : '';
  return `
<p class="lede">Each mark says three things at once: what to do, how long to wait, and what becomes of the colours.</p>
${table}
<h3>Reading a mark</h3>
${anatomySvg(lead)}
<dl>
  <dt>${box(`<g transform="scale(0.62)">${plate(COIN)}${glyphMarkup(6)}</g>`, 26, 46)}</dt>
  <dd><b>The shape</b> — which turn. A hexagon is a sixth of a turn, a triangle a third, a lens a half; the pale tails are the
  screw marks of the International Tables, and the small arc outside says the turn is the <b>anticlockwise</b> one.</dd>
  <dt>${box(`<g transform="scale(0.78)">${dial(5, 6)}</g>`, 26, 46)}</dt>
  <dd><b>The violet clock</b> — how long you wait. It fills clockwise from twelve, through the fraction of the loop that turn
  carries. An empty ring means no waiting at all. The clock's accent is violet because it must never be read as one of the three
  colours.</dd>
  <dt>${box(`${chip([2, 0, 1], {r: 27, digits: true})}`, 28, 54)}</dt>
  <dd><b>The three dots</b> — what happens to the colours. ${swatch(0)} terracotta <b>0</b> sits at twelve, ${swatch(1)} teal
  <b>1</b> at four, ${swatch(2)} sand <b>2</b> at eight, always, and those are the digits the superscript is written in. A
  double-headed arrow joins the two colours it exchanges and rings the one left alone; three chasing arrows cycle all three;
  three plain dots mean the colours never move.</dd>
  <dt>${box(`<line x1="0" y1="20" x2="0" y2="-12" stroke="${INK}" stroke-opacity=".84" stroke-width="7.5" stroke-linecap="round"/><line x1="0" y1="20" x2="0" y2="-12" stroke="${PAPER}" stroke-width="3" stroke-linecap="round"/><path d="M0,-20 L-7.5,-3 L7.5,-3 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`, 24, 46)}</dt>
  <dd><b>The plain arrow</b> — a slide, with no turn and no wait. A full head means a whole step of the picture’s own lattice.</dd>
</dl>
${CLOSING[kind] ?? ''}
<p class="foot">The marks repeat with the pattern, and the turn centre sits at the middle of the screen at the home view. Zoom
out and they thin — first the labels, then the second of the two coins — and about five times out the layer is hidden
altogether; zoom back in and it returns. Press <b>G</b> for the marks, <b>N</b> for this panel, and share a view with
<code>?generators=1</code> to open it <i>with</i> them (they are off until asked for).</p>
${foot}`;
}

// ---- the overlay -----------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';

/** Draws the marks over the canvas and keeps them on the pattern.
 *
 * Units are pooled: a change of zoom that adds repeats appends only the new
 * ones, and only a change of TIER rebuilds the layer. Placement goes through
 * the camera rather than rotating a finished picture, because the pieces behave
 * differently under a view turn: the order glyph and the arrows are lattice
 * directions and turn with the view, while the dial, the sense arc, the chip
 * and the label must not.
 *
 * Unlike the Trefoil page's version this takes the generators as data, and
 * handles any number of rotations (including one whose permutation is the
 * identity — three plain dots) and any number of free translations, which is
 * what a Gyre entry's g, g² and two lattice slides need. */
export function createGeneratorOverlay(svg, view, {generators = GENERATORS, cellSixths = CELL_SIXTHS, palette = PALETTE, max = MAX_UNITS} = {}) {
  const layer = document.createElementNS(NS, 'g');
  svg.append(layer);
  const {rotations: allRotations, translations} = orderMarks(generators);
  const reach = unitReach(generators, cellSixths);
  let units = [], tier = null, coins = allRotations, last = null, applied = null;

  /** Which of the drawn coins sit on a centre another one also claims. */
  function sharedShift(item) {
    const here = centreOf(item, cellSixths);
    const together = coins.filter(other => {
      const there = centreOf(other, cellSixths);
      return Math.abs(there[0] - here[0]) < 1e-9 && Math.abs(there[1] - here[1]) < 1e-9;
    });
    return together.length > 1 ? SHARED_SHIFT : 0;
  }

  function makeUnit(labels) {
    const node = document.createElementNS(NS, 'g');
    node.setAttribute('class', 'cc-unit');
    node.innerHTML = translations.map(item => translationMarkup(item, {text: labels[item.name], palette})).join('')
      + coins.map(item => {
        // A coin pushed off a shared centre takes its label with it, or the
        // label would sit over the other coin's chip.
        const shift = sharedShift(item);
        return markerMarkup(item, {text: labels[item.name], shift, labelR: (item.labelR ?? 100) + shift * 0.5, palette});
      }).join('');
    layer.append(node);
    return {
      node,
      slides: [...node.querySelectorAll('.cc-translation')].map(slide => ({
        node: slide,
        shaft: slide.querySelectorAll('line'),
        head: slide.querySelector('.cc-head'),
        mid: slide.querySelector('.cc-head-mid'),
        chip: slide.querySelector('.cc-chip-at'),
        label: slide.querySelector('.cc-label-at'),
        upright: slide.querySelectorAll('.cc-upright'),
      })),
      marks: [...node.querySelectorAll('.cc-marker')].map(mark => ({
        node: mark, turn: mark.querySelector('.cc-turn'), label: mark.querySelector('.cc-label'),
      })),
    };
  }

  function build(n, spec = tier ?? {key: 'none', marks: [], labels: {}}) {
    if (!tier || spec.key !== tier.key) {
      layer.replaceChildren();
      units = [];
      tier = spec;
      coins = allRotations.filter(item => spec.marks.includes(item.name));
      applied = null;
    }
    while (units.length > n) units.pop().node.remove();
    while (units.length < n) units.push(makeUnit(tier.labels));
  }

  return {
    get count() { return units.length; },
    get marksPerUnit() { return coins.length + translations.length; },
    update(width, height, {force = false} = {}) {
      if (!generators.length) { layer.replaceChildren(); units = []; return; }
      const key = `${view.center[0]},${view.center[1]},${view.scale(width, height)},${view.angle},${width},${height}`;
      if (!force && key === last) return;
      last = key;
      const state = markScale(view, width, height, {max, generators});
      const {scale, opacity, strength} = state;
      svg.style.opacity = opacity.toFixed(3);
      if (opacity <= 0) { if (units.length) build(0); return; }
      const cells = unitsInView(view, width, height, {max, reach});
      build(cells.length, state);
      const degrees = view.angle * 180 / Math.PI;
      const turned = `rotate(${degrees.toFixed(2)})`;
      const fading = Object.values(strength).map(value => value.toFixed(3)).join(',');
      const fade = fading !== applied;
      applied = fading;
      const labelFits = (x, y) => x > 58 * scale && x < width - 58 * scale && y > 15 * scale && y < height - 15 * scale;
      for (const [i, cell] of cells.entries()) {
        const unit = units[i];
        const [x0, y0] = cell.at;
        for (const [j, slide] of unit.slides.entries()) {
          const item = translations[j], side = item.side ?? (j % 2 ? 1 : -1);
          const at = centreOf(item, cellSixths);
          const [x1, y1] = screenOf(cell.cell.map((q, axis) => q + at[axis]), view, width, height);
          const len = Math.hypot(x1 - x0, y1 - y0);
          const dir = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
          // The shaft starts clear of the coin at its tail; the chip rides near
          // the head rather than at the midpoint. Zoomed in, the arrow is longer
          // than the window, so a mid-shaft head states the direction on screen.
          const from = Math.min(len * 0.3, (COIN + 9) * scale);
          const reachPx = 0.42 * Math.min(width, height);
          const capped = (len - from) * 0.72 > reachPx;
          const along = from + Math.min((len - from) * 0.72, reachPx);
          slide.node.setAttribute('transform', `translate(${x0.toFixed(2)} ${y0.toFixed(2)}) rotate(${dir.toFixed(2)})`);
          for (const line of slide.shaft) { line.setAttribute('x1', from.toFixed(2)); line.setAttribute('x2', len.toFixed(2)); }
          slide.shaft[0].setAttribute('stroke-width', (7.5 * scale).toFixed(2));
          slide.shaft[1].setAttribute('stroke-width', (3 * scale).toFixed(2));
          slide.head.setAttribute('transform', `translate(${len.toFixed(2)} 0) scale(${scale.toFixed(3)})`);
          slide.mid.setAttribute('display', capped ? 'inline' : 'none');
          if (capped) slide.mid.setAttribute('transform', `translate(${along.toFixed(2)} 0) scale(${scale.toFixed(3)})`);
          slide.chip.setAttribute('transform', `translate(${along.toFixed(2)} ${(side * 34 * scale).toFixed(2)}) scale(${scale.toFixed(3)})`);
          if (slide.label) {
            const t = dir * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
            const lx = x0 + c * along - s * (-side * 30 * scale), ly = y0 + s * along + c * (-side * 30 * scale);
            slide.label.setAttribute('transform', `translate(${along.toFixed(2)} ${(-side * 30 * scale).toFixed(2)}) scale(${scale.toFixed(3)})`);
            slide.label.style.display = labelFits(lx, ly) ? '' : 'none';
          }
          for (const node of slide.upright) node.setAttribute('transform', `rotate(${(-dir).toFixed(2)})`);
        }
        for (const [j, mark] of unit.marks.entries()) {
          const item = coins[j];
          const at = centreOf(item, cellSixths);
          const [x, y] = screenOf(cell.cell.map((q, axis) => q + at[axis]), view, width, height);
          mark.node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
          mark.turn.setAttribute('transform', turned);
          if (fade) mark.node.setAttribute('opacity', (strength[item.name] ?? 1).toFixed(3));
          if (mark.label) {
            const [dx, dy] = pol((item.labelR ?? 100) + sharedShift(item) * 0.5, item.labelDeg ?? 180);
            mark.label.style.display = labelFits(x + dx * scale, y + dy * scale) ? '' : 'none';
            if (fade) mark.label.setAttribute('opacity', (strength[`${item.name}Label`] ?? 1).toFixed(3));
          }
        }
      }
    },
    /** The whole layer as one sentence, for the layer's aria-label. */
    description() {
      if (!generators.length) return 'No generator marks are published for this entry.';
      return `Generator marks on the pattern: ${generators.map(g => `${g.symbol ?? g.glyph ?? g.name} — ${g.reading ?? ''}`).join('; ')}.`;
    },
    clear() { build(0); last = null; },
  };
}
