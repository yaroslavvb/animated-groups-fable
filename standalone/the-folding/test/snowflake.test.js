// Tests of src/folds/snowflake.js (SPEC 5.3 and 5.7): the four kaleidoscopes *2222, *442, *333, *632.
// For these groups nothing is glued, so requirement 2 of SPEC 5.3 ("seams close") is replaced by:
// at t = 1 every cell of the star lies exactly on the base tile, one sheet per layer.
// Every preset, 24 seeded-random seeds per group, wavy amplitude 0 and 1.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, contains, elementsNear } from '../src/groups.js';
import { compose, inverse, apply, reflThrough, polyArea, clipHalfPlane, det } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { foldPlan, ease, creaseScore, LAYER_SPACING } from '../src/folds/snowflake.js';

const IDS = ['*2222', '*442', '*333', '*632'];
const ORDER = { '*2222': 2, '*442': 4, '*333': 3, '*632': 6 };
const FOLDS = { '*2222': 2, '*442': 3, '*333': 3, '*632': 4 };
const RANDOM_SEEDS = 24;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every case of one group: each preset at full density, then random seeds (coarser mesh: the maps are the same). */
function cases(id, { random = RANDOM_SEEDS, amps = [0, 1] } = {}) {
  const group = BY_ID[id], out = [];
  const rnd = mulberry32(0x5eed + id.length * 977 + id.charCodeAt(1) * 31 + id.charCodeAt(id.length - 1));
  for (const amp of amps) {
    group.presets.forEach((p, i) => out.push({ id, group, amp, seed: p.seed, metric: p.metric, name: `${id} preset ${i} amp ${amp}`, opts: {} }));
    for (let k = 0; k < random; k++) {
      const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
      out.push({ id, group, amp, seed, name: `${id} seed ${k} (${seed.map((v) => v.toFixed(4))}) amp ${amp}`, opts: { density: 4 }, random: true });
    }
  }
  return out;
}

const BUILT = new Map();
function build(c, extra = {}) {
  const key = c.name + '|' + JSON.stringify(extra);
  let s = BUILT.get(key);
  if (!s) {
    const warp = makeWarp(c.group, c.amp);
    const domain = buildDomain(c.group, { seed: c.seed, metric: c.metric, warp });
    // the argument `mesh` (the mesh of the single tile) is not used by this fold: only the presets build it
    const fold = createFold(c.group, domain, c.random ? undefined : buildMesh(c.group, domain), { ...c.opts, ...extra });
    s = { ...c, domain, fold, M: fold.mesh, size: Math.sqrt(c.group.domainArea) };
    BUILT.set(key, s);
  }
  return s;
}

const ALL = [];
for (const id of IDS) for (const c of cases(id)) ALL.push(c);
const eachCase = (fn, list = ALL) => { for (const c of list) fn(build(c)); };

/** Every point that gets drawn, as (x, y, piece): the mesh vertices, the boundary samples (they ride on the lid) and
 *  the two ends of every crease, once with the still cell (a) and once with the crease piece (b). */
function drawn(s) {
  if (!s.pts) {
    const M = s.M, x = [], y = [], c = [];
    for (let v = 0; v < M.n; v++) { x.push(M.xy[2 * v]); y.push(M.xy[2 * v + 1]); c.push(M.cell[v]); }
    for (const b of M.boundary) for (let k = 0; k < b.cells.length; k++) { x.push(b.pts[2 * k]); y.push(b.pts[2 * k + 1]); c.push(b.cells[k]); }
    for (const cr of M.creases) for (const piece of [cr.a, cr.b]) for (const e of [0, 2]) { x.push(cr.pts[e]); y.push(cr.pts[e + 1]); c.push(piece); }
    s.pts = { n: x.length, x: Float64Array.from(x), y: Float64Array.from(y), c: Uint16Array.from(c) };
  }
  return s.pts;
}

/** Positions of all drawn points at time t (the first M.n of them are the mesh vertices). */
function positions(s, t, into, poison = false) {
  const D = drawn(s), F = s.fold.at(t), out = [0, 0, 0], P = into || new Float64Array(3 * D.n);
  const x = D.x, y = D.y, c = D.c, n = D.n;
  for (let v = 0, k = 0; v < n; v++, k += 3) {
    if (poison) out[0] = out[1] = out[2] = NaN;      // a component the fold forgets to write stays NaN
    F(x[v], y[v], c[v], out);
    P[k] = out[0]; P[k + 1] = out[1]; P[k + 2] = out[2];
  }
  return P;
}

/** Signed distance by which (x, y) lies outside the convex polygon (either orientation); <= 0 inside. */
function outside(poly, x, y) {
  const sgn = polyArea(poly) > 0 ? 1 : -1;
  let worst = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
    worst = Math.max(worst, -sgn * (dx * (y - a[1]) - dy * (x - a[0])) / Math.hypot(dx, dy));
  }
  return worst;
}

/** Fold the plane point into the mirror polygon by reflecting it across violated sides (independent of the module). */
function reflectInto(poly, x, y) {
  const sgn = polyArea(poly) > 0 ? 1 : -1;
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      const d = -sgn * (dx * (y - a[1]) - dy * (x - a[0])) / l;          // > 0: outside this side
      if (d > 1e-13) {
        const nx = (sgn * dy) / l, ny = (-sgn * dx) / l;                  // outward unit normal
        x -= 2 * d * nx; y -= 2 * d * ny; moved = true;
      }
    }
    if (!moved) return [x, y];
  }
  throw new Error('reflectInto does not terminate');
}

const samePoints = (A, B, eps) => A.length === B.length && A.every((p) => B.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps));

// ---------------------------------------------------------------------------------------------------------------

test('the folding sequence: halving creases, uniform stacks, every spoke creased once', () => {
  for (const n of [2, 3, 4, 6]) {
    const S = 2 * n, plan = foldPlan(n);
    assert.equal(plan.folds.length, { 2: 2, 3: 3, 4: 3, 6: 4 }[n], 'folds for order ' + n);
    assert.deepEqual(plan.layer.slice().sort((a, b) => a - b), Array.from({ length: S }, (_, k) => k), 'final sheets are 0..2n-1');
    assert.equal(plan.layer[0], 0, 'the base tile is the bottom sheet');
    assert.equal(plan.folds[0].c, n, 'the first fold halves the disc');
    let m = S;
    const creasedAt = new Array(S).fill(-1);
    plan.folds.forEach((f, fi) => {
      assert.equal(f.m, m); assert.equal(f.c, Math.ceil(m / 2), 'crease after the first ceil(m/2) sectors');
      assert.ok(!f.moving.includes(0), 'the base tile never moves');
      // stacks: the flap's sectors all hold the same number of sheets, and so do the sectors it lands on
      const count = new Array(S).fill(0);
      for (let k = 0; k < S; k++) count[f.from[k]]++;
      const flap = new Set(), land = new Set();
      for (let j = f.c; j < m; j++) { flap.add(count[j]); land.add(count[2 * f.c - 1 - j]); }
      assert.equal(flap.size, 1); assert.equal(land.size, 1);
      const H = [...flap][0], Hs = [...land][0];
      assert.equal(f.sheets, H + Hs); assert.equal(f.axisLayer, (H + Hs - 1) / 2);
      assert.ok(H >= Hs, 'the flap is at least as thick as what it lands on (it turns about a line in or on top of itself)');
      // spokes: cells j-1 and j are joined along spoke j; it is creased by the one fold that moves exactly one of them
      for (let j = 0; j < S; j++) {
        const k0 = (j + S - 1) % S, k1 = j;
        if (f.moving.includes(k0) === f.moving.includes(k1)) continue;
        assert.equal(creasedAt[j], -1, 'spoke ' + j + ' is creased once');
        creasedAt[j] = fi;
        assert.equal(f.layerBefore[k0], f.layerBefore[k1], 'the two sides of a crease are the same sheet');
        const lo = Math.min(f.from[k0], f.from[k1]), hi = Math.max(f.from[k0], f.from[k1]);
        assert.ok((lo === f.c - 1 && hi === f.c) || (m === S && lo === 0 && hi === S - 1), 'and lie over the two sectors at the crease');
        assert.ok(f.axisLayer - f.layerBefore[k0] >= 0.5, 'the spine has a positive radius');
      }
      m = f.c;
    });
    assert.equal(m, 1);
    assert.ok(creasedAt.every((f) => f >= 0), 'every spoke is creased');
  }
});

