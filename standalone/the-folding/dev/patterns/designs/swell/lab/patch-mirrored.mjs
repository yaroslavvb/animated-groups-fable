// lab/patch-mirrored.mjs — one-off: the margin swell also where the tile has a side on a mirror (K.mirrorMargin).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`function isChamber(group, T) {
  for (let i = 0; i < T.length; i++) {`, `function isChamber(group, T, any = false) {
  for (let i = 0; i < T.length; i++) {`);
rep(`    if (!contains(group, g, 1e-6)) return false;
  }
  return true;
}`, `    const m = contains(group, g, 1e-6);
    if (any && m) return true;
    if (!any && !m) return false;
  }
  return !any;
}`);
rep(`  const W = pair && chamber && K.chamberMargin ?`, `  const margin = (pair && chamber && K.chamberMargin) || (K.mirrorMargin && !chamber && isChamber(group, T, true));
  const W = margin ?`);
rep(`  chamberMargin: 1,`, `  mirrorMargin: 1,     // ... and so do the commas of a tile with a side on a mirror (its corners there are mirror corners)
  chamberMargin: 1,`);
fs.writeFileSync(file, s);
console.log('patched');
