// scratch: run find() on every group (and on a turned, scaled, shifted copy without presets), print what comes out.
//   node dev/patterns/designs/feet/scratch/run.mjs [--measure 28] [--ids o,2222] [--moved 1]
import { GROUPS } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const f = (v, d = 3) => (v == null ? '   – ' : v.toFixed(d));

/** The group carried by the similarity x -> s R x + t, as the tests hand it over: no presets. */
export function moved(g, ang = 0.7, s = 1.7, t = [3.1, -2.2]) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const L = (v) => [s * (c * v[0] - sn * v[1]), s * (sn * v[0] + c * v[1])];
  const P = (v) => { const w = L(v); return [w[0] + t[0], w[1] + t[1]]; };
  const reps = g.reps.map((r) => {
    // g' = S g S^-1: linear part R A R^-1 (A R^-1 first), translation from g'(S(0)) = S(g(0))
    const m00 = r.a * c - r.b * sn, m01 = r.a * sn + r.b * c, m10 = r.c * c - r.d * sn, m11 = r.c * sn + r.d * c;
    const a = c * m00 - sn * m10, b = c * m01 - sn * m11, cc = sn * m00 + c * m10, d = sn * m01 + c * m11;
    // translation: g'(S(0)) = S(g(0))
    const s0 = P([0, 0]), sg = P([r.tx, r.ty]);
    return { a, b, c: cc, d, tx: sg[0] - (a * s0[0] + b * s0[1]), ty: sg[1] - (cc * s0[0] + d * s0[1]) };
  });
  const e1 = L(g.e1), e2 = L(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: P(g.center) };
}

let worst = 0;
for (const g0 of GROUPS) {
  if (!ids.includes(g0.id)) continue;
  for (const g of opt.moved ? [g0, moved(g0)] : [g0]) {
    const tag = g === g0 ? g.id.padEnd(6) : (g.id + "'").padEnd(6);
    try {
      const t0 = performance.now();
      const res = find(g);
      const ms = performance.now() - t0;
      worst = Math.max(worst, ms);
      const N = normalize(res.shapes);
      const ts = Math.sqrt(g.domainArea);
      let line = `${tag} ${String(res.shapes.length).padStart(2)} polys ${String(N.verts).padStart(4)} pts ${f(ms, 1).padStart(6)} ms  cover ${f(res.info.coverage)}`;
      for (const ft of res.info.feet) line += `  | ${ft.left ? 'L' : 'R'} d ${f(ft.delta)} toe ${f(ft.toe)}..${f(ft.little)} gap ${f(ft.gap)} W ${f(ft.width)} notch ${f(ft.notch)} heelR ${f(ft.heelR)}`;
      if (opt.measure) { const M = measure(g, N, { per: +opt.measure }); line += `  || dark ${f(M.coverage)} bare ${f(M.emptyDisc)} solid ${f(M.darkDisc)} overlap ${f(M.overlap)}`; }
      if (res.info.feet.length !== res.info.frames.length) line += '  !! A FOOT IS MISSING';
      console.log(line);
      if (opt.frames) console.log('       frames', JSON.stringify(res.info.frames.map((fr) => ({ toe: fr.toe, heel: fr.heel, poly: fr.poly.map((p) => p.map((v) => +(v / ts).toFixed(3))) }))));
    } catch (e) { console.log(`${tag} ERROR ${e && e.stack || e}`); }
  }
}
console.log('slowest', worst.toFixed(1), 'ms');