test('ease: 0 -> 1, monotone, continuous speed, at rest at both ends', () => {
  assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.equal(ease(-1), 0); assert.equal(ease(2), 1);
  assert.ok(creaseScore(-1) > creaseScore(1) && creaseScore(1) > creaseScore(0) && creaseScore(-0.4) > creaseScore(1) && creaseScore(0) === 0);
  let prev = 0, vprev = 0;
  const N = 2000;
  for (let i = 1; i <= N; i++) {
    const e = ease(i / N), v = (e - prev) * N;
    assert.ok(v >= 0 && v < 1.6, 'speed stays between 0 and 1.6');
    assert.ok(Math.abs(v - vprev) < 0.02, 'no jump in speed');
    prev = e; vprev = v;
  }
  assert.ok(vprev < 0.01);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-12);
});

test('the star: 2n cells of the kaleidoscope around one corner, base tile = the tile of the domain', () => {
  eachCase((s) => {
    const { group, domain, fold, M, size, name } = s, n = ORDER[s.id], S = 2 * n, T = group.kaleido.cell;
    assert.equal(fold.order, n, name);
    assert.equal(M.cells.length, S, name);
    assert.equal(M.root, 0);
    // the base tile is the tile the domain gives, and holds the seed
    assert.ok(samePoints(M.cells[0].poly, domain.poly, 1e-9), name + ': base tile = domain.poly');
    assert.ok(outside(M.cells[0].poly, domain.seed[0], domain.seed[1]) < 0, name + ': the seed is in the base tile');
    assert.ok(outside(M.cells[0].poly, domain.seedActual[0], domain.seedActual[1]) < 0, name + ': so is the warped seed');
    // cells: distinct elements of the group applied to T, all sharing the pivot, which is a corner of order n
    const P = fold.pivot, keys = new Set();
    M.cells.forEach((c, i) => {
      assert.equal(c.index, i);
      assert.ok(contains(group, c.g), name + ': cell isometry in the group');
      assert.equal(c.parity, det(c.g) > 0 ? 0 : 1);
      c.poly.forEach((p, j) => { const q = apply(c.g, T[j][0], T[j][1]); assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-12, name + ': poly = g(T)'); });
      assert.ok(c.poly.some((p) => Math.hypot(p[0] - P[0], p[1] - P[1]) < 1e-9), name + ': every cell has the pivot as a corner');
      keys.add([c.g.a, c.g.b, c.g.c, c.g.d, c.g.tx, c.g.ty].map((v) => Math.round(v * 1e6)).join(','));
      if (i > 0) {
        assert.ok(c.parent >= 0 && c.parent < i, name + ': parent comes first');
        assert.equal(c.depth, M.cells[c.parent].depth + 1);
        // hinge: a mirror of the group shared with the parent; the piece lies to the left of a -> b
        const h = c.hinge, R = reflThrough([h.ax, h.ay], [h.bx, h.by]);
        assert.ok(contains(group, R), name + ': hinge is a mirror');
        assert.ok(samePoints(c.poly.map((p) => apply(R, p[0], p[1])), M.cells[c.parent].poly, 1e-9), name + ': the hinge mirror swaps child and parent');
        const cx = c.poly.reduce((a, p) => a + p[0], 0) / c.poly.length, cy = c.poly.reduce((a, p) => a + p[1], 0) / c.poly.length;
        assert.ok((h.bx - h.ax) * (cy - h.ay) - (h.by - h.ay) * (cx - h.ax) > 0, name + ': piece on the left of its hinge');
      } else { assert.equal(c.parent, -1); assert.equal(c.depth, 0); assert.equal(c.hinge, null); }
    });
    assert.equal(keys.size, S, name + ': distinct cells');
    // the pivot is a corner of order n of the base tile: the cells' angles there add up to a full turn
    const els = elementsNear(group, P[0], P[1], 1e-7, P[0], P[1]);       // the stabiliser of the pivot
    assert.equal(els.length, S, name + ': the pivot has a stabiliser of order 2n');
    // star export
    assert.equal(fold.star.length, S);
    fold.star.forEach((poly, i) => {
      assert.ok(samePoints(poly, M.cells[i].poly, 1e-12), name + ': star[i] = cell i');
      assert.ok(Math.abs(polyArea(poly) - group.domainArea) < 1e-9, name + ': star polygons are counter-clockwise with the tile area');
    });
    // a small disc around the pivot is covered exactly once
    const rnd = mulberry32(7);
    for (let k = 0; k < 60; k++) {
      const a = 2 * Math.PI * rnd(), r = 0.3 * size * Math.sqrt(rnd()), x = P[0] + r * Math.cos(a), y = P[1] + r * Math.sin(a);
      const inside = M.cells.filter((c) => outside(c.poly, x, y) < -1e-9).length, near = M.cells.filter((c) => outside(c.poly, x, y) < 1e-9).length;
      assert.ok(inside <= 1 && near >= 1, name + ': the cells tile a neighbourhood of the pivot');
    }
  });
});

