// mesh.js — the map drawn smoothly: every face of a complex cut into little quads on its own chart, and the lines
// that ride on it (the map's edges, the boundary curves).
//
//   buildMesh(cx, sign)  -> { positions: Float32Array(3n), indices: Uint32Array(3m) }
//       sign[patch] = +1: wound the chart's way (da x db is the FRONT), -1: the other way (complex.js paint()).
//       Where two faces meet and are wound alike, the little vertices along their shared edge are made one, so the
//       shading runs smoothly across; along a seam (front meets back) they stay apart, as the renderer asks.
//   sideLine(cx, face, k)   the points along side k of a face, at the mesh's own steps (so the line lies ON the mesh)
//   edgeLine(cx, edge)      the same for an edge of the map
//   loopLine(cx, loop)      a boundary curve (complex.js boundaryLoops) as one closed polyline

import { sideAt } from './complex.js';

const EPS = 1e-6;

export function buildMesh(cx, sign) {
  const base = [], dims = [];
  let count = 0;
  for (const patch of cx.patches) {
    const Na = (patch.as.length - 1) * patch.sub[0] + 1, Nb = (patch.bs.length - 1) * patch.sub[1] + 1;
    base.push(count); dims.push([Na, Nb]); count += Na * Nb;
  }
  const P = new Float64Array(3 * count);
  cx.patches.forEach((patch, pi) => {
    const [Na, Nb] = dims[pi], [sa, sb] = patch.sub, at = (list, I, s) => { const i = Math.min(list.length - 2, Math.floor(I / s)); return list[i] + ((list[i + 1] - list[i]) * (I - i * s)) / s; };
    for (let J = 0; J < Nb; J++) for (let I = 0; I < Na; I++) P.set(patch.f(at(patch.as, I, sa), at(patch.bs, J, sb)), 3 * (base[pi] + J * Na + I));
  });

  // the little vertices along side k of a face, from corner k to corner k + 1
  const along = (face, k) => {
    const [sa, sb] = cx.patches[face.patch].sub, Na = dims[face.patch][0], b0 = base[face.patch];
    const I0 = face.i * sa, I1 = I0 + sa, J0 = face.j * sb, J1 = J0 + sb, out = [];
    if (k === 0) for (let I = I0; I <= I1; I++) out.push(b0 + J0 * Na + I);
    else if (k === 1) for (let J = J0; J <= J1; J++) out.push(b0 + J * Na + I1);
    else if (k === 2) for (let I = I1; I >= I0; I--) out.push(b0 + J1 * Na + I);
    else for (let J = J1; J >= J0; J--) out.push(b0 + J * Na + I0);
    return out;
  };

  const parent = Int32Array.from({ length: count }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (i, j) => { i = find(i); j = find(j); if (i !== j) parent[Math.max(i, j)] = Math.min(i, j); };
  const same = (i, j) => Math.abs(P[3 * i] - P[3 * j]) < EPS && Math.abs(P[3 * i + 1] - P[3 * j + 1]) < EPS && Math.abs(P[3 * i + 2] - P[3 * j + 2]) < EPS;
  for (const face of cx.faces) for (let k = 0; k < 4; k++) if (!face.sides[k]) { const v = along(face, k); for (const i of v) union(v[0], i); }   // a pole
  for (const e of cx.edges) {
    if (e.uses.length < 2) continue;
    const [u, w] = e.uses, fu = cx.faces[u.face], fw = cx.faces[w.face], rel = u.from === w.to ? 1 : -1;
    if (sign[fu.patch] * sign[fw.patch] * rel < 0) continue;                // a seam: front meets back, keep them apart
    const A = along(fu, u.k), B = along(fw, w.k);
    if (rel > 0) B.reverse();
    if (A.length === B.length && A.every((i, t) => same(i, B[t]))) A.forEach((i, t) => union(i, B[t]));
  }

  const slot = new Int32Array(count).fill(-1), pos = [];
  const id = (i) => { const r = find(i); if (slot[r] < 0) { slot[r] = pos.length / 3; pos.push(P[3 * r], P[3 * r + 1], P[3 * r + 2]); } return slot[r]; };
  const tris = [];
  const tri = (a, b, c) => { if (a !== b && b !== c && a !== c) tris.push(a, b, c); };
  cx.patches.forEach((patch, pi) => {
    const [Na, Nb] = dims[pi], b0 = base[pi], s = sign[pi];
    for (let J = 0; J < Nb - 1; J++) for (let I = 0; I < Na - 1; I++) {
      const v00 = id(b0 + J * Na + I), v10 = id(b0 + J * Na + I + 1), v11 = id(b0 + (J + 1) * Na + I + 1), v01 = id(b0 + (J + 1) * Na + I);
      if (s > 0) { tri(v00, v10, v11); tri(v00, v11, v01); } else { tri(v00, v11, v10); tri(v00, v01, v11); }
    }
  });
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(tris) };
}

/** Points along side k of a face (from corner k to corner k + 1), at the mesh's steps; `forward` false: reversed. */
export function sideLine(cx, face, k, forward = true) {
  const patch = cx.patches[face.patch], steps = patch.sub[k % 2], out = [];
  for (let i = 0; i <= steps; i++) out.push(patch.f(...sideAt(face, k, (forward ? i : steps - i) / steps)));
  return out;
}

export function edgeLine(cx, edge) {
  const u = edge.uses[0];
  return Float32Array.from(sideLine(cx, cx.faces[u.face], u.k).flat());
}

/** A boundary curve as one closed polyline (the last point of each edge is the first of the next, so it is left out). */
export function loopLine(cx, loop) {
  const out = [];
  for (const step of loop) { const pts = sideLine(cx, cx.faces[step.face], step.k, step.forward); pts.pop(); for (const p of pts) out.push(p[0], p[1], p[2]); }
  return Float32Array.from(out);
}
