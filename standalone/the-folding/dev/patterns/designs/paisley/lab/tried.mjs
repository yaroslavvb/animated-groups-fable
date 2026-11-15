// lab/tried.mjs — for each group: the big commas tried and what their cloths came to (find()'s own numbers).
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
for (const id of ids) {
  const r = find(BY_ID[id]), I = r.info;
  console.log(id.padEnd(6), `cover ${I.cover} bare ${I.bare} marks ${I.marks} long ${JSON.stringify(I.long)} e ${JSON.stringify(I.e)} stop ${I.stop}`);
  for (const t of I.tried) console.log('        tried e', String(t.e).padEnd(6), 'flaw', String(t.flaw).padEnd(6), 'bare', String(t.bare).padEnd(6), 'cover', String(t.cover).padEnd(6), 'marks', t.marks, 'tiny', t.tiny);
}