test('the mesh of the star: tint, triangles, locate, boundary, creases', () => {
  eachCase((s) => {
    const { group, domain, fold, M, size, name } = s, S = M.cells.length;
    assert.equal(M.xy.length, 2 * M.n); assert.equal(M.cell.length, M.n); assert.equal(M.tint.length, M.n);
    assert.equal(M.tri.length, 3 * M.m); assert.equal(M.triCell.length, M.m);
    assert.ok(M.xy instanceof Float32Array && M.tri instanceof Uint32Array && M.tint instanceof Uint8Array && M.cell instanceof Uint16Array);
    for (let i = 0; i < M.tri.length; i++) assert.ok(M.tri[i] < M.n);
    // tint: 0 exactly on the base tile's own vertices
    let base = 0;
    for (let v = 0; v < M.n; v++) {
      assert.ok(M.cell[v] < fold.pieces, name);
      if (M.cell[v] === 0 && M.tint[v] === 0) {
        base++;
        assert.ok(outside(M.cells[0].poly, M.xy[2 * v], M.xy[2 * v + 1]) < 1e-6 * size, name + ': tint 0 only on the base tile');
      } else assert.equal(M.tint[v], 1, name + ': tint 1 off the base tile');
    }
    assert.ok(base >= 3, name);
    // cell triangles: counter-clockwise, every cell has the tile's area; strip triangles have no area while flat
    const area = new Float64Array(S);
    for (let t = 0; t < M.m; t++) {
      const a = M.tri[3 * t], b = M.tri[3 * t + 1], c = M.tri[3 * t + 2];
      const ar = ((M.xy[2 * b] - M.xy[2 * a]) * (M.xy[2 * c + 1] - M.xy[2 * a + 1]) - (M.xy[2 * b + 1] - M.xy[2 * a + 1]) * (M.xy[2 * c] - M.xy[2 * a])) / 2;
      if (t < M.cellTriangles) {
        assert.ok(ar > 0, name + ': triangle is counter-clockwise');
        assert.equal(M.cell[a], M.triCell[t]); assert.equal(M.cell[b], M.triCell[t]); assert.equal(M.cell[c], M.triCell[t]);
        area[M.triCell[t]] += ar;
        // locate: the cell of the point; a point of the base tile gets the lid (the top sheet over the tile)
        assert.equal(M.locate((M.xy[2 * a] + M.xy[2 * b] + M.xy[2 * c]) / 3, (M.xy[2 * a + 1] + M.xy[2 * b + 1] + M.xy[2 * c + 1]) / 3),
          M.triCell[t] === 0 ? M.lid : M.triCell[t], name + ': locate(centroid)');
      } else assert.ok(Math.abs(ar) < 1e-9 * group.domainArea, name + ': a spine has no width in the plane');
    }
    for (let p = 0; p < S; p++) assert.ok(Math.abs(area[p] - group.domainArea) < 1e-6 * group.domainArea, name + ': cell area');
    assert.ok(M.lid >= S && M.lid < fold.pieces && M.pieces === fold.pieces && fold.lid === M.lid);
    assert.equal(M.locate(domain.seed[0], domain.seed[1]), M.lid);
    assert.equal(M.locate(domain.seedActual[0], domain.seedActual[1]), M.lid);
    for (const c of domain.conePoints) assert.equal(M.locate(c.x, c.y), M.lid, name + ': the corners of the tile belong to the base tile');
    assert.ok(M.bbox[0] < M.bbox[2] && M.bbox[1] < M.bbox[3]);
    // boundary = the base tile's edges, all mirrors, side i on its own outline piece (riding on top of the stack, see
    // the outline test) — also with the wavy slider up (mirrors stay straight)
    assert.equal(M.boundary.length, domain.poly.length, name);
    assert.ok(Array.isArray(M.outline) && M.outline.length === M.boundary.length && fold.outline === M.outline, name + ': one outline piece per side');
    assert.equal(new Set(M.outline).size, M.outline.length, name + ': distinct outline pieces');
    for (const q of M.outline) assert.ok(q >= S && q < fold.pieces && q !== M.lid && !M.creases.some((c) => c.b === q), name + ': an outline piece is its own piece');
    M.boundary.forEach((b, i) => {
      assert.equal(b.edge, i); assert.equal(b.kind, 'mirror'); assert.equal(b.cls, -1);
      assert.equal(domain.edges[b.edge].kind, 'mirror', name + ': every edge of the tile is a mirror');
      assert.equal(b.cells.length, b.pts.length / 2);
      const p0 = domain.poly[i], p1 = domain.poly[(i + 1) % domain.poly.length], dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy);
      for (let k = 0; k < b.cells.length; k++) {
        assert.equal(b.cells[k], M.outline[i]);
        const x = b.pts[2 * k], y = b.pts[2 * k + 1], along = ((x - p0[0]) * dx + (y - p0[1]) * dy) / l;
        assert.ok(Math.abs((x - p0[0]) * dy - (y - p0[1]) * dx) / l < 1e-6 * size, name + ': boundary point on its mirror');
        assert.ok(along > -1e-6 * size && along < l + 1e-6 * size, name + ': boundary point on its edge');
        assert.equal(M.locate(x, y), M.lid, name + ': boundary points belong to the base tile');
      }
    });
    // creases = the 2n mirrors through the pivot, each between the two cells it names
    assert.equal(M.creases.length, S, name);
    const dirs = new Set();
    const creasePieces = new Set();
    for (const c of M.creases) {
      // a: the cell that stays when this crease is folded; b: the crease piece; cells: the two cells it separates
      assert.ok(c.a < S && c.b >= S && c.b < fold.pieces && c.b !== M.lid && c.cells.includes(c.a) && c.cells[0] !== c.cells[1] && c.cells[0] < S && c.cells[1] < S);
      creasePieces.add(c.b);
      assert.ok(c.fold >= 0 && c.fold < fold.folds.length && !fold.folds[c.fold].cells.includes(c.a), name + ': side a stays in the fold that makes the crease');
      assert.ok(fold.folds[c.fold].cells.includes(c.cells[0] === c.a ? c.cells[1] : c.cells[0]), name + ': the other side is in the flap');
      assert.ok(Math.hypot(c.pts[0] - fold.pivot[0], c.pts[1] - fold.pivot[1]) < 1e-6, name + ': creases start at the pivot');
      const R = reflThrough([c.pts[0], c.pts[1]], [c.pts[2], c.pts[3]]);
      assert.ok(contains(group, R, 1e-5), name + ': a crease is a mirror of the group');
      assert.ok(samePoints(M.cells[c.cells[0]].poly.map((p) => apply(R, p[0], p[1])), M.cells[c.cells[1]].poly, 1e-6), name + ': it separates its two cells');
      assert.ok(M.cells[c.a].poly.some((p) => Math.hypot(p[0] - c.pts[2], p[1] - c.pts[3]) < 1e-6), name + ': it ends at a corner of the cells');
      dirs.add(Math.round((Math.atan2(c.pts[3] - c.pts[1], c.pts[2] - c.pts[0]) * 180) / Math.PI));
    }
    assert.equal(dirs.size, S, name + ': 2n different spokes');
    assert.equal(creasePieces.size, S, name + ': every crease has its own piece');
  });
});

test('SPEC 5.3 (1): at(0) is the identity, exactly', () => {
  eachCase((s) => {
    const { M, fold, name } = s, F = fold.at(0), out = [9, 9, 9];
    for (let v = 0; v < M.n; v++) {
      const x = M.xy[2 * v], y = M.xy[2 * v + 1];
      F(x, y, M.cell[v], out);
      assert.ok(Object.is(out[0], x) && Object.is(out[1], y) && out[2] === 0, name + ': vertex ' + v);
    }
    // every piece at(t) knows (cells, rows of spines, crease pieces, the lid), at an arbitrary point
    for (let q = 0; q < fold.pieces; q++) {
      F(0.123456789, -0.987654321, q, out);
      assert.ok(Object.is(out[0], 0.123456789) && Object.is(out[1], -0.987654321) && out[2] === 0, name + ': piece ' + q);
    }
    for (const b of M.boundary) {
      for (let k = 0; k < b.cells.length; k++) {
        F(b.pts[2 * k], b.pts[2 * k + 1], b.cells[k], out);
        assert.ok(Object.is(out[0], b.pts[2 * k]) && Object.is(out[1], b.pts[2 * k + 1]) && out[2] === 0, name + ': boundary');
      }
    }
    for (const c of M.creases) {
      for (const p of [c.a, c.b]) { F(c.pts[2], c.pts[3], p, out); assert.ok(out[0] === c.pts[2] && out[1] === c.pts[3] && out[2] === 0, name + ': crease'); }
    }
    // the base tile never moves at all
    for (const t of [0.1, 0.37, 0.5, 0.82, 1]) {
      const G = fold.at(t);
      for (const b of M.boundary) {
        for (let k = 0; k < b.cells.length; k += 5) {
          G(b.pts[2 * k], b.pts[2 * k + 1], 0, out);
          assert.ok(out[0] === b.pts[2 * k] && out[1] === b.pts[2 * k + 1] && out[2] === 0, name + ': the base tile stays where it is, t = ' + t);
        }
      }
    }
  });
});

