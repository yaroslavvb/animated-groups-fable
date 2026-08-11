/* Catalog browser: loads data/catalog.json, filterable card grid with
 * lazily-animated canvases. Cards start paused showing their first frame;
 * visibility only decides whether an animation the viewer has started is
 * actually burning frames. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=27";
import { attachControls } from "./controls.js?v=27";
import { WALLPAPERS } from "./wallpaper-data.js?v=27";

const ORB = new Map(WALLPAPERS.map(w => [w.hm, w.orb]));
const baseLabel = hm => `${ORB.get(hm) || ""} · ${hm}`;
import { attachStage } from "./stage.js?v=27";

const state = { groups: [], anims: new Map(), filters: {} };

async function init() {
  const res = await fetch("data/catalog.json", {cache: "no-cache"});
  const data = await res.json();
  state.groups = data.groups;
  state.meta = data.meta;
  buildFilters(data);
  applyUrl();
  window.addEventListener("popstate", applyUrl);
  window.addEventListener("hashchange", openFromHash);
}

/* ------------------------------------------------------ filters in the URL
 * A selection is a view of the catalog, so it lives in the query string and
 * is therefore linkable and bookmarkable: catalog.html?time=forward is the
 * 68 forward-time groups, ?base=p4m&type=nonsymmorphic the nonsymmorphic ones
 * over p4m. Filters left at "all" are omitted, so the bare catalog.html URL
 * stays clean, and a value the enumeration does not offer (a hand-edited or
 * stale link) falls back to "all" rather than showing an empty grid. */
const URL_FILTERS = [
  ["f-system", "system"],
  ["f-base", "base"],
  ["f-time", "time"],
  ["f-sym", "type"],
  ["f-prod", "product"],
];

function filtersToUrl() {
  const q = new URLSearchParams();
  for (const [id, key] of URL_FILTERS) {
    const v = document.getElementById(id).value;
    if (v) q.set(key, v);
  }
  const s = q.toString();
  return location.pathname + (s ? "?" + s : "");
}

/* a new selection is a new page of the catalog and gets its own history entry,
 * so Back returns to the previous one. The #gN detail anchor is dropped: it
 * points into the list that has just been replaced. */
function filtersChanged() {
  history.pushState(null, "", filtersToUrl());
  render();
}

function applyUrl() {
  const q = new URLSearchParams(location.search);
  for (const [id, key] of URL_FILTERS) {
    const sel = document.getElementById(id);
    const want = q.get(key) || "";
    sel.value = [...sel.options].some(o => o.value === want) ? want : "";
  }
  render();
  openFromHash();
}

/* deep links: catalog.html#g94 scrolls to the card and opens its detail
 * modal (used by the notation examples and the wallpaper atlas) */
function openFromHash() {
  const id = location.hash.replace(/^#/, "");
  if (!id) return;
  const g = state.groups.find(x => x.id === id);
  if (!g) return;
  const card = document.querySelector(`[data-gid="${id}"]`);
  if (card) card.scrollIntoView({ block: "center", behavior: "instant" });
  showDetail(g);
}

function uniq(arr) { return [...new Set(arr)]; }

function buildFilters(data) {
  const bar = document.getElementById("filters");
  const mk = (id, label, values, labelOf = null) => {
    const wrap = document.createElement("label");
    wrap.append(label + " ");
    const sel = document.createElement("select");
    sel.id = id;
    sel.append(new Option("all", ""));
    values.forEach(v => sel.append(new Option(labelOf ? labelOf(v) : v, v)));
    sel.onchange = filtersChanged;
    wrap.append(sel);
    bar.append(wrap);
  };
  mk("f-system", "system", uniq(state.groups.map(g => g.system)));
  mk("f-base", "spatial base", uniq(state.groups.map(g => g.base)).sort(),
     hm => baseLabel(hm));
  mk("f-time", "time structure", ["forward", "with reversal"],
     v => v === "forward" ? "clockwork (forward time)" : v);
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
    grid.append(card);   // attach before constructing: geometry reads clientWidth
    const anim = new FilmGroupAnimation(canvas, g.render);
    state.anims.set(g.id, anim);
    attachStage(anim, canvas);   // play button + keyboard, paints the still frame
    attachControls(anim, card);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `<span class="sym">${g.symbolHtml}</span>` +
      `<span class="hm">${g.hm || ""}</span>` +
      `<div class="tags">` +
      `<span class="tag">${g.system}</span>` +
      `<span class="tag">base ${baseLabel(g.base)}</span>` +
      (g.symmorphic ? "" : `<span class="tag nonsym">nonsymmorphic</span>`) +
      (g.forward ? "" : `<span class="tag rev">time reversal</span>`) +
      (g.product ? `<span class="tag product">product</span>` : "") +
      `</div>`;
    card.append(meta);
    // the picture toggles playback (stage.js), so the caption is what opens
    // the detail modal
    meta.onclick = () => showDetail(g);
    observer.observe(card);
  }
}

function onVisible(entries) {
  for (const e of entries) {
    const anim = state.anims.get(e.target.dataset.gid);
    if (!anim) continue;
    if (e.isIntersecting) {
      if (anim.playRequested) anim.start();
      else anim.drawStatic();   // paused: show the frozen frame
    } else {
      anim.stop();              // leaves playRequested alone: it resumes
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
    `<span class="tag">base ${baseLabel(g.base)}</span>` +
    `<span class="tag">${g.bravais}</span>` +
    (g.symmorphic ? `<span class="tag">symmorphic</span>` : `<span class="tag nonsym">nonsymmorphic</span>`) +
    (g.forward ? `<span class="tag">clockwork</span>` : `<span class="tag rev">time reversal</span>`) +
    (g.product ? `<span class="tag">product type</span>` : `<span class="tag nonsym">not a product</span>`);
  dlg.showModal();
  const canvas = document.getElementById("d-canvas");
  if (state.detailAnim) state.detailAnim.stop();
  state.detailAnim = new FilmGroupAnimation(canvas, g.render);
  attachStage(state.detailAnim, canvas);   // the dialog canvas is reused;
                                           // attachStage replaces its overlay
  const cbox = document.getElementById("d-controls");
  cbox.innerHTML = "";
  attachControls(state.detailAnim, cbox);
  dlg.onclose = () => { if (state.detailAnim) state.detailAnim.stop(); };
}

init();
