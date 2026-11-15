// node dev/thin.mjs [ids|all] [--design ../design.js] [--vars '<json list of knob overrides>']
// What the app-sheet checks, without a browser: src/shapes.js validateShapes (the production rules) and thinParts at
// 1.5 texels of the 3D texture (pitch = the longer reduced lattice vector / BAKE_SIZE, as bakeShapes has it). Reports
// the rules broken and every thin part longer than 6 texels (dark or light, where, how long, how wide).
import path from 'node:path';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes, thinParts, BAKE_SIZE } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const ids = !pos[0] || pos[0] === 'all' ? GROUPS.map((g) => g.id) : pos[0].split(',');
const mod = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), opt.design || '../design.js'));
const vars = opt.vars ? JSON.parse(opt.vars) : [null];

function reduced(e1, e2) {           // Lagrange-Gauss reduction
  let u = e1.slice(), v = e2.slice();
  for (let it = 0; it < 50; it++) {
    if (Math.hypot(...u) > Math.hypot(...v)) [u, v] = [v, u];
    const m = Math.round((u[0] * v[0] + u[1] * v[1]) / (u[0] * u[0] + u[1] * u[1]));
    if (m === 0) break;
    v = [v[0] - m * u[0], v[1] - m * u[1]];
  }
  return [u, v];
}
for (const id of ids) for (const v of vars) {
  const g = BY_ID[id], s = Math.sqrt(g.domainArea);
  const res = v && mod.findWith ? mod.findWith(g, v) : mod.find(g);
  const P = makeShapePrint(g, { key: 'tomoe', shapes: res.shapes });
  const V = validateShapes(P);
  const [u, w] = reduced(g.e1, g.e2), pitch = Math.max(Math.hypot(...u), Math.hypot(...w)) / BAKE_SIZE;
  const thin = thinParts(P, 1.5 * pitch).filter((r) => r.length / pitch > 6);
  const t = thin.map((r) => `${r.dark ? 'dark' : 'light'} ${(r.length / pitch).toFixed(0)} tx long, ${(r.width / pitch).toFixed(2)} tx wide at (${r.at.map((q) => q.toFixed(3)).join(', ')})`).join('; ');
  console.log(`${id.padEnd(6)} ${V.ok ? 'ok ' : 'BAD'} gap ${(V.gap).toFixed(3)} texel ${(pitch / s).toFixed(4)} ts  ${V.problems.slice(0, 2).join(' | ')}  THIN: ${t || 'none'}${v ? '  ' + JSON.stringify(v) : ''}`);
}
