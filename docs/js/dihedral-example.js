/* The hexagon worked out: every colouring of a D6-symmetric figure.
 *
 * The point of the page is that a colouring is not something you invent, it is
 * something you CHOOSE A SUBGROUP FOR. Copies of the motif are labelled by
 * group elements, the colours are the cosets of H, and everything else —
 * how many colours, which symmetries preserve them, whether the palette can be
 * read as a clock — follows.
 *
 * D6 here is the hexagon's twelve symmetries (the crystallographer's D6, the
 * one behind the site's 632 and *632), not the algebraist's group of order 6.
 * An element is (k, f): turn by k*60 degrees, and reflect first when f = 1.
 * Composition is worked out from F R(t) F = R(-t):
 *
 *     (k1,f1)(k2,f2) = (k1 ± k2 mod 6, f1+f2 mod 2),  minus when f1 = 1.
 *
 * The subgroup lattice is enumerated here rather than typed in, so the page
 * cannot drift from the mathematics: 16 subgroups in 10 conjugacy classes.
 */
"use strict";
import { bodyPath } from "./motif.js?v=47";

const N = 6;
const ELS = [];
for (let f = 0; f < 2; f++) for (let k = 0; k < N; k++) ELS.push([k, f]);
const key = g => g[0] + "," + g[1];
const E = [0, 0];

function mul(a, b) {
  return [(a[0] + (a[1] === 0 ? b[0] : -b[0]) + 2 * N) % N, (a[1] + b[1]) % 2];
}
const INV = new Map(ELS.map(g => [key(g), ELS.find(h => key(mul(g, h)) === key(E))]));

function elName(g) {
  const r = g[0] === 0 ? "" : (g[0] === 1 ? "r" : "r" + g[0]);
  return g[1] ? (r + "s" || "s") || "s" : (r || "1");
}

