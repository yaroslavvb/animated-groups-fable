// main.js — the page of "The Folding: 22× lab". One state (cut, motion, t, the 3D view, the view in focus), one sheet
// (motions.js), several pictures of it at the same moment (looks.js), and in all of them the place where the sheet
// passes through itself right now (selfx.js), with a strip under the scrubber that says WHEN it does.
//
// window.__lab (for scripted pictures): ready, setCut(i), setMotion(key), setT(t), setFocus(key | null),
// setView({ az, el, zoom }), getState(), scene().

import { GROUP, CUTS, MOTIONS, buildSheet, positionsAt } from './motions.js';
import { LOOKS, baseGeometry, piecesGeometry, checkerGeometry, createCutter, createSlicer, clipPolylineY, crossingOnPaper,
  PIECE_COLORS, PIECE_HEX, PAPER, CHECKER, CROSS_RGB, CROSS_HEX } from './looks.js';
import { createSelfX, chainSegments, jitterPlane } from './selfx.js';
import { createRenderer } from '../../src/render3d.js';   // (13 Nov 2026: the app's renderer has the palette itself; the fork is gone)
import { elementsNear, symmetryElements } from '../../src/groups.js';
import { hexToRgb, classColor, INK, MUTED, SURFACE_FRONT, SURFACE_BACK, SURFACE_OPACITY } from '../../src/palette.js';

const INK_RGB = hexToRgb(INK), WHITE = [1, 1, 1];
const smooth = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
/** A play eased at both ends, at a constant pace in between (as The Folding's timeline). */
function easePlay(x, r = 0.18) {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const v = 1 / (1 - r);
  if (x < r) return (0.5 * v * x * x) / r;
  if (x > 1 - r) { const y = 1 - x; return 1 - (0.5 * v * y * y) / r; }
  return v * (x - r / 2);
}

const MOTION_CHIP = { acts: 'One piece', twist: 'Twisted', recut: 'Re-cut first' };
const MOTION_URL = { acts: 'one', twist: 'twisted', recut: 'recut' };
const LEAD = {
  acts: 'The tile folds as <b>one sheet</b>, as in The Folding.',
  twist: '<b>One sheet</b> again, closed another way: the near part turns straight through the far part.',
  recut: 'The tile is first <b>re-cut into the Pocket</b> by half-turns and glides of the group, then folds.',
};
const pct = (t) => Math.round(100 * t) + '%';
/** The caption: what the motion is, then what the crossing profile measured (once it is complete). */
function captionHtml(S) {
  const sh = S.sheet, P = S.profile, pocket = sh.cut.index === 0;
  const lead = pocket && sh.key === 'recut' ? 'The <b>Pocket</b> needs no re-cutting: it folds as it is.' : LEAD[sh.key];
  if (!P.summary) return lead;
  const m = P.summary;
  if (m.first === null) return lead + ' <b>No paper passes through paper</b>' + (pocket || sh.key === 'recut' ? ': the Pocket’s cut runs along the double line.' : '.');
  return lead + ` It passes through itself from <b>${pct(m.first)}</b> of the way ${m.last >= 0.999 ? 'to the end' : 'to ' + pct(m.last)}, `
    + `${m.max.toFixed(2)} tile widths at most; the red line shows where.`;
}
const KIND_ORDER = { crease: 0, rim: 1, seam: 2 };
const PROFILE_STEPS = 240;
// the order the profile is measured in: every 16th moment first, then the moments between, so that the whole strip
// is there at once, roughly, and sharpens
const PROFILE_ORDER = (() => {
  const seen = new Uint8Array(PROFILE_STEPS + 1), out = [];
  for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i <= PROFILE_STEPS; i += step) if (!seen[i]) { seen[i] = 1; out.push(i); }
  return out;
})();
const CROSS_NONE = 0.004;          // tile widths: below this the sheet is not crossing

// ---------------------------------------------------------------------------------------------------------------
// The scene: a sheet and everything derived from it
// ---------------------------------------------------------------------------------------------------------------

