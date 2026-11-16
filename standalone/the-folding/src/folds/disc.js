// folds/disc.js — the four kaleidoscopes (*2222, *442, *333, *632): the tile IS the surface. Fold type 'disc'.
//
// The owner, 15 Nov 2026, on *632: "Normally, the folded part is just the surface, but here there is a bit of confusion
// about which part lies in the folding and which part lies in the tiling. Unify those two."
//
// Conway (The Symmetries of Things, ch. 8): a surface is polygons and zippers; "a triangle is a tidy surface — it's a
// sphere with a hole in it" (fig. 8.1). Every edge of a kaleidoscope's tile is a mirror, so the tile has no zipper:
// nothing is glued, and the tile is its orbifold already — a disk (∗, a punched sphere) whose rim is the mirror, with
// a corner point at each corner. So this fold moves nothing: at(t) is the identity for every t.
//
// What used to be this group's fold — the star of 2n tiles round one corner folding like a paper snowflake onto the
// tile (src/folds/snowflake.js, kept in the tree, used by no group) — showed copies of the tile in the folding. Those
// copies are the TILING: each is the tile's mirror image, turned over its mirror line. They are now made, and folded
// back, by the journey's tiling half (src/journey.js, src/replicate.js, src/tiling3d.js) — for every group alike: the
// folded part is just the surface, and the copies are the pattern.
//
// The Fold (SPEC 5.3): { mesh, type: 'disc', stops, duration: 0, at(t), still: true }. duration 0 and still say that
// there is no fold to play: the journey gives this group no fold half (journey.js journeyLayout: a = 0).

/** The fold of a kaleidoscope's tile: none. `mesh` is the tile's own mesh (buildMesh), drawn as it is. */
export default function createDisc(group, domain, mesh) {
  if (!mesh) throw new Error(`folds/disc: no mesh for ${group && group.id}`);
  const flat = (x, y, cell, out = [0, 0, 0]) => { out[0] = x; out[1] = y; out[2] = 0; return out; };
  return {
    mesh, type: 'disc', duration: 0, still: true,
    stops: [{ t: 0, label: 'the tile: a disk' }, { t: 1, label: 'the tile: a disk' }],
    params: { corners: (domain.conePoints || []).filter((c) => c.onMirror).length },
    at() { return flat; },
  };
}
