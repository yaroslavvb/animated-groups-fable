// Crosslet: the entangled three-colour rule on the catalog's Ginzburg–Landau
// wave colour:gyre:a767fbcc68c0, checked on the saved samples in exact integer
// arithmetic, on the continuum the shader draws, through the shutter that
// integrates each displayed frame, and against the four generator marks the
// page draws over it.
//
//     colour(x, t) = argmax over k in {0,1,2} of U(g^k x, t + k T/3),
//     g = the third-turn about p = (17/54, 35/108),
//
// and the law the page is built on:
//
//     colour(g x, t + T/3) = colour(x, t) − 1   (mod 3),
//
// which holds exactly while every proper part of it fails, and which — with the
// lattice — is the whole of the picture's film group.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  bicubicRGB, BOUNDARY_SPEED, CENTER, colourAt, createGovernor, createView, cubicWeights, FALLBACK_INTERVAL,
  FIELD_BYTES, FIELD_SHA256, FRAMES, frameAt, framesAt, GRID_SIZE, GROUP_ID, gTurn, LOOP_SECONDS, MAX_SCALE,
  MAX_TAA_LAYERS, MODEL, MOTION_PIXELS, NO_MOTION, ORBIT_ID, PALETTE, patternMotion, scaleFor, SHUTTER,
  shutterOffsets, shutterPhases, SMEAR_PIXELS, snapAngle, TAA_LAYERS, THIRD, TILE_PIXELS, toPlane, TURN_CENTRE,
  TURN_NODES, TURN_OFFSET, turn120, turn240, uVolume, valuesAt, viewDelta, viewMotion, wrap, wrapAngle,
} from '../crosslet/renderer.mjs';
import {
  byName, CELL_SIXTHS, centreClasses, centreOf, COLOUR_GROUP, COLOUR_PRESERVING_GROUP, COVER_K, fadeWindow,
  FULL_SPACING, GENERATORS, GLYPH, glyphMarkup, HIDE_FLOOR, label, legendMarkup, MARK_SEPARATION, markerMarkup,
  markScale, MAX_UNITS, MIN_MARK_SCALE, orderMarks, PICTURE_GROUP, screenOf, SHARED_SHIFT, SYMBOL, symmetryFor,
  translationMarkup, unitReach, unitsInView,
} from '../crosslet/generators.mjs';
import {
  advanceFling, createFling, ELASTIC_GIVE, estimateVelocity, MAX_PAN_SPEED, MIN_PAN_SPEED,
  NO_THROW, PAN_TAU, STOP_PAN, trimSamples, WINDOW_MS,
} from '../crosslet/momentum.mjs';

const N = GRID_SIZE, S = N * N;
const shipped = await readFile(new URL('../crosslet/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const U = uVolume(planar);
const mod = (value, n) => ((value % n) + n) % n;
/** The saved u sample at lattice node (x, y) in frame `t`. */
const at = (x, y, t) => U[mod(t, FRAMES) * S + mod(y, N) * N + mod(x, N)];
/** g on the saved nodes. w is a whole (11, 23) of the 36, so g carries nodes to
 * nodes and nothing below needs interpolation. */
const gNode = (x, y) => [y - x + TURN_NODES[0], -x + TURN_NODES[1]];
/** The three values the colouring compares at a saved node, and the winner. */
function triple(x, y, t) {
  const out = [];
  let p = [x, y];
  for (let k = 0; k < 3; k++) { out.push(at(p[0], p[1], t + k * THIRD)); p = gNode(p[0], p[1]); }
  return out;
}
function colourOf(x, y, t) {
  const [a, b, c] = triple(x, y, t);
  return a >= b && a >= c ? 0 : b >= c ? 1 : 2;
}
/** colour(x, t) at every saved node and frame, as one array. */
const colours = new Int8Array(FRAMES * S);
for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) colours[t * S + y * N + x] = colourOf(x, y, t);
const colourAtNode = (x, y, t) => colours[mod(t, FRAMES) * S + mod(y, N) * N + mod(x, N)];
/** How often colour(M x + v, t + shift) = perm[colour(x, t)] over all
 * 124 416 node-frames: 1 for a symmetry, 1/3 for chance. */
function agreement([[a, b], [c, d]], [vx, vy], shift, perm) {
  let same = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (colourAtNode(a * x + b * y + vx, c * x + d * y + vy, t + shift) === perm[colourAtNode(x, y, t)]) same++;
  }
  return same / (FRAMES * S);
}
const IDENTITY = [0, 1, 2], MINUS = [2, 0, 1], PLUS = [1, 2, 0];
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
// The linear part of g: S = R240 = [[−1, 1], [−1, 0]] in lattice coordinates.
const Smatrix = [[-1, 1], [-1, 0]];
const S2matrix = [[0, -1], [1, -1]];
/** A generator as the agreement sweep wants it: the integer matrix, the
 * translation in whole saved nodes, the time shift in saved frames, and the
 * colour permutation. */
const actionOf = item => ({
  matrix: item.turn,
  offset: item.kind === 'translation' ? item.vector.map(v => v * N) : item.v,
  shift: item.frames,
  perm: item.perm,
});

test('the shipped field is the catalog orbit, byte for byte, with its record certificate', async () => {
  const source = await readFile(new URL('../../colour/data/orbits/a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1.f32', import.meta.url));
  assert.deepEqual(shipped, source, 'field.f32 differs from the catalog orbit file');
  assert.equal(createHash('sha256').update(shipped).digest('hex'), FIELD_SHA256);
  assert.equal(FIELD_SHA256, 'a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1');
  // The catalog names its orbit files by the sha256 of their bytes, so the file
  // name IS the certificate: the page ships the very bytes the record is of.
  assert.ok(source instanceof Buffer && FIELD_SHA256 === 'a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1');
  assert.equal(shipped.byteLength, FIELD_BYTES);
  assert.equal(FIELD_BYTES, FRAMES * 2 * S * 4);
  assert.equal(FIELD_BYTES, 995328);
  assert.deepEqual([GRID_SIZE, FRAMES, THIRD], [36, 96, 32]);
  assert.ok(Number.isInteger(THIRD), 'a third of a period is a whole number of saved frames');
  assert.equal(ORBIT_ID, 'colour:gyre:a767fbcc68c0');
  assert.equal(GROUP_ID, 'g225');
  // The equation, as the record states it.
  assert.deepEqual(MODEL, {name: 'ginzburg-landau', label: 'cgl-d', alpha: -0.75, beta: 0.55, D: 1, dx: 1.77777778, stencil: 'triangular-six', L: 64, period: 11.3163803});
  // And the sampled range the record quotes, u ∈ [−1.00130308, 1.00130308].
  let low = Infinity, high = -Infinity;
  for (const value of U) { if (value < low) low = value; if (value > high) high = value; }
  assert.equal(low.toFixed(6), '-1.001303');
  assert.equal(high.toFixed(6), '1.001303');
  assert.ok(planar.every(Number.isFinite), 'the saved field has no NaN or infinity in it');
  // And the entry is the one the catalog still carries, with the numbers the
  // README quotes — read from the atlas rather than restated here.
  const atlas = JSON.parse(await readFile(new URL('../../colour/data/colour-atlas.json', import.meta.url), 'utf8'));
  const entry = atlas.entries.find(item => item.id === ORBIT_ID);
  assert.ok(entry, `the catalog no longer carries ${ORBIT_ID}`);
  assert.equal(entry.source.fieldSha256, FIELD_SHA256);
  assert.equal(entry.source.gate.passed, true);
  assert.equal(entry.source.gate.certificateSchema, 'equation-orbit-certificate-v1');
  assert.deepEqual([entry.source.N, entry.source.M], [GRID_SIZE, FRAMES]);
  assert.deepEqual(entry.colouring.p.map(v => Number(v.toFixed(6))), TURN_CENTRE.map(v => Number(v.toFixed(6))));
  assert.deepEqual(entry.colouring.w, TURN_NODES);
  assert.deepEqual([entry.metrics.law, entry.metrics.ties, entry.metrics.fullyEntangled], [1, 0, true]);
  assert.equal(entry.colourGroup, COLOUR_GROUP);
  assert.equal(entry.pictureGroup.groupId, PICTURE_GROUP.groupId);
  assert.equal(entry.colourPreservingGroup.groupId, COLOUR_PRESERVING_GROUP.groupId);
});

