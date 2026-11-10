// The geometry of the Hasse picker (src/hasse.js): layout, edge routing and keyboard navigation. No DOM needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasseLayout, hasseNavigate, pillGap, bendEnergy, HASSE_ROWS, createHassePicker, hasseMinHeight, hasseCardLayout } from '../src/hasse.js';
import { HASSE_NODES, HASSE_EDGES, HASSE_TIERS } from '../src/hasse-data.js';
import { GROUPS, BY_ID } from '../src/groups.js';

const IDS = HASSE_NODES.map((n) => n.id);
const LABELS = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
// the sizes the dialog can ask for: 286 px (a 320 px phone) to 540 px wide, 420 to 560 px tall
const WIDTHS = [286, 300, 312, 326, 340, 356, 372, 400, 440, 469, 470, 500, 540];
const HEIGHTS = [420, 450, 489, 534, 560];

function point(p, t) {
  const s = 1 - t;
  return [
    s * s * s * p[0] + 3 * s * s * t * p[2] + 3 * s * t * t * p[4] + t * t * t * p[6],
    s * s * s * p[1] + 3 * s * s * t * p[3] + 3 * s * t * t * p[5] + t * t * t * p[7],
  ];
}

// gap between two pills (stadiums): distance between their core segments minus both radii
function pillToPill(a, b) {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.hw - a.hh) - (b.hw - b.hh));
  return Math.hypot(dx, a.y - b.y) - a.hh - b.hh;
}

test('the module loads without a DOM and exports the picker', () => {
  assert.equal(typeof createHassePicker, 'function');
  const L = hasseLayout(540, 560, { labels: LABELS });
  assert.equal(L.nodes.length, 17);
  assert.equal(L.edges.length, HASSE_EDGES.length);
  assert.equal(L.rows.length, HASSE_TIERS.length);
});

test('rows are the tiers by point-group order, o on top and *632 at the bottom', () => {
  assert.deepEqual(HASSE_ROWS, [
    ['o'], ['*x', '2222', '**', 'xx'], ['333'], ['2*22', '442', '*2222', '22*', '22x'], ['632', '*333', '3*3'], ['*442', '4*2'], ['*632'],
  ]);
  const tiers = HASSE_TIERS.slice().sort((a, b) => a.y - b.y);
  HASSE_ROWS.forEach((row, r) => {
    for (const id of row) assert.equal(BY_ID[id].reps.length, tiers[r].order, id + ' sits in the row of its point-group order');
  });
  const L = hasseLayout(540, 560, { labels: LABELS });
  const y = Object.fromEntries(L.nodes.map((n) => [n.id, n.y]));
  for (const id of IDS) {
    if (id !== 'o') assert.ok(y.o < y[id], 'o is above ' + id);
    if (id !== '*632') assert.ok(y['*632'] > y[id], '*632 is below ' + id);
  }
  for (const [u, v] of HASSE_EDGES) assert.ok(y[u] < y[v], `${u} is drawn above its supergroup ${v}`);
  L.nodes.forEach((n) => assert.equal(n.order, BY_ID[n.id].reps.length, n.id + ' order'));
});

