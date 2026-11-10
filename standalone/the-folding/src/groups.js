// groups.js — registry of the 17 wallpaper groups and the group-theoretic helpers everything else uses.
// A Group object:
//   id        ASCII orbifold symbol: 'o','2222','**','xx','*x','22x','22*','*2222','2*22','442','4*2','*442','333','3*3','*333','632','*632'
//   label     display symbol (∗ and × glyphs), hm (crystallographic name), shape (short noun for the folded shape), topology (precise phrase)
//   e1, e2    basis of the translation lattice (world units)
//   reps      coset representatives of the lattice: every element is  translate(m*e1 + n*e2) ∘ reps[k]
//   fold      'hinge' | 'torus' | 'cylinder' | 'mobius' | 'klein' | 'crosscap' | 'snowflake'
//   kaleido   null, or {group: Group (the kaleidoscope), cell: [[x,y],...] CCW polygon T, glued: [bool per side]}
//             side i runs cell[i] -> cell[(i+1)%n]; glued[i] is true when the reflection in that side is NOT in this group
//             (the two copies of T are joined there); false when it is a mirror of this group (an open rim).
//   warp      Group under which the "wavy cut" displacement field must be equivariant (kaleido.group when there is one, else itself)
//   presets   [{name, seed:[x,y], metric?:[q11,q12,q22]}]  — named cuts; presets[0] is the default
//   viewHalf  half-width of the square world window the plane view shows, centred on `center`
//   center    [x,y] centre of that window (default: centroid of the lattice cell)

import { IDENT, trans, compose, inverse, apply, det, classify, reflThrough, isoEquals } from './geom.js';
import hingeData from './groupdata/hinge.js';
import rollData from './groupdata/roll.js';
import crosscapData from './groupdata/crosscap.js';
import kaleidoData from './groupdata/kaleido.js';

function buildRaw(raw) {
  const g = {
    id: raw.id || null, label: raw.label || '', hm: raw.hm || '', shape: raw.shape || '', topology: raw.topology || '',
    e1: raw.e1.slice(), e2: raw.e2.slice(), reps: raw.reps.map((r) => ({ ...r })),
    fold: raw.fold || null, kaleido: null, warp: null,
    presets: (raw.presets || []).map((p) => ({ ...p })), viewHalf: raw.viewHalf || 1.2,
  };
  g.cellArea = Math.abs(g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0]);
  g.domainArea = g.cellArea / g.reps.length;
  g.center = raw.center ? raw.center.slice() : [(g.e1[0] + g.e2[0]) / 2, (g.e1[1] + g.e2[1]) / 2];
  return g;
}

/** Lattice coordinates (s, t) of the vector (x, y): (x, y) = s*e1 + t*e2. */
export function latticeCoords(group, x, y, out = [0, 0]) {
  const { e1, e2 } = group;
  const dd = e1[0] * e2[1] - e1[1] * e2[0];
  out[0] = (x * e2[1] - y * e2[0]) / dd;
  out[1] = (e1[0] * y - e1[1] * x) / dd;
  return out;
}

/** Is the isometry g an element of the group? */
export function contains(group, g, eps = 1e-6) {
  const st = [0, 0];
  for (const r of group.reps) {
    if (Math.abs(r.a - g.a) > eps || Math.abs(r.b - g.b) > eps || Math.abs(r.c - g.c) > eps || Math.abs(r.d - g.d) > eps) continue;
    latticeCoords(group, g.tx - r.tx, g.ty - r.ty, st);
    if (Math.abs(st[0] - Math.round(st[0])) < eps && Math.abs(st[1] - Math.round(st[1])) < eps) return true;
  }
  return false;
}

/**
 * All group elements g with |g(q) - (cx, cy)| <= radius, where q = (qx, qy) is any reference point
 * (default: group.center). Each element is returned once, as a fresh isometry object with an extra
 * field `rep` (index into group.reps).
 */
export function elementsNear(group, cx, cy, radius, qx = group.center[0], qy = group.center[1]) {
  const { e1, e2 } = group;
  const out = [];
  const st = [0, 0], p = [0, 0];
  // generous integer search range: radius measured in lattice coordinates
  const minH = group.cellArea / Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]));
  const N = Math.ceil(radius / minH) + 2;
  group.reps.forEach((r, k) => {
    apply(r, qx, qy, p);
    latticeCoords(group, cx - p[0], cy - p[1], st);
    const m0 = Math.round(st[0]), n0 = Math.round(st[1]);
    for (let m = m0 - N; m <= m0 + N; m++) {
      for (let n = n0 - N; n <= n0 + N; n++) {
        const x = p[0] + m * e1[0] + n * e2[0], y = p[1] + m * e1[1] + n * e2[1];
        if (Math.hypot(x - cx, y - cy) <= radius) {
          out.push({ a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx + m * e1[0] + n * e2[0], ty: r.ty + m * e1[1] + n * e2[1], rep: k });
        }
      }
    }
  });
  return out;
}

