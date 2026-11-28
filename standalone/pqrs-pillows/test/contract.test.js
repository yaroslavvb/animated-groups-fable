// contract.test.js — what PQRS pillows leans on in files it does NOT own, pinned so that a change by another
// session (the worktree is fast-forwarded while this page is built) fails here, loudly, and not on the screen.
//
//   node --test test/contract.test.js          (no DOM, about a second)
//
// Pinned: every name of SPEC 2.1's import block and its kind; every name a file in src/ imports from outside this
// folder (read off the source text, so a new import is covered the day it is written); the engine's state and its
// defaults; the fields this page reads from buildPatternModel, centredFor, recut, retiePrint; the frame
// home = Pmat X(s, theta) that the print on the surface stands on; the tile motions; the SDF bake; the renderer's
// methods the Surface pane calls.
// Left out, because they need a browser: createPattern (it asks window.matchMedia at once: its methods are pinned
// by their names in the source text only), the real WebGL renderer (createRenderer without WebGL 2 hands back its
// stub, and the stub's method list is what is pinned), createTimeline and shareHash (kind only).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const STANDALONE = path.resolve(HERE, '../..');
const FILES = {
  handles: 'two-features-two-handles/src/handles.js',
  pattern: 'two-features-two-handles/src/pattern-ext.js',
  render3d: 'the-folding/src/render3d.js',
  sdf: 'the-folding/src/sdf.js',
  timeline: 'classification-of-surfaces/src/vendor/the-folding/timeline.js',
  sharehash: 'classification-of-surfaces/src/sharehash.js',
  geom: 'classification-of-surfaces/src/sym/geom.js',
};
const load = (rel) => import(pathToFileURL(path.resolve(STANDALONE, rel)).href);
const M = {};
for (const [name, rel] of Object.entries(FILES)) M[name] = await load(rel);
const H = M.handles, { mul, apply, det, I3 } = M.geom;

// ---- SPEC 2.1, the import block: name -> kind
const BLOCK = {
  handles: {
    FAMILIES: 'object', GH: 'object', GE: 'object',
    normalizeFamilyKey: 'function', buildPatternModel: 'function', centredFor: 'function', defaultCommas: 'function',
    recut: 'function', retiePrint: 'function', invH: 'function', hgt: 'function', pairDistance: 'function',
    treeToCut: 'function', psuMul: 'function', psuInv: 'function', psuApplyDisc: 'function', psuToSO21: 'function',
    so21ToPSU: 'function', hypToDisc: 'function', discToHyp: 'function', axisCoords: 'function',
  },
  pattern: { createPattern: 'function', locateTilePSU: 'function', tilesPSU: 'function' },
  render3d: { createRenderer: 'function' },
  sdf: { bakeSDF: 'function' },
  timeline: { createTimeline: 'function' },
  sharehash: { shareHash: 'function' },
  geom: { mul: 'function', apply: 'function', det: 'function', I3: 'object' },
};

