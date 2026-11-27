// pieces.js — the rigid pieces an orbifold falls into when it is cut along a decomposition, each in a chart of its own.
//
// Every hyperbolic piece comes from ONE figure, the generalized right-angled hexagon: three "ends" alternating with
// three "seams". An end is a side of given length, square to both its seams, or it has shrunk to a vertex of given
// angle. hexagon() walks round it like a turtle; the walk closing up is the check on the cosine rule that gives the
// seams' lengths.
//
//   P  a pair of pants: ends are cuffs (closed cuts of length len: the hexagon's side is len / 2) or cone points of
//      order n (the hexagon's angle is pi / n). Two hexagons, front and back, glued along the three seams.
//   M  a mirror polygon: the three seams are MIRRORS. Ends are arcs (cuts from mirror to mirror, the side is the
//      whole arc) or corners of order n (angle pi / n). One hexagon.
//   S  half a pair of pants (c, c, f) that has a mirror symmetry swapping its two equal ends: one end c (a cuff or a
//      cone point) and, in place of the third end, a piece of MIRROR. f is an arc that runs from the mirror round c
//      and back (the pants' third cuff, halved) or a corner on the mirror (the pants' third cone point, halved).
//      Two half hexagons. (cuff | corner) is the "crown" round a mirror with one corner.
//
// and for the Euclidean plane, where a cylinder has a height of its own:
//
//   A  a flat annulus: circumference len, height h. Two cuff ends, bottom and top
//   R  a flat strip between two mirrors: width len (an arc from mirror to mirror), height h. Two arc ends
//
// A piece with two order-2 cone points and a cuff (or two order-2 corners and an arc, or S with a cone point of order
// 2) has no area: it is a CAP folded onto its cut. degenerate() says so; such a piece has no atoms.
//
// buildPiece(spec) returns
//   atoms   [{ verts, roles, twin }]      convex polygons, counter-clockwise, in the piece's chart; roles[i] is what
//                                         the edge from verts[i] to verts[i + 1] is:
//             { r: 'end', k, s0, s1 }       on end k (a cut), from s0 to s1 along the end's own axis
//             { r: 'seam', nbr: { atom, T } } inside the piece: across it lies atom `atom` of this piece, placed by T
//             { r: 'mirror', T }            a mirror of the orbifold
//   ends    [{ t, frame, len, axis: [{ atom, T, s0, s1 }] } | { t: 'cone' | 'corner', n, pt }]
//             frame: at the end's reference foot, heading along the cut with the piece on the left
//             axis:  the copies of the piece's atoms that lie along the cut, over one period
//   marks   [{ atom, pt, dir, kind: 'cone' | 'corner', n, end }]
//   seams   [[a, b], ...]                 the seams, to draw

import { H, E, mul, apply, I3, tx, posOf, invOf, coordsIn, matDiff, frameToward, frameAt, reflectH, leftOf, qMat, qSlide, qTurn, perp, meet, isPt, mcross, mdot } from './h2.js';

const TAU = 2 * Math.PI;

/**
 * A point well inside a convex polygon THAT MOVES SMOOTHLY WITH IT: { at, clear } (clear: how far it is from the
 * nearest side). The middle of the largest circle that fits would not do: in a long piece that circle can sit
 * anywhere along the piece, and a search for it lands now here, now there, as a slider moves, and the comma printed
 * at it jumped. This is the polygon's analytic centre in the chart it is given in (centred on the polygon, where
 * its sides are straight lines: the plane itself, or the hyperbolic plane seen from its middle in Klein's model):
 * the one point where the product of the distances to all the sides' lines is largest. There is exactly one, and
 * Newton's method finds it to the last digit, so it depends on the corners as smoothly as they move.
 */
