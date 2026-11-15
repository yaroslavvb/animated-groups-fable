// lab/patch-header.mjs — one-off: the header and the knob comments describe the final design (no change of behaviour).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`// THE COMMA. A tapered stroke (the union of discs along a spine: a round head, a tail that thins to a point) whose tail
// winds around the head of a PARTNER: the copy of the comma under one element g of the group (a half-turn gives the
// yin-yang pair, a rotation of order n the tomoe, a translation or a glide a chain of waves). So the bay of every comma
// holds a neighbour's head, which is what keeps a comma a comma when it swells. In a kaleidoscope no copy can reach
// into a bay (every neighbour is a mirror image across a wall of the chamber), so the chamber holds a pair of commas
// that nest in each other, a big one and a smaller one.
//
// THE SWELL. A point is dark when it is clearly nearer to its own comma than to any other:
//     D_own(x) < LAMBDA * D_other(x) - half a channel        (D: distance counted in the comma's local thickness)
// LAMBDA is found per group for the dark share, and raised where a bare place wider than bareMax would be left.
//`, `// THE COMMA. A tapered stroke (the union of discs along a spine: a round head, a tail that thins to a point) whose tail
// winds round the head of a PARTNER: the copy of the comma under one element g of the group (a half-turn gives the
// yin-yang pair, a rotation of order n a tomoe, a glide a chain). So the bay of every comma holds a neighbour's head,
// which is what keeps a comma a comma when it swells (seatSingle). Where no copy can reach into a bay — a kaleidoscope's
// chamber, whose neighbours are mirror images; o and **, which have only translations and mirrors (a translate's body
// leaves its head the way this one's does) — the tile holds a PAIR of commas that nest in each other, a big one and one
// at beta of its size (seatPair). A strip too thin for either (*x) holds one long comma.
//
// THE SWELL. A point is dark when it is clearly nearer to its own comma than to any other:
//     D_own(x) < LAMBDA * D_other(x) - half a channel        (D: distance counted in the comma's local thickness)
// LAMBDA is found per group for the dark share, and raised where a bare place wider than bareMax would be left. In a
// chamber (and in a tile with a side on a mirror, where it leaves a clearly smaller bare place) the commas instead fill
// their rooms in plain distance with LAMBDA = 1, up to channels of one width found for the dark share: a corner of a
// chamber is as near a mirror image as the comma, so LAMBDA < 1 would leave it bare.
//`);
rep(`  // kaleidoscopes: two commas in the chamber, each winding around the other's head`, `  // a pair (a chamber, o, **): two commas in the tile, each winding round the other's head`);
rep(`  pairGap: 0.08,       // the gap of the two commas of a chamber where they are seated`, `  pairGap: 0.08,       // the gap of the two commas of a pair where they are seated`);
rep(`  mirrorMargin: 1,     // ... and so do the commas of a tile with a side on a mirror, where LAMBDA leaves a bare place ...`,
    `  mirrorMargin: 1,     // the commas of a tile with a side on a mirror fill their rooms too where LAMBDA leaves a bare place ...`);
rep(`  chamberMargin: 1,    // a chamber's pair swells by one channel width (found for the dark share) instead of LAMBDA`,
    `  chamberMargin: 1,    // a chamber's pair fills its room up to one channel width (found for the dark share) instead of LAMBDA`);
fs.writeFileSync(file, s);
console.log('patched');
