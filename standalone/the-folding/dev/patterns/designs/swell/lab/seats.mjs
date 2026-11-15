// lab/seats.mjs — the seat of every group, as numbers:  node seats.mjs [key=value,...]
import { GROUPS } from '../../../../../src/groups.js';
import { KNOBS, seatTile, seatStroke } from '../design.js';
if (process.argv[2]) for (const kv of process.argv[2].split(',')) { const [k, v] = kv.split('='); KNOBS[k] = v.includes(';') ? v.split(';').map(Number) : Number.isNaN(+v) ? v : +v; }
for (const g of GROUPS) {
  const t0 = performance.now(), T = seatTile(g), u = Math.sqrt(g.domainArea);
  let st; try { st = seatStroke(g, T); } catch (e) { console.log(g.id.padEnd(6), 'ERROR', e.message); continue; }
  console.log(g.id.padEnd(6), 'head', (st.r0 / u).toFixed(3), 'len', (st.len / u).toFixed(2), 'turn', st.turn.toFixed(2), 'hook', st.hook, 'taper', st.taper, 'chin', st.chin, 'hand', st.hand.toFixed(2), 'hollow', st.hollow.toFixed(2), 'bayA', st.bayA.toFixed(3), 'share', st.share.toFixed(3), 'score', st.score.toFixed(3), (performance.now() - t0).toFixed(0) + 'ms');
}