const scenes = new Map();
function sceneFor(cut, motion) {
  const key = cut + '|' + motion;
  let S = scenes.get(key);
  if (S) return S;
  const sheet = buildSheet(cut, motion);
  const lines = sheet.lines.map((L) => ({ ...L, out: new Float32Array(3 * L.tag.length) })).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  S = {
    key, sheet, size: sheet.size,
    pos: new Float32Array(3 * sheet.n),
    det: { uv: jitterPlane(sheet.uv, sheet.tri, sheet.triTag), pos: new Float32Array(3 * sheet.n), X: createSelfX(sheet.tri) },
    geo: { base: baseGeometry(sheet), pieces: null, checker: null }, geoPos: { pieces: null, checker: null },
    lines, cones: sheet.cones.map((c) => ({ ...c, p: [0, 0, 0] })),
    cross: [], crossLen: 0, paperCross: null, paperCount: 0, axis: [], frame: null, t: -1, ymin: 0,
    profile: { L: new Float32Array(PROFILE_STEPS + 1).fill(NaN), done: 0, max: 0, X: null, pos: null, summary: null },
    cutter: null, slicer: null,
  };
  scenes.set(key, S);
  return S;
}

function mapScene(S, t) {
  const sh = S.sheet, pos = S.pos, n = sh.n;
  positionsAt(sh, t, sh.uv, sh.tag, pos);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < 3 * n; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let r2 = 0;
  for (let k = 0; k < 3 * n; k += 3) { const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = pos[k + 2] - cz, d = dx * dx + dy * dy + dz * dz; if (d > r2) r2 = d; }
  S.frame = { center: [cx, cy, cz], radius: 0.9 * (Math.sqrt(r2) || S.size) };   // a little tighter than the sphere: the cards are small
  S.ymin = y0;
  for (const L of S.lines) positionsAt(sh, t, L.uv, L.tag, L.out);
  const F = sh.at(t);
  for (const c of S.cones) { c.p[0] = c.p[1] = c.p[2] = NaN; F(c.u, c.v, c.tag, c.p); if (!Number.isFinite(c.p[0] + c.p[1] + c.p[2])) { c.p[0] = c.u; c.p[1] = c.v; c.p[2] = 0; } }
  // where the sheet passes through itself, on the detector's own triangulation of the same sheet
  positionsAt(sh, t, S.det.uv, sh.tag, S.det.pos);
  const r = S.det.X.compute(S.det.pos, S.size);
  S.cross = chainSegments(r.segs, r.count, 1e-4 * S.size);
  S.crossLen = r.length / S.size;
  S.paperCross = crossingOnPaper(r, S.det.pos, S.det.uv, sh.tri, sh.triTag, sh, S.paperCross);
  S.paperCount = r.count;
  S.axis = sh.axis(t);
  S.t = t;
  S.geoPos.piecesT = S.geoPos.checkerT = -1;
}

/** The geometry of a look (made when first needed) and its positions at the scene's t. */
function geometryOf(S, kind) {
  if (kind === 'pieces') {
    if (!S.geo.pieces) { S.geo.pieces = piecesGeometry(S.sheet); S.geoPos.pieces = new Float32Array(3 * S.geo.pieces.n); }
    const G = S.geo.pieces, P = S.geoPos.pieces;
    if (S.geoPos.piecesT !== S.t) {
      for (let i = 0; i < G.n; i++) { const s = 3 * G.src[i]; P[3 * i] = S.pos[s]; P[3 * i + 1] = S.pos[s + 1]; P[3 * i + 2] = S.pos[s + 2]; }
      S.geoPos.piecesT = S.t;
    }
    return { G, P };
  }
  if (kind === 'checker') {
    if (!S.geo.checker) { S.geo.checker = checkerGeometry(S.sheet, S.size / 6); S.geoPos.checker = new Float32Array(3 * S.geo.checker.n); }
    const G = S.geo.checker, P = S.geoPos.checker;
    if (S.geoPos.checkerT !== S.t) { positionsAt(S.sheet, S.t, G.uv, G.tag, P); S.geoPos.checkerT = S.t; }
    return { G, P };
  }
  return { G: S.geo.base, P: S.pos };
}

