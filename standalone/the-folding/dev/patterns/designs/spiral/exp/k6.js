// exp/k6.js — the delivered spiral with only the changes that cost no turns: rounder levels and rim corners (less Greek
// key), a longer bare wedge where the bare-disc limit allows it (the tail tapers away from the rim), and in *x a slimmer
// snail body (the Moebius band shows a dark stripe beside a light band instead of a solid colour).
import { findWith, KNOBS } from '../design.js';
export const meta = { key: 'spiral-k6', label: 'k6', hint: 'experiment' };
export const K = {
  ...KNOBS,
  round0: 0.034, roundPow: 0.38,
  flares: [0.7, 0.62, 0.55, 0.47, 0.4, 0.33, 0.27, 0.22], bareMax: 0.41,
  snail: { ...KNOBS.snail, body: 0.5, bodyEnd: 0.66 },
};
export function find(group) { return findWith(group, K); }
