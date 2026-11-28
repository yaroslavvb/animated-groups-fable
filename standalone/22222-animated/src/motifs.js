// motifs.js — five distinct, strictly 180-deg symmetric hyperbolic motifs anchored at the five
// order-2 cone points (A..E) of 22222, pre-lifted onto the standard hyperboloid around (0, 0, 1).
// Fixed painter's depth order (bottom -> top): D (Circle) < B (Diamond) < E (Ring) < C (Cross) < A (Star).

export const DEPTH_ORDER = ['D', 'B', 'E', 'C', 'A'];

export const FEATURES = {
  A: {
    name: 'A',
    label: 'Star',
    light: '#0072B2',
    dark: '#4DB6F5',
    svg: '<svg class="sym-ico sym-a" viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1.2 12.2,7.8 18.8,10 12.2,12.2 10,18.8 7.8,12.2 1.2,10 7.8,7.8"/></svg>',
  },
  B: {
    name: 'B',
    label: 'Diamond',
    light: '#D55E00',
    dark: '#FF7B54',
    svg: '<svg class="sym-ico sym-b" viewBox="0 0 20 20" aria-hidden="true"><polygon points="18.6,10 10,15.6 1.4,10 10,4.4"/></svg>',
  },
  C: {
    name: 'C',
    label: 'Cross',
    light: '#009E73',
    dark: '#2DD49F',
    svg: '<svg class="sym-ico sym-c" viewBox="0 0 20 20" aria-hidden="true"><polygon points="17.8,7.4 17.8,12.6 12.6,12.6 12.6,17.8 7.4,17.8 7.4,12.6 2.2,12.6 2.2,7.4 7.4,7.4 7.4,2.2 12.6,2.2 12.6,7.4"/></svg>',
  },
  D: {
    name: 'D',
    label: 'Circle',
    light: '#8841B8',
    dark: '#C084FC',
    svg: '<svg class="sym-ico sym-d" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.8"/></svg>',
  },
  E: {
    name: 'E',
    label: 'Ring',
    light: '#C98A00',
    dark: '#F4C44E',
    svg: '<svg class="sym-ico sym-e" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10,2.2 A7.8,7.8 0 1,0 10,17.8 A7.8,7.8 0 1,0 10,2.2 Z M10,6.2 A3.8,3.8 0 1,1 10,13.8 A3.8,3.8 0 1,1 10,6.2 Z"/></svg>',
  },
};

export const FEATURE_LIST = [FEATURES.A, FEATURES.B, FEATURES.C, FEATURES.D, FEATURES.E];

/** Lift a 2D tangent-plane point (u, v) to the hyperboloid via exponential map at (0, 0, 1). */
function expOrigin(u, v) {
  const r = Math.hypot(u, v);
  if (r < 1e-12) return [0, 0, 1];
  const s = Math.sinh(r) / r;
  return [u * s, v * s, Math.cosh(r)];
}

/** Subdivide each edge of a 2D polygon and lift all vertices to the hyperboloid as a flat Float64Array [x,y,z,...]. */
function liftLoop(pts2, subdiv = 3) {
  const lifted = [];
  const n = pts2.length;
  for (let i = 0; i < n; i++) {
    const a = pts2[i];
    const b = pts2[(i + 1) % n];
    for (let k = 0; k < subdiv; k++) {
      const f = k / subdiv;
      lifted.push(expOrigin(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])));
    }
  }
  const flat = new Float64Array(lifted.length * 3);
  for (let i = 0; i < lifted.length; i++) {
    flat[3 * i] = lifted[i][0];
    flat[3 * i + 1] = lifted[i][1];
    flat[3 * i + 2] = lifted[i][2];
  }
  return flat;
}

/** Lift a hyperbolic circle of exact hyperbolic radius `r` with `seg` vertices. */
function liftCircle(r, seg = 28, ccw = true) {
  const flat = new Float64Array(seg * 3);
  const sr = Math.sinh(r);
  const cr = Math.cosh(r);
  for (let i = 0; i < seg; i++) {
    const a = ((ccw ? 1 : -1) * 2 * Math.PI * i) / seg;
    flat[3 * i] = sr * Math.cos(a);
    flat[3 * i + 1] = sr * Math.sin(a);
    flat[3 * i + 2] = cr;
  }
  return flat;
}

function buildHyperbolicMotifs() {
  // Adjacent center spacing at golden balanced 22222 is D_BAL = 1.0613 (midpoint 0.5306).
  // Radii ~0.48..0.63 make motifs softly kiss at balance and overlap vividly during twists!

  // A: 4-pointed Star (outer R = 0.63, inner pinch = 0.175)
  const star2 = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 0.63 : 0.175 * Math.SQRT2;
    star2.push([r * Math.cos(a), r * Math.sin(a)]);
  }

  // B: Diamond (half-axes 0.61 x 0.44)
  const diamond2 = [
    [0.61, 0],
    [0, 0.44],
    [-0.61, 0],
    [0, -0.44],
  ];

  // C: Swiss Cross (arm L = 0.57, half-width W = 0.15)
  const L = 0.57;
  const W = 0.15;
  const cross2 = [
    [L, -W], [L, W], [W, W], [W, L],
    [-W, L], [-W, W], [-L, W], [-L, -W],
    [-W, -W], [-W, -L], [W, -L], [W, -W],
  ];

  return {
    A: { loops: [liftLoop(star2, 3)], evenodd: false, radius: 0.63 },
    B: { loops: [liftLoop(diamond2, 4)], evenodd: false, radius: 0.61 },
    C: { loops: [liftLoop(cross2, 2)], evenodd: false, radius: 0.57 },
    D: { loops: [liftCircle(0.49, 28, true)], evenodd: false, radius: 0.49 },
    E: { loops: [liftCircle(0.56, 28, true), liftCircle(0.27, 20, false)], evenodd: true, radius: 0.56 },
  };
}

export const HYPERBOLIC_MOTIFS = buildHyperbolicMotifs();
