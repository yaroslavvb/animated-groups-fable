// lab/patch-choose.mjs — one-off: in a tile with a side on a mirror, the margin swell is taken only where the LAMBDA
// swell leaves a bare place wider than bareMax and the margin swell leaves a clearly smaller one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`  const margin = (pair && chamber && K.chamberMargin) || (K.mirrorMargin && !chamber && isChamber(group, T, true));
  const W = margin ? swell(group, sites, { ...K, reach: 3 }, { margin: true, cover: T }) : swell(group, sites, K);`,
`  // the swell: by LAMBDA; in a chamber by one channel width (a corner of a chamber is as near a mirror image as the comma:
  // LAMBDA < 1 leaves it bare); in a tile with a side on a mirror by the channel too, where that leaves a clearly
  // smaller bare place than LAMBDA does
  let W;
  if (pair && chamber && K.chamberMargin) W = swell(group, sites, { ...K, reach: 3 }, { margin: true, cover: T });
  else {
    W = swell(group, sites, K);
    if (K.mirrorMargin && !chamber && W.bare > K.bareMax * size && isChamber(group, T, true)) {
      const W2 = swell(group, sites, { ...K, reach: 3 }, { margin: true, cover: T });
      if (W2.bare < W.bare - K.marginGain * size) W = W2;
    }
  }`);
rep(`  mirrorMargin: 1,     // ... and so do the commas of a tile with a side on a mirror (its corners there are mirror corners)`,
    `  mirrorMargin: 1,     // ... and so do the commas of a tile with a side on a mirror, where LAMBDA leaves a bare place ...
  marginGain: 0.05,    // ... and this swell leaves one smaller by this much`);
fs.writeFileSync(file, s);
console.log('patched');