test('g is a third-turn about p, and it carries saved nodes to saved nodes', () => {
  // w = (I − S) p, so g fixes p...
  const [px, py] = TURN_CENTRE;
  const fixed = gTurn(TURN_CENTRE);
  assert.ok(Math.abs(fixed[0] - px) < 1e-15 && Math.abs(fixed[1] - py) < 1e-15, `g(p) = ${fixed}`);
  assert.deepEqual(TURN_CENTRE, [17 / 54, 35 / 108]);
  assert.deepEqual(TURN_OFFSET, [11 / 36, 23 / 36]);
  // ...and g³ is the identity, because I + S + S² = 0.
  const point = [0.3137, -0.812];
  let q = point;
  for (let k = 0; k < 3; k++) q = gTurn(q);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(q[i] - point[i]) < 1e-14, `g³ ${q} vs ${point}`);
  // The linear part is the 240° turn about the lattice origin.
  assert.deepEqual(turn240([5, -2]), [-7, -5]);
  assert.deepEqual(turn120(turn120([5, -2])), turn240([5, -2]));
  assert.deepEqual(gTurn([5, -2]), [-7 + TURN_OFFSET[0], -5 + TURN_OFFSET[1]]);
  // w is (11, 23) of the 36 nodes, so every claim below is exact integer arithmetic.
  assert.deepEqual(TURN_NODES, [11, 23]);
  assert.deepEqual(TURN_OFFSET.map(v => v * N), TURN_NODES);
  assert.deepEqual(gNode(5, -2), [-7 + 11, -5 + 23]);
  // …and g³ is the identity on the nodes too, on the nose.
  let node = [5, -2];
  for (let k = 0; k < 3; k++) node = gNode(node[0], node[1]);
  assert.deepEqual(node, [5, -2]);
  // p is not a symmetry centre of the field: nearly a third of a lattice length
  // from the nearest threefold centre of the wave (0, 0), (1/3, 2/3), (2/3, 1/3).
  const distance = ([u, v]) => Math.hypot(u - v / 2, Math.sqrt(3) * v / 2);
  const centres = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [cu, cv] of [[0, 0], [1 / 3, 2 / 3], [2 / 3, 1 / 3]]) centres.push([cu + i, cv + j]);
  const nearest = Math.min(...centres.map(([u, v]) => distance([px - u, py - v])));
  assert.equal(nearest.toFixed(6), '0.319545', 'the catalog’s centreDistance');
  // p is a point of the 1/108 grid and of nothing finer.
  assert.deepEqual([px * 108, py * 108].map(Math.round), [34, 35]);
  assert.ok(Math.abs(px * 108 - 34) < 1e-12 && Math.abs(py * 108 - 35) < 1e-12);
});

test('the entangled law holds at every one of the 124 416 node-frames, with no ties', () => {
  let violations = 0, ties = 0, margin = Infinity;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colourAtNode(x, y, t);
    const [gx, gy] = gNode(x, y);
    // colour(g x, t + T/3) = colour(x, t) − 1, exactly.
    if (colourAtNode(gx, gy, t + THIRD) !== mod(here - 1, 3)) violations++;
    // A tie in the argmax would leave the labelling ambiguous; there are none.
    const sorted = triple(x, y, t).slice().sort((a, b) => b - a);
    if (sorted[0] === sorted[1]) ties++;
    margin = Math.min(margin, sorted[0] - sorted[1]);
  }
  assert.equal(FRAMES * S, 124416);
  assert.equal(violations, 0, `${violations} of ${FRAMES * S} node-frames break the law`);
  assert.equal(ties, 0, 'no argmax anywhere is a tie');
  assert.ok(margin > 0, `the closest call anywhere leads by ${margin.toExponential(2)}`);
  // Nothing weaker works: the same operation with the colours left alone, or
  // stepped the other way, agrees with the picture nowhere at all.
  assert.equal(agreement(Smatrix, TURN_NODES, THIRD, IDENTITY), 0, 'the turn and the wait without the recolouring');
  assert.equal(agreement(Smatrix, TURN_NODES, THIRD, PLUS), 0, 'the turn and the wait with the colours stepped forward');
  assert.equal(agreement(Smatrix, TURN_NODES, THIRD, MINUS), 1, 'and with the colours stepped back, everywhere');
  // g² carries 2T/3 and steps the colours the other way.
  assert.equal(agreement(S2matrix, [23, 12], 2 * THIRD, PLUS), 1, 'g² with 2T/3 steps the colours forward');
  assert.equal(agreement(S2matrix, [23, 12], 2 * THIRD, IDENTITY), 0);
  assert.equal(agreement(S2matrix, [23, 12], 2 * THIRD, MINUS), 0);
});

test('neither half of the law is a symmetry on its own', () => {
  // The turn alone, best over the three relabellings (chance is 1/3).
  const turnAlone = [IDENTITY, PLUS, MINUS].map(perm => agreement(Smatrix, TURN_NODES, 0, perm));
  const shiftAlone = [IDENTITY, PLUS, MINUS].map(perm => agreement([[1, 0], [0, 1]], [0, 0], THIRD, perm));
  for (const [name, row] of [['g alone', turnAlone], ['T/3 alone', shiftAlone]]) {
    assert.ok(Math.max(...row) < 1, `${name} reaches ${Math.max(...row).toFixed(6)}, which would be a symmetry`);
    assert.equal(Math.max(...row).toFixed(6), '0.929229', `${name}: ${row.map(v => v.toFixed(6))}`);
  }
  // The catalog's own partTurn and partWait for this entry, to six places.
  assert.deepEqual(turnAlone.map(v => v.toFixed(6)), ['0.039255', '0.929229', '0.031515']);
  assert.deepEqual(shiftAlone.map(v => v.toFixed(6)), ['0.031515', '0.929229', '0.039255']);
  // The two rows are each other's mirror image, as the algebra demands:
  // colour(g x, t) = colour(x, t − T/3) − 1 puts them in bijection.
  assert.deepEqual(turnAlone.map(v => v.toFixed(9)), shiftAlone.slice().reverse().map(v => v.toFixed(9)));
  // This is a NEAR miss, and that is the interesting thing about this entry:
  // over 92 % of the plane the colour simply steps on one every third of a
  // period, wherever you stand. It is the 7 % that is the picture — and a
  // symmetry has to hold everywhere, so 0.929229 buys nothing at all.
  assert.ok(Math.max(...turnAlone) > 0.9, 'the wait alone very nearly works');
  assert.ok(Math.max(...turnAlone) < 1);
});

test('the near misses are witnesses, not symmetries', () => {
  // The exhaustive sweep below settles exactness over the whole space. These
  // are the best NEAR misses an offline scan of every point operation, every
  // one of the 1 296 translations, ALL 96 time shifts and every relabelling
  // turned up — the same 8 957 952 combinations, scored by agreement instead of
  // stopped at the first disagreement, done by FFT cross-correlation because
  // scoring every one of them is far too slow to run here (README §"The
  // symmetry table"). Each is re-measured here at the combination that attains
  // it, so the README's figures cannot drift from the field.
  const rows = [
    // A mirror is the closest thing to a symmetry this picture has that is not
    // one — 94 %, at three centres, with the colours left alone. The field is
    // chiral and the colouring is built on a turn, so none of them is exact.
    ['Mb', [[1, 0], [1, -1]], [0, 24], 0, IDENTITY, '0.939686'],
    ['Mc', [[-1, 1], [0, 1]], [23, 0], 0, IDENTITY, '0.939686'],
    ['Md', [[0, -1], [-1, 0]], [11, 11], 0, IDENTITY, '0.939686'],
    // The worst of the six failures the catalog itself labels for this entry —
    // though not the worst the lattice can do: swept over every centre, shift
    // and relabelling, Ma, Me and Mf reach only 0.371544, while R60 and R300
    // tie with R180 here.
    ['R180', [[-1, 0], [0, -1]], [22, 11], 0, [2, 1, 0], '0.378456'],
    // Each of those five, at the combination the offline sweep says attains its
    // own maximum, so the README's per-operation ceiling is measured here too.
    ['R60 at its best', [[1, -1], [1, 0]], [11, 24], THIRD, [0, 2, 1], '0.378456'],
    ['R300 at its best', [[0, 1], [-1, 1]], [12, 23], 2 * THIRD, [0, 2, 1], '0.378456'],
    ['Ma at its best', [[0, 1], [1, 0]], [21, 29], 16, [1, 0, 2], '0.371544'],
    ['Me at its best', [[-1, 0], [-1, 1]], [30, 26], 16, [2, 1, 0], '0.371544'],
    ['Mf at its best', [[1, -1], [0, -1]], [19, 16], 16, [0, 2, 1], '0.371544'],
    // The FIELD's own p3 relation, about the lattice origin rather than p, with
    // no recolouring at all: 92 %, and not a symmetry of the picture.
    ['R240 at the origin + T/3', Smatrix, [0, 0], THIRD, IDENTITY, '0.921007'],
    ['R120 at the origin + 2T/3', S2matrix, [0, 0], 2 * THIRD, IDENTITY, '0.921007'],
    // g itself, one saved frame off T/3 — and the plain identity one frame off,
    // which scores the same to the last digit. One frame in 96 changes the
    // picture by about 3 %, so ANY exact symmetry jogged by a frame keeps 97 %:
    // the ridge is the law's own graph seen from slightly off, and that is why
    // the table's test is exactness and never agreement.
    ['g one frame early', Smatrix, TURN_NODES, THIRD - 1, MINUS, '0.968750'],
    ['the identity one frame off', [[1, 0], [0, 1]], [0, 0], 1, IDENTITY, '0.968750'],
    // v jogged by ONE NODE, which moves the centre by (I − S)^-1 of a node:
    // (±1/108, ∓1/108) in lattice coordinates, of plane length 1/(36√3) =
    // 0.016038 lattice lengths — 0.577 of a node, not a whole one.
    ['g with v one node off w', Smatrix, [10, 23], THIRD, MINUS, '0.928586'],
    ['g with v one node off w the other way', Smatrix, [11, 24], THIRD, MINUS, '0.928586'],
    // A centre a WHOLE node off p takes v two nodes and one, by
    // Δv = 36 (I − S) Δp = (2, 1), and the near miss decays much faster than the
    // row above suggests: 0.876005 at all six neighbours of p.
    ['g about a centre a whole node off p', Smatrix, [13, 24], THIRD, MINUS, '0.876005'],
    ['g about the opposite whole-node centre', Smatrix, [9, 22], THIRD, MINUS, '0.876005'],
  ];
  for (const [name, matrix, offset, shift, perm, expected] of rows) {
    const value = agreement(matrix, offset, shift, perm);
    assert.equal(value.toFixed(6), expected, `${name}`);
    assert.ok(value < 1, `${name} is exact, which would make the group bigger`);
  }
  // The two one-frame rows are the same number, which is the point of them.
  assert.equal(agreement(Smatrix, TURN_NODES, THIRD - 1, MINUS), agreement([[1, 0], [0, 1]], [0, 0], 1, IDENTITY));
  // Moving the centre is not the same as moving v, and the arithmetic that
  // relates them is the fixed-point equation (I − S) p = w/36 itself. All six
  // centres one whole node from p score the same 0.876005, well below the
  // 0.928586 of the two v-jogged rows above, so the miss really does decay with
  // the centre — a near miss that is only near where the centre nearly is.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    // Δv = 36 (I − S) Δp with Δp = (dx, dy)/36, i.e. Δv = (2dx − dy, dx + dy).
    const v = [TURN_NODES[0] + 2 * dx - dy, TURN_NODES[1] + dx + dy];
    assert.equal(agreement(Smatrix, v, THIRD, MINUS).toFixed(6), '0.876005', `centre one node off p by (${dx}, ${dy}), v = (${v})`);
  }
  // And the centre those two 0.928586 rows really sit at is 0.577 of a node from
  // p, not a node: (I − S)^-1 (±1, ∓1)/36 has plane length 1/(36√3).
  const offset = [-1 / 108, 1 / 108];                      // (I − S)^-1 (−1, 0)/36
  assert.equal((Math.hypot(...toPlane(offset)) * 36 * Math.sqrt(3)).toFixed(9), '1.000000000');
  assert.equal(Math.hypot(...toPlane(offset)).toFixed(6), '0.016038');
});

