// complex.js — a surface as a MAP (p. 105: "drawing a map on the surface"), and what can be counted on it.
//
// A surface is a list of PATCHES. A patch is a smooth chart f(a, b) -> [x, y, z] over a grid of coarse cells:
//   { f, as: [a0 .. an], bs: [b0 .. bm], sub: [sa, sb] }     n x m quads; sub = display steps per cell (mesh.js)
// The cells are the map's FACES. Nothing says which sides are glued: buildComplex() finds out by WELDING, i.e. two
// corners are one vertex when they are the same point of space (and lie in the same tangent plane: where the Klein
// bottle passes through itself two sheets touch without being glued), and two sides are one edge when their end
// points and their middle points are. A side that has shrunk to a point (the centre of a disc in polar coordinates)
// is no edge at all, so its quad counts as a triangle.
//
// From the welded map, and from nothing else:
//   analyse(cx)        -> { V, E, F, chi, b, boundaries, orientable }
//   tidyForm(numbers)  -> { o, star, x, X }   Theorem 8.2: the three numbers name the surface
//   paint(cx)          -> which way round each patch is drawn, and the seams where front has to meet back
//   reversingLoop(cx)  -> a closed chain of faces that comes back turned over (only a one-sided surface has one)
//   loopThrough(cx, faces) -> the same record for a chain of faces given by hand
// No DOM here: test/examples.test.js runs all of it under node.

import { sub, cross, norm, dot } from '../geo/vec.js';

const EPS = 1e-6;            // two points this close are the same point
const SAME_PLANE = 0.8;      // ... when their tangent planes agree too: |n . n'| above this

/** A cell's corners as fractions (s, t) of the cell, counter-clockwise in the chart. Side k runs corner k -> k + 1. */
export const CORNER = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** The chart point of a face at the fractions (s, t) of its cell. */
export function chartAt(face, s, t) { return [face.a0 + (face.a1 - face.a0) * s, face.b0 + (face.b1 - face.b0) * t]; }

/** The chart point at fraction u along side k of a face (from corner k to corner k + 1). */
export function sideAt(face, k, u) {
  const p = CORNER[k], q = CORNER[(k + 1) % 4];
  return chartAt(face, p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u);
}

/** Unit normal of the chart f at (a, b), by central differences with steps (ha, hb). Its sign means nothing here. */
export function chartNormal(f, a, b, ha, hb) {
  return norm(cross(sub(f(a + ha, b), f(a - ha, b)), sub(f(a, b + hb), f(a, b - hb))));
}

/** The tangent plane of a face at the fractions (s, t), read a hair inside the cell (a pole has none of its own). */
function planeAt(f, face, s, t) {
  const [a, b] = chartAt(face, s + (0.5 - s) * 2e-3, t + (0.5 - t) * 2e-3);
  return chartNormal(f, a, b, (face.a1 - face.a0) * 1e-4, (face.b1 - face.b0) * 1e-4);
}

function near(p, q) { return Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS && Math.abs(p[2] - q[2]) < EPS; }

/** Weld the patches into one map. Throws when the map is not a proper one (see the messages). */
export function buildComplex(patches) {
  const verts = [], mids = [], faces = [], edges = [], byKey = new Map(), offset = [];
  const weld = (list, p, n) => {
    for (let i = 0; i < list.length; i++) if (near(list[i].p, p) && Math.abs(dot(list[i].n, n)) > SAME_PLANE) return i;
    list.push({ p, n });
    return list.length - 1;
  };
  patches.forEach((patch, pi) => {
    offset.push(faces.length);
    const { f } = patch;
    for (let j = 0; j < patch.bs.length - 1; j++) for (let i = 0; i < patch.as.length - 1; i++) {
      const face = { id: faces.length, patch: pi, i, j, a0: patch.as[i], a1: patch.as[i + 1], b0: patch.bs[j], b1: patch.bs[j + 1], sides: [] };
      const corner = CORNER.map(([s, t]) => weld(verts, f(...chartAt(face, s, t)), planeAt(f, face, s, t)));
      for (let k = 0; k < 4; k++) {
        const from = corner[k], to = corner[(k + 1) % 4];
        const s = (CORNER[k][0] + CORNER[(k + 1) % 4][0]) / 2, t = (CORNER[k][1] + CORNER[(k + 1) % 4][1]) / 2;
        const pm = f(...chartAt(face, s, t));
        if (from === to) {
          if (near(pm, verts[from].p)) { face.sides.push(null); continue; }       // the side is a single point
          throw new Error(`map: face ${face.id} of patch ${pi} has a side that starts and ends at one vertex; cut it in two`);
        }
        const mid = weld(mids, pm, planeAt(f, face, s, t));
        const key = Math.min(from, to) + ':' + Math.max(from, to) + ':' + mid;
        let e = byKey.get(key);
        if (e === undefined) { e = edges.length; edges.push({ id: e, mid, uses: [] }); byKey.set(key, e); }
        edges[e].uses.push({ face: face.id, k, from, to });
        face.sides.push({ k, from, to, edge: e });
      }
      faces.push(face);
    }
  });
  for (const e of edges) if (e.uses.length > 2) throw new Error(`map: edge ${e.id} lies in ${e.uses.length} faces`);
  return { patches, verts, faces, edges, offset };
}

