/* THE MOTIF — the thing the group makes copies of, in one place.
 *
 * Everything that draws a pattern on this site goes through here: the
 * renderer, the strip animations, the coloured plates. Swapping the motif is
 * therefore a one-line change (ACTIVE, below) or a URL parameter
 * (?motif=comma-wipe) rather than an edit spread over four files.
 *
 * A motif is a shape plus a channel that carries phase, and it must satisfy
 * three things the rest of the site relies on:
 *
 *   CHIRAL       no symmetry of its own, so a rotated copy looks rotated and
 *                a reflected copy looks reflected, down to a thumbnail.
 *   PHASE-BEARING
 *                the picture varies continuously with the internal time, is
 *                continuous through t = 0 (no seam in the loop), and is NOT a
 *                rotation — a turning marker inside a pattern with turning
 *                symmetry aliases against the pattern and stops being
 *                readable, which is why the site's first motif was scrapped.
 *   LAYERED      draw(ctx, ph, r, colors, layer) is called twice per frame,
 *                with layer "body" for every copy and then "fill" for every
 *                copy. Painting is then order-independent, which matters
 *                because coincident copies — a reversal partner shares its
 *                spatial site — must show the union of their coloured
 *                regions rather than whichever was painted last.
 *
 * The "body" layer must be PHASE-INDEPENDENT. For a motif whose shape changes
 * with phase that is not a restriction but a design: the body draws the
 * motif's full extent as a faint socket, and the fill draws the actual state
 * inside it. The socket doubles as the reference that makes a size legible —
 * a letter at 70% of full size reads as "shrunk" only if something shows what
 * full size was.
 *
 * See motifs.html for the candidates this was chosen from, each measured.
 */
"use strict";

export const MOTIF_COLORS = {
  body: "#dbe6f2",      // the empty shape, for a motif whose outline is static
  outline: "#7d93ab",
  fill: "#3b6ea5",      // whatever carries the phase
  socket: "#e4ebf3",    // the full extent, for a motif that changes size
  beatOn: "#c0392b",    // the phase ring's hand (drawPhaseRing)
  beatOff: "#b3aa96",   // and its ruler
};

/* ------------------------------------------------------------- geometry */
/* Shapes live in a local frame, y DOWN, normalised to circumradius R_SHAPE so
 * every motif occupies the same budget and the layout need not know which one
 * is in use. */
const R_SHAPE = 0.64;

function normalise(subs, R = R_SHAPE) {
  const all = subs.flat();
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = R / Math.max(...all.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const out = subs.map(s => s.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
  const fy = out.flat().map(p => p[1]);
  return { subs: out, top: Math.min(...fy), bot: Math.max(...fy) };
}

function bez(chain, n = 18) {
  const pts = [];
  for (const [p0, p1, p2, p3] of chain) {
    for (let i = 0; i < n; i++) {
      const t = i / n, m = 1 - t;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1],
      ]);
    }
  }
  return pts;
}

/* A blocky R: the classic asymmetric test glyph. Its mirror image is a shape
 * every reader already knows is wrong, which is what makes it a better
 * handedness marker than any abstract form. */
const R_LETTER = normalise([
  [[-0.46, -0.70], [0.14, -0.70], [0.34, -0.60], [0.42, -0.40], [0.42, -0.22],
   [0.34, -0.04], [0.18, 0.04], [0.48, 0.70], [0.14, 0.70], [-0.10, 0.10],
   [-0.16, 0.10], [-0.16, 0.70], [-0.46, 0.70]],
  /* The counter, wound the OTHER WAY round from the outline. Even-odd filling
   * would cut it either way, but not every caller passes even-odd — the
   * coloured plates fill bodyPath with the default nonzero rule — and under
   * nonzero two sub-paths with the same winding simply add, so the bowl
   * filled in solid. Opposite winding cuts the hole under both rules, which
   * makes the shape correct rather than the callers careful. */
  [[-0.16, -0.22], [0.08, -0.22], [0.16, -0.28], [0.16, -0.38],
   [0.08, -0.44], [-0.16, -0.44]],
]);

/* the comma the site shipped before, kept so it can be switched back to */
const COMMA = normalise([bez([
  [[0.40, -0.30], [0.52, 0.18], [0.32, 0.56], [-0.52, 0.74]],
  [[-0.52, 0.74], [-0.10, 0.52], [0.18, 0.26], [0.06, 0.02]],
  [[0.06, 0.02], [-0.14, 0.02], [-0.40, -0.10], [-0.40, -0.30]],
  [[-0.40, -0.30], [-0.40, -0.54], [-0.22, -0.68], [0.00, -0.68]],
  [[0.00, -0.68], [0.24, -0.68], [0.40, -0.54], [0.40, -0.30]],
])]);

