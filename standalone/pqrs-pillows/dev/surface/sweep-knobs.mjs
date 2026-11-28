#!/usr/bin/env node
// sweep-knobs.mjs: the baseline's knobs against the shared metrics (3333 at the engine's default, Twist 0.125).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../../src/pillow.js';
import { createSurface } from '../../src/solver.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const METRICS = '/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/common/metrics.mjs';
const variants = JSON.parse(process.argv[2] || '[{}]');
const orders = [3, 3, 3, 3], L = 2.633916, tw = 0.125, g = P.suggestGrid(orders, L, 2600);
for (const v of variants) {
  const surf = createSurface({ nTheta: g.nTheta, nS: g.nS, ...v });
  surf.set(orders, L, tw);
  const f = path.join(HERE, 'knob.result.json');
  fs.writeFileSync(f, JSON.stringify(surf.result()));
  const out = execFileSync('node', [METRICS, f]).toString().trim();
  console.log(JSON.stringify(v), '\n   ', out.replace(/^.*?: /, ''));
}
