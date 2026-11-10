// hasse.js — the orbifold picker (SPEC 5.10): a modal dialog showing the Hasse diagram of the 17 wallpaper groups.
//
//   const picker = createHassePicker({ mount, groups: GROUPS, onPick(id) { … } });
//   chip.addEventListener('click', () => picker.open(currentGroupId));
//   picker.open(currentId);     // show it, with `currentId` marked as the current group; focus goes to that node
//   picker.close();             // hide it without picking; focus returns to whatever had it before open()
//   picker.isOpen();
//
// A click, Enter or Space on a node closes the dialog and then calls onPick(id) — except on the current node, which
// only closes (nothing changed). Esc, the × button and a click outside the card close too. Arrow keys move between
// nodes (rows = tiers), Home / End jump to ○ / ∗632, Tab alternates between the diagram and ×.
// Hooks for tests: the dialog is `.hasse-dialog` (it also has `.hasse-open` while shown), a node is
// `.hasse-node[data-id="<group id>"]` (its tap target `.hasse-hit`). The card is `.hasse-card`, with `.hasse-side`
// when the title, info line and key stand beside the diagram; `.hasse-scroll` carries `.hasse-more-above` /
// `.hasse-more-below` while the diagram is cut at that edge. The card fades in over 140 ms: wait ~250 ms before a
// screenshot.
//
// The module is self-contained: it injects its own <style> (class names prefixed `hasse-`) and its own DOM into
// `mount`, so it looks the same in dev/hasse-demo.html and in the bundled app. Every colour is a CSS custom property
// read in this order: its own name, the page shell's name, the palette.js constant —
//   --hasse-ink | --ink            --hasse-muted | --muted        --hasse-faint | --faint
//   --hasse-hairline | --hairline  --hasse-card | --card          --hasse-ground | --ground
//   --hasse-accent | --accent      --hasse-accent-soft | --accent-soft
//   --hasse-font | --font          --hasse-scrim (the veil over the page; default: ink at 20 %)
// set on :root or on any ancestor of `mount`.
//
// The first half of the file is pure geometry (no DOM) and is tested in test/hasse.test.js:
//   hasseLayout(width, height)  node positions, pill sizes, hit areas, row numbers and routed edges for a diagram of
//                               that pixel size; rows keep the data's proportions where there is room and are packed
//                               (every row still apart) in a short box, down to hasseMinHeight(width) ≈ 270–290 px
//   hasseMinHeight(width)       the least height that holds every row apart (below it the dialog's body scrolls)
//   hasseCardLayout(vw, vh, chrome)  stacked card, or (wide, short windows: phone landscape) the title, info line and
//                               key in a column beside a full-height diagram
//   hasseNavigate(id, key)      where an arrow key leads from a node
// Round 3 additions (the API of createHassePicker is unchanged): the side-by-side card, packed rows instead of a
// 420 px floor, a fade + chevron at an edge where the body must scroll, role="none" between the listbox and its
// options (so Chrome exposes 17 options with aria-selected), 13 px row numbers and key, and a key that says what a
// line is ("line = subgroup with the same translations: — index 2, - - index 3; row = order of the point group").
// Edges are the S-curves `M sx sy C sx midY, ex midY, ex ey` of the spec, fanned out a little where several leave
// one node. Where that curve would run behind the pill of a node it does not join (o→333 behind ∗×, 333→3∗3 behind
// 2∗22, 2222→22× behind 22∗, …) the picture would show an inclusion that does not exist, so those few edges get
// the smoothest cubic of the same family that keeps clear of every other pill.

import { HASSE_TIERS, HASSE_NODES, HASSE_EDGES } from './hasse-data.js';
import { INK, MUTED, FAINT, HAIRLINE, CARD, GROUND, ACCENT, ACCENT_SOFT, hexToRgb } from './palette.js';

// ------------------------------------------------------------------------------------------------------------
// Pure layout
// ------------------------------------------------------------------------------------------------------------

const TIERS = HASSE_TIERS.slice().sort((a, b) => a.y - b.y);

// Order of the point group of every node, read off the edge indices (the root is the one node that is nobody's
// supergroup). 22∗ and 22× sit off their tier line in the layout, so the y coordinate alone does not tell.
const ORDER = (() => {
  const order = new Map();
  const lower = new Set(HASSE_EDGES.map((e) => e[1]));
  for (const n of HASSE_NODES) if (!lower.has(n.id)) order.set(n.id, 1);
  for (let pass = 0; pass < HASSE_NODES.length; pass++) {
    for (const [u, v, index] of HASSE_EDGES) if (order.has(u) && !order.has(v)) order.set(v, order.get(u) * index);
  }
  return order;
})();

const ROW_OF = new Map(HASSE_NODES.map((n) => {
  let r = TIERS.findIndex((t) => t.order === ORDER.get(n.id));
  if (r < 0) { // data without a matching tier: nearest tier line
    r = 0;
    for (let i = 1; i < TIERS.length; i++) if (Math.abs(TIERS[i].y - n.y) < Math.abs(TIERS[r].y - n.y)) r = i;
  }
  return [n.id, r];
}));

/** The rows of the diagram, top to bottom: ids of the groups whose point group has the tier's order, left to right. */
export const HASSE_ROWS = TIERS.map((t, r) =>
  HASSE_NODES.filter((n) => ROW_OF.get(n.id) === r).sort((a, b) => a.x - b.x).map((n) => n.id));

const DATA = new Map(HASSE_NODES.map((n) => [n.id, n]));

/**
 * Keyboard navigation. `key` is a KeyboardEvent.key; `wantX` is the column (data x) remembered while moving
 * vertically, so Down then Up comes back to the same node. Returns { id, wantX } (the same id when the key leads nowhere).
 */
export function hasseNavigate(id, key, wantX = null) {
  const node = DATA.get(id);
  if (!node) return { id: HASSE_ROWS[0][0], wantX: null };
  const r = ROW_OF.get(id), row = HASSE_ROWS[r], i = row.indexOf(id);
  if (key === 'ArrowLeft') return { id: row[Math.max(0, i - 1)], wantX: null };
  if (key === 'ArrowRight') return { id: row[Math.min(row.length - 1, i + 1)], wantX: null };
  if (key === 'Home') return { id: HASSE_ROWS[0][0], wantX: null };
  if (key === 'End') { const last = HASSE_ROWS[HASSE_ROWS.length - 1]; return { id: last[last.length - 1], wantX: null }; }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const x = wantX == null ? node.x : wantX;
    const step = key === 'ArrowUp' ? -1 : 1;
    for (let q = r + step; q >= 0 && q < HASSE_ROWS.length; q += step) {
      if (!HASSE_ROWS[q].length) continue;
      let best = HASSE_ROWS[q][0];
      for (const c of HASSE_ROWS[q]) if (Math.abs(DATA.get(c).x - x) < Math.abs(DATA.get(best).x - x)) best = c;
      return { id: best, wantX: x };
    }
    return { id, wantX: x };
  }
  return { id, wantX };
}

/** Distance from a point to a pill (a stadium: a horizontal segment thickened by its half-height); negative inside. */
export function pillGap(px, py, n) {
  const ax = Math.abs(px - n.x) - (n.hw - n.hh);
  const dx = ax > 0 ? ax : 0, dy = py - n.y;
  return Math.sqrt(dx * dx + dy * dy) - n.hh;
}