/** The engine's state for a typed signature, as page.js of Two features, two handles makes it (four cone points only). */
function stateFor(text) {
  const k = H.normalizeFamilyKey(text), fam = k && H.FAMILIES[k];
  if (!fam || (fam.mode !== 'cones' && fam.mode !== 'pillow')) return null;
  const perm = fam.defaultM.split('').map(Number);
  return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0,
    thetas: H.defaultCommas(k).map((sp) => (sp ? sp.theta : 0)), print: null };
}
const isPoint = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const onHyperboloid = (p) => Math.abs(p[0] * p[0] + p[1] * p[1] - p[2] * p[2] + 1) < 1e-9 * p[2] * p[2];
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b} (tolerance ${tol})`);

test('SPEC 2.1: every name of the import block is exported, and is of its kind', () => {
  for (const [mod, names] of Object.entries(BLOCK)) {
    for (const [name, kind] of Object.entries(names)) {
      assert.ok(name in M[mod], `${FILES[mod]} no longer exports ${name}`);
      assert.equal(typeof M[mod][name], kind, `${FILES[mod]}: ${name} is a ${typeof M[mod][name]}, the page takes it as a ${kind}`);
    }
  }
  assert.ok(Array.isArray(I3) && I3.length === 9, 'I3 is a 3 x 3 matrix, row-major, as an array of 9');
  assert.deepEqual(mul(I3, I3), I3);
  assert.deepEqual(apply(I3, [0.3, -0.2, 1.1]), [0.3, -0.2, 1.1]);
  near(det(I3), 1, 0, 'det(I3)');
  // row-major, and apply(mul(A, B), p) = apply(A, apply(B, p)): the order `view <- view . invQ` depends on
  const A = [1, 2, 0, 0, 1, 0, 0, 0, 1], B = [1, 0, 0, 3, 1, 0, 0, 0, 1], p = [0.5, -1, 1];
  assert.deepEqual(apply(mul(A, B), p), apply(A, apply(B, p)));
  assert.deepEqual(apply(A, p), [0.5 - 2, -1, 1]);
});

test('every name a file of src/ imports from outside this folder is still exported there', async (t) => {
  const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => /\.m?js$/.test(f)).sort() : [];
  assert.ok(files.length > 0, 'src/ holds no module');
  const IMPORT = /import\s+([^'"]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let checked = 0;
  const leftOut = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(IMPORT)) {
      const [, clause, spec] = m;
      if (!spec.startsWith('../../')) continue;                       // the page's own modules: their own tests
      const target = path.resolve(SRC, spec);
      assert.ok(fs.existsSync(target), `${file} imports ${spec}, which is not there`);
      let mod;
      try { mod = await import(pathToFileURL(target).href); } catch (err) { leftOut.push(`${spec} (does not load in node: ${String(err.message).slice(0, 80)})`); continue; }
      const braces = /\{([\s\S]*)\}/.exec(clause);
      const names = braces ? braces[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) : [];
      const head = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
      if (head && !head.startsWith('*')) names.push('default');
      for (const name of names) {
        assert.ok(name in mod, `${file} imports ${name} from ${spec}: no such export any more`);
        checked++;
      }
    }
  }
  t.diagnostic(`${checked} imported names in ${files.length} files of src/ (${files.join(', ')})`);
  if (leftOut.length) t.diagnostic('left out: ' + leftOut.join('; '));
});

test('the methods of GH and GE that the page calls are there', () => {
  // read off src/*.js: every GH.x / GE.x written out, and the ones reached through an alias in flips.js
  const want = new Set(['form', 'norm', 'dist', 'frame', 'toward', 'fit', 'fix']);
  for (const f of fs.readdirSync(SRC).filter((x) => /\.m?js$/.test(x))) {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of text.matchAll(/\bG[HE]\.([A-Za-z_]\w*)/g)) want.add(m[1]);
  }
  for (const name of want) {
    if (name === 'inv') { assert.equal(typeof H.GH.inv, 'function', 'GH.inv'); continue; }       // the hyperbolic one only
    assert.ok(name in H.GH && name in H.GE, `GH / GE no longer have .${name}`);
  }
  assert.equal(H.GH.kind, 'H');
  assert.equal(H.GE.kind, 'E');
  near(H.GH.dist([0, 0, 1], [Math.sinh(1), 0, Math.cosh(1)]), 1, 1e-12, 'GH.dist along a line');
  near(H.GE.dist([0, 0, 1], [3, 4, 1]), 5, 1e-12, 'GE.dist');
});

test('the engine opens 3333, 2345, 2223, 2222 (and 4444) on the numbers the notes record', () => {
  // proto/flips/NOTES.md § 7, proto/pillow-math/NOTES.md § 3.3: the Length, the marking m, the orders slot by slot
  const want = {
    3333: { L: 2.633916, m: '0123', orders: [3, 3, 3, 3], kind: 'H', mode: 'cones', tol: 5e-7 },
    2345: { L: 2.535706, m: '0132', orders: [2, 3, 5, 4], kind: 'H', mode: 'cones', tol: 5e-7 },
    2223: { L: 1.316958, m: '3012', orders: [3, 2, 2, 2], kind: 'H', mode: 'cones', tol: 5e-7 },
    2222: { L: 1, m: '0123', orders: [2, 2, 2, 2], kind: 'E', mode: 'pillow', tol: 1e-12 },
    4444: { L: 3.057, m: '0132', orders: [4, 4, 4, 4], kind: 'H', mode: 'cones', tol: 5e-4 },
  };
  for (const [sig, w] of Object.entries(want)) {
    const k = H.normalizeFamilyKey(sig), fam = H.FAMILIES[k];
    assert.equal(k, sig, `normalizeFamilyKey('${sig}')`);
    assert.ok(fam, `no family ${sig}`);
    assert.equal(fam.kind, w.kind, `${sig}: kind`);
    assert.equal(fam.mode, w.mode, `${sig}: mode`);
    assert.equal(fam.defaultM, w.m, `${sig}: defaultM`);
    assert.equal(fam.defaultTw, 0, `${sig}: defaultTw`);
    near(fam.defaultL, w.L, w.tol, `${sig}: defaultL`);
    assert.ok(Array.isArray(fam.baseOrders) && fam.baseOrders.join('') === sig, `${sig}: baseOrders are the digits typed`);
    assert.ok(Array.isArray(fam.maxRange) && fam.maxRange.length === 2 && fam.maxRange[0] < fam.maxRange[1], `${sig}: maxRange`);
    const st = stateFor(sig);
    assert.deepEqual(st.orders, w.orders, `${sig}: orders slot by slot`);
    assert.equal(st.thetas.length, 4, `${sig}: one comma angle a feature`);
  }
  near(H.FAMILIES['3333'].defaultL, 2 * Math.acosh(2), 1e-12, '3333: 2 arcosh 2');
  near(H.FAMILIES['2223'].defaultL, Math.acosh(2), 1e-12, '2223: arcosh 2');
  assert.deepEqual(H.FAMILIES['2222'].maxRange, [0.5, 2], '2222: the Length range of SPEC 1.3');
  assert.deepEqual(H.FAMILIES['3333'].maxRange, [0.4, 7], '3333: the Length range of SPEC 1.3');
  // typed orders: any four from 2 to 9 make a family on first use; other shapes are not four cone points
  assert.ok(stateFor('2346'), 'a typed signature of four cone points');
  assert.equal(stateFor('333*'), null, 'a mirror is not this page');
  assert.equal(stateFor('22222'), null, 'five cone points are not this page');
  assert.equal(stateFor('xyz'), null);
});

test('the pillow\'s numbers: hgt, pairDistance, treeToCut', () => {
  // proto/pillow-math/NOTES.md § 1.1: {3,3,2}: hP = 1.047193, d = 1.517841, m = 0.852456; {2,3,2}: 0.413568, 0.699600, 1.180658
  near(H.hgt(3, 3, 2), 1.047193, 5e-7, 'hgt(3, 3, 2)');
  near(H.pairDistance(3, 3, 2), 1.517841, 5e-7, 'pairDistance(3, 3, 2)');
  near(H.treeToCut(3, 3, 2).m, 0.852456, 5e-7, 'treeToCut(3, 3, 2).m');
  near(H.hgt(2, 3, 2), 0.413568, 5e-7, 'hgt(2, 3, 2)');
  near(H.hgt(3, 2, 2), 0.699600, 5e-7, 'hgt(3, 2, 2)');
  near(H.pairDistance(2, 3, 2), 1.180658, 5e-7, 'pairDistance(2, 3, 2)');
  near(H.hgt(2, 2, 3), 0, 1e-12, 'hgt(2, 2, L): a pair of 2s lies on its loop');
  near(H.pairDistance(2, 2, 3), 1.5, 1e-12, 'pairDistance(2, 2, L) = L / 2');
  const t = H.treeToCut(4, 5, 2.5357);
  for (const key of ['m', 'dA', 'dB']) assert.ok(Number.isFinite(t[key]), `treeToCut(...).${key}`);
});

test('buildPatternModel(state): the keys the Pattern pane and the page read', () => {
  const KEYS = ['D', 'A', 'binding', 'home', 'outline', 'tileEdges', 'center', 'activeCut', 'cutPeriod', 'firstV', 'design', 'lines', 'dots', 'marks', 'dimMarks', 'markRefs'];
  for (const sig of ['3333', '2345', '2223', '2222', '4444']) {
    const st = stateFor(sig), model = H.buildPatternModel(st), kind = H.FAMILIES[st.k].kind;
    for (const key of KEYS) assert.ok(key in model, `${sig}: the model has no ${key}`);
    assert.equal(model.D.G.kind, kind, `${sig}: D.G.kind`);
    assert.ok(Number.isInteger(model.D.n) && model.D.n >= 3 && model.D.verts.length === model.D.n && model.D.edges.length === model.D.n, `${sig}: the tile D`);
    assert.ok(Array.isArray(model.A.maps) && model.A.maps.length === model.D.n, `${sig}: A.maps, one side pairing a side`);
    assert.ok(model.home.length === 4 && model.home.every(isPoint), `${sig}: home, four points`);
    assert.ok(isPoint(model.center), `${sig}: center`);
    assert.equal(typeof model.design, 'function', `${sig}: design`);
    assert.ok(Array.isArray(model.lines) && model.lines.length >= 2, `${sig}: lines`);
    for (const ln of model.lines) for (const key of ['a', 'b', 'color', 'width']) assert.ok(key in ln, `${sig}: a line has no ${key}`);
    assert.ok(Array.isArray(model.marks) && Array.isArray(model.dots), `${sig}: marks, dots`);
    for (const f of [0, 1, 2, 3]) assert.ok(model.markRefs[f] && 'v' in model.markRefs[f] && isPoint(model.markRefs[f].dir), `${sig}: markRefs[${f}] = { v, dir }`);
    assert.ok(Array.isArray(model.activeCut) && model.activeCut.length === 2, `${sig}: activeCut`);
    if (kind === 'H') near(model.cutPeriod, st.L, 1e-9, `${sig}: cutPeriod is the cut's length`);
    else assert.equal(model.cutPeriod, null, '2222: no cutPeriod on the plane');
    assert.equal(model.outline, false);
    assert.equal(model.tileEdges, false);
  }
});

