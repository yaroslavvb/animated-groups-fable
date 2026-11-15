// dev/ad-rows.mjs — print candidates as SPEC rows (JS object literals) to paste into design.js.
//   node ad-rows.mjs '<key>@<cand prefix>' ...
import { CANDS } from './ad-cands.mjs';

const r4 = (v) => (typeof v === 'number' ? +v.toFixed(4) : Array.isArray(v) ? v.map(r4) : v);
for (const it of process.argv.slice(2)) {
  const [key, name] = it.split('@');
  const id = key.includes('#') ? key.split('#')[0] : key.replace(/[a-z]+$/, '');
  const [n, spec] = CANDS[key]().find(([nm]) => nm.startsWith(name));
  const s = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, r4(v)]));
  console.log(`  '${id}': ${JSON.stringify(s).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')},   // ${n}`);
}