// Bernstein weights at NS + 1 parameters, shared by every curve evaluation.
const NS = 40;
const BERN = (() => {
  const b = new Float64Array(4 * (NS + 1));
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, s = 1 - t;
    b[4 * i] = s * s * s; b[4 * i + 1] = 3 * s * s * t; b[4 * i + 2] = 3 * s * t * t; b[4 * i + 3] = t * t * t;
  }
  return b;
})();

/** Smallest gap between the cubic p = [x0,y0, x1,y1, x2,y2, x3,y3] and the obstacles; stops early once below `floor`. */
function curveGap(p, obstacles, floor, xmin, xmax) {
  let min = Infinity;
  for (let i = 1; i < NS; i++) {
    const k = 4 * i;
    const x = BERN[k] * p[0] + BERN[k + 1] * p[2] + BERN[k + 2] * p[4] + BERN[k + 3] * p[6];
    const y = BERN[k] * p[1] + BERN[k + 1] * p[3] + BERN[k + 2] * p[5] + BERN[k + 3] * p[7];
    if (x < xmin || x > xmax) return -Infinity;
    for (let j = 0; j < obstacles.length; j++) {
      const g = pillGap(x, y, obstacles[j]);
      if (g < min) { min = g; if (min < floor) return min; }
    }
  }
  return min;
}

// The family of curves an edge may take: the cubic [S, S + (k1·u, a·dy), E + (k2·u, −b·dy), E]. (a, b) slide the two
// control points along the vertical — a = b = 0.5 with k1 = k2 = 0 is the plain S-curve of the spec — and (k1, k2)
// push them sideways by multiples of the pill height, which tilts the curve where it leaves or enters a node.
const MAX_PUSH = 4;
const SHAPES = (() => {
  const AB = [0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86];
  const list = [];
  for (const a of AB) for (const b of AB) {
    if (a + b > 1.25) continue;                       // both control points past each other: a needless kink
    for (let k1 = -MAX_PUSH; k1 <= MAX_PUSH; k1++) for (let k2 = -MAX_PUSH; k2 <= MAX_PUSH; k2++) {
      list.push({ a, b, k1, k2, plain: a === 0.5 && b === 0.5 && !k1 && !k2 });
    }
  }
  return list.sort((p, q) => (q.plain ? 1 : 0) - (p.plain ? 1 : 0));   // the plain S-curve first
})();
const TILT_COST = 0.6;   // per pill height of sideways push, in units of bending energy
const PORT_STEP = 9;     // px between neighbouring edges where they leave a pill
const SCRATCH = new Float64Array(8), COSTS = new Float64Array(SHAPES.length);

function shapePoints(s, sx, sy, ex, ey, unit, out) {
  const dy = ey - sy;
  out[0] = sx; out[1] = sy; out[2] = sx + s.k1 * unit; out[3] = sy + s.a * dy;
  out[4] = ex + s.k2 * unit; out[5] = ey - s.b * dy; out[6] = ex; out[7] = ey;
  return out;
}

/** Bending energy of a cubic, made scale-free: chord length x the integral of curvature squared along the curve. */
export function bendEnergy(p) {
  const ax = p[2] - p[0], ay = p[3] - p[1], bx = p[4] - p[2], by = p[5] - p[3], cx = p[6] - p[4], cy = p[7] - p[5];
  const n = 12;
  let e = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, s = 1 - t;
    const vx = 3 * (s * s * ax + 2 * s * t * bx + t * t * cx), vy = 3 * (s * s * ay + 2 * s * t * by + t * t * cy);
    const wx = 6 * (s * (bx - ax) + t * (cx - bx)), wy = 6 * (s * (by - ay) + t * (cy - by));
    const v2 = vx * vx + vy * vy, cross = vx * wy - vy * wx;
    if (v2 > 1e-9) e += (cross * cross) / (v2 * v2 * Math.sqrt(v2));
  }
  return (e / n) * Math.hypot(p[6] - p[0], p[7] - p[1]);
}

/**
 * Route one edge from S to E. The plain S-curve wins whenever it keeps `clear` px away from every other pill;
 * otherwise the smoothest curve of the family that does (least bending, with a small charge for tilted ends).
 */
function routeEdge(sx, sy, ex, ey, obstacles, clear, unit, xmin, xmax) {
  const plain = shapePoints(SHAPES[0], sx, sy, ex, ey, unit, new Array(8));
  const gap0 = curveGap(plain, obstacles, clear, xmin, xmax);
  if (gap0 >= clear) return { p: plain, gap: gap0, shape: SHAPES[0], cost: bendEnergy(plain) };
  // only the pills the family can come near (a cubic stays inside the hull of its control points)
  const reach = MAX_PUSH * unit + clear;
  const lo = Math.min(sx, ex) - reach, hi = Math.max(sx, ex) + reach;
  const near = obstacles.filter((o) => o.x + o.hw > lo && o.x - o.hw < hi && o.y + o.hh > sy - clear && o.y - o.hh < ey + clear);
  for (let i = 0; i < SHAPES.length; i++) {
    const s = SHAPES[i];
    COSTS[i] = bendEnergy(shapePoints(s, sx, sy, ex, ey, unit, SCRATCH)) + TILT_COST * (Math.abs(s.k1) + Math.abs(s.k2));
  }
  for (const want of [clear, clear * 0.7, clear * 0.45, 1.5]) {   // relax the margin only if nothing gets through
    let best = -1, bestGap = 0;
    for (let i = 0; i < SHAPES.length; i++) {
      if (best >= 0 && COSTS[i] >= COSTS[best]) continue;
      const gap = curveGap(shapePoints(SHAPES[i], sx, sy, ex, ey, unit, SCRATCH), near, want, xmin, xmax);
      if (gap >= want) { best = i; bestGap = gap; }
    }
    if (best >= 0) return { p: Array.from(shapePoints(SHAPES[best], sx, sy, ex, ey, unit, SCRATCH)), gap: bestGap, shape: SHAPES[best], cost: COSTS[best] };
  }
  let best = 0, bestGap = -Infinity;                              // last resort: the widest berth
  for (let i = 0; i < SHAPES.length; i++) {
    const gap = curveGap(shapePoints(SHAPES[i], sx, sy, ex, ey, unit, SCRATCH), near, bestGap, xmin, xmax);
    if (gap > bestGap) { best = i; bestGap = gap; }
  }
  return { p: Array.from(shapePoints(SHAPES[best], sx, sy, ex, ey, unit, SCRATCH)), gap: bestGap, shape: SHAPES[best], cost: COSTS[best] };
}

const fmt = (v) => String(Math.round(v * 10) / 10);

// Vertical placement. Where there is room the rows keep the proportions of the data (exactly the uniform scale of
// v1). A short diagram (phone landscape, a phone under the host bar) cannot keep them: 22∗ sits 40 data units under
// 333 but in the next row, so a uniform scale needs 420 px before the rule between those rows clears both pills. So
// the gaps that must not shrink are kept — between the pills of neighbouring rows (the rule runs half way between)
// and between pills of one row that overlap horizontally (22∗ above 22×) — and only the rest is scaled to fit.
const ROW_GAP = 4;                    // px between the pills of neighbouring rows
const PILL_GAP = 4;                   // px between two pills of one row that overlap horizontally
const PAD_Y = 26, PAD_Y_MIN = 22;     // centre of the top (bottom) pill to the box's edge; 22 = half a 44 px hit area
const LABEL_FONT = 13;                // the row numbers (point-group orders)
const HIT = 44;                       // px: the tap target around a pill
const KNOTS = [...new Set(HASSE_NODES.map((n) => n.y))].sort((a, b) => a - b);
const NK = KNOTS.length;
const KNOT_OF = new Map(HASSE_NODES.map((n) => [n.id, KNOTS.indexOf(n.y)]));

