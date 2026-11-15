// r6/extrasym.mjs — does the print have MORE symmetry than its group? Scans isometries x -> L x + v with L one of the
// lattice-compatible linear maps (rotations by k*30 deg, and those composed with a reflection) and v on a grid of
// fractions of the lattice (k/12), against the tone of the print at random points; reports every isometry that keeps the
// tone at (nearly) all points and is NOT an element of the group.
//   node r6/extrasym.mjs [--ids a,b] [--design ../design.js] [--n 160]
import { GROUPS, BY_ID, elementsNear } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import(opt.design ? new URL(opt.design, import.meta.url).href : '../design.js');
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const NPTS = +opt.n || 160;
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const id of ids) {
  const g = BY_ID[id], N = normalize(mod.find(g).shapes);
  const s = Math.sqrt(g.domainArea);
  const pts = [];
  for (let k = 0; k < NPTS; k++) {
    const a = rnd(), b = rnd();
    const x = g.center[0] + (a - 0.5) * g.e1[0] + (b - 0.5) * g.e2[0], y = g.center[1] + (a - 0.5) * g.e1[1] + (b - 0.5) * g.e2[1];
    pts.push([x, y, toneAt(g, N, x, y)]);
  }
  const extra = []; let own = 0;
  for (let k = 0; k < 12; k++) for (const flip of [false, true]) {
    const c = Math.cos((k * Math.PI) / 6), si = Math.sin((k * Math.PI) / 6);
    const L = flip ? [c, si, si, -c] : [c, -si, si, c];
    // does L map the lattice to itself? (else no isometry with this linear part can keep a pattern of this lattice)
    const inLat = (vx, vy) => { const det = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0], u = (vx * g.e2[1] - vy * g.e2[0]) / det, w = (g.e1[0] * vy - g.e1[1] * vx) / det; return Math.abs(u - Math.round(u)) < 1e-6 && Math.abs(w - Math.round(w)) < 1e-6; };
    if (!inLat(L[0] * g.e1[0] + L[1] * g.e1[1], L[2] * g.e1[0] + L[3] * g.e1[1]) || !inLat(L[0] * g.e2[0] + L[1] * g.e2[1], L[2] * g.e2[0] + L[3] * g.e2[1])) continue;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const vx = (i / 12) * g.e1[0] + (j / 12) * g.e2[0], vy = (i / 12) * g.e1[1] + (j / 12) * g.e2[1];
      // the translation part that keeps the group's centre near: v' = v + (centre - L centre)
      const tx = vx + g.center[0] - (L[0] * g.center[0] + L[1] * g.center[1]), ty = vy + g.center[1] - (L[2] * g.center[0] + L[3] * g.center[1]);
      let bad = 0;
      for (const [x, y, t] of pts) {
        if (toneAt(g, N, L[0] * x + L[1] * y + tx, L[2] * x + L[3] * y + ty) !== t) { bad++; if (bad > NPTS * 0.006) break; }
      }
      if (bad > NPTS * 0.006) continue;
      // is it an element of the group? (an element with the same linear part and a translation differing by a lattice vector)
      const inG = elementsNear(g, g.center[0], g.center[1], 4 * s, g.center[0], g.center[1]).some((e) => {
        if (Math.abs(e.a - L[0]) > 1e-6 || Math.abs(e.b - L[1]) > 1e-6 || Math.abs(e.c - L[2]) > 1e-6 || Math.abs(e.d - L[3]) > 1e-6) return false;
        return inLat(e.tx - tx, e.ty - ty);
      });
      if (inG) own++; else extra.push(`${flip ? 'reflection-type' : 'rotation'} ${k * 30}deg v=(${i}/12,${j}/12) mismatch ${bad}/${NPTS}`);
    }
  }
  console.log(`${id.padEnd(6)} ${extra.length ? 'EXTRA: ' + extra.slice(0, 6).join('; ') : `no extra symmetry found (group elements seen: ${own})`}`);
}
