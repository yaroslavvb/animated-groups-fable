// dev/hand.mjs — the hooks drawn by hand for the groups with mirrors, in world coordinates of the groups of
// src/groups.js (NOTES.md has the reasoning). node hand.mjs [ids] [per]  ->  out/H.json, and the entries of SPEC in design.js.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hook, jhook } from './seeds.mjs';
import { tick442, tick632, tick333, j42 } from './variants.mjs';

const H = {};
// *442: a tick. Bend in the 45-degree corner (0,0), the long stroke along the hypotenuse into the other 45-degree corner,
// the short one along the leg to the right angle. Spines 0.09 tile sizes inside the mirrors.
H['*442'] = hook(...tick442(0.09, 0.29, 0.15));
// *632: a tick. Bend in the 60-degree corner, the long stroke along the hypotenuse into the 30-degree corner (the
// 6-fold point), the short one along the short leg to the right angle.
H['*632'] = hook(...tick632(0.08, 0.3, 0.12));
// *333: a tick and a dot. All three corners are alike, so the short stroke stops half way and a dot sits in the third corner.
H['*333'] = hook(...tick333(0.09, 0.3, 0.14, undefined, 0.3, 0.25));
// *2222: a J and a dot, as in **: the long stroke along one long side, round the end, a short way back; the dot beyond.
H['*2222'] = jhook('*2222', [0.5815, 0.114], [0.114, 0.114], [0.114, 0.386], [0.308, 0.386], { r: 0.14, gap: 0.12, fil: 0.12, dr: 0.15, dg: 0.13 });
// 4*2: a J. The long stroke along the mirror from one corner of the chamber, round the end before the next corner, a
// short way back: four of them make two square rings round the cone point, no stroke points at it.
H['4*2'] = jhook(...j42(0.2, 0.68, 0.085, 1.4, 1.04, 0.14, 0.12, 0.14));
// 2*22: a J. The long stroke along a long mirror from a corner, round the end along the short mirror, back along the
// chamber's middle line toward the cone point; its half-turned partner does the same from the opposite corner.
H['2*22'] = jhook('2*22', [0.0416, 0.098], [0.702, 0.098], [0.702, 0.3], [0.529, 0.3], { r: 0.14, gap: 0.12, fil: 0.1 });
// 3*3: a tick. The long stroke along the mirror into a corner of the chamber, the short one leaves its other end
// parallel to the next mirror and stops beside the cone point: three of them turn about it.
H['3*3'] = hook('3*3', [0.919, 0.076], [0.307, 0.076], [0.307 + 0.56 * 0.3799 * 0.5, 0.076 + 0.56 * 0.3799 * 0.866], { r: 0.14, gap: 0.12, fil: 0.08 });

const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : Object.keys(H);
const out = {}; for (const id of ids) out[id] = [H[id]];
const here = fileURLToPath(new URL('.', import.meta.url));
fs.writeFileSync(here + 'out/H.json', JSON.stringify(out, null, 1));
execFileSync(process.execPath, [here + 'mkspec.mjs', ...ids.map((id) => 'H:' + id + ':0')], { stdio: 'ignore' });
console.log(execFileSync(process.execPath, [here + 'check.mjs', ids.join(','), process.argv[3] || '24']).toString());