/** Least vertical distance between every two knots (data y levels) the pills ask for, as an NK x NK table. */
function knotGaps(nodes) {
  const g = new Float64Array(NK * NK);
  for (const a of nodes) {
    for (const b of nodes) {
      const i = KNOT_OF.get(a.id), j = KNOT_OF.get(b.id);
      if (i >= j) continue;
      let need = 0;
      if (a.row !== b.row) need = a.hh + b.hh + ROW_GAP;
      else {
        const dx = Math.max(0, Math.abs(a.x - b.x) - (a.hw - a.hh) - (b.hw - b.hh)), r = a.hh + b.hh + PILL_GAP;
        if (dx < r) need = Math.sqrt(r * r - dx * dx);
      }
      if (need > g[i * NK + j]) g[i * NK + j] = need;
    }
  }
  return g;
}

/** Knot positions: proportional to the data with k px per unit, but never closer than the gaps ask (top knot at `top`). */
function placeKnots(k, gaps, top) {
  const Y = new Float64Array(NK);
  Y[0] = top;
  for (let j = 1; j < NK; j++) {
    let y = Y[j - 1] + k * (KNOTS[j] - KNOTS[j - 1]);
    for (let i = 0; i < j; i++) { const need = gaps[i * NK + j]; if (need && Y[i] + need > y) y = Y[i] + need; }
    Y[j] = y;
  }
  return Y;
}

/**
 * Knot positions for a diagram H px tall -> { Y, height, least }. `least` is the smallest height that holds every
 * gap; below it the diagram is drawn at that height (height > H) and the dialog scrolls.
 */
function solveKnots(gaps, H) {
  const span = KNOTS[NK - 1] - KNOTS[0];
  const content = placeKnots(0, gaps, 0)[NK - 1];
  const least = Math.ceil(content + 2 * PAD_Y_MIN);
  if (!(H > least)) return { Y: placeKnots(0, gaps, PAD_Y_MIN), height: least, least };
  const padY = Math.min(PAD_Y, PAD_Y_MIN + (H - least) / 2);
  const room = H - 2 * padY;
  let Y = placeKnots(room / span, gaps, padY);                 // the uniform scale, when it keeps every gap
  if (Y[NK - 1] - padY > room + 1e-9) {
    let lo = 0, hi = room / span;
    for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (placeKnots(mid, gaps, 0)[NK - 1] > room) hi = mid; else lo = mid; }
    Y = placeKnots(lo, gaps, padY);
  }
  return { Y, height: H, least };
}

/** Width of a row number in px (an estimate, like the pills'). */
const labelWidth = (order) => String(order).length * LABEL_FONT * 0.62;

/**
 * Hit areas: HIT x HIT px (or the pill, if larger) around every pill, then trimmed so that no two overlap and none
 * covers another node's pill — a tap goes to the nearest pill even where a short diagram packs the rows tightly.
 */
function hitBoxes(nodes) {
  const pill = (n) => ({ l: n.x - n.hw, r: n.x + n.hw, t: n.y - n.hh, b: n.y + n.hh });
  const meets = (p, q) => p.l < q.r - 1e-9 && q.l < p.r - 1e-9 && p.t < q.b - 1e-9 && q.t < p.b - 1e-9;
  for (const n of nodes) {
    const hx = Math.max(HIT / 2, n.hw), hy = Math.max(HIT / 2, n.hh);
    n.hit = { l: n.x - hx, r: n.x + hx, t: n.y - hy, b: n.y + hy };
  }
  // the side of `a` that faces `b`, split half way between their pills along the axis on which they are further apart
  const split = (a, b) => {
    const [u, d] = a.y <= b.y ? [a, b] : [b, a], [L, R] = a.x <= b.x ? [a, b] : [b, a];
    const gy = (d.y - d.hh) - (u.y + u.hh), gx = (R.x - R.hw) - (L.x + L.hw);
    return gy >= gx ? { axis: 'y', lo: u, hi: d, at: (u.y + u.hh + d.y - d.hh) / 2 } : { axis: 'x', lo: L, hi: R, at: (L.x + L.hw + R.x - R.hw) / 2 };
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!meets(a.hit, b.hit)) continue;
      const s = split(a, b);
      if (s.axis === 'y') { s.lo.hit.b = Math.min(s.lo.hit.b, s.at); s.hi.hit.t = Math.max(s.hi.hit.t, s.at); }
      else { s.lo.hit.r = Math.min(s.lo.hit.r, s.at); s.hi.hit.l = Math.max(s.hi.hit.l, s.at); }
    }
  }
  for (const a of nodes) {                    // diagonal neighbours: keep off the corner of the other pill
    for (const b of nodes) {
      if (a === b || !meets(a.hit, pill(b))) continue;
      const s = split(a, b), pb = pill(b);
      if (s.axis === 'y') { if (a === s.lo) a.hit.b = Math.min(a.hit.b, pb.t); else a.hit.t = Math.max(a.hit.t, pb.b); }
      else if (a === s.lo) a.hit.r = Math.min(a.hit.r, pb.l); else a.hit.l = Math.max(a.hit.l, pb.r);
    }
  }
}

/**
 * Positions without the edges: { W, height, least, font, compact, hh, nodes, rows }. Shared by hasseLayout and
 * hasseMinHeight. H = 0 asks for the least height.
 */
