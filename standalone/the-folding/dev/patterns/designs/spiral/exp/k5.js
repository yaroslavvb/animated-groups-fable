// exp/k5.js — k4 plus a longer bare wedge past the channel's mouth (the tail tapers away from the rim over up to 0.7 of
// a turn), still held to the bare-disc limit by the design's own seat search.
import { findWith } from '../design.js';
import { K as K4 } from './k4.js';
export const meta = { key: 'spiral-k5', label: 'k5', hint: 'experiment' };
export const K = { ...K4, flares: [0.7, 0.62, 0.55, 0.47, 0.4, 0.33, 0.27, 0.22], bareMax: 0.41 };
export function find(group) { return findWith(group, K); }