test('every size: pills inside the box, apart from each other, big enough to tap; rows contain their pills', () => {
  for (const W of WIDTHS) for (const H of HEIGHTS) {
    const L = hasseLayout(W, H, { labels: LABELS });
    const tag = `${W}x${H}`;
    assert.equal(L.width, W, tag); assert.equal(L.height, H, tag);
    assert.ok(L.font >= 13, tag + ' label font is at least 13 px');
    for (const n of L.nodes) {
      assert.ok(n.x - n.hw >= 0 && n.x + n.hw <= W, `${tag} ${n.id} fits horizontally`);
      assert.ok(n.y - 22 >= 0 && n.y + 22 <= H, `${tag} ${n.id}: a 44 px tall hit area fits vertically`);
      assert.ok(2 * n.hh >= 28 && 2 * n.hw >= 36, `${tag} ${n.id} pill size`);
      const glyphs = [...LABELS[n.id]].length;
      assert.ok(2 * n.hw >= glyphs * L.font * 0.62 + 10, `${tag} ${n.id}: the label fits its pill`);
      const row = L.rows[n.row];
      assert.ok(row.top <= n.y - n.hh + 1e-9 && row.bottom >= n.y + n.hh - 1e-9, `${tag} ${n.id} lies inside its row band`);
    }
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) {
      const gap = pillToPill(L.nodes[i], L.nodes[j]);
      assert.ok(gap >= 3, `${tag}: ${L.nodes[i].id} and ${L.nodes[j].id} are ${gap.toFixed(1)} px apart`);
    }
    for (let r = 1; r < L.rows.length; r++) assert.ok(Math.abs(L.rows[r].top - L.rows[r - 1].bottom) < 1e-9 && L.rows[r].top > L.rows[r - 1].top, tag + ' rows stack');
  }
});

test('a 360 px phone gets 13 px labels or larger, a 390 px phone 14 px, a laptop 15 px', () => {
  assert.ok(hasseLayout(326, 489).font >= 13);   // 360 wide: card 344, diagram 326
  assert.ok(hasseLayout(356, 534).font >= 14);   // 390 wide
  assert.ok(hasseLayout(540, 560).font >= 15);
});

test('no edge runs behind the pill of a node it does not join (every size, densely sampled)', () => {
  let worst = Infinity;
  for (const W of WIDTHS) for (const H of HEIGHTS) {
    const L = hasseLayout(W, H, { labels: LABELS });
    const byId = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
    const need = W >= 470 ? 5 : W >= 326 ? 4 : 3;
    for (const e of L.edges) {
      const others = L.nodes.filter((n) => n.id !== e.u && n.id !== e.v);
      let min = Infinity;
      for (let i = 0; i <= 240; i++) {
        const [x, y] = point(e.p, i / 240);
        assert.ok(x >= 0 && x <= W && y >= 0 && y <= H, `${W}x${H} ${e.u}>${e.v} stays inside the box`);
        for (const o of others) min = Math.min(min, pillGap(x, y, o));
      }
      assert.ok(min >= need, `${W}x${H}: edge ${e.u} > ${e.v} passes ${min.toFixed(1)} px from another pill (need ${need})`);
      worst = Math.min(worst, min);
      // it starts inside the pill of the subgroup and ends inside the pill of the supergroup
      assert.ok(pillGap(e.p[0], e.p[1], byId[e.u]) < 0 && pillGap(e.p[6], e.p[7], byId[e.v]) < 0, `${W}x${H} ${e.u}>${e.v} is attached to its two nodes`);
      assert.match(e.d, /^M-?[\d.]+ -?[\d.]+C(-?[\d.]+ ){5}-?[\d.]+$/, 'path syntax');
    }
  }
  assert.ok(worst >= 3);
});

test('edges are smooth S-curves that only go down; the plain spec curve wherever nothing is in the way', () => {
  for (const [W, H] of [[540, 560], [356, 534], [326, 489]]) {
    const L = hasseLayout(W, H, { labels: LABELS });
    let plain = 0;
    for (const e of L.edges) {
      let prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const y = point(e.p, i / 100)[1];
        assert.ok(y >= prev - 1e-9, `${W}x${H} ${e.u}>${e.v} never turns back up`);
        prev = y;
      }
      // a rerouted edge must stay a gentle curve, not a hook (the plain S-curves of flat wide edges score about 8)
      if (!e.shape.plain) assert.ok(bendEnergy(e.p) < 4, `${W}x${H} ${e.u}>${e.v} has no hook (bending ${bendEnergy(e.p).toFixed(2)})`);
      if (e.shape.plain) {
        plain++;
        const mid = (e.p[1] + e.p[7]) / 2;   // M sx sy C sx midY, ex midY, ex ey
        assert.ok(e.p[2] === e.p[0] && e.p[4] === e.p[6] && Math.abs(e.p[3] - mid) < 1e-9 && Math.abs(e.p[5] - mid) < 1e-9, 'plain S-curve');
      }
    }
    assert.ok(plain >= 20, `${W}x${H}: ${plain} of ${L.edges.length} edges are the plain S-curve`);
  }
});