/** The plane that cuts the front off (Cutaway): none until the closing starts, then it comes in from the front. */
function cutPlane(S, t) {
  const sh = S.sheet, from = sh.clipFrom, w = smooth((t - from) / (0.3 * (1 - from)));
  if (!(w > 0)) return null;
  const fr = sh.frame, target = fr.yc + 0.5 * sh.fold.finalMap.mu * fr.hy, start = S.ymin - 0.02 * S.size;
  return target > start ? start + w * (target - start) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// State, URL
// ---------------------------------------------------------------------------------------------------------------

const state = { cut: 2, motion: 'acts', t: 0, focus: null, playing: false, target: 1 };
const shared = { view: null, viewDirty: false, home: null };
const VIEW_KEYS = ['map', ...LOOKS.map((l) => l.key), 'key'];

function encodeHash() {
  const p = [];
  if (state.cut !== 2) p.push('cut=' + CUTS[state.cut].name.toLowerCase());
  if (state.motion !== 'acts') p.push('m=' + MOTION_URL[state.motion]);
  if (state.focus) p.push('look=' + state.focus);
  if (state.t > 0.0005) p.push('t=' + (+state.t.toFixed(3)));
  if (shared.view && shared.viewDirty) p.push('v=' + [...shared.view.q, shared.view.zoom].map((x) => +(+x).toFixed(3)).join('/'));
  return p.length ? '#' + p.join('&') : '';
}
function applyHash(raw) {
  const out = {};
  for (const part of String(raw || '').replace(/^#/, '').split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    let v = part.slice(i + 1);
    try { v = decodeURIComponent(v); } catch (e) { /* as it is */ }
    out[part.slice(0, i)] = v;
  }
  if (out.cut !== undefined) { const i = CUTS.findIndex((c) => c.name.toLowerCase() === String(out.cut).toLowerCase()); if (i >= 0) state.cut = i; }
  if (out.m !== undefined) { const k = Object.keys(MOTION_URL).find((m) => MOTION_URL[m] === out.m); if (k) state.motion = k; }
  if (out.look !== undefined) state.focus = VIEW_KEYS.includes(out.look) ? out.look : null;
  if (out.t !== undefined) { const t = Number(out.t); if (Number.isFinite(t)) state.t = clamp01(t); }
  if (out.v !== undefined) {
    const a = String(out.v).split('/').map(Number);
    if (a.length === 5 && a.every(Number.isFinite) && Math.hypot(a[0], a[1], a[2], a[3]) > 0.5 && a[4] > 0.2 && a[4] < 5) { shared.view = { q: a.slice(0, 4), zoom: a[4] }; shared.viewDirty = true; }
  }
}
let hashTimer = 0, lastHash = null;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const h = encodeHash();
    if (h === lastHash) return;
    lastHash = h;
    try { history.replaceState(history.state, '', h || location.pathname + location.search); } catch (e) { /* a sandbox without history */ }
    if (window.parent && window.parent !== window) { try { window.parent.postMessage({ type: 'ss-hash', hash: h || '#' }, '*'); } catch (e) { /* nobody to tell */ } }
  }, 250);
}

// ---------------------------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const lab = $('lab'), grid = $('grid');
const ICON_OPEN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5l-4.5 4.5M6.5 13.5h-4v-4M2.5 13.5l4.5-4.5"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5h-4.5zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5h-4.5z"/></svg>';

function chip(text, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.textContent = text; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', onClick);
  return b;
}

const cards = [];
function makeCard(key, title, note, kind) {
  const el = document.createElement('section');
  el.className = 'card' + (kind === 'key' ? ' key' : '');
  el.dataset.look = key;
  const head = document.createElement('header');
  const h = document.createElement('h2'); h.textContent = title;
  const p = document.createElement('p'); p.className = 'note'; p.textContent = note;
  const z = document.createElement('button'); z.type = 'button'; z.className = 'zoom'; z.innerHTML = ICON_OPEN; z.setAttribute('aria-label', 'Enlarge ' + title);
  z.addEventListener('click', () => setFocus(state.focus === key ? null : key));
  head.append(h, p, z);
  el.append(head);
  const card = { key, kind, el, zoom: z, title, canvas: null, labels: null, R: null, sceneKey: null, surfKey: null };
  if (kind === 'key') {
    const body = document.createElement('div'); body.className = 'body';
    body.innerHTML = KEY_HTML;
    el.append(body);
  } else {
    const pane = document.createElement('div'); pane.className = 'pane';
    const cv = document.createElement('canvas');
    pane.append(cv);
    card.canvas = cv;
    if (kind === '3d') {
      pane.setAttribute('data-ss-comments', 'off');
      const lb = document.createElement('div'); lb.className = 'labels';
      pane.append(lb);
      card.labels = lb;
    } else cv.setAttribute('role', 'img');
    el.append(pane);
  }
  grid.append(el);
  cards.push(card);
  return card;
}

