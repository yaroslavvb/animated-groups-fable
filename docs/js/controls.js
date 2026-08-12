/* Playback controls for FilmGroupAnimation / StripAnimation.
 * attachControls(anim, host): inserts a reset + play/pause + scrub bar into
 * `host` (appended at the end unless `before` is given). Animations start
 * paused — the picture itself (stage.js) and this bar are the two ways to
 * start one. Dragging the slider scrubs and takes over from playback; the
 * arrow keys work from ANY control in the bar, not just the slider, because
 * clicking play focuses that button and a focused button is precisely what
 * the stage's hover-scrub handler stands down for. They hop between the
 * symmetry marks (shift: a fine frame step), matching the stage's keyboard.
 * The button glyph follows viewer intent (anim.playRequested), not the rAF
 * loop, so scrolling an animation off screen does not make it look paused.
 *
 * Under the slider sits the group's TIME-SYMMETRY RULER (phases.js): a tick
 * at every distinguished instant of the loop, each one a jump target.
 *   beat marks (│, labelled)  t = k/N — the pattern here is the pattern at
 *                             t = 0 moved by a spatial operation
 *   mirror marks (◆)          fixed points of a time reversal: the film is
 *                             palindromic about this instant
 * Seeking a mark leaves play/pause alone (Playback.seek), so a mark can be
 * clicked mid-play to restart the loop from a symmetric instant. Groups with
 * nothing to mark but t = 0 get no ruler.
 */
"use strict";
import { STEP, FINE, hoveredAnim } from "./stage.js?v=39";

const RES = 1000;  // slider resolution
const THUMB = 14;  // assumed slider thumb width (px), for aligning the ruler

export function attachControls(anim, host, before = null) {
  const bar = document.createElement("div");
  bar.className = "anim-controls";
  bar._anim = anim;   // stage.js's hover handler asks whose bar this is

  const rst = document.createElement("button");
  rst.type = "button";
  rst.className = "ac-btn";
  rst.textContent = "⏮";
  rst.title = "reset to the beginning of the loop (t = 0)";
  rst.setAttribute("aria-label", "reset animation to the beginning");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn";
  btn.title = "play / pause";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(RES - 1);
  slider.step = "1";
  slider.value = "0";
  slider.className = "ac-slider";
  slider.title = "scrub — arrow keys jump between the symmetry marks, " +
                 "shift for a fine frame step";

  const label = document.createElement("span");
  label.className = "ac-label";

  const setLabel = (t) => { label.textContent = "t = " + t.toFixed(2) + " T"; };

  rst.addEventListener("click", () => anim.reset());
  btn.addEventListener("click", () => anim.toggle());

  slider.addEventListener("input", () => {
    anim.pause();                // scrubbing takes over from playback
    anim.setPhase(Number(slider.value) / RES);
  });

  // The arrow keys belong to the WHOLE BAR, not just the slider. Clicking the
  // play button focuses it, and a focused button is exactly the case
  // stage.js's document-level hover handler stands down for — so with the
  // listener on the slider alone, pressing space to play and then reaching for
  // the arrows did nothing at all. Here they hop between the symmetry marks
  // (shift: a fine frame step), matching the stage's keyboard, from whichever
  // control happens to hold focus.
  bar.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // the pointer still wins: a different animation under the cursor takes the
    // arrows, as it does when the focus is on a stage
    const over = hoveredAnim();
    if (over && over !== anim) return;
    const go = (dir) =>
      e.shiftKey ? anim.step(dir * FINE) : anim.stepMark(dir, STEP);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") go(+1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") go(-1);
    else if (e.key === "Home") anim.reset();
    else if (e.key === "End") anim.seek(1 - STEP);
    else return;
    e.preventDefault();
  });

  // the scrub column: slider, and under it the symmetry ruler
  const col = document.createElement("div");
  col.className = "ac-col";
  col.append(slider);
  const ruler = buildRuler(anim);
  if (ruler) col.append(ruler);

  anim.onTick = (t) => {
    slider.value = String(Math.round(t * RES) % RES);
    setLabel(t);
  };

  // the glyph tracks intent; onRunChange fires once immediately
  anim.onRunChange(() => {
    btn.textContent = anim.playRequested ? "❚❚" : "▶";
    btn.setAttribute("aria-label",
      anim.playRequested ? "pause animation" : "play animation");
  });
  setLabel(anim.getPhase ? anim.getPhase() : 0);

  bar.append(rst, btn, col, label);
  if (before) host.insertBefore(bar, before);
  else host.append(bar);
  return bar;
}

/* The ruler of distinguished instants, or null when the only one is t = 0.
 * Marks are positioned along the thumb's travel, not the full track width,
 * so a tick sits under the thumb when the animation is at that instant. */
function buildRuler(anim) {
  const sym = anim.timeSym;
  if (!sym || !sym.marks || sym.marks.length < 2) return null;
  const wrap = document.createElement("div");
  wrap.className = "ac-marks";
  // beat labels are worth showing; with reversals present the mirror marks
  // interleave at every half-beat and would crowd the row, so those carry
  // their instant in the tooltip only
  for (const m of sym.marks) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ac-mark ac-mark-" + m.kind;
    b.style.left =
      `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${m.t})`;
    b.title = m.kind === "mirror"
      ? `t = ${m.label} T — time mirror: the loop is palindromic about this instant`
      : `t = ${m.label} T — the pattern here is the pattern at t = 0, moved by a symmetry`;
    b.tabIndex = -1;   // reachable by pointer; by keyboard via page up / down
    b.setAttribute("aria-label", "jump to t = " + m.label + " periods");
    if (m.kind !== "mirror") {
      const lab = document.createElement("span");
      lab.className = "ac-mark-label";
      lab.textContent = m.label;
      b.append(lab);
    }
    b.addEventListener("click", () => anim.seek(m.t));
    wrap.append(b);
  }
  return wrap;
}
