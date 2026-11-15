// lab/r2/near2.mjs — the first critic's lab/ad/near.mjs (NEAR-symmetries: for every group, the isometries NOT in the
// group that change the tone at the FEWEST points; unrelated isometries keep about c^2 + (1 - c)^2, one half), with
// knobs: node dev/patterns/designs/paisley/lab/r2/near2.mjs [design, default ../../design.js] [ids] ['{"knob":v}']
import { GROUPS, BY_ID, contains, symmetryElements, classify } from '../../../../../../src/groups.js';
import { normalize, toneAt } from '../../../../kit.js';
const file = process.argv[2] || '../../design.js';
const mod = await import(file), { find } = mod;
if (process.argv[4]) { for (const [k, v] of Object.entries(JSON.parse(process.argv[4]))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(mod.KNOBS[k], v); else mod.KNOBS[k] = v; } if (mod.resetShapes) mod.resetShapes(); }
const ids = process.argv[3] ? process.argv[3].split(',') : GROUPS.map((g) => g.id);
let seed = 11;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let top = 0;
for (const id of ids) {
  const G = BY_ID[id], N = normalize(find(G).shapes);
  const pts = [];
  for (let i = 0; i < 260; i++) { const s = rnd(), t = rnd(); pts.push([G.center[0] + (s - 0.5) * G.e1[0] + (t - 0.5) * G.e2[0], G.center[1] + (s - 0.5) * G.e1[1] + (t - 0.5) * G.e2[1]]); }
  const tones = pts.map((p) => toneAt(G, N, p[0], p[1]));
  const cov = tones.reduce((a, b) => a + b, 0) / tones.length;
  const base = Math.atan2(G.e1[1], G.e1[0]), special = [];
  for (const d of [2, 3, 4, 6]) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) special.push([G.center[0] + ((i / d) - 0.5) * G.e1[0] + ((j / d) - 0.5) * G.e2[0], G.center[1] + ((i / d) - 0.5) * G.e1[1] + ((j / d) - 0.5) * G.e2[1]]);
  const sym = symmetryElements(G, G.center[0], G.center[1], 1.2 * Math.max(Math.hypot(...G.e1), Math.hypot(...G.e2)));
  for (const c of sym.centers) special.push([c.x, c.y]);
  for (const m of sym.mirrors.concat(sym.glides)) special.push([m.px, m.py]);
  const suspects = [];
  for (const d of [2, 3, 4, 6]) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) if (i || j) suspects.push({ a: 1, b: 0, c: 0, d: 1, tx: (i / d) * G.e1[0] + (j / d) * G.e2[0], ty: (i / d) * G.e1[1] + (j / d) * G.e2[1] });
  for (const P of special) {
    for (let k = 1; k < 24; k++) { const th = (k * Math.PI) / 12, a = Math.cos(th), c = Math.sin(th); if (k % 2 && k % 3) continue; suspects.push({ a, b: -c, c, d: a, tx: P[0] - a * P[0] + c * P[1], ty: P[1] - c * P[0] - a * P[1] }); }
    for (let k = 0; k < 12; k++) { const th = base + (k * Math.PI) / 12, ux = Math.cos(th), uy = Math.sin(th), a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1;
      for (const sl of [0, 0.5]) { const l1 = Math.hypot(...G.e1) * sl; suspects.push({ a, b, c: b, d, tx: P[0] - a * P[0] - b * P[1] + l1 * ux, ty: P[1] - b * P[0] - d * P[1] + l1 * uy }); } }
  }
  const best = [];
  let tested = 0;
  for (const h of suspects) {
    if (contains(G, h, 1e-6)) continue;
    tested++;
    let same = 0;
    for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (toneAt(G, N, h.a * p[0] + h.b * p[1] + h.tx, h.c * p[0] + h.d * p[1] + h.ty) === tones[k]) same++; if (k === 59 && same < 46) { same = -1; break; } }
    if (same < 0) continue;
    best.push([same / pts.length, h]);
  }
  best.sort((p, q) => q[0] - p[0]);
  const say = (h) => { const c = classify(h); return c.type === 'rotation' ? `turn of order ${c.order}` : c.type === 'translation' ? 'translation' : c.type; };
  top = Math.max(top, best.length ? best[0][0] : 0);
  console.log(id.padEnd(6), `dark ${cov.toFixed(2)}, chance ${(cov * cov + (1 - cov) * (1 - cov)).toFixed(2)}, suspects ${tested};`, best.length ? 'the best keep ' + best.slice(0, 3).map(([v, h]) => `${(100 * v).toFixed(0)}% (${say(h)})`).join(', ') : 'none keeps 77% of the first 60 points');
}
console.log('the best suspect of all keeps', (100 * top).toFixed(0) + '%');
