// rigid.js — an orbifold with no number of shape, shown as the Classification of Surfaces page shows it: that page's
// own tile (catalog.js domainOf) and its own print (motifs.js design), wrapped as an atlas of one atom so that the
// same pane draws it. Every spherical type, eight Euclidean ones, and the hyperbolic pqr, *pqr and p*q.

import { domainOf } from '../../classification-of-surfaces/src/sym/catalog.js';
import { analyse } from '../../classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../classification-of-surfaces/src/sym/motifs.js';

const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);

export function rigidAtlas(sig) {
  const D = domainOf(sig);
  if (!D) return null;
  const A = analyse(D), G = D.G, n = D.n;
  const sides = D.edges.map((e, i) => ({ role: e.mirror ? 'mirror' : 'glue', mirror: !!e.mirror, nbrs: [{ atom: 0, T: A.maps[i], flip: det(A.maps[i]) < 0 }], len: G.dist(D.verts[i], D.verts[(i + 1) % n]) }));
  const marks = A.classes.filter((c) => c.n > 1).map((c) => {
    const v = c.verts[0];
    let dir = D.at;
    if (c.kind === 'corner') { const en = c.ends[0]; dir = D.verts[en.side === 'start' ? (en.e + 1) % n : en.e]; }
    return { pt: D.verts[v], dir, kind: c.kind === 'cone' ? 'cone' : 'corner', n: c.n };
  });
  const atom = { id: 0, part: 0, local: 0, verts: D.verts, sides, at: D.at, clear: D.clear, twin: false, marks, seams: [], glides: A.glides.filter((g) => g.seg).map((g) => g.seg), shapes: design(D), reach: n ? Math.max(...D.verts.map((v) => G.dist(v, D.at))) : 0 };
  return { kind: G.kind, G, atoms: [atom], parts: [{ id: 'tile', atoms: [0] }], reach: atom.reach, clear: D.clear, area: n ? Math.abs(G.area(D.verts)) : 4 * Math.PI, rigid: true, face: D.face || null, signature: A };
}
