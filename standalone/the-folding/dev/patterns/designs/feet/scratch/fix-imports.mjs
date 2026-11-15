// scratch: the design no longer exports findWith; the scratch scripts call find instead
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
for (const f of ['dbg4.mjs', 'dbg2.mjs', 'dbg.mjs', 'svg.mjs', 'plane.mjs']) {
  const p = path.join(here, f);
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace("import { findWith } from '../design.js';", "import { find } from '../design.js';\nconst findWith = (g) => find(g);");
  fs.writeFileSync(p, s);
  console.log('patched', f);
}