test('centredFor(state): Pmat, shapes with pts, home, treeSeg, farTreeSeg, cutSeg', () => {
  for (const sig of ['3333', '2345', '2223', '2222', '4444']) {
    const st = stateFor(sig), c = H.centredFor(st), kind = H.FAMILIES[st.k].kind, G = kind === 'H' ? H.GH : H.GE;
    for (const key of ['D', 'A', 'home', 'treeSeg', 'farTreeSeg', 'cutSeg', 'shapes', 'markRefs']) assert.ok(key in c, `${sig}: centredFor has no ${key}`);
    assert.ok(c.home.length === 4 && c.home.every(isPoint), `${sig}: home`);
    for (const key of ['treeSeg', 'farTreeSeg', 'cutSeg']) assert.ok(Array.isArray(c[key]) && c[key].length === 2 && c[key].every(isPoint), `${sig}: ${key} is two points`);
    assert.ok(Array.isArray(c.shapes) && c.shapes.length >= 1, `${sig}: shapes`);
    for (const sh of c.shapes) {
      assert.ok(Array.isArray(sh.pts) && sh.pts.length >= 8 && sh.pts.every(isPoint), `${sig}: a shape's pts`);
      if (kind === 'H') assert.ok(sh.pts.every(onHyperboloid), `${sig}: a comma's points lie on the hyperboloid`);
      else assert.ok(sh.pts.every((p) => p[2] === 1), '2222: a comma\'s points are plane points [x, y, 1]');
    }
    if (kind === 'H') {
      assert.ok(Array.isArray(c.Pmat) && c.Pmat.length === 9 && c.Pmat.every(Number.isFinite), `${sig}: Pmat, 3 x 3 row-major`);
      assert.ok(c.home.every(onHyperboloid), `${sig}: home on the hyperboloid`);
      // the picked pair's seal is centred and level: A left, B right (pillow-math NOTES § 4.1)
      near(c.home[0][1], 0, 1e-9, `${sig}: A on the x axis`);
      near(c.home[1][1], 0, 1e-9, `${sig}: B on the x axis`);
      near(c.home[0][0], -c.home[1][0], 1e-9, `${sig}: A and B either side of the middle`);
      assert.ok(c.home[0][0] < 0 && c.home[2][1] >= -1e-12 && c.home[3][1] >= -1e-12, `${sig}: A left, the far pair above`);
      near(G.dist(c.home[0], c.home[1]), H.pairDistance(st.orders[0], st.orders[1], st.L), 1e-9, `${sig}: |AB| = pairDistance`);
      near(G.dist(c.treeSeg[0], c.home[0]), 0, 1e-9, `${sig}: treeSeg starts at A`);
      near(G.dist(c.treeSeg[1], c.home[1]), 0, 1e-9, `${sig}: treeSeg ends at B`);
      near(G.dist(c.farTreeSeg[0], c.home[2]), 0, 1e-9, `${sig}: farTreeSeg starts at C`);
      near(G.dist(c.farTreeSeg[1], c.home[3]), 0, 1e-9, `${sig}: farTreeSeg ends at D`);
    } else {
      assert.ok(!('Pmat' in c) || c.Pmat == null, '2222 has no Pmat: its chart point is the plane point (SPEC 1.6)');
      assert.deepEqual(c.home.map((p) => [p[0], p[1]]), [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]], '2222 at (1, 0): the unit square, A and B on y = 0');
      near(c.cutSeg[0][1], 0.5, 1e-12, '2222: the cut is drawn halfway');
    }
  }
});