function planLayout(width, askedHeight, opts = {}) {
  const W = Math.max(240, Math.round(width)), H = Math.max(0, Math.round(askedHeight) || 0);
  const labels = opts.labels || {}, textWidths = opts.textWidths || {};
  const compact = W < 470;
  const tight = W < 310;                                   // a 320 px phone: every pixel counts
  const font = W < 330 ? 13 : compact ? 14 : 15;
  const hh = compact ? 14 : 15;
  const padX = tight ? 6 : compact ? 8 : 11, minHw = tight ? 18 : compact ? 19 : 21;

  let xmin = Infinity, xmax = -Infinity;
  for (const n of HASSE_NODES) { xmin = Math.min(xmin, n.x); xmax = Math.max(xmax, n.x); }
  const nodes = HASSE_NODES.map((n) => {
    const glyphs = [...String(labels[n.id] ?? n.id)].length;
    const tw = Math.max(glyphs * font * 0.62, textWidths[n.id] || 0);
    return { id: n.id, x: 0, y: 0, hw: Math.max(minHw, Math.ceil(tw / 2 + padX)), hh, row: ROW_OF.get(n.id), order: ORDER.get(n.id), dx: n.x };
  });
  // Horizontal: the leftmost and rightmost pills touch the margins, everything else is spaced in proportion. The
  // row numbers sit at the left edge of their rows: where a pill would reach under its row's number (632 under "6"
  // on a phone), the left margin makes room for it.
  let hwL = minHw, hwR = minHw;
  for (const n of nodes) { if (n.dx === xmin) hwL = n.hw; if (n.dx === xmax) hwR = n.hw; }
  const marginR = compact ? 3 : 14;
  const placeX = (marginL) => {
    const x0 = marginL + hwL, x1 = W - marginR - hwR, kx = (x1 - x0) / (xmax - xmin || 1);
    for (const n of nodes) n.x = x0 + (n.dx - xmin) * kx;
  };
  let marginL = compact ? 3 : 24;
  placeX(marginL);
  let gutter = 0;
  for (const n of nodes) {
    const need = 2 + labelWidth(n.order) + 4;            // the number at x = 2, then 4 px of air
    if (n.x - n.hw < need) gutter = Math.max(gutter, need);
  }
  if (gutter > marginL) { marginL = Math.ceil(gutter); placeX(marginL); }

  const gaps = knotGaps(nodes);
  const { Y, height, least } = solveKnots(gaps, H);
  for (const n of nodes) { n.y = Y[KNOT_OF.get(n.id)]; delete n.dx; }

  // Rows: the band of each tier, bounded half-way between the pills of neighbouring tiers. The row's number sits
  // in the top left corner of its band (baseline labelY).
  const rows = TIERS.map((t, r) => {
    let top = Infinity, bottom = -Infinity;
    for (const n of nodes) if (n.row === r) { top = Math.min(top, n.y - n.hh); bottom = Math.max(bottom, n.y + n.hh); }
    return { order: t.order, y: Y[KNOTS.indexOf(t.y)], top, bottom };
  });
  for (let r = 0; r < rows.length; r++) {
    const a = rows[r], b = rows[r + 1];
    const cut = b ? (a.bottom + b.top) / 2 : height;
    a.bottom = cut; if (b) b.top = cut;
  }
  if (rows.length) rows[0].top = 0;
  for (const row of rows) { row.labelX = 2; row.labelY = Math.round(row.top) + LABEL_FONT; }
  hitBoxes(nodes);
  return { W, height, least, font, compact, hh, nodes, rows };
}

/** The least height (px) at which the diagram holds every gap for this width: below it the dialog scrolls. */
export function hasseMinHeight(width, opts = {}) { return planLayout(width, 0, opts).least; }

/**
 * Lay the diagram out in a width x height box of CSS pixels (the SVG is drawn 1 unit = 1 px, so text and pills
 * keep their size on a phone while the positions spread to the room there is).
 * opts.labels      {id: display label} — only the number of glyphs matters (default: the id)
 * opts.textWidths  {id: measured label width in px} — widens a pill when the real text is wider than the estimate
 * Returns { width, height, least, font, compact, nodes: [{id, x, y, hw, hh, row, order, hit: {l, r, t, b}}],
 *           edges: [{u, v, index, d, p, gap}], rows: [{order, y, top, bottom, labelX, labelY}] }.
 * height = the height asked for, or `least` (the smallest height that fits, see hasseMinHeight) when that is more.
 */
export function hasseLayout(width, height, opts = {}) {
  const plan = planLayout(width, height, opts);
  const { W, compact, hh, nodes } = plan;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Ports: the edges of a node fan out along its pill instead of sharing one point, ordered by the direction of
  // the other end, so edges that leave together never cross and never run on top of each other.
  const from = HASSE_EDGES.map(() => 0), into = HASSE_EDGES.map(() => 0);
  for (const n of nodes) {
    for (const [side, ports] of [[0, from], [1, into]]) {
      const list = [];
      HASSE_EDGES.forEach(([u, v], i) => {
        if ((side ? v : u) !== n.id) return;
        const other = byId.get(side ? u : v);
        list.push({ i, slope: (other.x - n.x) / Math.abs(other.y - n.y) });
      });
      list.sort((p, q) => p.slope - q.slope);
      const step = list.length > 1 ? Math.min(PORT_STEP, (2 * (n.hw - 7)) / (list.length - 1)) : 0;
      list.forEach((e, j) => { ports[e.i] = (j - (list.length - 1) / 2) * step; });
    }
  }

  const clear = compact ? 6 : 9;
  const edges = HASSE_EDGES.map(([u, v, index], i) => {
    const a = byId.get(u), b = byId.get(v);
    const obstacles = nodes.filter((n) => n !== a && n !== b);
    const r = routeEdge(a.x + from[i], a.y, b.x + into[i], b.y, obstacles, clear, hh, 2, W - 2);
    const p = r.p;
    const d = `M${fmt(p[0])} ${fmt(p[1])}C${fmt(p[2])} ${fmt(p[3])} ${fmt(p[4])} ${fmt(p[5])} ${fmt(p[6])} ${fmt(p[7])}`;
    return { u, v, index, d, p, gap: r.gap, shape: r.shape, cost: r.cost };
  });
  return { width: W, height: plan.height, least: plan.least, font: plan.font, compact, nodes, edges, rows: plan.rows };
}

// ------------------------------------------------------------------------------------------------------------
// The dialog
// ------------------------------------------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
// The diagram is drawn at most MAX_W x MAX_H px (MAX_SIDE_W wide beside the key), never flatter than
// hasseMinHeight(width) (about 290 px); in a window shorter than that the dialog's body scrolls, with a cue.
const MAX_W = 540, MAX_H = 560, MAX_SIDE_W = 600;
const SIDE_W = 214;          // px: the column of title, info line and key beside the diagram
const SIDE_MIN_W = 286;      // px: the narrowest diagram beside that column (the layout's narrowest tested width)
const COMFY_H = 420;         // px: a stacked diagram at least this tall (or 1.5 x its width) keeps the stacked card
const CUE = 34;              // px: height of the fade at a cut edge (keep a focused node out from under it)
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * How the card is arranged in a vw x vh window (px), given `chrome` = the height of the stacked card's title row +
 * info line + key + border. Two arrangements: stacked (title, diagram, info line and key below it) wherever the
 * diagram gets at least COMFY_H px (or 1.5 x its width) that way — every portrait window and every laptop. In a wide,
 * short window (a phone on its side, a short laptop window) the title, info line and key move into a column of
 * SIDE_W px beside the diagram, which then has the card's full height. Either way hasseLayout lays the diagram out
 * for the height it gets (o on top, every row apart, down to hasseMinHeight, about 280 px); only below that does
 * the body scroll, with a cue at each cut edge.
 * Returns { side, margin, pad, padV, cardW, stackedCardW, W, H }: W x H is the box for hasseLayout, padV the
 * padding above and below the diagram, cardW the card's width.
 */
export function hasseCardLayout(vw, vh, chrome) {
  const narrow = vw < 500, short = vh < 480, tiny = vh < 360;
  const margin = tiny ? 4 : narrow || short ? 8 : 16, pad = narrow ? 8 : 16;
  const stackedCardW = Math.max(260, Math.min(vw - 2 * margin, MAX_W + 2 * pad + 2));
  const Ws = stackedCardW - 2 * pad - 2;
  const Hs = Math.round(Math.min(vh - 2 * margin - chrome, MAX_H, Ws * 1.5));
  const padV = tiny ? 4 : 8;
  const Wd = Math.floor(Math.min(MAX_SIDE_W, vw - 2 * margin - 2 - 2 * pad - SIDE_W));
  const Hd = Math.round(Math.min(vh - 2 * margin - 2 - 2 * padV, MAX_H, Wd * 1.5));
  if (Hs < Math.min(COMFY_H, Ws * 1.5) && Wd >= SIDE_MIN_W && Hd > Hs) {
    return { side: true, margin, pad, padV, cardW: Wd + 2 * pad + SIDE_W + 2, stackedCardW, W: Wd, H: Hd };
  }
  return { side: false, margin, pad, padV: 0, cardW: stackedCardW, stackedCardW, W: Ws, H: Hs };
}