const sw = (inner) => `<svg viewBox="0 0 34 14" aria-hidden="true">${inner}</svg>`;
const KEY_HTML = [
  [sw(`<path d="M2 7h30" stroke="${CROSS_HEX}" stroke-width="4" stroke-linecap="round"/>`), 'the sheet passes through itself here, now'],
  [sw(`<path d="M2 7h30" stroke="${INK}" stroke-width="2" stroke-dasharray="5 4"/>`), 'the double line of the finished cross-cap'],
  [sw(`<path d="M2 7h13" stroke="${classColor(0)}" stroke-width="4" stroke-linecap="round"/><path d="M19 7h13" stroke="${classColor(1)}" stroke-width="4" stroke-linecap="round"/>`), 'seams of the cut: one colour, sewn together'],
  [sw(`<path d="M2 7h30" stroke="${MUTED}" stroke-width="3" stroke-linecap="round"/>`), 'the Pocket’s cut (Re-cut first)'],
  [sw(`<path d="M2 7h30" stroke="${CROSS_HEX}" stroke-width="2" stroke-dasharray="5 4"/>`), 'in the plane: lines that land on the double line'],
  [sw(`<circle cx="17" cy="7" r="4" fill="${INK}"/>`), 'cone point of order 2'],
].map(([s, t]) => `<div class="row">${s}<span>${t}</span></div>`).join('')
  + '<p class="more">The strip under the scrubber shows how much of the sheet is crossing at each moment of the motion; its dotted level is the length of the double line. Lengths are in tile widths: the side of a square with the tile’s area.</p>';

// ---- build the page ----
const cutChips = CUTS.map((c, i) => chip(c.name, () => setCut(i)));
$('cuts').append(...cutChips);
const motionChips = MOTIONS.map((m) => chip(MOTION_CHIP[m.key], () => setMotion(m.key)));
$('motions').append(...motionChips);
const mapCard = makeCard('map', 'Plane', 'the tile, piece by piece', 'map');
for (const l of LOOKS) makeCard(l.key, l.label, l.note, '3d');
makeCard('key', 'Key', '', 'key');
const lookChips = new Map();
{
  const all = chip('All', () => setFocus(null));
  all.dataset.all = '1';
  lookChips.set(null, all);
  $('looks').append(all);
  for (const c of cards) { const b = chip(c.title, () => setFocus(c.key)); lookChips.set(c.key, b); $('looks').append(b); }
}
const playBtn = $('play'), scrub = $('scrub'), strip = $('strip');

let dirty = true, raf = 0;
function invalidate() { dirty = true; if (!raf) raf = requestAnimationFrame(tick); }

function narrow() { return window.innerWidth < 900 || window.innerHeight < 520; }
function focusNow() { return state.focus || (narrow() ? 'xray' : null); }
function layout() {
  const nr = narrow(), f = focusNow();
  lab.toggleAttribute('data-narrow', nr);
  if (f) lab.setAttribute('data-focus', f); else lab.removeAttribute('data-focus');
  for (const c of cards) {
    c.el.classList.toggle('is-on', c.key === f);
    c.zoom.innerHTML = f === c.key ? ICON_CLOSE : ICON_OPEN;
    c.zoom.setAttribute('aria-label', (f === c.key ? 'Show all views' : 'Enlarge ' + c.title));
  }
  for (const [k, b] of lookChips) { b.setAttribute('aria-pressed', String(k === f)); if (k === null) b.hidden = nr; }
  cutChips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.cut)));
  motionChips.forEach((b, i) => b.setAttribute('aria-pressed', String(MOTIONS[i].key === state.motion)));
  invalidate();
}

function setCut(i) { if (i === state.cut) return; stop(); state.cut = i; state.t = 0; layout(); writeHash(); }
function setMotion(k) { if (k === state.motion) return; stop(); state.motion = k; state.t = 0; layout(); writeHash(); }
function setFocus(k) { state.focus = k && VIEW_KEYS.includes(k) ? k : null; layout(); writeHash(); }
function setT(t) { state.t = clamp01(t); invalidate(); writeHash(); }

// ---- the transport ----
let playFrom = 0, playTo = 1, playStart = 0, playLen = 1;
function stop() { state.playing = false; }
function play() {
  const S = sceneFor(state.cut, state.motion);
  playFrom = state.t; playTo = state.t >= 1 ? 0 : 1;
  playLen = Math.max(0.3, Math.abs(playTo - playFrom) * S.sheet.duration);
  playStart = performance.now();
  state.playing = true;
  invalidate();
}
playBtn.addEventListener('click', () => { if (state.playing) { stop(); invalidate(); writeHash(); } else play(); });
scrub.addEventListener('input', () => { stop(); setT(Number(scrub.value) / 1000); });
$('reset').addEventListener('click', () => {
  shared.view = null; shared.viewDirty = false;
  syncing = true;
  for (const c of cards) if (c.R) c.R.resetView(true);
  syncing = false;
  invalidate(); writeHash();
});
window.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || (e.target && e.target.closest && e.target.closest('button, input, a, [contenteditable]'))) return;
  e.preventDefault();
  if (state.playing) { stop(); invalidate(); } else play();
});

