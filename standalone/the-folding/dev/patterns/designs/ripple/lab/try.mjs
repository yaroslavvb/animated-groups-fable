// quick knob experiments: node lab/try.mjs '<ids>' '<json knobs>' ['<json knobs>' ...]
import { BY_ID } from '../../../../../src/groups.js';
import { normalize } from '../../../kit.js';
import { fastMeasure } from './raster.mjs';
import { find } from '../design.js';
const ids = process.argv[2].split(',');
for (const kn of process.argv.slice(3).length ? process.argv.slice(3) : ['{}']) {
  console.log('knobs', kn);
  for (const id of ids) {
    const g = BY_ID[id], res = find(g, JSON.parse(kn)), m = fastMeasure(g, normalize(res.shapes)), i = res.info;
    console.log(' ', id.padEnd(6), i.seat.padEnd(9), 'r', i.r, 'sig', i.sigma, 'A', i.stretch, '| dark', m.coverage, 'exact', m.exact, 'bare', m.emptyDisc, 'solid', m.darkDisc, 'pts', m.verts, '|', i.corners.filter((c) => c.beyond > 0.19).map((c) => `+${c.beyond}:${c.bands ? c.bands + 'b' : 'swell'}`).join(' '));
  }
}
