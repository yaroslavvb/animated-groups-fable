// view.js — how a state of the zipping (engine.js) is drawn: every component is a flat polygon (while it is still
// a disc nobody has zipped to itself) or a ball with holes, handles, crosscaps and cross-handles at its sites.
//
// A LOOK goes with each component and remembers where its pieces sit, so that a zip changes as little as it can:
//   { kind: 'poly' }
//   { kind: 'ball', rims: Map(wordKey -> site), tubes: [{ a, b, cross }], caps: [site] }
// nextLooks() carries the looks across a zip; buildScene() turns a state and its looks into a Scene.

import { Scene, addCell, roundHole, noHole } from '../geo/scene.js';
import { ball, SIZES } from '../geo/layouts.js';
import { addEmpty, addCrosscapFeature, addTube } from '../geo/features.js';
import { flatSite } from '../geo/sites.js';
import { wordLines, evenly, fracPoint } from './draw.js';
import { addCornerPoly, regularCorners } from './parts.js';
import { THEME } from '../theme.js';

const TAU = 2 * Math.PI;
export const PALETTE = [[0, 0.447, 0.698], [0.902, 0.624, 0], [0, 0.62, 0.451], [0.8, 0.475, 0.655], [0.835, 0.369, 0], [0.337, 0.706, 0.914], [0.478, 0.361, 0.78], [0.55, 0.43, 0.12], [0.36, 0.49, 0.07], [0.24, 0.3, 0.56]];
export const cssColor = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export const wordKey = (rim) => rim.map((e) => e.id + (e.s > 0 ? '+' : e.s < 0 ? '-' : '!')).join(' ');
/** One key per rim of a component, in order. Two rims can carry the same word (two holes each bounded by the zip b): the second gets a suffix. */
export function rimKeys(comp) {
  const seen = new Map();
  return comp.rims.map((rim) => { const k = wordKey(rim), c = seen.get(k) || 0; seen.set(k, c + 1); return c ? k + '#' + c : k; });
}
export const isDisc = (comp) => comp.o === 0 && comp.x === 0 && comp.X === 0 && comp.rims.length === 1;

/** Where the k components stand: in a row, each in a slot { center, R }. */
export function slots(k) {
  const R = k <= 1 ? 1 : k === 2 ? 0.86 : k === 3 ? 0.66 : k === 4 ? 0.52 : 0.44, gap = 2.55 * R;
  const out = [];
  for (let i = 0; i < k; i++) out.push({ center: [(i - (k - 1) / 2) * gap, 0, 0], R });
  return { list: out, frame: { center: [0, 0, 0], radius: k <= 1 ? 1.42 : (k * gap) / 2 * 0.92 } };
}

// ---- looks
export const polyLook = () => ({ kind: 'poly' });
const cloneLook = (l) => (l.kind === 'poly' ? polyLook() : { kind: 'ball', rims: new Map(l.rims), tubes: l.tubes.map((t) => ({ ...t })), caps: l.caps.slice() });
const LAYOUT0 = ball({ n: 20 });          // only for which sites neighbour which, and how far apart
const NEIGHBOUR = LAYOUT0.sites.map((s) => new Set(s.toward.keys()));
const MATCH = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];

function usedSites(look) {
  const u = new Set(look.caps);
  for (const t of look.tubes) { u.add(t.a); u.add(t.b); }
  for (const s of look.rims.values()) u.add(s);
  return u;
}
function freeSite(look, near = 0, prefer = []) {
  const u = usedSites(look);
  for (const s of prefer) if (s !== undefined && !u.has(s)) return s;
  // otherwise the lowest free number: site 0 and the five round it are the tightest cluster, so the pieces of a
  // ball stay together and can all be turned to the viewer at once (ballOf)
  for (let s = 0; s < 12; s++) if (!u.has(s)) return s;
  return -1;
}
function freePair(look, prefer = null) {
  const u = usedSites(look);
  if (prefer && !u.has(prefer[0]) && !u.has(prefer[1]) && NEIGHBOUR[prefer[0]].has(prefer[1])) return prefer;
  if (prefer) for (const a of prefer) if (!u.has(a)) for (const b of NEIGHBOUR[a]) if (!u.has(b) && !prefer.includes(b)) return [a, b];
  for (const [a, b] of MATCH) if (!u.has(a) && !u.has(b)) return [a, b];
  for (let a = 0; a < 12; a++) if (!u.has(a)) for (const b of NEIGHBOUR[a]) if (!u.has(b)) return [a, b];
  return null;
}