function trace(ctx, shape, r, k = 1) {
  ctx.beginPath();
  for (const sub of shape.subs) {
    ctx.moveTo(sub[0][0] * r * k, sub[0][1] * r * k);
    for (let i = 1; i < sub.length; i++) {
      ctx.lineTo(sub[i][0] * r * k, sub[i][1] * r * k);
    }
    ctx.closePath();
  }
}

/* ------------------------------------------------------------- the size */
/* SHRINK is how much of its full size the motif loses at the ends of the
 * period: k runs from 1 - SHRINK at t = 0 up to 1 at t = 1/2 and back. It was
 * 0.58, which shrank the letter to under half and made it hard to read
 * against its neighbours; halved, the letter never drops below about seven
 * tenths and the growth is still the clearest channel on the page. */
const SHRINK = 0.29;

/* a symmetric triangle wave on [0,1]: 0 at the ends, 1 in the middle, and
 * continuous through t = 0, so the loop has no seam */
const swell = ph => (ph < 0.5 ? ph * 2 : 2 - ph * 2);

/* ---------------------------------------------------------- the motifs */
export const MOTIFS = {
  /* The growing and shrinking R. Size is the most legible channel there is at
   * thumbnail scale. It is not injective on its own — the letter is the same
   * size at t and at 1 - t — so the phase RING (renderer.js) carries which
   * half of the period a copy is in, and the two together determine it. */
  "r-scale": {
    name: "R, growing and shrinking",
    shape: R_LETTER,
    draw(ctx, ph, r, c, layer) {
      if (layer === "all" || layer === "body") {
        // the socket: full extent, static, phase-independent — both the
        // reference that makes the size readable and what keeps painting
        // order-independent
        trace(ctx, R_LETTER, r);
        ctx.fillStyle = c.socket;
        ctx.fill("evenodd");
      }
      if (layer === "all" || layer === "fill") {
        const k = (1 - SHRINK) + SHRINK * swell(ph);
        trace(ctx, R_LETTER, r, k);
        ctx.fillStyle = c.fill;
        ctx.fill("evenodd");
        ctx.lineWidth = Math.max(0.6, 0.05 * r);
        ctx.strokeStyle = c.outline;
        ctx.stroke();
      }
    },
  },

  /* The comma with a one-way wipe: a sweep line crosses it base to brim once
   * in each half period, always travelling the same way, the colour behind
   * the line going up and ahead of it coming back. Injective on [0,1) and
   * continuous at both handovers. */
  "comma-wipe": {
    name: "comma, one-way wipe",
    shape: COMMA,
    draw(ctx, ph, r, c, layer) {
      if (layer === "all" || layer === "body") {
        trace(ctx, COMMA, r);
        ctx.fillStyle = c.body;
        ctx.fill();
        ctx.lineWidth = Math.max(0.6, 0.045 * r);
        ctx.strokeStyle = c.outline;
        ctx.stroke();
      }
      if (layer === "all" || layer === "fill") {
        const rising = ph < 0.5, p = (ph * 2) % 1;
        const yLine = (COMMA.bot - p * (COMMA.bot - COMMA.top)) * r;
        const yTop = (COMMA.top - 0.2) * r, yBot = (COMMA.bot + 0.2) * r;
        ctx.save();
        trace(ctx, COMMA, r);
        ctx.clip();
        ctx.fillStyle = c.fill;
        if (rising) ctx.fillRect(-1.2 * r, yLine, 2.4 * r, yBot - yLine);
        else ctx.fillRect(-1.2 * r, yTop, 2.4 * r, yLine - yTop);
        ctx.restore();
      }
    },
  },
};

/* WHICH MOTIF THE SITE DRAWS. Change this line, or append ?motif=<key> to any
 * page's URL to compare without editing anything. */
export const DEFAULT_MOTIF = "r-scale";

let active = MOTIFS[DEFAULT_MOTIF];
try {
  const want = new URLSearchParams(location.search).get("motif");
  if (want && MOTIFS[want]) active = MOTIFS[want];
} catch (e) { /* no location (a worker, a test): keep the default */ }

export function setMotif(key) {
  if (MOTIFS[key]) active = MOTIFS[key];
  return active;
}
export function currentMotif() { return active; }

/* ------------------------------------------------------- the public API */
/* The outline of the motif at full extent, for callers that want the shape
 * without the clock: the coloured plates draw a flat silhouette of it. */
export function bodyPath(ctx, r) { trace(ctx, active.shape, r); }

/* theta = internal time in periods (any real); r = motif radius in px */
export function drawMotif(ctx, theta, r, colors, layer = "all") {
  const c = colors || MOTIF_COLORS;
  const ph = ((theta % 1) + 1) % 1;
  ctx.save();
  active.draw(ctx, ph, r, c, layer);
  ctx.restore();
}
