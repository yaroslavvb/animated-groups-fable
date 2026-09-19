// The generators of Trefoil's film group, drawn on the picture they generate.
//
// Notation — "clockwork-colour", the site's clockwork orbifold symbol (see
// ../../notation.html) with one new decoration:
//
//     n_k^(σ)   a gyration of order n whose ANTICLOCKWISE generator advances the
//               film by k/n of a period and permutes the colours by σ, written
//               in cycle notation over the colour digits 0 terracotta,
//               1 teal, 2 sand. The superscript is omitted when σ is the
//               identity, exactly as the subscript is omitted when k = 0, so
//               every undecorated symbol on the site keeps its meaning.
//
// A generator that is not a gyration keeps the same two decorations: a
// translation is τ_q^(σ) and a pure wait ω_q^(σ), with the subscript the
// fraction itself — the exception notation.html already makes for the glide
// mark ×_q. Two consistency rules, one per channel: round any relation of the
// group the time subscripts sum to a whole number of periods AND the colour
// superscripts compose to the identity. Both are the same statement.
//
// Trefoil's symbol is therefore
//
//     6₅⁽¹²⁾ 3₂⁽⁰²¹⁾ 2₁⁽⁰¹⁾ · τ⁽⁰²¹⁾
//
// with the fourth term a REMINDER rather than new data: notation.html writes no
// translation into an orbifold symbol, and this one is forced — τ = γβα in
// space, in time and in colour. It is written down because a bare τ, colour
// with no time at all, is the whole difference between this page and its
// siblings.
//
// Strip the superscripts and it is 6₅3₂2₁ — the catalogue's g247, p6, orbifold
// 632 — on the fine lattice L′ = L + ℤb. Keep only the SYMMETRIES whose
// superscript is empty (the kernel of the colour homomorphism, one sixth of the
// group — not a subset of the four marks, every one of which recolours) and it
// is 3₂3₂3₂, g225, p3, on the coarse lattice L, which is ../gyre/'s own film
// group.
//
// THE MASTER RULE, from which everything below is derived and against which the
// node test re-derives it: for the rotation by R_m (m sixths of a turn,
// anticlockwise) about a point p, put v = (I − R_m)p. Then p is a centre of the
// coloured picture exactly when v ∈ L′; v ≡ j b (mod L) for a unique j in
// {0, 1, 2}; the time shift is −m/6 of a period and the colour permutation is
//
//     σ(c) = (−1)^m · c − j   (mod 3).
//
// (j is the centre's class in L′/L. It is NOT the subscript k of the symbol,
// which is the time numerator: α has k = 5 and j = 0, γ has k = 1 and j = 2.)
// Every transposition has m odd, so a colour swap always costs an ODD sixth of
// a period — the theorem of README §1, read locally at one centre.
//
// The mark itself is a COIN and a CHIP, each carrying exactly one kind of
// thing, the discipline notation.html already states for the plate symbols:
//
//   coin  what the motion is and how long you wait — the site's own rotation
//         order glyph (white on an ink halo, lifted from wallpaper-groups.json,
//         with its screw tails drawn back so the polygon still reads as a
//         polygon), a VIOLET clock dial on the rim filling k/n clockwise from
//         twelve, and a short anticlockwise arc just outside for the sense.
//   chip  what becomes of the colours — three palette dots at fixed stations
//         (0 terracotta at twelve, 1 teal at four, 2 sand at eight), with
//         chasing arrows for a cycle, a double-headed arrow BETWEEN THE TWO
//         DOTS IT EXCHANGES and a ringed dot for a swap, and three plain dots
//         for the identity.
//
// The clock's accent is violet because it must never be read as one of the
// three colours: amber was tried first and at marker size an amber wedge and
// the sand dot #e2be68 are the same thing.
import {GRID_SIZE, PALETTE, toPlane} from './renderer.mjs';

export const INK = '#14110f', PAPER = '#f7f2ea';
export const TIME = '#cdb4fe', TIME_DIM = '#2f2740';
/** Centres and translations are whole sixths of a lattice length, and 66 nodes
 * is 6 × 11, so every claim about them is checked with no interpolation. */
export const NODES_PER_SIXTH = GRID_SIZE / 6;
/** b, in sixths of the lattice basis: the free translation, one motif. */
export const OFFSET_SIXTHS = [2, 4];

/** The three colour stations on a chip, fixed for ever: 0 terracotta at twelve,
 * 1 teal at four, 2 sand at eight o'clock, so σ(c) = c + 1 runs CLOCKWISE. */
export const STATION = [0, 120, 240];
export const COIN = 30, CHIP = 23, CHIP_AT = 58;
/** The site's own rotation-order artwork (wallpaper-groups.json: rotation-6-5,
 * rotation-3-2, rotation-2-1), with the International Tables screw tails. The
 * shape already encodes n and k; the dial is a second, readable statement of
 * the same thing, which is the point — the tails are a crystallographer's code
 * and the clock is not. The first subpath of each is the BODY and the rest are
 * the tails, which `glyphMarkup` draws separately: filled solid alongside the
 * body the tails swallow the silhouette, and a hexagon reads as a pinwheel. */
