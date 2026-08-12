/* Future-directions page: paired demos — a STATIC coloured rendering of a
 * spacetime-group spec (colour = clock data) beside the LIVE animation — plus the
 * colour-count numbers computed from the catalog at load time, so the page
 * can never disagree with the data. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=40";
import { attachControls } from "./controls.js?v=40";
import { paintColored } from "./colored.js?v=40";
import { attachStage } from "./stage.js?v=40";
import { groupCaption } from "./wallpaper-data.js?v=40";
import { leadHtml } from "./catalog-names.js?v=40";

const PAIRS = [
  { host: "pair-bw", sym: "o/g′", mode: "bw",
    left: "The dichromatic pattern: colour = time sign. Swapping black and \
white is playing the animation backwards; here the swap is carried by a \
half-cell translation.",
    right: "The animation itself: columns alternately fill and drain." },
  { host: "pair-checker", sym: "c222₁2₁", mode: "phase",
    left: "The unitary two-colouring: hue = phase, and the two phases 0 and \
½ paint the two sublattices of the checkerboard.",
    right: "The animation: translating half a cell diagonally equals waiting \
half a period." },
  { host: "pair-z4", sym: "4₁4₁2₁", mode: "phase",
    left: "The perfect ℤ₄-colouring of p4: a quarter turn about any \
4-centre advances the colour by one.",
    right: "The animation: the same quarter turn advances the phase by a \
quarter period." },
  { host: "pair-z6", sym: "6₁3₁2₁", mode: "phase",
    left: "The perfect ℤ₆-colouring of p6: six colours cycling around every \
6-centre, three around every 3-centre, two around every 2-centre.",
    right: "The animation: the hero of the tutorial, read chromatically." },
];

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) { if (!anim.userPaused) anim.start(); }
    else anim.stop();
  }
}, { rootMargin: "80px" });

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const bySym = new Map(data.groups.map(g => [g.symbol, g]));

for (const p of PAIRS) {
  const host = document.getElementById(p.host);
  if (!host) continue;
  const g = bySym.get(p.sym);
  if (!g) { console.error("missing symbol", p.sym); continue; }

  const mk = (cap) => {
    const demo = document.createElement("div");
    demo.className = "demo";
    const canvas = document.createElement("canvas");
    demo.append(canvas);
    const c = document.createElement("div");
    c.className = "caption";
    c.innerHTML = cap;
    demo.append(c);
    host.append(demo);
    return { demo, canvas, cap: c };
  };

  const L = mk(`<span class="sym">${leadHtml(g)}</span>, coloured — ${p.left}`);
  paintColored(L.canvas, g.render, p.mode);

  const R = mk(groupCaption(g) + `<p style="margin:0.4rem 0 0;">${p.right}</p>`);
  const anim = new FilmGroupAnimation(R.canvas, g.render);
  anims.set(R.canvas, anim);
  observer.observe(R.canvas);
  attachStage(anim, R.canvas);      // click-to-play + keyboard, as elsewhere
  attachControls(anim, R.demo, R.cap);
}

/* ---- colour counts, computed live from the catalog ----
 * Every offset in the catalog is a multiple of 1/12, so all clock arithmetic
 * below is exact in integer twelfths. */
const T = 12;
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
const tw = x => ((Math.round(x * T) % T) + T) % T;   // to twelfths, mod 1
function clockDenom(g) {
  let d = T;
  for (const op of g.render.ops) d = gcd(d, tw(op.tau));
  return T / (d || T);
}
/* clockless: no forward operation and no centring carries an offset — the
 * reversal taus are removable by a shift of the time origin */
function clockless(g) {
  return g.render.ops.every(op => op.s === -1 || tw(op.tau) === 0);
}
const fwd = data.groups.filter(g => g.forward);   // the clockwork groups
const byN = {};
for (const g of fwd) byN[clockDenom(g)] = (byN[clockDenom(g)] || 0) + 1;
const rev = data.groups.filter(g => !g.forward && clockless(g));
const gray = rev.filter(g => g.product).length;

/* Recolouring orbits: relabelling colours by k -> u k (u a unit mod N) sends
 * tau -> u*tau and leaves every spatial part alone, so the image lies in the
 * same arithmetic class. Two catalog entries are the same group when their op
 * sets agree after an origin shift (M|v) -> (M | v + a - M a); shifts on the
 * 1/12 grid suffice for this data. Anything left unmatched must be the unique
 * forward entry of its class with that clock denominator, hence fixed by the
 * relabelling — asserted below rather than assumed. */
