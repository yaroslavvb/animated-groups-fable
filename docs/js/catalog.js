/* Catalog browser: loads data/catalog.json, filterable card grid with
 * lazily-animated canvases (only visible cards animate). */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=9";
import { attachControls } from "./controls.js?v=9";

const state = { groups: [], anims: new Map(), filters: {} };

async function init() {
  const res = await fetch("data/catalog.json", {cache: "no-cache"});
  const data = await res.json();
  state.groups = data.groups;
  state.meta = data.meta;
  buildFilters(data);
  render();
}

function uniq(arr) { return [...new Set(arr)]; }

function buildFilters(data) {
  const bar = document.getElementById("filters");
  const mk = (id, label, values) => {
    const wrap = document.createElement("label");
    wrap.append(label + " ");
    const sel = document.createElement("select");
    sel.id = id;
    sel.append(new Option("all", ""));
    values.forEach(v => sel.append(new Option(v, v)));
    sel.onchange = render;
    wrap.append(sel);
    bar.append(wrap);
  };
  mk("f-system", "system", uniq(state.groups.map(g => g.system)));
  mk("f-base", "spatial base", uniq(state.groups.map(g => g.base)).sort());
  mk("f-time", "time structure", ["forward", "with reversal"]);
  mk("f-sym", "type", ["symmorphic", "nonsymmorphic"]);
  mk("f-prod", "product?", ["product", "not a product"]);
  const count = document.createElement("span");
  count.className = "count";
  count.id = "f-count";
  bar.append(count);
}

function passes(g) {
  const v = id => document.getElementById(id).value;
  if (v("f-system") && g.system !== v("f-system")) return false;
  if (v("f-base") && g.base !== v("f-base")) return false;
  if (v("f-time") === "forward" && !g.forward) return false;
  if (v("f-time") === "with reversal" && g.forward) return false;
  if (v("f-sym") === "symmorphic" && !g.symmorphic) return false;
  if (v("f-sym") === "nonsymmorphic" && g.symmorphic) return false;
  if (v("f-prod") === "product" && !g.product) return false;
  if (v("f-prod") === "not a product" && g.product) return false;
  return true;
}

let observer = null;

function render() {
  const grid = document.getElementById("grid");
  for (const a of state.anims.values()) a.stop();
  state.anims.clear();
  if (observer) observer.disconnect();
  grid.innerHTML = "";

  const shown = state.groups.filter(passes);
  document.getElementById("f-count").textContent =
    `${shown.length} / ${state.groups.length} groups`;

  observer = new IntersectionObserver(onVisible, { rootMargin: "80px" });

  for (const g of shown) {
    const card = document.createElement("div");
    card.className = "gcard";
    card.dataset.gid = g.id;
    const canvas = document.createElement("canvas");
    card.append(canvas);
    const anim = new FilmGroupAnimation(canvas, g.render, { cell: 52 });
    state.anims.set(g.id, anim);
    attachControls(anim, card);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `<span class="sym">${g.symbolHtml}</span>` +
      `<span class="hm">${g.hm || ""}</span>` +
      `<div class="tags">` +
      `<span class="tag">${g.system}</span>` +
      `<span class="tag">base ${g.base}</span>` +
      (g.symmorphic ? "" : `<span class="tag nonsym">nonsymmorphic</span>`) +
      (g.forward ? "" : `<span class="tag rev">time reversal</span>`) +
      (g.product ? `<span class="tag product">product</span>` : "") +
      `</div>`;
    card.append(meta);
    meta.onclick = () => showDetail(g);
    canvas.onclick = () => showDetail(g);
    grid.append(card);
    observer.observe(card);
  }
}

function onVisible(entries) {
  for (const e of entries) {
    const anim = state.anims.get(e.target.dataset.gid);
    if (!anim) continue;
    if (e.isIntersecting) {
      if (!anim.userPaused) anim.start();
      else anim.setPhase(anim.getPhase());  // draw the paused frame once
    } else {
      anim.stop();
    }
  }
}

/* ------- detail modal ------- */
function showDetail(g) {
  const dlg = document.getElementById("detail");
  document.getElementById("d-sym").innerHTML = g.symbolHtml;
  document.getElementById("d-hm").textContent = g.hm || "";
  document.getElementById("d-desc").innerHTML = g.notes || "";
  document.getElementById("d-gens").textContent = g.generators.join("\n");
  const tags = document.getElementById("d-tags");
  tags.innerHTML =
    `<span class="tag">${g.system}</span>` +
    `<span class="tag">base ${g.base}</span>` +
    `<span class="tag">${g.bravais}</span>` +
    (g.symmorphic ? `<span class="tag">symmorphic</span>` : `<span class="tag nonsym">nonsymmorphic</span>`) +
    (g.forward ? `<span class="tag">forward-time</span>` : `<span class="tag rev">time reversal</span>`) +
    (g.product ? `<span class="tag">product type</span>` : `<span class="tag nonsym">not a product</span>`);
  dlg.showModal();
  const canvas = document.getElementById("d-canvas");
  if (state.detailAnim) state.detailAnim.stop();
  state.detailAnim = new FilmGroupAnimation(canvas, g.render, { cell: 80 });
  const cbox = document.getElementById("d-controls");
  cbox.innerHTML = "";
  attachControls(state.detailAnim, cbox);
  state.detailAnim.start();
  dlg.onclose = () => { if (state.detailAnim) state.detailAnim.stop(); };
}

init();
