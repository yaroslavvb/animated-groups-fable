// exp/k1.js — knob experiment on the delivered spiral: a fat head, a stronger taper, rounder turns.
import { findWith, KNOBS } from '../design.js';
export const meta = { key: 'spiral-k1', label: 'k1', hint: 'experiment' };
const K = {
  ...KNOBS,
  headR: 0.15, floors: { ...KNOBS.floors, headR: 0.1 },
  gamma: 0.6,
  turnsMin: 1.0, turnsMax: 1.4,
  round0: 0.06, roundPow: 0.3,
};
export function find(group) { return findWith(group, K); }
