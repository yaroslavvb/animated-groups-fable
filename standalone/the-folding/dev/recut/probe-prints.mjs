// dev/recut/probe-prints.mjs — the print each group gets: node dev/recut/probe-prints.mjs
import { GROUPS } from '../../src/groups.js';
import { printFor, invariantUnder } from '../../src/pattern.js';
for (const g of GROUPS) {
  const size = Math.sqrt(g.domainArea);
  const t0 = performance.now();
  const c = printFor(g, 'checker'), r = printFor(g, 'rings');
  const ms = performance.now() - t0;
  // share of dark over a lattice cell
  const share = (P) => { if (!P) return NaN; let d = 0, n = 0; for (let i = 0; i < 300; i++) for (let j = 0; j < 300; j++) { const s = (i + 0.37) / 300, t = (j + 0.61) / 300; d += P.tone(s * g.e1[0] + t * g.e2[0], s * g.e1[1] + t * g.e2[1]); n++; } return d / n; };
  const f = (P) => P ? `${P.name} cell ${(P.cell / size).toFixed(3)} size, dark ${share(P).toFixed(3)}, inv ${invariantUnder(g, P, 400, 99)} ${JSON.stringify(P.info)}` : 'NONE';
  console.log(`${g.id.padEnd(6)} checker: ${f(c)}\n       rings:   ${f(r)}   (${ms.toFixed(0)} ms)`);
}