export function incentre(kind, verts) {
  const G = kind === 'H' ? H : E, n = verts.length;
  // side i as the function g_i(x, y) = N_i . (x, y, 1): zero on its line, positive inside (the polygon runs counter-clockwise)
  const N = verts.map((v, i) => { const w = verts[(i + 1) % n]; return [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]]; }).filter((m) => Math.hypot(m[0], m[1], m[2]) > 1e-14);
  const heart = verts.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
  let x = heart[0] / heart[2], y = heart[1] / heart[2];
  const value = (px, py) => { let f = 0; for (const m of N) { const g = m[0] * px + m[1] * py + m[2]; if (!(g > 0)) return -Infinity; f += Math.log(g); } return f; };
  let f = value(x, y);
  for (let it = 0; it < 60 && Number.isFinite(f); it++) {
    let gx = 0, gy = 0, hxx = 0, hxy = 0, hyy = 0;
    for (const m of N) { const g = m[0] * x + m[1] * y + m[2]; gx += m[0] / g; gy += m[1] / g; hxx += (m[0] * m[0]) / (g * g); hxy += (m[0] * m[1]) / (g * g); hyy += (m[1] * m[1]) / (g * g); }
    const det = hxx * hyy - hxy * hxy;
    if (!(det > 1e-300)) break;
    let dx = (hyy * gx - hxy * gy) / det, dy = (hxx * gy - hxy * gx) / det, t = 1, moved = false;
    for (let back = 0; back < 60; back++) { const f2 = value(x + t * dx, y + t * dy); if (f2 >= f) { x += t * dx; y += t * dy; f = f2; moved = true; break; } t *= 0.5; }
    if (!moved || Math.hypot(t * dx, t * dy) < 1e-15) break;
  }
  const p = G.norm([x, y, 1]);
  return { at: p, clear: Math.min(...verts.map((v, i) => G.lineDist(p, v, verts[(i + 1) % n]))) };
}

/**
 * The generalized right-angled hexagon with ends[k] = { a } (a side of length a) or { th } (a vertex of angle th).
 * Seam k runs from end k to end k + 1. Returns { ends, seams, verts, roles }.
 *
 * Its three seams are three lines whose pairwise positions are given: seams k - 1 and k are a apart (their common
 * perpendicular is end k) or cross at the angle th (end k is that point). Written as unit vectors n with
 * <n_i, n_j> = -cosh a or -cos th, they can be put down by formula: the two seams of end 0 symmetric about the
 * origin, the third from two linear equations and its length. Every end is then perp() of two seams and every
 * corner meet() of an end and a seam: no corner is reached by walking round from another, so a hexagon seven units
 * long is as exact as a short one. (It was walked round like a turtle at first; on such a hexagon the walk came
 * back 1e-7 away from where it set out, and the pieces built from it did not fit their neighbours.)
 */
export function hexagon(ends) {
  const side = ends.map((e) => e.a !== undefined);
  const g = ends.map((e) => (e.a !== undefined ? -Math.cosh(e.a) : -Math.cos(e.th)));       // g[k]: seams k - 1 and k
  const bad = () => new Error('hexagon: these ends make no hyperbolic piece');
  let nA, nB, nC;                         // seams 2, 0, 1
  if (side[0]) {
    const C = Math.cosh(ends[0].a / 2), S = Math.sinh(ends[0].a / 2), z = -(g[1] + g[2]) / (2 * S), x = (g[1] - g[2]) / (2 * C), y2 = 1 - x * x + z * z;
    if (!(y2 > 1e-14)) throw bad();
    nA = [-C, 0, S]; nB = [C, 0, S]; nC = [x, Math.sqrt(y2), z];
  } else {
    const c = Math.cos(ends[0].th / 2), sn = Math.sin(ends[0].th / 2), y = -(g[1] + g[2]) / (2 * sn), x = (g[1] - g[2]) / (2 * c), z2 = x * x + y * y - 1;
    if (!(z2 > 1e-14)) throw bad();
    nA = [-c, -sn, 0]; nB = [c, -sn, 0]; nC = [x, y, Math.sqrt(z2)];
  }
  let lines = [nB, nC, nA];               // seam k
  const build = () => {
    const out = { ends: [], seams: [], verts: [], roles: [], closure: 0 };
    const es = [0, 1, 2].map((k) => perp(lines[(k + 2) % 3], lines[k]));
    for (let k = 0; k < 3; k++) if (isPt(es[k]) === side[k]) throw bad();
    for (let k = 0; k < 3; k++) {
      if (side[k]) {
        const vin = meet(es[k], lines[(k + 2) % 3]), vout = meet(es[k], lines[k]);
        let t = mcross(es[k], vin);
        if (mdot(t, vout) < 0) t = [-t[0], -t[1], -t[2]];
        out.ends.push({ side: true, frame: frameAt(vin, t), vin, vout, a: ends[k].a, line: es[k] });
        out.verts.push(vin, vout); out.roles.push({ r: 'end', k }, { r: 'seam', k });
      } else { out.ends.push({ side: false, pt: es[k], th: ends[k].th }); out.verts.push(es[k]); out.roles.push({ r: 'seam', k }); }
    }
    for (let k = 0; k < 3; k++) {
      const e0 = out.ends[k], e1 = out.ends[(k + 1) % 3], a = e0.side ? e0.vout : e0.pt, b = e1.side ? e1.vin : e1.pt;
      out.seams.push({ a, b, len: H.dist(a, b), line: lines[k] });
    }
    return out;
  };
  let out = build();
  // counter-clockwise, and its middle at the origin: the mean of its corners, a smooth function of the lengths (a
  // piece built again from lengths that differ in the last digit must get the same chart to the last digit)
  if (H.area(out.verts) < 0) { lines = lines.map((n) => [n[0], -n[1], n[2]]); out = build(); }
  const heart = H.norm(out.verts.reduce((t, v) => [t[0] + v[0], t[1] + v[1], t[2] + v[2]], [0, 0, 0])), d = H.dist(heart, H.origin);
  if (d > 1e-9) {
    const Fc = frameToward('H', heart, H.origin), Cm = mul(mul(Fc, tx('H', d)), invOf('H')(Fc));
    lines = lines.map((n) => apply(Cm, n));
    out = build();
  }
  return out;
}

