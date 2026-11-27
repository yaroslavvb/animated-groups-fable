// formulas.mjs — the LaTeX the app composes while it runs. build.mjs typesets each with MathJax into src/gen/math.js.
// Keys are what src/mathbank.js looks up. Keep them few: a readout is built from these pieces.

const F = {
  // the four letters of a surface's symbol (Conway's signature without its numbers)
  'sym:o': '\\circ',
  'sym:*': '\\ast',
  'sym:x': '\\times',
  'sym:X': '\\otimes',
  'sym:sphere': '\\text{sphere}',
  chi: '\\chi',
  eq: '=',
  minus: '-',
  plus: '+',
  to: '\\to',
  V: 'V', E: 'E', F: 'F',
  a: 'a', b: 'b', c: 'c', d: 'd',
  // the two normal forms and the count formulas of pp. 102-103
  formO: '\\circ^{a}\\ast^{b}',
  formX: '\\ast^{b}\\times^{c}',
  chiTidy: '\\chi = 2 - 2a - b - c - 2d',
  chiO: '\\chi = 2 - 2a - b',
  chiX: '\\chi = 2 - b - c',
  euler: '\\chi = V - E + F',
  tradeX: '\\otimes = \\times\\times',
  tradeO: '\\circ\\times = \\times\\times\\times',
  tradeGen: '\\circ^{a}\\times^{b} = \\times^{2a+b}\\ (b > 0)',
};
for (let i = 0; i <= 9; i++) F['d' + i] = String(i);
export const FORMULAS = F;
