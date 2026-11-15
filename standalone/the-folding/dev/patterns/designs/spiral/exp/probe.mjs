// exp/probe.mjs — the level function of a prototype near the corners of one group's tile.
//   node dev/patterns/designs/spiral/exp/probe.mjs ./curl3.js '*333'
import { BY_ID } from '../../../../../src/groups.js';
import { tilePolygon } from './lib.js';
const mod = await import(new URL(process.argv[2], import.meta.url).href);
const g = BY_ID[process.argv[3] || '*333'], ts = Math.sqrt(g.domainArea);
const D = mod.curlIn(tilePolygon(g), ts, mod.KNOBS, { debug: true });
console.log('T', (D.T / ts).toFixed(3), 'H(u)', D.H.toFixed(3), 'ch(u)', D.ch.toFixed(3), 'tipDir', D.tipDir.toFixed(3), 'squeeze', D.a.toFixed(3));
console.log('corners', D.corners.map((c) => `${c.ang.toFixed(1)}deg @ ${c.dir.toFixed(3)} sigma ${D.sigma(c.dir).toFixed(3)} kap ${D.kapAt(c.dir).toFixed(3)}`).join(' | '));
// along the segment from the rim's centroid to each corner: dark (f < 0) or not
const cx = D.rimP.reduce((s, p) => s + p[0], 0) / D.rimP.length, cy = D.rimP.reduce((s, p) => s + p[1], 0) / D.rimP.length;
for (const p of D.rimP) {
  let line = '';
  for (let i = 0; i <= 40; i++) { const t = i / 40, x = cx + t * (p[0] - cx), y = cy + t * (p[1] - cy); line += D.f(x, y) < 0 ? '#' : '.'; }
  console.log('to corner', p.map((v) => v.toFixed(3)).join(','), line);
}