/** The face of patch p at cell (i, j). */
export function faceId(cx, p, i, j) { return cx.offset[p] + j * (cx.patches[p].as.length - 1) + i; }

/**
 * What lies across side k of face f: { face, k, rel } or null (a boundary, or a collapsed side).
 * rel = +1 when the two charts turn the same way there (they run along the shared edge in opposite directions),
 * -1 when one of them is the other's mirror image.
 */
export function across(cx, f, k) {
  const s = cx.faces[f].sides[k];
  if (!s) return null;
  const uses = cx.edges[s.edge].uses;
  if (uses.length < 2) return null;
  const o = uses[0].face === f && uses[0].k === k ? uses[1] : uses[0];
  return { face: o.face, k: o.k, rel: s.from === o.to ? 1 : -1, edge: s.edge };
}

/** Boundary edges (in one face only) strung into closed chains: [[{ edge, face, k, forward }, ...], ...]. */
export function boundaryLoops(cx) {
  const rim = cx.edges.filter((e) => e.uses.length === 1), at = new Map();
  for (const e of rim) for (const v of [e.uses[0].from, e.uses[0].to]) { if (!at.has(v)) at.set(v, []); at.get(v).push(e.id); }
  for (const [v, list] of at) if (list.length !== 2) throw new Error(`map: ${list.length} boundary edges meet at vertex ${v}`);
  const seen = new Set(), loops = [];
  for (const e0 of rim) {
    if (seen.has(e0.id)) continue;
    const loop = [];
    let e = e0, v = e0.uses[0].from;
    do {
      seen.add(e.id);
      const u = e.uses[0], forward = u.from === v;
      loop.push({ edge: e.id, face: u.face, k: u.k, forward });
      v = forward ? u.to : u.from;
      const [x, y] = at.get(v);
      e = cx.edges[x === e.id ? y : x];
    } while (e !== e0);
    loops.push(loop);
  }
  return loops;
}

/**
 * Try to turn every face the same way round, starting from face 0 and crossing one shared edge at a time. An edge
 * whose two faces have both been turned already and disagree is a conflict: the surface has one side only.
 */
export function orientation(cx) {
  const sign = new Array(cx.faces.length).fill(0), conflicts = new Set(), queue = [0];
  sign[0] = 1;
  while (queue.length) {
    const f = queue.shift();
    for (let k = 0; k < 4; k++) {
      const nx = across(cx, f, k);
      if (!nx) continue;
      if (!sign[nx.face]) { sign[nx.face] = sign[f] * nx.rel; queue.push(nx.face); }
      else if (sign[nx.face] !== sign[f] * nx.rel) conflicts.add(nx.edge);
    }
  }
  return { orientable: conflicts.size === 0, sign, conflicts: [...conflicts], connected: sign.every((s) => s !== 0) };
}

/** The three numbers of p. 105, counted on the map. */
export function analyse(cx) {
  const used = new Set();
  for (const f of cx.faces) for (const s of f.sides) if (s) { used.add(s.from); used.add(s.to); }
  const V = used.size, E = cx.edges.length, F = cx.faces.length, boundaries = boundaryLoops(cx), o = orientation(cx);
  if (!o.connected) throw new Error('map: the surface is in more than one piece');
  return { V, E, F, chi: V - E + F, b: boundaries.length, boundaries, orientable: o.orientable };
}

/**
 * Theorem 8.2 read backwards (pp. 102-103): a two-sided surface with b boundaries is a sphere with b holes and
 * a = (2 - b - chi) / 2 handles; a one-sided one has b holes and c = 2 - b - chi crosscaps.
 */
export function tidyForm({ chi, b, orientable }) {
  const rest = 2 - b - chi;
  if (orientable) {
    if (rest < 0 || rest % 2) throw new Error(`no two-sided surface has chi = ${chi} and ${b} boundaries`);
    return { o: rest / 2, star: b, x: 0, X: 0 };
  }
  if (rest < 1) throw new Error(`no one-sided surface has chi = ${chi} and ${b} boundaries`);
  return { o: 0, star: b, x: rest, X: 0 };
}

/**
 * Which way round each PATCH is drawn (+1: the chart's own way, da x db is the front). Patches are turned to agree
 * with patch 0 wherever that can be done, one junction at a time; what cannot agree is a SEAM, an edge where the
 * front of one face meets the back of the next. A two-sided surface has none.
 */
