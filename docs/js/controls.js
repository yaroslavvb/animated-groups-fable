/* Playback controls for FilmGroupAnimation / StripAnimation.
 * attachControls(anim, host): inserts a play/pause + scrub bar into `host`
 * (appended at the end unless `before` is given). Animations start paused —
 * the big overlay button on the canvas (stage.js) and this bar are the two
 * ways to start one. Dragging the slider scrubs and takes over from playback;
 * arrow keys on the focused slider step a frame at a time (shift: finer),
 * matching the stage's keyboard. The button glyph follows viewer intent
 * (anim.playRequested), not the rAF loop, so scrolling an animation off
 * screen does not make it look paused.
 */
"use strict";
import { STEP, FINE } from "./stage.js?v=17";

const RES = 1000;  // slider resolution

export function attachControls(anim, host, before = null) {
  const bar = document.createElement("div");
  bar.className = "anim-controls";

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
  slider.title = "scrub — arrow keys step a frame, shift for fine steps";

  const label = document.createElement("span");
  label.className = "ac-label";

  const setLabel = (t) => { label.textContent = "t = " + t.toFixed(2) + " T"; };

  btn.addEventListener("click", () => anim.toggle());

  slider.addEventListener("input", () => {
    anim.pause();                // scrubbing takes over from playback
    anim.setPhase(Number(slider.value) / RES);
  });

  // arrow keys on the slider step by frames, not by 1/1000 of a period
  slider.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const d = e.shiftKey ? FINE : STEP;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") anim.step(+d);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") anim.step(-d);
    else if (e.key === "Home") { anim.pause(); anim.setPhase(0); }
    else if (e.key === "End") { anim.pause(); anim.setPhase(1 - STEP); }
    else return;
    e.preventDefault();
  });

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

  bar.append(btn, slider, label);
  if (before) host.insertBefore(bar, before);
  else host.append(bar);
  return bar;
}
