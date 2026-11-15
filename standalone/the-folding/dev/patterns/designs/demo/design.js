// dev/patterns/designs/demo/design.js — the reference design: the page's own comma (src/motif.js motifFor), as the motif of
// a print. It is what the owner finds too small ("the comma leaves too much empty space"): about 30 % dark, and a bare
// patch about 0.6 tile sizes across. A new design should beat these numbers and still read as a comma.
import { motifFor } from '../../../../src/motif.js';

export const meta = { key: 'demo', label: 'Comma (now)', hint: 'the comma of the page as it is: the baseline to beat' };

export function find(group) {
  const m = motifFor(group);
  const shapes = m.polylines.map((p) => { const pts = []; for (let i = 0; i + 1 < p.length; i += 2) pts.push([p[i], p[i + 1]]); return { pts }; });
  return { shapes, info: { at: m.at, radius: m.radius } };
}
