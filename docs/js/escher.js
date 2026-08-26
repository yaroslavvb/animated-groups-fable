/* Escher — M.C. Escher's regular divisions of the plane, filed by wallpaper
   group and then by colour group.  Same two-level tab layout as patterns.js,
   with the pattern-type layer removed: the leaf of each colour group is the
   list of drawings that realise it.

   No artwork is reproduced: each drawing is a link to the official gallery at
   mcescher.com (The M.C. Escher Company B.V., all rights reserved).  The plate
   beside each colour group is generated here from data/patterns.json — it
   illustrates the group, not the drawing. */
(() => {
  "use strict";

  const V = "1";
  const ESCHER_URL = "data/escher.json?v=" + V;
  const PATTERNS_URL = "data/patterns.json?v=2";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"];
  const GREY = "#9aa19e";
  const W = 960, H = 560;
  const SCALE = {p1: 100, p2: 100, pm: 100, pg: 100, cm: 120, pmm: 140, pmg: 140,
    pgg: 140, cmm: 175, p4: 150, p4m: 215, p4g: 175, p3: 150, p3m1: 195,
    p31m: 195, p6: 195, p6m: 235};
  const ORDER = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
    "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
  const SUBD = {0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉"};
  const UNKNOWN = "unassigned";   // pseudo colour-group id

  const state = {escher: null, groups: new Map(), typeOfGroup: new Map(),
                 wallpaper: null, byFamily: new Map()};

  // ------------------------------------------------------------ helpers
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const svg = (tag, attrs = {}) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const star = (s) => String(s).replaceAll("*", "∗");
  const subscript = (n) => String(n).split("").map(d => SUBD[d] || d).join("");
  const paletteOf = (k) => k === 1 ? [GREY] : PALETTE.slice(0, k);
  const groupSymbol = (g) => g.gs ? g.gs
    : `${g.hm}[${g.k}]${subscript(g.id.split("-").pop())}`;
  const permOrder = (p) => {
    let n = 1, q = p.slice();
    const id = p.map((_, i) => i);
    while (String(q) !== String(id)) { q = q.map((_, i) => p[q[i]]); n += 1; }
    return n;
  };
  const link = (href, text, cls) => {
    const a = el("a", cls, text);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  };

  // ------------------------------------------------------------ plate
  // A generated illustration of the colour group, drawn from the primitive
  // (general-position) pattern type of that group in data/patterns.json.
  function motifShape(stype, r) {
    const g = svg("g");
    const P = (pts) => pts.map(p => p.map(v => (v * r / 13).toFixed(2)).join(",")).join(" ");
    switch (stype) {
      case "c1": {
        g.append(svg("polygon", {points: P([[0, -13], [13, 0], [0, 13], [-13, 0]]), class: "motif-fill"}));
        const t = svg("text", {x: 0, y: 0.75 * r / 13, class: "motif-letter",
          "font-size": (13 * r / 13).toFixed(1), "text-anchor": "middle", "dominant-baseline": "middle"});
        t.textContent = "R";
        g.append(t);
        break;
      }
      case "d1":
        g.append(svg("polygon", {points: P([[15, 0], [-10, 11], [-6, 0], [-10, -11]]), class: "motif-fill"}));
        break;
      case "c2":
        g.append(svg("polygon", {points: P([[-14, -6], [4, -8], [14, 6], [-4, 8]]), class: "motif-fill"}));
        break;
      case "d2":
        g.append(svg("polygon", {points: P([[-14, -8], [14, -8], [14, 8], [-14, 8]]), class: "motif-fill"}));
        break;
      case "c3": case "c4": case "c6": {
        const n = parseInt(stype[1], 10);
        let d = "";
        for (let k = 0; k < n; k++) {
          const a0 = 2 * Math.PI * k / n, a1 = a0 + 2 * Math.PI / n;
          const p = (rad, a) => [rad * Math.cos(a), rad * Math.sin(a)];
          const A = p(r * 0.28, a0), B = p(r, a0 + 0.35 * (a1 - a0));
          const C = p(r * 0.75, a0 + 0.62 * (a1 - a0)), D = p(r * 0.28, a1);
          d += `${k === 0 ? "M" : "L"}${A[0].toFixed(2)},${A[1].toFixed(2)} L${B[0].toFixed(2)},${B[1].toFixed(2)} L${C[0].toFixed(2)},${C[1].toFixed(2)} L${D[0].toFixed(2)},${D[1].toFixed(2)} `;
        }
        g.append(svg("path", {d: d + "Z", class: "motif-fill"}));
        break;
      }
      case "d3": case "d4": case "d6": {
        const n = parseInt(stype[1], 10);
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * k / n;
          pts.push([(r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2)].join(","));
        }
        g.append(svg("polygon", {points: pts.join(" "), class: "motif-fill"}));
        break;
      }
    }
    return g;
  }

  function plateScale(t, fam) {
    const base = SCALE[t.hm];
    const b1 = fam.basis[0], b2 = fam.basis[1];
    const o1 = permOrder(t.render.t1), o2 = permOrder(t.render.t2);
    const spanX = Math.max(o1 * Math.abs(b1[0]), o2 * Math.abs(b2[0]));
    const spanY = Math.max(o1 * Math.abs(b1[1]), o2 * Math.abs(b2[1]));
    let fit = base;
    if (spanX > 1e-9) fit = Math.min(fit, W / (1.4 * spanX));
    if (spanY > 1e-9) fit = Math.min(fit, H / (1.4 * spanY));
    return Math.max(58, Math.min(base, fit));
  }

  function buildPlate(t, fam, tag) {
    const scale = plateScale(t, fam);
    const pal = paletteOf(t.k);
    const s = svg("svg", {viewBox: `0 0 ${W} ${H}`, role: "img",
                          preserveAspectRatio: "xMidYMid meet"});
    const title = svg("title");
    title.textContent = `A ${t.k}-colouring of type ${t.hm}`;
    s.append(title);
    s.append(svg("rect", {x: 0, y: 0, width: W, height: H, class: "plate-bg"}));
    const ox = W / 2 - 0.35 * scale, oy = H / 2 + 0.3 * scale;
    const toS = (x, y) => [ox + x * scale, oy - y * scale];
    const b1 = fam.basis[0], b2 = fam.basis[1];
    const seed = t.render.seed;
    const r = Math.max(6, Math.min(22, 0.38 * t.render.min_dist * scale));
    const angle0 = t.seat.angle || 0;
    const defs = svg("defs");
    const sym = svg("g", {id: `em-${t.id}-${tag}`});
    sym.append(motifShape(t.seat.stype, r));
    defs.append(sym);
    s.append(defs);
    const motifs = svg("g", {class: "motifs"});
    const t1 = t.render.t1, t2 = t.render.t2;
    const o1 = permOrder(t1), o2 = permOrder(t2);
    const pow = (p, o) => {
      const table = [p.map((_, i) => i)];
      for (let a = 1; a < o; a++) table.push(table[a - 1].map(x => p[x]));
      return table;
    };
    const P1 = pow(t1, o1), P2 = pow(t2, o2);
    const colourAt = (c, i, j) => {
      const a = ((i % o1) + o1) % o1, b = ((j % o2) + o2) % o2;
      return P1[a][P2[b][c]];
    };
    const minLen = Math.min(Math.hypot(...b1), Math.hypot(...b2));
    const N = Math.ceil(Math.max(W, H) / (scale * minLen)) + 2;
    const placed = new Map();
    for (const op of t.render.ops) {
      const px = op.m[0] * seed[0] + op.m[1] * seed[1] + op.t[0];
      const py = op.m[2] * seed[0] + op.m[3] * seed[1] + op.t[1];
      const det = op.m[0] * op.m[3] - op.m[1] * op.m[2];
      const cx = Math.cos(angle0 * Math.PI / 180), cy = Math.sin(angle0 * Math.PI / 180);
      const dx = op.m[0] * cx + op.m[1] * cy, dy = op.m[2] * cx + op.m[3] * cy;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const x = px + i * b1[0] + j * b2[0];
          const y = py + i * b1[1] + j * b2[1];
          const [sx, sy] = toS(x, y);
          if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
          const key = `${sx.toFixed(1)}:${sy.toFixed(1)}`;
          if (placed.has(key)) continue;
          placed.set(key, true);
          motifs.append(svg("use", {href: `#em-${t.id}-${tag}`,
            transform: `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${(-ang).toFixed(2)}) scale(1 ${det < 0 ? -1 : 1})`,
            fill: pal[colourAt(op.c, i, j)], class: "motif"}));
        }
      }
    }
    s.append(motifs);
    return s;
  }

  // ------------------------------------------------------------ cards
  function drawingCard(d) {
    const li = el("li", "drawing-card is-linkonly");
    const head = el("div", "drawing-head");
    if (d.n != null) head.append(el("span", "drawing-number", `No. ${d.n}`));
    const title = el("span", "drawing-title");
    title.append(link(d.page_url || "https://mcescher.com/gallery/symmetry/",
                      d.title || (d.n != null ? `Drawing ${d.n}` : "Untitled")));
    head.append(title);
    li.append(head);

    const meta = el("div", "drawing-meta");
    const bits = [];
    if (d.year) bits.push(d.year);
    if (d.motif) bits.push(d.motif);
    if (d.colours) bits.push(`${d.colours} colour${d.colours > 1 ? "s" : ""}`);
    bits.forEach((b, i) => {
      if (i) meta.append(el("span", "sep", "·"));
      meta.append(document.createTextNode(b));
    });
    li.append(meta);

    if (d.colour_group_note) {
      li.append(el("div", "drawing-meta", d.colour_group_note));
    }
    if (d.hm_check) {
      li.append(el("div", "drawing-meta", `Wallpaper group ${d.hm}: ${d.hm_check}.`));
    }
    if (d.confidence && d.confidence !== "high") {
      const f = el("div");
      f.append(el("span", "confidence-flag",
                  d.confidence === "low" ? "group uncertain" : "group tentative"));
      li.append(f);
    }
    if (d.sources && d.sources.length) {
      const src = el("div", "drawing-source", "after " + d.sources.join("; "));
      li.append(src);
    }
    return li;
  }

  // ------------------------------------------------------------ sections
  function bandFor(hm, gid, drawings) {
    const wrap = el("div", "escher-band");
    const intro = el("div", "escher-band-intro");
    const facts = el("div", "escher-band-facts");

    if (gid === UNKNOWN) {
      facts.append(el("p", "empty-note",
        "Drawings whose colour group is not settled in the literature consulted — " +
        "either they are uncoloured, or the sources give the wallpaper group only. " +
        "They are listed here rather than guessed at."));
    } else {
      const g = state.groups.get(gid);
      const meta = el("p", "band-meta");
      meta.append(el("span", "", `${star(groupSymbol(g))}${g.gs ? "" : " (systematic)"}`));
      if (g.k > 1) {
        meta.append(document.createTextNode(
          ` · H = ${star(g.sub.orb)} (${g.sub.hm}) · action ${g.action}` +
          (g.normal ? "" : ` · H not normal, kernel ${star(g.kernel_orb)}`)));
      }
      meta.append(document.createTextNode(" · "));
      const cl = el("a", "", "colour group in catalogue D");
      cl.href = `crystals-colored.html#${g.id}`;
      meta.append(cl);
      facts.append(meta);
    }
    const list = el("ul", "drawing-grid");
    drawings.forEach(d => list.append(drawingCard(d)));
    facts.append(list);
    intro.append(facts);

    if (gid !== UNKNOWN) {
      const t = state.typeOfGroup.get(gid);
      if (t) {
        const fig = el("figure", "escher-plate");
        fig.append(buildPlate(t, state.wallpaper[hm], "b"));
        const cap = el("figcaption",
          "Generated illustration of this colour group — not an Escher drawing.");
        fig.append(cap);
        intro.append(fig);
      }
    }
    wrap.append(intro);
    return wrap;
  }

  function familySection(hm, buckets) {
    const fam = state.wallpaper[hm];
    const sec = el("section", "wallpaper-family");
    sec.id = `family-${hm}`;
    const head = el("header", "family-header");
    const h2 = el("h2");
    h2.append(el("span", "family-orbifold", star(fam.orbifold)),
              el("span", "family-hm", hm));
    const total = buckets.reduce((n, b) => n + b.drawings.length, 0);
    const p = el("p");
    p.append(document.createTextNode(
      `${fam.summary} ${total} drawing${total === 1 ? "" : "s"} in ` +
      `${buckets.length} colour group${buckets.length === 1 ? "" : "s"}.`));
    head.append(h2, p);
    sec.append(head);

    const nav = el("nav", "colour-group-tabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", `Colour groups of Escher's ${hm} drawings`);
    let lastK = null;
    buckets.forEach(b => {
      const k = b.gid === UNKNOWN ? null : state.groups.get(b.gid).k;
      if (k !== lastK) {
        const label = b.gid === UNKNOWN ? "colour group open"
          : (k === 1 ? "1 colour" : `${k} colours`);
        const div = el("span", "tab-k-divider", label);
        div.setAttribute("role", "presentation");
        nav.append(div);
        lastK = k;
      }
      const a = el("a", "colour-group-tab" + (k === 1 ? " is-trivial" : ""));
      a.href = `#group-${hm}-${b.gid}`;
      a.setAttribute("role", "tab");
      a.setAttribute("aria-selected", "false");
      a.setAttribute("aria-controls", `panel-${hm}`);
      a.dataset.bucket = b.gid;
      const name = el("span", "tab-name");
      if (b.gid === UNKNOWN) {
        name.append(el("span", "sig", "—"));
      } else {
        name.append(el("span", "sig", star(state.groups.get(b.gid).chaim_type)));
      }
      a.append(name);
      const palette = el("span", "tab-palette");
      paletteOf(k || 1).forEach(c => {
        const sw = el("span"); sw.style.setProperty("--swatch", c); palette.append(sw);
      });
      a.append(palette);
      a.append(el("span", "tab-sub",
        `${b.gid === UNKNOWN ? "not assigned" : star(groupSymbol(state.groups.get(b.gid)))} · `));
      a.querySelector(".tab-sub").append(
        el("span", "tab-count", `${b.drawings.length}`));
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        activate(hm, b.gid, true);
      });
      nav.append(a);
    });
    sec.append(nav);
    const panel = el("div", "colour-group-panel");
    panel.id = `panel-${hm}`;
    panel.setAttribute("role", "tabpanel");
    sec.append(panel);
    return sec;
  }

  function activate(hm, gid, push) {
    const buckets = state.byFamily.get(hm);
    const b = buckets.find(x => x.gid === gid) || buckets[0];
    const sec = document.getElementById(`family-${hm}`);
    if (!sec) return;
    sec.querySelectorAll(".colour-group-tab").forEach(a => {
      a.setAttribute("aria-selected", a.dataset.bucket === b.gid ? "true" : "false");
    });
    const panel = sec.querySelector(".colour-group-panel");
    panel.replaceChildren(bandFor(hm, b.gid, b.drawings));
    if (push) history.replaceState(null, "", `#group-${hm}-${b.gid}`);
  }

  function directory() {
    const grid = document.getElementById("directory-grid");
    if (!grid) return;
    ORDER.forEach(hm => {
      const fam = state.wallpaper[hm];
      const buckets = state.byFamily.get(hm) || [];
      const n = buckets.reduce((k, b) => k + b.drawings.length, 0);
      const a = el("a", "directory-family");
      a.href = `#family-${hm}`;
      const img = el("img");
      img.src = `img/mathworld/${hm}.webp`;
      img.alt = `${hm} example pattern`;
      img.width = 320; img.height = 240; img.loading = "lazy";
      const cap = el("span", "directory-caption");
      cap.append(el("strong", "", star(fam.orbifold)), el("span", "directory-hm", hm));
      const badge = el("span", "directory-count", String(n));
      badge.title = `${n} Escher drawing${n === 1 ? "" : "s"} in ${hm}`;
      if (!n) a.style.opacity = "0.45";
      a.append(img, cap, badge);
      grid.append(a);
    });
  }

  function counts() {
    const byK = {};
    let total = 0;
    state.escher.drawings.forEach(d => {
      total += 1;
      const k = d.colours || 1;
      byK[k] = (byK[k] || 0) + 1;
    });
    document.querySelectorAll("[data-count='total']").forEach(n => { n.textContent = total; });
    document.querySelectorAll("[data-kc]").forEach(n => {
      const k = n.dataset.kc;
      n.textContent = k === "t" ? total : (byK[k] || 0);
    });
    const note = document.getElementById("coverage-note");
    if (note) note.textContent = state.escher.meta.coverage_note || "";
  }

  function openFromHash() {
    const id = decodeURIComponent((location.hash || "").slice(1));
    if (!id) return false;
    const jump = (node) => {
      if (node) window.scrollTo({top: node.getBoundingClientRect().top + window.scrollY, behavior: "instant"});
    };
    const m = /^group-([a-z0-9]+)-(.+)$/.exec(id);
    if (m && state.byFamily.has(m[1])) {
      activate(m[1], m[2], false);
      jump(document.getElementById(`family-${m[1]}`));
      return true;
    }
    jump(document.getElementById(id));
    return false;
  }

  async function main() {
    const [er, pr] = await Promise.all([fetch(ESCHER_URL), fetch(PATTERNS_URL)]);
    if (!er.ok) throw new Error("escher data " + er.status);
    if (!pr.ok) throw new Error("patterns data " + pr.status);
    state.escher = await er.json();
    const pat = await pr.json();
    state.wallpaper = pat.wallpaper;
    pat.groups.forEach(g => state.groups.set(g.id, g));
    // one representative (primitive, general-position) type per colour group,
    // used only to draw the illustrative plate
    const typeById = new Map(pat.types.map(t => [t.id, t]));
    pat.groups.forEach(g => {
      const first = (g.types || []).map(id => typeById.get(id)).filter(Boolean)
        .find(t => t.primitive) || typeById.get((g.types || [])[0]);
      if (first) state.typeOfGroup.set(g.id, first);
    });

    // bucket the drawings: wallpaper group -> colour group -> drawings
    const byHm = new Map();
    state.escher.drawings.forEach(d => {
      if (!d.hm) return;
      if (!byHm.has(d.hm)) byHm.set(d.hm, new Map());
      const gid = d.colour_group || UNKNOWN;
      const m = byHm.get(d.hm);
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(d);
    });
    const ordinal = (gid) => gid === UNKNOWN ? 1e9
      : parseInt(gid.split("-").pop(), 10);
    byHm.forEach((m, hm) => {
      const buckets = [...m.entries()].map(([gid, drawings]) => ({gid, drawings}));
      buckets.forEach(b => b.drawings.sort((x, y) => (x.n || 0) - (y.n || 0)));
      buckets.sort((a, b) => {
        const ka = a.gid === UNKNOWN ? 1e9 : state.groups.get(a.gid).k;
        const kb = b.gid === UNKNOWN ? 1e9 : state.groups.get(b.gid).k;
        return (ka - kb) || (ordinal(a.gid) - ordinal(b.gid));
      });
      state.byFamily.set(hm, buckets);
    });

    counts();
    directory();
    const atlas = document.getElementById("escher-atlas");
    atlas.replaceChildren();
    ORDER.forEach(hm => {
      if (!state.byFamily.has(hm)) return;
      atlas.append(familySection(hm, state.byFamily.get(hm)));
    });
    // works whose wallpaper group no reachable source states: listed plainly
    // rather than filed under a guessed group
    const unplaced = state.escher.drawings.filter(d => !d.hm);
    if (unplaced.length) {
      const sec = el("section", "wallpaper-family");
      sec.id = "family-undetermined";
      const head = el("header", "family-header");
      const h2 = el("h2");
      h2.append(el("span", "family-orbifold", "?"),
                el("span", "family-hm", "not documented"));
      const p = el("p");
      p.append(document.createTextNode(
        `${unplaced.length} further works from the gallery whose wallpaper group ` +
        `is not given by any source consulted. They are listed here, not filed ` +
        `under a guessed group; Schattschneider’s Concordance ` +
        `(Visions of Symmetry, Tables 1–3, pp. 328–334) classifies all of them.`));
      head.append(h2, p);
      sec.append(head);
      const band = el("div", "escher-band");
      const list = el("ul", "drawing-grid");
      unplaced.forEach(d => list.append(drawingCard(d)));
      band.append(list);
      sec.append(band);
      atlas.append(sec);
    }

    openFromHash();
    ORDER.forEach(hm => {
      const sec = document.getElementById(`family-${hm}`);
      if (!sec || sec.querySelector(".escher-band")) return;
      activate(hm, state.byFamily.get(hm)[0].gid, false);
    });
    if (location.hash) {
      openFromHash();
      window.addEventListener("load", () => { openFromHash(); }, {once: true});
    }
    window.addEventListener("hashchange", openFromHash);
  }
  main().catch(err => {
    const atlas = document.getElementById("escher-atlas");
    if (atlas) atlas.replaceChildren(el("p", "noscript-note",
      "Catalogue data could not be loaded: " + err.message));
  });
})();
