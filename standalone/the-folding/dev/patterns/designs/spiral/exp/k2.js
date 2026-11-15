// exp/k2.js — knob experiment: the channel wider than the arm (the dark reads as a stroke), a fat head, a longer wedge.
import { findWith, KNOBS } from '../design.js';
export const meta = { key: 'spiral-k2', label: 'k2', hint: 'experiment' };
const K = {
  ...KNOBS,
  headR: 0.13, floors: { ...KNOBS.floors, headR: 0.09 },
  slit: 0.11, arm: 0.06,
  gamma: 0.55,
  turnsMin: 1.0, turnsMax: 1.5,
  round0: 0.07, roundPow: 0.3,
  flares: [0.75, 0.65, 0.55, 0.47, 0.4, 0.33], bareMax: 0.45,
};
export function find(group) { return findWith(group, K); }
