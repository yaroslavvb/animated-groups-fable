// src/patterns/index.js — the SHAPE patterns built into the page (14 Nov 2026, the pattern round; src/shapes.js):
// each module exports meta { key, label, hint } and find(group) -> { shapes, info }, the motif whose orbit under the
// group is the print. src/pattern.js makes them patterns of the selector (PATTERNS), in this order, with the
// checkerboard and the rings between the three new ones and the comma:
//   Paisley, Soft commas, Tomoe, Checkerboard, Rings, Comma.
//
//   paisley.js   a big comma and smaller ones nestled round it        (the page's default: DEFAULT_PATTERN)
//   soft.js      one big soft comma with an eye per tile, half the paper dark   (designed as dev/patterns/designs/blobs)
//   tomoe.js     every tile split by an S into a dark and a light comma
//   comma.js     the page's own comma (src/motif.js), on the paper since 14 Nov 2026
// The first three are the designs of dev/patterns/designs/ as they shipped, unchanged but for their imports
// (test/patterns-shipped.test.js); notes/patterns-round.md tells how they were chosen.

import * as paisley from './paisley.js';
import * as soft from './soft.js';
import * as tomoe from './tomoe.js';
import * as comma from './comma.js';

/** [{ meta: { key, label, hint }, find }]: Paisley, Soft commas, Tomoe, then the Comma. Frozen. */
export const SHAPE_PATTERNS = Object.freeze([paisley, soft, tomoe, comma].map((m) => Object.freeze({
  meta: Object.freeze({ key: m.meta.key, label: m.meta.label, hint: m.meta.hint }), find: m.find,
})));
