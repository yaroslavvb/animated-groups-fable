# FilmGroups for Mathematica

`FilmGroupsGuide.nb` — the 275 film groups (2+1-dimensional space-time
symmetry groups of looping, plane-tiling animations) as one interactive
animation, grouped by wallpaper group. A port of the
[atlas](https://yaroslavvb.github.io/animated-groups-fable), intended for
Wolfram Community.

The notebook is **self-contained**: it carries the catalog and the renderer
inside it, needs no package files and no network, and its `Manipulate` sets
`SaveDefinitions -> True` so the output keeps working for a reader who never
evaluates it. Open it and evaluate.

## Files

- `FilmGroupsGuide.nb` — the notebook. Generated; do not edit by hand.
- `guide-src.wl` — the renderer, embedded verbatim into the notebook by the
  builder. Edit this, not the notebook.
- `make-guide.wls` — the builder: reads `../docs/data/catalog.json`, emits the
  catalog, embeds `guide-src.wl`, writes the notebook.
  `wolframscript -f make-guide.wls`.

## Correctness

The renderer is a port of `docs/js/renderer.js` — same constants, same
arithmetic — with one convention change: the browser's canvas has y pointing
down, so here the pixel basis keeps y up, the motif outline is reflected once
at build time, and a canvas angle `a` is drawn at `-a`.

Checked against `../enumerate/gifs.py`, the Python reference for the same
renderer, on matched 480×480 frames: **best-shift alignment is exactly (0,0)**
— every copy lands at the same position and phase — with a residual mean
channel difference of 9–11/255 from anti-aliasing (Wolfram's rasterizer versus
PIL's 4× supersampling and a differently-drawn outline stroke).

The group data — the point matrices `M`, the fractional translations `v`, the
time offsets `τ` — is stored **exactly** (integer matrices, rationals): that is
what the classification is about. The lattice basis is stored at machine
precision, being a display modulus that `../enumerate/optimize_aspect.py`
chooses so the orbit is isotropic on screen.

## Legacy package

`FilmGroups.wl`, `FilmGroupsData.wl`, `build-data.wls` and `tests.wls` are the
earlier package form and are **stale**: they render the previous motif (a
filling vessel, since replaced by the comma with a phase ring), their catalog
predates the basis re-proportioning, and `build-data.wls` cannot regenerate it
(its `exactBasis` accepts only two hard-coded bases, while the catalog now
carries rotated and re-scaled ones). The notebook above does not use them.
