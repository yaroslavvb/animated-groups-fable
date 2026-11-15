// scratch: the kit's overlap is blind when the motif's BOX is centred on a rotation centre and the motif has not that symmetry.
// A triangle whose box is centred on the 2-fold centre (0, 0) of 2222: its half-turned copy lies across it.
import { BY_ID } from '../../../src/groups.js';
import { normalize, measure, stabilizerOrder, windingAt } from '../kit.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../src/shapes.js';
const g = BY_ID['2222'], a = 0.3, b = 0.2;
const shapes = [{ pts: [[-a, -b], [a, -b], [0.3 * a, b]] }];
const N = normalize(shapes), P = makeShapePrint(g, { shapes }), V = validateShapes(P);
const K = measure(g, N, { per: 40 }), M = measureShapes(P, { per: 40 });
console.log('kit:       stabilizerOrder', stabilizerOrder(g, N), ' W at (0.05, -0.02):', windingAt(g, N, 0.05, -0.02), ' measure.overlap', K.overlap, ' coverage', K.coverage);
console.log('shapes.js: stabilizer', V.stabilizer, ' W there:', P.winding(0.05, -0.02), ' measureShapes.overlap', M.overlap, ' coverage', M.coverage, ' coverageExact', M.coverageExact);
console.log('validateShapes:', V.problems.join(' | '));
