/* Patterns — renders the perfect k-colour pattern types (k ≤ 6) from
   data/patterns.json: 17 wallpaper sections, colour-group tabs, pattern-type
   subtabs, one SVG plate per pane (motif with the stabiliser's own symmetry,
   seated in its stratum, orbit under Γ, coloured by the cosets of H,
   generator overlay), and a concise notation card.  Panes render lazily. */
(() => {
  "use strict";

  const V = "2";
  const DATA_URL = "data/patterns.json?v=" + V;
  const CROPS_URL = "data/crops.json?v=" + V;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"];
  const GREY = "#9aa19e";
  const W = 960, H = 560;
  const SCALE = {p1: 100, p2: 100, pm: 100, pg: 100, cm: 120, pmm: 140, pmg: 140,
    pgg: 140, cmm: 175, p4: 150, p4m: 215, p4g: 175, p3: 150, p3m1: 195,
    p31m: 195, p6: 195, p6m: 235};
  const ORDER = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
    "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
  const STYPE_NAME = {c1: "trivial (general position)", d1: "d1 — one mirror",
    c2: "c2 — a half-turn", d2: "d2 — two perpendicular mirrors", c3: "c3",
    d3: "d3", c4: "c4", d4: "d4", c6: "c6", d6: "d6"};
  const SUBD = {0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉"};

  const state = {data: null, crops: {plates: [], sot: []}, byId: new Map(),
                 groupById: new Map(), groupsByFamily: new Map()};

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
  const spacedCycles = (c) => c === "1" ? "1" : c.replace(/\(([A-F]+)\)/g,
    (m, s) => "(" + s.split("").join(" ") + ")");
  const isKernel = (c) => c === "1";
  // systematic G&S-style symbol for groups the books do not name
  const groupSymbol = (g) => g.gs ? g.gs
    : `${g.hm}[${g.k}]${subscript(g.id.split("-").pop())}`;
  const permOrder = (p) => {
    let n = 1, q = p.slice();
    const id = p.map((_, i) => i);
    while (String(q) !== String(id)) { q = q.map((_, i) => p[q[i]]); n += 1; }
    return n;
  };

  // ------------------------------------------------- Chaim signatures
  // Superscript digits for k = 2 (the SoT convention); cycle superscripts
  // like ^(AB) for k >= 3; the annotated letter signature for k = 1.
  const SUPD = {1: "¹", 2: "²"};
  function supTextOf(cyc, k) {
    if (k === 2) return isKernel(cyc) ? SUPD[1] : SUPD[2];
    return isKernel(cyc) ? "1" : cyc;
  }
  function signatureNode(fam, t, seat, opts = {}) {
    // t: {k, cycles}; seat: null or the seat object (marks)
    const k = t.k;
    const wrap = el("span", "sig" + (opts.big ? " sig-big" : ""));
    if (k === 1) return annotatedNode(fam, seat, opts);
    const cyc = t.cycles;
    if (fam.hm === "p1") {
      wrap.append(document.createTextNode("◦"));
      wrap.append(el("sup", k > 2 ? "sig-cyc" : "", supTextOf(cyc.X, k) + "," + supTextOf(cyc.Y, k)));
      return wrap;
    }
    const tpl = fam.template;
    const tokens = [];
    let i = 0;
    while (i < tpl.length) {
      if (tpl[i] === "{") {
        const j = tpl.indexOf("}", i);
        tokens.push({kind: "sup", letter: tpl.slice(i + 1, j)});
        i = j + 1;
      } else {
        tokens.push({kind: "sym", ch: tpl[i]});
        i += 1;
      }
    }
    const marks = new Set();
    if (seat && seat.kind !== "interior") {
      const letters = seat.letters;
      tokens.forEach((tok, n) => {
        if (seat.kind === "edge" && tok.kind === "sup" && tok.letter === letters[0]) marks.add(n);
        if (seat.kind === "gyration" && tok.kind === "sup" && tok.letter === letters[0]) {
          marks.add(n); if (tokens[n + 1]) marks.add(n + 1);
        }
        if (seat.kind === "corner" && tok.kind === "sup" && tok.letter === letters[0]) {
          if (tokens[n + 1] && tokens[n + 1].kind === "sym") marks.add(n + 1);
        }
      });
    }
    tokens.forEach((tok, n) => {
      let node;
      if (tok.kind === "sup") {
        node = el("sup", k > 2 ? "sig-cyc" : "", supTextOf(cyc[tok.letter], k));
        node.title = tok.letter + (isKernel(cyc[tok.letter])
          ? " preserves every colour"
          : " permutes the colours " + spacedCycles(cyc[tok.letter]));
      } else {
        node = el("span", "sig-sym", tok.ch === "*" ? "∗" : tok.ch);
      }
      if (marks.has(n)) node.classList.add("seat-mark");
      wrap.append(node);
    });
    return wrap;
  }

  // annotated signature with letters typeset: '∗P6Q3R2' -> ∗<sup>P</sup>6…
  function annotatedNode(fam, seat, opts = {}) {
    const wrap = el("span", "sig sig-annot" + (opts.big ? " sig-big" : ""));
    if (fam.hm === "p1") {
      wrap.append(document.createTextNode("◦"), el("sup", "gen-letter", "X,Y"));
      return wrap;
    }
    const s = fam.annotated;
    const letters = seat ? new Set(seat.letters) : new Set();
    let prevLetter = null;
    for (const ch of s) {
      if (/[A-Zαβγδ]/.test(ch)) {
        const n = el("sup", "gen-letter", ch);
        if (seat && (seat.kind === "edge" || seat.kind === "gyration") && letters.has(ch)) n.classList.add("seat-mark");
        wrap.append(n);
        prevLetter = ch;
      } else if (/\d/.test(ch)) {
        const n = el("span", "sig-sym", ch);
        if (seat && (seat.kind === "corner" && seat.letters[0] === prevLetter)
            || (seat && seat.kind === "gyration" && letters.has(prevLetter))) n.classList.add("seat-mark");
        wrap.append(n);
      } else {
        wrap.append(el("span", "sig-sym", ch === "*" || ch === "∗" ? "∗" : ch));
      }
    }
    return wrap;
  }

  // ------------------------------------------------------------ geometry
  function motifShape(stype, r) {
    const g = svg("g");
    const add = (e) => g.append(e);
    const P = (pts) => pts.map(p => p.map(v => (v * r / 13).toFixed(2)).join(",")).join(" ");
    switch (stype) {
      case "c1": {
        add(svg("polygon", {points: P([[0, -13], [8, -2], [0, 11], [-8, -2]]), class: "motif-fill"}));
        const t = svg("text", {x: 0, y: -2 * r / 13, class: "motif-letter",
          "font-size": (11 * r / 13).toFixed(1), "text-anchor": "middle", "dominant-baseline": "middle"});
        t.textContent = "R";
        add(t);
        break;
      }
      case "d1":
        add(svg("polygon", {points: P([[15, 0], [-10, 11], [-6, 0], [-10, -11]]), class: "motif-fill"}));
        break;
      case "c2":
        add(svg("polygon", {points: P([[-14, -6], [4, -8], [14, 6], [-4, 8]]), class: "motif-fill"}));
        break;
      case "d2":
        add(svg("polygon", {points: P([[-14, -8], [14, -8], [14, 8], [-14, 8]]), class: "motif-fill"}));
        break;
      case "c3": case "c4": case "c6": {
        const n = parseInt(stype[1], 10);
        let d = "";
        for (let k = 0; k < n; k++) {
          const a0 = 2 * Math.PI * k / n;
          const a1 = a0 + 2 * Math.PI / n;
          const rr = r, ri = r * 0.28, rm = r * 0.75;
          const p = (rad, a) => [rad * Math.cos(a), rad * Math.sin(a)];
          const A = p(ri, a0), B = p(rr, a0 + 0.35 * (a1 - a0)), C = p(rm, a0 + 0.62 * (a1 - a0)), D = p(ri, a1);
          d += `${k === 0 ? "M" : "L"}${A[0].toFixed(2)},${A[1].toFixed(2)} L${B[0].toFixed(2)},${B[1].toFixed(2)} L${C[0].toFixed(2)},${C[1].toFixed(2)} L${D[0].toFixed(2)},${D[1].toFixed(2)} `;
        }
        add(svg("path", {d: d + "Z", class: "motif-fill"}));
        break;
      }
      case "d3": case "d4": case "d6": {
        const n = parseInt(stype[1], 10);
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = 2 * Math.PI * k / n;
          pts.push([(r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2)].join(","));
        }
        add(svg("polygon", {points: pts.join(" "), class: "motif-fill"}));
        break;
      }
    }
    return g;
  }

  // zoom out just enough that ~1.4 colour periods fit on the plate,
  // fitting each axis separately (the long period may be vertical)
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

  function buildPlate(t, fam, opts = {}) {
    const scale = opts.scale || plateScale(t, fam);
    const w = opts.width || W, h = opts.height || H;
    const pal = paletteOf(t.k);
    const s = svg("svg", {viewBox: `0 0 ${w} ${h}`, role: "img", preserveAspectRatio: "xMidYMid meet"});
    const title = svg("title");
    title.textContent = `${t.label}: ${t.seat.label}`;
    s.append(title);
    s.append(svg("rect", {x: 0, y: 0, width: w, height: h, class: "plate-bg"}));
    const ox = w / 2 - 0.35 * scale, oy = h / 2 + 0.3 * scale;
    const toS = (x, y) => [ox + x * scale, oy - y * scale];
    const b1 = fam.basis[0], b2 = fam.basis[1];
    const seed = t.render.seed;
    const r = Math.max(6, Math.min(opts.rmax || 22, 0.38 * t.render.min_dist * scale));
    const angle0 = t.seat.angle || 0;
    const defs = svg("defs");
    const sym = svg("g", {id: `m-${t.id}-${opts.tag || "p"}`});
    sym.append(motifShape(t.seat.stype, r));
    defs.append(sym);
    s.append(defs);
    const motifs = svg("g", {class: "motifs"});
    // colour of a lattice translate: sigma1^i sigma2^j applied to op.c
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
    const N = Math.ceil(Math.max(w, h) / (scale * minLen)) + 2;
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
          if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
          const key = `${sx.toFixed(1)}:${sy.toFixed(1)}`;
          if (placed.has(key)) continue;   // same copy via the stabiliser
          placed.set(key, true);
          const colour = colourAt(op.c, i, j);
          const use = svg("use", {href: `#m-${t.id}-${opts.tag || "p"}`,
            transform: `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${(-ang).toFixed(2)}) scale(1 ${det < 0 ? -1 : 1})`,
            fill: pal[colour], class: "motif"});
          motifs.append(use);
        }
      }
    }
    s.append(motifs);
    if (!opts.noOverlay) s.append(overlay(fam, t, toS, scale, w, h));
    return s;
  }

  function overlay(fam, t, toS, scale, w, h) {
    const g = svg("g", {class: "generator-overlay", "aria-hidden": "true"});
    const stab = new Set(t.seat.stab_words || []);
    fam.generators.forEach((gen) => {
      const keep = isKernel(t.cycles[gen.name]);
      let cls = keep ? "keeps" : "moves";
      if (stab.has(gen.name)) cls += " fixes";
      if (gen.kind === "translation") return;
      if (gen.kind === "rotation") {
        const [cx, cy] = toS(gen.centre[0], gen.centre[1]);
        const rad = 15;
        const a0 = -72, delta = -gen.angle_degrees;
        const a1 = a0 + delta;
        const p = (a) => [cx + rad * Math.cos(a * Math.PI / 180), cy + rad * Math.sin(a * Math.PI / 180)];
        const A = p(a0), B = p(a1);
        const large = Math.abs(delta) > 180 ? 1 : 0;
        const sweep = delta > 0 ? 1 : 0;
        const d = `M ${A[0].toFixed(2)} ${A[1].toFixed(2)} A ${rad} ${rad} 0 ${large} ${sweep} ${B[0].toFixed(2)} ${B[1].toFixed(2)}`;
        const grp = svg("g", {class: `gen gen-rotation ${cls}`});
        grp.append(svg("path", {d, class: "gen-halo"}));
        grp.append(svg("path", {d, class: "gen-arc"}));
        const tan = [-Math.sin(a1 * Math.PI / 180), Math.cos(a1 * Math.PI / 180)].map(v => v * Math.sign(delta || 1));
        const base = [B[0] - tan[0] * 7, B[1] - tan[1] * 7];
        const nrm = [-tan[1], tan[0]];
        grp.append(svg("polygon", {class: "gen-arrow", points: [B, [base[0] + nrm[0] * 3.5, base[1] + nrm[1] * 3.5], [base[0] - nrm[0] * 3.5, base[1] - nrm[1] * 3.5]].map(q => q.map(v => v.toFixed(2)).join(",")).join(" ")}));
        grp.append(svg("circle", {cx, cy, r: 4.2, class: "gen-centre"}));
        label(grp, gen.name, cx + rad + 8, cy - rad - 2);
        g.append(grp);
        return;
      }
      const [px, py] = gen.axis_point, [dx, dy] = gen.axis_direction;
      const [sx, sy] = toS(px, py);
      const sdx = dx, sdy = -dy;
      const ts = [];
      if (Math.abs(sdx) > 1e-9) { ts.push((0 - sx) / sdx, (w - sx) / sdx); }
      if (Math.abs(sdy) > 1e-9) { ts.push((0 - sy) / sdy, (h - sy) / sdy); }
      const inside = (tt) => { const x = sx + tt * sdx, y = sy + tt * sdy; return x >= -0.5 && x <= w + 0.5 && y >= -0.5 && y <= h + 0.5; };
      const good = ts.filter(inside).sort((a, b) => a - b);
      if (good.length < 2) return;
      const A = [sx + good[0] * sdx, sy + good[0] * sdy], B = [sx + good[good.length - 1] * sdx, sy + good[good.length - 1] * sdy];
      const grp = svg("g", {class: `gen gen-${gen.kind} ${cls}`});
      grp.append(svg("line", {x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: "gen-halo"}));
      grp.append(svg("line", {x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: gen.kind === "mirror" ? "gen-mirror" : "gen-glide"}));
      if (gen.kind === "glide") {
        const gl = gen.glide * scale;
        const ax = sx, ay = sy;
        const bx = ax + sdx * gl, by = ay + sdy * gl;
        grp.append(svg("line", {x1: ax, y1: ay, x2: bx, y2: by, class: "gen-glide-vec"}));
        const tan = [sdx * Math.sign(gl), sdy * Math.sign(gl)];
        const nrm = [-tan[1], tan[0]];
        grp.append(svg("polygon", {class: "gen-arrow", points: [[bx, by], [bx - tan[0] * 7 + nrm[0] * 3.5, by - tan[1] * 7 + nrm[1] * 3.5], [bx - tan[0] * 7 - nrm[0] * 3.5, by - tan[1] * 7 - nrm[1] * 3.5]].map(q => q.map(v => v.toFixed(2)).join(",")).join(" ")}));
      }
      const lx = A[0] + (B[0] - A[0]) * 0.06 + 10 * (-sdy), ly = A[1] + (B[1] - A[1]) * 0.06 + 10 * sdx - 4;
      label(grp, gen.name, Math.min(Math.max(lx, 12), w - 16), Math.min(Math.max(ly, 18), h - 8));
      g.append(grp);
    });
    const [qx, qy] = toS(t.render.seed[0], t.render.seed[1]);
    const seatG = svg("g", {class: "seat-marker"});
    seatG.append(svg("circle", {cx: qx, cy: qy, r: 0.55 * Math.max(6, Math.min(22, 0.38 * t.render.min_dist * scale)) + 9, class: "seat-ring"}));
    g.append(seatG);
    return g;
  }
  function label(grp, text, x, y, cls = "gen-label") {
    const tnode = svg("text", {x: x.toFixed(1), y: y.toFixed(1), class: cls});
    tnode.textContent = text;
    grp.append(tnode);
  }

  // ------------------------------------------------------------ text bits
  function seatSentence(t) {
    const s = t.seat;
    if (s.kind === "interior") {
      return "The motif sits in general position — no symmetry fixes a copy, S(M) = 1, and the type is primitive: it is the colour group itself.";
    }
    const eq = s.equivalent.filter(e => JSON.stringify(e.letters) !== JSON.stringify(s.letters));
    const alt = eq.length ? " Equivalent seats: " + eq.map(e => e.label).join("; ") + "." : "";
    if (s.kind === "edge") {
      return `Seated on the mirror ${s.letters[0]}: S(M) = ⟨${s.letters[0]}⟩ ≅ d1; ${s.letters[0]} fixes the marked copy, hence its colour.${alt}`;
    }
    if (s.kind === "corner") {
      return `Seated at the order-${s.order} corner of ${s.letters.join(" and ")}: S(M) ≅ d${s.order}, all of it colour-preserving on the marked copy.${alt}`;
    }
    return `Seated at the ${s.order}-fold centre of ${s.letters[0]}: S(M) = ⟨${s.letters[0]}⟩ ≅ c${s.order}, which fixes the marked copy and its colour.${alt}`;
  }

  function lightboxLink(href, caption, content) {
    const a = el("a", "book-evidence-link source-value-link");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.dataset.caption = caption;
    a.append(content, el("span", "source-link-mark", "↗"));
    return a;
  }

  // ------------------------------------------------------------ pane
  function dataTable(t, g, fam) {
    const table = el("table", "pattern-data");
    const row = (labelText, valueNode) => {
      const tr = el("tr");
      const th = el("th"); th.scope = "row"; th.textContent = labelText;
      const td = el("td");
      if (valueNode instanceof Node) td.append(valueNode); else td.textContent = valueNode;
      tr.append(th, td); table.append(tr);
    };
    // Chaim short form (marked signature), with the SoT crop when it exists
    const sig = signatureNode(fam, t, t.seat, {big: true});
    if (state.crops.sot.includes(g.id)) {
      row("Chaim short form", lightboxLink(`img/sot/${g.id}.webp`,
        `${star(g.chaim_type)} — The Symmetries of Things, Table ${t.k === 2 ? "11.1" : "12.1"}`, sig));
    } else {
      row("Chaim short form", sig);
    }
    row("Chaim colour type", el("span", "source-math-symbol", star(g.chaim_type)
      + (g.k > 1 ? `  ·  ${g.action}${g.normal ? "" : " (H not normal)"}` : "")));
    // G&S symbols
    const gsym = el("span");
    gsym.append(el("span", "source-math-symbol", star(groupSymbol(g))));
    if (!g.gs) gsym.append(el("span", "syn-note", " systematic (catalogue D order)"));
    row("G&S group symbol", gsym);
    const pt = el("span");
    if (state.crops.plates.includes(t.id)) {
      const fig = t.k === 2 ? (t.primitive ? "8.2.2" : "8.3.5") : (t.primitive ? "8.2.3" : "8.3.6");
      pt.append(lightboxLink(`img/gs-plates/${t.id}.webp`,
        `${t.label} — Grünbaum & Shephard, Tilings and Patterns, Fig. ${fig}`,
        el("span", "source-math-symbol", t.label)));
    } else {
      pt.append(el("span", "source-math-symbol", t.label));
      if (t.k === 3) pt.append(el("span", "beyond-note", " beyond the book — missing from Figs. 8.2.3/8.3.6"));
      else if (t.k >= 4) pt.append(el("span", "syn-note", " systematic (no published tables)"));
    }
    row("G&S pattern type", pt);
    const seat = el("span", "seat-text",
      `${t.seat.kind === "interior" ? "general position" : t.seat.label} · S(M) ≅ ${t.seat.stype}` +
      (t.primitive ? " · primitive" : ""));
    row("Seat", seat);
    return table;
  }

  function presentation(t, g, fam) {
    const sec = el("section", "group-presentation");
    const head = el("header", "presentation-heading");
    head.append(el("h4", "", "Presentation"));
    const pal = el("div", "action-palette");
    pal.append(document.createTextNode("cycles over"));
    paletteOf(t.k).forEach((c, i) => {
      const sw = el("span", "action-colour", "ABCDEF"[i]);
      sw.style.setProperty("--swatch", c); pal.append(sw);
    });
    head.append(pal);
    sec.append(head);
    const table = el("table");
    const tb = el("tbody");
    const stabLetters = new Set(t.seat.stab_words || []);
    fam.generators.forEach(gen => {
      const tr = el("tr", "presentation-generator-row");
      const th = el("th"); th.scope = "row";
      th.append(el("span", "generator-key", gen.name), el("span", "generator-geometry", gen.geometry));
      const td = el("td");
      const cyc = t.cycles[gen.name];
      if (isKernel(cyc)) {
        td.append(el("span", "presentation-identity", "—"));
        td.title = "preserves every colour";
      } else {
        const v = el("span", "presentation-permutation", spacedCycles(cyc));
        v.title = "permutes the colours";
        td.append(v);
      }
      const td2 = el("td", "seat-cell");
      if (stabLetters.has(gen.name)) td2.append(el("span", "seat-flag", "● fixes the motif"));
      tr.append(th, td, td2);
      tb.append(tr);
    });
    table.append(tb);
    sec.append(table);
    const rel = el("p", "presentation-relations");
    rel.append(el("strong", "", "Relations"), el("span", "", `Γ = ⟨${fam.generators.map(x => x.name).join(", ")} | ${fam.relations}⟩`));
    sec.append(rel);
    sec.append(el("p", "invariant-text", seatSentence(t)));
    return sec;
  }

  function buildPane(t, g, fam) {
    const pane = el("article", "pattern-pane");
    pane.dataset.type = t.id;
    const body = el("div", "pane-body");
    const fig = el("figure", "pattern-plate");
    fig.append(buildPlate(t, fam));
    const cap = el("figcaption");
    cap.append(document.createTextNode("Generators of Γ — "),
      el("span", "cap-keep", "solid = preserves every colour"), document.createTextNode(", "),
      el("span", "cap-swap", "dashed = permutes colours"), document.createTextNode(", "),
      el("span", "cap-fix", "red = fixes the marked motif"),
      document.createTextNode("; the ring marks the seat. Translations are not drawn."));
    fig.append(cap);
    const details = el("div", "pattern-details");
    details.append(dataTable(t, g, fam), presentation(t, g, fam));
    body.append(fig, details);
    pane.append(body);
    return pane;
  }

  // ------------------------------------------------------------ sections
  function tabLabelNode(g, fam) {
    if (g.k === 1) {
      const n = el("span", "tab-name");
      n.append(el("span", "sig", star(g.orb)));
      return n;
    }
    const n = el("span", "tab-name");
    if (g.k === 2) n.append(signatureNode(fam, {k: 2, cycles: g.cycles}, null));
    else n.append(el("span", "sig", star(g.chaim_type)));
    return n;
  }

  function familySection(hm, fam, groups) {
    const sec = el("section", "wallpaper-family");
    sec.id = `family-${hm}`;
    const head = el("header", "family-header");
    const h2 = el("h2");
    h2.append(el("span", "family-orbifold", star(fam.orbifold)), el("span", "family-hm", hm));
    const p = el("p");
    const ntypes = groups.reduce((n, g) => n + g.types.length, 0);
    p.append(document.createTextNode(fam.summary + " Annotated signature "), annotatedNode(fam, null),
      document.createTextNode(` · ${groups.length} colour groups · ${ntypes} pattern types.`));
    head.append(h2, p);
    sec.append(head);

    const nav = el("nav", "colour-group-tabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", `Colour groups over ${star(fam.orbifold)}`);
    let lastK = null;
    groups.forEach(g => {
      if (g.k !== lastK) {
        const div = el("span", "tab-k-divider", g.k === 1 ? "1 colour" : `${g.k} colours`);
        div.setAttribute("role", "presentation");
        nav.append(div);
        lastK = g.k;
      }
      const a = el("a", "colour-group-tab" + (g.k === 1 ? " is-trivial" : ""));
      a.href = `#group-${g.id}`;
      a.id = `tab-${g.id}`;
      a.setAttribute("role", "tab");
      a.setAttribute("aria-selected", "false");
      a.setAttribute("aria-controls", `panel-${hm}`);
      a.dataset.group = g.id;
      a.append(tabLabelNode(g, fam));
      const palette = el("span", "tab-palette");
      paletteOf(g.k).forEach(c => { const sw = el("span"); sw.style.setProperty("--swatch", c); palette.append(sw); });
      a.append(palette);
      a.append(el("span", "tab-sub", `${star(groupSymbol(g))} · ${g.types.length}`));
      a.title = `${star(g.chaim_type)} · ${g.types.length} pattern type${g.types.length > 1 ? "s" : ""}`;
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        activateGroup(g.id, null, true);
      });
      nav.append(a);
    });
    sec.append(nav);
    const panel = el("div", "colour-group-panel");
    panel.id = `panel-${hm}`;
    panel.setAttribute("role", "tabpanel");
    panel.dataset.family = hm;
    sec.append(panel);
    return sec;
  }

  function activateGroup(gid, typeId, push) {
    const g = state.groupById.get(gid);
    if (!g) return;
    const fam = state.data.wallpaper[g.hm];
    const sec = document.getElementById(`family-${g.hm}`);
    if (!sec) return;
    sec.querySelectorAll(".colour-group-tab").forEach(a => {
      a.setAttribute("aria-selected", a.dataset.group === gid ? "true" : "false");
    });
    const panel = sec.querySelector(".colour-group-panel");
    panel.replaceChildren();
    // band header
    const bh = el("header", "band-header");
    const h3 = el("h3");
    h3.append(el("span", "band-type", star(g.chaim_type)));
    if (g.k === 2) { h3.append(document.createTextNode(" ")); h3.append(signatureNode(fam, {k: 2, cycles: g.cycles}, null, {big: true})); }
    bh.append(h3);
    const meta = el("p", "band-meta");
    meta.append(el("span", "", `${star(groupSymbol(g))}${g.gs ? "" : " (systematic)"}`));
    if (g.k > 1) meta.append(document.createTextNode(` · H = ${star(g.sub.orb)} (${g.sub.hm}) · action ${g.action}${g.normal ? "" : " · H not normal, kernel " + star(g.kernel_orb)}`));
    if (state.crops.sot.includes(g.id)) {
      meta.append(document.createTextNode(" · "));
      meta.append(lightboxLink(`img/sot/${g.id}.webp`,
        `${star(g.chaim_type)} — The Symmetries of Things, Table ${g.k === 2 ? "11.1" : "12.1"}`,
        el("span", "", `Table ${g.k === 2 ? "11.1" : "12.1"} row`)));
    }
    bh.append(meta);
    panel.append(bh);
    // pattern subtabs
    const ptabs = el("nav", "pattern-tabs");
    ptabs.setAttribute("role", "tablist");
    ptabs.setAttribute("aria-label", `Pattern types of ${star(g.chaim_type)}`);
    g.types.forEach(t => {
      const a = el("a", "pattern-tab");
      a.href = `#${t.id}`;
      a.dataset.type = t.id;
      a.setAttribute("role", "tab");
      a.setAttribute("aria-controls", `pane-${g.id}`);
      const lbl = el("span", "ptab-label", t.label);
      a.append(lbl);
      a.append(el("span", "ptab-seat", t.seat.kind === "interior" ? "general" : t.seat.label.replace(/^at the |^on the /, "")));
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        activateType(g, t.id, true);
      });
      ptabs.append(a);
    });
    panel.append(ptabs);
    const host = el("div", "pattern-pane-host");
    host.id = `pane-${g.id}`;
    host.setAttribute("role", "tabpanel");
    panel.append(host);
    activateType(g, typeId || g.types[0].id, false);
    if (push) history.replaceState(null, "", `#group-${g.id}`);
  }

  function activateType(g, typeId, push) {
    const t = state.byId.get(typeId);
    if (!t) return;
    const fam = state.data.wallpaper[g.hm];
    const sec = document.getElementById(`family-${g.hm}`);
    const panel = sec.querySelector(".colour-group-panel");
    panel.querySelectorAll(".pattern-tab").forEach(a => {
      a.setAttribute("aria-selected", a.dataset.type === typeId ? "true" : "false");
    });
    const host = panel.querySelector(".pattern-pane-host");
    host.replaceChildren(buildPane(t, g, fam));
    if (push) history.replaceState(null, "", `#${t.id}`);
  }

  function directory() {
    const grid = document.getElementById("directory-grid");
    if (!grid) return;
    ORDER.forEach(hm => {
      const fam = state.data.wallpaper[hm];
      const groups = state.groupsByFamily.get(hm) || [];
      const ntypes = groups.reduce((k, g) => k + g.types.length, 0);
      const a = el("a", "directory-family");
      a.href = `#family-${hm}`;
      const img = el("img");
      img.src = `img/mathworld/${hm}.webp`;
      img.alt = `${hm} example pattern`;
      img.width = 320; img.height = 240;
      img.loading = "lazy";
      const cap = el("span", "directory-caption");
      cap.append(el("strong", "", star(fam.orbifold)), el("span", "directory-hm", hm));
      const n = el("span", "directory-count", String(ntypes));
      n.title = `${groups.length} colour groups, ${ntypes} pattern types`;
      a.append(img, cap, n);
      grid.append(a);
    });
  }

  function lightbox() {
    const box = el("div", "lightbox");
    box.hidden = true;
    const inner = el("div", "lightbox-inner");
    const img = el("img");
    const cap = el("p", "lightbox-caption");
    const close = el("button", "lightbox-close", "close ×");
    inner.append(img, cap, close);
    box.append(inner);
    document.body.append(box);
    const hide = () => { box.hidden = true; img.src = ""; };
    box.addEventListener("click", (e) => { if (e.target === box || e.target === close) hide(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    document.addEventListener("click", (e) => {
      const a = e.target.closest(".book-evidence-link");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      img.src = a.getAttribute("href");
      img.alt = a.dataset.caption || "";
      cap.textContent = a.dataset.caption || "";
      box.hidden = false;
    });
  }

  function openFromHash() {
    const id = decodeURIComponent((location.hash || "").slice(1));
    if (!id) return false;
    const jump = (node) => {
      if (node) window.scrollTo({top: node.getBoundingClientRect().top + window.scrollY, behavior: "instant"});
    };
    if (state.byId.has(id)) {
      const t = state.byId.get(id);
      activateGroup(t.colour_group, id, false);
      const sec = document.getElementById(`family-${t.hm}`);
      jump(sec && sec.querySelector(".colour-group-panel"));
      return true;
    }
    if (id.startsWith("group-")) {
      const gid = id.slice(6);
      if (state.groupById.has(gid)) {
        activateGroup(gid, null, false);
        const g = state.groupById.get(gid);
        jump(document.getElementById(`family-${g.hm}`));
        return true;
      }
    }
    jump(document.getElementById(id));
    return false;
  }

  function counts() {
    const meta = state.data.meta;
    document.querySelectorAll("[data-count='total']").forEach(n => { n.textContent = meta.total_types; });
    document.querySelectorAll("[data-cc]").forEach(n => {
      const k = n.dataset.cc;
      n.textContent = k === "t" ? meta.total_types : (meta.types[k] || 0);
    });
  }

  async function main() {
    const [res, cres] = await Promise.all([fetch(DATA_URL), fetch(CROPS_URL)]);
    if (!res.ok) throw new Error("data " + res.status);
    state.data = await res.json();
    if (cres.ok) state.crops = await cres.json();
    const typesByGroup = new Map();
    state.data.types.forEach(t => {
      state.byId.set(t.id, t);
      if (!typesByGroup.has(t.colour_group)) typesByGroup.set(t.colour_group, []);
      typesByGroup.get(t.colour_group).push(t);
    });
    state.data.groups.forEach(g => {
      g.types = (g.types || []).map(id => state.byId.get(id)).filter(Boolean);
      state.groupById.set(g.id, g);
      if (!state.groupsByFamily.has(g.hm)) state.groupsByFamily.set(g.hm, []);
      state.groupsByFamily.get(g.hm).push(g);
    });
    const ordinal = (id) => parseInt(id.split("-").pop(), 10);
    state.groupsByFamily.forEach(list => list.sort((a, b) => (a.k - b.k) || (ordinal(a.id) - ordinal(b.id))));
    counts();
    directory();
    const atlas = document.getElementById("pattern-atlas");
    atlas.replaceChildren();
    ORDER.forEach(hm => {
      const groups = state.groupsByFamily.get(hm);
      if (groups && groups.length) atlas.append(familySection(hm, state.data.wallpaper[hm], groups));
    });
    lightbox();
    // debug/deep view: ?solo=<type-id> renders just that family section
    const solo = new URLSearchParams(location.search).get("solo");
    if (solo && state.byId.has(solo)) {
      const t = state.byId.get(solo);
      activateGroup(t.colour_group, solo, false);
      document.querySelectorAll(".catalog-directory, .tcp-intro").forEach(n => n.remove());
      ORDER.forEach(hm => {
        if (hm !== t.hm) {
          const s = document.getElementById(`family-${hm}`);
          if (s) s.remove();
        }
      });
      return;
    }
    openFromHash();
    // fill every family (except one already opened by the hash) with its
    // default pane: the first coloured (k >= 2) group
    ORDER.forEach(hm => {
      const sec = document.getElementById(`family-${hm}`);
      if (!sec || sec.querySelector(".pattern-pane")) return;
      const groups = state.groupsByFamily.get(hm) || [];
      const first = groups.find(g => g.k >= 2) || groups[0];
      if (first) activateGroup(first.id, null, false);
    });
    if (location.hash) {
      // re-apply after the default panes (and lazy images) settle heights
      openFromHash();
      window.addEventListener("load", () => { openFromHash(); }, {once: true});
    }
    window.addEventListener("hashchange", openFromHash);
  }
  main().catch(err => {
    const atlas = document.getElementById("pattern-atlas");
    if (atlas) atlas.replaceChildren(el("p", "noscript-note", "Catalogue data could not be loaded: " + err.message));
  });
})();
