// broken-design.js (fixer) — a design that breaks the rules on purpose (a disc too big for its place: its copies
// overlap), to see what app-sheet.mjs says when the page refuses a motif. Not a design of the round.
export const meta = { key: 'broken', label: 'Broken', hint: 'copies that overlap' };
export function find(group) {
  const [cx, cy] = group.center, r = 0.9 * Math.sqrt(group.domainArea);
  const x = cx + 0.13 * group.e1[0] + 0.21 * group.e2[0], y = cy + 0.13 * group.e1[1] + 0.21 * group.e2[1];
  return { shapes: [{ pts: Array.from({ length: 64 }, (_, i) => [x + r * Math.cos((2 * Math.PI * i) / 64), y + r * Math.sin((2 * Math.PI * i) / 64)]) }] };
}