test('no other operation of the lattice maps the picture to itself', () => {
  // Exhaustive: all 12 point operations of the triangular lattice × all 1 296
  // lattice translations × all 96 time shifts × all 6 colour permutations =
  // 8 957 952 combinations, each tested for exactness (and abandoned at its
  // first disagreeing node, which is what makes the sweep cheap).
  const OPS = {
    '1': [[1, 0], [0, 1]], R60: [[1, -1], [1, 0]], R120: [[0, -1], [1, -1]],
    R180: [[-1, 0], [0, -1]], R240: [[-1, 1], [-1, 0]], R300: [[0, 1], [-1, 1]],
    Ma: [[0, 1], [1, 0]], Mb: [[1, 0], [1, -1]], Mc: [[-1, 1], [0, 1]],
    Md: [[0, -1], [-1, 0]], Me: [[-1, 0], [-1, 1]], Mf: [[1, -1], [0, -1]],
  };
  const found = [];
  let combinations = 0;
  for (const [name, [[a, b], [c, d]]] of Object.entries(OPS)) {
    const mx = new Int32Array(S), my = new Int32Array(S);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      mx[y * N + x] = mod(a * x + b * y, N); my[y * N + x] = mod(c * x + d * y, N);
    }
    for (let shift = 0; shift < FRAMES; shift++) for (const perm of PERMS) {
      for (let vy = 0; vy < N; vy++) for (let vx = 0; vx < N; vx++) {
        combinations++;
        let holds = true;
        sweep: for (let t = 0; t < FRAMES; t++) {
          const src = t * S, dst = mod(t + shift, FRAMES) * S;
          for (let i = 0; i < S; i++) {
            const j = mod(my[i] + vy, N) * N + mod(mx[i] + vx, N);
            if (colours[dst + j] !== perm[colours[src + i]]) { holds = false; break sweep; }
          }
        }
        if (holds) found.push(`${name} v=(${vx},${vy}) time ${shift}/${FRAMES} colour ${perm.join('')}`);
      }
    }
  }
  assert.equal(combinations, 12 * S * FRAMES * 6);
  assert.equal(combinations, 8957952);
  // Exactly three, and they are the identity and the two cosets of g.
  assert.deepEqual(found.sort(), [
    '1 v=(0,0) time 0/96 colour 012',              // the identity
    'R120 v=(23,12) time 64/96 colour 120',        // g² with 2T/3, colours +1
    'R240 v=(11,23) time 32/96 colour 201',        // g with T/3, colours −1
  ]);
  // So: the colour-preserving subgroup is exactly the lattice translations (p1
  // = the catalogue's g1), the group of the coloured picture is p3 = g225, and
  // the colour action is onto ℤ₃ — a 3-cycle, never a transposition, so no
  // mirror can survive. `fullyEntangled`, in the catalog's word.
  assert.equal(found.length, 3);
  assert.equal(PICTURE_GROUP.groupId, 'g225');
  assert.equal(COLOUR_PRESERVING_GROUP.groupId, 'g1');
  assert.equal(COLOUR_GROUP, 'Z3');
});

test('the three colours share space-time exactly, and every frame nearly', () => {
  const counts = [0, 0, 0];
  let low = 1, high = 0;
  for (let t = 0; t < FRAMES; t++) {
    const frame = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) frame[colourAtNode(x, y, t)]++;
    for (let k = 0; k < 3; k++) { counts[k] += frame[k]; low = Math.min(low, frame[k] / S); high = Math.max(high, frame[k] / S); }
  }
  // Exactly a third each over the loop — the bijection (x, t) → (g x, t + T/3)
  // is measure preserving and sends each colour's region onto the next one's.
  assert.deepEqual(counts, [FRAMES * S / 3, FRAMES * S / 3, FRAMES * S / 3]);
  assert.deepEqual(counts, [41472, 41472, 41472]);
  // At a single instant the shares are close but not equal: no symmetry of this
  // picture carries a time shift of zero, so nothing forces them to be. The
  // catalog's areaImbalance for the entry is the worst of these deviations.
  assert.ok(Math.max(high - 1 / 3, 1 / 3 - low) < 0.015, `per-frame shares span ${low.toFixed(4)}…${high.toFixed(4)}`);
  assert.equal(Math.max(high - 1 / 3, 1 / 3 - low).toFixed(5), '0.01466', 'the catalog’s areaImbalance');
  // And on the continuum the viewer actually draws: a fine sweep of one repeat.
  const plane = frameAt(U, 0.137);
  const sweep = [0, 0, 0], steps = 240;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) sweep[colourAt(plane, [(i + 0.5) / steps, (j + 0.5) / steps])]++;
  for (const count of sweep) assert.ok(Math.abs(count / (steps * steps) - 1 / 3) < 0.04, `colour areas ${sweep.map(c => (c / (steps * steps)).toFixed(4))}`);
});

