/* One spacetime group, on its own page: group.html?g=g94
 *
 * Every catalog entry has a URL, so a single group can be linked to,
 * bookmarked and opened in a new tab. The page carries the catalog selection
 * it was reached from as `from`, which does two things: the way back returns
 * to the list the reader was actually browsing, and previous / next walk that
 * same list rather than the whole 275.
 */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=47";
import { colouringKind, KIND } from "./colouring.js?v=47";
import { attachControls } from "./controls.js?v=47";
import { attachStage } from "./stage.js?v=47";
import { WALLPAPERS, timeStory } from "./wallpaper-data.js?v=47";
import { passes, groupHref } from "./filters.js?v=47";
import { nameOf, leadHtml } from "./catalog-names.js?v=47";

const ORB = new Map(WALLPAPERS.map(w => [w.hm, w.orb]));
const baseLabel = hm => `${ORB.get(hm) || ""} · ${hm}`;

const params = new URLSearchParams(location.search);
const id = params.get("g");
const from = params.get("from") || "";
const backHref = "catalog.html" + (from ? "?" + from : "");
const root = document.getElementById("group-page");

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const g = data.groups.find(x => x.id === id);

if (!g) {
  root.innerHTML =
    `<h1>No such group</h1>` +
    `<p class="subtitle">There is no spacetime group with id “${escapeHtml(id || "")}”. ` +
    `The catalog has ${data.groups.length}.</p>` +
    `<p><a href="${backHref}">← back to the catalog</a></p>`;
} else {
  render(g);
}

function render(g) {
  // previous / next within the selection the reader came from, so that
  // stepping through a filtered catalog stays inside it
  const q = new URLSearchParams(from);
  const list = data.groups.filter(x => passes(x, q));
  const i = list.findIndex(x => x.id === g.id);
  const prev = i > 0 ? list[i - 1] : list[list.length - 1];
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : list[0];
  const nav = list.length > 1 && i >= 0
    ? `<a href="${groupHref(prev.id, from)}">← <span class="sym">${leadHtml(prev)}</span></a>` +
      ` &ensp;<span style="color:var(--muted);">${i + 1} of ${list.length}` +
      `${from ? " in this selection" : ""}</span>&ensp; ` +
      `<a href="${groupHref(next.id, from)}"><span class="sym">${leadHtml(next)}</span> →</a>`
    : "";

  document.title = `${g.symbol} — Spacetime Groups`;
  root.innerHTML =
    (() => { const n = nameOf(g);
      return `<h1><span class="sym">${n.lead}</span>` +
        n.tail.map((t, i) => ` <span class="sym" style="color:var(--muted);` +
          `font-size:${i ? 0.5 : 0.6}em;">${t}</span>`).join("") +
        `</h1>`; })() +
    `<p><a href="${backHref}">← catalog</a>` +
    (nav ? ` &ensp;·&ensp; ${nav}` : "") + `</p>` +
    `<div class="tags" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.6rem 0 1rem;">` +
      `<span class="tag">${g.system}</span>` +
      `<span class="tag">${g.bravais}</span>` +
      `<span class="tag">base ${baseLabel(g.base)}</span>` +
      (() => { const k = colouringKind(g);
        return `<span class="tag kind-${k}" title="${KIND[k].title}">` +
               `${KIND[k].label}</span>`; })() +
      (g.product ? `<span class="tag">product type</span>` : "") +
    `</div>` +
    `<div class="demo" id="gp-demo"><canvas id="gp-canvas"></canvas></div>` +
    `<p>${timeStory(g)}</p>` +
    (g.notes ? `<p>${g.notes}</p>` : "") +
    `<h2>Generators <span style="color:var(--muted);font-weight:normal;` +
      `font-size:0.7em;">(x in lattice coordinates, t in periods)</span></h2>` +
    `<div class="genbox">${escapeHtml(g.generators.join("\n"))}</div>` +
    `<p><a href="wallpaper-group.html?g=${g.base}">` +
      `All spacetime groups over <span class="sym">${ORB.get(g.base) || ""}</span> ` +
      `${g.base} →</a></p>`;

  // the animation last, once its box is in the document and has a width
  const canvas = document.getElementById("gp-canvas");
  const anim = new FilmGroupAnimation(canvas, g.render);
  attachStage(anim, canvas);           // here the picture IS the play button
  attachControls(anim, document.getElementById("gp-demo"));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