test('edges that share a node leave it in order, so they do not cross at the node', () => {
  const L = hasseLayout(540, 560, { labels: LABELS });
  const byId = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
  for (const n of L.nodes) {
    const down = L.edges.filter((e) => e.u === n.id).sort((a, b) => a.p[0] - b.p[0]);
    for (let i = 1; i < down.length; i++) {
      assert.ok(down[i].p[0] - down[i - 1].p[0] >= 4, `${n.id}: ports are spread`);
      const s0 = (byId[down[i - 1].v].x - n.x) / (byId[down[i - 1].v].y - n.y), s1 = (byId[down[i].v].x - n.x) / (byId[down[i].v].y - n.y);
      assert.ok(s0 <= s1, `${n.id}: the edge to ${down[i - 1].v} leaves left of the edge to ${down[i].v}`);
    }
    for (const e of down) assert.ok(Math.abs(e.p[0] - n.x) <= n.hw - 6, `${n.id}: port on the pill`);
  }
});

test('measured label widths widen a pill', () => {
  const a = hasseLayout(356, 534, { labels: LABELS });
  const b = hasseLayout(356, 534, { labels: LABELS, textWidths: { '2222': 60 } });
  const hw = (L, id) => L.nodes.find((n) => n.id === id).hw;
  assert.ok(hw(b, '2222') > hw(a, '2222'));
  assert.equal(hw(b, '442'), hw(a, '442'));
});