export const GLYPH = {
  6: {path: 'M0,-12 L-10.39,-6 L-10.39,6 L0,12 L10.39,6 L10.39,-6 Z M-0.68,-9.18 L7.49,-13.9 L6.44,-15.72 L-1.73,-11 Z M-8.29,-4 L-8.29,-13.44 L-10.39,-13.44 L-10.39,-4 Z M-7.61,5.18 L-15.79,0.46 L-16.84,2.28 L-8.66,7 Z M0.68,9.18 L-7.49,13.9 L-6.44,15.72 L1.73,11 Z M8.29,4 L8.29,13.44 L10.39,13.44 L10.39,4 Z M7.61,-5.18 L15.79,-0.46 L16.84,-2.28 L8.66,-7 Z', scale: 1},
  3: {path: 'M0,-15.24 L-13.2,7.62 L13.2,7.62 Z M0.82,-12.46 L6.74,-22.71 L4.92,-23.76 L-1,-13.51 Z M-11.2,5.52 L-23.04,5.52 L-23.04,7.62 L-11.2,7.62 Z M10.38,6.94 L16.3,17.19 L18.12,16.14 L12.2,5.89 Z', scale: 0.72},
  2: {path: 'M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z M0.3,-9.2 L1.24,-10.27 L2.28,-11.24 L3.41,-12.1 L4.62,-12.85 L5.9,-13.48 L7.23,-13.99 L8.6,-14.36 L8.15,-16.41 L6.58,-15.98 L5.06,-15.41 L3.6,-14.69 L2.22,-13.83 L0.93,-12.84 L-0.26,-11.74 L-1.34,-10.52 Z M-0.3,9.2 L-1.24,10.27 L-2.28,11.24 L-3.41,12.1 L-4.62,12.85 L-5.9,13.48 L-7.23,13.99 L-8.6,14.36 L-8.15,16.41 L-6.58,15.98 L-5.06,15.41 L-3.6,14.69 L-2.22,13.83 L-0.93,12.84 L0.26,11.74 L1.34,10.52 Z', scale: 1},
};

/** The four generators, in the site's own presentation of 632 (α a sixth-turn,
 * β a third, γ a half, with αβγ = 1 — see ../../correspondence-p6.html), moved
 * onto the FINE lattice L′ the colouring translates by. Centres are given in
 * sixths of the lattice basis a₁ = (1, 0), a₂ = (−1/2, −√3/2), which are whole
 * numbers of saved nodes; `turn` is the rotation in lattice coordinates, an
 * integer matrix; `sixths` is the time shift in sixths of a period; `perm[c]`
 * is the colour c becomes. Every one of them is verified in tests/trefoil.test.mjs
 * at all 96 × 66 × 66 = 418 176 node-frames, with 0 violations.
 *
 * `base`, `sub` and `sup` are the symbol's three pieces, kept apart so the SVG
 * label can be set with real tspans: the Unicode forms ₅ ⁽ ⁰ ⁾ have no glyph in
 * the serif stack on WebKit, where each one takes a full-width fallback box and
 * the symbol shatters into "α 6₅", "(0", "21)" across the artwork.
 *
 * On the fine lattice the three centres are the corners of the 30-60-90
 * fundamental triangle of 632, right-angled at γ — so all three marks sit
 * together near the middle of the screen, and the free translation runs
 * straight up out of α. */
export const GENERATORS = [
  {
    name: 'alpha', glyph: 'α', kind: 'rotation', order: 6, k: 5, n: 6,
    centreSixths: [0, 0], turn: [[1, -1], [1, 0]], degrees: 60, sixths: 5,
    perm: [0, 2, 1], cycle: '(12)', symbol: '6₅⁽¹²⁾', html: '6<sub>5</sub><sup>(12)</sup>', ascii: '6_5^(12)',
    base: '6', sub: '5', sup: '(12)',
    chipDeg: 180, labelDeg: 180, labelR: 100,
    rotationShort: '60° ↺', timeShort: '⅚ T', colourShort: 'teal ↔ sand',
    rotationText: 'a sixth of a turn anticlockwise, about a sixfold centre',
    timeText: '⅚ of the loop', colourText: 'teal ↔ sand',
    reading: 'turn a sixth anticlockwise about a sixfold centre of the pattern — the screen centre at the home view — run the film on ⅚ of a loop, and exchange teal and sand',
  },
  {
    name: 'beta', glyph: 'β', kind: 'rotation', order: 3, k: 2, n: 3,
    centreSixths: [2, 0], turn: [[0, -1], [1, -1]], degrees: 120, sixths: 4,
    perm: [2, 0, 1], cycle: '(021)', symbol: '3₂⁽⁰²¹⁾', html: '3<sub>2</sub><sup>(021)</sup>', ascii: '3_2^(021)',
    base: '3', sub: '2', sup: '(021)',
    chipDeg: 150, labelDeg: 72, labelR: 62,
    rotationShort: '120° ↺', timeShort: '⅔ T', colourShort: 'each steps back one',
    rotationText: 'a third of a turn anticlockwise, about the marked point',
    timeText: '⅔ of the loop', colourText: 'every colour steps back one',
    reading: 'turn a third anticlockwise about the marked point, run the film on ⅔ of a loop, and step every colour back one',
  },
  {
    name: 'gamma', glyph: 'γ', kind: 'rotation', order: 2, k: 1, n: 2,
    centreSixths: [2, 1], turn: [[-1, 0], [0, -1]], degrees: 180, sixths: 3,
    perm: [1, 0, 2], cycle: '(01)', symbol: '2₁⁽⁰¹⁾', html: '2<sub>1</sub><sup>(01)</sup>', ascii: '2_1^(01)',
    base: '2', sub: '1', sup: '(01)',
    chipDeg: 30, labelDeg: 95, labelR: 64,
    rotationShort: '180°', timeShort: '½ T', colourShort: 'terracotta ↔ teal',
    rotationText: 'a half turn, about the marked point',
    timeText: '½ of the loop', colourText: 'terracotta ↔ teal',
    reading: 'turn a half about the marked point, run the film on half a loop, and exchange terracotta and teal',
  },
  {
    name: 'tau', glyph: 'τ', kind: 'translation', vectorSixths: OFFSET_SIXTHS,
    sixths: 0, perm: [2, 0, 1], cycle: '(021)', symbol: 'τ⁽⁰²¹⁾', html: 'τ<sup>(021)</sup>', ascii: 'tau^(021)',
    base: 'τ', sub: null, sup: '(021)', lead: true,
    side: -1,
    rotationShort: 'slide, one motif', timeShort: 'none', colourShort: 'each steps back one',
    rotationText: 'no turn at all — a slide of one motif',
    timeText: 'nothing: the clock is empty', colourText: 'every colour steps back one',
    reading: 'slide the picture by one motif, with no waiting at all, and step every colour back one',
  },
];
export const SYMBOL = '6₅⁽¹²⁾ 3₂⁽⁰²¹⁾ 2₁⁽⁰¹⁾ · τ⁽⁰²¹⁾';
export const SYMBOL_ASCII = '6_5^(12) 3_2^(021) 2_1^(01) . tau^(021)';
/** The same symbol as markup. The Unicode forms are kept for the ascii and the
 * accessible description only: at 21 px in a serif face 6₅ reads as 65, and in
 * WebKit half the characters have no glyph at all. Everything a viewer SEES —
 * the panel here, and every label on the artwork — is built from real
 * subscripts and superscripts. */