test('SPEC 5.3 (2), kaleidoscope form: at t = 1 every cell lies exactly on the base tile, one sheet per layer', () => {
  eachCase((s) => {
    const { group, fold, M, size, name } = s, S = M.cells.length, F = fold.at(1), out = [0, 0, 0];
    const base = M.cells[0], sp = fold.spacing;
    assert.ok(Math.abs(sp - LAYER_SPACING * size) < 1e-15);
    const layerOf = new Array(S).fill(null);
    let seen = 0;
    for (let v = 0; v < M.n; v++) {
      const p = M.cell[v];
      if (p >= S) continue;                                              // rows of a spine: tested separately
      seen++;
      const x = M.xy[2 * v], y = M.xy[2 * v + 1];
      F(x, y, p, out);
      // (a) the image is the cell's own group element onto the base tile: h = g_base ∘ g_cell^-1
      const h = compose(base.g, inverse(M.cells[p].g)), q = apply(h, x, y);
      assert.ok(Math.hypot(out[0] - q[0], out[1] - q[1]) < 1e-9 * size, name + ': vertex ' + v + ' lands at its image in the base tile');
      // (the mesh stores Float32 coordinates, so a vertex on a cell's rim can sit 1e-7 outside its cell)
      assert.ok(outside(base.poly, out[0], out[1]) < 1e-6 * size, name + ': inside the base tile');
      // (c) height: a whole number of spacings, the same for the whole cell
      const layer = out[2] / sp;
      assert.ok(Math.abs(layer - Math.round(layer)) < 1e-9, name + ': a whole number of spacings');
      if (layerOf[p] === null) layerOf[p] = Math.round(layer); else assert.equal(Math.round(layer), layerOf[p], name + ': a cell is one flat sheet');
    }
    assert.ok(seen >= 3 * S);
    // (b) independently of the module's own isometries: a point inside a cell lands where reflecting it across
    // the base tile's mirrors, again and again until it is inside, sends it
    for (let t = 0; t < M.cellTriangles; t++) {
      const a = M.tri[3 * t], b = M.tri[3 * t + 1], c = M.tri[3 * t + 2];
      const x = (M.xy[2 * a] + M.xy[2 * b] + M.xy[2 * c]) / 3, y = (M.xy[2 * a + 1] + M.xy[2 * b + 1] + M.xy[2 * c + 1]) / 3;
      F(x, y, M.triCell[t], out);
      const r = reflectInto(base.poly, x, y);
      assert.ok(Math.hypot(out[0] - r[0], out[1] - r[1]) < 1e-9 * size, name + ': triangle ' + t + ' lands where the mirrors send it');
      assert.ok(outside(base.poly, out[0], out[1]) < 0, name + ': strictly inside the base tile');
    }
    assert.equal(layerOf[0], 0, name + ': the base tile is the bottom sheet');
    assert.deepEqual(layerOf.slice().sort((a, b) => a - b), Array.from({ length: S }, (_, k) => k), name + ': sheets 0 … 2n-1, none coincide');
    M.cells.forEach((c, p) => {
      assert.equal(c.layer, layerOf[p]);
      assert.ok(contains(group, compose(base.g, inverse(c.g))), name);
      const img = c.poly.map((q) => { F(q[0], q[1], p, out); return [out[0], out[1]]; });
      assert.ok(samePoints(img, base.poly, 1e-9 * size), name + ': the cell polygon lands on the base polygon');
    });
    // rows of the spines: on the rim of the stack, never farther out than the largest spine radius, between bottom and top sheet
    const rmax = ((2 * S - 1) / 2) * sp;
    for (let v = 0; v < M.n; v++) {
      if (M.cell[v] < S) continue;
      F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
      assert.ok(outside(base.poly, out[0], out[1]) < rmax + 1e-9 * size, name + ': spine near the rim');
      assert.ok(out[2] > -1e-12 && out[2] < (S - 1) * sp + 1e-12, name + ': spine within the stack');
    }
  });
});

test('SPEC 5.3 (3): continuity over 200 steps, no jump at stage boundaries or at the ends', () => {
  eachCase((s) => {
    const { fold, M, name } = s;
    const profile = (steps) => {
      const d = new Float64Array(steps);
      let prev = positions(s, 0), cur = new Float64Array(prev.length);
      for (let i = 1; i <= steps; i++) {
        positions(s, i / steps, cur);
        let m = 0;
        for (let k = 0; k < cur.length; k += 3) m = Math.max(m, Math.hypot(cur[k] - prev[k], cur[k + 1] - prev[k + 1], cur[k + 2] - prev[k + 2]));
        d[i - 1] = m;
        const sw = prev; prev = cur; cur = sw;
      }
      return d;
    };
    const d = profile(200);
    const max = Math.max(...d), mean = d.reduce((a, b) => a + b, 0) / d.length;
    // the patch: its diameter in the plane
    const diam = Math.hypot(M.bbox[2] - M.bbox[0], M.bbox[3] - M.bbox[1]);
    assert.ok(max < 0.05 * diam, name + `: largest step ${max.toFixed(4)} is small against the patch (${diam.toFixed(3)})`);
    assert.ok(max < 2.2 * mean, name + `: steps are of one order (max ${max.toFixed(4)}, mean ${mean.toFixed(4)})`);
    for (let i = 0; i < d.length; i++) {
      const nb = Math.max(i > 0 ? d[i - 1] : 0, i + 1 < d.length ? d[i + 1] : 0);
      assert.ok(d[i] < 2.6 * nb + 0.004 * diam, name + `: no isolated spike at step ${i} (${d[i].toFixed(5)} against ${nb.toFixed(5)})`);
    }
    assert.ok(d[0] < 0.25 * max && d[d.length - 1] < 0.25 * max, name + ': the motion starts and ends gently');
    // a true discontinuity does not shrink when the step is halved
    if (!s.random) {
      const d2 = profile(400);
      assert.ok(Math.max(...d2) < 0.56 * max, name + ': halving the step halves the largest displacement');
    }
    // stage boundaries: just before and just after a stop the picture is the same
    for (const st of fold.stops) {
      const a = positions(s, Math.max(0, st.t - 1e-9)), b = positions(s, Math.min(1, st.t + 1e-9)), c = positions(s, st.t);
      for (let k = 0; k < a.length; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-9 && Math.abs(a[k] - c[k]) < 1e-9, name + ': continuous at the stop t = ' + st.t);
    }
  });
});

test('SPEC 5.3 (4): no NaN or Infinity for any t, stage boundaries included', () => {
  eachCase((s) => {
    const { fold, M, name } = s, rnd = mulberry32(11);
    const ts = [0, 1, -1, 2, 1e-300, 1e-12, 1 - 1e-16, 1 - 1e-9, 0.5, -0, Number.MIN_VALUE];
    for (const st of fold.stops) ts.push(st.t, st.t - 1e-15, st.t + 1e-15, st.t - 1e-7, st.t + 1e-7);
    const sweep = s.random ? 50 : 200;
    for (let i = 0; i <= sweep; i++) ts.push(i / sweep);
    for (let i = 0; i < (s.random ? 12 : 300); i++) ts.push(rnd());
    const P = new Float64Array(3 * drawn(s).n);
    for (const t of ts) {
      positions(s, t, P, true);
      for (let k = 0; k < P.length; k++) assert.ok(Number.isFinite(P[k]), name + ': not finite at t = ' + t);
    }
    // t outside [0, 1] is clamped; nonsense is the flat tile
    const a = positions(s, 2), b = positions(s, 1), c = positions(s, -3), z = positions(s, 0), w = positions(s, NaN);
    for (let k = 0; k < a.length; k++) { assert.equal(a[k], b[k]); assert.equal(c[k], z[k]); assert.equal(w[k], z[k]); }
  });
});

test('paper: every cell moves rigidly, upward (+z), and never below the plane', () => {
  eachCase((s) => {
    const { fold, M, size, name } = s, S = M.cells.length, out = [0, 0, 0];
    let top = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, F = fold.at(t);
      M.cells.forEach((c, p) => {
        const img = c.poly.map((q) => { F(q[0], q[1], p, out); return out.slice(); });
        for (let a = 0; a < img.length; a++) {
          for (let b = a + 1; b < img.length; b++) {
            const d0 = Math.hypot(c.poly[a][0] - c.poly[b][0], c.poly[a][1] - c.poly[b][1]);
            const d1 = Math.hypot(img[a][0] - img[b][0], img[a][1] - img[b][1], img[a][2] - img[b][2]);
            assert.ok(Math.abs(d0 - d1) < 1e-12, name + ': rigid, t = ' + t);
          }
        }
      });
      const P = positions(s, t);
      for (let k = 2; k < P.length; k += 3) { assert.ok(P[k] > -1e-12, name + ': nothing goes below the plane, t = ' + t); top = Math.max(top, P[k]); }
    }
    assert.ok(top > 0.5 * size, name + ': the flaps rise well above the plane');
  });
});