test('the pair frame: home = Pmat X(s, theta), with pillow.js\'s chart (the print on the surface stands on this)', async (t) => {
  let P;
  try { P = await import(pathToFileURL(path.join(SRC, 'pillow.js')).href); } catch (err) { t.skip('src/pillow.js does not load: ' + err.message); return; }
  let worst = 0;
  for (const [sig, L, tw] of [['3333', null, 0], ['3333', 2, 0.1], ['2345', null, 0], ['2345', 3.1, -0.37], ['2223', null, 0.15], ['4444', 4.2, 0.45], ['2346', 1.1, -0.2]]) {
    const st = stateFor(sig);
    if (L) st.L = L;
    st.tw = tw;
    const c = H.centredFor(st), cp = P.conePositions(st.orders, st.L, st.tw);
    for (let i = 0; i < 4; i++) {
      const d = H.GH.dist(apply(c.Pmat, P.fermiToHyperboloid(cp.s[i], cp.theta[i])), c.home[i]);
      worst = Math.max(worst, d);
      assert.ok(d < 1e-9, `${sig} L ${st.L} tw ${tw}: cone point ${i} is ${d} from Pmat X(s, theta)`);
    }
  }
  // the plane: (x, y) = (theta, s + 1 / (2 L)) (pillow-math NOTES § 5.1)
  const st = stateFor('2222');
  st.L = 1.3; st.tw = 0.2;
  const c = H.centredFor(st), cp = P.conePositions(st.orders, st.L, st.tw);
  for (let i = 0; i < 4; i++) {
    near(c.home[i][0], cp.theta[i], 1e-12, `2222: x of cone point ${i}`);
    near(c.home[i][1], cp.s[i] + 1 / (2 * st.L), 1e-12, `2222: y of cone point ${i}`);
  }
  t.diagnostic(`worst distance over 28 hyperbolic cone points: ${worst.toExponential(1)}`);
});

