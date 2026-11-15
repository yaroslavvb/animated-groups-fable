// scratch: 2222 at a far place: what buildDomain returns for the middle of the brick
import { BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';
import { moved } from './moved.mjs';
const [ang, s, tx, ty] = process.argv.slice(2).map(Number);
const g = moved(BY_ID['2222'], ang, s, [tx, ty]), ts = Math.sqrt(g.domainArea);
const S = symmetryElements(g, g.center[0], g.center[1], 3 * ts);
console.log('centres', S.centers.length, S.centers.map((c) => `(${((c.x - g.center[0]) / ts).toFixed(4)},${((c.y - g.center[1]) / ts).toFixed(4)})`).join(' '));
const c0 = S.centers.find((c) => Math.hypot(c.x - g.center[0], c.y - g.center[1]) < 1e-6 * ts);
console.log('centre at the group centre?', !!c0);
const mid = [g.center[0] + 0.25 * g.e1[0] + 0.25 * g.e2[0], g.center[1] + 0.25 * g.e1[1] + 0.25 * g.e2[1]];
const d = buildDomain(g, { seed: mid });
console.log('seed moved by', Math.hypot(d.seed[0] - mid[0], d.seed[1] - mid[1]) / ts);
console.log('tile', d.poly.length, d.poly.map((p) => `(${((p[0] - mid[0]) / ts).toFixed(4)},${((p[1] - mid[1]) / ts).toFixed(4)})`).join(' '));
console.log('edges', d.edges.map((e) => (e.len / ts).toFixed(4)).join(' '));
