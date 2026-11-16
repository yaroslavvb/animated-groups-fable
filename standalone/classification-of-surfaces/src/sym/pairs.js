// pairs.js — how the two glued edges of a pair are drawn alike: one colour and one number of arrowheads a pair.
//
// His ask (Mon 16 Nov 2026): "instead of using letters a,b, use colors or edge styling to indicate edges which are
// matched up". The outlined tile of tab 5 used to carry a letter on each glued edge (a ... a, b ... b); now the two
// edges of a pair share a colour, and a number of arrowheads (one, two, three, as on a textbook's polygon) that
// tells pairs apart without colour. The colours keep clear of what the pattern already uses (teal and sand tiles,
// red mirrors, blue gyration points) and show on a light and on a dark page, since tab 3 draws the same tile with
// them when it zips it up. Five colours and three counts: fifteen pairs before a look repeats.
export const PAIR_COLORS = [
  [0.478, 0.361, 0.78],   // violet
  [0.6, 0.5, 0],          // gold
  [0.8, 0.24, 0.56],      // magenta
  [0.11, 0.56, 0.25],     // green
  [0.42, 0.45, 0.52],     // grey
];
/** The look of the k-th glued pair of a tile (k = 0 for the first pair met going round it). */
export const pairStyle = (k) => ({ color: PAIR_COLORS[k % PAIR_COLORS.length], heads: 1 + (k % 3) });
export const pairCss = (k) => { const c = pairStyle(k).color; return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`; };