test('keyboard: arrows reach every node, left/right and up/down undo each other, Home and End', () => {
  // reachability
  for (const start of IDS) {
    const seen = new Set([start]), queue = [start];
    while (queue.length) {
      const id = queue.shift();
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
        const next = hasseNavigate(id, key).id;
        assert.ok(IDS.includes(next));
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    assert.equal(seen.size, 17, 'all nodes reachable from ' + start);
  }
  // rows: left then right comes back (except at the row's ends, where the key does nothing)
  for (const row of HASSE_ROWS) {
    row.forEach((id, i) => {
      assert.equal(hasseNavigate(id, 'ArrowRight').id, row[Math.min(i + 1, row.length - 1)]);
      assert.equal(hasseNavigate(id, 'ArrowLeft').id, row[Math.max(i - 1, 0)]);
    });
  }
  // columns: with the remembered column, down then up returns to the start
  for (const id of IDS) {
    const down = hasseNavigate(id, 'ArrowDown');
    if (down.id !== id) assert.equal(hasseNavigate(down.id, 'ArrowUp', down.wantX).id, id, 'down, up from ' + id);
    const up = hasseNavigate(id, 'ArrowUp');
    if (up.id !== id) assert.equal(hasseNavigate(up.id, 'ArrowDown', up.wantX).id, id, 'up, down from ' + id);
  }
  // a walk straight down from o passes one node per row and ends at *632; straight back up ends at o
  let at = { id: 'o', wantX: null };
  const path = ['o'];
  for (let i = 0; i < 6; i++) { at = hasseNavigate(at.id, 'ArrowDown', at.wantX); path.push(at.id); }
  assert.equal(path[6], '*632');
  assert.equal(new Set(path).size, 7);
  for (let i = 0; i < 6; i++) at = hasseNavigate(at.id, 'ArrowUp', at.wantX);
  assert.equal(at.id, 'o');
  assert.equal(hasseNavigate('o', 'ArrowUp').id, 'o');
  assert.equal(hasseNavigate('*632', 'ArrowDown').id, '*632');
  assert.equal(hasseNavigate('442', 'Home').id, 'o');
  assert.equal(hasseNavigate('442', 'End').id, '*632');
  assert.equal(hasseNavigate('442', 'a').id, '442');
});

// ---- round 3 (findings #10, #32, #34, #56): short windows, hit areas, row numbers, the card, the dialog's tree ----

// the boxes the dialog asks for in short windows: stacked on phones, beside the key in phone landscape (up to 600 wide)
const SHORT_W = [286, 300, 326, 341, 356, 380, 400, 421, 440, 469, 470, 484, 500, 540, 580, 600];
const shortSizes = () => {
  const out = [];
  for (const W of SHORT_W) {
    const least = hasseMinHeight(W, { labels: LABELS });
    for (const H of [least, least + 7, least + 19, 300, 330, 360, 390, 419]) if (H >= least) out.push([W, H]);
  }
  return out;
};
const rect = (n) => ({ l: n.x - n.hw, r: n.x + n.hw, t: n.y - n.hh, b: n.y + n.hh });
const LAYOUTS = new Map();
const layoutAt = (W, H) => { const k = W + 'x' + H; if (!LAYOUTS.has(k)) LAYOUTS.set(k, hasseLayout(W, H, { labels: LABELS })); return LAYOUTS.get(k); };
const meets = (p, q, eps = 1e-9) => p.l < q.r - eps && q.l < p.r - eps && p.t < q.b - eps && q.t < p.b - eps;

test('#10 a short diagram: every width fits in at most 290 px; below its least height the layout keeps that height', () => {
  for (const W of SHORT_W) {
    const least = hasseMinHeight(W, { labels: LABELS });
    assert.ok(least <= 290, `${W} px wide needs only ${least} px (v1: 420)`);
    assert.equal(hasseLayout(W, least, { labels: LABELS }).height, least);
    const L = hasseLayout(W, least - 60, { labels: LABELS });
    assert.equal(L.height, least, `${W}: asked for less, drawn at the least height (the dialog scrolls)`);
    assert.equal(L.least, least);
  }
});

test('#10 every short size: pills inside and apart, rows hold their pills, rules miss every pill, edges clear, o on top', () => {
  for (const [W, H] of shortSizes()) {
    const L = layoutAt(W, H);
    const tag = `${W}x${H}`;
    assert.equal(L.height, H, tag);
    assert.ok(L.font >= 13, tag);
    const byId = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
    for (const n of L.nodes) {
      assert.ok(n.x - n.hw >= 0 && n.x + n.hw <= W, `${tag} ${n.id} fits horizontally`);
      assert.ok(n.y - 22 >= 0 && n.y + 22 <= H, `${tag} ${n.id}: 22 px above and below its centre`);
      if (n.id !== 'o') assert.ok(byId.o.y + byId.o.hh < n.y - n.hh, `${tag}: o is above ${n.id}`);
      const row = L.rows[n.row];
      assert.ok(row.top <= n.y - n.hh + 1e-9 && row.bottom >= n.y + n.hh - 1e-9, `${tag} ${n.id} lies inside its row band`);
    }
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) {
      const gap = pillToPill(L.nodes[i], L.nodes[j]);
      assert.ok(gap >= 3, `${tag}: ${L.nodes[i].id} and ${L.nodes[j].id} are ${gap.toFixed(1)} px apart`);
    }
    for (let r = 1; r < L.rows.length; r++) {
      const y = Math.round(L.rows[r].top) + 0.5;      // where apply() draws the rule
      for (const n of L.nodes) assert.ok(Math.abs(y - n.y) >= n.hh + 1, `${tag}: the rule above row ${r} misses ${n.id}`);
    }
    const need = W >= 470 ? 5 : W >= 326 ? 4 : 3;
    for (const e of L.edges) {
      const others = L.nodes.filter((n) => n.id !== e.u && n.id !== e.v);
      let min = Infinity, prev = -Infinity;
      for (let i = 0; i <= 240; i++) {
        const [x, y] = point(e.p, i / 240);
        assert.ok(x >= 0 && x <= W && y >= 0 && y <= H, `${tag} ${e.u}>${e.v} stays inside the box`);
        assert.ok(y >= prev - 1e-9, `${tag} ${e.u}>${e.v} never turns back up`);
        prev = y;
        for (const o of others) min = Math.min(min, pillGap(x, y, o));
      }
      assert.ok(min >= need, `${tag}: edge ${e.u} > ${e.v} passes ${min.toFixed(1)} px from another pill (need ${need})`);
      assert.ok(pillGap(e.p[0], e.p[1], byId[e.u]) < 0 && pillGap(e.p[6], e.p[7], byId[e.v]) < 0, `${tag} ${e.u}>${e.v} is attached`);
    }
  }
});

