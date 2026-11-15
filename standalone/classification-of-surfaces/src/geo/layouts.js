// layouts.js — where the sites of a body are and what each cell's outline is.
//
// A layout is { n, Rs, sites: [{ site, boundary, toward }], frame: { center, radius } }:
//   n         samples round every rim and every cell outline (even, so an opposite sample exists)
//   Rs        footprint radius of a feature (in the site's chart)
//   boundary  the cell's outline, n world points (see scene.js addCell)
//   toward    Map(other site index -> the rim sample that points at that site); only neighbours are listed
//
// flatPatch(1 | 2): the oval patch of sheet of the Zippers tab, one site in the middle or two side by side.
// ball(): a sphere cut into the twelve pentagons of a dodecahedron, one site in the middle of each. Neighbouring
// sites are 63.4 degrees apart, and the outline samples of neighbouring cells coincide, so the body has no cracks.

import { flatSite, sphereSite } from './sites.js';
import { add, sub, scale, norm, dot, cross, slerp, addScaled, rotate } from './vec.js';

const TAU = 2 * Math.PI;

export const SIZES = Object.freeze({
  Rs: 0.5,         // footprint of a feature
  rt: 0.15,        // tube radius
  f: 0.08,         // fillet where a tube flares into the sheet; a tube's hole has radius rt + f
  hole: 0.23,      // a plain hole, and the hole a zipper starts from
  rc: 0.47,        // the collar of a crosscap
  H: 0.36, k: 0.2, // crosscap: the crossing segment runs from H - k to H + k above the sheet
  arch: 0.66,      // handle: how far the Bezier handles reach out of the two holes
  stitchUp: 0.5, stitchDown: 0.46,   // cross-handle: the arch over the sheet and the U under it
});

export function flatPatch(count = 1, { n = 80, ax = count === 1 ? 1.05 : 1.28, ay = 0.8, d = 0.55 } = {}) {
  const frame = { center: [0, 0, 0.14], radius: count === 1 ? 0.98 : 1.12 };
  if (count === 1) {
    const site = flatSite([0, 0, 0]);
    const boundary = [];
    for (let j = 0; j < n; j++) {
      const th = (TAU * j) / n, c = Math.cos(th), s = Math.sin(th), r = 1 / Math.hypot(c / ax, s / ay);
      boundary.push([r * c, r * s, 0]);
    }
    return { n, Rs: SIZES.Rs, sites: [{ site, boundary, toward: new Map() }], frame, outline: boundary };
  }
  // two sites at (-d, 0) and (d, 0); the cells are the two halves of the oval
  const left = [];
  for (let j = 0; j < n; j++) {
    const th = (TAU * j) / n, c = Math.cos(th), s = Math.sin(th);
    const A = (c * c) / (ax * ax) + (s * s) / (ay * ay), B = (d * c) / (ax * ax), C = (d * d) / (ax * ax) - 1;
    let t = (B + Math.sqrt(B * B - A * C)) / A;
    if (c > 1e-9) t = Math.min(t, d / c);
    left.push([-d + t * c, t * s, 0]);
  }
  // put a sample exactly on each corner where the oval meets the middle line, or the two cells leave a notch there
  const corner = Math.atan2(ay, d), jc = Math.round((corner / TAU) * n);
  left[jc] = [0, ay, 0];
  left[n - jc] = [0, -ay, 0];
  const right = new Array(n);
  for (let j = 0; j < n; j++) { const p = left[j]; right[(((n / 2 - j) % n) + n) % n] = [-p[0], p[1], 0]; }
  // the oval's outline: round the left cell from the top corner to the bottom one, then back round the right cell
  const outline = [];
  for (let j = jc; j <= n - jc; j++) outline.push(left[j]);
  for (let j = jc + n / 2 + 1; j < n / 2 - jc + n; j++) outline.push(right[j % n]);
  return {
    n, Rs: SIZES.Rs, frame, outline,
    sites: [
      { site: flatSite([-d, 0, 0]), boundary: left, toward: new Map([[1, 0]]) },
      { site: flatSite([d, 0, 0]), boundary: right, toward: new Map([[0, n / 2]]) },
    ],
  };
}

const PHI = (1 + Math.sqrt(5)) / 2;

/** The 12 directions of an icosahedron's vertices, turned so that the first one points at `facing`. */
function icosahedron(facing, spin) {
  let V = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) { V.push([0, a, b * PHI]); V.push([a, b * PHI, 0]); V.push([b * PHI, 0, a]); }
  V = V.map(norm);
  const f = norm(facing), v0 = V[0];
  const axis = cross(v0, f), s = Math.hypot(axis[0], axis[1], axis[2]), ang = Math.atan2(s, dot(v0, f));
  if (s > 1e-9) { const k = scale(axis, 1 / s); V = V.map((v) => rotate(v, k, ang)); }
  if (spin) V = V.map((v) => rotate(v, f, spin));
  return V;
}