// ---- 3D helpers for the collision test ----
function planeOf(Q) {
  const ux = Q[1][0] - Q[0][0], uy = Q[1][1] - Q[0][1], uz = Q[1][2] - Q[0][2];
  const vx = Q[2][0] - Q[0][0], vy = Q[2][1] - Q[0][1], vz = Q[2][2] - Q[0][2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz);
  nx /= l; ny /= l; nz /= l;
  const ul = Math.hypot(ux, uy, uz), e1 = [ux / ul, uy / ul, uz / ul];
  const e2 = [ny * e1[2] - nz * e1[1], nz * e1[0] - nx * e1[2], nx * e1[1] - ny * e1[0]];
  return { n: [nx, ny, nz], d: nx * Q[0][0] + ny * Q[0][1] + nz * Q[0][2], o: Q[0], e1, e2 };
}
const to2 = (pl, p) => [(p[0] - pl.o[0]) * pl.e1[0] + (p[1] - pl.o[1]) * pl.e1[1] + (p[2] - pl.o[2]) * pl.e1[2],
  (p[0] - pl.o[0]) * pl.e2[0] + (p[1] - pl.o[1]) * pl.e2[1] + (p[2] - pl.o[2]) * pl.e2[2]];
/** Does an edge of polygon A pass through the interior of polygon B (both flat, in space)? */
function pierces(A, B, plB, eps, margin) {
  const B2 = B.map((p) => to2(plB, p));
  for (let i = 0; i < A.length; i++) {
    const p = A[i], q = A[(i + 1) % A.length];
    const dp = plB.n[0] * p[0] + plB.n[1] * p[1] + plB.n[2] * p[2] - plB.d, dq = plB.n[0] * q[0] + plB.n[1] * q[1] + plB.n[2] * q[2] - plB.d;
    if (!(Math.abs(dp) > eps && Math.abs(dq) > eps && dp * dq < 0)) continue;
    const u = dp / (dp - dq), x = to2(plB, [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1]), p[2] + u * (q[2] - p[2])]);
    if (outside(B2, x[0], x[1]) < -margin) return true;
  }
  return false;
}
/** Area shared by two flat polygons lying in (nearly) the same plane. */
function sharedArea(A, B, plB) {
  let poly = A.map((p) => to2(plB, p));
  const B2 = B.map((p) => to2(plB, p)), sgn = polyArea(B2) > 0 ? 1 : -1;
  for (let i = 0; i < B2.length && poly.length >= 3; i++) {
    const a = B2[i], b = B2[(i + 1) % B2.length];
    const nx = sgn * (b[1] - a[1]), ny = -sgn * (b[0] - a[0]);
    poly = clipHalfPlane(poly, nx, ny, nx * a[0] + ny * a[1]);
  }
  return poly.length >= 3 ? Math.abs(polyArea(poly)) : 0;
}

test('paper: no sheet passes through another, and no two sheets ever coincide', () => {
  const list = [];
  for (const id of IDS) for (const c of cases(id, { random: 6, amps: [0] })) list.push(c);
  for (const c of list) {
    for (const chirality of [undefined, 1, -1]) {
      const s = build(c, chirality ? { chirality } : {}), { fold, M, size, group, name } = s, S = M.cells.length, out = [0, 0, 0];
      const ts = [];
      for (let i = 0; i <= 120; i++) ts.push(i / 120);
      for (const st of fold.stops) ts.push(st.t, Math.max(0, st.t - 0.004), Math.min(1, st.t + 0.004));
      for (const t of ts) {
        const F = fold.at(t);
        const polys = M.cells.map((cl, p) => cl.poly.map((q) => { F(q[0], q[1], p, out); return out.slice(); }));
        const planes = polys.map(planeOf);
        for (let a = 0; a < S; a++) {
          for (let b = a + 1; b < S; b++) {
            assert.ok(!pierces(polys[a], polys[b], planes[b], 1e-9 * size, 1e-7 * size) && !pierces(polys[b], polys[a], planes[a], 1e-9 * size, 1e-7 * size),
              `${name} chirality ${chirality}: cells ${a} and ${b} cut through each other at t = ${t}`);
            // parallel sheets closer than 0.9 of a spacing must not overlap
            const dot = Math.abs(planes[a].n[0] * planes[b].n[0] + planes[a].n[1] * planes[b].n[1] + planes[a].n[2] * planes[b].n[2]);
            if (dot < 1 - 1e-12) continue;
            let gap = 0;
            for (const p of polys[a]) gap = Math.max(gap, Math.abs(planes[b].n[0] * p[0] + planes[b].n[1] * p[1] + planes[b].n[2] * p[2] - planes[b].d));
            if (gap > 0.9 * fold.spacing) continue;
            assert.ok(sharedArea(polys[a], polys[b], planes[b]) < 1e-9 * group.domainArea,
              `${name} chirality ${chirality}: cells ${a} and ${b} coincide at t = ${t} (gap ${gap})`);
          }
        }
      }
    }
  }
});

test('stops: one per completed crease; at each the patch is a flat stack over the sectors that are left', () => {
  eachCase((s) => {
    const { fold, M, size, name } = s, S = M.cells.length, out = [0, 0, 0], sp = fold.spacing;
    assert.equal(fold.stops.length, FOLDS[s.id] + 1, name);
    assert.equal(fold.stops[0].t, 0); assert.equal(fold.stops[fold.stops.length - 1].t, 1);
    for (let i = 0; i < fold.stops.length; i++) {
      assert.ok(typeof fold.stops[i].label === 'string' && fold.stops[i].label.length > 0);
      if (i) assert.ok(fold.stops[i].t - fold.stops[i - 1].t > 0.12, name + ': every fold gets a fair share of the time');
    }
    assert.ok(fold.duration >= 4 && fold.duration <= 7, name + ': duration');
    assert.equal(fold.folds.length, FOLDS[s.id]);
    fold.stops.forEach((st, i) => {
      const F = fold.at(st.t), stacks = new Map();
      M.cells.forEach((c, p) => {
        const img = c.poly.map((q) => { F(q[0], q[1], p, out); return out.slice(); });
        const layer = img[0][2] / sp;
        assert.ok(img.every((q) => Math.abs(q[2] / sp - layer) < 1e-9) && Math.abs(layer - Math.round(layer)) < 1e-9, name + ': flat sheets at whole layers at stop ' + i);
        // which cell of the star does it lie over?
        const over = M.cells.findIndex((d) => samePoints(img, d.poly, 1e-9 * size));
        assert.ok(over >= 0, name + ': at stop ' + i + ' every cell lies over a cell of the star');
        if (!stacks.has(over)) stacks.set(over, []);
        stacks.get(over).push(Math.round(layer));
      });
      // after i folds c sectors are left, each a stack 0, 1, 2, … without gaps or repeats
      assert.equal(stacks.size, i === 0 ? S : foldPlan(fold.order).folds[i - 1].c, name + ': sectors left at stop ' + i);
      for (const layers of stacks.values()) assert.deepEqual(layers.slice().sort((a, b) => a - b), layers.map((_, k) => k), name + ': a proper stack at stop ' + i);
    });
  });
});

