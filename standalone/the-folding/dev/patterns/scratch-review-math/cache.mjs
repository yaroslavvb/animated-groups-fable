// cache.mjs — bakeShapes' cache and printFor's (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/cache.mjs
import { makeShapePrint, bakeShapes, BAKE_KEEP } from '../../../src/shapes.js';
import { registerPattern, printFor, printUniforms } from '../../../src/pattern.js';
import { GROUPS, BY_ID, commaAt, roomAt } from './lib.mjs';

const say = (ok, what) => console.log(ok ? 'ok  ' : 'BAD ', what);
const motif = (g) => { const c = [g.center[0] + 0.137 * g.e1[0] + 0.21 * g.e2[0], g.center[1] + 0.137 * g.e1[1] + 0.21 * g.e2[1]]; return [{ pts: commaAt(c, 0.3 * roomAt(g, c[0], c[1]), 0.5) }]; };
const prints = GROUPS.slice(0, BAKE_KEEP + 3).map((g) => makeShapePrint(g, { key: 'k', shapes: motif(g) }));
const S = 128;
const first = prints.map((P) => bakeShapes(P, S));
say(first.every((T, i) => bakeShapes(prints[i], S) !== T) === false, 'the last BAKE_KEEP are still the same objects? (mixed: see below)');
// the 6 asked last are kept: prints[3..8]; prints[0..2] were dropped
const kept = prints.map((P, i) => bakeShapes(P, S) === first[i]);
console.log('     kept after asking 9 in a row and then again in order:', kept.map((k) => (k ? 'Y' : 'n')).join(''));
// after eviction, a re-bake is equal byte for byte and has equal fields
const P0 = prints[0];
for (let i = 1; i <= BAKE_KEEP; i++) bakeShapes(prints[i], S);
const again = bakeShapes(P0, S);
say(again !== first[0], 'evicted print baked anew: a new object (the renderer re-uploads)');
say(again.data.length === first[0].data.length && again.data.every((v, i) => v === first[0].data[i]), 're-bake byte-equal');
say(JSON.stringify([again.size, again.range, again.origin, again.e1, again.e2, again.pitch]) === JSON.stringify([first[0].size, first[0].range, first[0].origin, first[0].e1, first[0].e2, first[0].pitch]), 're-bake fields equal');
say(Object.isFrozen(again) && Object.isFrozen(again.origin), 'frozen');
// two sizes of one print are two entries
const a = bakeShapes(P0, 64), b = bakeShapes(P0, 128);
say(a !== b && a.size === 64 && b.size === 128 && bakeShapes(P0, 64) === a, 'two sizes: two textures, each kept');
// two prints with the same key in two groups: two textures
const Pa = makeShapePrint(BY_ID['442'], { key: 'same', shapes: motif(BY_ID['442']) }), Pb = makeShapePrint(BY_ID['*442'], { key: 'same', shapes: motif(BY_ID['442']) });
say(bakeShapes(Pa, 64) !== bakeShapes(Pb, 64), 'same key, two groups: two textures');
// equal prints made twice (two objects, same motif, same group): two entries (cache is by object, not by content)
const Pc = makeShapePrint(BY_ID['442'], { key: 'same', shapes: motif(BY_ID['442']) });
say(bakeShapes(Pc, 64) !== bakeShapes(Pa, 64), 'an equal print made again is another texture (by object, not content)');
// printFor: the same object every time; printUniforms: the same tex every time
registerPattern({ key: 'revcomma' }, (g) => ({ shapes: motif(g) }));
const g = BY_ID['632'], p1 = printFor(g, 'revcomma'), p2 = printFor(g, 'REVCOMMA'), p3 = printFor(g, ' revcomma ');
say(p1 === p2 && p2 === p3, 'printFor: one object for any spelling of the key');
const u1 = printUniforms(p1), u2 = printUniforms(p1);
say(u1.tex === u2.tex && u1.tex.size === 1024, 'printUniforms: the same 1024 texture at every call');
// a burst of 7 other prints between two frames (e.g. a sheet of all groups): the first one comes back as a new texture
for (const h of GROUPS.slice(0, 7)) printUniforms(printFor(h, 'revcomma'));
say(printUniforms(p1).tex !== u1.tex, 'after 7 other prints the texture of the first is baked again (expected by BAKE_KEEP = 6)');