/** Make `look` fit `comp`: the right number of tubes and crosscaps, a site for every rim. hint = { sites, pair, near }. */
export function fitLook(look, comp, hint = {}) {
  if (look.kind === 'poly' && isDisc(comp) && !hint.ball) return look;
  if (look.kind === 'poly') { look.kind = 'ball'; look.rims = new Map(); look.tubes = []; look.caps = []; }
  const near = hint.near === undefined ? 0 : hint.near;
  const keyList = rimKeys(comp), keys = new Set(keyList);
  for (const k of [...look.rims.keys()]) if (!keys.has(k)) look.rims.delete(k);
  let ok = true;
  for (const cross of [false, true]) {
    const want = cross ? comp.X : comp.o;
    let have = look.tubes.filter((t) => t.cross === cross).length;
    for (let i = look.tubes.length - 1; i >= 0 && have > want; i--) if (look.tubes[i].cross === cross) { look.tubes.splice(i, 1); have--; }
    for (; have < want; have++) {
      const p = freePair(look, hint.pair || null);
      if (!p) { ok = false; break; }
      look.tubes.push({ a: p[0], b: p[1], cross });
    }
  }
  look.caps.length = Math.min(look.caps.length, comp.x);
  const prefer = (hint.sites || []).slice();
  while (look.caps.length < comp.x) { const s = freeSite(look, near, prefer); if (s < 0) { ok = false; break; } look.caps.push(s); }
  for (const k of keyList) {
    if (look.rims.has(k)) continue;
    const s = freeSite(look, near, prefer);
    if (s < 0) { ok = false; break; }
    look.rims.set(k, s);
  }
  if (!ok) repack(look, comp);
  return look;
}
/** Everything somewhere again, tubes first. Returns false when twelve sites are not enough. */
export function repack(look, comp) {
  look.kind = 'ball'; look.rims = new Map(); look.caps = [];
  const tubes = [];
  for (let i = 0; i < comp.o; i++) tubes.push(false);
  for (let i = 0; i < comp.X; i++) tubes.push(true);
  look.tubes = [];
  for (const cross of tubes) { const p = freePair(look); if (!p) return false; look.tubes.push({ a: p[0], b: p[1], cross }); }
  for (let i = 0; i < comp.x; i++) { const s = freeSite(look); if (s < 0) return false; look.caps.push(s); }
  for (const k of rimKeys(comp)) { const s = freeSite(look); if (s < 0) return false; look.rims.set(k, s); }
  return true;
}
/** Can this component be drawn on twelve sites? */
export const fits = (comp) => 2 * (comp.o + comp.X) + comp.x + comp.rims.length <= 12;

/** Before a tube can join two holes they must be neighbours: move one (or both) if they are not. */
export function makeNeighbours(look, keyA, keyB) {
  const a = look.rims.get(keyA), b = look.rims.get(keyB);
  if (NEIGHBOUR[a].has(b)) return false;
  const u = usedSites(look);
  for (const s of NEIGHBOUR[a]) if (!u.has(s)) { look.rims.set(keyB, s); return true; }
  for (const s of NEIGHBOUR[b]) if (!u.has(s)) { look.rims.set(keyA, s); return true; }
  look.rims.delete(keyA); look.rims.delete(keyB);
  const p = freePair(look);
  if (p) { look.rims.set(keyA, p[0]); look.rims.set(keyB, p[1]); return true; }
  look.rims.set(keyA, a); look.rims.set(keyB, b);
  return false;
}

/**
 * The looks after a zip. prev: the looks before; info: what engine.zip reported; before / after: the two states.
 * at = { sites: [...] } says where the zipped hole(s) sat, so the new piece appears there.
 */
export function nextLooks(prev, before, info, after) {
  const looks = prev.slice();
  let look, hint = {};
  if (info.kind === 'join') {
    const [ca, cb] = info.from, lo = Math.min(ca, cb), hi = Math.max(ca, cb);
    const la = prev[ca], lb = prev[cb];
    if (la.kind === 'poly' && lb.kind === 'poly') look = polyLook();
    else {
      // keep the ball's look (the first one's if both are balls); the other's pieces find free sites
      const keep = la.kind === 'ball' ? la : lb, other = keep === la ? lb : la;
      look = cloneLook(keep);
      const zipped = keep === la ? rimKeys(before.comps[ca])[info.rimsFrom[0]] : rimKeys(before.comps[cb])[info.rimsFrom[1]];
      hint = { sites: [keep.rims.get(zipped)], near: keep.rims.get(zipped), ball: true };
      look.rims.delete(zipped);
      if (other.kind === 'ball') { for (const t of other.tubes) { const p = freePair(look); if (p) look.tubes.push({ a: p[0], b: p[1], cross: t.cross }); } }
    }
    looks.splice(hi, 1); looks.splice(lo, 1, look);
  } else {
    look = cloneLook(prev[info.to]);
    const comp0 = before.comps[info.to];
    if (look.kind === 'ball') {
      const keys0 = rimKeys(comp0), ka = keys0[info.rimsFrom[0]], kb = keys0[info.rimsFrom[1]];
      const sa = look.rims.get(ka), sb = look.rims.get(kb);
      hint = info.kind === 'handle' || info.kind === 'crosshandle' ? { pair: [sa, sb], near: sa, sites: [] } : { sites: [sa], near: sa };
      // the zipped rims are gone: free their sites before anything new is placed
      // the zipped rims are gone, and so may be the suffixes of rims that shared a word with them: place those afresh
      look.rims.delete(ka); look.rims.delete(kb);
    } else hint = { ball: true, sites: [0], near: 0 };
    looks[info.to] = look;
  }
  fitLook(look, after.comps[info.to], hint);
  return looks;
}

