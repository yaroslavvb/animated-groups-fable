// dev/lab.js — a design module that shows the specs of dev/out/lab.json one after another (second run, 13 Nov 2026):
// ask the sheet for an id several times (--ids '*x,*x,*x') and each call of find() takes the next spec of that group.
// A spec of the file is the SPEC entry of design.js plus `_name` (shown in the hint). Not used by the page.
import { motifOf } from '../design.js';
const LAB = await (await fetch(new URL('./out/lab.json', import.meta.url), { cache: 'no-store' })).json();
export const meta = { key: 'hook-lab', label: 'Hook lab', hint: 'lab specs in order: ' + Object.entries(LAB).map(([id, l]) => id + ' ' + l.map((s) => s._name || '?').join(' | ')).join(' · ') };
const count = {};
export function find(group) {
  const list = LAB[group.id] || [];
  if (!list.length) throw new Error('no lab spec for ' + group.id);
  const k = (count[group.id] = (count[group.id] ?? -1) + 1) % list.length;
  const m = motifOf(group, list[k]);
  return { shapes: m.shapes, info: { k, name: list[k]._name } };
}
