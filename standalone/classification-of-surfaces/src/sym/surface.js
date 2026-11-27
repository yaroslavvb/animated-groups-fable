// surface.js — the orbifold of a pattern as a surface in the 3D pane: a tidy surface of the Tidy surfaces tab (a sphere with
// handles, holes and crosscaps) that also carries the signature's numbers:
//   a digit before the star   a CONE POINT: a pointed cap, as sharp as a paper cone rolled from 1 / n of a disc
//   a star                    a hole whose rim is a mirror (drawn red)
//   a digit after a star      a CORNER of that rim: the rim is drawn as a polygon with as many corners as the star has digits
// Blue for what keeps the pattern's sense (handles, cone points), red for what reflects (rims, corners, crosscaps),
// as in the book.
//
// A sphere with ONE hole is a disc, and is drawn as one (buildDisc): a flat plate whose edge is the mirror, with the
// star's corners as real corners of the plate (sharper for a higher order) and the cone points standing on it. That
// covers every kaleidoscope: the plate of *632 is its 30-60-90 triangle. An annulus and a Moebius band are the Examples tab's
// own models of them (buildModel), their edges the mirrors. Everything else stays on the ball.
//
//   buildSurface(parts) -> { scene, frame, anchors }
//     parts    [{ t: 'o' } | { t: 'x' } | { t: 'cone', n } | { t: 'star', corners: [n, ...] }]  in the signature's order
//     anchors  one entry per part: { at(): point, corners: [at(), ...] }: where a label or a highlight ring goes

import { Scene, addCell, roundHole, noHole, ringPoints, mod, TAU } from '../geo/scene.js';
import { ball, flatPatch, SIZES } from '../geo/layouts.js';
import { flatSite } from '../geo/sites.js';
import { addEmpty, addCrosscapFeature, addTube } from '../geo/features.js';
import { BLUE, RED } from './pattern.js';
import { measure } from '../examples/surfaces.js';
import { buildMesh, loopLine } from '../examples/mesh.js';

const PAIRS = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
export const ROOM = 12;
export const roomFor = (parts) => parts.reduce((s, p) => s + (p.t === 'o' ? 2 : 1), 0) <= ROOM;

