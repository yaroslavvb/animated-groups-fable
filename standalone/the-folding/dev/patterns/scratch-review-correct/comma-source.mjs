// scratch (review-correct): where the Comma print's comma comes from in each group (motif.js motifFor: the table, fresh or
// stale, the seam, v1), and every console.warn the four shape prints give for the 17 page groups.
//   node dev/patterns/scratch-review-correct/comma-source.mjs
const warns = [];
const ow = console.warn;
console.warn = (...a) => { warns.push(a.join(' ')); };
const { GROUPS } = await import('../../../src/groups.js');
const { motifFor } = await import('../../../src/motif.js');
const { printFor } = await import('../../../src/pattern.js');
const { find } = await import('../../../src/patterns/comma.js');
for (const g of GROUPS) {
  const m = motifFor(g), r = find(g);
  console.log(`${g.id.padEnd(6)} source ${m.info && m.info.source} fresh ${m.info && m.info.fresh} seam ${m.seam} scale ${m.scale.map((v) => v.toFixed(4))} tip ${r.info.tip.toExponential(3)} (${(r.info.tip / Math.sqrt(g.domainArea)).toFixed(4)} tile)`);
  for (const k of ['paisley', 'soft', 'tomoe', 'comma']) if (!printFor(g, k)) console.log('   NO PRINT', k);
}
console.warn = ow;
console.log(`warnings: ${warns.length}`);
for (const w of warns) console.log('  ' + w);