test('#10 where the proportions of the data fit, the layout is exactly the uniform scale of v1', () => {
  const ys = Object.fromEntries(HASSE_NODES.map((n) => [n.id, n.y]));
  for (const W of WIDTHS) {
    for (const H of [470, 500, 534, 560, 700]) {
      const L = layoutAt(W, H);
      const ky = (H - 52) / (524 - 42);
      for (const n of L.nodes) assert.ok(Math.abs(n.y - (26 + (ys[n.id] - 42) * ky)) < 1e-9, `${W}x${H} ${n.id}`);
    }
  }
});

test('#10 hit areas: 44 px where there is room, never overlapping, never over another pill', () => {
  const sizes = [...shortSizes()];
  for (const W of WIDTHS) for (const H of HEIGHTS) sizes.push([W, H]);
  for (const [W, H] of sizes) {
    const L = layoutAt(W, H);
    const tag = `${W}x${H}`;
    for (const n of L.nodes) {
      // (the painted pill is a target of its own; the hit area adds the margin around it, so it must hold the centre
      // and be a decent size, and it must never reach into a neighbour's pill)
      const h = n.hit;
      assert.ok(h.l < n.x - 10 && h.r > n.x + 10 && h.t < n.y - 8 && h.b > n.y + 8, `${tag} ${n.id}: the hit area holds the pill's centre`);
      assert.ok(h.r - h.l >= 36 && h.b - h.t >= 30, `${tag} ${n.id}: hit area ${(h.r - h.l).toFixed(0)} x ${(h.b - h.t).toFixed(0)}`);
      for (const m of L.nodes) if (m !== n) assert.ok(!meets(h, rect(m)), `${tag}: the hit area of ${n.id} covers the pill of ${m.id}`);
    }
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) {
      assert.ok(!meets(L.nodes[i].hit, L.nodes[j].hit), `${tag}: hit areas of ${L.nodes[i].id} and ${L.nodes[j].id} overlap`);
    }
    if (W >= 470 && H >= 470) {
      for (const n of L.nodes) {
        assert.ok(Math.abs(n.hit.r - n.hit.l - Math.max(44, 2 * n.hw)) < 1e-9 && Math.abs(n.hit.b - n.hit.t - Math.max(44, 2 * n.hh)) < 1e-9, `${tag} ${n.id}: full 44 px hit area`);
      }
    }
  }
});

test('#32 row numbers (13 px) sit in their row band, clear of every pill', () => {
  const sizes = [...shortSizes()];
  for (const W of WIDTHS) for (const H of HEIGHTS) sizes.push([W, H]);
  for (const [W, H] of sizes) {
    const L = layoutAt(W, H);
    for (const row of L.rows) {
      const box = { l: row.labelX - 1, r: row.labelX + String(row.order).length * 13 * 0.62 + 1, t: row.labelY - 11, b: row.labelY + 2 };
      assert.ok(box.t >= row.top - 1e-9 && row.labelY <= row.bottom, `${W}x${H}: the number ${row.order} lies in its band`);
      for (const n of L.nodes) assert.ok(!meets(box, rect(n), -1), `${W}x${H}: the number ${row.order} touches ${n.id}`);
    }
  }
});

// the stacked card's title + info line + key, as measured in Chrome (2 key lines on a laptop, 3 on a phone)
const chromeOf = (vw) => (vw < 500 ? 152 : 132);

