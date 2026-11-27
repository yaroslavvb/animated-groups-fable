// features.js — what can sit at a site of a body: nothing, a hole, and the four things a zipper makes.
//
// Every builder takes the scene, the layout and a site index (two for the tube features), builds the cell(s) and
// whatever is attached, and registers the zip lines. `progress` is a function returning 0 (open: the hole or holes
// with their arrows) .. 1 (zipped). Chapter 8, pp. 94-95:
//   cap          one hole, its two zips in opposite senses   the hole just closes
//   crosscap     one hole, its two zips in the same sense    each rim point meets the opposite one; the sheet crosses itself
//   handle       two holes, zips in opposite senses          two tubes grow out of the same side and meet
//   crosshandle  two holes, zips in the same sense           one tube grows out, the other in; they meet through the sheet
//
// Returned: { rims: [...] } where a rim is { ring(c), n, arcs: [{ c0, c1, sense }] } — the loops that carry arrows —
// so a caller can hit-test or decorate them.

import { addCell, addTubeHalf, addCrosscap, noHole, roundHole, ringPoints, chevron, mod } from './scene.js';
import { bezierChain } from './curve.js';
import { SIZES } from './layouts.js';
import { add, sub, scale, norm, cross, addScaled, smooth, ramp } from './vec.js';
import { THEME } from '../theme.js';

export const ZIP_COLORS = [[0, 0.447, 0.698], [0.902, 0.624, 0], [0.478, 0.361, 0.78], [0.8, 0.31, 0.45], [0.36, 0.49, 0.07], [0.34, 0.71, 0.91]];
const LINE_W = 2.6;

/** Lines for one rim: its arcs in their colours, an arrowhead in the middle of each arc. */
function rimLines(scene, rim, { color = ZIP_COLORS[0], alpha = () => 1, width = LINE_W, arrows = () => 1, size = 0.1 } = {}) {
  scene.addLines((S) => {
    const a = alpha();
    if (a <= 0.01) return null;
    const out = [];
    for (const arc of rim.arcs) {
      const col = arc.color || (typeof color === 'function' ? color() : color);
      out.push({ points: ringPoints(S, rim.ring, rim.n, arc.c0, arc.c1), color: col, width, alpha: a, xray: 0.4 });
      const aa = arrows() * a;
      if (arc.sense && aa > 0.01) {
        const ch = chevron(S, rim.ring, rim.n, Math.round((arc.c0 + arc.c1) / 2), arc.sense, size);
        if (ch) out.push({ points: ch, color: col, width: width + 0.4, alpha: aa, xray: 0.4 });
      }
    }
    return out;
  });
}

export function addEmpty(scene, L, s) {
  const { site, boundary } = L.sites[s];
  addCell(scene, { site, boundary, Rs: L.Rs, hole: noHole });
  return { rims: [] };
}

/** A plain hole: a boundary of the surface. `arcs` (optional) splits its rim into zips: [{ c0, c1, sense, color }]. */
export function addHole(scene, L, s, { r = SIZES.hole, arcs = null, color = () => THEME.ink, width = 2.2 } = {}) {
  const { site, boundary } = L.sites[s], R = L.R || 1;
  const cell = addCell(scene, { site, boundary, Rs: L.Rs, hole: roundHole(typeof r === 'function' ? () => r() * R : r * R) });
  const rim = { ring: cell.rim, n: L.n, arcs: arcs || [{ c0: 0, c1: L.n, sense: 0 }] };
  rimLines(scene, rim, { color, width });
  return { rims: [rim], cell };
}

/** A hole whose two half-rims are zipped as mirror images: it closes like a purse. p. 94, "Zipping a cap". */
export function addCap(scene, L, s, { r = SIZES.hole, progress, color = ZIP_COLORS[0] }) {
  const { site, boundary } = L.sites[s], n = L.n;
  const cell = addCell(scene, {
    site, boundary, Rs: L.Rs,
    hole: (j, th, out) => { const e = smooth(progress()); out[0] = r * Math.cos(th); out[1] = r * (1 - e) * Math.sin(th); },
  });
  const rim = { ring: cell.rim, n, arcs: [{ c0: 0, c1: n / 2, sense: 1 }, { c0: n / 2, c1: n, sense: -1 }] };
  rimLines(scene, rim, { color, alpha: () => 1 - 0.75 * ramp(progress(), 0.97, 1), arrows: () => 1 - ramp(progress(), 0.8, 0.97) });
  scene.addMarkers((S) => (progress() < 0.999 ? [0, n / 2].map((j) => ({ p: S.point(cell.rim(j)), color, size: 7, shape: 'dot' })) : null));
  return { rims: [rim], cell };
}

