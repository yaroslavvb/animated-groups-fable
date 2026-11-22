// Studio — designs to start from, and a generator of new ones.
//
// A preset is plain data in the shape normaliseDesign() reads.  Positions are
// lattice coordinates: rotation centres of order 4 sit at (0, 0) and (½, ½),
// of order 2 at (½, 0) and (0, ½).

const shape = (role, sh, at, extra = {}) => ({ k: 's', role, sh, at, ...extra });
const orbit = (r, k = 1, extra = {}) => ({ m: 'o', r, e: 1, tilt: 0, k, ph: 0, ...extra });
const spin = (k = 1) => ({ m: 's', k });
const pulse = (amt, k = 1, ph = 0) => ({ m: 'p', amt, k, ph });
const rock = (amp, k = 1, ph = 0) => ({ m: 'r', amp, k, ph });
const blink = (on, dur, k = 1) => ({ m: 'b', on, dur, k });
const wave = (p, nu, amp, ph = 0) => ({ k: 'w', p, nu, amp, ph });

const path = (pts, k = 1, extra = {}) => ({ m: 'w', pts, k, ph: 0, ease: 0.5, ...extra });

export const PRESETS = [
  {
    id: 'plume',
    name: 'Plume',
    blurb: 'Two commas, one turning on each quarter-turn centre. Each meets its own half-turned negative there, and the hooks lock together the way Plume Monochrome’s do.',
    design: {
      loop: 10,
      L: [
        shape('f', 'comma', [0, 0], { r: 0.34, h: 0.05, mv: [spin(1)] }),
        shape('f', 'comma', [0.5, 0.5], { r: 0.34, h: 0.05, th: 0.25, mv: [spin(1)] }),
      ],
    },
  },
  {
    id: 'turnstile',
    name: 'Turnstile',
    blurb: 'One disc on one circle. Stripes fold into triangles and open again a quarter turn on.',
    design: {
      loop: 8,
      L: [shape('f', 'disc', [0, 0], { r: 0.08, h: 0.004, mv: [orbit(0.25, 1)] })],
    },
  },
  {
    id: 'sawblade',
    name: 'Sawblade',
    blurb: 'A five-pointed star and a three-pointed one, each turning on a centre. A star with an odd number of points is not its own half turn, so the group cannot cancel it.',
    design: {
      loop: 12,
      L: [
        shape('f', 'star', [0, 0], { r: 0.34, n: 5, a: 0.5, h: 0.006, mv: [spin(1)] }),
        shape('f', 'star', [0.5, 0.5], { r: 0.2, n: 3, a: 0.4, h: 0.006, th: 0.1, mv: [spin(1)] }),
      ],
    },
  },
  {
    id: 'courier',
    name: 'Courier',
    blurb: 'A disc carried round three points, pausing at each. Eight copies make the same round a quarter turn and a quarter loop apart.',
    design: {
      loop: 9,
      L: [shape('f', 'disc', [0.5, 0], { r: 0.07, h: 0.004, mv: [path([[0.2, 0], [-0.1, 0.17], [-0.1, -0.17]], 1, { ease: 0.6 })] })],
    },
  },
  {
    id: 'dunes',
    name: 'Dunes',
    blurb: 'Two soft discs circling opposite ways. A soft edge lets neighbours in the same ink run together.',
    design: {
      loop: 10,
      L: [
        shape('f', 'disc', [0, 0], { r: 0.1, h: 0.06, mv: [orbit(0.21, 1)] }),
        shape('f', 'disc', [0.5, 0], { r: 0.1, h: 0.06, mv: [orbit(0.17, -1, { ph: 0.3 })] }),
      ],
    },
  },
  {
    id: 'iris',
    name: 'Iris',
    blurb: 'Nothing travels: four rings swell and shrink in turn, and whichever is larger holds the ground.',
    design: {
      loop: 8,
      L: [shape('f', 'ring', [0.25, 0.25], { r: 0.17, a: 0.4, h: 0.02, mv: [pulse(0.55, 1)] })],
    },
  },
  {
    id: 'shuttle',
    name: 'Shuttle',
    blurb: 'An ellipse sliding to and fro along a diagonal while it makes half a turn.',
    design: {
      loop: 8,
      L: [shape('f', 'ellipse', [0.25, 0.25], { r: 0.16, a: 0.5, h: 0.02, mv: [orbit(0.14, 1, { e: 0, tilt: 0.125 }), spin(0.5)] })],
    },
  },
  {
    id: 'windmill',
    name: 'Windmill',
    blurb: 'Bars turning half a turn a loop, each crossing its own negative at right angles, with a ring stamped on top.',
    design: {
      loop: 8,
      L: [
        shape('f', 'bar', [0.25, 0.25], { r: 0.2, a: 0.16, h: 0.02, mv: [spin(0.5)] }),
        shape('s', 'ring', [0.5, 0.5], { r: 0.1, a: 0.5, h: 0.004, mv: [orbit(0.14, 1)] }),
      ],
    },
  },
  {
    id: 'stars',
    name: 'Stars',
    blurb: 'Two waves for ground and a star stamped on it for half the loop, timed so that it is always in the other ink from the ground under it.',
    design: {
      loop: 8,
      L: [
        wave([1, 0], 1, 0.2),
        wave([1, 2], 1, 0.06, 0.2),
        shape('s', 'star', [0.25, 0.25], { r: 0.14, n: 5, a: 0.5, h: 0.004, mv: [blink(0.375, 0.5), rock(0.1, 3)] }),
      ],
    },
  },
  {
    id: 'lenses',
    name: 'Lenses',
    blurb: 'Rings and discs that swap the inks of whatever they pass over, drifting across two crossing waves.',
    design: {
      loop: 12,
      L: [
        wave([1, 1], 1, 0.2),
        wave([2, 0], -1, 0.08, 0.1),
        shape('i', 'ring', [0, 0], { r: 0.2, a: 0.35, mv: [orbit(0.25, 1)] }),
        shape('i', 'disc', [0.5, 0.5], { r: 0.1, mv: [pulse(0.5, 1)] }),
      ],
    },
  },
];

