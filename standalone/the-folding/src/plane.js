// plane.js — the 2D symmetry plane: the pattern, its symmetry elements, the tiling by copies of the tile, the current
// tile with its sewn edges, and the draggable seed.  Canvas 2D, no dependencies beyond this workspace.  SPEC 5.9, 8 (C2).
//
//   const P = createPlaneView(canvas, { onSeed(x, y, phase), hint });
//   P.setScene({ group, domain, motif, star, interactive });   // call again with a new domain while the seed is dragged
//   P.render();  P.resize();  P.toWorld(cssX, cssY);  P.toCss(x, y);  P.destroy();
//
// Layers, bottom to top:
//   white ground · the faint tint of every second kind of tile (mirror images of the others; never the current tile,
//   so it looks the same on either side of a mirror) · the snowflake patch (`star`) · thin grey outlines of every copy
//   of the tile (lighter with Wavy) · the motif copies · mirror lines (ink) and glide axes (dashed; lighter on a small
//   pane) · the current tile: its soft accent fill, the seed handle (a ring with a pin-point at the seed: what lies
//   under it stays visible), its bold edges (cut edges in the colour of their glue class with matching chevrons,
//   mirror edges in ink) · the rotation centres (lens, triangle, square, hexagon) · the hint.
// The rotation glyphs are drawn ABOVE the tile's edges (the SPEC lists them below): the cone points sit on the tile's
// boundary and would otherwise be hidden by the bold edges. The handle is drawn BELOW the bold edges (the SPEC lists
// it on top): a seed next to an edge would otherwise cut the edge.
// Chevrons scale with their edge: a cluster takes at most CHEVRON_SHARE of the edge and stays clear of the glyphs at its
// ends; it shrinks rather than losing chevrons, so a seam always shows its own count (or none on a sliver of an edge).
//
// Coordinates: world x right, y up. The window's scale is fixed: the canvas's short side shows 2 group.viewHalf, zoomed
// in on a small pane so that the tile stays big enough to see and drag (planeScale: phones only). Its
// centre is the scene's FOCUS, the bounding box of the current tile (of the snowflake patch when `star` is given):
//   - a new group is shown centred on its focus at once;
//   - a cut chosen from outside (the seed jumps while nobody drags: a preset, an API call) glides to the centre;
//   - while the person drags (or nudges with the keys) the window moves only as far as needed to keep the tile inside
//     its inner part (a margin of max(14 px, 10 %) on every side), with the same glide;
//   - the seed is held inside the square of half the window around `home` (the focus when the cut was chosen), so a
//     drag can neither run away nor push the window far.
// The glide is a critically damped spring (no overshoot, about 0.2 s); without requestAnimationFrame, or with
// prefers-reduced-motion, the window jumps. toCss / toWorld always describe the frame on screen.
//
// Dragging is relative: press anywhere, the seed handle moves by the pointer's world displacement (a gliding window
// adds nothing to it). The view only REPORTS the new seed through onSeed (straight coordinates, i.e. already taken
// through domain.warp.inv); it moves the handle when the owner answers with setScene(...) for the rebuilt domain.
// A second pointer during a drag freezes it until every pointer is up (a reflexive pinch never moves the cut; if the
// first finger had hardly moved, the cut goes back to where the drag began).
// `interactive: false` (contract C2; the kaleidoscopes, where nothing is cut): no handle, no drags, no keys, default
// cursor, and the canvas is a labelled image out of the tab order.
//
// Stable seam colours: domain.js numbers the glue classes in boundary order, which renumbers them while the seed
// moves. setScene therefore gives every cut edge `edge.color` (index into palette CLASS_COLORS; kept as long as that
// seam exists) and `edge.ticks` (its number of chevrons) — see assignEdgeColors. Whoever draws the same tile elsewhere
// (the 3D view) should colour by edge.color, not by edge.cls.

import { elementsNear, symmetryElements, latticeCoords } from './groups.js';
import { INK, MUTED, FAINT, HAIRLINE, GROUND, ACCENT, ACCENT_SOFT, MIRROR_COLOR, GLIDE_COLOR, MOTIF_COLOR, CLASS_COLORS,
  MOTIF_ALPHA_PLANE, classColor, hexToRgb } from './palette.js';
import { motifFor } from './motif.js';

const TAU = 2 * Math.PI;