/** Is this a cap: a piece with no area, folded onto its one cut? */
export function degenerate(spec) {
  const two = (e) => (e.t === 'cone' || e.t === 'corner') && e.n === 2;
  if (spec.kind === 'P' || spec.kind === 'M') return spec.ends.filter(two).length === 2;
  if (spec.kind === 'S') return two(spec.ends[0]) && spec.ends[1].t === 'arc';
  return false;
}

/** The mirror in the hyperbolic line through two points: from the line's normal, which loses no digits far from the origin. */
const mirrorIn = (a, b) => reflectH(perp(a, b));
const reflected = (rho, atom) => {
  const m = atom.verts.length, verts = [], roles = [];
  for (let i = 0; i < m; i++) { verts.push(apply(rho, atom.verts[m - 1 - i])); roles.push({ ...atom.roles[(((m - 2 - i) % m) + m) % m] }); }
  return { verts, roles, twin: !atom.twin };
};

/** Give every seam edge its neighbour, and every end its axis, by looking: no formula is trusted. */
function wire(kind, piece, cands) {
  const G = kind === 'H' ? H : E, inv = invOf(kind), tol = 1e-6;
  const near = (p, q) => G.dist(p, q) < tol;
  piece.atoms.forEach((A, ia) => {
    const m = A.verts.length;
    A.roles.forEach((role, i) => {
      const a = A.verts[i], b = A.verts[(i + 1) % m];
      if (role.r === 'mirror') { role.T = kind === 'H' ? mirrorIn(a, b) : G.reflect(a, b); return; }
      if (role.r !== 'seam') return;
      let found = null;
      for (const T of cands) {
        piece.atoms.forEach((B, ib) => {
          if (found) return;
          const n = B.verts.length;
          for (let j = 0; j < n && !found; j++) {
            if (B.roles[j].r !== 'seam') continue;
            if (ia === ib && j === i && matDiff(T, I3) < 1e-9) continue;
            if (near(apply(T, B.verts[j]), b) && near(apply(T, B.verts[(j + 1) % n]), a)) found = { atom: ib, T, edge: j };
          }
        });
        if (found) break;
      }
      if (!found) throw new Error('wire: a seam has no neighbour');
      role.nbr = found;
    });
  });
  piece.ends.forEach((end, k) => {
    if (!end.frame) return;
    end.axis = [];
    // an arc is no loop: only the atoms as the chart has them lie along it
    for (const T of end.t === 'arc' ? [I3.slice()] : cands) {
      piece.atoms.forEach((A, ia) => {
        const m = A.verts.length;
        A.roles.forEach((role, i) => {
          if (role.r !== 'end' || role.k !== k) return;
          const p = coordsIn(kind, end.frame, apply(T, A.verts[i])), q = coordsIn(kind, end.frame, apply(T, A.verts[(i + 1) % m]));
          if (Math.abs(p[1]) > tol || Math.abs(q[1]) > tol) return;
          const s0 = Math.min(p[0], q[0]), s1 = Math.max(p[0], q[0]);
          if (end.axis.some((x) => x.atom === ia && Math.abs(x.s0 - s0) < 1e-5)) return;
          end.axis.push({ atom: ia, T, s0, s1, edge: i, sa: p[0], sb: q[0] });
          if (matDiff(T, I3) < 1e-9) { role.s0 = s0; role.s1 = s1; }
        });
      });
    }
    // keep one period (a cuff), the whole of it (an arc); the atoms as the chart has them come first
    const own = (x) => (matDiff(x.T, I3) < 1e-9 ? 0 : 1);
    end.axis.sort((x, y) => own(x) - own(y) || Math.abs(x.s0) - Math.abs(y.s0) || x.s0 - y.s0);
    if (end.t === 'cuff') {
      const keep = [];
      for (const x of end.axis) {
        const again = keep.some((y) => { if (y.atom !== x.atom) return false; const q = (x.s0 - y.s0) / end.len; return Math.abs(q - Math.round(q)) < 1e-5; });
        if (!again) keep.push(x);
      }
      end.axis = keep;
    }
    end.axis.sort((x, y) => x.s0 - y.s0);
    const total = end.axis.reduce((t, x) => t + (x.s1 - x.s0), 0);
    if (Math.abs(total - end.len) > 1e-5 * (1 + end.len)) throw new Error(`wire: the atoms along end ${k} cover ${total}, not ${end.len}`);
  });
  // every atom's own end edges: where they lie along the end's axis once the atom is placed as the axis says
  piece.atoms.forEach((A, ia) => A.roles.forEach((role, i) => {
    if (role.r !== 'end') return;
    const x = piece.ends[role.k].axis.find((y) => y.atom === ia && y.edge === i);
    if (!x) throw new Error('wire: an end edge is on no axis');
    role.T = x.T; role.s0 = x.s0; role.s1 = x.s1; role.sa = x.sa; role.sb = x.sb;
  }));
  void inv;
  return piece;
}

