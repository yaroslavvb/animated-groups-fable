// dev/fold-flat.js — the trivial reference fold: the tile stays flat for every t.
// It is the smallest module that satisfies the fold interface of SPEC 5.3, so dev/fold-demo.html can be tested
// before any real fold exists:  dev/fold-demo.html?g=333&fold=flat
// It is also the shape to copy when starting a fold module (default-exported factory, the four fields, and
// at(t) returning a function that WRITES the position into `out`).

export default function createFold(group, domain, mesh, opts = {}) {
  // at(t) -> fn(x, y, cell, out): the position at time t of the plane point (x, y) (actual coordinates) of piece `cell`
  const flat = (x, y, cell, out) => { out[0] = x; out[1] = y; out[2] = 0; return out; };
  return {
    mesh,                                                     // the mesh to draw (the argument, unchanged)
    stops: [{ t: 0, label: 'flat' }, { t: 1, label: 'still flat' }],
    duration: 4,                                              // seconds for a full play 0 -> 1
    at(t) { return flat; },
  };
}