test('recut(state, i, j): the new state with Q and invQ on it; retiePrint gives the print to carry', () => {
  for (const sig of ['3333', '2345', '2223', '2222']) {
    const st = stateFor(sig);
    for (const [i, j] of [[0, 2], [0, 3]]) {
      const r = H.recut(st, i, j);
      for (const key of ['k', 'perm', 'orders', 'L', 'tw', 'thetas', 'Q', 'invQ']) assert.ok(key in r, `${sig} recut(${i}, ${j}): no ${key}`);
      assert.ok(r.Q.length === 9 && r.invQ.length === 9, `${sig}: Q, invQ are 3 x 3 row-major`);
      const QQ = mul(r.Q, r.invQ);
      for (let n = 0; n < 9; n++) near(QQ[n], I3[n], 1e-9, `${sig} recut(${i}, ${j}): Q invQ = 1, entry ${n}`);
      assert.deepEqual(r.perm.slice().sort(), [0, 1, 2, 3], `${sig}: perm is a permutation`);
      assert.deepEqual(r.perm.slice(0, 2).sort(), [i, j], `${sig}: i, j are FEATURES (digits of the signature as typed), and they are the new picked pair`);
      assert.deepEqual(r.orders, r.perm.map((f) => H.FAMILIES[st.k].baseOrders[f]), `${sig}: orders follow perm`);
      assert.ok(Number.isFinite(r.L) && r.L > 0 && Math.abs(r.tw) <= 0.5 + 1e-12, `${sig}: L > 0, |tw| <= 1/2`);
      const pr = H.retiePrint(r, st);
      assert.ok(pr && Array.isArray(pr.specs) && pr.specs.length === 4, `${sig}: retiePrint(after, before).specs, one a feature`);
      for (const sp of pr.specs) assert.ok(sp === null || ('theta' in sp && 'shapes' in sp), `${sig}: a spec is null or { theta, shapes }`);
      const c = H.centredFor({ ...r, print: pr });
      assert.ok(c.shapes.length >= 1 && c.shapes.every((sh) => sh.pts.every(isPoint)), `${sig}: the re-tied print draws`);
    }
  }
  // the numbers of the notes (proto/flips/NOTES.md § 7): 3333 as classified, the loop PS|QR is 3.8497 at a quarter turn
  const r = H.recut(stateFor('3333'), 0, 3);
  near(r.L, 3.849695, 5e-7, '3333: the Length across');
  near(Math.abs(r.tw), 0.25, 1e-9, '3333: its Twist');
});

