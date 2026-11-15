// scratch (review-correct): the stack of comma.find on a moved copy of 333 (comma-moved.mjs: every one threw)
import { BY_ID } from '../../../src/groups.js';
import { find } from '../../../src/patterns/comma.js';
const g = BY_ID['333'];
const h = { id: g.id, e1: g.e1.slice(), e2: g.e2.slice(), reps: g.reps.map((r) => ({ ...r })), cellArea: g.cellArea, domainArea: g.domainArea, center: g.center.slice(), viewHalf: g.viewHalf };
try { find(h); console.log('the unmoved copy without presets: fine'); } catch (e) { console.log(e.stack.split('\n').slice(0, 6).join('\n')); }
const h2 = { ...h, presets: g.presets };
try { find(h2); console.log('with presets: fine'); } catch (e) { console.log(e.stack.split('\n').slice(0, 6).join('\n')); }