/**
 * The motions of a piece's own group that its atoms are carried by: the identity, and for each end the slide along
 * a cuff by its length or the turn about a cone point by its angle, both ways. (Each is the product of the mirrors
 * in two seams; taken that way, as a product of two matrices with entries of the size e^(2 distance), it lost eight
 * digits on a piece seven units long. As a pair (h2.js) it loses none.)
 */
function motionsOf(ends) {
  const out = [I3.slice()];
  for (const e of ends) {
    if (e.side && e.len != null) for (const sgn of [1, -1]) out.push(qMat(qSlide(leftOf(e.frame), sgn * e.len)));
    if (!e.side && e.n) for (const sgn of [1, -1]) out.push(qMat(qTurn(e.pt, (sgn * TAU) / e.n)));
  }
  return out;
}

/** A piece in its own chart. spec: { kind, ends: [...] } with ends as the head of this file says. */
export function buildPiece(spec) {
  try { return buildPiece0(spec); } catch (err) { err.message += ' ' + JSON.stringify(spec); throw err; }
}
function buildPiece0(spec) {
  if (spec.kind === 'A' || spec.kind === 'R') return flatPiece(spec);
  if (degenerate(spec)) return { kind: spec.kind, degenerate: true, atoms: [], ends: spec.ends.map((e) => ({ ...e })), marks: [], seams: [] };
  const G = H;
  if (spec.kind === 'P' || spec.kind === 'M') {
    const isM = spec.kind === 'M';
    const hx = hexagon(spec.ends.map((e) => (e.t === 'cuff' ? { a: e.len / 2 } : e.t === 'arc' ? { a: e.len } : { th: Math.PI / e.n })));
    const F = { verts: hx.verts, roles: hx.roles.map((r) => (r.r === 'seam' ? { r: isM ? 'mirror' : 'seam' } : { r: 'end', k: r.k })), twin: false };
    const rho = hx.seams.map((sm) => reflectH(sm.line));
    const piece = {
      kind: spec.kind, degenerate: false,
      atoms: isM ? [F] : [F, reflected(rho[0], F)],
      ends: spec.ends.map((e, k) => (hx.ends[k].side ? { t: e.t, len: e.len, frame: hx.ends[k].frame } : { t: e.t, n: e.n, pt: hx.ends[k].pt })),
      marks: [], seams: isM ? [] : hx.seams.map((sm) => [sm.a, sm.b]), rho, hx,
    };
    spec.ends.forEach((e, k) => { if (!hx.ends[k].side) piece.marks.push({ atom: 0, pt: hx.ends[k].pt, dir: hx.seams[k].b, kind: e.t, n: e.n, end: k }); });
    return wire('H', piece, isM ? [I3.slice()] : motionsOf(spec.ends.map((e, k) => (hx.ends[k].side ? { side: true, frame: hx.ends[k].frame, len: e.len } : { side: false, pt: hx.ends[k].pt, n: e.n }))));
  }
  if (spec.kind === 'S') {
    const [main, other] = spec.ends;
    const x = main.t === 'cuff' ? { a: main.len / 2 } : { th: Math.PI / main.n };
    const f = other.t === 'arc' ? { a: other.len } : { th: Math.PI / other.n };
    const hx = hexagon([x, x, f]);
    const mid2 = (a, b) => H.norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
    const mid = mid2(hx.seams[0].a, hx.seams[0].b), e2 = hx.ends[2], N = e2.side ? mid2(e2.vin, e2.vout) : e2.pt;
    const verts = [], roles = [];
    if (hx.ends[0].side) { verts.push(hx.ends[0].vin, hx.ends[0].vout); roles.push({ r: 'end', k: 0 }, { r: 'seam' }); } else { verts.push(hx.ends[0].pt); roles.push({ r: 'seam' }); }
    verts.push(mid); roles.push({ r: 'mirror' });
    verts.push(N);
    if (e2.side) { roles.push({ r: 'end', k: 1 }); verts.push(e2.vout); }
    roles.push({ r: 'seam' });
    const Hh = { verts, roles, twin: false };
    const rho0 = reflectH(hx.seams[0].line), rho2 = reflectH(hx.seams[2].line);
    const piece = {
      kind: 'S', degenerate: false, atoms: [Hh, reflected(rho2, Hh)],
      ends: [
        hx.ends[0].side ? { t: 'cuff', len: main.len, frame: hx.ends[0].frame } : { t: 'cone', n: main.n, pt: hx.ends[0].pt },
        e2.side ? { t: 'arc', len: other.len, frame: frameToward('H', N, e2.vout) } : { t: 'corner', n: other.n, pt: e2.pt },
      ],
      marks: [], seams: [[hx.seams[2].a, hx.seams[2].b], [hx.seams[0].a, mid]], rho: [rho0, rho2], hx, mid, N,
    };
    if (!hx.ends[0].side) piece.marks.push({ atom: 0, pt: hx.ends[0].pt, dir: mid, kind: 'cone', n: main.n, end: 0 });
    if (!e2.side) piece.marks.push({ atom: 0, pt: e2.pt, dir: mid, kind: 'corner', n: other.n, end: 1 });
    return wire('H', piece, motionsOf([hx.ends[0].side ? { side: true, frame: hx.ends[0].frame, len: main.len } : { side: false, pt: hx.ends[0].pt, n: main.n }]));
  }
  throw new Error('buildPiece: no such kind ' + spec.kind);
}