test('#10 the card: beside the key in wide short windows, stacked in portrait and on laptops; the whole diagram fits', () => {
  const cases = [   // [vw, vh, side?]   (f: the app's box in the spacesheep frame, 50 px under the window's top)
    [844, 390, true], [844, 340, true], [667, 375, true], [667, 325, true], [740, 360, true], [740, 310, true], [900, 500, true],
    [568, 320, true],
    [1280, 720, false], [1440, 900, false], [1024, 600, false], [768, 1024, false], [390, 780, false], [390, 614, false],
    [375, 498, false], [360, 534, false], [320, 568, false], [320, 518, false], [360, 640, false], [414, 896, false],
  ];
  for (const [vw, vh, side] of cases) {
    const c = hasseCardLayout(vw, vh, chromeOf(vw));
    const tag = `${vw}x${vh}`;
    assert.equal(c.side, side, `${tag}: ${side ? 'side by side' : 'stacked'}`);
    assert.ok(c.cardW <= vw - 2 * c.margin + 1e-9, `${tag}: the card fits the width`);
    const least = hasseMinHeight(c.W, { labels: LABELS });
    assert.ok(c.H >= least, `${tag}: the diagram (${c.W} x ${c.H}) needs no scrolling (least ${least})`);
    const cardH = c.side ? c.H + 2 * c.padV + 2 : c.H + chromeOf(vw);
    assert.ok(cardH <= vh - 2 * c.margin + 1e-9, `${tag}: the card (${cardH} px) fits the height`);
    if (!side) assert.equal(c.W, Math.min(540, c.cardW - 2 * c.pad - 2));
    if (side) {
      const s = hasseCardLayout(vw, vh, chromeOf(vw));
      assert.ok(s.W >= 286 && s.H > Math.min(vh - 2 * s.margin - chromeOf(vw), 560), `${tag}: beside the key the diagram is taller than stacked`);
    }
  }
  // the laptop card is the v1 card
  const big = hasseCardLayout(1280, 720, 132);
  assert.deepEqual([big.side, big.cardW, big.W, big.H], [false, 574, 540, 556]);
});

// ---- a minimal DOM, enough to build and open the dialog in node ----
class FakeClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, on) { const want = on === undefined ? !this.set.has(c) : !!on; if (want) this.set.add(c); else this.set.delete(c); return want; }
}
function fakeDom(vw, vh) {
  const listeners = [];
  const win = { innerWidth: vw, innerHeight: vh, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 0,
    requestIdleCallback: () => 0, setTimeout: () => 0 };
  const HEIGHTS_BY_CLASS = { 'hasse-head': 46, 'hasse-foot': vw < 500 ? 104 : 84 };
  class El {
    constructor(tag, ns) { this.tagName = tag.toUpperCase(); this.ns = ns; this.nodeType = 1; this.children = []; this.parentNode = null; this.attrs = {};
      this.classList = new FakeClassList(this); this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
      this._text = ''; this.scrollTop = 0; this.hidden = false; }
    set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classList.set].join(' '); }
    set textContent(v) { this._text = String(v); this.children = []; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set id(v) { this.attrs.id = v; } get id() { return this.attrs.id; }
    set type(v) { this.attrs.type = v; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); this.children.push(c); c.parentNode = this; return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
    get firstChild() { return this.children[0] || null; }
    setAttribute(k, v) { if (k === 'class') this.className = v; else this.attrs[k] = String(v); }
    getAttribute(k) { return k === 'class' ? this.className : k in this.attrs ? this.attrs[k] : null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(type, fn) { listeners.push([this, type, fn]); }
    contains(x) { for (let e = x; e; e = e.parentNode) if (e === this) return true; return false; }
    closest(sel) { const cls = sel.replace(/^\./, ''); for (let e = this; e && e.classList; e = e.parentNode) if (e.classList.contains(cls)) return e; return null; }
    querySelector() { return null; }
    getRootNode() { return doc; }
    get ownerDocument() { return doc; }
    get isConnected() { return true; }
    focus() { doc.activeElement = this; }
    blur() { if (doc.activeElement === this) doc.activeElement = doc.body; }
    get offsetHeight() { for (const [c, h] of Object.entries(HEIGHTS_BY_CLASS)) if (this.classList.contains(c)) return h; return 0; }
    get clientWidth() { return 0; } get clientHeight() { return 0; } get scrollHeight() { return 0; }
    getComputedTextLength() { return this.textContent.length * 8; }
    all(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) c.all(pred, out); return out; }
  }
  const doc = { defaultView: win, head: new El('head'), body: new El('body'), activeElement: null,
    createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t, ns), addEventListener() {} };
  doc.documentElement = doc.head;
  doc.activeElement = doc.body;
  return { doc, win, listeners };
}

