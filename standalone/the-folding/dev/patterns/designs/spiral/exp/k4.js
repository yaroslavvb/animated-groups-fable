// exp/k4.js — a modest refinement of the delivered spiral: rounder levels and rim corners (less Greek key), a somewhat
// larger head and a stronger taper with the channel and turns kept, and in *x a slimmer snail body (more of the band bare).
import { findWith, KNOBS } from '../design.js';
export const meta = { key: 'spiral-k4', label: 'k4', hint: 'experiment' };
export const K = {
  ...KNOBS,
  headR: 0.085, floors: { ...KNOBS.floors, headR: 0.052 },
  gamma: 0.7, turnsMin: 1.06,
  round0: 0.034, roundPow: 0.38,
  snail: { ...KNOBS.snail, body: 0.5, bodyEnd: 0.66 },
};
export function find(group) { return findWith(group, K); }
