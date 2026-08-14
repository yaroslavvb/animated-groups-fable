/* Shared tabbed-demo widget (the notation-page tab structure): a bar of
 * symbol tabs, below it one live animation with a caption box (symbol, HM
 * operator, tags, catalog link, explanatory note). Animations are created
 * lazily on first activation — a display:none canvas has no size — and start
 * paused on their first frame; the IntersectionObserver resumes only the ones
 * the viewer has started, which also covers tab switches (a hidden pane never
 * intersects). */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=42";
import { attachControls } from "./controls.js?v=42";
import { attachStage } from "./stage.js?v=42";
import { groupCaption, isTrivialClock } from "./wallpaper-data.js?v=42";

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) {
      if (anim.playRequested) anim.start(); else anim.drawStatic();
    } else anim.stop();
  }
}, { rootMargin: "60px" });

/* items: [{ g: catalog group or null, sym: label if g is missing, note: html }]
 *
 * opts.split — draw the row as TWO runs: the groups with no time reversal
 * first, tinted green, then the groups that reverse time, in the usual grey,
 * starting on a line of their own. The wallpaper atlas passes it, where the
 * list is every spacetime group over one wallpaper and that distinction is the
 * first thing worth seeing. The notation page does not: its tabs are chosen
 * examples in a deliberate teaching order, and a split down the middle of a
 * worked argument would be noise. Callers that pass it are expected to have
 * sorted with sectionSort, which lays the two runs out in that order.
 */
export function buildTabs(host, items, opts = {}) {
  const bar = document.createElement("div");
  bar.className = "tabbar";
  const paneBox = document.createElement("div");
  const panes = [];
  const isTrivial = it => !!(it.g && isTrivialClock(it.g));

  // The trivial clock goes last. With runs, sectionSort has already put it at
  // the end of the forward one — moving it past the reversal tabs would put a
  // forward group in the reversal run and make the colouring lie. Without
  // runs, it simply goes to the end, and the rest keep their order: on the
  // notation page that order is the argument being made, not a sort.
  const list = opts.split
    ? items
    : [...items.filter(it => !isTrivial(it)), ...items.filter(isTrivial)];

  list.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    // the trivial clock is greyed: it sits at the end as the baseline — the
    // wallpaper with a clock bolted on, nothing entangled — and should not
    // read as one more case to work through
    const trivial = isTrivial(item);
    const rev = opts.split && item.g && !item.g.forward;
    btn.className = "tabbtn sym" + (trivial ? " trivial" : "") +
      (opts.split ? (rev ? " rev" : " fwd") : "");
    if (trivial) btn.title = "the trivial case: this spacetime group is identical " +
      "to the wallpaper group — every copy in phase forever, so every instant " +
      "is the wallpaper itself";
    // the reversal run starts on a line of its own
    if (rev && !bar.querySelector(".tabbtn.rev")) {
      const brk = document.createElement("span");
      brk.className = "tabsplit";
      brk.setAttribute("aria-hidden", "true");
      bar.append(brk);
    }
    btn.innerHTML = item.g
      ? (opts.label ? opts.label(item.g) : item.g.symbolHtml)
      : item.sym;
    const pane = document.createElement("div");
    pane.className = "tabpane";
    if (!item.g) {
      pane.innerHTML = `<div class="caption">symbol “${item.sym}” not found \
in catalog.json — out of sync with the enumeration</div>`;
      console.error("tab symbol missing from catalog:", item.sym);
    } else {
      const canvas = document.createElement("canvas");
      pane.append(canvas);
      const cap = document.createElement("div");
      cap.className = "caption";
      cap.innerHTML = groupCaption(item.g) +
        (item.note ? `<p style="margin:0.4rem 0 0;">${item.note}</p>` : "");
      pane.append(cap);
      pane._mk = () => {
        const anim = new FilmGroupAnimation(canvas, item.g.render);
        attachStage(anim, canvas);
        attachControls(anim, pane, cap);
        anims.set(canvas, anim);
        pane._anim = anim;
        observer.observe(canvas);
      };
    }
    btn.addEventListener("click", () => activate(i));
    bar.append(btn);
    paneBox.append(pane);
    panes.push({ btn, pane });
  });

  function activate(k) {
    panes.forEach(({ btn, pane }, i) => {
      btn.classList.toggle("active", i === k);
      pane.classList.toggle("active", i === k);
    });
    const p = panes[k].pane;
    if (p._mk) { p._mk(); p._mk = null; }
    // A tab is a fresh look at a different group, not a return to where this
    // one was left: rewind it, so two tabs are always compared at the same
    // instant of their loops rather than at whatever phase each was abandoned.
    if (p._anim) p._anim.reset();
  }

  host.append(bar, paneBox);
  // Open on the first tab that is a case to work through, which is index 0
  // everywhere EXCEPT the three wallpapers whose only forward-time spacetime group
  // is the trivial clock — p1, pm, pg. There the trivial tab leads its run and
  // so leads the row, and opening a section on the one group where "what can
  // time do here?" answers "nothing" is exactly what ordering it last is for.
  const first = list.findIndex(it => !isTrivial(it));
  activate(first < 0 ? 0 : first);
}
