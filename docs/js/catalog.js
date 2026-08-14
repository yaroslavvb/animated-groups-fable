/* Catalog browser: loads data/catalog.json, filterable card grid with
 * lazily-animated canvases. Cards start paused showing their first frame;
 * visibility only decides whether an animation the viewer has started is
 * actually burning frames. Each card is a link to that group's own page
 * (group.html?g=…) — picture and caption both — and the card's control bar
 * keeps play/pause and scrubbing in place. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=43";
import { attachControls } from "./controls.js?v=43";
import { WALLPAPERS } from "./wallpaper-data.js?v=43";
import { FILTER_KEYS, passes, groupHref } from "./filters.js?v=43";
import { nameOf } from "./catalog-names.js?v=43";
import { colouringKind, KIND } from "./colouring.js?v=43";

const ORB = new Map(WALLPAPERS.map(w => [w.hm, w.orb]));
const baseLabel = hm => `${ORB.get(hm) || ""} · ${hm}`;
import { attachStage } from "./stage.js?v=43";



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
 * 68 forward-time groups, ?base=p4m&colouring=dihedral the ones over p4m
 * whose clock colours by phase and direction together. Filters left at "all" are omitted, so the bare catalog.html URL
 * stays clean, and a value the enumeration does not offer (a hand-edited or
 * stale link) falls back to "all" rather than showing an empty grid. */
/* the selection the controls currently express, as query parameters — the one
 * representation of it, shared with the group pages via filters.js */
function currentQuery() {
  const q = new URLSearchParams();
  for (const [id, key] of FILTER_KEYS) {
    const v = document.getElementById(id).value;
    if (v) q.set(key, v);
  }
  return q;
}

function filtersToUrl() {
  const s = currentQuery().toString();
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
  for (const [id, key] of FILTER_KEYS) {
    const sel = document.getElementById(id);
    const want = q.get(key) || "";
    sel.value = [...sel.options].some(o => o.value === want) ? want : "";
  }
  render();
  openFromHash();
}

/* Old deep links: catalog.html#g94 used to scroll to a card and open a modal.
 * Groups now have real pages, so the anchor forwards to one — links from the
 * notation examples and the wallpaper atlas, and anything already bookmarked,
 * keep working and land somewhere better. */
function openFromHash() {
  const id = location.hash.replace(/^#/, "");
  if (!id || !state.groups.some(x => x.id === id)) return;
  location.replace(groupHref(id, location.search));
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
  mk("f-colour", "colouring", ["cyclic", "antisymmetry", "dihedral", "none"],
     (k) => KIND[k].label);
  mk("f-prod", "product?", ["product", "not a product"]);
  const count = document.createElement("span");
  count.className = "count";
  count.id = "f-count";
  bar.append(count);
}

let observer = null;

function render() {
  const grid = document.getElementById("grid");
  for (const a of state.anims.values()) a.stop();
  state.anims.clear();
  if (observer) observer.disconnect();
  grid.innerHTML = "";

  const q = currentQuery();
  const shown = state.groups.filter(g => passes(g, q));
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
    // On a card the picture is a LINK to the group's own page, not the play
    // button it is everywhere else: a grid of 275 is something you browse, and
    // the thing you want from a thumbnail is the group. Play/pause stays on
    // the control bar below, and the arrow keys still scrub in place.
    const href = groupHref(g.id, location.search);
    attachStage(anim, canvas, { href });
    attachControls(anim, card);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      (() => { const n = nameOf(g);
        // the card carries ONE alternative name; the rest are on the group's
        // own page, where there is room to read them
        return `<span class="sym">${n.lead}</span>` +
          (n.tail.length ? `<span class="hm"><span class="sym">${n.tail[0]}</span></span>` : ""); })() +
      `<div class="tags">` +
      `<span class="tag">${g.system}</span>` +
      `<span class="tag">base ${baseLabel(g.base)}</span>` +

      // Which colouring of its projection the group induces (hierarchy §5).
      // Every group is in exactly one of the four classes, and "cyclic" is
      // exactly the 68 clockwork ones, so this single tag replaces both the
      // old clockwork tag and the symmorphic/nonsymmorphic one — the latter
      // said something true about the cocycle but nothing about the animation.
      (() => { const k = colouringKind(g);
        return `<span class="tag kind-${k}" title="${KIND[k].title}">` +
               `${KIND[k].label}</span>`; })() +
      (g.product ? `<span class="tag product">product</span>` : "") +
      `</div>`;
    card.append(meta);
    meta.onclick = () => { location.href = href; };
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

init();
