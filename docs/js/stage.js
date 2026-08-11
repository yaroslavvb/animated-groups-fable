/* The play affordance. Every animation canvas is wrapped in a "stage": the
 * picture itself is the control (animations are paused until the viewer asks
 * for them), plus keyboard scrubbing. Nothing is painted over the pattern —
 * the state is legible from the control bar below and from the motion itself.
 *
 *   attachStage(anim, canvas) -> stage element
 *
 * It wraps `canvas` in <div class="anim-stage"> in place (idempotent — a
 * second attach to the same canvas rebinds it, which the catalog's reused
 * dialog canvas relies on), paints the frozen frame, and binds:
 *
 *   click            play / pause, anywhere in the picture — or, when the
 *                    stage was given a href, follow that link instead
 *   space / enter    the same, once the stage has focus
 *   ← →              jump to the previous / next symmetry instant (or, for a
 *                    loop with no interior marks, step one frame)
 *   ↑ ↓              same, when the stage has focus
 *   shift + arrow    fine step, for looking between the marks
 *   home / end       first / last frame (seek: play or pause is left as it is)
 *
 * The horizontal arrows also work while the pointer merely hovers a stage, so
 * stepping through a loop needs no click. The vertical arrows and space are
 * claimed only once the stage has focus (a click focuses it), so they keep
 * scrolling the page everywhere else.
 */
"use strict";

export const STEP = 1 / 24;    // one "frame" of a 24-frame loop
export const FINE = 1 / 240;   // shift: a tenth of that

/* the stage under the pointer, for hover scrubbing */
let hot = null;
let hotWired = false;

/* The animation the pointer is over, or null. The control bar consults this
 * to keep one rule true everywhere: whichever animation is hovered takes the
 * arrow keys, whatever happens to hold focus. */
export function hoveredAnim() {
  return hot ? hot._anim || null : null;
}

/* opts.href — make the picture a LINK to that URL instead of a play/pause
 * button. Used by the catalog, where a card's picture opens the group's own
 * page; the control bar's play button is untouched and still starts the
 * animation in place, and the arrow keys still scrub. */
export function attachStage(anim, canvas, opts = {}) {
  const stage = wrap(canvas);
  if (stage._detach) stage._detach();   // re-attach: drop the previous binding
  const href = opts.href || null;

  stage.tabIndex = 0;
  stage.setAttribute("role", href ? "link" : "group");
  stage.title = (href
      ? "open this group's page · "
      : "click to play or pause · ") +
    "← → jump between the loop's symmetry instants · " +
    "shift + ← → step frame by frame";

  // the picture is the button — or, given a href, the link
  const onClick = (e) => {
    if (!href) return anim.toggle();
    // let the usual modifiers do what they do everywhere else
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      window.open(href, "_blank");
    } else {
      location.href = href;
    }
  };

  const sync = () => {
    const on = anim.playRequested;
    stage.classList.toggle("playing", on);
    if (href) {
      stage.setAttribute("aria-label", "open this group's page");
      return;
    }
    stage.setAttribute("aria-label", on
      ? "animation, playing — click or press space to pause, arrow keys step"
      : "animation, paused — click or press space to play, arrow keys step");
  };
  anim.onRunChange(sync);

  const onKey = (e) => {
    // the pointer wins the horizontal arrows: whichever stage is hovered is
    // scrubbed by the document handler below, not whichever holds focus
    if (hot && hot !== stage &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    // a linked picture follows its link on enter/space, as a link does
    if (href && (e.key === "Enter" || e.code === "Space")) {
      e.preventDefault();
      location.href = href;
      return;
    }
    handleKey(e, anim, true);
  };
  const onEnter = () => { hot = stage; };
  const onLeave = () => { if (hot === stage) hot = null; };
  // focus on press, so space and the vertical arrows work after a click
  const onDown = () => stage.focus({ preventScroll: true });
  stage.addEventListener("click", onClick);
  stage.addEventListener("keydown", onKey);
  stage.addEventListener("mouseenter", onEnter);
  stage.addEventListener("mouseleave", onLeave);
  stage.addEventListener("mousedown", onDown);

  stage._anim = anim;
  stage._detach = () => {
    stage.removeEventListener("click", onClick);
    stage.removeEventListener("keydown", onKey);
    stage.removeEventListener("mouseenter", onEnter);
    stage.removeEventListener("mouseleave", onLeave);
    stage.removeEventListener("mousedown", onDown);
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
  // Plain arrows hop between the loop's distinguished instants (the marks on
  // the scrub bar) — those are the moments worth landing on. Shift falls back
  // to a fine frame step, for looking at what happens between them.
  const go = (dir) => e.shiftKey ? anim.step(dir * FINE) : anim.stepMark(dir, STEP);
  switch (e.code === "Space" ? " " : e.key) {
    case "ArrowRight": go(+1); break;
    case "ArrowLeft": go(-1); break;
    case "ArrowUp": if (!full) return; go(+1); break;
    case "ArrowDown": if (!full) return; go(-1); break;
    case " ": case "Enter": if (!full) return; anim.toggle(); break;
    // seeking, not scrubbing: play/pause intent is left alone (playback.js)
    case "Home": if (!full) return; anim.reset(); break;
    case "End": if (!full) return; anim.seek(1 - STEP); break;
    default: return;
  }
  e.preventDefault();
}

/* One document-level listener serves hover scrubbing for every stage. It
 * stands down for the hovered stage itself, and for the hovered animation's
 * own control bar (both have listeners of their own, so nothing steps twice),
 * and for form controls belonging to anything else — the catalog's filter
 * selects. A control bar belonging to a DIFFERENT animation is not a blocker:
 * the pointer wins the arrows, which is the same rule the stages follow, and
 * without this a play button left focused on one card would silence the card
 * the reader is actually pointing at. */
function wireHotKeys() {
  if (hotWired) return;
  hotWired = true;
  document.addEventListener("keydown", (e) => {
    if (!hot || !hot._anim) return;
    const ae = document.activeElement;
    if (ae && ae !== document.body) {
      const bar = ae.closest && ae.closest(".anim-controls");
      if (bar) {
        if (bar._anim === hot._anim) return;   // its own bar has the keys
      } else {
        const owner = ae.closest && ae.closest(".anim-stage");
        if (owner) { if (owner === hot) return; }
        else if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(ae.tagName)) return;
        else if (ae.isContentEditable) return;
      }
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