function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`;
}

/** `hex` at opacity `alpha` over the white ground, as an opaque colour. */
function overGround(hex, alpha) {
  const c = hexToRgb(hex), g = hexToRgb(GROUND);
  const v = (i) => Math.round((alpha * c[i] + (1 - alpha) * g[i]) * 255);
  return `rgb(${v(0)},${v(1)},${v(2)})`;
}
/**
 * The motif: soft ink, opaque (so the thin outlines of the tiling do not show through the glyphs). MOTIF_ALPHA_PLANE
 * (0.40) over white: the one big comma per tile (motif.js, the fill of 10 Nov 2026) is drawn lighter than the small
 * one was (0.54), so the mirrors, the dashed glide axes and the centre glyphs stay on top of it.
 */
export const MOTIF_FILL = overGround(MOTIF_COLOR, MOTIF_ALPHA_PLANE);

/** Panes whose short side is below this many CSS px count as small (phones): lighter glide axes. */
export const SMALL_PANE = 300;
/**
 * Small panes zoom in (final fix, 10 Nov 2026: on a 148 px phone plane the 2*22 tile was 49 x 19 px, under its handle,
 * qa/final-verify-fresh-eyes/p375/B6-2s22-t0.png): a tile (sqrt(domainArea)) takes at least zoomShare(m) of the pane's
 * short side m — ZOOM_SHARE up to ZOOM_FULL px, fading to nothing at ZOOM_NONE px, so a laptop's pane still shows
 * 2 viewHalf across and the scale is continuous in the pane's size. 0.3 keeps every preset's tile, straight or wavy,
 * inside the window's inner part (dev/final-fix/plane-zoom-fit.mjs). Only where the cut can be dragged: a kaleidoscope's
 * patch must stay in view.
 */
export const ZOOM_SHARE = 0.3, ZOOM_FULL = 240, ZOOM_NONE = 400;
export function zoomShare(m) {
  return m >= ZOOM_NONE ? 0 : m <= ZOOM_FULL ? ZOOM_SHARE : (ZOOM_SHARE * (ZOOM_NONE - m)) / (ZOOM_NONE - ZOOM_FULL);
}
/** The plane's scale, CSS px per unit, for a pane whose short side is m px: 2 viewHalf across, or the zoom above. */
export function planeScale(group, m, interactive = true) {
  const s = m / (2 * group.viewHalf);
  return interactive ? Math.max(s, (zoomShare(m) * m) / Math.sqrt(group.domainArea)) : s;
}
/**
 * The window glide: angular frequency (1/s) of the critically damped spring; it covers 90 % of a step in 3.9 / omega s.
 * PAN_OMEGA when a cut is chosen (0.22 s: the eye can follow the pattern sliding), PAN_OMEGA_FOLLOW while the tile is
 * dragged (0.13 s: the window keeps up with the finger; it lags 2 v / omega behind a tile moving at v px/s).
 */
export const PAN_OMEGA = 18, PAN_OMEGA_FOLLOW = 30;
/** The inner part of the window a dragged tile is kept in: a margin of max(PAN_MARGIN_MIN px, PAN_SHARE of the pane). */
export const PAN_SHARE = 0.1, PAN_MARGIN_MIN = 14;
/** A second finger landing before the first has moved this many CSS px undoes the drag (a pinch, not a drag). */
export const FREEZE_SLOP = 10;
/** Radius of the seed handle's ring (CSS px): 0.46 of the tile's inradius, within these bounds; its pin-point. */
const HANDLE_R = [5, 7.5], HANDLE_PIN = 1.3;
/** Chevrons: at most this share of their edge, and never drawn smaller than CHEVRON_MIN of their size. */
export const CHEVRON_SHARE = 0.4, CHEVRON_MIN = 0.45;

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (exported: they are what test/plane.test.js checks, and the 3D side may want them)
// ---------------------------------------------------------------------------------------------------------------

function isoKey(g) {
  const r = (v) => Math.round(v * 1e5) || 0;      // "|| 0" folds -0 into 0
  return r(g.a) + ',' + r(g.b) + ',' + r(g.c) + ',' + r(g.d) + ',' + r(g.tx) + ',' + r(g.ty);
}

/** A key shared by a gluing element and its inverse: it names the seam, whichever of its two edges is asked. */
export function seamKey(g) {
  const k1 = isoKey(g);
  const k2 = isoKey({ a: g.a, b: g.c, c: g.b, d: g.d, tx: -(g.a * g.tx + g.c * g.ty), ty: -(g.b * g.tx + g.d * g.ty) });
  return k1 < k2 ? k1 : k2;
}

/**
 * Give every cut edge of `domain` a colour index and a chevron count that survive while the seed is dragged.
 *   edge.color   index into palette CLASS_COLORS (use classColor(edge.color)); -1 on mirror edges
 *   edge.ticks   number of chevrons (1..3) on a seam whose two edges are different edges; 0 on half-turn and mirror edges
 *   edge.seam    the seam's key (seamKey of its gluing element)
 * A seam that also exists in `prev` (the previous domain of the same group, already coloured) keeps its colour and
 * its ticks; a new seam takes the lowest colour (and tick count) no current seam uses. Without `prev` the result is
 * colour = edge.cls, so a freshly shown preset looks exactly as domain.js numbers it.
 * Idempotent: a domain that is already coloured is left alone. Returns the domain.
 */
export function assignEdgeColors(domain, prev) {
  const edges = domain.edges;
  let done = true;
  for (const e of edges) if (e.kind === 'cut' && e.color === undefined) { done = false; break; }
  if (done) { for (const e of edges) if (e.kind !== 'cut' && e.color === undefined) { e.color = -1; e.ticks = 0; } return domain; }

  const seams = [];                                    // in order of cls
  for (const e of edges) {
    if (e.kind !== 'cut') { e.color = -1; e.ticks = 0; continue; }
    e.seam = seamKey(e.g);
    if (!seams[e.cls]) seams[e.cls] = { key: e.seam, half: !!e.halfTurn, color: -1, ticks: 0 };
  }
  const old = new Map();
  if (prev && prev.group === domain.group && prev.edges) {
    for (const e of prev.edges) if (e.kind === 'cut' && e.color >= 0) old.set(e.seam || seamKey(e.g), e);
  }
  const NC = CLASS_COLORS.length;
  const usedC = new Array(NC).fill(0), usedT = [0, 0, 0, 0];
  for (const s of seams) {
    if (!s) continue;
    const o = old.get(s.key);
    if (!o) continue;
    if (!usedC[o.color % NC]) { s.color = o.color % NC; usedC[s.color]++; }
    if (!s.half && o.ticks >= 1 && o.ticks <= 3 && !usedT[o.ticks]) { s.ticks = o.ticks; usedT[s.ticks]++; }
  }
  const lowest = (used, from, to) => {
    let best = from;
    for (let i = from; i <= to; i++) { if (used[i] < used[best]) best = i; }
    return best;
  };
  for (const s of seams) {
    if (!s) continue;
    if (s.color < 0) { s.color = lowest(usedC, 0, NC - 1); usedC[s.color]++; }
    if (!s.half && !s.ticks) { s.ticks = lowest(usedT, 1, 3); usedT[s.ticks]++; }
  }
  for (const e of edges) {
    if (e.kind !== 'cut') continue;
    const s = seams[e.cls];
    e.color = s.color; e.ticks = s.half ? 0 : s.ticks;
  }
  return domain;
}

function edgePointOf(domain, i, t, out) {
  if (domain.edgePoint) return domain.edgePoint(i, t, out);
  const a = domain.poly[i], b = domain.poly[(i + 1) % domain.poly.length];
  return domain.warp.fwd((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], out);
}

/** A fixed generic direction: translation seams point along it rather than against it. */
const W_DIR = [Math.cos(0.35), Math.sin(0.35)];

/**
 * The matching marks of the tile's seams, in actual (warped) coordinates:
 *   { edge, kind: 'chevron', x, y, dx, dy, count, color }   at the middle of an edge sewn to ANOTHER edge;
 *                                                           (dx, dy) is the unit direction the chevrons point in
 *   { edge, kind: 'fold', x, y, color }                     at the middle of a half-turn edge (it is folded there)
 * The marks of two partner edges are images of each other under the gluing (position and direction), so they meet
 * when the seam closes. The direction is canonical, so it does not flip while the seed moves: away from the rotation
 * centre for a rotation, along the boundary's counter-clockwise sense for a glide (both edges), and along W_DIR for a
 * translation.
 */
export function edgeMarks(domain) {
  const { edges, poly } = domain;
  const n = poly.length, marks = [];
  const p = [0, 0], q = [0, 0];
  for (let i = 0; i < n; i++) {
    const e = edges[i];
    if (e.kind !== 'cut') continue;
    edgePointOf(domain, i, 0.5, p);
    const color = e.color === undefined ? e.cls : e.color;
    if (e.partner === i) { marks.push({ edge: i, kind: 'fold', x: p[0], y: p[1], color }); continue; }
    const a = poly[i], b = poly[(i + 1) % n];
    const g = e.g, D = g.a * g.d - g.b * g.c;
    let sign = 1;
    if (D > 0) {
      const tr = Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9;
      if (tr) sign = (b[0] - a[0]) * W_DIR[0] + (b[1] - a[1]) * W_DIR[1] >= 0 ? 1 : -1;
      else {
        // centre of the rotation: (I - L) c = t
        const m00 = 1 - g.a, m01 = -g.b, m10 = -g.c, m11 = 1 - g.d, dd = m00 * m11 - m01 * m10;
        const cx = (g.tx * m11 - m01 * g.ty) / dd, cy = (m00 * g.ty - m10 * g.tx) / dd;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        sign = (mx - cx) * (b[0] - a[0]) + (my - cy) * (b[1] - a[1]) >= 0 ? 1 : -1;
      }
    }
    edgePointOf(domain, i, 0.5 - 0.02, p); edgePointOf(domain, i, 0.5 + 0.02, q);
    let dx = (q[0] - p[0]) * sign, dy = (q[1] - p[1]) * sign;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    edgePointOf(domain, i, 0.5, p);
    marks.push({ edge: i, kind: 'chevron', x: p[0], y: p[1], dx, dy, count: e.ticks || 1, color });
  }
  return marks;
}

/** Preferred direction (world angle) of one vertex of the glyph of an n-fold centre when nothing else decides it. */
function prefAngle(n) { return n === 4 ? Math.PI / 4 : Math.PI / 2; }

const glyphCache = new WeakMap();

/**
 * Orientation of the rotation glyphs, chosen so that the whole field of glyphs is invariant under the group:
 * returns angleAt(x, y, order) -> world angle of one vertex of the glyph (for the lens: of its long axis).
 * A glyph on mirrors has a vertex on a mirror (so it is symmetric in each mirror through it); a glyph off the mirrors
 * points to prefAngle for one centre of its orbit and is carried to the others by the group.
 */
export function glyphOrientation(group) {
  let fn = glyphCache.get(group);
  if (fn) return fn;
  const l1 = Math.hypot(group.e1[0], group.e1[1]), l2 = Math.hypot(group.e2[0], group.e2[1]);
  const sym = symmetryElements(group, group.center[0], group.center[1], 1.2 * (l1 + l2));
  const st = [0, 0];
  const frac = (v) => { let f = v - Math.floor(v); f = Math.round(f * 1e4); return f >= 1e4 ? 0 : f; };
  const keyOf = (x, y) => { latticeCoords(group, x, y, st); return frac(st[0]) + ',' + frac(st[1]); };
  // one centre per lattice class, in a fixed order
  const byKey = new Map();
  for (const c of sym.centers) { const k = keyOf(c.x, c.y); if (!byKey.has(k)) byKey.set(k, c); }
  const keys = [...byKey.keys()].sort();
  const angle = new Map();
  for (const k of keys) {
    if (angle.has(k)) continue;
    const c = byKey.get(k), n = c.order, pref = prefAngle(n), per = TAU / n;
    let a0 = pref;
    let best = Infinity;
    for (const m of sym.mirrors) {
      if (Math.abs((c.x - m.px) * -m.uy + (c.y - m.py) * m.ux) > 1e-6) continue;
      const th = Math.atan2(m.uy, m.ux);
      for (const cand of [th, th + Math.PI]) {
        let d = (cand - pref) % per;
        if (d < 0) d += per;
        d = Math.min(d, per - d);
        if (d < best - 1e-9) { best = d; a0 = cand; }
      }
    }
    for (const r of group.reps) {
      const x = r.a * c.x + r.b * c.y + r.tx, y = r.c * c.x + r.d * c.y + r.ty;
      const kk = keyOf(x, y);
      if (angle.has(kk)) continue;
      const vx = r.a * Math.cos(a0) + r.b * Math.sin(a0), vy = r.c * Math.cos(a0) + r.d * Math.sin(a0);
      angle.set(kk, Math.atan2(vy, vx));
    }
  }
  fn = (x, y, order) => {
    const a = angle.get(keyOf(x, y));
    return a === undefined ? prefAngle(order) : a;
  };
  glyphCache.set(group, fn);
  return fn;
}

/**
 * +1 or -1: the parity of the number of mirror lines of `mirrors` between (x, y) and (bx, by). Tiles whose seeds have
 * different parity are mirror images of each other in a way that is fixed in the plane, so the tint of the tiling
 * does not flicker when the seed crosses a mirror.
 */
export function chamberParity(mirrors, x, y, bx, by) {
  let n = 0;
  for (const m of mirrors) {
    const s1 = (x - m.px) * -m.uy + (y - m.py) * m.ux, s2 = (bx - m.px) * -m.uy + (by - m.py) * m.ux;
    if ((s1 > 0) !== (s2 > 0)) n++;
  }
  return n % 2 ? -1 : 1;
}

/**
 * Radius of the largest circle inside a convex polygon given by its edges' half-planes n.x <= c (unit normals), e.g. a
 * Domain's `edges`. A largest circle touches three edge lines, so the best of all triples is taken.
 */
export function inradius(edges) {
  const n = edges.length;
  let best = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = edges[i], b = edges[j], c = edges[k];
        // n.x + r = c for the three edges: Cramer's rule on [[ax, ay, 1], [bx, by, 1], [cx, cy, 1]]
        const det = a.nx * (b.ny - c.ny) - a.ny * (b.nx - c.nx) + (b.nx * c.ny - b.ny * c.nx);
        if (Math.abs(det) < 1e-12) continue;
        const x = (a.c * (b.ny - c.ny) - a.ny * (b.c - c.c) + (b.c * c.ny - b.ny * c.c)) / det;
        const y = (a.nx * (b.c - c.c) - a.c * (b.nx - c.nx) + (b.nx * c.c - b.c * c.nx)) / det;
        const r = a.c - (a.nx * x + a.ny * y);
        if (r <= best) continue;
        let ok = true;
        for (let l = 0; l < n && ok; l++) if (edges[l].c - (edges[l].nx * x + edges[l].ny * y) < r - 1e-9) ok = false;
        if (ok) best = r;
      }
    }
  }
  return best;
}

/**
 * Every copy g(D') of the tile that can touch the rectangle |x - cx| <= halfW, |y - cy| <= halfH: the group elements g.
 * `reach` is the largest distance from the (warped) seed to a point of the tile.
 */
export function tileCopies(group, seedActual, reach, cx, cy, halfW, halfH) {
  const hw = halfW + reach, hh = halfH + reach;
  const els = elementsNear(group, cx, cy, Math.hypot(hw, hh), seedActual[0], seedActual[1]);
  const out = [];
  for (const g of els) {
    const px = g.a * seedActual[0] + g.b * seedActual[1] + g.tx, py = g.c * seedActual[0] + g.d * seedActual[1] + g.ty;
    if (Math.abs(px - cx) <= hw && Math.abs(py - cy) <= hh) out.push(g);
  }
  return out;
}

/** Outer boundary of a set of polygons that share whole edges: the edges that belong to exactly one polygon. */
export function unionBoundary(polys) {
  const seen = new Map();
  const r = (v) => Math.round(v * 1e6);
  for (const poly of polys) {
    const k = poly.length;
    for (let i = 0; i < k; i++) {
      const a = poly[i], b = poly[(i + 1) % k];
      const ka = r(a[0]) + ',' + r(a[1]), kb = r(b[0]) + ',' + r(b[1]);
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const e = seen.get(key);
      if (e) e.n++; else seen.set(key, { n: 1, a, b });
    }
  }
  const out = [];
  for (const e of seen.values()) if (e.n === 1) out.push([e.a[0], e.a[1], e.b[0], e.b[1]]);
  return out;
}

function normPolys(star) {
  if (!star || !star.length) return null;
  const out = [];
  for (const p of star) {
    if (!p || !p.length) continue;
    if (typeof p[0] === 'number') { const q = []; for (let i = 0; i + 1 < p.length; i += 2) q.push([p[i], p[i + 1]]); out.push(q); } else out.push(p);
  }
  return out.length ? out : null;
}

/** True for the identity element: the current tile itself among its copies. */
export function isIdentity(g, tol = 1e-9) {
  return Math.abs(g.a - 1) < tol && Math.abs(g.b) < tol && Math.abs(g.c) < tol && Math.abs(g.d - 1) < tol &&
    Math.abs(g.tx) < tol && Math.abs(g.ty) < tol;
}

/**
 * The copies g(D') that carry the tint: those of the other hand (det(g) * eps < 0, eps from chamberParity), except the
 * current tile itself, which is always drawn on the plain ground so that it looks the same on either side of a mirror.
 */
export function tintedCopies(copies, eps) {
  return copies.filter((g) => (g.a * g.d - g.b * g.c) * eps < 0 && !isIdentity(g));
}

/** [minx, miny, maxx, maxy] of a flat coordinate array, or of a list of polygons [[x, y], ...]. */
export function boundsOf(pts) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
  if (pts.length && typeof pts[0] === 'number') { for (let i = 0; i + 1 < pts.length; i += 2) add(pts[i], pts[i + 1]); }
  else for (const poly of pts) for (const p of poly) add(p[0], p[1]);
  return b;
}

/**
 * The window centre nearest to (cx, cy) whose inner part (half-extents hw, hh around the centre) contains the box
 * [minx, miny, maxx, maxy]; on an axis where the box is wider than the inner part it is centred instead.
 */
export function followCentre(box, cx, cy, hw, hh) {
  const axis = (lo, hi, c, half) => {
    if (hi - lo >= 2 * half) return (lo + hi) / 2;
    if (lo < c - half) return lo + half;
    if (hi > c + half) return hi - half;
    return c;
  };
  return [axis(box[0], box[2], cx, hw), axis(box[1], box[3], cy, hh)];
}

/** Size of one chevron at full size, for bold edges `edge` CSS px wide: arms h wide, len long, apexes gap apart. */
export function chevronSize(edge) {
  const h = 1.5 * edge + 1.2;
  return { h, len: 0.85 * h, gap: 0.95 * h, lw: Math.max(1.6, 0.46 * edge) };
}

/**
 * How the `count` chevrons of a seam fit on an edge `edgePx` CSS px long whose ends must be kept clear by clearA and
 * clearB px (the glyph of a cone point there, plus a gap; or just the corner): the cluster takes at most
 * CHEVRON_SHARE of the edge and lies within [clearA, edgePx - clearB], at the edge's middle when it fits there, else
 * slid away from the glyph just enough (`offset`: px from the middle toward the edge's end B). It shrinks to fit, but
 * never below CHEVRON_MIN of its size, and never loses a chevron: two seams that differ in their number of chevrons stay
 * different however small the tile. Returns null when it does not fit (then the edge's colour alone names its seam),
 * else { f, count, h, len, gap, lw, span, offset } (span: its length along the edge, round caps included).
 */
export function chevronFit(edgePx, count, size, clearA = 0, clearB = clearA) {
  const room = Math.min(CHEVRON_SHARE * edgePx, edgePx - clearA - clearB);
  const A = (count - 1) * size.gap + size.len;
  if (!(room > 0) || !(A > 0)) return null;
  const width = (f) => Math.max(Math.min(size.lw, 1.1), size.lw * Math.sqrt(f));    // strokes thin out more slowly
  let f = Math.min(1, room / (A + size.lw));
  for (let i = 0; i < 4 && f * A + width(f) > room + 1e-9; i++) f = Math.max(0, (room - width(f)) / A);
  if (!(f >= CHEVRON_MIN - 1e-12)) return null;
  const lw = width(f), span = f * A + lw;
  const lo = clearA + span / 2 - edgePx / 2, hi = edgePx - clearB - span / 2 - edgePx / 2;   // lo <= hi since span <= room
  const offset = Math.max(lo, Math.min(hi, 0));
  return { f, count, h: size.h * f, len: size.len * f, gap: size.gap * f, lw, span, offset };
}

/**
 * How far the glyph of a rotation centre of order `order` reaches from its centre along the world direction `theta`
 * (radians), for the glyph "radius" r and orientation ang (glyphOrientation): the support function of the lens (order 2;
 * bounded by its ellipse) or of the polygon (3, 4, 6 vertices) drawn by the plane view.
 */
export function glyphReach(order, ang, r, theta) {
  const phi = theta - ang;
  if (order === 2) return Math.hypot(1.4 * r * Math.cos(phi), 0.66 * r * Math.sin(phi));
  const R = (order === 3 ? 1.36 : order === 4 ? 1.24 : 1.16) * r;
  let best = -Infinity;
  for (let k = 0; k < order; k++) best = Math.max(best, R * Math.cos(phi + (TAU * k) / order));
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------------------------------------------

export const HINT_CUT = 'drag to move the cut';
export const HINT_MIRRORS = 'no cut here: every edge is a mirror';

/**
 * createPlaneView(canvas, { onSeed, hint }) -> P
 *   onSeed(x, y, phase)   the person moved the seed: (x, y) in STRAIGHT coordinates (what buildDomain takes as seed),
 *                         phase 'start' (pointer down / key down, seed unchanged), 'move', 'end'
 *   hint                  true (default): draw the one-line hint until the first drag; false: never; a string: that text
 * P.setScene({ group, domain, motif?, star?, interactive? })
 *                        motif defaults to motifFor(group); star: list of polygons ([[x, y], ...] or flat arrays)
 *                        outlined faintly (the snowflake patch); interactive (default true): false = no seed handle,
 *                        no drags or keys, default cursor (contract C2)
 * P.render()             draw now (setScene and resize also schedule a draw on the next frame)
 * P.resize()             re-read the canvas's CSS size and devicePixelRatio (also done by an internal ResizeObserver)
 * P.toWorld(cssX, cssY)  canvas CSS pixels (origin: the canvas's top left corner) -> world;  P.toCss(x, y) the inverse;
 *                        both exact for the frame on screen (the window may glide: see the top of this file)
 * P.destroy()            remove every listener
 * P.isDragging(), P.hideHint(), P.stats ({ ms: cost of the last draw, copies, glyphs }),
 * P.getView()            { W, H, s, cx, cy, ..., home, target, gliding }
 */
export function createPlaneView(canvas, options = {}) {
  const onSeed = typeof options.onSeed === 'function' ? options.onSeed : null;
  const hintOpt = options.hint === undefined ? true : options.hint;
  const doc = canvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
  const ctx = canvas.getContext('2d');
  const now = () => (win && win.performance && win.performance.now ? win.performance.now()
    : typeof performance !== 'undefined' ? performance.now() : Date.now());

  const view = { W: 300, H: 150, dpr: 1, kx: 1, ky: 1, s: 100, cx: 0, cy: 0 };   // cx, cy: as drawn on screen
  const pan = { active: false, tx: 0, ty: 0, x0: 0, y0: 0, vx: 0, vy: 0, t0: 0, omega: PAN_OMEGA };   // glide to (tx, ty)
  let home = [0, 0];         // the focus when the cut was chosen: the seed stays within viewHalf of it
  let scene = null;          // { group, domain, motif, star, interactive }
  let tileP = null;          // derived from the scene and the scale: outline, ring, box, marks, ...
  let viewP = null;          // derived from tileP and the window: copies, tint, cones, chevrons
  let groupData = null;      // per group + view size + region: symmetry elements, glyphs
  let cache = null, cacheKey = '';
  let drag = null;           // { id, lx, ly, px, py, ax, ay, ax0, ay0, x0, y0, travel, pending, moved, frozen }
  const down = new Set();    // pointers pressed on the canvas and not lifted yet
  let blocked = false;       // a second pointer came down during a drag: nothing starts until every pointer is up
  let emitting = false;      // inside onSeed: a setScene now answers the person's own move
  let lastEmit = null;       // the last seed reported (straight coordinates)
  let attrsFor = null;       // { group, interactive } the canvas's attributes were last written for
  let hintLive = hintOpt !== false;
  let rafDraw = 0, rafMove = 0, destroyed = false, dirty = false, lastDrawAt = -Infinity;
  const stats = { ms: 0, copies: 0, glyphs: 0 };
  const tmp = [0, 0];

  // ---- geometry of the window ---------------------------------------------------------------------------------
  const X = (x) => view.W / 2 + (x - view.cx) * view.s;
  const Y = (y) => view.H / 2 - (y - view.cy) * view.s;
  function toCss(x, y, out = [0, 0]) { out[0] = X(x); out[1] = Y(y); return out; }
  function toWorld(px, py, out = [0, 0]) {
    out[0] = view.cx + (px - view.W / 2) / view.s;
    out[1] = view.cy - (py - view.H / 2) / view.s;
    return out;
  }
  /** The canvas's CSS box, or null while it has none (display: none, not in a document yet). */
  function cssSize() {
    let w = 0, h = 0;
    if (canvas.getBoundingClientRect) { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; } else { w = canvas.clientWidth; h = canvas.clientHeight; }
    return w > 0 && h > 0 ? [w, h] : null;
  }
  /** The scale: the short side of the canvas shows 2 viewHalf, zoomed in on a small pane (planeScale). (The centre is
   *  the focus: see moveWindow.) */
  function fit() {
    const g = scene ? scene.group : null, m = Math.min(view.W, view.H);
    view.s = g ? planeScale(g, m, scene.interactive) : m / 2;
  }
  function resize() {
    const box = cssSize();
    if (!box) return;                      // hidden: keep what we have; the ResizeObserver calls again when it shows
    const [w, h] = box;
    const dpr = Math.min(3, Math.max(1, (win && win.devicePixelRatio) || 1));
    const bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    // a canvas that no stylesheet sizes takes its CSS size from the backing store: pin it, or it would grow with dpr
    if (dpr !== 1 && canvas.style) {
      const box2 = cssSize();
      if (box2 && (Math.abs(box2[0] - w) > 0.5 || Math.abs(box2[1] - h) > 0.5)) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    }
    view.W = w; view.H = h; view.dpr = dpr; view.kx = bw / w; view.ky = bh / h;
    fit();
    tileP = null; viewP = null; groupData = null;
    if (scene) { const c = keepInside(focusBox(), pan.tx, pan.ty); moveWindow(c[0], c[1], false); }
    render();                              // at once: resizing a canvas clears it
  }

  // ---- the window's centre: focus, follow, glide ----------------------------------------------------------------
  function reducedMotion() {
    try { return !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  const canGlide = () => !!(win && win.requestAnimationFrame) && !reducedMotion();
  /** Position and velocity of the glide at time t (ms): the critically damped spring toward (pan.tx, pan.ty). */
  function glideAt(t) {
    const w = pan.omega, d = Math.max(0, (t - pan.t0) / 1000), e = Math.exp(-w * d);
    const ax = pan.x0 - pan.tx, ay = pan.y0 - pan.ty;
    const bx = pan.vx + w * ax, by = pan.vy + w * ay;
    return { x: pan.tx + (ax + bx * d) * e, y: pan.ty + (ay + by * d) * e, vx: (pan.vx - w * bx * d) * e, vy: (pan.vy - w * by * d) * e };
  }
  /** Send the window's centre to (tx, ty): with the glide of stiffness `omega` (when it can glide), or at once. */
  function moveWindow(tx, ty, glide, omega = PAN_OMEGA) {
    if (glide && canGlide()) {
      const t = now();
      const st = pan.active ? glideAt(t) : { x: view.cx, y: view.cy, vx: 0, vy: 0 };   // position and speed carry over
      pan.x0 = st.x; pan.y0 = st.y; pan.vx = st.vx; pan.vy = st.vy; pan.t0 = t; pan.tx = tx; pan.ty = ty; pan.omega = omega;
      pan.active = (Math.hypot(tx - st.x, ty - st.y) + 0.05 * Math.hypot(st.vx, st.vy)) * view.s > 0.05;
      if (pan.active) requestFrame(); else { view.cx = tx; view.cy = ty; }
    } else {
      pan.active = false; pan.tx = tx; pan.ty = ty;
      view.cx = tx; view.cy = ty;
    }
  }
  /** Bring the glide up to time t: the window's centre as it is drawn now. */
  function advanceGlide(t) {
    if (!pan.active) return;
    const st = glideAt(t);
    if (Math.hypot(st.x - pan.tx, st.y - pan.ty) * view.s < 0.2 && Math.hypot(st.vx, st.vy) * view.s < 4) {
      pan.active = false; view.cx = pan.tx; view.cy = pan.ty;
    } else { view.cx = st.x; view.cy = st.y; }
  }
  /** What must stay in view: the snowflake patch when there is one, else the tile. [minx, miny, maxx, maxy] */
  function focusBox() { const T = prepareTile(); return T.starBox || T.box; }
  const centreOf = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  function insetPx() { return Math.max(PAN_MARGIN_MIN, PAN_SHARE * Math.min(view.W, view.H)); }
  /** The centre nearest to (cx, cy) that shows the box inside the window's inner part. */
  function keepInside(b, cx, cy) {
    const m = insetPx();
    return followCentre(b, cx, cy, Math.max(0, (view.W / 2 - m) / view.s), Math.max(0, (view.H / 2 - m) / view.s));
  }

  // ---- sizes in CSS pixels that follow the canvas ---------------------------------------------------------------
  function metrics() {
    const m = Math.min(view.W, view.H);
    const k = Math.max(0.66, Math.min(1.12, m / 520));
    // how many pixels a tile is across: dense patterns on small canvases get lighter lines, so they stay legible
    const g = scene ? scene.group : null;
    const cell = g ? Math.sqrt(g.domainArea) * view.s : 100;
    const t = Math.max(0, Math.min(1, (cell - 24) / 26));
    // the handle never hides the tile: well inside the largest circle inside it
    let inr = Infinity;
    if (scene) {
      if (scene.inr === undefined) scene.inr = inradius(scene.domain.edges);
      inr = scene.inr * view.s;
    }
    const wave = scene && scene.domain.warp ? Math.max(0, Math.min(1, scene.domain.warp.amp || 0)) : 0;
    const small = m < SMALL_PANE;
    const handle = Math.max(HANDLE_R[0], Math.min(HANDLE_R[1], 0.46 * inr));
    return {
      k, cell, small, wave,
      edge: 4.4 * k,                                   // bold edges of the current tile
      mirror: Math.min(2, 1.3 + 0.7 * t),              // mirror lines of the pattern: 2 px, thinner when tiles are tiny
      glide: (m >= 380 ? 1.4 : 1.15) * (0.8 + 0.2 * t),
      glideAlpha: (0.5 + 0.5 * t) * (small ? 0.62 : 1),   // glide axes: quieter on a phone, where they crowd the tile
      outline: 1.1,                                    // (a stroke of exactly one device pixel is drawn as a beaded hairline)
      outlineAlpha: 0.85 * (1 - 0.42 * wave),          // the copies' outlines: lighter as they get wavy
      glyph: 4.5 * Math.pow(k, 0.75),                  // "radius" unit of the rotation glyphs
      handle,                                          // radius of the seed handle's ring (the middle of its stroke)
      handleW: handle >= 6.5 ? 2.6 : 2.2,              // width of the ring
    };
  }
  /** The seed's leash: half the window's short side around `home` (viewHalf, unless a small pane zooms in), less the
   *  largest handle's reach and 3 px (the same for every tile). */
  const leashHalf = () => Math.max(0, (Math.min(view.W, view.H) / 2 - (HANDLE_R[1] + 2.6 / 2 + 1.3 + 3)) / view.s);

  // ---- per group (window size and region): the symmetry elements ------------------------------------------------
  function viewRadius() { return Math.hypot(view.W, view.H) / (2 * view.s); }
  function ensureGroupData() {
    const g = scene.group;
    const key = g.id + '|' + view.W + 'x' + view.H;
    if (groupData && groupData.key === key && groupData.group === g &&
      Math.abs(view.cx - groupData.gx) <= groupData.E && Math.abs(view.cy - groupData.gy) <= groupData.E) return groupData;
    // gathered for a region around the window's centre that the window can glide in without gathering them again
    const E = 0.6 * g.viewHalf;
    const R = viewRadius() + E * Math.SQRT2;
    const sym = symmetryElements(g, view.cx, view.cy, R * 1.02 + 1e-6);
    const ang = glyphOrientation(g);
    const hw = view.W / (2 * view.s) + E + 0.1, hh = view.H / (2 * view.s) + E + 0.1;
    const centers = [];
    let dmin = Infinity;
    for (const c of sym.centers) {
      if (Math.abs(c.x - view.cx) > hw || Math.abs(c.y - view.cy) > hh) continue;
      centers.push({ x: c.x, y: c.y, order: c.order, angle: ang(c.x, c.y, c.order) });
    }
    for (let i = 0; i < Math.min(centers.length, 40); i++) {
      for (let j = 0; j < centers.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y);
        if (d < dmin) dmin = d;
      }
    }
    groupData = { key, group: g, sym, centers, centerGap: dmin, gx: view.cx, gy: view.cy, E, R };
    return groupData;
  }
  /** "Radius" of the rotation glyphs: never so large that neighbouring glyphs touch. */
  const glyphRadius = (gd, M) => Math.min(M.glyph, 0.2 * gd.centerGap * view.s);

  // ---- per scene ----------------------------------------------------------------------------------------------
  /** What depends on the scene and the scale only. */
  function prepareTile() {
    if (tileP) return tileP;
    const { group, domain } = scene;
    const warp = domain.warp;
    const wavy = warp && warp.amp > 0;
    const size = domain.size || Math.sqrt(group.domainArea);
    // the tile's boundary, edge by edge, in world coordinates. A wavy edge is sampled so that the chords stay within
    // about 0.15 px of the curve (its tightest radius of curvature is about size / (6 amp)), in steps of 2.2 .. 7 px.
    let step = 1e9;
    if (wavy) {
      const rc = (0.167 * size * view.s) / warp.amp;
      step = Math.max(2.2, Math.min(7, Math.sqrt(1.2 * rc))) / view.s;
    }
    const outline = domain.outline(step);
    let np = 0;
    for (const o of outline) np += o.pts.length / 2 - 1;
    const ring = new Float64Array(2 * np);
    let k = 0;
    for (const o of outline) {
      for (let i = 0; i + 2 < o.pts.length; i += 2) { ring[k++] = o.pts[i]; ring[k++] = o.pts[i + 1]; }
    }
    const seedA = domain.seedActual || warp.fwd(domain.seed[0], domain.seed[1]);
    let rt = 0;
    for (let i = 0; i < ring.length; i += 2) rt = Math.max(rt, Math.hypot(ring[i] - seedA[0], ring[i + 1] - seedA[1]));
    const marks = edgeMarks(domain);
    // the ends of each edge (actual coordinates) and the cone point at each end, if any: the chevrons keep clear of
    // the glyphs drawn there
    const cp = domain.conePoints || [], tol = 1e-6 * size;
    const cone = (x, y) => cp.find((q) => Math.abs(q.x - x) < tol && Math.abs(q.y - y) < tol) || null;
    const ends = [];
    for (const o of outline) {          // (in double precision: outline() gives Float32 points)
      const a = edgePointOf(domain, o.edge, 0, [0, 0]), b = edgePointOf(domain, o.edge, 1, [0, 0]);
      ends[o.edge] = { a, b, qa: cone(a[0], a[1]), qb: cone(b[0], b[1]) };
    }
    const star = normPolys(scene.star);
    tileP = { outline, ring, seedA, rt, box: boundsOf(ring), marks, ends, star,
      starEdges: star ? unionBoundary(star) : null, starBox: star ? boundsOf(star) : null };
    return tileP;
  }

  /** Everything a frame needs: prepareTile() plus what depends on the window (copies, tint, cones, chevrons). */
  function prepare() {
    const T = prepareTile(), gd = ensureGroupData();
    if (viewP && viewP.T === T && viewP.gd === gd && viewP.cx === view.cx && viewP.cy === view.cy) return viewP.P;
    const { group, domain } = scene;
    const M = metrics();
    // every copy of the tile that can touch the canvas
    const copies = tileCopies(group, T.seedA, T.rt, view.cx, view.cy, view.W / (2 * view.s), view.H / (2 * view.s));
    // which copies carry the tint: fixed in the plane (see chamberParity), never the current tile
    const base = scene.motif.at;
    const eps = chamberParity(gd.sym.mirrors, domain.seed[0], domain.seed[1], base[0], base[1]);
    // which of the centres in view are cone points of the current tile
    const cp = domain.conePoints || [];
    const cones = new Uint8Array(gd.centers.length);
    for (let i = 0; i < gd.centers.length; i++) {
      const c = gd.centers[i];
      for (const q of cp) if (Math.abs(q.x - c.x) < 1e-6 && Math.abs(q.y - c.y) < 1e-6) { cones[i] = 1; break; }
    }
    // the chevrons: scaled to their edge, clear of the glyphs at its ends (chevronFit). The clearance at an end is how
    // far the (enlarged) glyph of the cone point there reaches into the edge, plus its white rim and a 3 px gap; at a
    // plain corner, half a bold edge. Glyphs, ends and directions correspond under the gluing, so the clusters drawn
    // on two sewn edges are still images of each other.
    const size = chevronSize(M.edge), rT = 1.22 * glyphRadius(gd, M), angOf = glyphOrientation(group);
    const corner = 0.5 * M.edge + 1.5;
    const clearAt = (q, theta) => (q ? glyphReach(q.order, angOf(q.x, q.y, q.order), rT, theta) + 1.4 + 3 : corner);
    const chevrons = [];
    const p = [0, 0], q0 = [0, 0], q1 = [0, 0];
    for (const m of T.marks) {
      if (m.kind !== 'chevron') continue;
      const E = T.ends[m.edge];
      const ex = E.b[0] - E.a[0], ey = E.b[1] - E.a[1], L = Math.hypot(ex, ey);
      const th = Math.atan2(ey, ex);
      const clear = [clearAt(E.qa, th), clearAt(E.qb, th + Math.PI)];
      const edgePx = L * view.s;
      const fit = chevronFit(edgePx, m.count, size, clear[0], clear[1]);
      let at = { x: m.x, y: m.y, dx: m.dx, dy: m.dy };
      if (fit && Math.abs(fit.offset) > 1e-6 && edgePx > 0) {
        // slid along the edge: the point at the shifted parameter, the edge's direction there (same sense as the mark)
        const t = 0.5 + fit.offset / edgePx;
        edgePointOf(domain, m.edge, t, p); edgePointOf(domain, m.edge, t - 0.02, q0); edgePointOf(domain, m.edge, t + 0.02, q1);
        let dx = q1[0] - q0[0], dy = q1[1] - q0[1];
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        if (dx * m.dx + dy * m.dy < 0) { dx = -dx; dy = -dy; }
        at = { x: p[0], y: p[1], dx, dy };
      }
      chevrons.push({ mark: m, at, edge: m.edge, edgePx, clear, fit });
    }
    const P = Object.assign({}, T, { copies, eps, tinted: tintedCopies(copies, eps), cones, chevrons });
    viewP = { T, gd, cx: view.cx, cy: view.cy, P };
    return P;
  }

  // ---- drawing ------------------------------------------------------------------------------------------------
  function tracePoly(c, pts, g, close) {
    // pts: flat world coordinates; g: optional isometry
    const n = pts.length;
    if (g) {
      for (let i = 0; i < n; i += 2) {
        const x = g.a * pts[i] + g.b * pts[i + 1] + g.tx, y = g.c * pts[i] + g.d * pts[i + 1] + g.ty;
        if (i === 0) c.moveTo(X(x), Y(y)); else c.lineTo(X(x), Y(y));
      }
    } else {
      for (let i = 0; i < n; i += 2) { if (i === 0) c.moveTo(X(pts[i]), Y(pts[i + 1])); else c.lineTo(X(pts[i]), Y(pts[i + 1])); }
    }
    if (close) c.closePath();
  }

  /** The part of the picture that depends on the group and the window only: motif copies, mirrors, glide axes. */
  function drawPattern(c) {
    const { group, motif } = scene;
    const gd = ensureGroupData(), M = metrics();
    const R = viewRadius();
    const hw = view.W / (2 * view.s) + motif.radius, hh = view.H / (2 * view.s) + motif.radius;
    const els = elementsNear(group, view.cx, view.cy, R + motif.radius, motif.at[0], motif.at[1]);
    const closedOf = (i) => (motif.closed ? !!motif.closed[i] : false);
    // closed outlines: filled, all copies in one path (they are pairwise disjoint)
    c.beginPath();
    let any = false, anyOpen = false;
    for (const g of els) {
      const px = g.a * motif.at[0] + g.b * motif.at[1] + g.tx, py = g.c * motif.at[0] + g.d * motif.at[1] + g.ty;
      if (Math.abs(px - view.cx) > hw || Math.abs(py - view.cy) > hh) continue;
      motif.polylines.forEach((pl, i) => { if (closedOf(i)) { tracePoly(c, pl, g, true); any = true; } else anyOpen = true; });
    }
    if (any) { c.fillStyle = MOTIF_FILL; c.fill(); }
    if (anyOpen) {
      c.beginPath();
      for (const g of els) motif.polylines.forEach((pl, i) => { if (!closedOf(i)) tracePoly(c, pl, g, false); });
      c.strokeStyle = rgba(MOTIF_COLOR, 0.8); c.lineWidth = Math.max(1.2, 0.16 * motif.radius * view.s);
      c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
    }
    // the lines were gathered around (gx, gy); each is drawn far enough both ways to cross the whole window
    const L = 2 * gd.R + 1;
    // glide axes: dashed
    if (gd.sym.glides.length) {
      c.beginPath();
      for (const m of gd.sym.glides) {
        c.moveTo(X(m.px - L * m.ux), Y(m.py - L * m.uy)); c.lineTo(X(m.px + L * m.ux), Y(m.py + L * m.uy));
      }
      c.setLineDash([5.5 * Math.max(0.8, M.k), 4 * Math.max(0.8, M.k)]);
      c.lineCap = 'butt'; c.strokeStyle = rgba(GLIDE_COLOR, M.glideAlpha); c.lineWidth = M.glide; c.stroke();
      c.setLineDash([]);
    }
    // mirrors: solid ink
    if (gd.sym.mirrors.length) {
      c.beginPath();
      for (const m of gd.sym.mirrors) {
        c.moveTo(X(m.px - L * m.ux), Y(m.py - L * m.uy)); c.lineTo(X(m.px + L * m.ux), Y(m.py + L * m.uy));
      }
      c.lineCap = 'butt'; c.strokeStyle = MIRROR_COLOR; c.lineWidth = M.mirror; c.stroke();
    }
  }

  function patternLayer() {
    if (!doc || !doc.createElement) return null;
    const key = scene.group.id + '|' + canvas.width + 'x' + canvas.height + '|' + view.W + 'x' + view.H + '|' + view.cx + ',' + view.cy;
    if (cache && cacheKey === key && cache.motif === scene.motif) return cache.canvas;
    let cv = cache ? cache.canvas : null;
    if (!cv) { cv = doc.createElement('canvas'); }
    const cc = cv.getContext && cv.getContext('2d');
    if (!cc) return null;
    if (cv.width !== canvas.width) cv.width = canvas.width;
    if (cv.height !== canvas.height) cv.height = canvas.height;
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.clearRect(0, 0, cv.width, cv.height);
    cc.setTransform(view.kx, 0, 0, view.ky, 0, 0);
    drawPattern(cc);
    cache = { canvas: cv, motif: scene.motif }; cacheKey = key;
    return cv;
  }

  function drawCopies(c, P, M) {
    const { ring, copies } = P;
    // tint: the tiles of the other hand (never the current tile: it looks the same on either side of a mirror)
    if (P.tinted.length) {
      c.beginPath();
      for (const g of P.tinted) tracePoly(c, ring, g, true);
      c.fillStyle = rgba(INK, 0.05); c.fill();
    }
    // the snowflake patch
    if (P.star) {
      c.beginPath();
      for (const poly of P.star) { poly.forEach((p, i) => { if (i === 0) c.moveTo(X(p[0]), Y(p[1])); else c.lineTo(X(p[0]), Y(p[1])); }); c.closePath(); }
      c.fillStyle = rgba(ACCENT, 0.07); c.fill();
    }
    // outlines of all copies: one stroke, so shared edges are not drawn twice as dark
    c.beginPath();
    for (const g of copies) tracePoly(c, ring, g, true);
    c.lineJoin = 'round'; c.lineCap = 'butt';
    c.strokeStyle = rgba(FAINT, +M.outlineAlpha.toFixed(3)); c.lineWidth = M.outline; c.stroke();
  }

  function drawChevrons(c, P) {
    for (const ch of P.chevrons) {
      const f = ch.fit;
      if (!f) continue;
      const m = ch.mark, at = ch.at;
      const ux = at.dx, uy = -at.dy;                        // CSS direction (y flipped)
      const nx = -uy, ny = ux;
      const x0 = X(at.x), y0 = Y(at.y);
      c.beginPath();
      for (let i = 0; i < f.count; i++) {
        const off = (i - (f.count - 1) / 2) * f.gap + 0.5 * f.len;   // apex position along the direction: centred
        const ax = x0 + off * ux, ay = y0 + off * uy;
        c.moveTo(ax - f.len * ux + f.h * nx, ay - f.len * uy + f.h * ny);
        c.lineTo(ax, ay);
        c.lineTo(ax - f.len * ux - f.h * nx, ay - f.len * uy - f.h * ny);
      }
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = GROUND; c.lineWidth = f.lw + 2.4 * Math.sqrt(f.f); c.stroke();
      c.strokeStyle = classColor(m.color); c.lineWidth = f.lw; c.stroke();
    }
  }

  function drawTile(c, P, M) {
    const { domain } = scene;
    const { ring, outline } = P;
    c.beginPath(); tracePoly(c, ring, null, true);
    c.fillStyle = ACCENT_SOFT; c.fill();
    // the snowflake patch's outer boundary
    if (P.starEdges && P.starEdges.length) {
      c.beginPath();
      for (const e of P.starEdges) { c.moveTo(X(e[0]), Y(e[1])); c.lineTo(X(e[2]), Y(e[3])); }
      c.lineCap = 'round'; c.strokeStyle = rgba(ACCENT, 0.55); c.lineWidth = Math.max(2, 0.62 * M.edge); c.stroke();
    }
    // the seed handle lies in the tile, under its bold edges: a seed next to an edge never hides it
    drawHandle(c, P, M);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); tracePoly(c, ring, null, true);
    c.strokeStyle = GROUND; c.lineWidth = M.edge + 2.2; c.stroke();
    for (let pass = 0; pass < 2; pass++) {
      for (const o of outline) {
        const e = domain.edges[o.edge];
        if ((e.kind === 'mirror') !== (pass === 1)) continue;
        c.beginPath(); tracePoly(c, o.pts, null, false);
        c.strokeStyle = e.kind === 'mirror' ? MIRROR_COLOR : classColor(e.color === undefined ? e.cls : e.color);
        c.lineWidth = M.edge; c.stroke();
      }
    }
    drawChevrons(c, P);
  }

  function glyphPath(c, x, y, order, ang, r) {
    if (order === 2) {
      const a = 1.4 * r, b = 0.66 * r;
      const ux = Math.cos(ang), uy = -Math.sin(ang), nx = -uy, ny = ux;
      c.moveTo(x + a * ux, y + a * uy);
      c.quadraticCurveTo(x + 2 * b * nx, y + 2 * b * ny, x - a * ux, y - a * uy);
      c.quadraticCurveTo(x - 2 * b * nx, y - 2 * b * ny, x + a * ux, y + a * uy);
    } else {
      const R = (order === 3 ? 1.36 : order === 4 ? 1.24 : 1.16) * r;
      for (let k = 0; k < order; k++) {
        const t = ang + (TAU * k) / order;
        const px = x + R * Math.cos(t), py = y - R * Math.sin(t);
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
    }
    c.closePath();
  }

  function drawGlyphs(c, P, M) {
    const gd = ensureGroupData();
    if (!gd.centers.length) { stats.glyphs = 0; return; }
    const r0 = glyphRadius(gd, M);
    // a half-turn edge is folded at its midpoint: a dot there, ringed in the seam's colour, holds the 2-fold glyph
    for (const m of P.marks) {
      if (m.kind !== 'fold') continue;
      const x = X(m.x), y = Y(m.y), R = 1.7 * r0 * 1.22;
      c.beginPath(); c.arc(x, y, R + 0.5 * M.edge + 1, 0, TAU); c.fillStyle = GROUND; c.fill();
      c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = GROUND; c.fill();
      c.strokeStyle = classColor(m.color); c.lineWidth = Math.max(1.6, 0.5 * M.edge); c.stroke();
    }
    let drawn = 0;
    for (let pass = 0; pass < 2; pass++) {            // 0: the pattern's centres; 1: the cone points of the current tile
      c.beginPath();
      let any = false;
      for (let i = 0; i < gd.centers.length; i++) {
        const g = gd.centers[i];
        if ((P.cones[i] === 1) !== (pass === 1)) continue;
        const x = X(g.x), y = Y(g.y);
        if (x < -12 || y < -12 || x > view.W + 12 || y > view.H + 12) continue;
        glyphPath(c, x, y, g.order, g.angle, pass === 1 ? r0 * 1.22 : r0);
        any = true; drawn++;
      }
      if (!any) continue;
      c.lineJoin = 'round';
      c.strokeStyle = GROUND; c.lineWidth = pass === 1 ? 2.8 : 2.2; c.stroke();
      c.fillStyle = INK; c.fill();
    }
    stats.glyphs = drawn;
  }

  /** The seed handle: a teal ring with a white rim; its centre is left open, so the comma or edge under it shows. */
  function drawHandle(c, P, M) {
    if (!scene.interactive) return;
    const x = X(P.seedA[0]), y = Y(P.seedA[1]), r = M.handle, w = M.handleW;
    if (drag && !drag.frozen) {                     // held: a soft halo around the ring, the centre still open
      const r1 = r + w / 2 + 5, r2 = Math.max(0, r - w / 2 - 0.5);
      c.beginPath(); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, 0, TAU, true);
      c.fillStyle = rgba(ACCENT, 0.18); c.fill();
    }
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    c.strokeStyle = rgba(GROUND, 0.9); c.lineWidth = w + 2.6; c.stroke();
    c.strokeStyle = ACCENT; c.lineWidth = w; c.stroke();
    // a pin-point at the seed itself: the handle reads as a point to grab, unlike the rings of the half-turn marks
    c.beginPath(); c.arc(x, y, HANDLE_PIN, 0, TAU); c.fillStyle = ACCENT; c.fill();
  }

  function hintText() {
    if (!hintLive || !scene || !scene.interactive) return '';
    if (typeof hintOpt === 'string') return hintOpt;
    return scene.domain.classes === 0 ? HINT_MIRRORS : HINT_CUT;
  }

  function drawHint(c) {
    const text = hintText();
    if (!text) return;
    const face = 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    c.font = '500 12.5' + face;
    c.textBaseline = 'middle'; c.textAlign = 'center';
    let tw = c.measureText(text).width;
    const room = view.W - 12 - 22;
    if (tw > room && room > 40) { c.font = '500 ' + Math.max(9.5, (12.5 * room) / tw).toFixed(2) + face; tw = c.measureText(text).width; }
    const w = Math.min(view.W - 12, tw + 22), h = 24, x = (view.W - w) / 2, y = view.H - 10 - h, r = 8;
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
    c.fillStyle = rgba(GROUND, 0.94); c.fill();
    c.strokeStyle = HAIRLINE; c.lineWidth = 1; c.stroke();
    c.fillStyle = MUTED;
    c.fillText(text, view.W / 2, y + h / 2 + 0.5, w - 12);
  }

  function render() {
    if (destroyed) return;
    if (rafDraw && win && win.cancelAnimationFrame) { win.cancelAnimationFrame(rafDraw); }
    rafDraw = 0;
    // the window moved to another screen, or the page was zoomed: the backing store follows (resize draws)
    if (win && Math.min(3, Math.max(1, win.devicePixelRatio || 1)) !== view.dpr) { resize(); return; }
    const t0 = now();
    advanceGlide(t0);
    dirty = false; lastDrawAt = t0;
    const c = ctx;
    c.setTransform(view.kx, 0, 0, view.ky, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = GROUND; c.fillRect(0, 0, view.W, view.H);
    if (!scene) return;
    const P = prepare(), M = metrics();
    drawCopies(c, P, M);
    const layer = patternLayer();
    if (layer) { c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(layer, 0, 0); c.setTransform(view.kx, 0, 0, view.ky, 0, 0); } else drawPattern(c);
    drawTile(c, P, M);                         // (with the handle, under the tile's bold edges)
    drawGlyphs(c, P, M);
    drawHint(c);
    stats.ms = now() - t0; stats.copies = P.copies.length;
    if (pan.active) requestFrame();            // the glide goes on
  }

  function requestFrame() {
    if (destroyed || rafDraw || !win || !win.requestAnimationFrame) return;
    rafDraw = win.requestAnimationFrame(onFrame);
  }
  function onFrame(ts) {
    rafDraw = 0;
    // the owner already drew this frame (it renders right after setScene): the glide needs no second picture
    if (!dirty && pan.active && typeof ts === 'number' && lastDrawAt >= ts) { requestFrame(); return; }
    render();
  }
  function schedule() { dirty = true; requestFrame(); }

  // ---- the scene ----------------------------------------------------------------------------------------------
  /** The canvas's cursor, tab stop, role and label follow the group and whether the cut can be moved. */
  const tabindex0 = (canvas.getAttribute && canvas.getAttribute('tabindex')) || '0';
  const role0 = (canvas.getAttribute && canvas.getAttribute('role')) || 'application';
  function syncAttributes() {
    if (canvas.style) canvas.style.cursor = scene.interactive ? (drag ? 'grabbing' : 'grab') : 'default';
    if (!canvas.setAttribute) return;
    if (attrsFor && attrsFor.group === scene.group && attrsFor.interactive === scene.interactive) return;
    attrsFor = { group: scene.group, interactive: scene.interactive };
    const g = scene.group, name = `${g.label || g.id} (${g.hm || ''})`;
    if (scene.interactive) {
      canvas.setAttribute('tabindex', tabindex0);
      canvas.setAttribute('role', role0);
      canvas.setAttribute('aria-label', `Symmetry plane of ${name}: the pattern, its symmetry and the tile. Drag, or use the arrow keys, to move the cut.`);
    } else {
      canvas.setAttribute('tabindex', '-1');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Symmetry plane of ${name}: the pattern, its symmetry and the tile; every edge of the tile is a mirror.`);
    }
  }

  function setScene(s) {
    if (!s || !s.group || !s.domain) {
      if (drag) dropDrag(null);
      scene = null; tileP = null; viewP = null; pan.active = false;
      schedule();
      return;
    }
    const sameGroup = !!scene && scene.group === s.group;
    const prevDomain = sameGroup ? scene.domain : null, prevStar = sameGroup ? scene.star : null;
    if (s.domain !== prevDomain) assignEdgeColors(s.domain, prevDomain);
    const size = Math.sqrt(s.group.domainArea);
    // a new tile that answers the person's own drag or key (also when the owner rebuilds a moment later)
    const byPerson = !!drag || emitting ||
      (sameGroup && lastEmit !== null && Math.hypot(s.domain.seed[0] - lastEmit[0], s.domain.seed[1] - lastEmit[1]) <= 0.08 * size);
    scene = { group: s.group, domain: s.domain, motif: s.motif || motifFor(s.group), star: s.star || null, interactive: s.interactive !== false };
    tileP = null; viewP = null;
    if (!scene.interactive && drag) dropDrag(scene.domain);
    syncAttributes();
    if (!sameGroup) {
      groupData = null; lastEmit = null;
      fit();
      home = centreOf(focusBox());
      moveWindow(home[0], home[1], false);                 // another pattern: shown centred at once
    } else if (s.domain !== prevDomain || scene.star !== prevStar) {
      const b = focusBox();
      // another cut: the seed jumped, or the metric changed (the presets of o share a seed and differ by the metric;
      // a drag never changes the metric)
      const m0 = prevDomain.metric || [1, 0, 1], m1 = s.domain.metric || [1, 0, 1];
      const jumped = Math.hypot(s.domain.seed[0] - prevDomain.seed[0], s.domain.seed[1] - prevDomain.seed[1]) > 1e-9 * size ||
        Math.abs(m0[0] - m1[0]) + Math.abs(m0[1] - m1[1]) + Math.abs(m0[2] - m1[2]) > 1e-12;
      if (jumped && !byPerson) {                          // a cut chosen from outside: glide to it, centred
        home = centreOf(b);
        moveWindow(home[0], home[1], true);
      } else {                                            // dragged, nudged or made wavy: follow only as far as needed
        const c = keepInside(b, pan.tx, pan.ty);
        if (c[0] !== pan.tx || c[1] !== pan.ty) moveWindow(c[0], c[1], true, PAN_OMEGA_FOLLOW);
      }
    }
    schedule();
  }

  // ---- moving the seed ----------------------------------------------------------------------------------------
  /** Keep the seed on its leash (leashHalf around `home`), so a drag cannot run away. */
  function clampToWindow(p) {
    const half = leashHalf();
    p[0] = Math.max(home[0] - half, Math.min(home[0] + half, p[0]));
    p[1] = Math.max(home[1] - half, Math.min(home[1] + half, p[1]));
    return p;
  }
  function emit(ax, ay, phase) {
    if (!onSeed || !scene) return;
    const warp = scene.domain.warp;
    if (warp && warp.amp > 0) warp.inv(ax, ay, tmp); else { tmp[0] = ax; tmp[1] = ay; }
    const x = tmp[0], y = tmp[1];
    lastEmit = [x, y];
    emitting = true;
    try { onSeed(x, y, phase); } finally { emitting = false; }
  }
  function handleActual() {
    const d = scene.domain;
    const a = d.seedActual || d.warp.fwd(d.seed[0], d.seed[1]);
    return [a[0], a[1]];
  }
  function applyMove() {
    rafMove = 0;
    if (!drag || !drag.pending || drag.frozen || !scene) return;
    drag.pending = false;
    const dx = (drag.px - drag.lx) / view.s, dy = -(drag.py - drag.ly) / view.s;
    drag.lx = drag.px; drag.ly = drag.py;
    if (dx === 0 && dy === 0) return;
    const p = clampToWindow([drag.ax + dx, drag.ay + dy]);
    drag.ax = p[0]; drag.ay = p[1];
    if (hintLive) { hintLive = false; }
    drag.moved = true;
    emit(drag.ax, drag.ay, 'move');
    schedule();
  }
  function releaseCapture(id) {
    try { if (canvas.releasePointerCapture && id !== undefined) canvas.releasePointerCapture(id); } catch (err) { /* already released */ }
  }
  /** End a drag that no longer belongs to the scene (cleared, or not interactive): report its end where the seed is. */
  function dropDrag(domain) {
    if (rafMove && win && win.cancelAnimationFrame) win.cancelAnimationFrame(rafMove);
    rafMove = 0;
    const d = drag;
    drag = null;
    releaseCapture(d.id);
    if (domain && onSeed) { const s = domain.seed; lastEmit = [s[0], s[1]]; onSeed(s[0], s[1], 'end'); }
  }
  /** A second pointer during a drag: the cut stays where it is (or goes back, if the drag had hardly begun). */
  function freeze(e) {
    try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (err) { /* gone already */ }
    blocked = true;
    if (drag.frozen) return;
    drag.frozen = true; drag.pending = false;
    if (rafMove && win && win.cancelAnimationFrame) win.cancelAnimationFrame(rafMove);
    rafMove = 0;
    if (drag.travel < FREEZE_SLOP && drag.moved) {
      drag.ax = drag.ax0; drag.ay = drag.ay0;
      emit(drag.ax, drag.ay, 'move');
    }
    schedule();
  }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // `down` holds only the pointers of the gesture in hand: the drag's, and any others that came down during it
    if (drag) { if (e.pointerId !== drag.id) { down.add(e.pointerId); freeze(e); } return; }
    if (blocked) {
      // a frozen gesture lasts until its pointers are up; a primary pointer means they are (an 'up' went astray)
      if (e.isPrimary !== true) { down.add(e.pointerId); return; }
      blocked = false;
    }
    if (!scene || !scene.interactive) return;
    down.clear(); down.add(e.pointerId);
    const a = handleActual();
    drag = { id: e.pointerId, lx: e.clientX, ly: e.clientY, px: e.clientX, py: e.clientY, ax: a[0], ay: a[1], ax0: a[0], ay0: a[1],
      x0: e.clientX, y0: e.clientY, travel: 0, pending: false, moved: false, frozen: false };
    try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that is already gone */ }
    // no preventDefault: a mouse press then focuses the canvas the native way (arrow keys work, no focus ring);
    // scrolling and zooming are already ruled out by touch-action: none
    if (canvas.style) canvas.style.cursor = 'grabbing';
    emit(drag.ax, drag.ay, 'start');
    schedule();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.clientX !== undefined) drag.travel = Math.max(drag.travel, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    if (drag.frozen) return;
    drag.px = e.clientX; drag.py = e.clientY; drag.pending = true;
    if (win && win.requestAnimationFrame) { if (!rafMove) rafMove = win.requestAnimationFrame(applyMove); } else applyMove();
  }
  function onUp(e) {
    const id = e ? e.pointerId : undefined;
    if (id !== undefined) down.delete(id);
    if (!down.size) blocked = false;
    if (!drag || (id !== undefined && id !== drag.id)) return;
    if (rafMove && win && win.cancelAnimationFrame) win.cancelAnimationFrame(rafMove);
    rafMove = 0;
    if (!drag.frozen) {
      if (e && e.type === 'pointerup' && e.clientX !== undefined) { drag.px = e.clientX; drag.py = e.clientY; drag.pending = true; }
      applyMove();
    }
    const d = drag;
    drag = null;
    releaseCapture(d.id);
    if (canvas.style && scene) canvas.style.cursor = scene.interactive ? 'grab' : 'default';
    if (scene) {
      if (d.moved) emit(d.ax, d.ay, 'end'); else { const a = handleActual(); emit(a[0], a[1], 'end'); }
    }
    schedule();
  }
  function onKey(e) {
    if (!scene || !scene.interactive || drag) return;
    const step = (e.shiftKey ? 28 : 7) / view.s;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = step; else if (e.key === 'ArrowDown') dy = -step; else return;
    if (e.preventDefault) e.preventDefault();
    const a = handleActual();
    const p = clampToWindow([a[0] + dx, a[1] + dy]);
    hintLive = false;
    emit(a[0], a[1], 'start'); emit(p[0], p[1], 'move'); emit(p[0], p[1], 'end');
    schedule();
  }

  // ---- wiring -------------------------------------------------------------------------------------------------
  const listeners = [];
  const on = (type, fn, opts) => { if (canvas.addEventListener) { canvas.addEventListener(type, fn, opts); listeners.push([type, fn, opts]); } };
  if (canvas.style) {
    canvas.style.touchAction = 'none';                 // the browser never scrolls or zooms from a drag that starts here
    canvas.style.userSelect = 'none'; canvas.style.webkitUserSelect = 'none';
    canvas.style.webkitTouchCallout = 'none'; canvas.style.webkitTapHighlightColor = 'transparent';
    canvas.style.cursor = 'grab';
  }
  if (canvas.setAttribute) {
    if (!canvas.hasAttribute || !canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
    if (!canvas.hasAttribute || !canvas.hasAttribute('role')) canvas.setAttribute('role', 'application');
  }
  on('pointerdown', onDown);
  on('pointermove', onMove);
  on('pointerup', onUp);
  on('pointercancel', onUp);
  on('lostpointercapture', onUp);
  on('keydown', onKey);
  on('contextmenu', (e) => { if (drag && e.preventDefault) e.preventDefault(); });
  on('dragstart', (e) => { if (e.preventDefault) e.preventDefault(); });
  let ro = null;
  if (win && win.ResizeObserver) {
    ro = new win.ResizeObserver(() => {
      const box = cssSize();
      if (!box) return;
      const dpr = Math.min(3, Math.max(1, win.devicePixelRatio || 1));
      if (Math.abs(box[0] - view.W) > 0.01 || Math.abs(box[1] - view.H) > 0.01 || dpr !== view.dpr) resize();
    });
    ro.observe(canvas);
  }
  resize();

  return {
    setScene, render, resize, toWorld, toCss, stats,
    isDragging: () => !!drag,
    /** What the last prepared frame holds (for tests): copies, marks, tint, chevrons, the window. */
    debug() {
      if (!scene) return null;
      const P = prepare(), M = metrics();
      return {
        copies: P.copies, marks: P.marks, parity: P.eps, tinted: P.tinted, chevrons: P.chevrons, metrics: M, hint: hintText(),
        box: P.box, focus: focusBox(), home: home.slice(), target: [pan.tx, pan.ty], gliding: pan.active,
        interactive: scene.interactive, inset: insetPx(), clampHalf: leashHalf(),
      };
    },
    hideHint() { if (hintLive) { hintLive = false; schedule(); } },
    getView: () => ({ ...view, home: home.slice(), target: [pan.tx, pan.ty], gliding: pan.active }),
    destroy() {
      destroyed = true;
      for (const [type, fn, opts] of listeners) canvas.removeEventListener(type, fn, opts);
      if (ro) ro.disconnect();
      if (win && win.cancelAnimationFrame) { if (rafDraw) win.cancelAnimationFrame(rafDraw); if (rafMove) win.cancelAnimationFrame(rafMove); }
      pan.active = false;
      cache = null;
    },
  };
}
