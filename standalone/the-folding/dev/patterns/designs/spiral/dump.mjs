// designs/spiral/dump.mjs — some vertices of a motif's outline, in tile sizes. node dump.mjs '<id>' <from> <to> [design.js]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BY_ID } from '../../../../src/groups.js';
const id = process.argv[2], a = +process.argv[3], b = +process.argv[4], file = process.argv[5] || 'design.js';
const mod = await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), file)).href);
const g = BY_ID[id], ts = Math.sqrt(g.domainArea), p = mod.find(g).shapes[0].pts;
for (let i = a; i <= b; i++) console.log(i, (p[i][0] / ts).toFixed(4), (p[i][1] / ts).toFixed(4));