/* ---------------------------------------------------------- the lattice */
function close(gens) {
  const S = new Map([[key(E), E]]);
  const fr = [E];
  while (fr.length) {
    const x = fr.pop();
    for (const g of gens) {
      const y = mul(x, g);
      if (!S.has(key(y))) { S.set(key(y), y); fr.push(y); }
    }
  }
  return [...S.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const sig = H => H.map(key).sort().join("|");

const SUBS = new Map();
for (const a of ELS) for (const b of ELS) {
  const H = close([a, b]);
  SUBS.set(sig(H), H);
}
const conjugate = (H, g) => H.map(h => mul(mul(g, h), INV.get(key(g))))
  .sort((x, y) => x[1] - y[1] || x[0] - y[0]);

/* one representative per conjugacy class, with everything the page reports */
const CLASSES = [];
{
  const seen = new Set();
  for (const H of [...SUBS.values()].sort((A, B) => A.length - B.length)) {
    if (seen.has(sig(H))) continue;
    const orbit = new Set(ELS.map(g => sig(conjugate(H, g))));
    orbit.forEach(s => seen.add(s));
    // the kernel: what every conjugate has in common
    const inAll = h => ELS.every(g =>
      conjugate(H, g).some(x => key(x) === key(h)));
    const core = H.filter(inAll);
    CLASSES.push({ H, nconj: orbit.size, core, colours: ELS.length / H.length,
                   normal: orbit.size === 1, colourOrder: ELS.length / core.length });
  }
}


/* Do gH and Hg cut the group the same way, and if not, how much survives?
 * A left multiplication by a sends the right coset Hg to aHg, which is again
 * a right coset only when aH = Ha — so the symmetries that still permute the
 * right-coset blocks are exactly the normaliser of H. */
function sides(H) {
  const part = side => new Set(ELS.map(g =>
    H.map(hh => key(side === "L" ? mul(g, hh) : mul(hh, g))).sort().join("|")));
  const L = [...part("L")].sort().join("//");
  const R = [...part("R")].sort().join("//");
  const rblocks = new Set(ELS.map(g => H.map(hh => key(mul(hh, g))).sort().join("|")));
  const keeps = ELS.filter(a => {
    const moved = new Set([...rblocks].map(b =>
      b.split("|").map(t => t.split(",").map(Number))
        .map(x => key(mul(a, x))).sort().join("|")));
    return [...moved].every(x => rblocks.has(x));
  });
  return { agree: L === R, keeps: keeps.length,
           norm: ELS.filter(a => H.every(h =>
             H.some(x => key(x) === key(mul(mul(a, h), INV.get(key(a)))))))
             .length };
}

/* names, from the structure rather than from a lookup table */
function isoName(H) {
  const n = H.length;
  if (n === 1) return "1";
  if (n === 2) return "C₂";
  if (n === 3) return "C₃";
  if (n === 4) return H.every(h => key(mul(h, h)) === key(E)) ? "V₄" : "C₄";
  if (n === 6) return H.some(h => close([h]).length === 6) ? "C₆" : "S₃";
  return "D₆";
}
const groupName = ord =>
  ({ 1: "1", 2: "C₂", 3: "C₃", 4: "V₄", 6: "S₃", 12: "D₆" })[ord] || ("order " + ord);

/* ---------------------------------------------------------- the picture */
/* Okabe-Ito, extended: distinguishable, and safe for the common colour
 * deficiencies — a page about colour should not fail for a reader who sees
 * fewer of them. */
const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00",
                 "#56B4E9", "#F0E442", "#4d4d4d", "#8c564b", "#1f9e8f",
                 "#7f3fbf", "#a6a413"];
const GROUND = "#faf9f6", RULE = "#c9c3b4", EDGE = "#3b4756";

/* element (k,f) as a matrix in MATH coordinates: reflect in the x-axis when
 * f = 1, then turn by k*60 degrees */
function matOf(g) {
  const t = (g[0] * Math.PI) / 3, c = Math.cos(t), s = Math.sin(t);
  const R = [[c, -s], [s, c]];
  return g[1] ? [[R[0][0], -R[0][1]], [R[1][0], -R[1][1]]] : R;
}
const applyM = (M, p) => [M[0][0] * p[0] + M[0][1] * p[1],
                          M[1][0] * p[0] + M[1][1] * p[1]];

/* the base motif sits inside the fundamental domain: the sliver between the
 * vertex at 0 degrees and the edge midpoint at 30 degrees */
const BASE = [0.60 * Math.cos(Math.PI / 12), 0.60 * Math.sin(Math.PI / 12)];

export function drawColouring(canvas, H, side = "L") {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 240, h = canvas.clientHeight || 240;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, w, h);

  const S = Math.min(w, h) * 0.44;
  const cx = w / 2, cy = h / 2;
  const scr = p => [cx + S * p[0], cy - S * p[1]];

  // the hexagon and its twelve fundamental domains, faintly
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i * Math.PI) / 3;
    const q = scr([Math.cos(a), Math.sin(a)]);
    i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
  }
  ctx.closePath();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const rad = i % 2 === 0 ? 1 : Math.cos(Math.PI / 6);
    const q = scr([rad * Math.cos(a), rad * Math.sin(a)]);
    ctx.moveTo(cx, cy);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // one motif per group element, coloured by its coset
  // LEFT cosets gH, or RIGHT cosets Hg. Only the left ones are invariant
  // under the action that put the copies where they are — see cosetSide().
  const blockOf = g => H.map(hh => key(side === "L" ? mul(g, hh) : mul(hh, g)))
    .sort().join("|");
  const cosets = [];
  const indexOf = new Map();
  for (const g of ELS) {
    const c = blockOf(g);
    if (!indexOf.has(c)) { indexOf.set(c, cosets.length); cosets.push(c); }
  }
  const R = S * 0.20;
  for (const g of ELS) {
    const c = blockOf(g);
    const M = matOf(g);
    const p = scr(applyM(M, BASE));
    ctx.save();
    ctx.translate(p[0], p[1]);
    // the same isometry, conjugated into the y-down frame the canvas uses
    ctx.transform(M[0][0], -M[1][0], -M[0][1], M[1][1], 0, 0);
    bodyPath(ctx, R);
    ctx.fillStyle = PALETTE[indexOf.get(c) % PALETTE.length];
    ctx.fill("evenodd");
    ctx.lineWidth = Math.max(0.7, R * 0.06);
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.restore();
  }
  return cosets.length;
}