test('spines: a sheet that runs through a crease bends round a half cylinder about the fold axis', () => {
  const list = [];
  for (const id of IDS) for (const c of cases(id, { random: 3, amps: [0] })) list.push(c);
  for (const c of list) {
    const s = build(c), { fold, M, name } = s, S = M.cells.length, out = [0, 0, 0];
    const bare = build(c, { spines: false });
    // without spines: the cells, one crease piece per spoke, the lid and one outline piece per side of the tile
    assert.equal(bare.fold.pieces, 2 * S + 1 + bare.M.boundary.length); assert.equal(bare.M.m, bare.M.cellTriangles); assert.equal(M.cellTriangles, bare.M.m);
    assert.ok(M.m > M.cellTriangles, name + ': there are spine strips');
    // the cells move the same with and without spines
    for (const t of [0.13, 0.5, 0.77, 1]) {
      const A = fold.at(t), B = bare.fold.at(t), o2 = [0, 0, 0];
      for (let v = 0; v < bare.M.n; v++) {
        A(bare.M.xy[2 * v], bare.M.xy[2 * v + 1], bare.M.cell[v], out); B(bare.M.xy[2 * v], bare.M.xy[2 * v + 1], bare.M.cell[v], o2);
        assert.ok(out[0] === o2[0] && out[1] === o2[1] && out[2] === o2[2]);
      }
    }
    // strips: vertices of one strip = rows on one spoke; in the middle of that spoke's fold the rows lie on a circle about the axis
    const rowsOf = new Map();          // crease index -> Map(piece -> a vertex at the far end of the spoke)
    for (let t = M.cellTriangles; t < M.m; t++) {
      for (let e = 0; e < 3; e++) {
        const v = M.tri[3 * t + e], x = M.xy[2 * v], y = M.xy[2 * v + 1];
        const ci = M.creases.findIndex((cr) => Math.hypot(cr.pts[2] - x, cr.pts[3] - y) < 1e-6);
        if (ci < 0) continue;
        if (!rowsOf.has(ci)) rowsOf.set(ci, new Map());
        rowsOf.get(ci).set(M.cell[v], v);
      }
    }
    assert.equal(rowsOf.size, S, name + ': every spoke has a spine');
    for (const [ci, rows] of rowsOf) {
      const cr = M.creases[ci], fi = cr.fold, f = fold.folds[fi];
      assert.ok(rows.has(cr.cells[0]) && rows.has(cr.cells[1]), name + ': a spine joins the two cells of its crease');
      assert.ok(rows.size >= 4);
      for (const u of [0.3, 0.5, 0.8, 0.96]) {
        const F = fold.at(f.t0 + u * (f.t1 - f.t0));
        const ex = Math.cos(f.angle), ey = Math.sin(f.angle);
        let radius = null;
        const angles = [];
        for (const [piece, v] of rows) {
          F(M.xy[2 * v], M.xy[2 * v + 1], piece, out);
          // distance from the axis line through (pivot, axisHeight) with direction (ex, ey, 0)
          const dx = out[0] - fold.pivot[0], dy = out[1] - fold.pivot[1], dz = out[2] - f.axisHeight;
          const al = dx * ex + dy * ey, px = dx - al * ex, py = dy - al * ey, r = Math.hypot(px, py, dz);
          if (radius === null) radius = r;
          assert.ok(Math.abs(r - radius) < 1e-9, name + ': the rows of a spine are equally far from the axis');
          assert.ok(r > 0.4 * fold.spacing);
          angles.push(Math.atan2(px * -ey + py * ex, -dz));
        }
        angles.sort((a, b) => a - b);
        const turn = Math.PI * ease(u), span = Math.abs(angles[angles.length - 1] - angles[0]);
        assert.ok(Math.abs(span - turn) < 1e-6, name + ': the spine spans the angle the flap has turned');
        for (let i = 2; i < angles.length; i++) assert.ok(Math.abs((angles[i] - angles[i - 1]) - (angles[1] - angles[0])) < 1e-6, name + ': evenly spaced rows');
      }
    }
  }
});

test('the lid rides on the top sheet over the base tile; a crease piece is the middle of its crease', () => {
  eachCase((s) => {
    const { fold, M, size, name } = s, S = M.cells.length, sp = fold.spacing, out = [0, 0, 0], o2 = [0, 0, 0];
    const base = M.cells[0].poly, cen = base.reduce((a, p) => [a[0] + p[0] / base.length, a[1] + p[1] / base.length], [0, 0]);
    let prevZ = 0;
    for (let i = 0; i <= 240; i++) {
      const t = i / 240, F = fold.at(t);
      // the lid never moves sideways, never sinks, and is never buried: every cell that lies flat over the tile is at or below it
      for (const q of base.concat([cen])) {
        F(q[0], q[1], M.lid, out);
        assert.ok(out[0] === q[0] && out[1] === q[1], name + ': the lid stays over the tile');
      }
      const z = out[2];
      assert.ok(z >= prevZ - 1e-15 && z <= (S - 1) * sp + 1e-15, name + ': the lid only rises, up to the top of the stack');
      assert.ok(z - prevZ < 0.012 * size, name + ': and rises smoothly');
      prevZ = z;
      M.cells.forEach((c, p) => {
        const img = c.poly.map((q) => { F(q[0], q[1], p, o2); return o2.slice(); });
        if (img.every((q) => Math.abs(q[2] - img[0][2]) < 1e-12) && samePoints(img, base, 1e-9 * size)) {
          assert.ok(img[0][2] <= z + 1e-12, name + ': the lid is on or above every sheet that lies on the tile, t = ' + t);
        }
      });
    }
    // at a stop the lid is exactly the top sheet over the tile
    for (const st of fold.stops) {
      const F = fold.at(st.t);
      let top = 0;
      M.cells.forEach((c, p) => {
        const img = c.poly.map((q) => { F(q[0], q[1], p, o2); return o2.slice(); });
        if (samePoints(img, base, 1e-9 * size)) top = Math.max(top, img[0][2]);
      });
      F(cen[0], cen[1], M.lid, out);
      assert.ok(Math.abs(out[2] - top) < 1e-12, name + ': lid = top sheet at the stop t = ' + st.t);
    }
    fold.folds.forEach((f, i) => {
      assert.ok(f.lidTo >= f.lidFrom && (i === 0 ? f.lidFrom === 0 : f.lidFrom === fold.folds[i - 1].lidTo));
      if (i === fold.folds.length - 1) assert.equal(f.lidTo, S - 1);
    });
    // crease pieces: half way between the two cells of the crease, for points of the crease line. During the last fold
    // each also drifts up by what it lacks to the top of the stack, in step with the lid.
    const rnd = mulberry32(3), last = fold.folds[fold.folds.length - 1];
    for (const cr of M.creases) {
      for (let k = 0; k < 8; k++) {
        const t = k < 2 ? k : k < 4 ? last.t0 + rnd() * (1 - last.t0) : rnd();
        const w = rnd(), x = cr.pts[0] + w * (cr.pts[2] - cr.pts[0]), y = cr.pts[1] + w * (cr.pts[3] - cr.pts[1]);
        const F = fold.at(t), a = F(x, y, cr.cells[0], [0, 0, 0]), b = F(x, y, cr.cells[1], [0, 0, 0]);
        F(x, y, cr.b, out);
        const lidZ = F(cen[0], cen[1], M.lid, [0, 0, 0])[2];
        const lift = t > last.t0 ? (lidZ / sp - last.lidFrom) / (last.lidTo - last.lidFrom) : 0;
        assert.ok(lift > -1e-12 && lift < 1 + 1e-12);
        for (let e = 0; e < 2; e++) assert.ok(Math.abs(out[e] - (a[e] + b[e]) / 2) < 1e-12, name + ': crease piece = middle of the crease');
        const lack = (S - 1 - (M.cells[cr.cells[0]].layer + M.cells[cr.cells[1]].layer) / 2) * sp;
        assert.ok(lack >= 0.5 * sp - 1e-15);
        assert.ok(Math.abs(out[2] - ((a[2] + b[2]) / 2 + lift * lack)) < 1e-12, name + ': crease piece at the middle height, drifting up to the lid in the last fold');
        // before its fold begins the crease is on the paper: both sides agree
        if (t <= fold.folds[cr.fold].t0) for (let e = 0; e < 3; e++) assert.ok(Math.abs(a[e] - b[e]) < 1e-12, name + ': an unfolded crease is closed');
      }
    }
    // before the last fold the folded creases have gathered on few lines (the axes of the folds), level, at
    // half-layer heights; the creases still to be folded lie on their sheets
    const Fb = fold.at(last.t0), linesBefore = new Set();
    for (const cr of M.creases) {
      const a = Fb(cr.pts[0], cr.pts[1], cr.b, [0, 0, 0]), b = Fb(cr.pts[2], cr.pts[3], cr.b, [0, 0, 0]);
      assert.ok(Math.abs(a[2] - b[2]) < 1e-12 && Math.abs((2 * a[2]) / sp - Math.round((2 * a[2]) / sp)) < 1e-6, name + ': a crease is level, at a half-layer height');
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]);
      linesBefore.add(Math.round((2 * a[2]) / sp) + '|' + (Math.round(((b[0] - a[0]) / dl) * 1e4) + 0) + '|' + (Math.round(((b[1] - a[1]) / dl) * 1e4) + 0));
    }
    // (order 2: the first fold makes two creases on opposite rays, the last two are still to come: nothing to share yet)
    assert.ok(linesBefore.size < S || fold.order === 2, name + ': folded creases share lines (' + linesBefore.size + ' lines for ' + S + ' creases)');
    // folded, every crease lies along one of the two sides of the tile at the pivot, at the height of the lid:
    // exactly under the tile's outline (so 2n dashed lines have become two, and the bold outline covers them)
    const F1 = fold.at(1), ends = [];
    for (const cr of M.creases) {
      const a = F1(cr.pts[0], cr.pts[1], cr.b, [0, 0, 0]), b = F1(cr.pts[2], cr.pts[3], cr.b, [0, 0, 0]);
      assert.ok(Math.abs(a[2] - (S - 1) * sp) < 1e-12 && Math.abs(b[2] - (S - 1) * sp) < 1e-12, name + ': a folded crease is at the height of the lid');
      assert.ok(Math.hypot(a[0] - fold.pivot[0], a[1] - fold.pivot[1]) < 1e-6 * size, name + ': it starts at the pivot');
      const corner = base.findIndex((q) => Math.hypot(q[0] - b[0], q[1] - b[1]) < 1e-6 * size);
      assert.ok(corner >= 0, name + ': and ends at a corner of the tile');
      if (!ends.includes(corner)) ends.push(corner);
    }
    assert.equal(ends.length, 2, name + ': the 2n creases end on the two sides of the tile at the pivot');
  });
});