// ---- the 3D views ----
let syncing = false;
function onCamera(card) {
  if (syncing || !card.R) return;
  const v = card.R.getView();
  if (shared.view && Math.abs(v.zoom - shared.view.zoom) < 1e-6 && v.q.every((x, i) => Math.abs(x - shared.view.q[i]) < 1e-6)) return;
  shared.view = { q: v.q.slice(), zoom: v.zoom };
  shared.viewDirty = !shared.home || Math.abs(v.zoom - shared.home.zoom) > 1e-3 || v.q.some((x, i) => Math.abs(x - shared.home.q[i]) > 1e-3);
  syncing = true;
  for (const c of cards) if (c.R && c !== card) c.R.setView(shared.view);
  syncing = false;
  writeHash();
}
function ensureRenderer(card) {
  if (card.R || card.kind !== '3d' || !card.el.offsetParent) return;
  card.R = createRenderer(card.canvas, { labelLayer: card.labels });
  if (!shared.home) { const h = card.R.getView(); shared.home = { q: h.q.slice(), zoom: h.zoom }; }
  card.canvas.setAttribute('aria-label', card.title + ': the fold in 3D. Drag or arrow keys to turn; scroll, pinch, + or − to zoom.');
  if (shared.view) { syncing = true; card.R.setView(shared.view); syncing = false; }
  card.R.onChange(() => onCamera(card));
}
function lineScale(card) {
  const w = card.canvas.clientWidth, h = card.canvas.clientHeight;
  return Math.max(0.62, Math.min(1.15, Math.min(w, h) / 420));
}

function sceneLines(S, t, k, clipY) {
  const out = [];
  const push = (points, o) => {
    if (clipY === null) { out.push({ points, ...o }); return; }
    for (const part of clipPolylineY(points, clipY)) out.push({ points: part, ...o });
  };
  for (const L of S.lines) {
    const st = L.style(t);
    if (!st || !(st.alpha > 0.004)) continue;
    push(L.out, { color: L.color, width: st.width * (L.kind === 'crease' ? Math.max(k, 0.85) : k), alpha: st.alpha, dashed: !!st.dashed, xray: L.kind === 'crease' ? 0.5 : 0.42 });
  }
  for (const a of S.axis) push(a, { color: INK_RGB, width: 2.2 * Math.max(k, 0.85), dashed: true, xray: 0.7 });
  for (const c of S.cross) push(c, { color: WHITE, width: 8.5 * k, alpha: 0.85, xray: 0.9 });
  for (const c of S.cross) push(c, { color: CROSS_RGB, width: 5 * k, xray: 0.95 });
  return out;
}
function sceneMarkers(S, k, clipY) {
  const out = [], eps = 0.12 * S.size;
  S.cones.forEach((c, i) => {
    if (clipY !== null && c.p[1] < clipY) return;
    let near = false;
    for (let j = 0; j < i; j++) { const o = S.cones[j].p; if (Math.hypot(o[0] - c.p[0], o[1] - c.p[1], o[2] - c.p[2]) < eps) near = true; }
    out.push({ p: c.p.slice(), color: INK_RGB, size: 11 * Math.max(k, 0.8), shape: 'dot', label: near ? '' : c.label });
  });
  return out;
}

const STYLE = {
  xray: { front: SURFACE_FRONT, back: SURFACE_BACK, opacity: SURFACE_OPACITY },
  paper: { front: PAPER.front, back: PAPER.back, opacity: 1 },
  pieces: { palette: PIECE_COLORS, opacity: 1 },
  checker: { palette: CHECKER, opacity: 1 },
  ribs: { front: [0.72, 0.84, 0.82], back: [0.86, 0.90, 0.89], opacity: 0.13 },
  cutaway: { front: PAPER.front, back: PAPER.back, opacity: 1 },
};

