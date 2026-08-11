/* Static COLOURED renderings of film-group specs: paint every copy of the
 * motif by its clock data instead of animating it. This is the dictionary
 * the future-directions tutorial draws: colour = phase.
 *
 *   mode "phase": body hue = tau * 360deg (the copy's time offset), so a
 *     film group with clock denominator N paints a perfect Z_N colouring
 *     of its wallpaper projection; time-reversed copies (s = -1), whose
 *     phase is only defined up to sign, are drawn hollow with a hue ring.
 *   mode "bw": black / white by the time sign s — the Shubnikov picture,
 *     colour swap = play backwards.
 *
 * Geometry (cell size, motif radius, placements) is borrowed from a
 * FilmGroupAnimation that is constructed but never started. */
"use strict";
import { FilmGroupAnimation, bodyPath } from "./renderer.js?v=27";
import { orbitPlacements } from "./orbit.js?v=27";

const frac = x => ((x % 1) + 1) % 1;

function hueOf(tau) {
  return Math.round(frac(tau) * 360);
}

export function paintColored(canvas, spec, mode = "phase") {
  const anim = new FilmGroupAnimation(canvas, spec);   // geometry only
  const ctx = canvas.getContext("2d");
  const { w, h, dpr } = anim;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#faf9f6";
  ctx.fillRect(0, 0, w, h);
  if (!anim.specCheck.ok) { ctx.restore(); return anim; }
  ctx.translate(w / 2, h / 2);

  const placements = orbitPlacements(
    anim.spec, anim.m1range[0], anim.m1range[1],
    anim.m2range[0], anim.m2range[1]);
  const b1 = anim.b1, b2 = anim.b2, r = anim.motifR;
  for (const pl of placements) {
    const px = pl.pos[0] * b1[0] + pl.pos[1] * b2[0];
    const py = pl.pos[0] * b1[1] + pl.pos[1] * b2[1];
    if (px < -w / 2 - 3 * r || px > w / 2 + 3 * r ||
        py < -h / 2 - 3 * r || py > h / 2 + 3 * r) continue;
    // pixel transform of the copy's spatial part
    const det = b1[0] * b2[1] - b2[0] * b1[1];
    const Bi = [[b2[1] / det, -b2[0] / det], [-b1[1] / det, b1[0] / det]];
    const A = pl.A;
    const BA = [[b1[0] * A[0][0] + b2[0] * A[1][0], b1[0] * A[0][1] + b2[0] * A[1][1]],
                [b1[1] * A[0][0] + b2[1] * A[1][0], b1[1] * A[0][1] + b2[1] * A[1][1]]];
    const T = [[BA[0][0] * Bi[0][0] + BA[0][1] * Bi[1][0], BA[0][0] * Bi[0][1] + BA[0][1] * Bi[1][1]],
               [BA[1][0] * Bi[0][0] + BA[1][1] * Bi[1][0], BA[1][0] * Bi[0][1] + BA[1][1] * Bi[1][1]]];
    ctx.save();
    ctx.translate(px, py);
    ctx.transform(T[0][0], T[1][0], T[0][1], T[1][1], 0, 0);
    bodyPath(ctx, r);
    if (mode === "bw") {
      ctx.fillStyle = pl.s === 1 ? "#1f2430" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.06 * r);
      ctx.strokeStyle = "#1f2430";
      ctx.stroke();
    } else if (pl.s === 1) {
      ctx.fillStyle = `hsl(${hueOf(pl.tau)}, 62%, 55%)`;
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, 0.045 * r);
      ctx.strokeStyle = "rgba(30,36,48,0.55)";
      ctx.stroke();
    } else {
      // reversed copy: phase defined only up to sign — hollow, hue ring
      ctx.fillStyle = "#faf9f6";
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, 0.09 * r);
      ctx.strokeStyle = `hsl(${hueOf(pl.tau)}, 62%, 45%)`;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return anim;
}