/**
 * ball({ R, center, n, facing, spin }): twelve sites. Site 0 points at `facing` (by default at the eye of the
 * renderer's default view), sites 1-5 ring it in counter-clockwise order, 6-10 ring the far side, 11 is opposite.
 * look: 'vertex' leaves it so; 'edge' / 'face' turn the middle of sites 0, 1 (and 2) to the viewer.
 * aim: [site, ...] instead turns the middle of THOSE sites to the viewer, and a little below the centre of the
 * view, so that what stands on them is seen from slightly above (a handle shows its arch). An empty list: 'face'.
 */
export function ball({ R = 1, center = [0, 0, 0], n = 40, facing = [0, -Math.cos((55 * Math.PI) / 180), Math.sin((55 * Math.PI) / 180)], spin = 0, look = 'face', aim = null } = {}) {
  if (n % 10) throw new Error('ball: n must be a multiple of 10');
  const K = n / 5;
  let V = icosahedron(facing, spin);
  // order: 0 = facing, then by angle from it; within a ring counter-clockwise about `facing`
  const f = norm(facing), ref = norm(sub(V[1], scale(f, dot(V[1], f)))), ref2 = cross(f, ref);
  // angles are read from just before `ref`, so that no vertex sits on the cut (one of the far ring lies exactly opposite
  // `ref`, and the sign of its zero would decide its place: differently in different browsers)
  const key = (v) => { const c = dot(v, f); const ring = c > 0.9 ? 0 : c > 0 ? 1 : c > -0.9 ? 2 : 3; return ring * 10 + ((Math.atan2(dot(v, ref2), dot(v, ref)) + TAU + 0.2) % TAU) / TAU; };
  V = V.slice().sort((a, b) => key(a) - key(b));
  // what faces the viewer: site 0 itself, the middle of sites 0 and 1, or the middle of sites 0, 1 and 2
  if (aim && aim.length) {
    let m = [0, 0, 0];
    for (const i of aim) m = add(m, V[i]);
    const l = Math.hypot(m[0], m[1], m[2]);
    const target = l > 0.3 ? scale(m, 1 / l) : V[aim[0]];
    // where it should point: the eye's direction tipped down the screen by `tilt`
    const up = norm(sub([0, 0, 1], scale(f, f[2]))), tilt = 0.14;
    const goal = norm(sub(scale(f, Math.cos(tilt)), scale(up, Math.sin(tilt))));
    const ax2 = cross(target, goal), s2 = Math.hypot(ax2[0], ax2[1], ax2[2]);
    if (s2 > 1e-9) { const k2 = scale(ax2, 1 / s2), a2 = Math.atan2(s2, dot(target, goal)); V = V.map((v) => rotate(v, k2, a2)); }
  } else if (look !== 'vertex') {
    const target = norm(look === 'edge' ? add(V[0], V[1]) : add(add(V[0], V[1]), V[2]));
    const ax2 = cross(target, f), s2 = Math.hypot(ax2[0], ax2[1], ax2[2]);
    if (s2 > 1e-9) { const k2 = scale(ax2, 1 / s2), a2 = Math.atan2(s2, dot(target, f)); V = V.map((v) => rotate(v, k2, a2)); }
  }
  const adj = (a, b) => Math.abs(dot(V[a], V[b]) - 1 / Math.sqrt(5)) < 1e-6;
  const sites = [];
  for (let v = 0; v < 12; v++) {
    const nb = [];
    for (let w = 0; w < 12; w++) if (w !== v && adj(v, w)) nb.push(w);
    // sort the five neighbours counter-clockwise seen from outside
    const nv = V[v], t0 = norm(sub(V[nb[0]], scale(nv, dot(V[nb[0]], nv)))), t1 = cross(nv, t0);
    nb.sort((a, b) => Math.atan2(dot(V[a], t1), dot(V[a], t0)) - Math.atan2(dot(V[b], t1), dot(V[b], t0)));
    // corner k = the middle of the face (v, nb[k - 1], nb[k]); the edge from corner k to corner k + 1 faces nb[k]
    const corners = nb.map((w, k) => norm(add(add(nv, V[w]), V[nb[(k + 4) % 5]])));
    const site = sphereSite(center, R, nv, corners[0]);
    const boundary = [];
    for (let k = 0; k < 5; k++) {
      const a = corners[k], b = corners[(k + 1) % 5];
      // the same floats from both cells that share this edge: always interpolate from the "smaller" corner
      const flip = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
      for (let m = 0; m < K; m++) {
        const w = m / K, dir = flip ? slerp(b, a, 1 - w) : slerp(a, b, w);
        boundary.push(addScaled(center, m === 0 ? a : dir, R));
      }
    }
    const toward = new Map();
    nb.forEach((w, k) => toward.set(w, k * K + K / 2));
    sites.push({ site, boundary, toward });
  }
  return { n, Rs: SIZES.Rs * R, sites, frame: { center: center.slice(), radius: 1.45 * R }, R };
}

/** Pairs of neighbouring sites of a ball layout, nearest the viewer first: where a handle can go. */
export function neighbourPairs(layout) {
  const out = [];
  layout.sites.forEach((s, a) => { for (const b of s.toward.keys()) if (b > a) out.push([a, b]); });
  return out.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
}