function drawCard(card, S, t, sceneChanged) {
  const R = card.R;
  if (!R || !R.ok) return;
  const k = lineScale(card), look = card.key;
  if (card.styled !== look) { R.setStyle(STYLE[look]); card.styled = look; }
  let clipY = null, extra = [];
  if (look === 'cutaway') {
    clipY = cutPlane(S, t);
    if (clipY === null) {
      if (card.surfKey !== S.key + '|whole') { R.setSurface({ positions: S.pos, indices: S.sheet.tri }); card.surfKey = S.key + '|whole'; } else R.updatePositions(S.pos);
    } else {
      if (!S.cutter) S.cutter = createCutter(S.sheet.tri, S.sheet.n);
      const c = S.cutter(S.pos, clipY);
      R.setSurface({ positions: c.positions, indices: c.indices });
      card.surfKey = null;
      for (const s of c.section) extra.push({ points: s, color: INK_RGB, width: 2.8 * k, xray: 0.6 });
    }
  } else {
    const { G, P } = geometryOf(S, look);
    const sk = S.key + '|' + look;
    if (card.surfKey !== sk) { R.setSurface({ positions: P, indices: G.tri, tint: G.tint || undefined }); card.surfKey = sk; } else R.updatePositions(P);
    if (look === 'ribs') {
      if (!S.slicer) S.slicer = createSlicer(S.sheet.tri, S.sheet.n);
      const fr = S.sheet.frame;
      for (const s of S.slicer(S.pos, fr.yc, fr.hy / 5).lines) extra.push({ points: s, color: INK_RGB, width: 1.7 * Math.max(k, 0.85), alpha: 0.8, xray: 1 });
    }
  }
  const lines = sceneLines(S, t, k, clipY);
  // the slices and the cut edge go under the seams and the crossing
  R.setLines(extra.concat(lines));
  R.setMarkers(sceneMarkers(S, k, clipY));
  if (S.frame) R.setFrame(S.frame, sceneChanged || !card.framed);
  card.framed = true;
  R.render();
}

// ---- the plane ----
const mapCache = new Map();
function mapData(cut) {
  let d = mapCache.get(cut);
  if (d) return d;
  const H = buildSheet(cut, 'acts').domain, P = buildSheet(0, 'acts').domain;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of [...H.poly, ...P.poly]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0);
  const copies = elementsNear(GROUP, cx, cy, 1.6 * r, H.seed[0], H.seed[1]).map((g) => H.poly.map((p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty]));
  const sym = symmetryElements(GROUP, cx, cy, 1.2 * r);
  d = { H, P, box: [x0, y0, x1, y1], copies, sym };
  mapCache.set(cut, d);
  return d;
}
function sizeCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function drawMap(S, t) {
  if (!mapCard.el.offsetParent) return;
  const c = sizeCanvas(mapCard.canvas);
  if (!c) return;
  const { g, w, h } = c, sh = S.sheet, M = sh.map, D = mapData(state.cut);
  const [bx0, by0, bx1, by1] = D.box, pad = 0.07;
  const sc = Math.min(w / ((bx1 - bx0) * (1 + 2 * pad)), h / ((by1 - by0) * (1 + 2 * pad)));
  const X = (x) => w / 2 + (x - (bx0 + bx1) / 2) * sc, Y = (y) => h / 2 - (y - (by0 + by1) / 2) * sc;
  const path = (poly) => { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the other tiles
  g.strokeStyle = '#d6d6dc'; g.lineWidth = 1;
  for (const poly of D.copies) { path(poly); g.stroke(); }
  // glide axes
  g.strokeStyle = '#a9a9b2'; g.lineWidth = 1; g.setLineDash([5, 4]);
  for (const a of D.sym.glides) { g.beginPath(); g.moveTo(X(a.px - 9 * a.ux), Y(a.py - 9 * a.uy)); g.lineTo(X(a.px + 9 * a.ux), Y(a.py + 9 * a.uy)); g.stroke(); }
  g.setLineDash([]);
  // the tile, piece by piece
  for (const p of M.pieces) { path(p.poly); g.fillStyle = PIECE_HEX[p.part % PIECE_HEX.length]; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; }
  // the lines that are folded onto the double line: across the plane, stronger inside the tile
  const fr = sh.frame, cellH = 4 * fr.hy;
  g.strokeStyle = CROSS_HEX; g.setLineDash([6, 5]); g.lineWidth = 1.2; g.globalAlpha = 0.45;
  for (let k = -3; k <= 3; k++) { const y = fr.yc + k * cellH / 2; g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); }
  g.globalAlpha = 1; g.lineWidth = 2.2;
  for (const m of M.midlines) { g.beginPath(); g.moveTo(X(m[0]), Y(m[1])); g.lineTo(X(m[2]), Y(m[3])); g.stroke(); }
  g.setLineDash([]);
  // Re-cut first: where the tile is cut, the Pocket it is carried into, and the piece that is moving
  if (M.pocket) {
    g.strokeStyle = MUTED; g.lineWidth = 1.6; g.setLineDash([4, 3]);
    for (const s of M.cuts) { g.beginPath(); g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 1.3; g.setLineDash([2, 3]);
    path(M.pocket); g.stroke();
    g.setLineDash([]);
    const mv = M.moves.find((m) => m.to > m.from && t > m.from && t < m.to);
    if (mv) { const pc = M.pieces.find((p) => p.part === mv.part); if (pc) { path(pc.poly); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); } }
  }
  // the seams
  const H = sh.domain;
  g.lineWidth = Math.max(3, Math.min(4.5, sc * 0.02));
  for (let i = 0; i < H.poly.length; i++) {
    const a = H.poly[i], b = H.poly[(i + 1) % H.poly.length], e = H.edges[i];
    g.strokeStyle = classColor(e.color === undefined ? e.cls : e.color);
    g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke();
  }
  // 2-fold centres (a lens), the tile's own a little larger
  g.fillStyle = INK;
  for (const ctr of D.sym.centers) { g.beginPath(); g.ellipse(X(ctr.x), Y(ctr.y), 2.6, 5.2, 0, 0, 2 * Math.PI); g.fill(); }
  // the crossing, carried back to the paper: the two curves that meet
  if (S.paperCount) {
    const P = S.paperCross;
    for (const [col, lw] of [['#fff', 6.5], [CROSS_HEX, 3.6]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let s = 0; s < 2 * S.paperCount; s++) { g.moveTo(X(P[4 * s]), Y(P[4 * s + 1])); g.lineTo(X(P[4 * s + 2]), Y(P[4 * s + 3])); }
      g.stroke();
    }
  }
}

