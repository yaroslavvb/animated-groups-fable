# FilmGroups for Mathematica

`FilmGroupsGuide.nb` — the 275 film groups (2+1-dimensional space-time
symmetry groups of looping, plane-tiling animations) as one interactive
animation, grouped by wallpaper group. A port of the
[atlas](https://yaroslavvb.github.io/animated-groups-fable), intended for
Wolfram Community.

The notebook is **self-contained**: it carries the catalog and the renderer
inside it, and needs no package files and no network.

It has exactly two cells you can evaluate. The first is an **initialization
cell** holding everything — catalog, renderer, tab helpers — and the notebook
sets `InitializationCellEvaluation -> True`, so the front end runs it when the
notebook is opened (about 0.05 s). The second is the `Manipulate`. Running
that one cell is all a reader has to do. If the front end ever skips the
automatic run, the viewer fails on the undefined `$WP` with
`Manipulate::vstype` — the notebook deliberately keeps the
initialization-cell prompt enabled rather than failing silently, and
*Evaluation ▸ Evaluate Initialization Cells* fixes it.

The `Manipulate` sets `SaveDefinitions -> True`, so its stored output keeps
animating for a reader on Wolfram Community who never evaluates anything.
Everything the body touches is therefore a definition rather than something
computed in an `Initialization` option: `SaveDefinitions` walks the body and
does **not** look inside `Initialization`, so a symbol reached only from there
is missing from the stored output and the viewer arrives dead.

## Files

- `FilmGroupsGuide.nb` — the notebook. Generated; do not edit by hand.
- `guide-src.wl` — the renderer, embedded verbatim into the notebook by the
  builder. Edit this, not the notebook.
- `make-guide.wls` — the builder: reads `../docs/data/catalog.json`, emits the
  catalog, embeds `guide-src.wl`, writes the notebook.
  `wolframscript -f make-guide.wls`.

## Correctness

Three paths are checked, in a fresh kernel each time:

- **warm** — evaluate the initialization cell, then the `Manipulate` cell.
  The init cell alone defines all 275 groups, the 17 tab rows and the
  renderer, in 0.05 s.
- **cold** — a kernel that has never seen the notebook, given only the
  `Manipulate`'s stored output. The 2.1 MB of definitions `SaveDefinitions`
  tucked inside it restore the renderer and the catalog, every tab row still
  resolves, and frames draw. This is the Community reader.
- **front end** — a real front end, cursor in the `Manipulate` cell.
  *Evaluate Initialization* then evaluating that cell gives a live viewer with
  no messages; evaluating it alone gives `Manipulate::vstype`, which is what
  the retained prompt is there to prevent. A headless front end does no
  open-time evaluation at all, so `InitializationCellEvaluation` itself can
  only be confirmed in the GUI.

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