/* ------------------------------------------------------------------ page */
const WORDS = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 6: "Six",
                12: "Twelve" };

const host = document.getElementById("colourings");
if (host) {
  // grouped by palette size, the way catalogue D is: how many colours is the
  // first thing a reader sorts by, and it is the index of the subgroup
  const byColours = new Map();
  for (const c of CLASSES) {
    if (!byColours.has(c.colours)) byColours.set(c.colours, []);
    byColours.get(c.colours).push(c);
  }
  for (const n of [...byColours.keys()].sort((a, b) => a - b)) {
    const list = byColours.get(n).sort((a, b) => b.H.length - a.H.length);
    const h = document.createElement("h3");
    h.id = "n" + n;
    h.innerHTML = `${WORDS[n] || n} colour${n > 1 ? "s" : ""}` +
      `<span style="color:var(--muted);font-weight:normal;"> — ` +
      `${list.length} colouring${list.length > 1 ? "s" : ""}, ` +
      `H of index ${n}</span>`;
    host.append(h);
    const grid = document.createElement("div");
    grid.className = "dgrid";
    host.append(grid);
    for (const c of list) {
    const card = document.createElement("section");
    card.className = "dcard";
    const pair = document.createElement("div");
    pair.className = "dpair";
    const cvL = document.createElement("canvas");
    const cvR = document.createElement("canvas");
    const labL = document.createElement("span"), labR = document.createElement("span");
    labL.textContent = "gH"; labR.textContent = "Hg";
    const boxL = document.createElement("figure"), boxR = document.createElement("figure");
    boxL.append(cvL, labL); boxR.append(cvR, labR);
    pair.append(boxL, boxR);
    const meta = document.createElement("div");
    meta.className = "dmeta";
    const conj = c.nconj > 1
      ? `<span class="tag nonsym">${c.nconj} conjugates</span>` : "";
    meta.innerHTML =
      `<div class="dhead"><b>${c.colours} colour${c.colours > 1 ? "s" : ""}</b>` +
      `<span class="tag">H = ${isoName(c.H)}</span>` +
      (c.normal ? `<span class="tag fwd">normal</span>` : conj) + `</div>` +
      `<dl class="dfacts">` +
      `<dt>H</dt><dd class="mono">{${c.H.map(elName).join(", ")}}</dd>` +
      `<dt>kernel</dt><dd class="mono">{${c.core.map(elName).join(", ")}} ` +
      `= ${isoName(c.core)}</dd>` +
      `<dt>colour group</dt><dd>${groupName(c.colourOrder)}` +
      (c.colourOrder === c.colours
        ? ` &mdash; regular`
        : `, order ${c.colourOrder} on ${c.colours} colours`) + `</dd></dl>`;
    const sd = sides(c.H);
    meta.insertAdjacentHTML("beforeend",
      `<p class="dside">${sd.agree
        ? "gH = Hg elementwise, so the two pictures are the same colouring."
        : `gH \u2260 Hg: the right-coset blocks are a different partition, and ` +
          `only <b>${sd.keeps} of 12</b> symmetries permute them \u2014 the ` +
          `normaliser of H. The right-hand picture is not a colouring of this ` +
          `figure.`}</p>`);
    card.append(pair, meta);
    grid.append(card);                       // attach before measuring
    const got = drawColouring(cvL, c.H, "L");
    drawColouring(cvR, c.H, "R");
    if (got !== c.colours) console.error("coset count disagrees", c, got);
    if (sd.agree !== c.normal) console.error("agree/normal mismatch", c, sd);
    if (!sd.agree && sd.keeps !== sd.norm) console.error("keeps != normaliser", c, sd);
    }
  }
}

/* the small figures in the prose */
const orbit = document.getElementById("fig-orbit");
if (orbit) drawColouring(orbit, close([]));           // H = 1: twelve colours
const cosetFig = document.getElementById("fig-coset");
if (cosetFig) drawColouring(cosetFig, close([[0, 1]]));   // H = {1, s}

/* the counts quoted in the prose, so they cannot go stale */
const put = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
put("n-subs", SUBS.size);
put("n-classes", CLASSES.length);
