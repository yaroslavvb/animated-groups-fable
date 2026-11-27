// mathbank.js — MathJax-typeset pieces (src/gen/math.js, made by build.mjs) composed into the page's live readouts.
//
//   M('chi')              the html of one piece
//   num(-3)               an integer in MathJax digits (a proper minus sign)
//   symbol({ o, star, x, X })   a surface's symbol, e.g. ○○∗∗× (a sphere is the word "sphere")
//   symbolText(counts)    the same as plain text, for aria-labels
//   mixed({ n, d })       a price: 2, 5/12 or 1 59/60, the fraction set upright

import { MATH } from './gen/math.js';

export function M(key) {
  const h = MATH[key];
  if (h === undefined) throw new Error('mathbank: no formula ' + key);
  return h;
}

export function num(v) {
  const s = String(Math.abs(Math.trunc(v)));
  let out = v < 0 ? M('minus') : '';
  for (const ch of s) out += M('d' + ch);
  return `<span class="mnum">${out}</span>`;
}

const digits = (v) => { let out = ''; for (const ch of String(v)) out += M('d' + ch); return out; };
/** A fraction { n, d } as a whole number, a fraction or a mixed number in MathJax digits: 2, 5/12, 1 59/60. */
export function mixed(f) {
  const n = Math.abs(f.n), whole = Math.floor(n / f.d), rest = n - whole * f.d;
  let out = f.n < 0 ? M('minus') : '';
  if (whole || !rest) out += digits(whole);
  if (rest) out += `<span class="fr"><span class="fr-n">${digits(rest)}</span><span class="fr-d">${digits(f.d)}</span></span>`;
  return `<span class="mnum">${out}</span>`;
}

const ORDER = [['o', 'sym:o', '○'], ['star', 'sym:*', '∗'], ['x', 'sym:x', '×'], ['X', 'sym:X', '⊗']];

export function symbol(counts) {
  let out = '';
  for (const [k, key] of ORDER) for (let i = 0; i < (counts[k] || 0); i++) out += `<span class="sg sg-${k}">${M(key)}</span>`;
  return `<span class="sym" role="img" aria-label="${symbolText(counts)}">${out || `<span class="sg sg-sphere">${M('sym:sphere')}</span>`}</span>`;
}

export function symbolText(counts) {
  let out = '';
  for (const [k, , ch] of ORDER) out += ch.repeat(counts[k] || 0);
  return out || 'sphere';
}
