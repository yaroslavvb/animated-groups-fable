import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REG_ELL,
  SQRT2,
  det2,
  sub3,
  cross3,
  dot3,
  norm3,
  mul2,
  dot2,
  mod,
  solidFromBasis,
  sellingFrames,
  createModel,
  readPartitions,
  activatePartition,
  setPartitionParams,
  buildPillowMesh,
  pairVectors,
  pairPrintParams,
} from '../src/real2222.js';
import {
  unitFields,
  printOf,
  printTexture,
  cellBox,
  placedInPane,
  samePrint,
} from '../src/paisley.js';

const PAISLEY_FNS = { placedInPane, samePrint };

test('det(e1, e2) === 1 invariant across 50 chained slider moves across all 3 partitions', () => {
  const model = createModel({ ell: 1, t: 0, cFrac: 0.296 });
  for (let step = 0; step < 50; step++) {
    const idx = step % 3;
    const ell = 0.8 + 0.55 * (0.5 + 0.5 * Math.sin(step * 0.7));
    const t = 0.45 * Math.cos(step * 0.9);
    setPartitionParams(model, idx, ell, t, PAISLEY_FNS);
    const det = det2(model.e[0], model.e[1]);
    assert.ok(Math.abs(det - 1) < 1e-11, `step ${step}: expected det=1, got ${det}`);
  }
});

test('sellingFrames invariants and zero-jump partition activation', () => {
  const cases = [
    [1, 0],
    [1, 0.25],
    [REG_ELL, 0.25],
    [1.3, -0.35],
    [0.85, 0.48],
  ];
  for (const [ell, t] of cases) {
    const model = createModel({ ell, t, cFrac: 0.296 });
    const sf = sellingFrames(model.e);
    const S = solidFromBasis(model.e);
    assert.equal(sf.length, 3);
    for (let k = 0; k < 3; k++) {
      assert.equal(det2(sf[k].M[0], sf[k].M[1]), 1, `frame ${k} must have det +1`);
      assert.ok(Math.abs(sf[k].ell - S.edges[k]) < 1e-11, `frame ${k} length mismatch`);
      assert.ok(sf[k].t >= -0.5 - 1e-11 && sf[k].t <= 0.5 + 1e-11, `frame ${k} twist out of range: ${sf[k].t}`);
    }

    const beforeParts = readPartitions(model);
    const beforeCorners = S.stage;
    for (const nextIdx of [1, 2, 0]) {
      activatePartition(model, nextIdx, PAISLEY_FNS);
      const afterParts = readPartitions(model);
      const afterCorners = solidFromBasis(model.e).stage;
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(afterParts[k].ell - beforeParts[k].ell) < 1e-12, 'ell jumped on activate');
        assert.ok(Math.abs(afterParts[k].t - beforeParts[k].t) < 1e-12, 'twist jumped on activate');
      }
      for (const name of ['A', 'B', 'C', 'D']) {
        assert.ok(norm3(sub3(afterCorners[name], beforeCorners[name])) < 1e-12, '3D corner jumped on activate');
      }
    }
  }
});

test('continuity of S.box across flat envelopes and positive outward winding for both sigma signs', () => {
  const model = createModel({ ell: 1.05, t: -0.6, cFrac: 0.296 });
  for (let idx = 0; idx < 3; idx++) {
    let prev = null;
    for (let i = -100; i <= 100; i++) {
      const tw = i * 0.005;
      setPartitionParams(model, idx, 1.05, tw, PAISLEY_FNS);
      const S = solidFromBasis(model.e, { minConorm: 0 });
      if (prev) {
        const jump = Math.max(...['A', 'B', 'C', 'D'].map((c) => norm3(sub3(S.box[c], prev[c]))));
        assert.ok(jump < 0.08, `idx ${idx} tw ${tw}: discontinuous vertex jump ${jump}`);
      }
      prev = S.box;

      const Sviz = solidFromBasis(model.e, { minConorm: 4e-4 });
      for (const tr of Sviz.tris) {
        const [a, b, c] = tr.names.map((n) => Sviz.stage[n]);
        const n = cross3(sub3(b, a), sub3(c, a));
        const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
        assert.ok(dot3(n, mid) > 0, `outward normal must point out (sigma=${Sviz.sigma}, tri=${tr.names.join('')})`);
      }
    }
  }
});

test('exact landmarks: Square envelope and Regular tetrahedron', () => {
  const sq = createModel({ ell: 1, t: 0, cFrac: 0.296 });
  const sqS = solidFromBasis(sq.e);
  const sqP = readPartitions(sq);
  assert.equal(sqS.kind, 'square envelope');
  assert.ok(Math.abs(sqS.edges[0] - 1) < 1e-12);
  assert.ok(Math.abs(sqS.edges[1] - 1) < 1e-12);
  assert.ok(Math.abs(sqS.edges[2] - SQRT2) < 1e-12);
  assert.ok(Math.abs(sqP[0].t) < 1e-12);
  assert.ok(Math.abs(sqP[1].t) < 1e-12);
  assert.ok(sqS.bends[2] < 0.08, 'Square diagonal AD should have near-zero bend');

  const reg = createModel({ ell: REG_ELL, t: 0.25, cFrac: 0.296 });
  const regS = solidFromBasis(reg.e);
  assert.equal(regS.kind, 'regular tetrahedron');
  for (const eLen of regS.edges) {
    assert.ok(Math.abs(eLen - REG_ELL) < 1e-9, `expected regular edge ${REG_ELL}, got ${eLen}`);
  }
});