export function paint(cx, root = 1) {
  const sign = new Array(cx.patches.length).fill(0), queue = [0];
  sign[0] = root;
  const links = [];
  for (const e of cx.edges) {
    if (e.uses.length < 2) continue;
    const [u, w] = e.uses, pu = cx.faces[u.face].patch, pw = cx.faces[w.face].patch;
    links.push({ edge: e.id, pu, pw, rel: u.from === w.to ? 1 : -1 });
  }
  while (queue.length) {
    const p = queue.shift();
    for (const l of links) {
      if (l.pu === l.pw || (l.pu !== p && l.pw !== p)) continue;
      const q = l.pu === p ? l.pw : l.pu;
      if (!sign[q]) { sign[q] = sign[p] * l.rel; queue.push(q); }
    }
  }
  const seams = links.filter((l) => sign[l.pu] * sign[l.pw] * l.rel < 0).map((l) => l.edge);
  return { sign, seams };
}

// ---------------------------------------------------------------------------------------------------------------
// Loops of faces, for the pinwheel (p. 101). A loop is [{ face, kin, kout }]: the face is entered through side kin
// and left through side kout into the next one (the last into the first).

const turnCost = (kin, kout) => ((kout - kin + 4) % 4 === 2 ? 1 : 1.6);   // straight across a quad is cheapest

/**
 * The cheapest closed chain of faces that comes back TURNED OVER, or null when there is none. Found on the map's
 * double cover: a state is a face, the side it was entered through and whether the orientation carried along has
 * been reversed an odd number of times; the loop is a path from a face back to itself in the other state. Straight
 * runs are cheaper than turns, so the loop follows a band rather than zigzagging.
 */
export function reversingLoop(cx) {
  const F = cx.faces.length, key = (f, kin, s) => f * 8 + kin * 2 + (s < 0 ? 1 : 0);
  let best = null;
  for (let f0 = 0; f0 < F; f0++) for (let k0 = 0; k0 < 4; k0++) {
    const first = across(cx, f0, k0);
    if (!first || first.face === f0) continue;
    const dist = new Map(), prev = new Map(), open = [{ f: first.face, kin: first.k, s: first.rel, d: 0 }];
    dist.set(key(first.face, first.k, first.rel), 0);
    while (open.length) {
      let m = 0;
      for (let i = 1; i < open.length; i++) if (open[i].d < open[m].d) m = i;
      const cur = open.splice(m, 1)[0];
      if (cur.d > dist.get(key(cur.f, cur.kin, cur.s)) || cur.f === f0) continue;      // back home: the path ends
      for (let k = 0; k < 4; k++) {
        if (k === cur.kin) continue;
        const nx = across(cx, cur.f, k);
        if (!nx) continue;
        const nd = cur.d + turnCost(cur.kin, k), ns = cur.s * nx.rel, kk = key(nx.face, nx.k, ns);
        if (nd < (dist.has(kk) ? dist.get(kk) : Infinity)) {
          dist.set(kk, nd);
          prev.set(kk, { back: key(cur.f, cur.kin, cur.s), face: cur.f, kin: cur.kin, kout: k });
          open.push({ f: nx.face, kin: nx.k, s: ns, d: nd });
        }
      }
    }
    for (let kin = 0; kin < 4; kin++) {
      const end = key(f0, kin, -1);
      if (!dist.has(end)) continue;
      const cost = dist.get(end) + turnCost(kin, k0);
      if (best && cost >= best.cost - 1e-9) continue;
      const loop = [];
      for (let at = end; prev.has(at); at = prev.get(at).back) { const p = prev.get(at); loop.unshift({ face: p.face, kin: p.kin, kout: p.kout }); }
      loop.unshift({ face: f0, kin, kout: k0 });
      if (new Set(loop.map((l) => l.face)).size === loop.length) best = { cost, loop };
    }
  }
  return best ? best.loop : null;
}

/** The loop record for a closed chain of neighbouring faces listed by hand (ids, in order). */
export function loopThrough(cx, ids) {
  const n = ids.length, loop = ids.map((face) => ({ face, kin: -1, kout: -1 }));
  for (let i = 0; i < n; i++) {
    const next = ids[(i + 1) % n];
    let found = false;
    for (let k = 0; k < 4 && !found; k++) {
      const nx = across(cx, ids[i], k);
      if (nx && nx.face === next) { loop[i].kout = k; loop[(i + 1) % n].kin = nx.k; found = true; }
    }
    if (!found) throw new Error(`loop: faces ${ids[i]} and ${next} share no edge`);
  }
  return loop;
}

/** Does the orientation carried round a loop of faces come back reversed? (The combinatorial answer.) */
export function loopReverses(cx, loop) {
  let s = 1;
  for (const l of loop) s *= across(cx, l.face, l.kout).rel;
  return s < 0;
}
