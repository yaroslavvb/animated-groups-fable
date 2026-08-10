/* Playback controls for FilmGroupAnimation / StripAnimation.
 * attachControls(anim, host): inserts a play/pause + scrub bar into `host`
 * (appended at the end unless `before` is given). Dragging the slider pauses
 * and scrubs; arrow keys on the focused slider step finely; the play button
 * resumes from the scrubbed phase. Visibility-based autostart elsewhere must
 * respect anim.userPaused.
 */
"use strict";

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
  slider.title = "scrub (arrow keys for fine steps)";

  const label = document.createElement("span");
  label.className = "ac-label";

  const setBtn = () => { btn.textContent = anim.running ? "❚❚" : "▶"; };
  const setLabel = (t) => { label.textContent = "t = " + t.toFixed(2) + " T"; };

  btn.addEventListener("click", () => {
    if (anim.running) {
      anim.userPaused = true;
      anim.stop();
    } else {
      anim.userPaused = false;
      anim.start();
    }
    setBtn();
  });

  slider.addEventListener("input", () => {
    if (anim.running) {          // scrubbing pauses playback
      anim.userPaused = true;
      anim.stop();
      setBtn();
    }
    anim.setPhase(Number(slider.value) / RES);
  });

  anim.onTick = (t) => {
    slider.value = String(Math.round(t * RES) % RES);
    setLabel(t);
    // keep the button glyph honest if something else started/stopped us
    const want = anim.running ? "❚❚" : "▶";
    if (btn.textContent !== want) btn.textContent = want;
  };

  setBtn();
  setLabel(anim.getPhase ? anim.getPhase() : 0);

  bar.append(btn, slider, label);
  if (before) host.insertBefore(bar, before);
  else host.append(bar);
  return bar;
}
