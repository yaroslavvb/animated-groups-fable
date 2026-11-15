// scratch: the toes' gaps while the ovals are fitted
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
globalThis.__feetDebug = true;
for (const id of (process.argv[2] || '442').split(',')) { console.log('==', id); find(BY_ID[id]); }