test('beyond the block: fourConeCentered (surface-model.js) and linkedPrint (state.js) give what those files read', () => {
  // surface-model.js takes the pair frame of ANY numbers from fourConeCentered(orders, L, tw, { commas }).Pmat
  for (const [sig, L, tw] of [['3333', 2, 0.1], ['2345', 3.1, -0.37], ['2223', 1.317, 0.15]]) {
    const st = stateFor(sig);
    st.L = L; st.tw = tw;
    const P1 = H.fourConeCentered(st.orders, st.L, st.tw, { commas: [null, null, null, null] }).Pmat, P2 = H.centredFor(st).Pmat;
    assert.ok(Array.isArray(P1) && P1.length === 9, `${sig}: fourConeCentered(...).Pmat`);
    for (let n = 0; n < 9; n++) near(P1[n], P2[n], 1e-9 * Math.max(1, Math.abs(P2[n])), `${sig}: Pmat does not depend on the commas, entry ${n}`);
  }
  // state.js takes the print of a link to another marking from linkedPrint(k, perm): null for the family's own
  // marking, else { print: { specs }, thetas, base } (or null where no chain of picks names the features so)
  assert.equal(typeof H.linkedPrint, 'function');
  assert.equal(H.linkedPrint('3333', [0, 1, 2, 3]), null, 'the family\'s own marking has no linked print');
  for (const sig of ['3333', '2345', '2222']) {
    const st = stateFor(sig), r = H.recut(st, 0, 2), lp = H.linkedPrint(sig, r.perm);
    assert.ok(lp && lp.print && Array.isArray(lp.print.specs) && lp.print.specs.length === 4, `${sig}: linkedPrint(k, perm of a pick).print.specs`);
    assert.ok(Array.isArray(lp.thetas) && lp.thetas.length === 4 && lp.thetas.every(Number.isFinite), `${sig}: linkedPrint(...).thetas`);
    assert.ok(lp.base && Number.isFinite(lp.base.L) && Number.isFinite(lp.base.tw), `${sig}: linkedPrint(...).base = { L, tw }`);
    near(lp.base.L, r.L, 1e-9, `${sig}: the link's base Length is the pick's`);
  }
});