test('at the turn centre the law is left with nothing but the colour cycle', () => {
  // g fixes p, so there the law says only colour(p, t + T/3) = colour(p, t) − 1:
  // the symmetry with its spatial part switched off, stepping three times a loop.
  const sequence = Array.from({length: 12}, (_, k) => colourAt(frameAt(U, k / 12), TURN_CENTRE));
  for (let k = 0; k < 12; k++) assert.equal(mod(sequence[(k + 4) % 12] - sequence[k], 3), 2, `phase ${k}/12 steps back one place`);
  assert.equal(new Set(sequence).size, 3, 'all three colours pass under p during a loop');
  // The three sampled points collapse onto p there, so the colouring is flat in
  // a disc around it — a breathing one, from a whisker at the instants the
  // colour under p changes to about 0.044 of a lattice length (three nodes, 33
  // CSS pixels across at the home framing) at its widest. What is asserted here
  // is the innermost 0.01 at the one phase 0.1, where the true radius is 0.0164.
  const plane = frameAt(U, 0.1);
  const middle = colourAt(plane, TURN_CENTRE);
  for (const radius of [0.004, 0.01]) {
    for (let j = 0; j < 12; j++) {
      const angle = j * Math.PI / 6;
      const point = [TURN_CENTRE[0] + radius * Math.cos(angle), TURN_CENTRE[1] + radius * Math.sin(angle)];
      assert.equal(colourAt(plane, point), middle, `the disc of radius ${radius} around p is one colour`);
    }
  }
  // …and it is genuinely small: at the home framing 0.01 of a lattice length is
  // under four CSS pixels, which is why nothing marks p in a still frame.
  assert.ok(0.01 * TILE_PIXELS < 4);
  // How big it really is, bisected in the plane rather than asserted in prose.
  // It breathes with the phase — widest between colour changes under p, and
  // vanishing at them — so the README quotes a range, and these are its ends.
  const SQRT3 = Math.sqrt(3);
  const fromPlane = (dx, dy) => [dx - dy / SQRT3, -2 * dy / SQRT3];
  const flatRadius = phase => {
    const frame = frameAt(U, phase), centre = colourAt(frame, TURN_CENTRE);
    let smallest = 0.25;
    for (let j = 0; j < 24; j++) {
      const a = j * Math.PI / 12;
      const at = r => { const [du, dv] = fromPlane(r * Math.cos(a), r * Math.sin(a)); return colourAt(frame, [TURN_CENTRE[0] + du, TURN_CENTRE[1] + dv]); };
      if (at(smallest) === centre) continue;
      let lo = 0, hi = smallest;
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (at(m) === centre) lo = m; else hi = m; }
      smallest = lo;
    }
    return smallest;
  };
  // Widest: about three nodes, 33 CSS pixels across at 380 px per repeat.
  const widest = flatRadius(0.26);
  assert.equal(widest.toFixed(3), '0.044', `widest flat radius ${widest}`);
  assert.ok(2 * widest * TILE_PIXELS > 30 && 2 * widest * TILE_PIXELS < 36, 'the widest disc is about 33 CSS pixels across');
  assert.ok(2 * widest * GRID_SIZE > 3 && 2 * widest * GRID_SIZE < 3.5, 'the widest disc is about three nodes across');
  // And at the phase the disc above is asserted at, comfortably wider than the
  // 0.01 that is asserted — but only about half a node, so "a few nodes across"
  // would be wrong for this phase and right for the one before it.
  assert.equal(flatRadius(0.1).toFixed(3), '0.019');
  assert.ok(flatRadius(0.1) > 0.0123, 'the 0.01 lattice-coordinate disc fits inside the flat region at phase 0.1');
});

test('the reconstruction the shader uses carries the law off the nodes too', () => {
  // Both sides of the law read the SAME channel at the SAME position, so plain
  // Catmull–Rom is exact — no symmetrised kernel is needed.
  let worst = 0, violations = 0, checked = 0;
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const phase of [0, 0.017, 0.123, 0.5, 0.77, 0.9999]) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 1 / 3);
    for (let i = 0; i < 400; i++) {
      const point = [random() * 6 - 3, random() * 6 - 3];
      const a = valuesAt(here, point), b = valuesAt(later, gTurn(point));
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(b[k] - a[(k + 1) % 3]));
      if (colourAt(later, gTurn(point)) !== mod(colourAt(here, point) - 1, 3)) violations++;
      checked++;
    }
  }
  assert.equal(checked, 2400);
  assert.equal(violations, 0, `${violations} of ${checked} interpolated points break the law`);
  assert.ok(worst < 1e-12, `the two sides agree to ${worst.toExponential(2)} — double-precision round-off, not interpolation error`);
  // Value k is channel k read at g^k x, and nothing else: three positions, one
  // channel each, which is exactly what the fragment shader's `weights` does.
  const plane = frameAt(U, 0.4275);
  for (const point of [[0.31, 0.12], [0.8, 0.47], [0.02, 0.93], TURN_CENTRE]) {
    const values = valuesAt(plane, point);
    let q = point;
    for (let k = 0; k < 3; k++) { assert.equal(values[k], bicubicRGB(plane, q)[k]); q = gTurn(q); }
  }
  const spread = valuesAt(plane, [0.31, 0.12]);
  assert.ok(Math.max(...spread) - Math.min(...spread) > 1e-4, 'the three values are genuinely different');
});

test('the texture channels are the field at three instants a third of a period apart', () => {
  const phase = 0.4275, plane = frameAt(U, phase);
  for (const channel of [0, 1, 2]) {
    const t = wrap(phase + channel / 3) * FRAMES, k = Math.floor(t), w = cubicWeights(t - k);
    for (const i of [0, 1, 700, S - 1]) {
      let expected = 0;
      for (let j = 0; j < 4; j++) expected += w[j] * U[mod(k + j - 1, FRAMES) * S + i];
      assert.ok(Math.abs(plane[4 * i + channel] - expected) < 1e-7);
    }
  }
  // A third of a period renames channel k as channel k + 1, exactly — which is
  // why the law needs no tolerance in time either.
  const later = frameAt(U, phase + 1 / 3);
  for (let i = 0; i < S; i++) for (let k = 0; k < 3; k++) assert.equal(later[4 * i + k], plane[4 * i + (k + 1) % 3]);
  // Only u is painted: `uVolume` takes the first of the two interleaved planes
  // of each saved frame and the second, v, is never looked at again.
  let differs = 0;
  for (let i = 0; i < S; i++) if (planar[S + i] !== planar[i]) differs++;
  assert.ok(differs > S / 2, 'the saved orbit really does carry two different channels');
  for (const i of [0, 17, S - 1]) assert.equal(U[i], planar[i], 'the painted volume is the u plane');
  for (const k of [1, 2, FRAMES - 1]) assert.equal(U[k * S], planar[k * 2 * S], `frame ${k} is the u plane of frame ${k}`);
});

test('the shutter integrates a frame without touching the rule', () => {
  assert.equal(TAA_LAYERS, 3);
  assert.equal(MAX_TAA_LAYERS, 5);
  assert.equal(SHUTTER, 0.3);
  // A full frame interval is the box filter under which consecutive frames'
  // sub-phases tile the timeline with no gap and no overlap.
  const tile = [...shutterPhases(0.5, 3, 16, 1), ...shutterPhases(0.5 + 16 / (1000 * LOOP_SECONDS), 3, 16, 1)];
  const gaps = tile.slice(1).map((p, j) => p - tile[j]);
  for (const gap of gaps) assert.ok(Math.abs(gap - gaps[0]) < 1e-15, `evenly spaced across two frames: ${gaps}`);
  // One layer is the frame's own instant, so ?taa=1 draws exactly what a viewer
  // without a shutter draws — which is what the pixel comparisons rely on.
  assert.deepEqual(shutterPhases(0.25, 1), [0.25]);
  assert.deepEqual([...framesAt(U, shutterPhases(0.42, 1))], [...frameAt(U, 0.42)]);
  for (const layers of [2, 3, 5]) {
    const phases = shutterPhases(0.25, layers, 16.667, SHUTTER);
    const span = SHUTTER * 16.667 / (1000 * LOOP_SECONDS);
    assert.equal(phases.length, layers);
    for (const [j, p] of phases.entries()) assert.ok(Math.abs(p - (0.25 + span * ((j + 0.5) / layers - 0.5))) < 1e-15, `layer ${j} of ${layers}`);
    assert.ok(Math.abs(phases.reduce((a, b) => a + b, 0) / layers - 0.25) < 1e-15, 'centred on the displayed frame');
    const volume = framesAt(U, phases);
    for (const [j, p] of phases.entries()) assert.deepEqual([...volume.subarray(j * 4 * S, (j + 1) * 4 * S)], [...frameAt(U, p)]);
  }
  // The law holds per sub-phase, so the shutter cannot perturb the symmetry: it
  // averages three pictures each of which obeys it.
  for (const phase of shutterPhases(0.137, TAA_LAYERS)) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 1 / 3);
    for (const point of [[0.21, 0.63], [0.77, 0.08], TURN_CENTRE]) {
      assert.equal(colourAt(later, gTurn(point)), mod(colourAt(here, point) - 1, 3), `sub-phase ${phase}`);
    }
  }
  // And the reason the shader averages the colours and never the field: at a
  // point a boundary crossed during the shutter the sub-phases disagree, so
  // their colours average to a blend — while the mean of the three value
  // triples has a single argmax and is always one pure palette colour.
  const phases = shutterPhases(0.137, TAA_LAYERS, FALLBACK_INTERVAL, SHUTTER);
  const planes = phases.map(p => frameAt(U, p));
  const steps = 300, mixed = [];
  let swept = 0;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) {
    const point = [(i + 0.5) / steps, (j + 0.5) / steps];
    const seen = planes.map(plane => colourAt(plane, point));
    if (seen[0] !== seen.at(-1)) { swept++; if (mixed.length < 40) mixed.push(point); }
  }
  assert.ok(swept > 0, 'some points change colour inside a single shutter');
  assert.ok(swept / (steps * steps) < 0.01, `${(100 * swept / (steps * steps)).toFixed(3)}% of the plane changes colour inside one shutter`);
  for (const point of mixed) {
    const counts = [0, 0, 0];
    for (const plane of planes) counts[colourAt(plane, point)]++;
    assert.ok(Math.max(...counts) < TAA_LAYERS, 'the sub-phases disagree, so the average of the colours is a blend');
    const mean = [0, 0, 0];
    for (const plane of planes) { const w = valuesAt(plane, point); for (let k = 0; k < 3; k++) mean[k] += w[k] / TAA_LAYERS; }
    const argmax = mean[0] >= mean[1] && mean[0] >= mean[2] ? 0 : mean[1] >= mean[2] ? 1 : 2;
    assert.ok(counts[argmax] > 0 && counts[argmax] < TAA_LAYERS, 'the average of the field is one pure colour, never a blend');
  }
});

