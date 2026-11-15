// designs/spiral/v.js — the design with knobs overridden from the module's own query string, for A/B sheets:
//   --design 'designs/spiral/v.js?roundPow=0.6&gamma=0.8'
import { findWith, KNOBS } from './design.js';

const q = new URL(import.meta.url).searchParams;
const K = { ...KNOBS };
for (const [k, v] of q) K[k] = Number.isNaN(+v) ? v : +v;
export const meta = { key: 'spiral', label: 'Spirals', hint: [...q].map(([k, v]) => k + '=' + v).join(' ') || 'as design.js' };
export function find(group) { return findWith(group, K); }