test('the outline rides on the topmost paper along each side: on top of the taller of the stacks that meet there (finding 5)', () => {
  eachCase((s) => {
    const { fold, M, size, name } = s, S = M.cells.length, sp = fold.spacing, out = [0, 0, 0], o2 = [0, 0, 0];
    const corners = M.cells[0].poly, rho = 3 * sp;
    // a side of the tile: its piece and its two corners (exact, from the base cell)
    const sides = M.boundary.map((b, i) => {
      const m = b.pts.length / 2, end = (k) => corners.find((q) => Math.hypot(q[0] - b.pts[2 * k], q[1] - b.pts[2 * k + 1]) < 1e-6 * size);
      const A = end(0), B = end(m - 1);
      assert.ok(A && B && A !== B, name + ': a side runs between two corners of the tile');
      return { b, piece: M.outline[i], A, B };
    });
    // (a) at a stop every sheet lies flat: each corner of the tile lies exactly on the top of the tallest stack that
    // meets there (the pivot meets them all), and every point of the outline is at or above every sheet under it
    for (const st of fold.stops) {
      const F = fold.at(st.t);
      const sheets = M.cells.map((c, p) => { const img = c.poly.map((q) => F(q[0], q[1], p, [0, 0, 0])); return { poly: img.map((q) => [q[0], q[1]]), z: img[0][2] }; });
      const topAt = (x, y, tol) => sheets.reduce((h, sh) => (outside(sh.poly, x, y) < tol ? Math.max(h, sh.z) : h), -Infinity);
      for (const sd of sides) {
        for (const c of [sd.A, sd.B]) {
          F(c[0], c[1], sd.piece, out);
          assert.ok(Math.abs(out[2] - topAt(c[0], c[1], 1e-9 * size)) < 1e-12, `${name}: a corner of the outline on top of the tallest stack there, stop t = ${st.t}`);
        }
        for (let k = 0; k < sd.b.pts.length / 2; k++) {
          const x = sd.b.pts[2 * k], y = sd.b.pts[2 * k + 1];
          F(x, y, sd.piece, out);
          assert.ok(out[0] === x && out[1] === y, name + ': the outline stays over its place');
          // (the samples are Float32: one at a corner can sit 2e-8 off it, on a side that slopes up to 0.03; a
          // spacing is 0.008 tile sizes, so 1e-7 tile sizes is no tolerance for what this test is about)
          assert.ok(out[2] >= topAt(x, y, 1e-6 * size) - 1e-7 * size, `${name}: the outline at or above every sheet under it, stop t = ${st.t}`);
        }
      }
    }
    // (b) at every t, no paper at rest stands above the outline within 3 spacings of it: neither a taller stack beside
    // a side nor its folded edge bulging over it. "At rest": within a quarter spacing of where it lies at the start or
    // at the end of the fold under way (the flap of that fold and the spines it bends are moving; near a stop they are
    // almost at rest, and must not stand over the outline either). Such paper may stand a quarter spacing above its
    // place of rest, the bound allows half a spacing. (v1, whose outline rode on the top of the tile's own stack: the
    // folded edge of *632's taller neighbour 4 spacings above the outline round the stop 'sixth', *333's 2.)
    const ts = [];
    for (let i = 0; i <= (s.random ? 60 : 160); i++) ts.push(i / (s.random ? 60 : 160));
    for (const st of fold.stops) for (const d of [0, -0.01, -0.002, 0.002, 0.01]) if (st.t + d >= 0 && st.t + d <= 1) ts.push(st.t + d);
    const P0 = new Float64Array(3 * M.n), P1 = new Float64Array(3 * M.n), Pt = new Float64Array(3 * M.n);
    const place = (F, P) => { for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); P[3 * v] = out[0]; P[3 * v + 1] = out[1]; P[3 * v + 2] = out[2]; } };
    const prevZ = new Map();
    for (const t of ts.sort((a, b) => a - b)) {
      const f = fold.folds.findIndex((x) => t <= x.t1), stage = fold.folds[Math.max(0, f)];
      const F = fold.at(t);
      place(fold.at(stage.t0), P0); place(fold.at(stage.t1), P1); place(F, Pt);
      for (let v = 0; v < M.n; v++) {
        const near = (P) => Math.hypot(P[3 * v] - Pt[3 * v], P[3 * v + 1] - Pt[3 * v + 1], P[3 * v + 2] - Pt[3 * v + 2]) <= 0.25 * sp;
        if (!near(P0) && !near(P1)) continue;                       // moving now
        const x = Pt[3 * v], y = Pt[3 * v + 1], z = Pt[3 * v + 2];
        for (const sd of sides) {
          const dx = sd.B[0] - sd.A[0], dy = sd.B[1] - sd.A[1], l2 = dx * dx + dy * dy;
          const u = Math.max(0, Math.min(1, ((x - sd.A[0]) * dx + (y - sd.A[1]) * dy) / l2)), qx = sd.A[0] + u * dx, qy = sd.A[1] + u * dy;
          if (Math.hypot(x - qx, y - qy) >= rho) continue;
          F(qx, qy, sd.piece, o2);
          assert.ok(z <= o2[2] + 0.5 * sp, `${name}: paper at rest ${((z - o2[2]) / sp).toFixed(2)} spacings above the outline at t = ${t}`);
        }
      }
      // (c) the outline only rises, never above the top of the finished stack, and ends on it
      for (const sd of sides) {
        for (let k = 0; k < sd.b.pts.length / 2; k += 3) {
          F(sd.b.pts[2 * k], sd.b.pts[2 * k + 1], sd.piece, out);
          // (1e-7 tile sizes: a Float32 sample at a corner can sit 2e-8 beyond it, where a steepening side dips a hair)
          const key = sd.piece * 100000 + k, zp = prevZ.has(key) ? prevZ.get(key) : 0;
          assert.ok(out[2] >= zp - 1e-7 * size && out[2] >= -1e-7 * size && out[2] <= (S - 1) * sp + 1e-7 * size, name + ': the outline only rises, within the stack');
          if (t === 1) assert.ok(Math.abs(out[2] - (S - 1) * sp) < 1e-7 * size, name + ': folded, the outline is on the top sheet');
          prevZ.set(key, out[2]);
        }
      }
    }
  });
});