test('buildPillowMesh area, cut length, band tinting, and seamless 2222 paisley texture across all 3 partitions', () => {
  const fields = unitFields();
  const N = 128;
  const states = [
    createModel({ ell: 1, t: 0, cFrac: 0.296, activeIdx: 0 }),
    createModel({ ell: REG_ELL, t: 0.25, cFrac: 0.296, activeIdx: 1 }),
    createModel({ ell: 1.18, t: -0.22, cFrac: 0.296, activeIdx: 2 }),
  ];

  for (const st of states) {
    const exactMesh = buildPillowMesh(st.e, st.activeFrame, st.cFrac, { minConorm: 0 });
    assert.ok(Math.abs(exactMesh.cutLength - 2 * exactMesh.pv.ell) < 1e-9, `exact cutLength ${exactMesh.cutLength} !== ${2 * exactMesh.pv.ell}`);

    const mesh = buildPillowMesh(st.e, st.activeFrame, st.cFrac);
    assert.ok(Math.abs(mesh.cutLength - 2 * mesh.pv.ell) < 2e-3, `display cutLength ${mesh.cutLength} !== ${2 * mesh.pv.ell}`);

    // Total 3D surface area of a constant-curvature flat Euclidean pillow of covolume 1 is exactly 2.0
    let area3D = 0;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const i0 = mesh.indices[t] * 3;
      const i1 = mesh.indices[t + 1] * 3;
      const i2 = mesh.indices[t + 2] * 3;
      const p0 = [mesh.positions[i0], mesh.positions[i0 + 1], mesh.positions[i0 + 2]];
      const p1 = [mesh.positions[i1], mesh.positions[i1 + 1], mesh.positions[i1 + 2]];
      const p2 = [mesh.positions[i2], mesh.positions[i2 + 1], mesh.positions[i2 + 2]];
      area3D += 0.5 * norm3(cross3(sub3(p1, p0), sub3(p2, p0)));
    }
    assert.ok(Math.abs(area3D - 2) < 1e-2, `expected surface area ~2, got ${area3D}`);

    // Tint splits cleanly into plain (0) and shaded (1) bands
    let n0 = 0;
    let n1 = 0;
    for (let i = 0; i < mesh.tint.length; i++) {
      if (mesh.tint[i] === 0) n0++;
      else n1++;
    }
    assert.ok(n0 > 0 && n1 > 0, 'both plain and shaded bands should be present');

    // Paisley SDF texture obeys 180-deg half-turn symmetry around every lattice corner
    const { ca, cb, S } = mesh;
    const pv = pairVectors(st.e, st.activeFrame);
    const toPair = (p) => [dot2(p, pv.vh), dot2(p, pv.nh)];
    const va = toPair(S.va);
    const vb = toPair(S.vb);
    const placed = printOf('2222', pairPrintParams(st.e, st.activeFrame, st.pr || 0), cellBox(ca, cb));
    const tex = printTexture(fields, placed, ca, cb, N);
    const buf = tex.tex.data;
    const det = ca[0] * cb[1] - ca[1] * cb[0];
    const sample = (q) => {
      const u = mod((q[0] * cb[1] - q[1] * cb[0]) / det, 1);
      const v = mod((ca[0] * q[1] - ca[1] * q[0]) / det, 1);
      const fx = u * N - 0.5;
      const fy = v * N - 0.5;
      const i0 = mod(Math.floor(fx), N);
      const j0 = mod(Math.floor(fy), N);
      const i1 = (i0 + 1) % N;
      const j1 = (j0 + 1) % N;
      const tx = fx - Math.floor(fx);
      const ty = fy - Math.floor(fy);
      return (buf[j0 * N + i0] * (1 - tx) + buf[j0 * N + i1] * tx) * (1 - ty) +
        (buf[j1 * N + i0] * (1 - tx) + buf[j1 * N + i1] * tx) * ty;
    };
    const corners = [[0, 0], va, vb, [va[0] + vb[0], va[1] + vb[1]]];
    let maxDiff = 0;
    for (const c of corners) {
      for (let k = 0; k < 15; k++) {
        const q = [0.13 * k - 0.4, 0.17 * k - 0.3];
        const q2 = [2 * c[0] - q[0], 2 * c[1] - q[1]];
        maxDiff = Math.max(maxDiff, Math.abs(sample(q) - sample(q2)));
      }
    }
    assert.ok(maxDiff < 1, `seam diff too large (${maxDiff}) for activeIdx=${st.activeIdx}`);
  }
});