/**
 * Symmetry elements of the group within `radius` of (cx, cy), for drawing.
 * Returns {
 *   centers: [{x, y, order, onMirror}]     rotation centres (order = order of the rotation subgroup fixing the point)
 *   mirrors: [{px, py, ux, uy}]            mirror lines: point + unit direction
 *   glides:  [{px, py, ux, uy, dist}]      glide axes that are not mirror lines; dist = shortest glide translation (> 0)
 * }
 */
export function symmetryElements(group, cx, cy, radius) {
  const lmax = Math.hypot(group.e1[0], group.e1[1]) + Math.hypot(group.e2[0], group.e2[1]);
  const els = elementsNear(group, cx, cy, 2 * radius + 2 * lmax, cx, cy);
  const centers = new Map(), mirrors = new Map(), glides = new Map();
  const key2 = (x, y) => Math.round(x * 1e5) + ',' + Math.round(y * 1e5);
  const lineKey = (px, py, ux, uy) => {
    // normalise direction to angle in [0, pi) and signed offset along the normal
    let ang = Math.atan2(uy, ux);
    if (ang < -1e-9) ang += Math.PI;
    if (ang >= Math.PI - 1e-9) ang -= Math.PI;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const off = px * nx + py * ny;
    return { key: Math.round(ang * 1e5) + '|' + Math.round(off * 1e5), ang, off, nx, ny };
  };
  for (const g of els) {
    const c = classify(g);
    if (c.type === 'rotation') {
      if (Math.hypot(c.center[0] - cx, c.center[1] - cy) > radius) continue;
      const k = key2(c.center[0], c.center[1]);
      const prev = centers.get(k);
      if (!prev) centers.set(k, { x: c.center[0], y: c.center[1], order: c.order, onMirror: false });
      else if (c.order > prev.order) prev.order = c.order;
    } else if (c.type === 'reflection' || c.type === 'glide') {
      const L = lineKey(c.point[0], c.point[1], c.dir[0], c.dir[1]);
      const dline = Math.abs(cx * L.nx + cy * L.ny - L.off);
      if (dline > radius) continue;
      // foot of the perpendicular from the window centre, as the representative point
      const t = cx * Math.cos(L.ang) + cy * Math.sin(L.ang);
      const px = L.off * L.nx + t * Math.cos(L.ang), py = L.off * L.ny + t * Math.sin(L.ang);
      const rec = { px, py, ux: Math.cos(L.ang), uy: Math.sin(L.ang) };
      if (c.type === 'reflection') mirrors.set(L.key, rec);
      else {
        const prev = glides.get(L.key), d = Math.abs(c.dist);
        if (!prev || d < prev.dist - 1e-9) glides.set(L.key, { ...rec, dist: d });
      }
    }
  }
  for (const k of mirrors.keys()) glides.delete(k);
  const ms = [...mirrors.values()];
  const cs = [...centers.values()];
  for (const c of cs) {
    c.onMirror = ms.some((m) => Math.abs((c.x - m.px) * -m.uy + (c.y - m.py) * m.ux) < 1e-6);
  }
  return { centers: cs, mirrors: ms, glides: [...glides.values()] };
}

function finish(raw) {
  const g = buildRaw(raw);
  if (raw.kaleido) {
    const kg = buildRaw(raw.kaleido);
    const cell = raw.kaleido.cell.map((p) => p.slice());
    const glued = cell.map((p, i) => !contains(g, reflThrough(p, cell[(i + 1) % cell.length])));
    g.kaleido = { group: kg, cell, glued };
  }
  g.warp = raw.warpGroup ? buildRaw(raw.warpGroup) : (g.kaleido ? g.kaleido.group : g);
  return g;
}

// Display order: by point-group order, the tiers of the Hasse diagram (o on top).
const ORDER = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const all = [...hingeData, ...rollData, ...crosscapData, ...kaleidoData].map(finish);

/** The 17 groups in display order. */
export const GROUPS = ORDER.map((id) => {
  const g = all.find((x) => x.id === id);
  if (!g) throw new Error('missing group ' + id);
  return g;
});

/** Map id -> Group. */
export const BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

export { IDENT, trans, compose, inverse, apply, det, classify, isoEquals };
