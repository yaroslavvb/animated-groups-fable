// colors.js — the three partitions' colours. A partition keeps its colour for good: the lines between its cone
// points (its two seals), its loop, its card. Nothing is recoloured when another card is touched (his ask, Fri 27
// Nov 2026, 22:55: "I don't want to switch colors, so the lines between different edges should keep their colors").
//
// Blue and vermillion are the two he already had for "the two sides of a twist" (Okabe and Ito's); the purple is the
// third that stays apart from both for every kind of colour vision: checked with the dataviz validator on white, on
// the print's paper #9ad5cc and on its comma tone #4fa397, all pairs (worst pair under deuteranopia: purple against
// blue, 10.5; the target is 8). On the print the vermillion's contrast is 2.35 : 1, under 3 : 1, so colour is never
// the only sign: a seal is also named by the two labelled cone points it joins, and a card by its letters.
// page.css holds the same three values as --pq-part-1 … 3 (test/colors.test.js pins that they agree).

export const PART_HEX = ['#0072B2', '#D55E00', '#882E72'];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** [r, g, b] in 0..1, in the order of state.js CARD_KEYS: PQ|RS, PR|QS, PS|QR. */
export const PART_RGB = PART_HEX.map(rgb);
export const INK_RGB = [26 / 255, 26 / 255, 31 / 255];