export const SYMBOL_HTML = '6<sub>5</sub><sup>(12)</sup> 3<sub>2</sub><sup>(021)</sup> 2<sub>1</sub><sup>(01)</sup> · τ<sup>(021)</sup>';
export const byName = name => GENERATORS.find(g => g.name === name);

const mod3 = c => ((c % 3) + 3) % 3;
const mod6 = s => ((s % 6) + 6) % 6;
/** The master rule, as a function: the time shift (in sixths of a period) and
 * the colour permutation of the rotation by m sixths of a turn about a centre
 * whose (I − R_m)p is j·b modulo the coarse lattice. */
export const symmetryFor = (m, j) => ({
  sixths: mod6(-m),
  perm: [0, 1, 2].map(c => mod3((m % 2 ? -c : c) - j)),
});

/** Lattice coordinates of a generator's centre (or, for the translation, of the
 * far end of its arrow), on the coarse basis. */
export const centreOf = item => (item.centreSixths ?? item.vectorSixths).map(s => s / 6);
/** The same point in whole saved nodes, for the exact integer checks. */
export const nodesOf = item => (item.centreSixths ?? item.vectorSixths).map(s => s * NODES_PER_SIXTH);

/** Where a lattice point lands on screen, in CSS pixels, through the viewer's
 * own camera — the same transform the shader uses, so a mark drawn here stays
 * glued to the pattern under a pan, a zoom, a turn, a momentum glide or a
 * resize. It is the inverse of `view.latticeAt`. */
export function screenOf([u, v], view, width, height) {
  const scale = view.scale(width, height), [cu, cv] = view.center;
  const [x, y] = toPlane([u - cu, v - cv]);
  const c = Math.cos(view.angle), s = Math.sin(view.angle);
  return [width / 2 + scale * (c * x - s * y), height / 2 + scale * (s * x + c * y)];
}

/** The hard ceiling on how many repeats of the annotation may be built at once.
 * It is a ceiling and not the working limit: the fade below is derived FROM it,
 * so that on any viewport the layer has faded out before the ceiling can bite.
 * (With the old constant 64 a 2880 × 2000 window showed a fully opaque disc of
 * marks with a third of the screen bare around it.) */
export const MAX_UNITS = 320;
/** The zoom at which `max` repeats stop covering the window, as a spacing.
 * The nearest n repeats cover a disc of area n·(√3/2)·(6·spacing)²; asking that
 * disc to reach the corner of a w × h window gives
 * spacing ≥ √(π/(4·36·(√3/2))) · hypot(w, h) / √n ≈ 0.159 · hypot / √n, and the
 * constant carries a 12 % margin on top of that. The node test checks the real
 * count against the real fade on five window sizes and eleven zooms. */
export const COVER_K = 0.178;
/** The floor under the fade, for windows small enough that the ceiling is never
 * in danger: the marks survive to 18 px between β and γ, about 110 px per
 * repeat, which is five times out from the home framing. */
export const HIDE_FLOOR = 18, FADE_SPAN = 12;
export function fadeWindow(width, height, max = MAX_UNITS) {
  const hide = Math.max(HIDE_FLOOR, COVER_K * Math.hypot(width, height) / Math.sqrt(max));
  return {hide, fade: hide + FADE_SPAN};
}

/** The marks repeat with the COARSE lattice L, not with L′: translating by b
 * carries a sixfold centre to a sixfold centre but conjugates the permutation,
 * so at p ≡ b the sixth-turn swaps terracotta and teal instead of teal and
 * sand. One repeat of the annotation is therefore one L-cell — which is also
 * exactly the cell the three marks triangulate. */
export function unitsInView(view, width, height, {max = MAX_UNITS} = {}) {
  // A unit reaches a third of a lattice length from its α centre (the
  // fundamental triangle) and 1/√3 = 0.578 of one along the τ arrow, so a
  // repeat whose centre is 0.94 lattice lengths outside the viewport still has
  // marks — an arrowhead, a chip, a label — on screen.
  const margin = 60 + 0.94 * view.scale(width, height);
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(p => view.latticeAt(p, width, height));
  const pad = margin / Math.max(1, view.scale(width, height));
  const lo = [0, 1].map(i => Math.floor(Math.min(...corners.map(c => c[i])) - pad - 1));
  const hi = [0, 1].map(i => Math.ceil(Math.max(...corners.map(c => c[i])) + pad + 1));
  const found = [];
  for (let u = lo[0]; u <= hi[0]; u++) for (let v = lo[1]; v <= hi[1]; v++) {
    const [x, y] = screenOf([u, v], view, width, height);
    // Keep a repeat whose α centre is anywhere near the viewport: the other
    // three marks of the unit lie within one lattice length of it.
    if (x < -margin || y < -margin || x > width + margin || y > height + margin) continue;
    found.push({cell: [u, v], at: [x, y], from: Math.hypot(x - width / 2, y - height / 2)});
    if (found.length > 2400) break;
  }
  found.sort((a, b) => a.from - b.from);
  return found.slice(0, max);
}