const NEIGHBOURS = (() => {
  const m = new Map(HASSE_NODES.map((n) => [n.id, new Set()]));
  for (const [u, v] of HASSE_EDGES) { m.get(u).add(v); m.get(v).add(u); }
  return m;
})();

function css() {
  const [r, g, b] = hexToRgb(INK).map((v) => Math.round(v * 255));
  const ink = (alpha) => `rgba(${r},${g},${b},${alpha})`;
  return `
.hasse-dialog{--_ink:var(--hasse-ink,var(--ink,${INK}));--_muted:var(--hasse-muted,var(--muted,${MUTED}));--_faint:var(--hasse-faint,var(--faint,${FAINT}));--_line:var(--hasse-hairline,var(--hairline,${HAIRLINE}));--_card:var(--hasse-card,var(--card,${CARD}));--_bg:var(--hasse-ground,var(--ground,${GROUND}));--_acc:var(--hasse-accent,var(--accent,${ACCENT}));--_accsoft:var(--hasse-accent-soft,var(--accent-soft,${ACCENT_SOFT}));
position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;display:none;align-items:center;justify-content:center;background:var(--hasse-scrim,${ink(0.2)});color:var(--_ink);font-family:var(--hasse-font,var(--font,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif));font-size:14px;font-weight:400;font-style:normal;line-height:1.35;letter-spacing:normal;text-align:left;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent;overscroll-behavior:contain;outline:none}
.hasse-dialog.hasse-open{display:flex}
.hasse-dialog::backdrop{background:transparent}
.hasse-card{--_pad:16px;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;background:var(--_bg);border:1px solid var(--_line);border-radius:8px;box-shadow:0 12px 32px ${ink(0.1)},0 2px 6px ${ink(0.05)};overflow:hidden;animation:hasse-in .14s ease-out}
@keyframes hasse-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.hasse-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 2px 0 var(--_pad)}
.hasse-title{margin:0;padding:0;font-size:16px;font-weight:600;line-height:1.25;color:var(--_ink)}
.hasse-dialog .hasse-close{all:unset;flex:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:8px;color:var(--_muted);cursor:pointer;-webkit-tap-highlight-color:transparent}
.hasse-dialog .hasse-close:hover{color:var(--_ink);background:var(--_card)}
.hasse-dialog .hasse-close:focus-visible{outline:2px solid var(--_ink);outline-offset:-5px}
.hasse-close svg{display:block;pointer-events:none}
.hasse-scroll{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.hasse-body{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;padding:var(--_padv,0px) var(--_pad);overscroll-behavior:contain}
.hasse-cue{position:absolute;left:1px;right:1px;height:34px;display:flex;justify-content:center;color:var(--_muted);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s}
.hasse-cue svg{display:block;flex:none;margin:3px 0}
.hasse-cue-top{top:0;align-items:flex-start;background:linear-gradient(to bottom,var(--_bg) 25%,transparent)}
.hasse-cue-bottom{bottom:0;align-items:flex-end;background:linear-gradient(to top,var(--_bg) 25%,transparent)}
.hasse-more-above>.hasse-cue-top,.hasse-more-below>.hasse-cue-bottom{opacity:1;visibility:visible}
.hasse-svg{display:block;max-width:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.hasse-rule{stroke:var(--_line);stroke-width:1;shape-rendering:crispEdges}
.hasse-rowlabel{fill:var(--_muted);font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}
.hasse-edge{fill:none;stroke:var(--_faint);stroke-width:1.3;stroke-linecap:round;transition:stroke .12s,stroke-opacity .12s,stroke-width .12s}
.hasse-edge.hasse-i3{stroke-dasharray:5 4.5}
.hasse-has-active .hasse-edge{stroke-opacity:.38}
.hasse-has-active .hasse-edge.hasse-on{stroke:var(--_ink);stroke-opacity:1;stroke-width:2}
.hasse-node{cursor:pointer;outline:none}
.hasse-node:focus{outline:none}
.hasse-hit{fill:transparent;stroke:none;pointer-events:all}
.hasse-pill{fill:var(--_bg);stroke:var(--_faint);stroke-opacity:.85;stroke-width:1;transition:stroke .12s,stroke-opacity .12s,fill .12s}
.hasse-label{fill:var(--_ink);font-weight:600;text-anchor:middle;pointer-events:none;transition:fill-opacity .12s}
.hasse-halo{fill:none;stroke:var(--_accsoft);stroke-width:3;visibility:hidden;pointer-events:none}
.hasse-ring{fill:none;stroke:var(--_ink);stroke-width:2;visibility:hidden;pointer-events:none}
.hasse-has-active .hasse-node .hasse-label{fill-opacity:.62}
.hasse-has-active .hasse-node .hasse-pill{stroke-opacity:.45}
.hasse-has-active .hasse-node.hasse-near .hasse-label,.hasse-has-active .hasse-node.hasse-active .hasse-label,.hasse-has-active .hasse-node.hasse-current .hasse-label{fill-opacity:1}
.hasse-has-active .hasse-node.hasse-near .hasse-pill{stroke:var(--_ink);stroke-opacity:.75}
.hasse-node.hasse-active .hasse-pill,.hasse-has-active .hasse-node.hasse-active .hasse-pill{stroke:var(--_ink);stroke-opacity:1;stroke-width:1.75}
.hasse-node.hasse-current .hasse-pill,.hasse-has-active .hasse-node.hasse-current .hasse-pill{fill:var(--_acc);stroke:var(--_acc);stroke-opacity:1}
.hasse-node.hasse-current .hasse-label{fill:var(--_bg);fill-opacity:1}
.hasse-node.hasse-current .hasse-halo{visibility:visible}
.hasse-node.hasse-current.hasse-active .hasse-pill{stroke:var(--_ink)}
.hasse-node.hasse-focus .hasse-ring{visibility:visible}
.hasse-node.hasse-off{cursor:default}
.hasse-node.hasse-off .hasse-label{fill-opacity:.35}
.hasse-foot{flex:none;padding:8px var(--_pad) 12px}
.hasse-info{margin:0;padding:0;min-height:22px;font-size:15px;line-height:22px;color:var(--_muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hasse-info b{font-weight:600;color:var(--_ink)}
.hasse-legend{display:flex;flex-wrap:wrap;align-items:center;gap:2px 14px;margin:4px 0 0;padding:0;font-size:13px;line-height:18px;color:var(--_muted)}
.hasse-key{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.hasse-keys{display:inline-flex;gap:2px 14px;white-space:nowrap}
.hasse-key-row{flex-basis:100%}
.hasse-key svg{display:block;flex:none}
.hasse-card.hasse-side{display:grid;grid-template-columns:auto var(--_side,214px);grid-template-rows:auto minmax(0,1fr)}
.hasse-side>.hasse-scroll{grid-column:1;grid-row:1/span 2}
.hasse-side>.hasse-head{grid-column:2;grid-row:1;align-items:flex-start;padding:4px 2px 0 4px}
.hasse-side .hasse-title{padding-top:12px}
.hasse-side>.hasse-foot{grid-column:2;grid-row:2;padding:6px 14px 12px 4px}
.hasse-side .hasse-info{white-space:normal;overflow:visible;line-height:20px}
.hasse-side .hasse-info b{display:block;font-size:20px;line-height:26px}
.hasse-side .hasse-sep{display:none}
.hasse-side .hasse-legend{display:block;margin-top:14px}
.hasse-side .hasse-keys{display:block}
.hasse-side .hasse-key{display:flex;white-space:normal;margin:0 0 4px}
@media (prefers-reduced-motion:reduce){.hasse-card{animation:none}.hasse-edge,.hasse-pill,.hasse-label,.hasse-cue{transition:none}}
`;
}