test('the picture is chunky, clean and quick, measured on the lattice edges', () => {
  // The six nearest neighbours of a node: ±a1, ±a2 and ±(a1 + a2), all one
  // spacing apart. (1, −1) = a1 − a2 is √3 times as far — a second neighbour —
  // so the three directions covering every edge exactly once are (1, 0), (0, 1)
  // and (1, 1).
  const SIX = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  const EDGES = [[1, 0], [0, 1], [1, 1]];
  const distance = ([u, v]) => Math.hypot(u - v / 2, Math.sqrt(3) * v / 2);
  for (const step of EDGES) assert.ok(Math.abs(distance(step) - 1) < 1e-12, `${step} is a lattice edge`);
  let edges = 0, boundary = 0, speckle = 0, changes = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colours[t * S + y * N + x];
    for (const [dx, dy] of EDGES) { edges++; if (colours[t * S + mod(y + dy, N) * N + mod(x + dx, N)] !== here) boundary++; }
    if (SIX.every(([dx, dy]) => colours[t * S + mod(y + dy, N) * N + mod(x + dx, N)] !== here)) speckle++;
    if (colours[mod(t + 1, FRAMES) * S + y * N + x] !== here) changes++;
  }
  const density = boundary / edges;
  assert.equal(density.toFixed(6), '0.071414', 'the catalog’s boundaryDensity');
  assert.equal(speckle, 0, 'no node anywhere disagrees with all six of its neighbours');
  // Every node changes colour exactly three times a period — the law read at a
  // fixed point, which g moves only when the point is not p. It is also the
  // catalog's churn × the frame count: 0.03125 × 96 = 3.
  assert.equal(changes / S, 3);
  assert.equal((changes / (S * FRAMES)).toFixed(5), '0.03125', 'the catalog’s churn');
  // Those two together are the speed of the picture: 3 crossings a period over
  // 36 × 0.071414 = 2.571 boundaries per lattice length. That is the constant
  // the renderer turns into an on-screen speed when it decides whether the
  // shutter is worth paying for.
  const speed = (changes / S) / (N * density);
  assert.equal(speed.toFixed(3), '1.167', 'lattice lengths per period');
  assert.ok(Math.abs(speed - BOUNDARY_SPEED) < 0.01, `BOUNDARY_SPEED = ${BOUNDARY_SPEED} against the measured ${speed.toFixed(3)}`);
  // Decisiveness: the winner leads the runner-up by about the field's own
  // standard deviation, so boundaries are sharp rather than marginal.
  let lead = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sorted = triple(x, y, t).sort((a, b) => b - a);
    lead += sorted[0] - sorted[1];
  }
  let total = 0, totalSquare = 0;
  for (let i = 0; i < U.length; i++) { total += U[i]; totalSquare += U[i] * U[i]; }
  const sd = Math.sqrt(totalSquare / U.length - (total / U.length) ** 2);
  assert.ok(lead / (FRAMES * S) / sd > 1, `the winner leads by ${(lead / (FRAMES * S) / sd).toFixed(3)} standard deviations`);
  assert.equal((lead / (FRAMES * S) / sd).toFixed(3), '1.151');
});

test('the governor gives up the shutter before the resolution, and settles', () => {
  function run({seconds = 300, display = 1000 / 60, shuttered = 27, plain = 10, refresh = 1000 / 60} = {}) {
    const governor = createGovernor({display});
    let now = 0, switches = 0, late = 0, frames = 0, lowest = 1, wasOn = true;
    while (now < seconds * 1000) {
      const layers = governor.shutter ? 3 : 1;
      const cost = (layers > 1 ? shuttered : plain) * governor.quality ** 2;
      const dt = Math.max(refresh, Math.ceil(cost / refresh) * refresh); // the next vsync that can take it
      now += dt; frames++;
      if (dt > refresh) late++;
      governor.tick(now, true, layers > 1);
      if (governor.shutter !== wasOn) { switches++; wasOn = governor.shutter; }
      lowest = Math.min(lowest, governor.quality);
    }
    return {switches, late: late / frames, quality: governor.quality, lowest, shutter: governor.shutter};
  }
  const slow = run();
  assert.equal(slow.shutter, false, 'the shutter is what gives way');
  assert.equal(slow.quality, 1, 'and the resolution is left alone: dropping the shutter was enough');
  assert.equal(slow.lowest, 1, 'the resolution never had to move at all');
  assert.ok(slow.switches <= 8, `${slow.switches} shutter switches in 300 s — the retry interval doubles, so it settles`);
  assert.ok(slow.late < 0.03, `${(100 * slow.late).toFixed(1)} % of frames late`);
  const slower = run({shuttered: 60, plain: 40});
  assert.equal(slower.shutter, false);
  assert.ok(slower.quality < 1, `the resolution follows when the shutter is not enough (quality ${slower.quality.toFixed(3)})`);
  const fast = run({shuttered: 5, plain: 2});
  assert.deepEqual([fast.shutter, fast.quality, fast.switches, fast.late], [true, 1, 0, 0]);
  // The climb-back must not offer a quality level already measured as too slow.
  const governor = createGovernor({display: 1000 / 60});
  let now = 0;
  const feed = (interval, windows) => { for (let i = 0; i < windows * 46; i++) { now += interval; governor.tick(now, true, false); } };
  feed(1000 / 60, 1);
  assert.equal(governor.quality, 1);
  feed(33, 1);
  assert.ok(governor.quality < 1, `the resolution drops (quality ${governor.quality})`);
  const dropped = governor.quality;
  feed(1000 / 60, 8);
  assert.equal(governor.quality, dropped, 'it does not climb back into the level it measured as late');
  feed(1000 / 60, 20);
  assert.equal(governor.quality, 1, 'and it does try again later');
});

