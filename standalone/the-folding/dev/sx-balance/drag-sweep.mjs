#!/usr/bin/env node
// drag-sweep.mjs — test/roll-drag.test.js "drag 2 (*x)" for TUNE.mobius variants: the worst step and second difference
// (tile sizes per 1/200) over the test's seeds, straight and wavy. Made when *x's strip became 2 : 1 (13 Nov 2026).
//   node dev/sx-balance/drag-sweep.mjs '{"flipEps":0.4}' '{"flipEps":0.5}' '{"flap":0.7}' ...
import { BY_ID } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import { createFold } from '../../src/folds/index.js';

const g = BY_ID['*x'], IDS = ['o', '**', '*x', 'xx'];
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const windowSeeds = (n, salt) => { const rnd = prng(31337 + 101 * IDS.indexOf(g.id) + salt), out = []; for (let k = 0; k < n; k++) out.push([g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf]); return out; };
const FILMED = [[0.85, 0.4], [1.76, 0.17], [1.2, -0.75]];
const anchor = (g.presets[0].anchor || g.presets[0].seed).slice();
for (const arg of process.argv.slice(2).length ? process.argv.slice(2) : ['{}']) {
  const tune = JSON.parse(arg);
  let worstStep = 0, worstBend = 0, at = '';
  const o = [0, 0, 0];
  for (const seed of [...FILMED, ...windowSeeds(10, 2)]) {
    for (const amp of [0, 1]) {
      const domain = buildDomain(g, { seed, metric: g.presets[0].metric, warp: makeWarp(g, amp) });
      const M = buildMesh(g, domain, { density: 20 }), f = createFold(g, domain, M, { anchor, density: false, tune }), size = Math.sqrt(g.domainArea);
      const pts = [];
      for (const b of M.boundary) for (let j = 0; j < b.pts.length; j += 4) pts.push(b.pts[j], b.pts[j + 1]);
      for (let v = 0; v < M.n; v += Math.max(1, Math.floor(M.n / 250))) pts.push(M.xy[2 * v], M.xy[2 * v + 1]);
      const np = pts.length / 2;
      const pos = (t) => { const F = f.at(t), P = new Float64Array(3 * np); for (let i = 0; i < np; i++) { F(pts[2 * i], pts[2 * i + 1], 0, o); P[3 * i] = o[0]; P[3 * i + 1] = o[1]; P[3 * i + 2] = o[2]; } return P; };
      let A = pos(0), B = null;
      for (let k = 1; k <= 200; k++) {
        const C = pos(k / 200);
        let s = 0, b = 0;
        for (let i = 0; i < 3 * np; i += 3) {
          s = Math.max(s, Math.hypot(C[i] - A[i], C[i + 1] - A[i + 1], C[i + 2] - A[i + 2]));
          if (B) b = Math.max(b, Math.hypot(C[i] - 2 * A[i] + B[i], C[i + 1] - 2 * A[i + 1] + B[i + 1], C[i + 2] - 2 * A[i + 2] + B[i + 2]));
        }
        worstStep = Math.max(worstStep, s / size);
        if (b / size > worstBend) { worstBend = b / size; at = `seed (${seed.map((v) => v.toFixed(3))}) amp ${amp} t ${k / 200}`; }
        B = A; A = C;
      }
    }
  }
  console.log(`${arg.padEnd(36)} step ${worstStep.toFixed(4)}  second difference ${worstBend.toFixed(5)}  (${at})`);
}