/** How large to draw the marks, how solid, and which of them to draw at all.
 *
 * The fundamental triangle is fixed by the group, so the marks crowd together
 * as the view zooms out and there is nothing to be done about it but shrink,
 * thin and finally give up. `spacing` is the shortest side of the triangle,
 * |βγ| = a sixth of a lattice length, in CSS pixels; `scale` is the size the
 * marks are drawn at, and the thinning is driven by THAT rather than by the
 * spacing, because what stops being legible is a mark, not a gap. A phone at
 * its home framing draws marks at 0.64 and is the densest view the page has —
 * denser than any desktop — so it must thin too.
 *
 * Each piece fades out over a window that ENDS where it leaves the document, so
 * nothing ever pops away at full strength:
 *
 *   scale 1 … 0.88   everything
 *         0.88…0.74  β's and γ's labels fade out
 *         0.78…0.66  γ fades out        (a phone at its home framing sits at
 *         0.62…0.50  β fades out         0.64: α, β and the slide, with α's
 *         0.58…0.46  α's and τ's labels  and the slide's labels only)
 * and below `fadeWindow`'s window the whole layer goes. */
export const FULL_SPACING = 88, MIN_MARK_SCALE = 0.42;
export const RAMPS = {label: [0.74, 0.88], gamma: [0.66, 0.78], beta: [0.50, 0.62], lead: [0.46, 0.58]};
const clamp01 = x => Math.max(0, Math.min(1, x));
export function markScale(view, width, height, {max = MAX_UNITS} = {}) {
  const spacing = view.scale(width, height) / 6;
  const scale = Math.min(1, Math.max(MIN_MARK_SCALE, spacing / FULL_SPACING));
  const ramp = ([out, into]) => clamp01((scale - out) / (into - out));
  const strength = {
    alpha: 1, tau: 1, beta: ramp(RAMPS.beta), gamma: ramp(RAMPS.gamma),
    alphaLabel: ramp(RAMPS.lead), tauLabel: ramp(RAMPS.lead),
    betaLabel: ramp(RAMPS.label), gammaLabel: ramp(RAMPS.label),
  };
  const {hide, fade} = fadeWindow(width, height, max);
  const marks = ['alpha', 'beta', 'gamma'].filter(name => strength[name] > 0);
  const labels = Object.fromEntries(['alpha', 'beta', 'gamma', 'tau'].map(name => [name, strength[`${name}Label`] > 0]));
  return {
    spacing, scale, strength, marks, labels,
    // The state the legend names: α and the slide, and nothing else.
    lean: strength.beta <= 0,
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
/** An arrowhead on a straight line: the tip, the unit vector it points along. */
const tipAt = ([px, py], [ux, uy], len = 6.6, half = 3.7) =>
  `M${n2(px)},${n2(py)} L${n2(px - ux * len - uy * half)},${n2(py - uy * len + ux * half)} L${n2(px - ux * len + uy * half)},${n2(py - uy * len - ux * half)} Z`;
const stroked = (d, w, colour = PAPER, halo = null) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${n2(halo ?? w + 2.6)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="${n2(w)}" stroke-linecap="round"/>`;
/** A disc of ink to stand the artwork on. It is nearly opaque rather than
 * translucent: at .84 the picture showed through it and the stub joining the
 * chip to its coin could be read straight through the chip. */
const plate = r => `<circle r="${n2(r)}" fill="${INK}" fill-opacity=".93"/><circle r="${n2(r)}" fill="none" stroke="${PAPER}" stroke-opacity=".34" stroke-width="1.3"/>`;

/** The rotation-order glyph: the body solid, the screw tails drawn back behind
 * it. Filled to the same weight the tails merge into the body and the hexagon
 * reads as a six-armed pinwheel; held back, the polygon the legend names
 * survives and the tails still say which screw it is. */
export function glyphMarkup(order) {
  const g = GLYPH[order];
  const parts = g.path.split(/(?=M)/).map(s => s.trim()).filter(Boolean);
  const [body, ...tails] = parts;
  return `<g class="cc-order" transform="scale(${g.scale})">` +
    (tails.length ? `<path class="cc-tail" d="${tails.join(' ')}" fill="${PAPER}" fill-opacity=".5" stroke="${INK}" stroke-width="${n2(1.8 / g.scale)}" paint-order="stroke" stroke-linejoin="round"/>` : '') +
    `<path class="cc-body" d="${body}" fill="${PAPER}" stroke="${INK}" stroke-width="${n2(2.2 / g.scale)}" paint-order="stroke" stroke-linejoin="round"/></g>`;
}

/** The clock dial on the coin's rim: a wedge from twelve o'clock, CLOCKWISE,
 * filling k/n of a turn. It is a clock face, so it always reads as the wait and
 * never as the turn; an empty ring means no waiting at all. */
export function dial(k, n, {r = 25, w = 5.4} = {}) {
  const sweep = (k / n) * 360, ro = r + w / 2, ri = r - w / 2, big = sweep > 180 ? 1 : 0;
  let out = `<circle r="${n2(r)}" fill="none" stroke="${INK}" stroke-width="${n2(w + 2.4)}"/><circle r="${n2(r)}" fill="none" stroke="${TIME_DIM}" stroke-width="${n2(w)}"/>`;
  if (k) out += `<path d="M${pol(ro, 0)} A${n2(ro)} ${n2(ro)} 0 ${big} 1 ${pol(ro, sweep)} L${pol(ri, sweep)} A${n2(ri)} ${n2(ri)} 0 ${big} 0 ${pol(ri, 0)} Z" fill="${TIME}"/>`;
  out += `<circle r="${n2(ro)}" fill="none" stroke="${PAPER}" stroke-opacity=".38" stroke-width=".9"/><circle r="${n2(ri)}" fill="none" stroke="${PAPER}" stroke-opacity=".38" stroke-width=".9"/><path d="M${pol(ri - 2.6, 0)} L${pol(ro + 2.6, 0)}" stroke="${INK}" stroke-width="3.4"/><path d="M${pol(ri - 2.6, 0)} L${pol(ro + 2.6, 0)}" stroke="${PAPER}" stroke-width="1.6"/>`;
  return `<g class="cc-dial" data-time="${k}/${n}">${out}</g>`;
}

/** The colour triad: three dots at the fixed stations, and what moves them.
 *
 * A SWAP is a straight double-headed arrow along the line THROUGH the two dots
 * it exchanges, drawn under them with its heads standing clear on the far side
 * of each. Two earlier tries failed on the screen. Drawn as a short arc on the
 * ring the dots sit on, it was eaten alive by their ink halos and showed as two
 * stray barbs with nothing between them. Moved out to an arc near the rim it
 * survived — but it then touched nothing, so it never said WHICH two colours it
 * exchanged, and for α's (12), which runs between the four and eight o'clock
 * stations, it curved under both dots and the chip read as a smiling face.
 *
 * A CYCLE keeps three plain arrows on the band: three arrows in rotation are
 * unambiguous, and there is no pair for them to join. */
export function triad(perm, {r = 10.6, dot = 4.6, band = 18.4, digits = false} = {}) {
  const moved = [0, 1, 2].filter(i => perm[i] !== i);
  let marks = '';
  if (moved.length === 3) {
    // σ(c) = c + 1 chases CLOCKWISE round the stations (terracotta at twelve →
    // teal at four → sand at eight); σ(c) = c − 1, which is what both cycling
    // marks on this page carry, chases anticlockwise.
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
    // The shaft runs THROUGH both dots — it is drawn before them, so they sit
    // on top of it — and the two heads stand clear on the far side of each. The
    // arrow therefore names its own endpoints, and a straight ↔ cannot be read
    // as the mouth of a face, which is what the old arc below the two dots was.
    marks += stroked(`M${n2(ends[0][0])},${n2(ends[0][1])} L${n2(ends[1][0])},${n2(ends[1][1])}`, 2.2, PAPER, 3.8) +
      `<path d="${tipAt(ends[1], u, 7.2, 3.8)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="${tipAt(ends[0], [-u[0], -u[1]], 7.2, 3.8)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const f = pol(r, STATION[fixed]);
    marks += `<circle cx="${f[0]}" cy="${f[1]}" r="${n2(dot + 3.2)}" fill="none" stroke="${INK}" stroke-width="3"/>` +
             `<circle cx="${f[0]}" cy="${f[1]}" r="${n2(dot + 3.2)}" fill="none" stroke="${PAPER}" stroke-width="1.4" stroke-dasharray="2.4 2.4"/>`;
  }
  const dots = [0, 1, 2].map(i => {
    const p = pol(r, STATION[i]);
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${n2(dot + 1.6)}" fill="${INK}"/><circle cx="${p[0]}" cy="${p[1]}" r="${n2(dot)}" fill="${PALETTE[i]}"/>`;
  }).join('');
  // The digits the superscript is written in, written ON their own dots. They
  // ride in the key chip of the legend, where the chip is drawn large enough to
  // carry them: the three colours are told apart by station and not by hue —
  // in deuteranopia terracotta and sand are one olive, separated only by
  // lightness — so the bridge from the dot to the digit has to be drawn
  // somewhere, and this is the one place with the room.
  const numbers = digits ? [0, 1, 2].map(i => {
    const p = pol(r, STATION[i]);
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="central" font-size="${n2(dot * 1.5)}" font-weight="700" fill="${INK}" font-family="ui-serif, Georgia, serif">${i}</text>`;
  }).join('') : '';
  return `<g class="cc-triad" data-perm="${perm.join('')}">${marks}${dots}${numbers}</g>`;
}
/** The dots are smaller than they were, and the band is at the very rim: the
 * staple needs an annulus between the dots and the arc for its in-turned ends,
 * and a dot only has to be identified, not read. The key chip in the legend is
 * drawn larger and with the digits on the dots, so it opens both out. */
export const chip = (perm, {r = CHIP, digits = false} = {}) =>
  `<g class="cc-chip">${plate(r)}${triad(perm, {r: r * (digits ? 0.48 : 0.44), dot: r * (digits ? 0.22 : 0.165), band: r * 0.9, digits})}</g>`;

/** The generator's own sense, just outside the coin. The clockwork convention
 * fixes it as the counter-clockwise turn; playing the film runs the other way,
 * carrying the picture a THIRD of a turn clockwise every third of the loop with
 * the colours unchanged — a sixth of a turn clockwise is a symmetry only if
 * teal and sand change places with it. */
export function sense({r = COIN + 8, from = 18, span = 74} = {}) {
  const a0 = -from, a1 = -(from + span);
  return `<g class="cc-sense">${stroked(arcPath(r, a0, a1), 3, PAPER, 6.4)}<path d="${head(r, a1, -1, 8, 4)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
}

/** A mark's label, set with real tspans rather than Unicode sub/superscripts.
 * U+2085 and the superscript parentheses have no glyph in the serif stack on
 * WebKit — each takes a full-width fallback box and the symbol breaks into
 * fragments scattered across the picture — and even where they do render, 6₅
 * is not distinguishable from sixty-five. The digits ARE the notation, so they
 * have to be legible on the artwork and not only in the panel. */
export function label(item, {size = 20} = {}) {
  const small = n2(size * 0.62), lift = n2(size * 0.52), drop = n2(size * 0.2);
  let inner = `${item.glyph === item.base ? '' : `${item.glyph} `}${item.base}`;
  if (item.sub) inner += `<tspan class="cc-sub" font-size="${small}" dy="${drop}">${item.sub}</tspan>`;
  if (item.sup) inner += `<tspan class="cc-sup" font-size="${small}" dy="${n2(-(lift + (item.sub ? Number(drop) : 0)))}">${item.sup}</tspan>`;
  // The baseline is the plain alphabetic one and the whole line is nudged down
  // by a third of an em instead. With `dominant-baseline: central` the tspans
  // inherit it, and WebKit re-centres each one on its OWN smaller em box, so
  // the subscript rises to the middle of the digit beside it and 2₁ reads as 2¹.
  return `<text class="cc-text" text-anchor="middle" y="${n2(size * 0.34)}" font-size="${size}" font-weight="600" fill="${PAPER}" stroke="${INK}" stroke-width="5" paint-order="stroke" font-family="ui-serif, Georgia, 'Times New Roman', serif">${inner}</text>`;
}

/** One complete gyration mark, in its own local frame: the coin at the origin,
 * the chip on a stub, the label outside.
 *
 * Only ONE piece turns when the view does: the order glyph, whose screw tails
 * point along lattice directions and so belong to the pattern. It lives alone
 * in a `cc-turn` group the overlay rotates. Everything else is screen
 * furniture — twelve o'clock has to stay at twelve, the colour stations where
 * the legend put them, the text level, and the chip and the label out of each
 * other's way at every angle — so none of it is inside that group. */
export function markerMarkup(item, {text = true, chipDeg = item.chipDeg, labelDeg = item.labelDeg, labelR = item.labelR} = {}) {
  const [cx, cy] = pol(CHIP_AT, chipDeg), [lx, ly] = pol(labelR, labelDeg);
  // The stub spans the GAP between the two discs only. Drawn across the whole
  // distance it showed through both plates as a bar over the artwork.
  const [sx, sy] = pol(COIN - 2, chipDeg), [ex, ey] = pol(CHIP_AT - CHIP + 2, chipDeg);
  return `<g class="cc-marker" data-name="${item.name}" data-order="${item.order}" data-k="${item.k}" data-perm="${item.perm.join('')}" data-cycle="${item.cycle}">` +
    `<path d="M${sx},${sy} L${ex},${ey}" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="M${sx},${sy} L${ex},${ey}" stroke="${PAPER}" stroke-opacity=".5" stroke-width="2"/>` +
    plate(COIN) +
    `<g class="cc-turn">${glyphMarkup(item.order)}</g>` +
    dial(item.k, item.n) + sense() +
    `<g transform="translate(${cx} ${cy})">${chip(item.perm)}</g>` +
    (text ? `<g class="cc-label" transform="translate(${lx} ${ly})">${label(item)}</g>` : '') +
    `</g>`;
}

/** The translation mark, in a local frame running along +x: a plain line with a
 * FULL arrowhead — notation.html's plate key reserves a full head for a whole
 * primitive translation — a chip beside it, and NO DIAL AT ALL. The empty clock
 * is how the page shows that this generator is free. The mid-shaft head is
 * drawn only when the tip is off the far side of the window, which happens the
 * moment the view is zoomed past about twice the home framing: without it the
 * arrow degenerates into an unexplained white line across the picture. */
export function translationMarkup(item, {text = true} = {}) {
  return `<g class="cc-translation" data-name="${item.name}" data-perm="${item.perm.join('')}" data-cycle="${item.cycle}">` +
    `<line class="cc-shaft-halo" x1="0" y1="0" x2="0" y2="0" stroke="${INK}" stroke-opacity=".84" stroke-linecap="round"/>` +
    `<line class="cc-shaft" x1="0" y1="0" x2="0" y2="0" stroke="${PAPER}" stroke-linecap="round"/>` +
    `<path class="cc-head-mid" d="M0,0 L-13,-5.8 L-13,5.8 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" display="none"/>` +
    `<path class="cc-head" d="M0,0 L-17,-7.5 L-17,7.5 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<g class="cc-chip-at"><g class="cc-upright">${chip(item.perm)}</g></g>` +
    (text ? `<g class="cc-label-at"><g class="cc-upright">${label(item)}</g></g>` : '') +
    `</g>`;
}

/** The anatomy diagram: one mark with its three channels named, in exactly the
 * arrangement the artwork uses — chip straight down under the coin — so the
 * diagram teaches the thing the reader is looking at. */
export function anatomySvg() {
  const leader = (x1, y1, x2, y2) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${PAPER}" stroke-opacity=".5" stroke-width="1.1" fill="none"/>`;
  const note = (x, y, anchor, text) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="${PAPER}" fill-opacity=".8" font-family="inherit">${text}</text>`;
  return `<svg class="cc-anatomy" viewBox="-124 -58 248 152" width="100%" aria-hidden="true">` +
    `<g transform="translate(6 -12)">${markerMarkup(byName('alpha'), {text: false})}</g>` +
    // The shape is the innermost piece, so its leader crosses the dial to reach
    // a tail of the hexagon; the two o'clock side is the one the sense arc
    // leaves clear.
    leader(48, -44, 26, -24) + note(52, -47, 'start', 'the shape') +
    leader(62, -12, 44, -12) + note(66, -12, 'start', 'the clock') +
    leader(-34, 54, -18, 46) + note(-38, 57, 'end', 'the dots') +
    `</svg>`;
}

const box = (inner, half, size) => `<svg viewBox="${-half} ${-half} ${2 * half} ${2 * half}" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
const swatch = c => `<span class="swatch" style="background:${PALETTE[c]}"></span>`;

/** The legend the Notation button opens: what the symbol says, the four
 * generators as a table, and then the anatomy of a mark. */
export function legendMarkup() {
  const rows = GENERATORS.map(g => `<tr><td>${g.kind === 'translation' ? '' : `${g.glyph} `}${g.html}</td><td>${g.rotationShort}</td><td>${g.timeShort}</td><td>${g.colourShort}</td></tr>`).join('');
  const tau = byName('tau');
  // The symbol and the table come FIRST: a viewer who opens this panel wants to
  // know what the marks say before being told how the artwork says it, and on a
  // laptop only the first screenful is visible without scrolling.
  return `
<p class="lede">Each mark says three things at once: what to do, how long to wait, and what becomes of the colours.</p>
<p class="symbol">${SYMBOL_HTML}</p>
<table>
  <thead><tr><th>Generator</th><th>Rotation</th><th>Time</th><th>Colour</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>Read round the triangle of the three turns: the waits add to a whole number of loops (⅚ + ⅔ + ½ = 2) and the three colour moves undo one another. Both are the same statement — αβγ is the identity — once in time and once in colour. The slide after the dot is a reminder rather than a fourth fact: τ <i>is</i> γβα, in space, in time and in colour.</p>
<h3>Reading a mark</h3>
${anatomySvg()}
<dl>
  <dt>${box(`<g transform="scale(0.62)">${plate(COIN)}${glyphMarkup(6)}</g>`, 26, 46)}</dt>
  <dd><b>The shape</b> — which turn. A hexagon is a sixth of a turn, a triangle a third, a lens a half; the pale tails are the screw marks of the International Tables, and the small arc outside says the turn is the <b>anticlockwise</b> one. Playing the film runs the other way: every third of the loop it carries the picture a third of a turn clockwise with the colours unchanged — and a sixth of a turn clockwise is a symmetry only if teal and sand change places with it.</dd>
  <dt>${box(`<g transform="scale(0.78)">${dial(5, 6)}</g>`, 26, 46)}</dt>
  <dd><b>The violet clock</b> — how long you wait. It fills clockwise from twelve, through the fraction of the loop that turn carries. An empty ring means no waiting at all.</dd>
  <dt>${box(`${chip(tau.perm, {r: 27, digits: true})}`, 28, 54)}</dt>
  <dd><b>The three dots</b> — what happens to the colours. ${swatch(0)} terracotta <b>0</b> sits at twelve, ${swatch(1)} teal <b>1</b> at four, ${swatch(2)} sand <b>2</b> at eight, always, and those are the digits the superscript is written in. A double-headed arrow joins the two colours it exchanges and rings the one left alone; three chasing arrows cycle all three — clockwise is terracotta → teal → sand, anticlockwise is terracotta → sand → teal, which is the way both of this page's cycling marks run; three plain dots mean the colours never move.</dd>
  <dt>${box(`<line x1="0" y1="20" x2="0" y2="-12" stroke="${INK}" stroke-opacity=".84" stroke-width="7.5" stroke-linecap="round"/><line x1="0" y1="20" x2="0" y2="-12" stroke="${PAPER}" stroke-width="3" stroke-linecap="round"/><path d="M0,-20 L-7.5,-3 L7.5,-3 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`, 24, 46)}</dt>
  <dd><b>The plain arrow</b> — a slide, with no turn and no wait. A full head means a whole step of the picture’s own lattice.</dd>
</dl>
<p><b>Why the swap needs the half period.</b> A turn by <i>m</i> sixths about a centre recolours by σ(c) = (−1)<sup><i>m</i></sup>c − <i>j</i>, where <i>j</i> ∈ {0, 1, 2} says which of the three classes of sixfold centre it is (not the subscript of the symbol, which is the wait). A <i>swap</i> of two colours therefore needs <i>m</i> odd — an odd sixth of a period — while the even turns and the free slide only ever cycle the three. There is no way to exchange two colours without turning the picture and waiting as well, and that is what this page is about.</p>
<p class="foot">Strip the superscripts and the symbol is <b>6<sub>5</sub>3<sub>2</sub>2<sub>1</sub></b> — the catalogue’s <code>g247</code>, <code>p6</code>, orbifold 632 — on the lattice of motifs. Keep only the <i>symmetries</i> whose superscript is empty — one sixth of the group; every mark drawn here recolours — and it is <b>3<sub>2</sub>3<sub>2</sub>3<sub>2</sub></b>, <code>g225</code>, <code>p3</code>, on the lattice three times as large. The superscripts between them realise all six permutations of three colours, so the colour group is the whole of S₃.</p>
<p class="foot">The marks repeat with the pattern, and α always sits at the centre of the screen at the home view. Each one is a generator, not a census: the sixfold centre at the head of the slide belongs to a different class, <b>6<sub>5</sub><sup>(01)</sup></b>, because sliding by <i>b</i> conjugates the swap. Zoom out and they thin — first the labels, then γ, then β, leaving α and the slide — and about five times out the layer is hidden altogether; zoom back in and it returns. Press <b>G</b> for the marks, <b>N</b> for this panel, and share a view with <code>?generators=1</code> to open it <i>with</i> them (they are off until asked for).</p>`;
}

// ---- the overlay -----------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';

/** Draws the marks over the canvas and keeps them on the pattern.
 *
 * Units are pooled: a change of zoom that adds repeats appends only the new
 * ones, and only a change of TIER — which marks and labels are drawn at all —
 * rebuilds the layer. Every other draw moves existing nodes with transforms,
 * and a draw whose view is unchanged does nothing at all, so playback, which
 * never moves the view, costs nothing. Placement goes through the camera rather
 * than rotating a finished picture, because the pieces behave differently under
 * a view turn: the order glyph and the τ arrow are lattice directions and turn
 * with the view, while the dial, the sense arc, the chip and the label must not
 * — and the chip and the label must not even be CARRIED round the coin, or at
 * 60° they land on top of each other.
 */
export function createGeneratorOverlay(svg, view, {max = MAX_UNITS} = {}) {
  const layer = document.createElementNS(NS, 'g');
  svg.append(layer);
  const tau = byName('tau');
  const rotations = GENERATORS.filter(g => g.kind === 'rotation');
  let units = [], tier = null, coins = rotations, last = null, applied = null;

  function makeUnit(labels) {
    const node = document.createElementNS(NS, 'g');
    node.setAttribute('class', 'cc-unit');
    node.innerHTML = translationMarkup(tau, {text: labels.tau}) + coins.map(g => markerMarkup(g, {text: labels[g.name]})).join('');
    const slide = node.querySelector('.cc-translation');
    layer.append(node);
    return {
      node,
      slide: {
        node: slide,
        shaft: slide.querySelectorAll('line'),
        head: slide.querySelector('.cc-head'),
        mid: slide.querySelector('.cc-head-mid'),
        chip: slide.querySelector('.cc-chip-at'),
        label: slide.querySelector('.cc-label-at'),
        upright: slide.querySelectorAll('.cc-upright'),
      },
      marks: [...node.querySelectorAll('.cc-marker')].map(mark => ({
        node: mark, turn: mark.querySelector('.cc-turn'), label: mark.querySelector('.cc-label'),
      })),
    };
  }

  /** Grows or shrinks the pool to n units, rebuilding it from scratch only when
   * the tier has changed. */
  function build(n, spec = tier ?? {key: 'none', marks: [], labels: {}}) {
    if (!tier || spec.key !== tier.key) {
      layer.replaceChildren();
      units = [];
      tier = spec;
      coins = rotations.filter(g => spec.marks.includes(g.name));
      applied = null;
    }
    while (units.length > n) units.pop().node.remove();
    while (units.length < n) units.push(makeUnit(tier.labels));
  }

  return {
    get count() { return units.length; },
    /** Re-places every mark. `force` rebuilds even if the view has not moved,
     * which is what a change of visibility or of the palette needs. */
    update(width, height, {force = false} = {}) {
      const key = `${view.center[0]},${view.center[1]},${view.scale(width, height)},${view.angle},${width},${height}`;
      if (!force && key === last) return;
      last = key;
      const state = markScale(view, width, height, {max});
      const {scale, opacity, strength} = state;
      svg.style.opacity = opacity.toFixed(3);
      if (opacity <= 0) { if (units.length) build(0); return; }
      const cells = unitsInView(view, width, height, {max});
      build(cells.length, state);
      const degrees = view.angle * 180 / Math.PI;
      const turned = `rotate(${degrees.toFixed(2)})`;
      // A piece on its way out is faded to nothing BEFORE it leaves the
      // document, so a smooth zoom never drops a mark at full strength.
      const fading = `${strength.beta},${strength.gamma},${strength.alphaLabel},${strength.betaLabel}`;
      const fade = fading !== applied;
      applied = fading;
      // A label whose box would run off the edge is dropped, not clipped: half
      // a symbol floating with no mark under it is worse than no symbol.
      const labelFits = (x, y) => x > 58 * scale && x < width - 58 * scale && y > 15 * scale && y < height - 15 * scale;
      for (const [i, cell] of cells.entries()) {
        const unit = units[i];
        const [x0, y0] = cell.at;
        const [x1, y1] = screenOf(cell.cell.map((q, axis) => q + tau.vectorSixths[axis] / 6), view, width, height);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const dir = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        const slide = unit.slide;
        // The shaft starts clear of α's coin, which sits at its tail, and the
        // chip rides near the head rather than at the midpoint: at the home
        // framing the arrow is one motif — 380 px — and a chip halfway up it
        // reads as a mark of its own rather than as part of the arrow. Zoomed
        // in, the arrow is longer than the window, so the chip stops going with
        // the head and a mid-shaft head states the direction on screen instead.
        const from = Math.min(len * 0.3, (COIN + 9) * scale);
        const reach = 0.42 * Math.min(width, height);
        const capped = (len - from) * 0.72 > reach;
        const along = from + Math.min((len - from) * 0.72, reach);
        slide.node.setAttribute('transform', `translate(${x0.toFixed(2)} ${y0.toFixed(2)}) rotate(${dir.toFixed(2)})`);
        for (const line of slide.shaft) { line.setAttribute('x1', from.toFixed(2)); line.setAttribute('x2', len.toFixed(2)); }
        slide.shaft[0].setAttribute('stroke-width', (7.5 * scale).toFixed(2));
        slide.shaft[1].setAttribute('stroke-width', (3 * scale).toFixed(2));
        slide.head.setAttribute('transform', `translate(${len.toFixed(2)} 0) scale(${scale.toFixed(3)})`);
        slide.mid.setAttribute('display', capped ? 'inline' : 'none');
        if (capped) slide.mid.setAttribute('transform', `translate(${along.toFixed(2)} 0) scale(${scale.toFixed(3)})`);
        slide.chip.setAttribute('transform', `translate(${along.toFixed(2)} ${(tau.side * 34 * scale).toFixed(2)}) scale(${scale.toFixed(3)})`);
        if (slide.label) {
          const t = dir * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
          const lx = x0 + c * along - s * (-tau.side * 30 * scale), ly = y0 + s * along + c * (-tau.side * 30 * scale);
          slide.label.setAttribute('transform', `translate(${along.toFixed(2)} ${(-tau.side * 30 * scale).toFixed(2)}) scale(${scale.toFixed(3)})`);
          slide.label.style.display = labelFits(lx, ly) ? '' : 'none';
        }
        for (const node of slide.upright) node.setAttribute('transform', `rotate(${(-dir).toFixed(2)})`);
        for (const [j, mark] of unit.marks.entries()) {
          const item = coins[j];
          const [x, y] = screenOf(cell.cell.map((q, axis) => q + item.centreSixths[axis] / 6), view, width, height);
          mark.node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
          mark.turn.setAttribute('transform', turned);
          if (fade) mark.node.setAttribute('opacity', (strength[item.name] ?? 1).toFixed(3));
          if (mark.label) {
            const [dx, dy] = pol(item.labelR, item.labelDeg);
            mark.label.style.display = labelFits(x + dx * scale, y + dy * scale) ? '' : 'none';
            if (fade) mark.label.setAttribute('opacity', (strength[`${item.name}Label`] ?? 1).toFixed(3));
          }
        }
      }
    },
    /** The whole layer as one sentence, for the layer's aria-label. */
    description() {
      return `Generator marks on the pattern: ${GENERATORS.map(g => `${g.glyph} ${g.ascii} — ${g.reading}`).join('; ')}.`;
    },
    clear() { build(0); last = null; },
  };
}
