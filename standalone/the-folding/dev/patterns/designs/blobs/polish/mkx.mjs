// polish/mkx.mjs — *x strokes for the strip of 14 Nov 2026 (the tile T x w = 1.2 x 0.6 world, 1.414 x 0.707 tile
// sizes), written in strip coordinates and turned into the group's frame (design.js frameOf): s along the mirrors, t
// across them; mirrors at t = 0 and t = 0.707, the glide axis at t = 0.354, the default tile s in [-0.707, 0.707].
// The glide is (s, t) -> (s + 1.414, 0.707 - t). Prints a variants file for lab/view.mjs (an array of { id, stroke, label }).
//   node polish/mkx.mjs [set] > polish/vx.json
const ax = 2 / Math.sqrt(5), ay = 1 / Math.sqrt(5);              // the mirror's direction in the frame (27 degrees)
const P = (s, t) => [s * ax - t * ay, s * ay + t * ax];
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export const stroke = (pts, o) => ({ p: pts.flatMap(([s, t]) => P(s, t)).map(r4), th: 0, ...o });
export { P };
const V = [];
const add = (label, s) => V.push({ id: '*x', label, stroke: s });
const set = process.argv[2] || 'a';
if (set === 'a') {
  // a tadpole along the strip: a round head at one end, the tail sweeping on and curling toward a mirror
  add('A1 head left, tail down', stroke([[-0.38, 0.36], [0.05, 0.42], [0.42, 0.33], [0.55, 0.12]], { r0: 0.22, rh: 0.22, q: 1.2 }));
  add('A2 tail curls up', stroke([[-0.38, 0.34], [0.05, 0.28], [0.42, 0.36], [0.52, 0.6]], { r0: 0.22, rh: 0.22, q: 1.2 }));
  add('A3 hook back', stroke([[-0.3, 0.38], [0.2, 0.42], [0.55, 0.25], [0.15, 0.12]], { r0: 0.21, rh: 0.21, q: 1.3 }));
  add('A4 fat short', stroke([[-0.3, 0.35], [0.0, 0.42], [0.3, 0.38], [0.45, 0.16]], { r0: 0.25, rh: 0.25, q: 1.0 }));
  add('A5 S to corner', stroke([[-0.35, 0.33], [0.1, 0.25], [0.35, 0.45], [0.62, 0.55]], { r0: 0.22, rh: 0.22, q: 1.3 }));
  add('A6 curl round', stroke([[-0.25, 0.4], [0.25, 0.5], [0.5, 0.25], [0.2, 0.13], [-0.05, 0.2]], { r0: 0.2, rh: 0.2, q: 1.3 }));
  add('A7 diagonal', stroke([[-0.45, 0.45], [-0.05, 0.4], [0.3, 0.22], [0.6, 0.15]], { r0: 0.23, rh: 0.23, q: 1.1 }));
  add('A8 long curl', stroke([[-0.42, 0.34], [0.1, 0.4], [0.6, 0.38], [0.6, 0.12]], { r0: 0.2, rh: 0.2, q: 1.4 }));
}
if (set === 'b') {
  // a big head and a tail that curls: the comma of 333 / 22x laid in the strip
  add('B1 curl up', stroke([[-0.35, 0.36], [0.15, 0.2], [0.58, 0.3], [0.42, 0.56]], { r0: 0.24, rh: 0.24, q: 1.3 }));
  add('B2 curl down', stroke([[-0.35, 0.36], [0.15, 0.52], [0.58, 0.42], [0.45, 0.15]], { r0: 0.24, rh: 0.24, q: 1.3 }));
  add('B3 diagonal', stroke([[-0.42, 0.42], [-0.05, 0.36], [0.3, 0.1], [0.62, 0.22]], { r0: 0.22, rh: 0.22, q: 1.2 }));
  add('B5 six', stroke([[-0.2, 0.33], [0.4, 0.22], [0.6, 0.55], [0.1, 0.6]], { r0: 0.25, rh: 0.25, q: 1.3 }));
  add('B6 C round', stroke([[-0.4, 0.35], [0.1, 0.1], [0.65, 0.35], [0.35, 0.6]], { r0: 0.23, rh: 0.23, q: 1.4 }));
  add('B7 big head short', stroke([[-0.25, 0.36], [0.2, 0.25], [0.5, 0.3], [0.5, 0.52]], { r0: 0.27, rh: 0.27, q: 1.1 }));
  add('B8 head mid curl', stroke([[-0.1, 0.36], [0.45, 0.3], [0.5, 0.6], [0.05, 0.62]], { r0: 0.26, rh: 0.26, q: 1.2 }));
  add('B9 long sweep', stroke([[-0.45, 0.38], [0.0, 0.22], [0.55, 0.2], [0.62, 0.48]], { r0: 0.23, rh: 0.23, q: 1.5 }));
}
if (set === 'c') {
  // the head in the middle (it reaches both mirrors' middles), the tail sweeping round the far end, corner to corner
  add('C1 head mid, round right', stroke([[-0.2, 0.36], [0.3, 0.02], [0.78, 0.2], [0.55, 0.6]], { r0: 0.27, rh: 0.27, q: 1.2 }));
  add('C2 head mid-left, round', stroke([[-0.3, 0.36], [0.25, 0.0], [0.8, 0.3], [0.45, 0.62]], { r0: 0.26, rh: 0.26, q: 1.3 }));
  add('C3 head left, tail to TR', stroke([[-0.38, 0.33], [0.15, 0.05], [0.6, 0.15], [0.62, 0.58]], { r0: 0.25, rh: 0.25, q: 1.2 }));
  add('C4 fat, tail short round', stroke([[-0.15, 0.36], [0.3, 0.08], [0.65, 0.28], [0.5, 0.52]], { r0: 0.29, rh: 0.29, q: 1.0 }));
  add('C5 head TL-ish, sweep', stroke([[-0.35, 0.42], [0.1, 0.0], [0.7, 0.15], [0.6, 0.55]], { r0: 0.25, rh: 0.25, q: 1.3 }));
  add('C6 C1 r.24', stroke([[-0.2, 0.36], [0.3, 0.02], [0.78, 0.2], [0.55, 0.6]], { r0: 0.24, rh: 0.24, q: 1.0 }));
  add('C7 C1 cover 54', stroke([[-0.2, 0.36], [0.3, 0.02], [0.78, 0.2], [0.55, 0.6]], { r0: 0.27, rh: 0.27, q: 1.2, cover: 0.54 }));
  add('C8 5 pts', stroke([[-0.25, 0.36], [0.1, 0.1], [0.5, 0.05], [0.72, 0.35], [0.5, 0.6]], { r0: 0.26, rh: 0.26, q: 1.2 }));
}
console.log(JSON.stringify(V, null, 1));