test('which way round: the default leaves the base tile on the viewer side of the first crease; both ways are folds', () => {
  for (const id of IDS) {
    for (const c of cases(id, { random: 8, amps: [0] })) {
      const s = build(c), sPlus = build(c, { chirality: 1 }), sMinus = build(c, { chirality: -1 });
      assert.equal(sPlus.fold.chirality, 1); assert.equal(sMinus.fold.chirality, -1);
      // the unit normal of the first crease on the base tile's side: ny < 0 = the tile's half is the near one (the viewer
      // looks along +y), |ny| = how level the crease is
      const normalY = (t) => {
        const a = t.fold.folds[0].angle, P = t.fold.pivot, cen = t.M.cells[0].poly.reduce((u, p) => [u[0] + p[0] / t.M.cells[0].poly.length, u[1] + p[1] / t.M.cells[0].poly.length], [0, 0]);
        let nx = -Math.sin(a), ny = Math.cos(a);
        if (nx * (cen[0] - P[0]) + ny * (cen[1] - P[1]) < 0) { nx = -nx; ny = -ny; }
        return ny;
      };
      const mine = normalY(s), other = normalY(s.fold.chirality === 1 ? sMinus : sPlus);
      assert.ok(creaseScore(mine) >= creaseScore(other) - 1e-9, s.name + ': the first crease is the one that reads better from the default view');
      // in words: never a crease that points at the viewer when the other one is clearly more level …
      assert.ok(Math.abs(mine) > 0.3 || Math.abs(other) < 0.35, s.name + ': not edge-on when it can be helped');
      // … and toward the viewer whenever that crease is not much steeper than the other
      if (other < 0 && mine > 0) assert.ok(mine > 3 * -other - 1e-9, s.name);
      // both choices fold the whole star onto the base tile
      for (const t of [sPlus, sMinus]) {
        const F = t.fold.at(1), out = [0, 0, 0];
        const M = t.M;
        for (let k = 0; k < M.cellTriangles; k++) {
          const a = M.tri[3 * k], b = M.tri[3 * k + 1], c = M.tri[3 * k + 2];
          const x = (M.xy[2 * a] + M.xy[2 * b] + M.xy[2 * c]) / 3, y = (M.xy[2 * a + 1] + M.xy[2 * b + 1] + M.xy[2 * c + 1]) / 3;
          F(x, y, M.triCell[k], out);
          const r = reflectInto(M.cells[0].poly, x, y);
          assert.ok(Math.hypot(out[0] - r[0], out[1] - r[1]) < 1e-9, t.name);
        }
      }
    }
  }
  // the presets: the first crease is as level as the mirrors allow and the base tile is in front of it
  for (const id of IDS) {
    const s = build(cases(id, { random: 0, amps: [0] })[0]);
    const a = s.fold.folds[0].angle, level = Math.abs(Math.cos(a));
    assert.ok(level > 0.85, id + ': first crease within about 30 degrees of level');
  }
});

test('the shape names the tile exactly (finding 47: *442 and *632 are both right triangles)', () => {
  // the tile of a kaleidoscope is its cell; name it by its angles, as the chip and the picker show group.shape
  const byAngles = { '90,90,90,90': 'rectangle', '45,45,90': '45-45-90 triangle', '60,60,60': 'equilateral triangle', '30,60,90': '30-60-90 triangle' };
  for (const id of IDS) {
    const T = BY_ID[id].kaleido.cell, K = T.length, angles = [];
    for (let i = 0; i < K; i++) {
      const p = T[i], a = T[(i + 1) % K], b = T[(i + K - 1) % K];
      const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
      angles.push(Math.round((Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by) * 180) / Math.PI));
    }
    const key = angles.sort((x, y) => x - y).join(',');
    assert.equal(BY_ID[id].shape, byAngles[key], id + ': angles ' + key);
    assert.equal(BY_ID[id].fold, 'snowflake');
  }
});

test('robust arguments: no domain, no mesh, a seed that is not finite, a piece that does not exist', () => {
  for (const id of IDS) {
    const group = BY_ID[id], ref = build(cases(id, { random: 0, amps: [0] })[0]);
    for (const args of [[group], [group, undefined, undefined, {}], [group, { seed: [NaN, 1] }], [group, { seed: group.presets[0].seed }, null]]) {
      const fold = createFold(...args), M = fold.mesh;
      assert.equal(M.cells.length, 2 * ORDER[id], id);
      assert.ok(samePoints(M.cells[0].poly, ref.M.cells[0].poly, 1e-12), id + ': falls back to the preset tile');
      assert.equal(M.boundary.length, group.kaleido.cell.length, id + ': a boundary without a domain');
      const P = new Float64Array(3 * M.n), out = [0, 0, 0];
      for (const t of [0, 0.3, 1]) {
        const F = fold.at(t);
        for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); P[3 * v] = out[0]; P[3 * v + 1] = out[1]; P[3 * v + 2] = out[2]; }
        assert.ok(P.every(Number.isFinite), id);
        // unknown pieces are treated as the base tile, which does not move
        for (const q of [-1, fold.pieces, 1e9, NaN, undefined]) { F(0.25, 0.5, q, out); assert.deepEqual(out, [0.25, 0.5, 0], id + ': piece ' + q); }
      }
    }
  }
});

test('at(t) is pure: functions of different times do not disturb each other', () => {
  for (const id of IDS) {
    const s = build(cases(id, { random: 0, amps: [0] })[0]), { fold, M } = s;
    const A = fold.at(0.3), before = [];
    const out = [0, 0, 0];
    for (let v = 0; v < M.n; v += 7) { A(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); before.push(out.slice()); }
    fold.at(0.9); fold.at(0); fold.at(1);
    let i = 0;
    for (let v = 0; v < M.n; v += 7) { A(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); assert.deepEqual(out, before[i++]); }
    // out is optional
    const r = fold.at(0.4)(M.xy[0], M.xy[1], M.cell[0]);
    assert.ok(Array.isArray(r) && r.length === 3 && r.every(Number.isFinite));
  }
});

test('speed: building the fold and one frame of it are cheap', () => {
  for (const id of IDS) {
    const c = cases(id, { random: 0, amps: [0] })[0];
    const warp = makeWarp(c.group, 0), domain = buildDomain(c.group, { seed: c.seed, warp }), mesh = buildMesh(c.group, domain);
    let fold = createFold(c.group, domain, mesh, {});
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) fold = createFold(c.group, domain, mesh, {});
    const buildMs = (performance.now() - t0) / 20;
    const t1 = performance.now(), M = fold.mesh, out = [0, 0, 0];
    for (let i = 0; i < 50; i++) { const F = fold.at(i / 50); for (let v = 0; v < M.n; v++) F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); }
    const frameMs = (performance.now() - t1) / 50;
    // generous limits (the machine is shared): typical values are 1 ms and 0.05 ms
    assert.ok(buildMs < 150, id + ': createFold takes ' + buildMs.toFixed(2) + ' ms');
    assert.ok(frameMs < 40, id + ': a frame takes ' + frameMs.toFixed(3) + ' ms');
    assert.ok(M.m <= 20000, id + ': at most 20k triangles');
  }
});
