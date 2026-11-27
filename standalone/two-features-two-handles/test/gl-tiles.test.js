import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FAMILIES, normalizeFamilyKey, multiState, buildPatternModel, defaultCommas,
  psuInv, psuApplyDisc, psuToSO21, so21ToPSU, discDist,
} from '../src/handles.js';
import { locateTilePSU, tilesPSU } from '../src/pattern-ext.js';
import { collectFeatureTiles } from '../src/pattern-gl.js';
import { design } from '../../classification-of-surfaces/src/sym/motifs.js';
import { apply } from '../../classification-of-surfaces/src/sym/geom.js';

const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
const discToKlein = (w) => {
  const s = 2 / (1 + w[0] * w[0] + w[1] * w[1]);
  return [w[0] * s, w[1] * s];
};

function buildModelInputs(model) {
  const { D, A } = model;
  const G = D.G;
  const n = D.n;
  const area = G.area(D.verts);
  const des = (model.design || design)(D);
  const commaSamples = des.map((sh) => {
    const pts = sh && sh.pts;
    if (!pts || pts.length < 3) return { atH: D.at, atD: toDisc(D.at), rad: 0, pts: [] };
    const s = [0, 0, 0];
    for (const p of pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    const atH = G.norm(s);
    let rad = 0;
    for (const p of pts) rad = Math.max(rad, G.dist(atH, p));
    return { atH, atD: toDisc(atH), rad, pts };
  });
  const repSegs = [];
  A.glides.forEach((g, k) => {
    if (g.seg) repSegs.push({ a: g.seg[0], b: g.seg[1], kind: 0, grpIdx: k });
  });
  (model.lines || []).forEach((ln, k) => {
    if (!ln.once) repSegs.push({ a: ln.a, b: ln.b, kind: ln.role === 'o' ? 2 : 1, grpIdx: k });
  });
  const marked = A.classes.filter((c) => c.n > 1).map((c) => {
    const ref = model.markRefs && model.markRefs[c.id];
    return { c, v: ref ? ref.v : c.verts[0], dir: ref ? ref.dir : null };
  });
  return { D, A, G, n, area, commaSamples, repSegs, marked };
}

function assertMatchesBruteForce(label, model) {
  const { D, A, G, n, area, commaSamples, repSegs, marked } = buildModelInputs(model);
  const got = collectFeatureTiles(D, A, {
    commaSamples, repSegs, marked, area, locateTile: locateTilePSU,
  });
  assert.equal(got.truncated, false, `${label}: collectFeatureTiles truncated`);

  const atD = toDisc(D.at);
  const brute = tilesPSU(D, A, { focus: atD, radius: 5.5, max: 3000 });
  const norms = [];
  const vDiscs = D.verts.map(toDisc);
  const vKleins = vDiscs.map(discToKlein);
  const S_edges = [];
  const edgeLens = [];
  for (let i = 0; i < n; i++) {
    const a = D.verts[i], b = D.verts[(i + 1) % n];
    const N = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const el = Math.hypot(N[0], N[1], N[2]) || 1;
    const u = [N[0] / el, N[1] / el, N[2] / el];
    if (u[0] * D.at[0] + u[1] * D.at[1] + u[2] * D.at[2] < 0) { u[0] = -u[0]; u[1] = -u[1]; u[2] = -u[2]; }
    norms.push(u);
    S_edges.push(psuInv(so21ToPSU(G.frame(a, b), false)));
    edgeLens.push(G.dist(a, b));
  }
  const segDistHyp = (wD, S, lenH) => {
    const u = psuApplyDisc(S, wD);
    const r2 = u[0] * u[0] + u[1] * u[1];
    const uxK = (2 * u[0]) / (1 + r2);
    if (uxK <= 0) return 2 * Math.atanh(Math.min(1 - 1e-12, Math.hypot(u[0], u[1])));
    const tb = Math.tanh(0.5 * lenH);
    if ((1 + tb * tb) * u[0] >= tb * (1 + r2)) return discDist(u, [tb, 0]);
    return Math.asinh((2 * Math.abs(u[1])) / Math.max(1e-12, 1 - r2));
  };
  const pointDistToD = (wD) => {
    const k = discToKlein(wD);
    let inside = true;
    for (let i = 0; i < n; i++) {
      const N = norms[i];
      if (N[0] * k[0] + N[1] * k[1] + N[2] < -1e-9) { inside = false; break; }
    }
    if (inside) return 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) best = Math.min(best, segDistHyp(wD, S_edges[i], edgeLens[i]));
    return best;
  };
  const kleinSegsCross = (a0, b0, a1, b1) => {
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = cross(a1, b1, a0), d2 = cross(a1, b1, b0);
    const d3 = cross(a0, b0, a1), d4 = cross(a0, b0, b1);
    return ((d1 > 1e-10 && d2 < -1e-10) || (d1 < -1e-10 && d2 > 1e-10)) &&
           ((d3 > 1e-10 && d4 < -1e-10) || (d3 < -1e-10 && d4 > 1e-10));
  };
  const segDistToD = (aD, bD, S_ab, lenH) => {
    if (pointDistToD(aD) === 0 || pointDistToD(bD) === 0) return 0;
    const aK = discToKlein(aD), bK = discToKlein(bD);
    for (let i = 0; i < n; i++) {
      if (kleinSegsCross(aK, bK, vKleins[i], vKleins[(i + 1) % n])) return 0;
    }
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      best = Math.min(best, segDistHyp(aD, S_edges[i], edgeLens[i]), segDistHyp(bD, S_edges[i], edgeLens[i]), segDistHyp(vDiscs[i], S_ab, lenH));
    }
    return best;
  };

  for (let si = 0; si < commaSamples.length; si++) {
    const cs = commaSamples[si];
    if (!cs.pts.length) continue;
    const gotList = got.commaTiles[si].map((hit) => ({ fl: hit.g[4] ? 1 : 0, w: psuApplyDisc(hit.g, atD) }));
    for (const t of brute) {
      const g = psuInv(t.g);
      if (pointDistToD(psuApplyDisc(g, cs.atD)) <= cs.rad + 0.06) {
        const w = psuApplyDisc(g, atD), fl = g[4] ? 1 : 0;
        assert.ok(
          gotList.some((h) => h.fl === fl && discDist(h.w, w) < 1e-3),
          `${label}: missed comma[${si}] copy at dist=${discDist(atD, w).toFixed(3)}`
        );
      }
    }
  }

  for (let ri = 0; ri < repSegs.length; ri++) {
    const seg = repSegs[ri];
    const a0 = toDisc(seg.a), b0 = toDisc(seg.b), lenH = G.dist(seg.a, seg.b);
    const margin = (seg.kind === 0 || seg.kind === 2) ? 0.12 : 0.075;
    const gotSegs = got.segTiles[ri].map((hit) => ({ a: psuApplyDisc(hit.g, a0), b: psuApplyDisc(hit.g, b0) }));
    for (const t of brute) {
      const g = psuInv(t.g), M = psuToSO21(g);
      const gaH = apply(M, seg.a), gbH = apply(M, seg.b);
      const ga = psuApplyDisc(g, a0), gb = psuApplyDisc(g, b0);
      const S_ab = psuInv(so21ToPSU(G.frame(gaH, gbH), false));
      if (segDistToD(ga, gb, S_ab, lenH) <= margin) {
        assert.ok(
          gotSegs.some((p) => (discDist(p.a, ga) < 1e-3 && discDist(p.b, gb) < 1e-3) ||
                              (discDist(p.a, gb) < 1e-3 && discDist(p.b, ga) < 1e-3)),
          `${label}: missed segment[${ri}] copy`
        );
      }
    }
  }

  const hScale = Math.min(0.75, Math.max(0.45, 0.30 * Math.sqrt(area)));
  const markMargin = Math.max(0.45, 0.72 * hScale) - 0.02;
  for (let mi = 0; mi < marked.length; mi++) {
    const p0 = toDisc(D.verts[marked[mi].v]);
    const gotMarks = got.markTiles[mi].map((hit) => hit.pg);
    for (const t of brute) {
      const g = psuInv(t.g), pg = psuApplyDisc(g, p0);
      if (pointDistToD(pg) <= markMargin) {
        assert.ok(
          gotMarks.some((prev) => discDist(prev, pg) < 1e-3),
          `${label}: missed mark[${mi}] copy`
        );
      }
    }
  }

  return got;
}