/** The Euclidean pieces: an annulus (kind 'A') or a strip between two mirrors (kind 'R'); spec: { kind, len, h, halves }. */
function flatPiece(spec) {
  const { len, h } = spec, P = (x, y) => [x, y, 1];
  const top = (x0) => [-1, 0, x0, 0, -1, h, 0, 0, 1];
  if (spec.kind === 'R') {
    const A = { verts: [P(0, 0), P(len, 0), P(len, h), P(0, h)], roles: [{ r: 'end', k: 0 }, { r: 'mirror' }, { r: 'end', k: 1 }, { r: 'mirror' }], twin: false };
    const piece = { kind: 'R', degenerate: false, atoms: [A], ends: [{ t: 'arc', len, frame: I3.slice() }, { t: 'arc', len, frame: top(len) }], marks: [], seams: [] };
    return wire('E', piece, [I3.slice()]);
  }
  const n = spec.halves === 1 ? 1 : 2, w = len / n, atoms = [];
  for (let i = 0; i < n; i++) atoms.push({ verts: [P(i * w, 0), P((i + 1) * w, 0), P((i + 1) * w, h), P(i * w, h)], roles: [{ r: 'end', k: 0 }, { r: 'seam' }, { r: 'end', k: 1 }, { r: 'seam' }], twin: i === 1 });
  const piece = { kind: 'A', degenerate: false, atoms, ends: [{ t: 'cuff', len, frame: I3.slice() }, { t: 'cuff', len, frame: top(0) }], marks: [], seams: [] };
  return wire('E', piece, [I3.slice(), tx('E', len), tx('E', -len)]);
}

export { TAU };