// ---- the strip under the scrubber: how much of the sheet is crossing, at every t ----
function pumpProfile(S) {
  const P = S.profile;
  if (P.done >= PROFILE_ORDER.length) return false;
  if (!P.X) { P.X = createSelfX(S.sheet.tri); P.pos = new Float32Array(3 * S.sheet.n); }
  const start = performance.now();
  while (P.done < PROFILE_ORDER.length && performance.now() - start < 7) {
    const i = PROFILE_ORDER[P.done++];
    positionsAt(S.sheet, i / PROFILE_STEPS, S.det.uv, S.sheet.tag, P.pos);
    const L = P.X.compute(P.pos, S.size).length / S.size;
    P.L[i] = L;
    if (L > P.max) P.max = L;
  }
  if (P.done >= PROFILE_ORDER.length) P.summary = summarizeProfile(P.L);
  return true;
}
/** When the sheet passes through itself: the first and the last such moment, the largest crossing and its moment. */
function summarizeProfile(L) {
  let first = null, last = null, max = 0, at = 0;
  for (let i = 0; i < L.length; i++) {
    if (L[i] >= CROSS_NONE) { if (first === null) first = i / PROFILE_STEPS; last = i / PROFILE_STEPS; }
    if (L[i] > max) { max = L[i]; at = i / PROFILE_STEPS; }
  }
  return { first, last, max, at };
}
function drawStrip(S) {
  const c = sizeCanvas(strip);
  if (!c) return;
  const { g, w, h } = c, P = S.profile;
  const fr = S.sheet.frame, axisLen = (S.sheet.fold.finalMap.mu * fr.hy) / S.size;
  const top = Math.max(1.6 * axisLen, P.max, 0.3), Yv = (L) => h - 1 - (h - 3) * Math.min(1, L / top);
  g.fillStyle = '#ececf0'; g.fillRect(0, h - 1, w, 1);
  // the crossing (paler while it is still being measured)
  g.fillStyle = CROSS_HEX; g.globalAlpha = P.summary ? 0.9 : 0.45;
  g.beginPath(); g.moveTo(0, h - 1);
  let lastX = 0;
  for (let i = 0; i <= PROFILE_STEPS; i++) {
    const L = P.L[i];
    if (L !== L) continue;                 // not measured yet
    lastX = (i / PROFILE_STEPS) * w;
    g.lineTo(lastX, Yv(L < CROSS_NONE ? 0 : L));
  }
  g.lineTo(lastX, h - 1); g.closePath(); g.fill();
  g.globalAlpha = 1;
  // the length of the double line
  g.strokeStyle = '#8a8a93'; g.lineWidth = 1; g.setLineDash([2, 3]);
  g.beginPath(); g.moveTo(0, Math.round(Yv(axisLen)) + 0.5); g.lineTo(w, Math.round(Yv(axisLen)) + 0.5); g.stroke();
  g.setLineDash([]);
  // the main points of the motion
  g.fillStyle = INK;
  for (const s of S.sheet.stops) g.fillRect(Math.round(Math.min(w - 1, s.t * w)), h - 6, 1, 6);
}

