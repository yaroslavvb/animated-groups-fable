// dev/cand.js — a design module that shows the candidates of dev/out/cands.json one after another: ask the sheet for an
// id several times (--ids '442,442,442') and each call of find() takes the next candidate of that group.
import { motifOf } from '../design.js';
const CANDS = await (await fetch(new URL('./out/cands.json', import.meta.url))).json();
export const meta = { key: 'hook-cand', label: 'Hook cands', hint: 'candidates of the search, in order' };
const count = {};
export function find(group) {
  const list = CANDS[group.id] || [];
  if (!list.length) throw new Error('no candidate for ' + group.id);
  const k = (count[group.id] = (count[group.id] ?? -1) + 1) % list.length;
  const m = motifOf(group, list[k]);
  return { shapes: m.shapes, info: { k, spec: list[k] } };
}