/** The census's own film of a class, as wave layers. */
export function censusFilm(cls) {
  const P = 7919;                             // model.phaseDen of the census
  const frac = (s) => { const [a, b] = String(s).split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); };
  const nu0 = frac(cls.nu0);
  return {
    loop: 8 * cls.m,
    nm: 'Census film',
    L: cls.modes.map(([q0, q1, off, mod, k]) => ({
      k: 'w',
      p: [q0, q1],
      // the census writes exp(2 pi i (p.x + nu t)) with t in film periods and
      // colours by the sign of the imaginary part, dark where it is positive
      nu: -Math.round((nu0 + off) * cls.m),
      amp: 0.1 * frac(mod),
      ph: (((k / P + 0.25) % 1) + 1) % 1,
    })),
  };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPECIAL = [[0, 0], [0.5, 0.5], [0.5, 0], [0, 0.5], [0.25, 0.25], [0.25, 0], [0.75, 0.25]];

/** A design nobody chose.  Deterministic in the seed. */
export function randomDesign(seed) {
  const rnd = mulberry(seed);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  const odd = () => pick([1, 1, 1, -1, -1, 3, -3]);
  const place = () => (rnd() < 0.6 ? pick(SPECIAL).slice() : [between(0, 1), between(0, 1)]);
  const moves = (sh) => {
    const mv = [];
    const kind = rnd();
    if (kind < 0.55) mv.push(orbit(between(0.06, 0.3), odd(), { ph: rnd(), e: rnd() < 0.7 ? 1 : pick([0, 0.4, -1]), tilt: rnd() < 0.5 ? 0 : pick([0.125, 0.25]) }));
    else if (kind < 0.7) mv.push(pulse(between(0.3, 0.7), odd(), rnd()));
    else if (kind < 0.85) mv.push({ m: 'w', pts: [[0, 0], [between(-0.25, 0.25), between(-0.25, 0.25)], [between(-0.25, 0.25), between(-0.25, 0.25)]], k: 1, ph: rnd(), ease: rnd() });
    else mv.push(blink(rnd(), between(0.3, 0.6)));
    if (sh !== 'disc' && sh !== 'ring' && rnd() < 0.6) mv.push(rnd() < 0.7 ? spin(pick([1, -1])) : rock(between(0.05, 0.2), 1, rnd()));
    if (rnd() < 0.25 && !mv.some((m) => m.m === 'p')) mv.push(pulse(between(0.15, 0.4), odd(), rnd()));
    return mv;
  };
  const SH = ['disc', 'disc', 'ellipse', 'bar', 'box', 'poly', 'star', 'ring', 'comma', 'moon', 'cross', 'arc', 'wedge'];
  const L = [];
  if (rnd() < 0.4) L.push(wave([pick([1, 1, 2, 0]), pick([0, 1, 1, 2])], odd(), between(0.05, 0.25), rnd()));
  if (L.length && L[0].p[0] === 0 && L[0].p[1] === 0) L[0].p = [1, 0];
  const floods = L.length ? Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < floods; i++) {
    const sh = pick(SH);
    L.push(shape('f', sh, place(), { r: between(0.05, 0.2), h: pick([0.004, 0.01, 0.03, 0.05, 0.08]), th: rnd(), n: 3 + Math.floor(rnd() * 5), mv: moves(sh) }));
  }
  const stamps = Math.floor(rnd() * 3);
  for (let i = 0; i < stamps; i++) {
    const sh = pick(SH);
    L.push(shape(rnd() < 0.75 ? 's' : 'i', sh, place(), { r: between(0.05, 0.16), h: 0.004, th: rnd(), n: 3 + Math.floor(rnd() * 5), mv: moves(sh) }));
  }
  return { loop: pick([6, 8, 8, 10, 12]), L };
}