test('pattern-ext.js: the tile motions, and createPattern\'s methods by name', () => {
  const st = stateFor('3333'), model = H.buildPatternModel(st);
  const tiles = M.pattern.tilesPSU(model.D, model.A, { radius: 2.5 });
  assert.ok(Array.isArray(tiles) && tiles.length >= 6, 'tilesPSU gives the tiles round the middle');
  for (const tile of tiles) {
    assert.ok(Array.isArray(tile.g) && tile.g.length === 5 && Array.isArray(tile.M) && tile.M.length === 9 && typeof tile.flip === 'boolean' && Number.isFinite(tile.d), 'a tile is { g, M, flip, d }');
    assert.equal(tile.flip, false, 'four cone points: no mirrored tile');
  }
  // a tile motion is a motion of the pattern: it takes the cone points onto cone points of the same order
  const img = apply(tiles[tiles.length - 1].M, model.home[0]);
  assert.ok(onHyperboloid(img), 'tile.M moves hyperboloid points');
  const loc = M.pattern.locateTilePSU(model.D, model.A, [0.1, 0.05]);
  assert.ok(Array.isArray(loc.g) && loc.g.length === 5 && typeof loc.inside === 'boolean' && Number.isInteger(loc.steps), 'locateTilePSU gives { g, inside, steps }');
  // psu elements and 3 x 3 motions say the same thing
  const g = tiles[tiles.length - 1].g, w = H.psuApplyDisc(g, [0.2, -0.1]), p = H.hypToDisc(apply(H.psuToSO21(g), H.discToHyp([0.2, -0.1])));
  near(w[0], p[0], 1e-9, 'psuApplyDisc against psuToSO21, x');
  near(w[1], p[1], 1e-9, 'psuApplyDisc against psuToSO21, y');
  const back = H.psuApplyDisc(H.psuMul(H.psuInv(g), g), [0.2, -0.1]);
  near(back[0], 0.2, 1e-9, 'psuInv, x');
  near(back[1], -0.1, 1e-9, 'psuInv, y');
  const gg = H.so21ToPSU(H.psuToSO21(g), false), w2 = H.psuApplyDisc(gg, [0.2, -0.1]);
  near(w2[0], w[0], 1e-9, 'so21ToPSU(psuToSO21(g)), x');
  near(w2[1], w[1], 1e-9, 'so21ToPSU(psuToSO21(g)), y');
  // createPattern needs a browser: its methods are pinned by name in the source
  const text = fs.readFileSync(path.resolve(STANDALONE, FILES.pattern), 'utf8');
  for (const name of ['set', 'getView', 'setView', 'projectTile', 'resetView', 'draw', 'state', 'readPatch']) {
    assert.ok(new RegExp(`(^|[\\s{,])${name}\\s*[(:]`, 'm').test(text), `pattern-ext.js: the pattern's ${name} is gone`);
  }
});

test('the-folding: bakeSDF bakes a cell, createRenderer has the methods the Surface pane calls', () => {
  const size = 32, data = M.sdf.bakeSDF({ origin: [-1, -1], e1: [2, 0], e2: [0, 2], size, range: 0.2, polys: [{ pts: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], hole: false }] });
  assert.ok(data instanceof Uint8Array && data.length === size * size, 'bakeSDF gives Uint8Array(size * size)');
  assert.ok(data[16 * size + 16] < 128, 'dark inside the polygon');
  assert.ok(data[2 * size + 2] > 128, 'light outside');
  // without WebGL 2 createRenderer hands back its stub: the same method list as the real renderer
  const R = M.render3d.createRenderer({ getContext: () => null });
  for (const name of ['setSurface', 'updatePositions', 'setLines', 'setMarkers', 'setFrame', 'setStyle', 'render', 'onChange', 'project', 'getView', 'setView', 'resize', 'dispose']) {
    assert.equal(typeof R[name], 'function', `the renderer has no ${name}()`);
  }
  for (const name of ['ok', 'stats', 'reducedMotion']) assert.ok(name in R, `the renderer has no .${name}`);
  const v = R.getView();
  for (const key of ['q', 'zoom', 'az', 'el']) assert.ok(key in v, `getView() has no ${key}`);
  // and what src/surface-pane.js itself calls on it, read off its text
  const pane = path.join(SRC, 'surface-pane.js');
  if (fs.existsSync(pane)) {
    for (const m of fs.readFileSync(pane, 'utf8').matchAll(/\bR\.([A-Za-z_]\w*)/g)) assert.ok(m[1] in R, `surface-pane.js uses R.${m[1]}, which the renderer does not have`);
  }
});