/** A cone point of order n at site s: the cell with a round hole, closed by a cap that rises to a point. */
function addCone(scene, L, s, order) {
  const { site, boundary } = L.sites[s], n = L.n, R = L.R || 1;
  const slope = Math.sqrt(order * order - 1), hmax = 0.6 * R;          // at its very tip the cap is the cone of angle 2 pi / order
  const r0 = Math.min(0.25 * R, 0.8 * L.Rs, (1.5 * hmax) / slope), h = (r0 * slope) / 1.5;
  const cell = addCell(scene, { site, boundary, Rs: L.Rs, hole: roundHole(r0), ni: 3 });
  const m = 8, base = scene.alloc((m - 1) * n + 1), apex = base + (m - 1) * n;
  const idx = (i, j) => (i === m ? cell.rim(mod(j, n)) : base + (i - 1) * n + mod(j, n));
  for (let j = 0; j < n; j++) scene.tri(apex, idx(1, j), idx(1, j + 1));
  for (let i = 1; i < m; i++) for (let j = 0; j < n; j++) scene.quad(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
  scene.onUpdate((P) => {
    for (let i = 1; i < m; i++) {
      const t = i / m, rad = r0 * t, z = h * Math.pow(1 - t, 1.5);
      for (let j = 0; j < n; j++) { const th = (TAU * j) / n; site.toWorld(rad * Math.cos(th), rad * Math.sin(th), z, P, 3 * idx(i, j)); }
    }
    site.toWorld(0, 0, h, P, 3 * apex);
  });
  return { apex, cell, tip: () => site.point(0, 0, h + 0.02 * R) };
}

/** A hole with a mirror for a rim and k corners on it: round (0), a drop (1), a lens (2), a k-gon. */
function addMirrorHole(scene, L, s, k) {
  const { site, boundary } = L.sites[s], n = L.n, R = L.R || 1, R0 = 0.3 * R;
  const at = [];                               // the rim samples that are corners
  for (let i = 0; i < k; i++) at.push(Math.round((i * n) / k));
  const corner = (j) => { const th = (TAU * j) / n; return [R0 * Math.cos(th), R0 * Math.sin(th)]; };
  const hole = (j, th, out) => {
    if (k === 0) { out[0] = 0.82 * R0 * Math.cos(th); out[1] = 0.82 * R0 * Math.sin(th); return; }
    if (k === 1) { const u = th, w = Math.pow(Math.abs(Math.sin(u / 2)), 0.75); out[0] = R0 * (0.12 + 0.88 * Math.cos(u)); out[1] = 0.95 * R0 * Math.sin(u) * w; return; }
    let a = k - 1;
    while (a > 0 && at[a] > j) a--;
    const j0 = at[a], j1 = a + 1 < k ? at[a + 1] : n, t = (j - j0) / (j1 - j0), p = corner(j0), q = corner(j1);
    let x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
    if (k === 2) { const b = 0.62 * R0 * Math.sin(Math.PI * t), sgn = a === 0 ? 1 : -1; y += sgn * b; }       // a lens: the two sides bow out
    out[0] = x; out[1] = y;
  };
  const cell = addCell(scene, { site, boundary, Rs: L.Rs, hole });
  scene.addLines((S) => ({ points: ringPoints(S, cell.rim, n, 0, n), color: RED, width: 3.2, xray: 0.45 }));
  return { cell, corners: at.map((j) => () => scene.point(cell.rim(j))), middle: () => site.point(0, 0, 0) };
}

/** The outline of a plate with corners of the given orders, as n points seen from its middle in the directions 2 pi j / n. */
function plateOutline(orders, n) {
  const k = orders.length, poly = [], corners = [];
  const arc = (c, r, a0, a1, m) => { for (let i = 1; i < m; i++) { const a = a0 + ((a1 - a0) * i) / m; poly.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } };
  if (k === 0) arc([0, 0], 0.95, 0, TAU, 96), poly.push([0.95, 0]);
  else if (k === 1) {
    // a drop: a circle and the two tangents from the corner; the corner's angle follows its order
    const th = Math.max(0.7, Math.min(2.1, (1.6 * Math.PI) / orders[0])), rho = 0.78, Lc = rho / Math.sin(th / 2), b = Math.PI / 2 - th / 2;
    corners.push([Lc, 0]); poly.push([Lc, 0]);
    arc([0, 0], rho, b, TAU - b, 72);
  } else if (k === 2) {
    // a lens: two arcs between the corners
    const th = Math.max(1.2, Math.min(2.2, (2.8 * Math.PI) / (orders[0] + orders[1]))), a = 1.25, R2 = a / Math.sin(th / 2), cy = R2 * Math.cos(th / 2);
    corners.push([a, 0]); poly.push([a, 0]);
    arc([0, -cy], R2, Math.PI / 2 - th / 2, Math.PI / 2 + th / 2, 40);
    corners.push([-a, 0]); poly.push([-a, 0]);
    arc([0, cy], R2, -Math.PI / 2 - th / 2, -Math.PI / 2 + th / 2, 40);
  } else {
    // a polygon round a circle of radius r: its angles share out (k - 2) pi in proportion to 1 / order (exact for a plane kaleidoscope)
    const w = orders.map((o) => 1 / o), W = w.reduce((s, x) => s + x, 0), ang = w.map((x) => ((k - 2) * Math.PI * x) / W);
    const r = Math.max(0.5, Math.min(0.68, 2.3 * Math.min(...ang.map((t) => Math.sin(t / 2)))));
    let a = -Math.PI / 2 - (Math.PI - ang[0]);
    for (let i = 0; i < k; i++) { const phi = Math.PI / 2 - ang[i] / 2; a += phi; const d = r / Math.sin(ang[i] / 2), p = [d * Math.cos(a), d * Math.sin(a)]; corners.push(p); poly.push(p); a += phi; }
  }
  const mid = [0, 0];                          // seen from the middle of its inscribed circle
  const pts = [];
  for (let j = 0; j < n; j++) {
    const th = (TAU * j) / n, dx = Math.cos(th), dy = Math.sin(th);
    let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length], ex = Q[0] - P[0], ey = Q[1] - P[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((P[0] - mid[0]) * ey - (P[1] - mid[1]) * ex) / den, u = ((P[0] - mid[0]) * dy - (P[1] - mid[1]) * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
    }
    pts.push([mid[0] + best * dx, mid[1] + best * dy, 0]);
  }
  const at = corners.map((c) => { const j = mod(Math.round((Math.atan2(c[1], c[0]) / TAU) * n), n); pts[j] = [c[0], c[1], 0]; return j; });
  return { pts, at };
}

/** A sphere with one hole, drawn as what it is: a disc. parts: one star and at most two cone points. */
function buildDisc(parts) {
  const scene = new Scene(), anchors = new Array(parts.length);
  const si = parts.findIndex((p) => p.t === 'star'), cones = parts.map((p, i) => i).filter((i) => parts[i].t === 'cone');
  let L, outline, cornerAt = [];
  if (cones.length === 2) {
    L = flatPatch(2, { n: 80, ax: 1.3, ay: 0.92 });
    outline = L.outline;
    cones.forEach((pi, s) => { const c = addCone(scene, L, s, parts[pi].n); anchors[pi] = { at: c.tip, corners: [] }; });
  } else {
    const n = 80, o = plateOutline(parts[si].corners, n), site = flatSite([0, 0, 0]);
    let rin = Infinity;
    for (const p of o.pts) rin = Math.min(rin, Math.hypot(p[0], p[1]));
    L = { n, Rs: 0.8 * rin, sites: [{ site, boundary: o.pts, toward: new Map() }] };
    outline = o.pts; cornerAt = o.at;
    if (cones.length) { const c = addCone(scene, L, 0, parts[cones[0]].n); anchors[cones[0]] = { at: c.tip, corners: [] }; }
    else addCell(scene, { site, boundary: o.pts, Rs: L.Rs, hole: noHole });
  }
  const m = outline.length, rim = new Float32Array(3 * (m + 1));
  for (let j = 0; j <= m; j++) { const p = outline[j % m]; rim[3 * j] = p[0]; rim[3 * j + 1] = p[1]; rim[3 * j + 2] = p[2] + 0.004; }
  scene.addLines(() => ({ points: rim, color: RED, width: 3.4, xray: 0.5 }));
  // the star's own label: on the rim, at the front and away from the corners
  let jStar = 0, best = Infinity;
  for (let j = 0; j < m; j++) { const p = outline[j]; let clear = Infinity; for (const c of cornerAt) clear = Math.min(clear, Math.hypot(p[0] - outline[c][0], p[1] - outline[c][1])); const score = p[1] - 0.6 * Math.min(clear, 1); if (score < best) { best = score; jStar = j; } }
  anchors[si] = { at: () => outline[jStar], corners: cornerAt.map((j) => () => outline[j]) };
  let cx = 0, cy = 0, far = 0;
  for (const p of outline) { cx += p[0] / m; cy += p[1] / m; }
  for (const p of outline) far = Math.max(far, Math.hypot(p[0] - cx, p[1] - cy));
  scene.sameBothSides = true;          // a plate has nothing to show underneath: seen from below it keeps its colour (stage.js)
  return { scene, frame: { center: [cx, cy, 0.12], radius: Math.max(1.05, far * 1.12) }, anchors, view: { az: 0, el: 52 } };
}

/** The Examples tab's band ('annulus') or twisted band ('mobius'), its boundaries the mirrors. */
function buildModel(key, parts) {
  const m = measure(key), mesh = buildMesh(m.cx, m.paint.sign), scene = new Scene();
  const rims = m.boundaries.map((loop) => loopLine(m.cx, loop));
  scene.alloc(mesh.positions.length / 3);
  for (let t = 0; t < mesh.indices.length; t += 3) scene.tri(mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]);
  scene.onUpdate((P) => P.set(mesh.positions));
  scene.addLines(() => rims.map((points) => ({ points, color: RED, width: 3.4, loop: true, xray: 0.5 })));
  // a point of a rim: the one furthest along a direction (so that the labels of two rims stand apart)
  const far = (rim, d) => { let best = 0, bv = -Infinity; for (let i = 0; i < rim.length; i += 3) { const v = rim[i] * d[0] + rim[i + 1] * d[1] + rim[i + 2] * d[2]; if (v > bv) { bv = v; best = i; } } return [rim[best], rim[best + 1], rim[best + 2]]; };
  const anchors = [];
  let s = 0;
  parts.forEach((p, i) => {
    if (p.t === 'star') {
      const rim = rims[s % rims.length], side = s % 2 ? -1 : 1;
      s++;
      const at = far(rim, [0.55 * side, -1, 0]);
      anchors[i] = { at: () => at, corners: p.corners.map((_, q) => { const c = far(rim, [-0.9 * side - 0.5 * q, -0.6 + 0.9 * q, 0]); return () => c; }) };
    } else anchors[i] = { at: () => [-1, 0, 0], corners: [] };          // the cross: where the band has its half twist
  });
  return { scene, frame: m.def.frame, anchors, view: m.def.view };
}

