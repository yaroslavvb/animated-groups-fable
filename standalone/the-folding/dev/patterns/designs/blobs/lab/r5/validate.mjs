// lab/r5/validate.mjs — the production check of the finished design: src/shapes.js validateShapes (and measureShapes) on
// all 17 groups as src/groups.js has them, and on turned, scaled and shifted copies of some groups that carry no presets
// (as the tests hand them over: only { id, e1, e2, reps, cellArea, domainArea, center }).
//   node lab/r5/validate.mjs [--ids a,b] [--moved o,*x,632,*632] [--measure 1]
import { GROUPS, BY_ID } from '../../../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../../../src/shapes.js';
import fs from 'node:fs';
import { find, meta, STROKES } from '../../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
// --strokes file.json: { id: stroke } that replaces rows of the table for this run (to check a variant before it is set)
if (opt.strokes) Object.assign(STROKES, JSON.parse(fs.readFileSync(opt.strokes, 'utf8')));
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const moved = (opt.moved ?? 'o,*x,632,3*3,*632,22x').split(',').filter(Boolean);

/** The group carried by x -> s R x + t (R a turn by `ang`), with only the fields a test hands over. */
function carry(g, ang, s, t) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const P = ([x, y]) => [s * (c * x - sn * y) + t[0], s * (sn * x + c * y) + t[1]];
  const V = ([x, y]) => [s * (c * x - sn * y), s * (sn * x + c * y)];
  // an element x -> A x + b becomes x -> R A R^-1 x + (s R b + t - R A R^-1 t)
  const reps = g.reps.map((r) => {
    const a = c * r.a - sn * r.c, b = c * r.b - sn * r.d, cc = sn * r.a + c * r.c, d = sn * r.b + c * r.d;           // R A
    const RA = [[a, b], [cc, d]], RT = [[c, sn], [-sn, c]];                                                       // M = R A R^T
    const M = [[RA[0][0] * RT[0][0] + RA[0][1] * RT[1][0], RA[0][0] * RT[0][1] + RA[0][1] * RT[1][1]],
      [RA[1][0] * RT[0][0] + RA[1][1] * RT[1][0], RA[1][0] * RT[0][1] + RA[1][1] * RT[1][1]]];
    const bb = V([r.tx, r.ty]);
    const tx = bb[0] + t[0] - (M[0][0] * t[0] + M[0][1] * t[1]), ty = bb[1] + t[1] - (M[1][0] * t[0] + M[1][1] * t[1]);
    return { a: M[0][0], b: M[0][1], c: M[1][0], d: M[1][1], tx, ty };
  });
  return { id: g.id, e1: V(g.e1), e2: V(g.e2), reps, cellArea: g.cellArea * s * s, domainArea: g.domainArea * s * s, center: P(g.center) };
}

let bad = 0;
const run = (label, g) => {
  const t0 = performance.now(), res = find(g), ms = performance.now() - t0;
  let line = `${label.padEnd(22)} ${ms.toFixed(0).padStart(4)} ms ${String(res.shapes.reduce((n, s) => n + s.pts.length, 0)).padStart(4)} pts`;
  try {
    const pr = makeShapePrint(g, { key: meta.key, name: meta.label, shapes: res.shapes, info: res.info });
    const v = validateShapes(pr);
    line += `  ${v.ok ? 'ok' : 'PROBLEMS: ' + v.problems.join('; ')}  gap ${(v.gap ?? NaN).toFixed(3)}  stab ${v.stabilizer}`;
    if (!v.ok) bad++;
    if (opt.measure === '1') {
      const m = measureShapes(pr, { per: 40 });
      line += `  dark ${m.coverage.toFixed(3)} bare ${m.emptyDisc.toFixed(3)} solid ${m.darkDisc.toFixed(3)} overlap ${m.overlap}`;
    }
  } catch (e) { bad++; line += '  THROWS ' + e.message; }
  console.log(line);
};
for (const id of ids) run(id, BY_ID[id]);
const knobs = [[0.7, 1.9, [3.1, -2.4]], [-2.2, 0.37, [-0.4, 5.5]]];
for (const id of moved) for (const [ang, s, t] of knobs) run(`${id} moved ${ang}/${s}`, carry(BY_ID[id], ang, s, t));
console.log(bad ? `${bad} BAD` : 'all ok');