test('the shutter is spent only where the picture actually moves', () => {
  for (const layers of [1, 2, 3, 5]) {
    const offsets = shutterOffsets(layers, SHUTTER);
    assert.equal(offsets.length, layers);
    assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-15, `centred: ${offsets}`);
    assert.ok(Math.max(...offsets.map(Math.abs)) <= SHUTTER / 2 + 1e-15, 'inside the shutter');
  }
  assert.deepEqual(shutterOffsets(1, SHUTTER), [0], 'one sub-sample is the frame itself');
  for (const offset of shutterOffsets(3, 0)) assert.equal(Math.abs(offset), 0, 'a zero-width shutter samples one instant three times');
  // A view step is the shorter way round the periodic plane.
  const still = {center: [0.2, 0.3], scale: 380, angle: 0};
  assert.deepEqual(viewDelta(still, still), {center: [0, 0], zoom: 0, angle: 0});
  const wrapped = viewDelta({center: [0.98, 0.5], scale: 380, angle: 0}, {center: [0.02, 0.5], scale: 380, angle: 0});
  assert.ok(Math.abs(wrapped.center[0] - 0.04) < 1e-12, `a pan across the wrap reads ${wrapped.center[0]}`);
  assert.equal(viewMotion({center: [1, 0], zoom: 0, angle: 0}, 380, 1000, 600), 380);
  assert.equal(viewMotion(NO_MOTION, 380, 1000, 600), 0);
  // The pattern's own motion. The gate is on the SMEAR the shutter would draw —
  // travel × shutter — so the travel it takes to engage is motion / shutter:
  // 2.5 px a frame at the shipped 0.3 shutter, which this pattern reaches at
  // about 1028 CSS px per repeat, and 0.75 px a frame with ?shutter=1, at 309.
  const gateScale = shutter => MOTION_PIXELS / (shutter * BOUNDARY_SPEED * FALLBACK_INTERVAL / (1000 * LOOP_SECONDS));
  assert.equal(patternMotion(380, FALLBACK_INTERVAL).toFixed(3), '0.926');
  assert.ok(patternMotion(380, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'the home framing does not pay for a shutter');
  assert.ok(patternMotion(gateScale(SHUTTER) * 1.01, FALLBACK_INTERVAL) * SHUTTER > MOTION_PIXELS, 'a framing past the gate does');
  assert.ok(patternMotion(gateScale(SHUTTER) * 0.99, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'and one just short of it does not');
  assert.equal((MOTION_PIXELS / SHUTTER).toFixed(2), '2.50', 'the shipped shutter asks for 2.5 CSS px of travel a frame');
  assert.equal(gateScale(SHUTTER).toFixed(0), '1026', 'which the pattern reaches at about 1030 CSS px per repeat');
  assert.equal(gateScale(1).toFixed(0), '308', 'and the full box filter engages at about 310');
  assert.ok(gateScale(SHUTTER) < MAX_SCALE, 'the pattern engages the shutter by itself before the zoom limit');
  assert.equal(MOTION_PIXELS, 0.75);
  // The other end: the view's smear is integrated over at most SMEAR_PIXELS per
  // sub-sample, so three of them never spread the picture over more than 18 CSS
  // pixels. The pattern's own smear stays under that even at the deepest zoom.
  assert.equal(SMEAR_PIXELS, 6);
  assert.ok(SMEAR_PIXELS * TAA_LAYERS > patternMotion(MAX_SCALE, FALLBACK_INTERVAL) * SHUTTER,
    'the pattern’s own smear never reaches that width, so the cap bounds panning only');
  assert.equal(patternMotion(MAX_SCALE, FALLBACK_INTERVAL).toFixed(1), '19.5', 'the deepest zoom moves 19.5 px a frame');
});

test('the home framing is the catalog link’s, and turns snap to a sixth', () => {
  // `scale=380.000&x=0.314815&y=0.324074` — one lattice length across 380 CSS
  // pixels, centred on the turn centre.
  assert.equal(TILE_PIXELS, 380);
  assert.equal(scaleFor(1440, 900), 380);
  assert.equal(scaleFor(390, 844), 195, 'a phone shows two repeats across instead');
  assert.deepEqual(CENTER, TURN_CENTRE);
  assert.deepEqual(CENTER.map(v => Number(v.toFixed(6))), [0.314815, 0.324074]);
  const view = createView();
  assert.deepEqual(view.center, CENTER.map(wrap));
  assert.equal(view.scale(1440, 900), 380);
  assert.ok(view.isHome());
  const degrees = angle => Math.round(snapAngle(angle * Math.PI / 180) * 180 / Math.PI);
  assert.equal(degrees(58), 60);
  assert.equal(degrees(53), 53);
  assert.equal(degrees(119), 120);
  assert.equal(degrees(-61), -60);
  assert.equal(degrees(89), 89, 'a quarter turn is not a lattice symmetry here');
  assert.equal(wrapAngle(Math.PI), Math.PI);
  assert.deepEqual(PALETTE, ['#c9563e', '#57979a', '#e2be68']);
});

// ---------------------------------------------------------------- the marks

test('the four generators the page draws are exact at all 124 416 node-frames', () => {
  assert.deepEqual(GENERATORS.map(item => item.name), ['g', 'gSquared', 'tau1', 'tau2']);
  for (const item of GENERATORS) {
    const {matrix, offset, shift, perm} = actionOf(item);
    assert.equal(agreement(matrix, offset, shift, perm), 1,
      `${item.ascii} (${item.name}) is not a symmetry: v=(${offset}) shift ${shift}/${FRAMES} colour ${perm}`);
    // Every part of it is load-bearing: no other recolouring works, and a turn
    // cannot drop its wait. (The two slides carry neither, and the exhaustive
    // sweep above has already shown that no shorter translation is a symmetry.)
    for (const other of PERMS) {
      if (other.every((c, i) => c === perm[i])) continue;
      assert.notEqual(agreement(matrix, offset, shift, other), 1, `${item.ascii} also holds with colour ${other}`);
    }
    if (shift) assert.notEqual(agreement(matrix, offset, 0, perm), 1, `${item.ascii} holds without its wait`);
  }
  // The two turns are g and g², about the same point, and the centre each
  // carries really is the fixed point of its own turn: (I − M) p = v / N.
  for (const item of GENERATORS.filter(g => g.kind === 'rotation')) {
    const [[a, b], [c, d]] = item.turn, [pu, pv] = item.centre;
    const residual = [pu - (a * pu + b * pv) - item.v[0] / N, pv - (c * pu + d * pv) - item.v[1] / N];
    assert.ok(Math.hypot(...residual) < 1e-12, `${item.name}: (I − M)p − v/N = ${residual}`);
    assert.deepEqual(item.centre, TURN_CENTRE, `${item.name} is about p`);
    assert.equal(item.centreExact[0][0] / item.centreExact[0][1], TURN_CENTRE[0]);
    assert.equal(item.centreExact[1][0] / item.centreExact[1][1], TURN_CENTRE[1]);
  }
  // g² really is g twice, in space, in time and in colour.
  const [g, g2] = GENERATORS;
  const apply = ({matrix: [[a, b], [c, d]], offset: [vx, vy]}, [x, y]) => [a * x + b * y + vx, c * x + d * y + vy];
  const action = actionOf(g), squared = actionOf(g2);
  for (const point of [[0, 0], [1, 0], [0, 1], [7, -3]]) {
    assert.deepEqual(apply(action, apply(action, point)), apply(squared, point), `g² ≠ g∘g at ${point}`);
  }
  assert.equal(mod(2 * action.shift, FRAMES), squared.shift);
  assert.deepEqual([0, 1, 2].map(c => action.perm[action.perm[c]]), squared.perm);
  // …and g³ = 1: three thirds of a turn, one whole period, no recolouring left.
  for (const point of [[0, 0], [5, 2]]) {
    assert.deepEqual(apply(action, apply(squared, point)), point, 'g³ moves the plane');
  }
  assert.equal(mod(3 * action.shift, FRAMES), 0, 'three thirds of a period is a whole loop');
  assert.deepEqual([0, 1, 2].map(c => action.perm[squared.perm[c]]), IDENTITY, 'the colours come back');
  // The slides are the lattice the field is stored on, which is why they are
  // free: no wait, no recolouring, and the same colour either side.
  for (const item of GENERATORS.filter(g => g.kind === 'translation')) {
    assert.deepEqual(item.perm, IDENTITY);
    assert.equal(item.frames, 0);
    assert.deepEqual(item.vectorSixths.map(s => s / CELL_SIXTHS), item.vector);
  }
  assert.deepEqual(GENERATORS.filter(g => g.kind === 'translation').map(g => g.vector), [[1, 0], [0, 1]]);
});

test('the master rule gives each mark its wait and its recolouring', () => {
  // σ(c) = (−1)^m c − j for a rotation by m sixths, with j read off the
  // permutation (j = −σ(0) mod 3) and the wait −m/6 of a period.
  for (const item of GENERATORS) {
    const j = mod(-item.perm[0], 3);
    assert.equal(j, item.j, `${item.name}: the catalog's j`);
    const {sixths, perm} = symmetryFor(item.msixths, j);
    assert.deepEqual(perm, item.perm, `${item.name}: σ(c) = (−1)^m c − j`);
    assert.equal(sixths, item.sixths, `${item.name}: the wait is −m/6 of a period`);
    assert.equal(item.frames * 6 / FRAMES, mod(-item.msixths, 6), `${item.name}: masterRuleTime`);
    assert.deepEqual(item.timeFraction, item.name === 'g' ? [1, 3] : item.name === 'gSquared' ? [2, 3] : [0, 1]);
    if (item.kind === 'rotation') assert.equal(item.frames, item.k * FRAMES / item.n);
  }
  // Both turns cycle all three colours; neither transposes two. That is what a
  // cyclic colour group means, and it is why every mark but the slides waits.
  for (const item of GENERATORS) {
    const moved = [0, 1, 2].filter(c => item.perm[c] !== c).length;
    assert.ok(moved === 0 || moved === 3, `${item.name} transposes two colours, which Z₃ cannot do`);
    assert.equal(moved === 3, item.frames !== 0, `${item.name}: recolouring and waiting arrive together`);
  }
  // The symbol the legend prints is exactly what the four marks carry.
  assert.equal(SYMBOL.unicode, `${GENERATORS[0].symbol} ${GENERATORS[1].symbol} · ${GENERATORS[2].symbol} ${GENERATORS[3].symbol}`);
  assert.equal(SYMBOL.unicode, '3₁⁽⁰²¹⁾ 3₂⁽⁰¹²⁾ · τ₁ τ₂');
  assert.equal(SYMBOL.html, '3<sub>1</sub><sup>(021)</sup> 3<sub>2</sub><sup>(012)</sup> · τ<sub>1</sub> τ<sub>2</sub>');
  assert.equal(SYMBOL.ascii, '3_1^(021) 3_2^(012) . tau1 tau2');
  // Strip the superscripts and it is 3₁3₂ about one centre: p3, the catalogue's
  // g225 — the film group of the wave itself.
  assert.equal(PICTURE_GROUP.orbifold, '333');
  assert.equal(centreClasses(orderMarks().rotations).length, 1, 'the two turns name ONE centre');
});

test('the marks are placed by the viewer’s own camera, exactly', () => {
  // screenOf is the inverse of view.latticeAt — that is the whole reason the
  // marks stay glued to the pattern through a pan, a zoom, a turn and a resize.
  const view = createView();
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const [width, height] of [[1440, 900], [390, 844], [2880, 1800]]) {
    for (let trial = 0; trial < 40; trial++) {
      view.restore({center: [random(), random()], scale: 120 + random() * 2000, angle: (random() - 0.5) * 7});
      for (const point of [[0, 0], [1, 0], [0, 1], TURN_CENTRE, [-2.5, 4.25]]) {
        const back = view.latticeAt(screenOf(point, view, width, height), width, height);
        assert.ok(Math.abs(back[0] - point[0]) < 1e-9 && Math.abs(back[1] - point[1]) < 1e-9,
          `${point} → ${back} at ${width}×${height}`);
      }
    }
  }
  // At the home framing the turn centre is the middle of the screen and the two
  // slides are one lattice length each, in the CSS pixels the artwork was drawn
  // against: a₁ straight right, a₂ down-left at 120°.
  view.reset();
  const [width, height] = [1440, 900];
  const at0 = point => screenOf(point, view, width, height).map(v => Number(v.toFixed(2)));
  assert.deepEqual(at0(TURN_CENTRE), [width / 2, height / 2], 'p sits at the centre of the screen');
  const cell = screenOf([0, 0], view, width, height);
  const offsetOf = item => screenOf(centreOf(item), view, width, height).map((v, i) => Number((v - cell[i]).toFixed(2)));
  assert.deepEqual(offsetOf(byName('tau1')), [380, 0], 'τ₁ is one lattice length, straight right');
  assert.deepEqual(offsetOf(byName('tau2')), [-190, -329.09], 'τ₂ is one lattice length at 120°, up and to the left');
  assert.deepEqual(offsetOf(byName('g')), [58.06, -106.65], 'the coins hang off a point 121 px from the cell corner');
  assert.deepEqual(offsetOf(byName('gSquared')), offsetOf(byName('g')), 'and both hang off the SAME point');
  const exact = screenOf(centreOf(byName('g')), view, width, height).map((v, i) => v - cell[i]);
  assert.ok(Math.abs(Math.hypot(...exact) - MARK_SEPARATION * TILE_PIXELS) < 1e-9);
  // Which is the spacing the crowding is measured by, and the shortest gap in
  // the annotation: the lattice length itself is three times as long.
  assert.equal(MARK_SEPARATION.toFixed(6), '0.319545');
  assert.ok(MARK_SEPARATION < 1 / 3);
  assert.equal(unitReach().toFixed(2), '1.12', 'a unit reaches a lattice length and a bit past its cell');
});