function injectStyle(doc, host) {
  const root = host.getRootNode ? host.getRootNode() : doc;
  const target = root && root.nodeType === 11 ? root : doc.head || doc.documentElement;   // 11: a shadow root
  if (target.querySelector && target.querySelector('style[data-hasse]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-hasse', '');
  style.textContent = css();
  target.appendChild(style);
}

/** How a screen reader should say an orbifold symbol: "∗632" -> "star 6 3 2". */
function spoken(label) {
  const words = { '∗': 'star', '*': 'star', '×': 'cross', 'x': 'cross', '○': 'o' };
  return [...String(label)].map((c) => words[c] || c).join(' ');
}

let instances = 0;

/**
 * createHassePicker({ mount, groups, onPick(id) }) -> { open(currentId), close(), isOpen() }
 *   mount   element the dialog is appended to (default: document.body)
 *   groups  the Group objects of groups.js (id, label, hm, shape are read); a node whose id is missing is shown but cannot be picked
 *   onPick  called with the id after the dialog has closed and focus is back on the opener — not called when the
 *           node picked is the current one (nothing changes, the dialog just closes)
 */
export function createHassePicker({ mount, groups, onPick } = {}) {
  const doc = (mount && mount.ownerDocument) || document;
  const win = doc.defaultView || window;
  const uid = ++instances;

  const meta = new Map();
  for (const g of groups || []) if (g && g.id != null) meta.set(g.id, { label: g.label || g.id, hm: g.hm || '', shape: g.shape || '' });
  const labels = {};
  for (const n of HASSE_NODES) labels[n.id] = meta.has(n.id) ? meta.get(n.id).label : n.id;

  // Was the user's last action a key press? Decides whether the focus ring shows when the dialog opens.
  let keyboardLast = false;
  doc.addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboardLast = true; }, true);
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
    doc.addEventListener(type, () => { keyboardLast = false; }, { capture: true, passive: true });
  }
  // Where the mouse is. A browser reports "the pointer entered" for whatever appears under a mouse that is lying
  // still; `parked` is the position the mouse had when the dialog opened, and such reports from it are ignored, so
  // a node that happens to open under an idle mouse does not take the highlight (or the keyboard focus).
  let mouseAt = null, parked = null;
  const trackMouse = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mouseAt = [e.clientX, e.clientY];
    if (parked && (parked[0] !== mouseAt[0] || parked[1] !== mouseAt[1])) parked = null;
  };
  for (const type of win.PointerEvent ? ['pointermove', 'pointerdown'] : ['mousemove', 'mousedown']) {
    doc.addEventListener(type, trackMouse, { capture: true, passive: true });
  }

  const native = typeof win.HTMLDialogElement === 'function' && typeof win.HTMLDialogElement.prototype.showModal === 'function';
  let dlg = null, card, head, scroller, body, foot, closeBtn, svg, rulesG, edgesG, nodesG, infoLabel, infoSep, infoRest;
  let bodyPadTop = 0;          // px above the diagram inside the scrolling body (side-by-side card)
  const nodeEls = new Map();   // id -> { g, hit, halo, ring, pill, text }
  const edgeEls = [];          // { u, v, path }
  let built = false, isOpen = false, modal = false;
  let currentId = null, focusId = null, hoverId = null, wantX = null;
  let kbd = false, nodeFocused = false, opener = null, downOnScrim = false, openedAt = 0, raf = 0;
  let memo = null, measured = { font: 0, widths: {} }, drawn = null;   // drawn: the layout now on screen

  const h = (name, cls, parent, text) => {
    const e = doc.createElement(name);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const s = (name, attrs, parent) => {
    const e = doc.createElementNS(SVG_NS, name);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function build() {
    const host = mount || doc.body;
    if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg);   // a build that did not finish
    nodeEls.clear(); edgeEls.length = 0;
    injectStyle(doc, host);
    dlg = doc.createElement(native ? 'dialog' : 'div');
    dlg.className = 'hasse-dialog';
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.setAttribute('aria-labelledby', `hasse-title-${uid}`);
    dlg.setAttribute('tabindex', '-1');    // a click on the card's blank areas keeps the keyboard inside the dialog
    dlg.setAttribute('data-ss-comments', 'off');   // spacesheep: no comment anchors on a transient control (as on the stage panes)

    // (divs with roles rather than h2 / p, so element selectors of the host page cannot restyle them)
    card = h('div', 'hasse-card', dlg);
    head = h('div', 'hasse-head', card);
    const title = h('div', 'hasse-title', head, 'Pick an orbifold');
    title.id = `hasse-title-${uid}`;
    title.setAttribute('role', 'heading');
    title.setAttribute('aria-level', '2');
    closeBtn = h('button', 'hasse-close', head);
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    const x = s('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true', style: 'width:16px;height:16px' }, closeBtn);
    s('path', { d: 'M3.5 3.5l9 9M12.5 3.5l-9 9', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, x);

    // the diagram scrolls only in a window too short for it; a fade with a chevron then marks each cut edge
    scroller = h('div', 'hasse-scroll', card);
    body = h('div', 'hasse-body', scroller);
    for (const [cls, d] of [['hasse-cue hasse-cue-top', 'M1.5 7l6-5 6 5'], ['hasse-cue hasse-cue-bottom', 'M1.5 2l6 5 6-5']]) {
      const cue = h('div', cls, scroller);
      cue.setAttribute('aria-hidden', 'true');
      const sv = s('svg', { width: 15, height: 9, viewBox: '0 0 15 9', style: 'width:15px;height:9px' }, cue);
      s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, sv);
    }
    body.addEventListener('scroll', updateCues, { passive: true });
    svg = s('svg', { class: 'hasse-svg', role: 'listbox', 'aria-label': 'The 17 wallpaper groups: subgroups above, supergroups below' }, body);
    rulesG = s('g', { 'aria-hidden': 'true' }, svg);
    edgesG = s('g', { 'aria-hidden': 'true' }, svg);
    // role none: Chrome accepts role=option only when the option's parent in the accessibility tree is the listbox
    // (a plain <g> in between turned all 17 options into 'group', and aria-selected was lost)
    nodesG = s('g', { role: 'none' }, svg);

    for (const [u, v, index] of HASSE_EDGES) {
      edgeEls.push({ u, v, path: s('path', { class: index === 3 ? 'hasse-edge hasse-i3' : 'hasse-edge' }, edgesG) });
    }
    for (const n of HASSE_NODES) {
      const id = n.id, m = meta.get(id);
      const g = s('g', { class: m ? 'hasse-node' : 'hasse-node hasse-off', role: 'option', tabindex: '-1', 'data-id': id, 'aria-selected': 'false' }, nodesG);
      g.setAttribute('aria-label', m ? [spoken(m.label), m.hm, m.shape].filter(Boolean).join(', ') : spoken(id));
      if (!m) g.setAttribute('aria-disabled', 'true');
      const hit = s('rect', { class: 'hasse-hit' }, g);
      const halo = s('rect', { class: 'hasse-halo' }, g);
      const ring = s('rect', { class: 'hasse-ring' }, g);
      const pill = s('rect', { class: 'hasse-pill' }, g);
      const text = s('text', { class: 'hasse-label', x: 0, y: 0, dy: '0.35em' }, g);
      text.textContent = labels[id];
      nodeEls.set(id, { g, hit, halo, ring, pill, text });

      const enter = (e) => {
        if (!isOpen || hoverId === id) return;
        const mouse = !e.pointerType || e.pointerType === 'mouse';
        if (mouse && parked && e.clientX === parked[0] && e.clientY === parked[1]) return;   // an idle mouse: see `parked`
        hoverId = id; kbd = false; wantX = null;
        moveFocus(id, false);
      };
      const leave = () => { if (hoverId === id) { hoverId = null; paint(); } };
      if (win.PointerEvent) {
        g.addEventListener('pointerenter', enter);
        g.addEventListener('pointermove', enter);     // the mouse moves on a node the keyboard had taken over
        g.addEventListener('pointerleave', leave);
        g.addEventListener('pointercancel', leave);
      } else {
        g.addEventListener('mouseenter', enter);
        g.addEventListener('mousemove', enter);
        g.addEventListener('mouseleave', leave);
      }
      g.addEventListener('click', (e) => { e.preventDefault(); pick(id); });
    }

    foot = h('div', 'hasse-foot', card);
    const info = h('div', 'hasse-info', foot);
    infoLabel = h('b', null, info);
    infoSep = h('span', 'hasse-sep', info, ' · ');
    infoRest = h('span', null, info);
    // The key says what a line means: the upper group is a subgroup of the lower one with the same translation
    // lattice (the diagram has exactly the maximal translationengleiche subgroups, of index 2 or 3).
    const legend = h('div', 'hasse-legend', foot);
    const key = (parent, dashed, text) => {
      const k = h('span', 'hasse-key', parent);
      const sv = s('svg', { width: 26, height: 8, viewBox: '0 0 26 8', 'aria-hidden': 'true', style: 'width:26px;height:8px' }, k);
      s('path', { class: dashed ? 'hasse-edge hasse-i3' : 'hasse-edge', d: 'M1 4.5H25' }, sv);
      h('span', null, k, text);
    };
    h('span', 'hasse-key', legend, 'line = subgroup with the same translations:');
    const pair = h('span', 'hasse-keys', legend);          // the two line styles stay together
    key(pair, false, 'index 2');
    key(pair, true, 'index 3');
    h('span', 'hasse-key hasse-key-row', legend, 'row = order of the point group');

    closeBtn.addEventListener('click', () => close());
    dlg.addEventListener('keydown', onKeyDown);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });   // Esc / Android back on a native dialog
    dlg.addEventListener('close', () => { if (isOpen && !dlg.open) finishClose(); });   // closed by someone else
    dlg.addEventListener('pointerdown', (e) => { downOnScrim = e.target === dlg; });
    dlg.addEventListener('mousedown', (e) => { downOnScrim = e.target === dlg; });
    dlg.addEventListener('click', (e) => {
      // a click on the veil closes — but not the second half of a double-click on whatever opened the dialog
      if (e.target === dlg && downOnScrim && Date.now() - openedAt > 350) close();
      downOnScrim = false;
    });
    // "the diagram has the keyboard" = focus is on a node, or on the dialog itself (where it lands after a click on
    // a blank area, or in an engine that cannot focus SVG elements); the other stop is the close button
    dlg.addEventListener('focusin', (e) => {
      const t = e.target;
      const onNode = t && t.closest ? t.closest('.hasse-node') : null;
      nodeFocused = t === dlg || !!onNode;
      const id = onNode && onNode.getAttribute('data-id');
      if (id && id !== focusId && nodeEls.has(id)) { focusId = id; wantX = null; }   // focus moved by assistive technology
      paint();
    });
    dlg.addEventListener('focusout', () => { nodeFocused = false; });
    host.appendChild(dlg);
    built = true;
  }

  function relayout() {
    const vw = dlg.clientWidth || win.innerWidth || 800;
    const vh = dlg.clientHeight || win.innerHeight || 600;
    card.classList.remove('hasse-side');                   // measure the stacked card's title and foot first
    card.style.removeProperty('--_padv');
    let plan = hasseCardLayout(vw, vh, 0);
    card.style.width = `${plan.stackedCardW}px`;
    card.style.setProperty('--_pad', `${plan.pad}px`);
    plan = hasseCardLayout(vw, vh, head.offsetHeight + foot.offsetHeight + 2);
    card.style.maxHeight = `${Math.max(200, vh - 2 * plan.margin)}px`;
    bodyPadTop = plan.padV;
    if (plan.side) {
      card.classList.add('hasse-side');
      card.style.setProperty('--_padv', `${plan.padV}px`);
      card.style.setProperty('--_side', `${SIDE_W}px`);
      card.style.width = `${plan.cardW}px`;
    }
    const W = plan.W, H = plan.H;

    let L = layoutFor(W, H);
    if (L.font !== measured.font) { measured = { font: L.font, widths: {} }; L = layoutFor(W, H); }
    apply(L);
    // the estimate of the label widths is generous; if a font is wider still, measure and lay out once more
    let wider = false;
    for (const n of L.nodes) {
      const el = nodeEls.get(n.id);
      let w = 0;
      try { w = el.text.getComputedTextLength(); } catch (err) { /* not rendered */ }
      if (w > 2 * (n.hw - 5) && w > (measured.widths[n.id] || 0)) { measured.widths[n.id] = Math.ceil(w); wider = true; }
    }
    if (wider) apply(layoutFor(W, H));
    updateCues();
  }

  // The routing takes a few milliseconds, so the last layout is kept: reopening at the same size is free.
  function layoutFor(W, H) {
    const key = `${W}x${H}:${JSON.stringify(measured.widths)}`;
    if (!memo || memo.key !== key) memo = { key, L: hasseLayout(W, H, { labels, textWidths: measured.widths }) };
    return memo.L;
  }

  function apply(L) {
    drawn = L;
    svg.setAttribute('width', L.width);
    svg.setAttribute('height', L.height);
    svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    svg.style.width = `${L.width}px`;      // inline, so a host rule like `svg { width: 100% }` cannot stretch it
    svg.style.height = `${L.height}px`;
    nodesG.style.fontSize = `${L.font}px`;
    while (rulesG.firstChild) rulesG.removeChild(rulesG.firstChild);
    L.rows.forEach((row, r) => {
      const y = Math.round(row.top) + 0.5;
      if (r > 0) s('line', { class: 'hasse-rule', x1: 0, x2: L.width, y1: y, y2: y }, rulesG);
      const t = s('text', { class: 'hasse-rowlabel', x: row.labelX, y: row.labelY }, rulesG);
      t.textContent = String(row.order);
    });
    for (const n of L.nodes) {
      const el = nodeEls.get(n.id);
      el.g.setAttribute('transform', `translate(${fmt(n.x)} ${fmt(n.y)})`);
      const box = (rect, hw, hh, round) => {
        rect.setAttribute('x', -hw); rect.setAttribute('y', -hh); rect.setAttribute('width', 2 * hw); rect.setAttribute('height', 2 * hh);
        if (round) rect.setAttribute('rx', hh);
      };
      // the tap target: 44 px where there is room, trimmed half way to a neighbour where the rows are packed
      el.hit.setAttribute('x', fmt(n.hit.l - n.x)); el.hit.setAttribute('y', fmt(n.hit.t - n.y));
      el.hit.setAttribute('width', fmt(n.hit.r - n.hit.l)); el.hit.setAttribute('height', fmt(n.hit.b - n.hit.t));
      box(el.pill, n.hw, n.hh, true);
      box(el.halo, n.hw + 2, n.hh + 2, true);
      box(el.ring, n.hw + 3.5, n.hh + 3.5, true);
    }
    L.edges.forEach((e, i) => edgeEls[i].path.setAttribute('d', e.d));
  }

  function paint() {
    if (!built) return;
    const activeId = hoverId || (kbd ? focusId : null);
    const near = activeId ? NEIGHBOURS.get(activeId) : null;
    svg.classList.toggle('hasse-has-active', !!activeId);
    for (const [id, el] of nodeEls) {
      const c = el.g.classList;
      c.toggle('hasse-active', id === activeId);
      c.toggle('hasse-near', !!near && near.has(id));
      c.toggle('hasse-current', id === currentId);
      c.toggle('hasse-focus', kbd && nodeFocused && id === focusId);
      el.g.setAttribute('aria-selected', id === currentId ? 'true' : 'false');
      el.g.setAttribute('tabindex', id === focusId ? '0' : '-1');
    }
    for (const e of edgeEls) {
      const on = !!activeId && (e.u === activeId || e.v === activeId);
      if (on && !e.path.classList.contains('hasse-on')) edgesG.appendChild(e.path);   // draw the lit edges on top
      e.path.classList.toggle('hasse-on', on);
    }
    const shown = activeId || currentId;
    const m = shown ? meta.get(shown) : null;
    infoLabel.textContent = m ? m.label : (shown ? labels[shown] : '');
    infoRest.textContent = m ? [m.hm, m.shape].filter(Boolean).join(' · ') : '';
    infoSep.hidden = !infoRest.textContent;
  }

  // The fade-and-chevron cues at the edges of a body that scrolls: shown where more of the diagram lies beyond.
  function updateCues() {
    if (!built) return;
    const max = body.scrollHeight - body.clientHeight;
    scroller.classList.toggle('hasse-more-above', max > 1 && body.scrollTop > 1);
    scroller.classList.toggle('hasse-more-below', max > 1 && body.scrollTop < max - 1);
  }

  function moveFocus(id, fromKeyboard) {
    focusId = id;
    if (fromKeyboard) hoverId = null;
    const el = nodeEls.get(id);
    if (el && doc.activeElement !== el.g) {
      try { el.g.focus({ preventScroll: true }); } catch (err) { /* handled below */ }
      if (doc.activeElement !== el.g) {     // an engine that cannot focus SVG elements: the dialog takes the keys
        try { dlg.focus({ preventScroll: true }); } catch (err) { /* nothing more to try */ }
      }
    }
    if (fromKeyboard) reveal(id);
    paint();
  }

  // When the diagram is taller than a short window its body scrolls; keep the node the keyboard is on in view, and
  // clear of the fades at the edges.
  function reveal(id) {
    const n = drawn && drawn.nodes.find((q) => q.id === id);
    if (n && body.scrollHeight > body.clientHeight + 1) {
      const y = bodyPadTop + n.y, top = y - HIT / 2 - CUE + 8, bottom = y + HIT / 2 + CUE - 8;
      if (top < body.scrollTop) body.scrollTop = Math.max(0, top);
      else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = bottom - body.clientHeight;
    }
    updateCues();
  }

  function onKeyDown(e) {
    if (!isOpen) return;
    const k = e.key;
    if (k === 'Escape' || k === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); return; }
    // (handled keys stop here: while the dialog is open they are not the page's business)
    if (k === 'Tab') {                    // the trap: two stops, the diagram and the close button
      e.preventDefault(); e.stopPropagation();
      kbd = true; hoverId = null;
      if (doc.activeElement === closeBtn) moveFocus(focusId, true);
      else { closeBtn.focus(); paint(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (NAV_KEYS.has(k)) {
      e.preventDefault(); e.stopPropagation();
      kbd = true;
      const next = hasseNavigate(focusId, k, wantX);
      wantX = next.wantX;
      moveFocus(next.id, true);
      return;
    }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.stopPropagation();
      if (e.target === closeBtn) return;  // the button closes by itself
      e.preventDefault();
      if (!e.repeat) pick(focusId);
    }
  }

  function pick(id) {
    if (!isOpen || !meta.has(id)) return;
    const changed = id !== currentId;
    close();
    if (changed && typeof onPick === 'function') onPick(id);
  }

  function onResize() {
    if (!isOpen || raf) return;
    raf = win.requestAnimationFrame(() => { raf = 0; if (isOpen) relayout(); });
  }

  function open(id) {
    if (!built) build();
    if (!isOpen) {
      const active = doc.activeElement;
      opener = active && active !== doc.body && !dlg.contains(active) ? active : null;
    }
    currentId = DATA.has(id) ? id : null;
    focusId = currentId || HASSE_ROWS[0][0];
    hoverId = null; wantX = null; kbd = keyboardLast;
    parked = mouseAt ? mouseAt.slice() : null;
    if (!isOpen) {
      isOpen = true;
      openedAt = Date.now();
      modal = false;
      if (native) {
        try { dlg.showModal(); modal = true; } catch (err) { try { dlg.setAttribute('open', ''); } catch (err2) { /* plain overlay */ } }
      }
      dlg.classList.add('hasse-open');
      win.addEventListener('resize', onResize);
    }
    relayout();
    body.scrollTop = 0;
    reveal(focusId);
    moveFocus(focusId, false);
  }

  function finishClose() {
    isOpen = false;
    win.removeEventListener('resize', onResize);
    const inside = dlg.contains(doc.activeElement) ? doc.activeElement : null;
    dlg.classList.remove('hasse-open');
    hoverId = null; nodeFocused = false;
    const back = opener;
    opener = null;
    if (back && back.isConnected && typeof back.focus === 'function') {
      try { back.focus({ preventScroll: true }); } catch (err) { /* gone */ }
    }
    if (inside && doc.activeElement === inside && inside.blur) inside.blur();   // nowhere to return to: do not keep focus in a hidden dialog
  }

  function close() {
    if (!isOpen) return;
    if (native) {
      try { if (modal && dlg.open) dlg.close(); else dlg.removeAttribute('open'); } catch (err) { /* already closed */ }
    }
    finishClose();
  }

  // Build the DOM and route the edges while the page is idle, so that the first open() has nothing left to compute
  // (the dialog is laid out invisibly for one synchronous moment; nothing is painted).
  function warm() {
    if (built || isOpen || !(mount || doc.body)) return;
    build();
    dlg.style.visibility = 'hidden';
    dlg.classList.add('hasse-open');
    try { relayout(); } finally { dlg.classList.remove('hasse-open'); dlg.style.visibility = ''; }
  }
  const later = win.requestIdleCallback ? (f) => win.requestIdleCallback(f, { timeout: 4000 }) : (f) => win.setTimeout(f, 500);
  later(() => { try { warm(); } catch (err) { /* open() builds it then */ } });

  return { open, close, isOpen: () => isOpen };
}
