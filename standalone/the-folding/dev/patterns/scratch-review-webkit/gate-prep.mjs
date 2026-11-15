// dev/patterns/scratch-review-webkit/gate-prep.mjs — the files dev/recut/webkit-layout.sh copies to the M5, made here
// into gate/ (the reviewed build, the layout checks, the runner, cases.json), for wk-bg.sh gate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from '../../../src/groups.js';
import { groupFeatures } from '../../../src/app.js';

const here = path.dirname(fileURLToPath(import.meta.url)), W = path.resolve(here, '../../..'), gate = path.join(here, 'gate');
fs.mkdirSync(gate, { recursive: true });
fs.writeFileSync(path.join(gate, 'cases.json'), JSON.stringify(GROUPS.map((g) => ({ id: g.id, features: groupFeatures(g).join(' ') }))));
fs.copyFileSync(path.join(here, 'stage', 'index.html'), path.join(gate, 'index.html'));
fs.copyFileSync(path.join(W, 'test', 'shell-layout.lib.js'), path.join(gate, 'shell-layout.lib.js'));
fs.copyFileSync(path.join(W, 'dev', 'recut', 'webkit-layout.mjs'), path.join(gate, 'webkit-layout.mjs'));
console.log(fs.readdirSync(gate).map((f) => f + ' ' + fs.statSync(path.join(gate, f)).size).join(', '));