test('the overlay thins out, fades and gives up as the marks crowd', () => {
  const view = createView();
  const [width, height] = [1440, 900];
  // At the home framing every mark is drawn at full size and full strength.
  const home = markScale(view, width, height);
  assert.ok(Math.abs(home.spacing - MARK_SEPARATION * TILE_PIXELS) < 1e-9);
  assert.equal(home.opacity, 1);
  assert.ok(home.scale > 0.99 && home.scale <= 1, `the home framing draws marks at ${home.scale.toFixed(3)}`);
  assert.equal(home.lean, false);
  assert.deepEqual(home.marks, ['g', 'gSquared']);
  assert.deepEqual(home.labels, {g: true, gSquared: true, tau1: true, tau2: true});
  // A phone's home framing is the densest view the page has, and it still keeps
  // every mark and every label whole.
  const phone = createView();
  const small = markScale(phone, 390, 844);
  assert.equal(small.opacity, 1, 'no device opens on a faded layer');
  assert.deepEqual(small.marks, ['g', 'gSquared']);
  assert.ok(Object.values(small.labels).every(Boolean), 'and the labels survive too');
  assert.ok(small.scale > MIN_MARK_SCALE);
  // The narrowest phone there is, too.
  assert.equal(markScale(createView(), 320, 640).opacity, 1);
  // Zooming out: the two coins never part company — they are one centre — and
  // the whole layer goes when the marks can shrink no further.
  const seen = [];
  for (const scale of [380, 300, 240, 200, 170, 150, 130, 113, 100, 60]) {
    view.restore({center: [...CENTER], scale, angle: 0});
    const state = markScale(view, width, height);
    assert.equal(state.marks.length === 2 || state.marks.length === 0, true, `at ${scale} px the coins are ${state.marks}`);
    assert.equal(state.strength.g, state.strength.gSquared, `at ${scale} px the two coins differ in strength`);
    assert.ok(state.scale >= MIN_MARK_SCALE - 1e-12);
    seen.push([scale, Number(state.scale.toFixed(3)), Number(state.opacity.toFixed(3))]);
  }
  assert.deepEqual(seen, [
    [380, 0.995, 1], [300, 0.786, 1], [240, 0.629, 1], [200, 0.524, 1], [170, 0.445, 1],
    [150, 0.393, 0.994], [130, 0.34, 0.462], [113, 0.296, 0.009], [100, 0.295, 0], [60, 0.295, 0],
  ]);
  assert.equal(FULL_SPACING, 122);
  assert.equal(HIDE_FLOOR, 36);
  assert.equal(MIN_MARK_SCALE, HIDE_FLOOR / FULL_SPACING);
  // The fade is derived from the ceiling, so the layer is gone before the
  // ceiling on how many repeats may be built can ever bite.
  assert.equal(MAX_UNITS, 320);
  assert.equal(COVER_K.toFixed(4), '0.3408');
  for (const [w, h] of [[390, 844], [1440, 900], [2880, 1800], [3840, 2160]]) {
    const {hide, fade} = fadeWindow(w, h);
    view.restore({center: [...CENTER], scale: fade / MARK_SEPARATION, angle: 0});
    const units = unitsInView(view, w, h, {reach: unitReach()});
    assert.ok(units.length < MAX_UNITS, `${w}×${h}: ${units.length} units at full opacity, ceiling ${MAX_UNITS}`);
    assert.ok(hide < fade);
  }
  // And the units really are the lattice cells nearest the middle of the screen.
  view.reset();
  const units = unitsInView(view, width, height, {reach: unitReach()});
  assert.ok(units.length > 8 && units.length < MAX_UNITS, `${units.length} units at the home framing`);
  assert.ok(units[0].from <= units[units.length - 1].from, 'nearest first');
  for (const unit of units) assert.deepEqual(unit.cell.map(Math.round), unit.cell, 'a unit is a whole lattice cell');
});

test('the legend says the same thing the marks do', () => {
  const html = legendMarkup();
  assert.ok(html.includes(SYMBOL.html), 'the panel prints the page’s symbol');
  assert.equal(SYMBOL.html.replace(/<\/?su[bp]>/g, ''), '31(021) 32(012) · τ1 τ2', 'the markup says what the symbol says');
  for (const item of GENERATORS) {
    assert.ok(html.includes(item.html), `the table is missing ${item.ascii}`);
    assert.ok(html.includes(item.colourShort), `the table is missing ${item.name}’s colours`);
    assert.ok(html.includes(item.timeShort), `the table is missing ${item.name}’s wait`);
  }
  for (const colour of PALETTE) assert.ok(html.includes(colour), `the key is missing ${colour}`);
  assert.ok(html.includes('g225') && html.includes('g1'), 'the catalogue numbers are named');
  assert.ok(/anticlockwise/.test(html), 'the generator’s own sense is named');
  // The two things this page has to explain and its siblings do not: one centre
  // written twice, and why nothing at all survives a frozen frame.
  assert.ok(/Two coins, one centre/.test(html));
  assert.ok(/fully entangled/.test(html));
  assert.ok(/colour group is Z₃/.test(html), 'the colour group is named as cyclic');
  assert.ok(/presentation/.test(html) && /not an orbifold symbol/.test(html), 'the symbol is qualified');
  assert.ok(/hidden\s+altogether/.test(html), 'the panel says the marks can be hidden by zooming out');
  assert.ok(/\?generators=1/.test(html), 'and how to share a view with them');
  // Every rotation order the page draws has artwork, and it is the site's own —
  // body first, screw tails after, so the overlay can draw them apart.
  for (const item of GENERATORS) {
    if (item.kind !== 'rotation') continue;
    assert.ok(GLYPH[item.order], `no glyph for order ${item.order}`);
    const art = glyphMarkup(item.order);
    assert.ok(art.includes('class="cc-body"') && art.includes('class="cc-tail"'), `order ${item.order} keeps its silhouette`);
    assert.equal(art.match(/M/g).length, GLYPH[item.order].path.match(/M/g).length, 'every subpath is drawn exactly once');
    assert.ok(art.indexOf('cc-tail') < art.indexOf('cc-body'), 'the tails go behind the body');
  }
  // A mark's markup carries what it means, for the tests in the browser.
  const g = markerMarkup(byName('g'), {shift: SHARED_SHIFT});
  assert.ok(g.includes('data-name="g"') && g.includes('data-perm="201"') && g.includes('data-time="1/3"'));
  assert.ok(g.includes('data-shared="true"') && g.includes('class="cc-tether"'), 'a shared centre keeps its ring');
  assert.ok(g.includes('class="cc-turn"'), 'the order glyph is the only piece that turns with the view');
  assert.ok(markerMarkup(byName('gSquared'), {shift: SHARED_SHIFT}).includes('data-time="2/3"'));
  // The slides have no clock at all, and an identity slide is drawn quietly.
  const slide = translationMarkup(byName('tau1'));
  assert.ok(!slide.includes('cc-dial'), 'the free slide has no clock');
  assert.ok(slide.includes('data-quiet="true"'), 'and a slide that recolours nothing is drawn quietly');
  assert.ok(slide.includes('data-perm="012"'));
  // The shared shift is what keeps the two coins apart: 1.7 coin radii each,
  // 120° apart, which is more than the sense arcs need.
  assert.equal(SHARED_SHIFT, 30 * 1.7);
  const apart = Math.abs(2 * SHARED_SHIFT * Math.sin((byName('gSquared').chipDeg - byName('g').chipDeg) * Math.PI / 360));
  assert.equal(apart.toFixed(1), '88.3');
  assert.ok(apart > 2 * 38, `the coins are ${apart.toFixed(1)} apart, against 76 of sense arc`);
  // …and both of their chips point away from the lattice node at the tail of
  // the two slides, which is the only other thing in a cell and sits 208.6° from
  // p. Drawn at the catalog's own 210° and 330° the lower chip landed exactly
  // on it and the annotation read as one mark with two heads.
  const camera = createView();
  const from = screenOf(TURN_CENTRE, camera, 1440, 900), to = screenOf([0, 0], camera, 1440, 900);
  // The clock the artwork is laid out on: 0° is twelve, 90° is three.
  const nodeDeg = mod(Math.atan2(to[0] - from[0], from[1] - to[1]) * 180 / Math.PI, 360);
  assert.equal(nodeDeg.toFixed(1), '208.6');
  for (const item of orderMarks().rotations) {
    const away = Math.abs(wrapAngle((item.chipDeg - nodeDeg) * Math.PI / 180)) * 180 / Math.PI;
    assert.ok(away > 80, `${item.name}'s chip points ${away.toFixed(1)}° from the lattice node`);
  }
});

