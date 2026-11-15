// node dev/kitm.mjs <id> ['[{knobs}, {knobs}, ...]'] [--per 56]  — kit.measure (the sheet's own numbers) of the design,
// or of variants (knob overrides through findWith), plus the head radii. One group, a few variants: a few seconds.
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { findWith } from '../design.js';
import { makeShapePrint, validateShapes, thinParts } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const g = BY_ID[pos[0]], vars = pos[1] ? JSON.parse(pos[1]) : [null];
for (const v of vars) {
  const t0 = Date.now(), res = findWith(g, v), m = measure(g, normalize(res.shapes), { per: +opt.per || 56 });
  const P = makeShapePrint(g, { key: 'x', shapes: res.shapes }), sz = Math.sqrt(g.domainArea), V = validateShapes(P), thin = thinParts(P, 0.03 * sz).filter((r) => r.length > 0.06 * sz).length;
  console.log(`${pos[0]} ${V.ok ? 'valid' : 'INVALID: ' + V.problems[0]} thin ${thin} dark ${m.coverage} bare ${m.emptyDisc} solid ${m.darkDisc} overlap ${m.overlap} verts ${m.verts} rB ${res.info.rB.toFixed(3)} rA ${res.info.rA.toFixed(3)} (${Date.now() - t0} ms) ${v ? JSON.stringify(v) : '(as is)'}`);
}