export function buildSurface(parts) {
  const stars = parts.filter((p) => p.t === 'star'), cones = parts.filter((p) => p.t === 'cone');
  if (stars.length === 1 && stars.length + cones.length === parts.length && (cones.length <= 1 || (cones.length === 2 && stars[0].corners.length === 0))) return buildDisc(parts);
  const xs = parts.filter((p) => p.t === 'x').length;
  if (stars.length === 2 && parts.length === 2) return buildModel('annulus', parts);
  if (stars.length === 1 && xs === 1 && parts.length === 2 && stars[0].corners.length === 0) return buildModel('mobius', parts);
  if (!roomFor(parts)) throw new Error('buildSurface: more pieces than the ball has places');
  // places: handles on neighbouring pairs first, then one site each, nearest the viewer first
  const taken = new Set(), place = new Array(parts.length);
  let pi = 0;
  parts.forEach((p, i) => { if (p.t === 'o') { place[i] = PAIRS[pi++]; place[i].forEach((s) => taken.add(s)); } });
  parts.forEach((p, i) => { if (p.t !== 'o') { let s = 0; while (taken.has(s)) s++; taken.add(s); place[i] = [s]; } });
  // the ball is turned about the line of sight until its crosscaps and handles stand as high as they can: seen from
  // the tab's low camera they then show in profile (a crosscap looked at from straight above is only a dimple)
  const tops = parts.flatMap((p, i) => (p.t === 'x' || p.t === 'o' ? place[i] : []));
  let L = null, high = -Infinity;
  for (let k = 0; k < (tops.length ? 10 : 1); k++) {
    const cand = ball({ n: 40, aim: [...taken], spin: (k * TAU) / 10 });
    const h = tops.reduce((s, site) => s + cand.sites[site].site.n[2], 0);
    if (h > high + 1e-9) { high = h; L = cand; }
  }
  const scene = new Scene(), anchors = new Array(parts.length), one = () => 1;
  const used = new Map();
  parts.forEach((p, i) => place[i].forEach((s) => used.set(s, i)));
  for (let s = 0; s < 12; s++) if (!used.has(s)) addEmpty(scene, L, s);
  parts.forEach((p, i) => {
    const [a, b] = place[i], R = L.R || 1;
    if (p.t === 'o') {
      const tube = addTube(scene, L, a, b, { cross: false, progress: one, color: BLUE });
      anchors[i] = { at: () => tube.curve.at(tube.meet).p, corners: [] };
    } else if (p.t === 'x') {
      addCrosscapFeature(scene, L, a, { progress: one, color: RED, axis: 0.6 });
      const site = L.sites[a].site;
      anchors[i] = { at: () => site.point(0, 0, (SIZES.H + SIZES.k) * R), corners: [] };
    } else if (p.t === 'cone') {
      const cone = addCone(scene, L, a, p.n);
      anchors[i] = { at: cone.tip, corners: [] };
    } else {
      const hole = addMirrorHole(scene, L, a, p.corners.length);
      anchors[i] = { at: hole.middle, corners: hole.corners };
    }
  });
  const tall = parts.some((p) => p.t === 'o' || p.t === 'x');
  // the pieces face the eye of the default view; looked at from lower down they show their profile
  return { scene, frame: { center: L.frame.center, radius: (tall ? 1.6 : 1.42) * (L.R || 1) }, anchors, layout: L, view: { az: -14, el: 30 } };
}
