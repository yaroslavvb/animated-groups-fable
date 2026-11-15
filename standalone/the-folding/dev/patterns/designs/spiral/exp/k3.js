// exp/k3.js — knob experiment on the delivered spiral: a bigger head with narrower channel and arm (so it keeps about
// 1.3 turns), a visible taper, rounder levels and rim corners, a longer wedge where the bare-disc limit allows it.
import { findWith, KNOBS } from '../design.js';
export const meta = { key: 'spiral-k3', label: 'k3', hint: 'experiment' };
export const K = {
  ...KNOBS,
  headR: 0.12, slit: 0.072, arm: 0.064, tip: 0.048,
  floors: { slit: 0.05, tip: 0.042, arm: 0.045, headR: 0.075 },
  gamma: 0.65,
  turnsMin: 1.1, turnsMax: 1.5,
  round0: 0.045, roundPow: 0.35,
  flares: [0.7, 0.6, 0.5, 0.42, 0.35, 0.27, 0.22], bareMax: 0.42,
};
export function find(group) { return findWith(group, K); }
