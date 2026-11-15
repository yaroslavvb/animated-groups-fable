// dev/variant.js — design.js with some knobs replaced, for proto.mjs and app-sheet.mjs (--design designs/tomoe/dev/variant.js).
// Edit OVER per experiment; the shipped design is design.js alone.
import { findWith } from '../design.js';

export const meta = { key: 'tomoev', label: 'Tomoe var', hint: 'design.js with knobs replaced (dev/variant.js)' };
const OVER = {
  '3*3': { bows: [[0.5, 0]], dents: [[0.145, 0.998, 0.134]], rA: 0.276, curl: 0.308, eyeB: 0.399, dA: 0.168, gB: 0.134, gA: 0.127, rB: 0.273 },
  '4*2': { bows: [[0.5, 0]], dents: [[0.069, 0.88, 0.16]], rB: 0.284, gB: 0.18, dA: 0.285, dB: 0.214, rA: 0.254, curl: 0.334 },
  '*333': { bows: [[0.5, 0], [0.5, 0]], dents: [[0.12, 0.88, 0.202], [0.12, 0.88, 0.192]], dB: 0.453, rA: 0.259, eyeB: 0.424, gB: 0.139, rB: 0.27, eyeA: 0.377 },
  '*442': { bows: [[0.5, 0], [0.5, 0]], dents: [[0.1, 0.8, 0.16], [0, 0.9, 0.155]], eyeB: 0.486, gB: 0.111, eyeA: 0.406 },
  '*632': { bows: [[0.5, 0], [0.5, 0]], dents: [[0.2, 0.8, 0.152], [0.172, 0.958, 0.122]], rA: 0.276, gA: 0.102, dA: 0.168 },
};
export function find(group) { const k = OVER[group.id]; return findWith(group, k ? { ...k } : null); }
