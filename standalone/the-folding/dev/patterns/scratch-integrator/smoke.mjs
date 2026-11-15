// dev/patterns/scratch-integrator/smoke.mjs — a quick look at the built-in shape patterns in node: printFor of every group
// (time, kind, vertices), the shipped copies against the design files (the same motif), the comma's thin parts.
//   node dev/patterns/scratch-integrator/smoke.mjs [keys]
import { GROUPS } from '../../../src/groups.js';
import { printFor, PATTERNS, DEFAULT_PATTERN, resolvePattern } from '../../../src/pattern.js';
import { thinParts, texelPitch, validateShapes } from '../../../src/shapes.js';

const keys = (process.argv[2] || 'paisley,soft,tomoe,comma').split(',');
console.log('PATTERNS', PATTERNS.map((p) => `${p.key} (${p.label})`).join(', '), '| default', DEFAULT_PATTERN, '| blobs ->', resolvePattern('blobs'));
const dev = { paisley: '../designs/paisley/design.js', soft: '../designs/blobs/design.js', tomoe: '../designs/tomoe/design.js' };
const src = { paisley: '../../../src/patterns/paisley.js', soft: '../../../src/patterns/soft.js', tomoe: '../../../src/patterns/tomoe.js' };
for (const key of keys) {
  let worst = 0, total = 0;
  const rows = [];
  const D = dev[key] ? await import(dev[key]) : null, S = src[key] ? await import(src[key]) : null;
  let same = 0;
  for (const g of GROUPS) {
    const t0 = performance.now(), P = printFor(g, key), ms = performance.now() - t0;
    worst = Math.max(worst, ms); total += ms;
    if (!P) { rows.push(`${g.id}: NO PRINT`); continue; }
    let extra = '';
    if (key === 'comma') {
      const pitch = texelPitch(g), thin = thinParts(P, 1.5 * pitch), v = validateShapes(P);
      extra = ` thin ${thin.length ? (thin[0].length / pitch).toFixed(1) + ' tx (w ' + (thin[0].width / pitch).toFixed(2) + ')' : 'none'}  gap ${v.gap.toFixed(3)} ${v.ok ? 'ok' : v.problems[0]}`;
    }
    if (D && S) { if (JSON.stringify(D.find(g)) === JSON.stringify(S.find(g))) same++; else extra += ' DIFFERENT MOTIF'; }
    rows.push(`${g.id.padEnd(6)} ${ms.toFixed(1).padStart(6)} ms  ${P.kind} ${P.name} ${P.verts} verts${extra}`);
  }
  console.log(`== ${key}: worst ${worst.toFixed(1)} ms, all 17 ${total.toFixed(0)} ms` + (D ? `; the same motif as the design file in ${same} of 17` : ''));
  for (const r of rows) console.log('  ' + r);
}
