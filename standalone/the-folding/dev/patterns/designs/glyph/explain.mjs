// dev/patterns/designs/glyph/explain.mjs — a working tool: the frames the fit tried for some groups, with their scores,
// optionally with knobs changed (JSON, merged into K of design.js).
//   node dev/patterns/designs/glyph/explain.mjs '632,3*3' ['{"italic":0.3,"pick":{"3*3":{"kind":"side"}}}']
import { BY_ID } from '../../../../src/groups.js';
import { find, K } from './design.js';
Object.assign(K, JSON.parse(process.argv[3] || '{}'));
K.debug = true;
for (const id of (process.argv[2] || '632').split(',')) {
  const res = find(BY_ID[id]);
  console.log('==', id, JSON.stringify({ ...res.info, tried: undefined }));
  for (const t of res.info.tried || []) console.log('   ', JSON.stringify(t));
}