test('the labels on the artwork are set with real tspans, not Unicode', () => {
  // WebKit has no glyph for ₁ ⁽ ⁰ ⁾ in the serif stack and gives each a
  // full-width fallback box, so a Unicode label shatters into fragments strewn
  // across the picture; in Chromium it renders, but 3₁⁽⁰²¹⁾ reads as 31(021).
  // The block that has no glyph is U+2070…U+209F, superscripts and subscripts.
  // The Latin-1 ² of the name g² is a different character and is everywhere, so
  // it stays: it is the generator's name, not the notation's decoration.
  const unicode = /[\u2070-\u209f]/;
  for (const item of GENERATORS) {
    const text = label(item);
    assert.ok(text.includes('<tspan'), `${item.name}'s label has no tspan`);
    assert.ok(!unicode.test(text), `${item.name}'s label still carries Unicode sub/superscripts`);
    assert.ok(text.includes(`>${item.sub}</tspan>`), `${item.name}'s subscript is missing`);
    if (item.sup) assert.ok(text.includes(`>${item.sup}<`), `${item.name}'s superscript is missing`);
    assert.ok(text.includes('paint-order="stroke"'), 'the ink halo still carries the whole label');
    const plain = text.replace(/<[^>]+>/g, '');
    assert.equal(plain, `${item.glyph === item.base ? '' : `${item.glyph} `}${item.base}${item.sub ?? ''}${item.sup ?? ''}`);
  }
  assert.equal(label(byName('g')).replace(/<[^>]+>/g, ''), 'g 31(021)');
  assert.equal(label(byName('tau1')).replace(/<[^>]+>/g, ''), 'τ1');
  for (const item of GENERATORS) {
    const art = item.kind === 'rotation' ? markerMarkup(item, {shift: SHARED_SHIFT}) : translationMarkup(item);
    assert.ok(!unicode.test(art), `${item.name}: Unicode digits on the artwork`);
  }
  // The Unicode form survives where it is read aloud rather than drawn.
  assert.ok(unicode.test(SYMBOL.unicode) && byName('g').symbol === '3₁⁽⁰²¹⁾');
  assert.equal(byName('gSquared').glyph, 'g\u00b2', 'the name g² uses the Latin-1 superscript two');
});

test('the page announces itself as Crosslet and links its own assets', async () => {
  const page = await readFile(new URL('../crosslet/index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>Crosslet — Plus-shaped pieces, turned and recoloured<\/title>/);
  assert.match(page, /<span class="name">Crosslet<\/span>/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
    assert.ok(page.includes(`"${tag}"`), `missing ${tag}`);
  }
  // It is a GitHub Pages page and nothing else: every absolute link is to the
  // project site, and the social card is the file beside it.
  for (const url of page.match(/https:\/\/[^"]+/g) ?? []) {
    assert.ok(url.startsWith('https://yaroslavvb.github.io/animated-groups-fable/scott-gray/crosslet/'), `stray absolute URL ${url}`);
  }
  assert.ok(page.includes('social-preview.jpg'));
  assert.match(page, /<canvas id="pattern"/);
  assert.match(page, /\.\/app\.mjs/);
  // The generator marks: a real checkbox in the control bar, off by default.
  assert.match(page, /<input type="checkbox" id="generators-check">/);
  assert.ok(!/id="generators-check"[^>]*checked/.test(page), 'the checkbox must not ship checked');
  assert.match(page, /<svg id="generators"[^>]*hidden>/, 'the overlay ships hidden');
  assert.match(page, /id="legend"/);
  const app = await readFile(new URL('../crosslet/app.mjs', import.meta.url), 'utf8');
  assert.ok(app.includes("localStorage.getItem(STORE_KEY)") && app.includes("'crosslet:generators'"), 'the choice is remembered per browser');
  assert.ok(app.includes("params.get('generators')") && app.includes("params.get('marks')"), '?generators= and the catalog’s ?marks= both work');
  assert.ok(app.includes("stored === '1'"), 'and the default, with nothing stored and nothing asked, is off');
  assert.ok(app.includes("key === 'g'"), 'G toggles the marks');
  const manifest = JSON.parse(await readFile(new URL('../crosslet/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'Crosslet');
  assert.equal(manifest.theme_color, '#14110f');
});

test('the momentum this page ships is the sibling pages’, byte for byte', async () => {
  const here = await readFile(new URL('../crosslet/momentum.mjs', import.meta.url));
  assert.deepEqual(here, await readFile(new URL('../gyre/momentum.mjs', import.meta.url)), 'momentum.mjs has drifted from ../gyre/');
  assert.deepEqual(here, await readFile(new URL('../trefoil/momentum.mjs', import.meta.url)));
  // A handful of its behaviour, so this file fails on its own if the glide
  // changes: a release is measured over the last 100 ms, a slow one throws
  // nothing, a fast one is capped, and a glide travels velocity × τ and stops.
  assert.equal(WINDOW_MS, 100);
  const samples = [];
  for (let i = 0; i <= 10; i++) samples.push({time: i * 10, mid: [i * 10, 0], logScale: Math.log(380), angle: 0});
  trimSamples(samples, WINDOW_MS);
  const fast = estimateVelocity(samples, 100);
  assert.ok(Math.abs(fast.pan[0] - 1000) < 1, `a finger at 1000 px/s reads ${fast.pan[0]}`);
  assert.equal(fast.zoom, 0);
  const slow = estimateVelocity([{time: 0, mid: [0, 0], logScale: 0, angle: 0}, {time: 100, mid: [MIN_PAN_SPEED * 0.05, 0], logScale: 0, angle: 0}], 100);
  assert.deepEqual(slow, NO_THROW, 'a slow release throws nothing');
  const capped = estimateVelocity([{time: 0, mid: [0, 0], logScale: 0, angle: 0}, {time: 20, mid: [MAX_PAN_SPEED, 0], logScale: 0, angle: 0}], 20);
  assert.ok(capped.pan[0] <= MAX_PAN_SPEED + 1e-9, 'and a fast one is capped');
  const fling = createFling({pan: [1200, 0], zoom: 0, turn: 0}, {logScale: Math.log(380), angle: 0, logMin: Math.log(24), logMax: Math.log(8000)});
  let travelled = 0, steps = 0;
  while (fling && steps < 2000) {
    const step = advanceFling(fling, 1 / 120);
    travelled += step.pan[0];
    steps++;
    if (!step.live) break;
  }
  assert.ok(Math.abs(travelled - 1200 * PAN_TAU) < 1200 * PAN_TAU * 0.02, `a glide travels velocity × τ: ${travelled.toFixed(1)} against ${(1200 * PAN_TAU).toFixed(1)}`);
  assert.ok(steps < 2000, 'and it settles');
  assert.ok(STOP_PAN > 0 && ELASTIC_GIVE > 0);
});