export const holeRadius = (len) => Math.min(0.42, 0.21 + 0.03 * Math.min(len, 7));

// ---- the scene of a whole state
/** The ball of a component, turned so that the sites its look uses face the viewer: every tidy picture shows its pieces. */
export function ballOf(slot, n, look) {
  const aim = new Set(look.caps);
  for (const t of look.tubes) { aim.add(t.a); aim.add(t.b); }
  for (const s of look.rims.values()) aim.add(s);
  return ball({ R: slot.R, center: slot.center, n, aim: [...aim].sort((a, b) => a - b) });
}

/** The word of a rim laid evenly round `ring`: its lines, and a pick point on each zip. */
function drawWord(scene, rim, ring, nn, { colorOf, hot, picks, ci, size }) {
  const fr = evenly(rim), edges = rim.map((e, k) => ({ id: e.id, s: e.s, f0: fr[k][0], f1: fr[k][1], color: e.s ? colorOf(e.id) : null }));
  scene.addLines((sc) => wordLines(sc, ring, nn, edges.map((e) => (e.color ? e : { ...e, color: THEME.ink })), { hot, size }));
  if (picks) edges.forEach((e) => { if (e.s) picks.push({ id: e.id, ci, at: () => fracPoint(scene, ring, nn, (e.f0 + e.f1) / 2) }); });
}

/**
 * The finished pieces of a ball: its tubes, its crosscaps and every rim except those whose key is in skipKeys.
 * Returns { L, taken, mine }; the caller adds what it draws itself and then calls fillEmpty.
 */
export function drawBallStatic(scene, comp, look, slot, n, { colorOf, hot = () => null, picks = null, ci = 0, skipKeys = null } = {}) {
  const L = ballOf(slot, n, look);
  const taken = new Set(), mine = new Map(), seam = () => THEME.soft;
  for (const t of look.tubes) { addTube(scene, L, t.a, t.b, { cross: t.cross, progress: () => 1, color: seam }); taken.add(t.a); taken.add(t.b); }
  for (const s of look.caps) { addCrosscapFeature(scene, L, s, { progress: () => 1, color: seam, axis: 0.6 }); taken.add(s); }
  const keys = rimKeys(comp);
  comp.rims.forEach((rim, ri) => {
    const key = keys[ri], s = look.rims.get(key);
    if (s === undefined || taken.has(s) || (skipKeys && skipKeys.has(key))) return;
    taken.add(s);
    const cell = addCell(scene, { site: L.sites[s].site, boundary: L.sites[s].boundary, Rs: L.Rs, hole: roundHole(holeRadius(rim.length) * slot.R) });
    mine.set(key, { ring: cell.rim, n, L, site: s, cell });
    drawWord(scene, rim, cell.rim, n, { colorOf, hot, picks, ci, size: 0.11 * slot.R });
  });
  return { L, taken, mine };
}
export function fillEmpty(scene, L, taken) { for (let s = 0; s < 12; s++) if (!taken.has(s)) addEmpty(scene, L, s); }

/** A flat polygon for a disc, its word round it. */
export function drawPoly(scene, comp, slot, { colorOf, hot = () => null, picks = null, ci = 0 } = {}) {
  const rim = comp.rims[0], m = rim.length, { pts, per } = regularCorners(m, slot.R);
  const poly = addCornerPoly(scene, { site: flatSite(slot.center), corners: () => pts, K: per === 1 ? Math.max(4, Math.round(120 / m)) : 5 });
  drawWord(scene, rim, poly.ring, poly.n, { colorOf, hot, picks, ci, size: 0.11 * slot.R });
  return poly;
}

/**
 * buildScene(state, looks, { colorOf, hot, n, custom }) -> { scene, picks, frame, slotList }
 *   picks    [{ id, at() }]: a point on each zip's arc, for hit-testing
 *   custom   Map(comp index -> (scene, comp, look, slot, n) => void): that component is drawn by the caller (in mid-zip)
 */
export function buildScene(state, looks, { colorOf, hot = () => null, n = 40, custom = null } = {}) {
  const scene = new Scene(), picks = [];
  const S = slots(state.comps.length);
  state.comps.forEach((comp, ci) => {
    const slot = S.list[ci], look = looks[ci];
    if (custom && custom.has(ci)) { custom.get(ci)(scene, comp, look, slot, n); return; }
    if (look.kind === 'poly') { drawPoly(scene, comp, slot, { colorOf, hot, picks, ci }); return; }
    const { L, taken } = drawBallStatic(scene, comp, look, slot, n, { colorOf, hot, picks, ci });
    fillEmpty(scene, L, taken);
  });
  return { scene, picks, frame: S.frame, slotList: S.list };
}

export { noHole, SIZES };
