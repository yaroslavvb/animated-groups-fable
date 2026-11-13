import { BY_ID, elementsNear } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import createFold from '../../src/folds/crosscap.js';
import { assignEdgeColors } from '../../src/plane.js';
import { classify, inverse, apply, polyArea, clipHalfPlane } from '../../src/geom.js';
const g = BY_ID['22x'];
const r = (v) => +(+v).toFixed(4);
for (const p of g.presets) {
  const d = buildDomain(g, { seed: p.seed, warp: makeWarp(g, 0) });
  assignEdgeColors(d, null);
  console.log('==', p.name, 'seed', d.seed.map(r), 'keys', Object.keys(d).join(','));
  console.log('  poly', d.poly.map((q) => q.map(r).join(',')).join(' | '), 'area', r(d.area), 'size', d.size);
  d.edges.forEach((e, i) => { const c = classify(e.g); console.log('  edge', i, e.kind, 'cls', e.cls, 'color', e.color, 'partner', e.partner, 'halfTurn', e.halfTurn, 'rev', e.rev, c.type, c.type === 'rotation' ? c.center.map(r) : c.type === 'glide' ? [c.point.map(r), c.dir.map(r), r(c.dist)] : c.vec ? c.vec.map(r) : ''); });
  console.log('  cones', JSON.stringify(d.conePoints.map((c) => ({ x: r(c.x), y: r(c.y), order: c.order }))));
  const m = buildMesh(g, d, {});
  const f = createFold(g, d, m, { anchor: p.seed });
  const M = f.mesh;
  console.log('  mesh keys', Object.keys(M).join(','), 'n', M.n, 'm', M.tri.length / 3, 'pieces', M.cells.map((c) => `#${c.index} par${c.parity} area ${r(c.area)} parent ${c.parent} depth ${c.depth}`).join('; '));
  console.log('  boundary', M.boundary.map((b) => `e${b.edge}:${b.pts.length / 2}pts`).join(' '), 'creases', (M.creases || []).length, 'frame', JSON.stringify(Object.fromEntries(Object.entries(f.frame).map(([k, v]) => [k, r(v)]))), 'nearReach', r(f.nearReach), 'lift', r(f.lift), 'stops', JSON.stringify(f.stops));
}
console.log('elementsNear sample', elementsNear(g, 0.3, 0.9, 1.2).length, Object.keys(elementsNear(g, 0.3, 0.9, 1.2)[0]).join(','));