test('#34 #56 #32 #10 the dialog in a fake DOM: listbox > none > 17 options, aria-selected, the key, 13 px text, the card', () => {
  for (const [vw, vh, side] of [[844, 390, true], [390, 780, false], [1280, 720, false]]) {
    const { doc } = fakeDom(vw, vh);
    const picker = createHassePicker({ mount: doc.body, groups: GROUPS, onPick() {} });
    picker.open('2*22');
    assert.equal(picker.isOpen(), true);
    const dlg = doc.body.children[0];
    assert.equal(dlg.getAttribute('role'), 'dialog');
    assert.equal(dlg.getAttribute('aria-modal'), 'true');
    const [listbox] = dlg.all((e) => e.getAttribute('role') === 'listbox');
    assert.ok(listbox, 'an svg with role listbox');
    const options = listbox.all((e) => e.getAttribute('role') === 'option');
    assert.equal(options.length, 17);
    for (const o of options) {
      // every element between the listbox and the option is presentational or hidden (Chrome then keeps 'option')
      for (let p = o.parentNode; p !== listbox; p = p.parentNode) assert.ok(['none', 'presentation'].includes(p.getAttribute('role')), 'the option sits right under the listbox');
      assert.equal(o.getAttribute('aria-selected'), o.getAttribute('data-id') === '2*22' ? 'true' : 'false');
    }
    assert.deepEqual(options.filter((o) => o.getAttribute('tabindex') === '0').map((o) => o.getAttribute('data-id')), ['2*22'], 'roving tabindex on the current node');
    const legend = dlg.all((e) => e.classList.contains('hasse-legend'))[0];
    assert.equal(legend.textContent, 'line = subgroup with the same translations:index 2index 3row = order of the point group');
    const card = dlg.all((e) => e.classList.contains('hasse-card'))[0];
    assert.equal(card.classList.contains('hasse-side'), side, `${vw}x${vh}: ${side ? 'side by side' : 'stacked'}`);
    const svg = listbox;
    const plan = hasseCardLayout(vw, vh, 46 + (vw < 500 ? 104 : 84) + 2);
    assert.equal(Number(svg.getAttribute('width')), plan.W);
    assert.ok(Number(svg.getAttribute('height')) >= plan.H);
    // the hit rects drawn are the layout's
    const L = hasseLayout(plan.W, plan.H, { labels: LABELS });
    for (const o of options) {
      const n = L.nodes.find((q) => q.id === o.getAttribute('data-id'));
      const hit = o.children.find((c) => c.classList.contains('hasse-hit'));
      assert.ok(Math.abs(Number(hit.getAttribute('height')) - (n.hit.b - n.hit.t)) < 0.06, `${n.id} hit height`);
    }
    const css = doc.head.children.find((e) => e.tagName === 'STYLE').textContent;
    assert.match(css, /\.hasse-rowlabel\{[^}]*font-size:13px/, 'row numbers 13 px');
    assert.match(css, /\.hasse-legend\{[^}]*font-size:13px/, 'key 13 px');
    picker.close();
    assert.equal(picker.isOpen(), false);
  }
});