describe('collectFeatureTiles exact convex BFS tiling', () => {
  it('captures all 6 tiles of the 12 o’clock comma on twisted 222222 without black tree overlap', () => {
    const k = normalizeFamilyKey('222222');
    const st = multiState(k, {
      active: 2, shown: 3,
      Ls: [2.634, 2.634, 2.634],
      tws: [0.0002, -0.03, 0.021],
    });
    const model = buildPatternModel(st);
    assert.equal(model.lines.length, 3);
    assert.ok(model.lines.every((ln) => !!ln.dash), '222222 emits dashed isolating cuts with no overlapping black tree');

    const got = assertMatchesBruteForce('222222 user repro', model);
    assert.equal(got.commaTiles[0].length, 1);
    assert.equal(got.commaTiles[1].length, 6);
  });

  it('matches brute-force tiling across built-in, still, and multi hyperbolic orbifolds', () => {
    for (const key of ['3333', '2223', '333*', '333*3', '333x', 'o33', '237', '*237', '4*3', '22222', '222222', '333333', '99999']) {
      const k = normalizeFamilyKey(key);
      const fam = FAMILIES[k];
      let st;
      if (fam.mode === 'still') st = { k };
      else if (fam.mode === 'multi') {
        st = multiState(k, { active: fam.pairs.length - 1, shown: fam.pairs.length, tws: fam.defaults.tw.map((_, i) => 0.17 * (i - 1)) });
      } else {
        const p0 = fam.defaultM.split('').map(Number);
        st = {
          k, perm: p0, orders: p0.map((c) => fam.baseOrders[c]),
          L: fam.defaultL, tw: 0.21, b: fam.defaultB ?? 0, tau: fam.defaultTau ?? 0,
          thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)),
        };
      }
      assertMatchesBruteForce(key, buildPatternModel(st));
    }
  });

  it('matches brute-force tiling across 25 random twisted multi-orbifold states', () => {
    let seed = 20261127;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const key of ['222222', '333333', '22222', '223344', '99999']) {
      const k = normalizeFamilyKey(key), fam = FAMILIES[k], d = fam.defaults, m = d.L.length;
      for (let t = 0; t < 5; t++) {
        const Ls = d.L.map(() => 0.9 + rnd() * 4.2);
        const tws = d.tw.map(() => rnd() - 0.5);
        const st = multiState(k, { Ls, tws, active: t % m, shown: m });
        assertMatchesBruteForce(`${key} #${t}`, buildPatternModel(st));
      }
    }
  });
});