function opKey(ops, mul, ax, ay) {
  const rows = ops.map(o => {
    const M = o.M, v0 = tw(o.v[0]), v1 = tw(o.v[1]);
    const mx = M[0][0] * ax + M[0][1] * ay, my = M[1][0] * ax + M[1][1] * ay;
    const w0 = (((v0 + ax - mx) % T) + T) % T, w1 = (((v1 + ay - my) % T) + T) % T;
    return `${M[0][0]},${M[0][1]},${M[1][0]},${M[1][1]}|${w0},${w1}|${o.s}|${(mul * tw(o.tau)) % T}`;
  });
  rows.sort();
  return rows.join(";");
}
const shifted = new Map();          // (cls, opKey) -> id
for (const g of fwd) {
  for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
    shifted.set(g.cls + "#" + opKey(g.render.ops, 1, i, j), g.id);
  }
}
const parent = new Map(fwd.map(g => [g.id, g.id]));
const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
for (const g of fwd) {
  const N = clockDenom(g);
  for (let u = 2; u < N; u++) {
    if (gcd(u, N) !== 1) continue;
    const hit = shifted.get(g.cls + "#" + opKey(g.render.ops, u, 0, 0));
    if (hit) { parent.set(find(g.id), find(hit)); continue; }
    // unmatched: must be alone in its class at this denominator
    const kin = fwd.filter(x => x.cls === g.cls && clockDenom(x) === N);
    if (kin.length !== 1) {
      console.error("recolouring orbit undetermined for", g.symbol, g.cls);
    }
  }
}
const orbitN = {};
const seenRoot = new Set();
for (const g of fwd) {
  const r = find(g.id);
  if (seenRoot.has(r)) continue;
  seenRoot.add(r);
  const N = clockDenom(g);
  orbitN[N] = (orbitN[N] || 0) + 1;
}

const put = (key, val) => {
  for (const el of document.querySelectorAll(`[data-cc="${key}"]`)) el.textContent = val;
};
put("gray", gray);
put("proper", rev.length - gray);
for (const N of [1, 2, 3, 4, 6]) {
  put("n" + N, byN[N] || 0);
  put("o" + N, orbitN[N] || 0);
}
put("n2b", byN[2] || 0);
put("nf", fwd.length);
put("ot", seenRoot.size);

/* ---- per-wallpaper comparison table ---- */
/* Colour plane groups per wallpaper group: Wieting (1982) Table 11 /
 * Grünbaum–Shephard (1987) ch. 8, as tabulated for N = 2, 3, 4, 6. */
const LIT = {
  p1: [1, 1, 2, 1], p2: [2, 1, 3, 2], pm: [5, 2, 10, 11], pg: [2, 2, 4, 5],
  cm: [3, 2, 7, 7], pmm: [5, 1, 13, 9], pmg: [5, 2, 11, 11], pgg: [2, 1, 4, 4],
  cmm: [5, 1, 11, 8], p4: [2, 0, 5, 2], p4m: [5, 0, 13, 2], p4g: [3, 0, 7, 2],
  p3: [0, 2, 1, 1], p3m1: [1, 2, 1, 4], p31m: [1, 2, 1, 5], p6: [1, 2, 1, 5],
  p6m: [3, 2, 2, 11],
};
const ORB = {
  p1: "o", p2: "2222", pm: "**", pg: "××", cm: "*×", pmm: "*2222", pmg: "22*",
  pgg: "22×", cmm: "2*22", p4: "442", p4m: "*442", p4g: "4*2", p3: "333",
  p3m1: "*333", p31m: "3*3", p6: "632", p6m: "*632",
};
const ROT_FREE = new Set(["p1", "pm", "pg", "cm"]);
const NS = [2, 3, 4, 6];
const filmTab = {};
for (const g of fwd) {
  (filmTab[g.base] = filmTab[g.base] || {})[clockDenom(g)] =
    ((filmTab[g.base] || {})[clockDenom(g)] || 0) + 1;
}
const table = document.getElementById("cc-table");
if (table) {
  const order = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
                 "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
  const cell = n => (n ? String(n) : "·");
  let html = `<tr><th rowspan="2">wallpaper</th>` +
    `<th colspan="4">forward spacetime groups</th>` +
    `<th colspan="4">colour plane groups</th></tr><tr>` +
    NS.map(n => `<th>${n}</th>`).join("") +
    NS.map(n => `<th>${n}</th>`).join("") + `</tr>`;
  const tot = [0, 0, 0, 0], totL = [0, 0, 0, 0];
  for (const b of order) {
    const f = filmTab[b] || {};
    const cls = ROT_FREE.has(b) ? ' class="rotfree"' : "";
    html += `<tr${cls}><td><span class="sym">${ORB[b]}</span> ${b}</td>`;
    NS.forEach((n, i) => { tot[i] += f[n] || 0; html += `<td>${cell(f[n])}</td>`; });
    NS.forEach((n, i) => { totL[i] += LIT[b][i]; html += `<td>${cell(LIT[b][i])}</td>`; });
    html += `</tr>`;
  }
  html += `<tr><td><b>Σ</b></td>` + tot.map(x => `<td><b>${x}</b></td>`).join("") +
          totL.map(x => `<td><b>${x}</b></td>`).join("") + `</tr>`;
  table.innerHTML = html;
}
