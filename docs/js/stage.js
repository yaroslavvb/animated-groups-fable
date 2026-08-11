/* The play affordance. Every animation canvas is wrapped in a "stage": a
 * positioned box carrying a prominent play button (animations are paused
 * until the viewer asks for them) and keyboard scrubbing.
 *
 *   attachStage(anim, canvas) -> stage element
 *
 * It wraps `canvas` in <div class="anim-stage"> in place (idempotent — a
 * second attach to the same canvas replaces the previous overlay, which the
 * catalog's reused dialog canvas relies on), paints the frozen first frame,
 * and binds:
 *
 *   ← →              step one frame back / forward
 *   ↑ ↓              same, when the stage has focus
 *   shift + arrow    fine step
 *   space / enter    play / pause
 *   home / end       first / last frame
 *
 * The horizontal arrows also work while the pointer merely hovers a stage, so
 * stepping through a loop needs no click. The vertical arrows and space are
 * claimed only once the stage has focus, so they keep scrolling the page
 * everywhere else.
 */
"use strict";

export const STEP = 1 / 24;    // one "frame" of a 24-frame loop
export const FINE = 1 / 240;   // shift: a tenth of that

/* the stage under the pointer, for hover scrubbing */
let hot = null;
let hotWired = false;

export function attachStage(anim, canvas) {
  const stage = wrap(canvas);
  if (stage._detach) stage._detach();   // re-attach: drop the previous binding

  stage.tabIndex = 0;
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label",
    "animation — press play, or step through the loop with the arrow keys");
  stage.title = "← → step through the loop · space plays once focused";
  // strips and other short canvases get the compact button
  stage.classList.toggle("small", (canvas.clientHeight || 999) < 150);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "play-overlay";
  btn.innerHTML = '<span class="po-glyph">▶</span><span class="po-label">Play</span>';
  btn.addEventListener("click", (e) => {
    e.stopPropagation();   // catalog cards open a modal on canvas click
    // toggle, not play: while running this button is labelled "pause", and
    // assistive technology activates it with a synthesized click
    anim.toggle();
    stage.focus({ preventScroll: true });
  });
  stage.append(btn);

  const sync = () => {
    const on = anim.playRequested;
    stage.classList.toggle("playing", on);
    btn.setAttribute("aria-label", on ? "Pause animation" : "Play animation");
    // while playing the button is veiled to opacity 0: keep it out of the tab
    // order, and never strand focus on something nobody can see
    btn.tabIndex = on ? -1 : 0;
    if (on && document.activeElement === btn) {
      stage.focus({ preventScroll: true });
    }
  };
  anim.onRunChange(sync);

  const onKey = (e) => {
    // the pointer wins the horizontal arrows: whichever stage is hovered is
    // scrubbed by the document handler below, not whichever holds focus
    if (hot && hot !== stage &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    handleKey(e, anim, true);
  };
  const onEnter = () => { hot = stage; };
  const onLeave = () => { if (hot === stage) hot = null; };
  const onDown = () => stage.focus({ preventScroll: true });
  stage.addEventListener("keydown", onKey);
  stage.addEventListener("mouseenter", onEnter);
  stage.addEventListener("mouseleave", onLeave);
  stage.addEventListener("mousedown", onDown);

  stage._anim = anim;
  stage._detach = () => {
    stage.removeEventListener("keydown", onKey);
    stage.removeEventListener("mouseenter", onEnter);
    stage.removeEventListener("mouseleave", onLeave);
    stage.removeEventListener("mousedown", onDown);
    btn.remove();
    if (hot === stage) hot = null;
    stage._detach = null;
  };

  wireHotKeys();
  anim.drawStatic();   // never leave a paused canvas blank
  return stage;
}

/* Keyboard handling shared by the focused stage and the hovered one.
 * `full` is false for hover, where only the horizontal arrows are claimed. */
function handleKey(e, anim, full) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const d = e.shiftKey ? FINE : STEP;
  switch (e.code === "Space" ? " " : e.key) {
    case "ArrowRight": anim.step(+d); break;
    case "ArrowLeft": anim.step(-d); break;
    case "ArrowUp": if (!full) return; anim.step(+d); break;
    case "ArrowDown": if (!full) return; anim.step(-d); break;
    case " ": case "Enter": if (!full) return; anim.toggle(); break;
    case "Home": if (!full) return; anim.pause(); anim.setPhase(0); break;
    case "End": if (!full) return; anim.pause(); anim.setPhase(1 - STEP); break;
    default: return;
  }
  e.preventDefault();
}

/* One document-level listener serves hover scrubbing for every stage. It
 * stands down for the hovered stage itself (whose own listener handles the
 * keys, so nothing steps twice) and for form controls outside any stage —
 * the scrub slider's arrow keys, the catalog's filter selects. */
function wireHotKeys() {
  if (hotWired) return;
  hotWired = true;
  document.addEventListener("keydown", (e) => {
    if (!hot || !hot._anim) return;
    const ae = document.activeElement;
    if (ae && ae !== document.body) {
      const owner = ae.closest && ae.closest(".anim-stage");
      if (owner) { if (owner === hot) return; }
      else if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(ae.tagName)) return;
      else if (ae.isContentEditable) return;
    }
    handleKey(e, hot._anim, false);
  });
}

/* Put the canvas inside a positioned box, keeping its place in the DOM. The
 * box is a plain block, so the `.gcard canvas` / `.demo canvas` sizing rules
 * still reach the canvas and its measured size does not change. */
function wrap(canvas) {
  const parent = canvas.parentElement;
  if (parent && parent.classList.contains("anim-stage")) return parent;
  const stage = document.createElement("div");
  stage.className = "anim-stage";
  if (parent) parent.insertBefore(stage, canvas);
  stage.append(canvas);
  return stage;
}