function stageText(S, t) {
  const sh = S.sheet, st = sh.stops;
  if (t <= 0) return 'Flat: the tile on the plane.';
  if (t >= 1) return 'Closed: the cross-cap.';
  if (sh.key === 'recut' && t < sh.foldFrom) {
    const mv = sh.map.moves.filter((m) => m.to > m.from), i = mv.findIndex((m) => t < m.to);
    const cur = mv[Math.max(0, i)];
    return `Re-cutting, piece ${Math.max(0, i) + 1} of ${mv.length}: ${cur.text}.`;
  }
  const half = st[st.length - 2].t;
  if (t < half) return (sh.key === 'recut' ? 'The Pocket folds' : 'The tile folds') + ' onto half of the pillow: the half-turn seams close.';
  if (sh.key === 'recut' || sh.cut.index === 0) return 'The mouth zips shut: the glide seams close.';
  return sh.key === 'twist' ? 'The glide seams close: the near part twists through the far part.' : 'The glide seams close: pinch, roll, fold back.';
}
function crossingText(S, t) {
  if (S.crossLen >= CROSS_NONE) return `The sheet passes through itself along ${S.crossLen.toFixed(2)} tile widths.`;
  if (t >= 1 && (S.sheet.key === 'recut' || S.sheet.cut.index === 0)) return 'Nothing passes through anything: four rims meet on the double line.';
  return 'Nothing passes through anything.';
}

// ---- the frame loop ----
let drawnKey = null, lastT = -1, shownCaption = null, tickMs = 0;
function tick(now) {
  raf = 0;
  const tick0 = performance.now();
  if (state.playing) {
    const x = (now - playStart) / (1000 * playLen);
    state.t = playFrom + (playTo - playFrom) * easePlay(clamp01(x));
    if (x >= 1) { state.t = playTo; state.playing = false; writeHash(); }
    dirty = true;
  }
  const S = sceneFor(state.cut, state.motion);
  const more = pumpProfile(S);
  if (more && S.profile.summary) dirty = true;        // the profile is complete: the caption can say when
  if (more && !dirty) drawStrip(S);
  if (dirty) {
    const sceneChanged = drawnKey !== S.key;
    if (sceneChanged || S.t !== state.t) mapScene(S, state.t);
    for (const c of cards) { ensureRenderer(c); if (c.kind === '3d' && c.R && c.el.offsetParent) drawCard(c, S, state.t, sceneChanged); }
    drawMap(S, state.t);
    drawStrip(S);
    if (!state.playing || Math.abs(Number(scrub.value) - 1000 * state.t) >= 1) scrub.value = String(Math.round(1000 * state.t));
    playBtn.querySelector('[data-label]').textContent = state.playing ? 'Pause' : state.t >= 1 ? 'Unfold' : 'Fold';
    const cap = captionHtml(S);
    if (cap !== shownCaption) { $('caption').innerHTML = cap; shownCaption = cap; }
    $('stage').textContent = stageText(S, state.t);
    const x = $('crossing');
    x.textContent = crossingText(S, state.t);
    x.toggleAttribute('data-on', S.crossLen >= CROSS_NONE);
    drawnKey = S.key; lastT = state.t;
    dirty = false;
    tickMs = performance.now() - tick0;
  }
  if (state.playing || more) raf = requestAnimationFrame(tick);
}

// ---- start ----
applyHash(location.hash);
window.addEventListener('hashchange', () => { const h = location.hash; if (h === lastHash) return; stop(); applyHash(h); lastHash = h; layout(); });
window.addEventListener('resize', layout);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => invalidate()).observe(grid);
lastHash = encodeHash();
layout();

window.__lab = {
  ready: true,
  setCut, setMotion, setT, setFocus,
  setView(v) {
    syncing = true;
    let first = null;
    for (const c of cards) if (c.R) { c.R.setView(v); first = first || c.R; }
    syncing = false;
    if (first) { const g = first.getView(); shared.view = { q: g.q.slice(), zoom: g.zoom }; shared.viewDirty = true; }
    writeHash();
  },
  play, stop,
  getState() {
    const S = sceneFor(state.cut, state.motion);
    return { cut: CUTS[state.cut].name, motion: state.motion, t: state.t, focus: focusNow(), playing: state.playing, crossing: S.crossLen, crossLines: S.cross.length,
      triangles: S.sheet.tri.length / 3, parts: S.sheet.parts, duration: S.sheet.duration, stops: S.sheet.stops, profileDone: !!S.profile.summary, profile: S.profile.summary, profileMax: S.profile.max, tickMs,
      hash: encodeHash(), renderers: cards.filter((c) => c.R).length };
  },
  scene() { return sceneFor(state.cut, state.motion); },
  cards,
};
