// journey.js — one line through the three states of a pattern (15 Nov 2026). Pure: no DOM; src/app.js wires it.
//
// The owner, 15 Nov 2026, on *632: "Normally, the folded part is just the surface, but here there is a bit of confusion
// about which part lies in the folding and which part lies in the tiling. Unify those two. Also, maybe the Unfold and
// Tile buttons should be in the same place so I can first unfold and then tile."
//
// Conway's sentence (The Symmetries of Things, ch. 8, p. 93): "Any repeating pattern can be folded into an orbifold on
// some surface." The page shows that as ONE journey with three stops, on one scrubber:
//
//        SURFACE  ——— unfold ———>  TILE  ——— tile ———>  PATTERN
//        (the orbifold: the tile       (the tile, flat,       (the copies of the tile
//         with its zippers zipped)      alone)                  that the group makes)
//        <——————————————————————————— fold ———————————————————————————
//
//   t    in [0, 1]: how far the tile's zippers are zipped (0 flat, 1 the surface)        — the fold modules' parameter
//   tile in [0, 1]: how far the copies of the tile have been made (0 the tile alone, 1 the pattern) — replicate.js's u
// Only one of them is under way at a time: a tile that is not flat makes no copies (t > 0 means tile = 0). So the two
// lie on one line, j in [0, 1] along the scrubber:
//        j = 0 the surface (t = 1)      j = a the tile (t = 0, tile = 0)      j = 1 the pattern (tile = 1)
// with a = 1/2: the tile sits in the middle of the track (each half plays at its own speed: segmentSeconds). A
// kaleidoscope's tile has no zipper (every edge is a mirror): it IS the surface, a = 0, and its whole fold is the
// pattern folding along its mirrors onto the tile — the same motion as the tiling, run backwards. That is what unifies
// the two.
//
//   journeyLayout(foldSeconds, tileSeconds)  -> { a, fold, tile, seconds }
//   journeyOf(lay, t, tile)                  -> j
//   stateOf(lay, j)                          -> { t, tile }
//   journeyStops(lay, foldStops, tileStops)  -> [{ t: j, label, main? }]   for timeline.js setStops
//   stopOf(lay, j)                           -> 'surface' | 'tile' | 'pattern' | null   the main stop j is at
//   nextTarget(lay, j, toward)               -> the next main stop from j toward 'surface' or 'pattern'
//   normalizeState(t, tile)                  -> { t, tile } with the invariant (a URL or a script may ask for both)

const clamp01 = (v) => { const x = Number(v); return x > 0 ? (x < 1 ? x : 1) : 0; };   // NaN -> 0

/** How near a stop counts as being at it (in j). */
export const AT_STOP = 1e-4;
/** Where the tile sits on the track when there is a fold: the middle. */
export const TILE_AT = 0.5;

/**
 * The scrubber's layout for a fold of foldSeconds (0 or less: nothing to zip, the tile is the surface) and a tiling of
 * tileSeconds: a = where the tile sits on the track (TILE_AT; 0 when there is no fold), and the seconds of each half.
 */
export function journeyLayout(foldSeconds, tileSeconds) {
  const f = Number.isFinite(foldSeconds) && foldSeconds > 0 ? foldSeconds : 0;
  const k = Number.isFinite(tileSeconds) && tileSeconds > 0 ? tileSeconds : 1;
  return { a: f > 0 ? TILE_AT : 0, fold: f, tile: k, seconds: f + k };
}

/** The invariant: a tile that is not flat has no copies (t > 0 wins over tile). */
export function normalizeState(t, tile) {
  const tt = clamp01(t);
  return { t: tt, tile: tt > 0 ? 0 : clamp01(tile === undefined || tile === null ? 1 : tile) };
}

/** Where the state (t, tile) lies on the scrubber. */
export function journeyOf(lay, t, tile) {
  const s = normalizeState(t, tile), a = lay.a;
  if (s.t > 0) return a > 0 ? a * (1 - s.t) : 0;
  return a + (1 - a) * s.tile;
}

/** The state at j: on the fold's half t = 1 - j / a (tile = 0), on the tiling's half tile = (j - a) / (1 - a) (t = 0). */
export function stateOf(lay, j) {
  const x = clamp01(j), a = lay.a;
  if (a > 0 && x < a) return { t: clamp01(1 - x / a), tile: 0 };
  return { t: 0, tile: a < 1 ? clamp01((x - a) / (1 - a)) : 1 };
}

/** The main stop j is at, or null. A kaleidoscope's tile (a = 0) is at j = 0: 'tile' (it is the surface as well). */
export function stopOf(lay, j, eps = AT_STOP) {
  const x = clamp01(j), a = lay.a;
  if (x >= 1 - eps) return 'pattern';
  if (Math.abs(x - a) <= eps) return 'tile';
  if (a > 0 && x <= eps) return 'surface';
  return null;
}

/**
 * The next main stop from j toward 'surface' (down the track) or toward 'pattern' (up): the j to play to. At the end
 * already: that end.
 */
export function nextTarget(lay, j, toward, eps = AT_STOP) {
  const x = clamp01(j), a = lay.a;
  if (toward === 'surface') return a > 0 && x > a + eps ? a : 0;
  return x < a - eps ? a : 1;
}

/**
 * The stops of the scrubber: the three main ones ({ main: true }, labelled 'surface', 'tile', 'pattern'; a
 * kaleidoscope: 'tile = surface' and 'pattern'), the fold's own inner stops and the ends of the tiling's layers
 * (never nearer than `gap` of the track to a stop already kept: a magnet needs room).
 */
export function journeyStops(lay, foldStops = [], tileStops = [], gap = 0.06) {
  const a = lay.a, out = [];
  if (a > 0) out.push({ t: 0, label: 'surface', main: true });
  out.push({ t: a, label: a > 0 ? 'tile' : 'tile = surface', main: true });
  out.push({ t: 1, label: 'pattern', main: true });
  const far = (j) => out.every((s) => Math.abs(s.t - j) >= gap);
  if (a > 0) {
    for (const s of foldStops || []) {
      const t = Number(s && s.t);
      if (!(t > 0 && t < 1)) continue;
      const j = a * (1 - t);
      if (far(j)) out.push({ t: j, label: (s && s.label) || '' });
    }
  }
  for (const s of tileStops || []) {
    const u = Number(s && s.t);
    if (!(u > 0 && u < 1)) continue;
    const j = a + (1 - a) * u;
    if (far(j)) out.push({ t: j, label: (s && s.label) || '' });
  }
  return out.sort((p, q) => p.t - q.t);
}

/**
 * Seconds a play from j0 to j1 takes inside ONE half of the track (both on the fold's side of the tile, or both on the
 * tiling's): the fold at its own speed; the tiling at its own speed toward the pattern, and `gather` times as fast
 * back toward the tile (folding gathers the copies quickly: the fold that follows is the show; a kaleidoscope, whose
 * gathering IS its fold, passes gather = 1 or little more).
 */
export function segmentSeconds(lay, j0, j1, gather = 1) {
  const a = lay.a, x0 = clamp01(j0), x1 = clamp01(j1);
  if (a > 0 && Math.max(x0, x1) <= a + 1e-12) return (lay.fold * Math.abs(x1 - x0)) / a;
  const d = Math.abs(x1 - x0) / (1 - a || 1);
  return x1 < x0 ? (lay.tile * d) / Math.max(1, gather) : lay.tile * d;
}