/** A hole whose rim is zipped to itself crosswise. p. 94, "Zipping a crosscap". */
export function addCrosscapFeature(scene, L, s, { progress, color = ZIP_COLORS[0], axis = 0, open = null, rh = null, sense = 1 }) {
  const { site, boundary } = L.sites[s], n = L.n, R = L.R || 1;
  const cell = addCell(scene, { site, boundary, Rs: L.Rs, hole: roundHole(SIZES.rc * R), ni: 2 });
  const cap = addCrosscap(scene, { site, rc: SIZES.rc * R, rh: rh === null ? SIZES.hole * R : rh, H: SIZES.H * R, k: SIZES.k * R, n, rim: cell.rim, progress: () => smooth(progress()), axis, open });
  const j0 = Math.round((axis / (2 * Math.PI)) * n);
  const rim = { ring: cap.seam, n, arcs: [{ c0: j0, c1: j0 + n / 2, sense }, { c0: j0 + n / 2, c1: j0 + n, sense }] };
  rimLines(scene, rim, { color, alpha: () => 1 - 0.55 * ramp(progress(), 0.97, 1), arrows: () => 1 - ramp(progress(), 0.75, 0.95) });
  scene.addMarkers((S) => (progress() < 0.999 ? [j0, j0 + n / 2].map((j) => ({ p: S.point(cap.seam(mod(j, n))), color, size: 7, shape: 'dot' })) : null));
  return { rims: [rim], cell, cap };
}

/**
 * Two holes joined by a tube. cross = false: a handle (both tubes leave on the outside and meet over the sheet).
 * cross = true: a cross-handle (A's tube leaves on the outside, B's on the inside; A's dives through the sheet
 * half-way between the two holes and they meet over the sheet, front against back). p. 95.
 */
export function addTube(scene, L, a, b, { cross: isCross = false, progress, color = ZIP_COLORS[0], open = null, endA = null, endB = null, lines = true, arrowB = null }) {
  const A = L.sites[a], B = L.sites[b], n = L.n, R = L.R || 1;
  const rt = SIZES.rt * R, f = SIZES.f * R, r0 = rt + f;
  const hole = roundHole(open ? () => r0 * open() : r0);
  const cellA = addCell(scene, { site: A.site, boundary: A.boundary, Rs: L.Rs, hole });
  const cellB = addCell(scene, { site: B.site, boundary: B.boundary, Rs: L.Rs, hole });
  const PA = A.site.origin, PB = B.site.origin, nA = A.site.n, nB = B.site.n;
  const nC = norm(add(nA, nB)), W = norm(cross(nC, sub(PB, PA)));
  const jA = A.toward.get(b), jB = B.toward.get(a);
  if (jA === undefined || jB === undefined) throw new Error('addTube: the two sites are not neighbours');
  let curve, meet;
  if (!isCross) {
    const l = SIZES.arch * R * (A.site.kind === 'sphere' ? 1.5 : 1);   // on a ball the two holes lean apart: reach further
    curve = bezierChain([[PA, addScaled(PA, nA, l), addScaled(PB, nB, l), PB]]);
    meet = curve.length / 2;
  } else {
    // the point of the bare sheet half-way between the two sites, where the tube goes through
    const C = A.site.blend(PA, PB, 0.5), up = SIZES.stitchUp * R * (A.site.kind === 'sphere' ? 1.25 : 1), down = SIZES.stitchDown * R;
    curve = bezierChain([
      [PA, addScaled(PA, nA, up), addScaled(C, nC, up), C],
      [C, addScaled(C, nC, -down), addScaled(PB, nB, -down), PB],
    ]);
    meet = curve.lengthAt(0, 0.5);
  }
  const g = () => smooth(progress());
  const halfA = addTubeHalf(scene, { curve, W, rt, f, n, from: 'A', meet, foot: (c) => cellA.rim(jA + c), grow: g, orient: 1, m: isCross ? 12 : 14, open, end: endA });
  const halfB = addTubeHalf(scene, {
    curve, W, rt, f, n, from: 'B', meet, grow: g, open, end: endB,
    foot: isCross ? (c) => cellB.rim(jB + n / 2 + c) : (c) => cellB.rim(jB - c),
    orient: isCross ? 1 : -1, m: isCross ? 26 : 14,
  });
  const rimA = { ring: halfA.end, n, arcs: [{ c0: 0, c1: n, sense: 1 }] };
  const rimB = { ring: halfB.end, n, arcs: [{ c0: 0, c1: n, sense: 1 }] };
  const fade = () => 1 - 0.5 * ramp(progress(), 0.97, 1), arrows = () => 1 - ramp(progress(), 0.85, 0.98);
  if (lines) {
    rimLines(scene, rimA, { color, alpha: fade, arrows });
    rimLines(scene, rimB, { color, alpha: () => (progress() > 0.999 ? 0 : 1), arrows: arrowB ? () => arrows() * arrowB() : arrows });
    scene.addMarkers((S) => (progress() < 0.999 ? [halfA, halfB].map((h) => ({ p: S.point(h.end(0)), color, size: 7, shape: 'dot' })) : null));
  }
  return { rims: [rimA, rimB], cellA, cellB, curve, meet, W, halfA, halfB, jA, jB };
}
