/* Two-Color Patterns — renders the 88 Grünbaum–Shephard two-colour pattern
   types from data/two-color-patterns.json: one SVG plate per type (motif with
   the stabiliser's own symmetry, seated in its stratum, orbit under Γ,
   coloured by H, generator overlay), a data table, and the Presentation
   section augmented with the pattern-type invariant (the marked signature). */
(() => {
  "use strict";

  const V = "11";
  const DATA_URL = "data/two-color-patterns.json?v=" + V;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#0072B2", "#E69F00"];
  const W = 960, H = 560;
  const SCALE = {p1: 100, p2: 100, pm: 100, pg: 100, cm: 120, pmm: 140, pmg: 140,
    pgg: 140, cmm: 175, p4: 150, p4m: 215, p4g: 175, p3: 150, p3m1: 195,
    p31m: 195, p6: 195, p6m: 235};
  const SUMMARY = {
    p1: "Translations only.", p2: "Four order-2 cone points.",
    pm: "Two mirror boundaries.", pg: "Two crosscaps: glide reflections, no mirrors.",
    cm: "One mirror boundary and one crosscap.",
    pmm: "One boundary with four right-angled corners.",
    pmg: "Two order-2 cone points and one mirror boundary.",
    pgg: "Two order-2 cone points and one crosscap.",
    cmm: "One order-2 cone point and a boundary with two corners.",
    p4: "Cone points of orders 4, 4, 2.", p4m: "Kaleidoscopic corners 4, 4, 2.",
    p4g: "One order-4 cone point and a boundary with one corner.",
    p3: "Three order-3 cone points.", p3m1: "Kaleidoscopic corners 3, 3, 3.",
    p31m: "One order-3 cone point and a boundary with one order-3 corner.",
    p6: "Cone points of orders 6, 3, 2.", p6m: "Kaleidoscopic corners 6, 3, 2.",
  };
  const STYPE_NAME = {c1: "trivial (general position)", d1: "d1 — one mirror",
    c2: "c2 — a half-turn", d2: "d2 — two perpendicular mirrors", c3: "c3",
    d3: "d3", c4: "c4", d4: "d4", c6: "c6", d6: "d6"};
  const SUB = {"1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅"};

  const state = {data: null, byId: new Map(), typesByGroup: new Map(),
                 groupsByFamily: new Map(), families: []};

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
  const gsPretty = (s) => { // 'pmm[2]4' -> 'pmm[2]₄'
    const m = /^(.*\])(\d?)$/.exec(s);
    return m ? m[1] + (m[2] ? SUB[m[2]] : "") : s;
  };

  // ---- the G / H / S(M) notation --------------------------------------
  // G = the wallpaper group Γ (all symmetries of the coloured pattern),
  // H = the stabiliser of one colour (CBGS, Symmetries of Things §12 p. 155);
  //     at two colours index 2 forces H = K, so their G^p/H/K prints as G/K,
  // S(M) = the stabiliser of one copy of the motif (Grünbaum–Shephard's induced
  //     group) — the datum that turns 46 colour groups into 88 pattern types.
  const smShort = (t) => {
    const s = t.seat;
    if (s.kind === "interior") return "1";
    return "⟨" + s.letters.join(", ") + "⟩";
  };
  const smLong = (t) => t.seat.kind === "interior" ? "1" : `${smShort(t)} ≅ ${t.seat.stype}`;
  const GHK_TITLE = {
    G: "G — the wallpaper group Γ: every symmetry of the coloured pattern",
    H: "H — the stabiliser of one colour (Symmetries of Things §12, p. 155); at two colours it has index 2, hence is normal and equals the kernel K, so the book prints the single-slash G/K",
    S: "S(M) — the stabiliser of one copy of the motif: the seat, and the datum the colour group does not carry",
  };
  // The book's own tag for the one colour type its symbol does not determine:
  // Table 11.1 splits ∗∗/∗∗ into (1) and (2) (SoT p. 139, p. 141). Carrying it
  // makes the printed string separate all 88 types.
  const ghkTag = (t) => { const i = t.chaim_type.indexOf("("); return i < 0 ? "" : t.chaim_type.slice(i); };
  function ghkNode(t, opts = {}) {
    const e = el("span", "ghk-expression" + (opts.cls ? " " + opts.cls : ""));
    const term = (text, key) => { const n = el("span", "ghk-term", text); n.title = GHK_TITLE[key]; return n; };
    e.append(term(star(t.orbifold), "G"), el("span", "ghk-separator", "/"),
             term(star(t.H.orb) + ghkTag(t), "H"), el("span", "ghk-separator", "/"),
             term(opts.long ? smLong(t) : smShort(t), "S"));
    return e;
  }

  // typeset a Chaim signature template with superscripts and optional marks.
  // template: "*{P}2{Q}2{R}2{S}2", perms {P:1,...}, seat {kind, letters}
  function signatureNode(fam, perms, seat, opts = {}) {
    const wrap = el("span", "sig" + (opts.big ? " sig-big" : ""));
    const t = fam.template;
    if (fam.hm === "p1") {
      wrap.append(document.createTextNode("◦"));
      const sup = el("sup", "", superscript(perms.X) + "," + superscript(perms.Y));
      wrap.append(sup);
      return wrap;
    }
    // tokenise
    const tokens = [];
    let i = 0;
    while (i < t.length) {
      if (t[i] === "{") {
        const j = t.indexOf("}", i);
        tokens.push({kind: "sup", letter: t.slice(i + 1, j)});
        i = j + 1;
      } else {
        tokens.push({kind: "sym", ch: t[i]});
        i += 1;
      }
    }
    // decide marks
    const marks = new Set();
    if (seat && seat.kind !== "interior") {
      const letters = seat.letters;
      tokens.forEach((tok, k) => {
        if (seat.kind === "edge" && tok.kind === "sup" && tok.letter === letters[0]) marks.add(k);
        if (seat.kind === "gyration" && tok.kind === "sup" && tok.letter === letters[0]) {
          marks.add(k); if (tokens[k + 1]) marks.add(k + 1);
        }
        if (seat.kind === "corner" && tok.kind === "sup" && tok.letter === letters[0]) {
          if (tokens[k + 1] && tokens[k + 1].kind === "sym") marks.add(k + 1);
        }
      });
    }
    tokens.forEach((tok, k) => {
      let node;
      if (tok.kind === "sup") {
        node = el("sup", "", superscript(perms[tok.letter]));
        node.title = tok.letter + (perms[tok.letter] === 1 ? " preserves the colours" : " interchanges the colours");
      } else {
        node = el("span", "sig-sym", tok.ch === "*" ? "∗" : tok.ch);
      }
      if (marks.has(k)) node.classList.add("seat-mark");
      wrap.append(node);
    });
    return wrap;
  }
  function superscript(n) { return {1: "¹", 2: "²", 3: "³", 4: "⁴", 6: "⁶"}[n]; }

  // annotated signature with letters typeset: '∗P6Q3R2' -> ∗<i>P</i>6…
  function annotatedNode(fam, seat) {
    const wrap = el("span", "sig sig-annot");
    if (fam.hm === "p1") {
      wrap.append(document.createTextNode("◦"), el("sup", "", "X,Y"));
      return wrap;
    }
    const s = fam.annotated;
    const letters = seat ? new Set(seat.letters) : new Set();
    for (const ch of s) {
      if (/[A-Zαβγδ]/.test(ch) && !"◦".includes(ch)) {
        const n = el("sup", "gen-letter", ch);
        if (seat && seat.kind !== "interior" && letters.has(ch)) n.classList.add("seat-mark");
        wrap.append(n);
      } else if (ch === "^" || ch === "{" || ch === "}") {
        // p1: ◦^{X,Y}
        if (ch === "{") wrap.append(el("sup", "", "X,Y"));
      } else if (ch === "X" || ch === "Y") {
        // handled by the sup above
      } else {
        wrap.append(document.createTextNode(ch));
      }
    }
    return wrap;
  }

  // ------------------------------------------------------------ geometry
  function motifShape(stype, r) {
    // returns an SVG group in local coordinates: mirror axis along +x
    const g = svg("g");
    const add = (e) => g.append(e);
    const P = (pts) => pts.map(p => p.map(v => (v * r / 13).toFixed(2)).join(",")).join(" ");
    switch (stype) {
      case "c1": {
        add(svg("polygon", {points: P([[0, -13], [13, 0], [0, 13], [-13, 0]]), class: "motif-fill"}));
        const t = svg("text", {x: 0, y: 0.75 * r / 13, class: "motif-letter",
          "font-size": (13 * r / 13).toFixed(1), "text-anchor": "middle", "dominant-baseline": "middle"});
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

  function buildPlate(t, fam, opts = {}) {
    const scale = opts.scale || SCALE[t.hm];
    const w = opts.width || W, h = opts.height || H;
    const s = svg("svg", {viewBox: `0 0 ${w} ${h}`, role: "img", preserveAspectRatio: "xMidYMid meet"});
    const title = svg("title");
    title.textContent = `${t.gs}: ${t.seat.label}, colour group ${gsPretty(t.gs_group)}`;
    s.append(title);
    s.append(svg("rect", {x: 0, y: 0, width: w, height: h, class: "plate-bg"}));
    // world -> screen: origin near the middle-left, y up
    const ox = w / 2 - 0.35 * scale, oy = h / 2 + 0.3 * scale;
    const toS = (x, y) => [ox + x * scale, oy - y * scale];
    const b1 = fam.basis[0], b2 = fam.basis[1];
    const seed = t.render.seed;
    const r = Math.max(7, Math.min(opts.rmax || 22, 0.38 * t.render.min_dist * scale));
    const angle0 = t.seat.angle || 0;
    const shape = motifShape(t.seat.stype, r);
    const defs = svg("defs");
    const sym = svg("g", {id: `m-${t.id}-${opts.tag || "p"}`});
    sym.append(shape);
    defs.append(sym);
    s.append(defs);
    const motifs = svg("g", {class: "motifs"});
    // extent of lattice translations needed
    const minLen = Math.min(Math.hypot(...b1), Math.hypot(...b2));
    const N = Math.ceil(Math.max(w, h) / (scale * minLen)) + 2;
    const placed = new Map();
    for (const op of t.render.ops) {
      // op applied to seed: p' = m seed + t
      const px = op.m[0] * seed[0] + op.m[1] * seed[1] + op.t[0];
      const py = op.m[2] * seed[0] + op.m[3] * seed[1] + op.t[1];
      const det = op.m[0] * op.m[3] - op.m[1] * op.m[2];
      // orientation: image of the local x-axis direction (angle0)
      const cx = Math.cos(angle0 * Math.PI / 180), cy = Math.sin(angle0 * Math.PI / 180);
      const dx = op.m[0] * cx + op.m[1] * cy, dy = op.m[2] * cx + op.m[3] * cy;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j <= N; j++) {
          const x = px + i * b1[0] + j * b2[0];
          const y = py + i * b1[1] + j * b2[1];
          const [sx, sy] = toS(x, y);
          if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
          const colour = (op.c + ((t.render.lattice_colour[0] * i + t.render.lattice_colour[1] * j) % 2 + 2) % 2) % 2;
          const key = `${sx.toFixed(1)}:${sy.toFixed(1)}`;
          if (placed.has(key)) continue;   // same copy via the stabiliser
          placed.set(key, true);
          const use = svg("use", {href: `#m-${t.id}-${opts.tag || "p"}`,
            transform: `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${(-ang).toFixed(2)}) scale(1 ${det < 0 ? -1 : 1})`,
            fill: PALETTE[colour], class: "motif"});
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
    fam.generators.forEach((gen, idx) => {
      const keep = t.perms[gen.name] === 1;
      const cls = keep ? "keeps" : "swaps";
      if (gen.kind === "translation") return;
      if (gen.kind === "rotation") {
        const [cx, cy] = toS(gen.centre[0], gen.centre[1]);
        const rad = 15;
        const a0 = -72, delta = -gen.angle_degrees;  // screen y is flipped
        const a1 = a0 + delta;
        const p = (a) => [cx + rad * Math.cos(a * Math.PI / 180), cy + rad * Math.sin(a * Math.PI / 180)];
        const A = p(a0), B = p(a1);
        const large = Math.abs(delta) > 180 ? 1 : 0;
        const sweep = delta > 0 ? 1 : 0;
        const d = `M ${A[0].toFixed(2)} ${A[1].toFixed(2)} A ${rad} ${rad} 0 ${large} ${sweep} ${B[0].toFixed(2)} ${B[1].toFixed(2)}`;
        const grp = svg("g", {class: `gen gen-rotation ${cls}`});
        grp.append(svg("path", {d, class: "gen-halo"}));
        grp.append(svg("path", {d, class: "gen-arc"}));
        // arrow head at B
        const tan = [-Math.sin(a1 * Math.PI / 180), Math.cos(a1 * Math.PI / 180)].map(v => v * Math.sign(delta || 1));
        const base = [B[0] - tan[0] * 7, B[1] - tan[1] * 7];
        const nrm = [-tan[1], tan[0]];
        grp.append(svg("polygon", {class: "gen-arrow", points: [B, [base[0] + nrm[0] * 3.5, base[1] + nrm[1] * 3.5], [base[0] - nrm[0] * 3.5, base[1] - nrm[1] * 3.5]].map(q => q.map(v => v.toFixed(2)).join(",")).join(" ")}));
        grp.append(svg("circle", {cx, cy, r: 4.2, class: "gen-centre"}));
        label(grp, gen.name, cx + rad + 8, cy - rad - 2);
        g.append(grp);
        return;
      }
      // mirror or glide: a line through axis_point in axis_direction, clipped
      const [px, py] = gen.axis_point, [dx, dy] = gen.axis_direction;
      const [sx, sy] = toS(px, py);
      const sdx = dx, sdy = -dy;
      // find intersections with the plate rectangle
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
        // glide vector arrow at the axis point
        const gl = gen.glide * scale;
        const ax = sx, ay = sy;
        const bx = ax + sdx * gl, by = ay + sdy * gl;
        grp.append(svg("line", {x1: ax, y1: ay, x2: bx, y2: by, class: "gen-glide-vec"}));
        const tan = [sdx * Math.sign(gl), sdy * Math.sign(gl)];
        const nrm = [-tan[1], tan[0]];
        grp.append(svg("polygon", {class: "gen-arrow", points: [[bx, by], [bx - tan[0] * 7 + nrm[0] * 3.5, by - tan[1] * 7 + nrm[1] * 3.5], [bx - tan[0] * 7 - nrm[0] * 3.5, by - tan[1] * 7 - nrm[1] * 3.5]].map(q => q.map(v => v.toFixed(2)).join(",")).join(" ")}));
      }
      // label near the plate edge where the line enters, offset inward
      const lx = A[0] + (B[0] - A[0]) * 0.06 + 10 * (-sdy), ly = A[1] + (B[1] - A[1]) * 0.06 + 10 * sdx - 4;
      label(grp, gen.name, Math.min(Math.max(lx, 12), w - 16), Math.min(Math.max(ly, 18), h - 8));
      g.append(grp);
    });
    // seat marker
    const [qx, qy] = toS(t.render.seed[0], t.render.seed[1]);
    const seatG = svg("g", {class: "seat-marker"});
    seatG.append(svg("circle", {cx: qx, cy: qy, r: 0.55 * Math.max(7, Math.min(22, 0.38 * t.render.min_dist * scale)) + 9, class: "seat-ring"}));
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
    const st = s.stype;
    if (s.kind === "interior") {
      return "The motif sits in general position: no symmetry of the pattern fixes a copy, S(M) is trivial and the coloured pattern is primitive — its type is the colour group itself.";
    }
    const eq = s.equivalent.filter(e => JSON.stringify(e.letters) !== JSON.stringify(s.letters));
    let alt = "";
    if (eq.length) {
      alt = " Equivalently " + eq.map(e => e.label).join(", or ") +
        " — those seats are carried onto this one by a symmetry of the coloured signature.";
    }
    if (s.kind === "edge") {
      const ab = {"pp48a-2-2": ["PP48B[2]₂", "R", "3–2"], "pp48b-2-2": ["PP48A[2]₂", "Q", "6–3"]}[t.id];
      const abNote = ab ? ` Note: the mirrors ${s.letters[0]} and ${ab[1]} lie on one and the same line of p6m (the ${s.letters[0] === "Q" ? "6–3" : "3–2"} and ${ab[2]} edges of the kaleidoscopic triangle), so this type and ${ab[0]} have conjugate stabilisers and identical chains S(M) ≤ H ≤ Γ; Grünbaum and Shephard keep them apart as the two varieties A and B of PP48, and this page follows their tally of 88.` : "";
      return `The motif is seated on the mirror ${s.letters[0]}: its stabiliser S(M) = ⟨${s.letters[0]}⟩ ≅ d1, and ${s.letters[0]} preserves the colours (superscript 1), as it must — a mirror through a copy fixes that copy and hence its colour.${alt}${abNote}`;
    }
    if (s.kind === "corner") {
      const [a, b] = s.letters;
      return `The motif is seated at the corner of order ${s.order} where the mirrors ${a} and ${b} meet: S(M) = ⟨${a}, ${b}⟩ ≅ d${s.order}. Both mirrors preserve the colours, so the whole corner group does.${alt}`;
    }
    return `The motif is seated at the ${s.order}-fold centre of ${s.letters[0]}: S(M) = ⟨${s.letters[0]}⟩ ≅ c${s.order}, and ${s.letters[0]} preserves the colours (superscript 1).${alt}`;
  }

  // ------------------------------------------------------------ DOM builders
  function lightboxLink(href, caption, content) {
    const a = el("a", "book-evidence-link source-value-link");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.dataset.caption = caption;
    a.append(content, el("span", "source-link-mark", "↗"));
    return a;
  }

  function dataTable(t, fam) {
    const table = el("table", "pattern-data");
    const row = (label, valueNode) => {
      const tr = el("tr");
      const th = el("th"); th.scope = "row"; th.textContent = label;
      const td = el("td");
      if (valueNode instanceof Node) td.append(valueNode); else td.textContent = valueNode;
      tr.append(th, td); table.append(tr);
    };
    // G&S pattern type with crop link
    const gsNode = el("span", "source-math-symbol", t.gs);
    row("G&S pattern type", lightboxLink(`img/gs-plates/${t.id}.webp`,
      `${t.gs} — Grünbaum & Shephard, Tilings and Patterns, Fig. ${t.primitive ? "8.2.2" : "8.3.5"}`, gsNode));
    const under = el("span");
    under.append(el("span", "source-math-symbol", `PP${t.pp}${t.variety || ""}`),
      document.createTextNode(` — ${fam.hm} pattern, motif stabiliser ${STYPE_NAME[t.seat.stype]}` +
        (t.primitive ? " (primitive)" : " (non-primitive)")));
    row("Underlying pattern", under);
    // colour group
    const cg = el("span");
    const cgLink = el("a", "", gsPretty(t.gs_group));
    cgLink.href = `crystals-colored.html#${t.colour_group}`;
    cgLink.className = "source-math-symbol";
    cg.append(cgLink);
    if (t.shubnikov) cg.append(document.createTextNode(` · Shubnikov ${t.shubnikov}`));
    cg.append(document.createTextNode(" · "));
    const dlink = el("a", "", "catalogue D");
    dlink.href = `crystals-colored.html#${t.colour_group}`;
    cg.append(dlink);
    row("G&S colour group", cg);
    // Chaim
    const ch = el("span");
    ch.append(lightboxLink(`img/sot/${t.colour_group}.webp`,
      `${star(t.chaim_type)} — The Symmetries of Things, Table 11.1`, el("span", "source-math-symbol", star(t.chaim_type))));
    ch.append(document.createTextNode("  ·  "));
    ch.append(signatureNode(fam, t.perms, null));
    row("Chaim colour type", ch);
    // G / H / S(M) — the three groups of the pattern type
    const ghkCell = el("span");
    ghkCell.append(ghkNode(t, {long: true, cls: "source-math-symbol"}));
    const leg = el("span", "ghk-legend");
    leg.append(document.createTextNode(`the group Γ = ${fam.hm} · the stabiliser of a colour H = ${t.H.hm}, here also the kernel K · the seat S(M) = ${smLong(t)}. `),
      document.createTextNode(`Index 2 makes H normal, so H = K and the book's single-slash form applies: ${star(t.chaim_type.split(" (")[0])}${ghkTag(t) ? ghkTag(t) + " — Table 11.1's tag for the one type its symbol does not determine" : ""}.`));
    ghkCell.append(leg);
    row("G / H / S(M)", ghkCell);
    // seat / marked signature
    const seat = el("span");
    seat.append(signatureNode(fam, t.perms, t.seat, {big: true}));
    seat.append(document.createTextNode("  "));
    seat.append(el("span", "seat-text", t.seat.kind === "interior" ? "general position" : t.seat.label));
    row("Marked signature (the type)", seat);
    return table;
  }

  function presentation(t, fam, siblings) {
    const sec = el("section", "group-presentation");
    const head = el("header", "presentation-heading");
    head.append(el("h4", "", "Presentation"));
    const pal = el("div", "action-palette");
    pal.append(document.createTextNode("cycles over"));
    ["A", "B"].forEach((L, i) => { const sw = el("span", "action-colour", L); sw.style.setProperty("--swatch", PALETTE[i]); pal.append(sw); });
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
      if (t.perms[gen.name] === 2) { const v = el("span", "presentation-permutation", "(A B)"); v.title = "A↔B: interchanges the colours"; td.append(v); }
      else { td.append(el("span", "presentation-identity", "—")); td.title = "preserves the colours"; }
      const td2 = el("td", "seat-cell");
      if (stabLetters.has(gen.name)) {
        const m = el("span", "seat-flag", "● fixes the motif");
        td2.append(m);
      }
      tr.append(th, td, td2);
      tb.append(tr);
    });
    table.append(tb);
    sec.append(table);
    const rel = el("p", "presentation-relations");
    rel.append(el("strong", "", "Relations"), el("span", "", `Γ = ⟨${fam.generators.map(g => g.name).join(", ")} | ${fam.relations}⟩`));
    sec.append(rel);
    // the invariant block
    const inv = el("div", "pattern-invariant");
    const h5 = el("h5", "", "Pattern-type invariant  S(M) ≤ H ≤ Γ");
    inv.append(h5);
    const chain = el("p", "invariant-chain");
    const Sword = t.seat.kind === "interior" ? "1" : "⟨" + (t.seat.kind === "corner" ? t.seat.letters.join(", ") : t.seat.letters[0]) + "⟩";
    const swapGens = fam.generators.filter(g => t.perms[g.name] === 2).map(g => g.name);
    const keepGens = fam.generators.filter(g => t.perms[g.name] === 1).map(g => g.name);
    chain.append(el("span", "chain-term", `S(M) = ${Sword} ≅ ${t.seat.stype}`), el("span", "chain-sep", "≤"),
      el("span", "chain-term", `H = ${star(t.H.orb)}` + (swapGens.length ? ` (kernel: ${swapGens.join(", ")} ↦ (A B)${keepGens.length ? ", " + keepGens.join(", ") + " ↦ 1" : ""})` : "")),
      el("span", "chain-sep", "≤"), el("span", "chain-term", `Γ = ${star(t.orbifold)}`));
    inv.append(chain);
    inv.append(el("p", "invariant-text", seatSentence(t)));
    // siblings
    const sib = siblings.filter(x => x.id !== t.id);
    if (sib.length) {
      const p = el("p", "invariant-siblings");
      p.append(document.createTextNode("Same colour group, other seats: "));
      sib.forEach((x, i) => {
        if (i) p.append(document.createTextNode("; "));
        const a = el("a", "", x.gs);
        a.href = `#${x.id}`;
        p.append(a, document.createTextNode(` (${x.seat.kind === "interior" ? "general position" : x.seat.label})`));
      });
      p.append(document.createTextNode(". They share Γ, H and the colour permutations of every generator; only the seat — hence S(M) — differs."));
      inv.append(p);
    } else {
      inv.append(el("p", "invariant-siblings", (fam.hm === "p1" || fam.hm === "pg")
        ? "This colour group carries no other pattern type: Γ has no special positions (no mirrors, no rotation centres), so general position is the only seat."
        : "This colour group carries no other pattern type: every special position of Γ meets a colour-interchanging symmetry."));
    }
    sec.append(inv);
    return sec;
  }

  function buildPane(t, fam, siblings) {
    const pane = el("article", "pattern-pane");
    pane.id = t.id;
    const head = el("header", "pane-head");
    const h4 = el("h4", "pane-title");
    h4.append(el("span", "pane-gs", t.gs),
      el("span", "pane-sub", ` · ${t.seat.kind === "interior" ? "general position" : t.seat.label} · `),
      ghkNode(t, {cls: "pane-ghk"}));
    head.append(h4);
    const perm = el("a", "pane-permalink", "#");
    perm.href = `#${t.id}`; perm.title = "permalink";
    head.append(perm);
    pane.append(head);
    const body = el("div", "pane-body");
    const fig = el("figure", "pattern-plate");
    fig.append(buildPlate(t, fam));
    const cap = el("figcaption");
    cap.append(document.createTextNode("Overlay: generators of Γ — "),
      el("span", "cap-keep", "solid = preserves colours"), document.createTextNode(", "),
      el("span", "cap-swap", "dashed = interchanges them"), document.createTextNode("; translation generators are not drawn; the ring marks the seat of the motif."));
    fig.append(cap);
    const details = el("div", "pattern-details");
    details.append(dataTable(t, fam), presentation(t, fam, siblings));
    body.append(fig, details);
    pane.append(body);
    return pane;
  }

  function familySection(hm, fam, groups) {
    const sec = el("section", "wallpaper-family");
    sec.id = `family-${hm}`;
    const head = el("header", "family-header");
    const h2 = el("h2");
    h2.append(el("span", "family-orbifold", star(fam.orbifold)), el("span", "family-hm", hm));
    const p = el("p");
    p.append(document.createTextNode(SUMMARY[hm] + " Annotated signature "), annotatedNode(fam, null),
      document.createTextNode(`; ${groups.length} two-colour group${groups.length > 1 ? "s" : ""}, ${groups.reduce((n, g) => n + g.types.length, 0)} pattern type${groups.reduce((n, g) => n + g.types.length, 0) > 1 ? "s" : ""}.`));
    head.append(h2, p);
    sec.append(head);
    // group navigation chips
    const nav = el("nav", "colour-group-tabs");
    nav.setAttribute("aria-label", `Colour groups over ${star(fam.orbifold)}`);
    groups.forEach(g => {
      const a = el("a", "colour-group-tab");
      a.href = `#group-${g.id}`;
      const name = el("span", "tab-name");
      name.append(signatureNode(fam, g.types[0].perms, null));
      const palette = el("span", "tab-palette");
      PALETTE.forEach(c => { const s = el("span"); s.style.setProperty("--swatch", c); palette.append(s); });
      const sub = el("span", "tab-sub", `${gsPretty(g.types[0].gs_group)} · ${g.types.length} type${g.types.length > 1 ? "s" : ""}`);
      a.append(name, palette, sub);
      nav.append(a);
    });
    sec.append(nav);
    groups.forEach(g => {
      const band = el("section", "colour-group-band");
      band.id = `group-${g.id}`;
      const bh = el("header", "band-header");
      const h3 = el("h3");
      h3.append(el("span", "band-type", star(g.types[0].chaim_type)), document.createTextNode(" "),
        signatureNode(fam, g.types[0].perms, null, {big: true}));
      const meta = el("p", "band-meta");
      const cgl = el("a", "", gsPretty(g.types[0].gs_group));
      cgl.href = `crystals-colored.html#${g.id}`;
      meta.append(document.createTextNode("Grünbaum–Shephard "), cgl,
        document.createTextNode(g.types[0].shubnikov ? ` · Shubnikov ${g.types[0].shubnikov}` : ""),
        document.createTextNode(` · G/H = ${star(g.types[0].orbifold)}/${star(g.types[0].H.orb)} · `),
        lightboxLink(`img/sot/${g.id}.webp`, `${star(g.types[0].chaim_type)} — The Symmetries of Things, Table 11.1`, el("span", "", "Table 11.1 row")),
        document.createTextNode(` · ${g.types.length === 1 ? "one pattern type" : g.types.length + " pattern types"}: `));
      g.types.forEach((t, i) => {
        if (i) meta.append(document.createTextNode(", "));
        const a = el("a", "", t.gs); a.href = `#${t.id}`; meta.append(a);
      });
      bh.append(h3, meta);
      band.append(bh);
      g.types.forEach(t => band.append(buildPane(t, fam, g.types)));
      sec.append(band);
    });
    return sec;
  }

  function directory() {
    const grid = document.getElementById("directory-grid");
    if (!grid) return;
    state.families.forEach(hm => {
      const fam = state.data.wallpaper[hm];
      const groups = state.groupsByFamily.get(hm);
      const a = el("a", "directory-family");
      a.href = `#family-${hm}`;
      const strong = el("strong", "", star(fam.orbifold));
      const first = groups[0].types[0];
      const mini = buildPlate(first, fam, {width: 320, height: 240, scale: SCALE[hm] * 0.85, rmax: 30, noOverlay: true, tag: "d"});
      const n = el("span", "directory-count", `${groups.reduce((k, g) => k + g.types.length, 0)}`);
      a.append(strong, mini, n);
      grid.append(a);
    });
  }

  function introFigure() {
    const host = document.getElementById("intro-example");
    if (!host) return;
    const fam = state.data.wallpaper.pmm;
    ["pp15-2-1", "pp15-2-1s"].forEach(id => {
      const t = state.byId.get(id);
      const fig = el("figure", "intro-plate");
      fig.append(buildPlate(t, fam, {tag: "i"}));
      const cap = el("figcaption");
      const strong = el("strong", "", t.gs);
      cap.append(strong, document.createTextNode(` — ${t.seat.label}: `), signatureNode(fam, t.perms, t.seat, {big: true}));
      fig.append(cap);
      host.append(fig);
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

  function counts() {
    document.querySelectorAll("[data-count]").forEach(n => {
      const k = n.dataset.count;
      if (k === "total") n.textContent = state.data.types.length;
      if (k === "primitive") n.textContent = state.data.meta.primitive;
      if (k === "nonprimitive") n.textContent = state.data.meta.nonprimitive;
    });
  }

  async function main() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("data " + res.status);
    state.data = await res.json();
    const ORDER = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm", "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
    state.data.types.forEach(t => {
      state.byId.set(t.id, t);
      if (!state.typesByGroup.has(t.colour_group)) state.typesByGroup.set(t.colour_group, []);
      state.typesByGroup.get(t.colour_group).push(t);
    });
    ORDER.forEach(hm => {
      const gids = [...state.typesByGroup.keys()].filter(id => state.typesByGroup.get(id)[0].hm === hm);
      if (!gids.length) return;
      // order groups by their G&S subscript
      gids.sort((a, b) => {
        const ga = state.typesByGroup.get(a)[0].gs_group, gb = state.typesByGroup.get(b)[0].gs_group;
        return ga.localeCompare(gb, undefined, {numeric: true});
      });
      state.families.push(hm);
      state.groupsByFamily.set(hm, gids.map(id => ({id, types: state.typesByGroup.get(id)})));
    });
    counts();
    directory();
    introFigure();
    const atlas = document.getElementById("pattern-atlas");
    state.families.forEach(hm => atlas.append(familySection(hm, state.data.wallpaper[hm], state.groupsByFamily.get(hm))));
    lightbox();
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({block: "start"});
    }
  }
  main().catch(err => {
    const atlas = document.getElementById("pattern-atlas");
    if (atlas) atlas.append(el("p", "noscript-note", "Catalog data could not be loaded: " + err.message));
  });
})();
