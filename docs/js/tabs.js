/* Shared tabbed-demo widget (the notation-page tab structure): a bar of
 * symbol tabs, below it one live animation with a caption box (symbol, HM
 * operator, tags, catalog link, explanatory note). Animations are created
 * lazily on first activation — a display:none canvas has no size — and an
 * IntersectionObserver starts/stops them with visibility, which also covers
 * tab switches (a hidden pane never intersects). */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=15";
import { attachControls } from "./controls.js?v=15";
import { groupCaption } from "./wallpaper-data.js?v=15";

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) { if (!anim.userPaused) anim.start(); }
    else anim.stop();
  }
}, { rootMargin: "60px" });

/* items: [{ g: catalog group or null, sym: label if g is missing, note: html }] */
export function buildTabs(host, items) {
  const bar = document.createElement("div");
  bar.className = "tabbar";
  const paneBox = document.createElement("div");
  const panes = [];

  items.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tabbtn sym";
    btn.innerHTML = item.g ? item.g.symbolHtml : item.sym;
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
        attachControls(anim, pane, cap);
        anims.set(canvas, anim);
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
  }

  host.append(bar, paneBox);
  activate(0);
}
