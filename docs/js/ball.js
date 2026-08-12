/* The ball glyph, and the ground it is drawn on.
 *
 * Two pages draw the same object — the Billiards animation and the Designer's live
 * preview — and it is the same object in both: a ball wearing its own clock.
 * The colour grows out of the centre over the first half of the period and is
 * eaten away from the centre over the second, so a dot is a ball just
 * starting, a full disk with a pinhole is one just past halfway, and a thin
 * ring is one nearly done.
 *
 * The fill is RADIAL rather than rotational for a reason that is easy to lose:
 * a turning marker inside a pattern with rotational symmetry cannot be read at
 * all, because the motif's own rotation aliases against the group's.
 *
 * The ground is the site's paper colour rather than the theme's, on both pages
 * and in the exported GIFs, so a frame lifted out of any of them is the same
 * picture.
 */
"use strict";

export const GROUND = "#faf9f6";
export const EDGE = "#464c58";

const TWO_PI = Math.PI * 2;

/* Sub-pixel fills are invisible and cost a path each; below this the growing
 * dot and the shrinking pinhole are simply not drawn. */
const MIN_FILL = 0.4;

export function drawBall(ctx, x, y, R, phase, colour) {
  const ph = ((phase % 1) + 1) % 1;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TWO_PI);
  ctx.fillStyle = GROUND;
  ctx.fill();
  if (ph < 0.5) {
    const rr = R * 2 * ph;
    if (rr > MIN_FILL) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TWO_PI);
      ctx.fillStyle = colour;
      ctx.fill();
    }
  } else {
    ctx.fillStyle = colour;
    ctx.fill();
    const rr = R * (2 * ph - 1);
    if (rr > MIN_FILL) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TWO_PI);
      ctx.fillStyle = GROUND;
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TWO_PI);
  ctx.lineWidth = Math.max(1, R * 0.16);
  ctx.strokeStyle = EDGE;
  ctx.stroke();
}
