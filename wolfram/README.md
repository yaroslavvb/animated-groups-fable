# FilmGroups for Mathematica

`FilmGroupsGuide.nb` — the film groups (2+1-dimensional space-time symmetry
groups of looping, plane-tiling animations) as seventeen interactive
animations, one per wallpaper group. A port of the
[atlas](https://yaroslavvb.github.io/animated-groups-fable), intended for
Wolfram Community.

The notebook is **self-contained**: it carries the catalog and the renderer
inside it, and needs no package files and no network.

Each of the seventeen sections is a `Manipulate` with a tab row over every
film group whose spatial projection is that wallpaper — **258 of the 275**.
The 17 left out are the trivial clocks, one per wallpaper: the film group
whose symbol is just the wallpaper's own orbifold name, a spatial group
carrying a time coordinate it does nothing with. Tabs are green for a group
that only moves forward in time and grey for one with a time reversal, and
wrap at **eight to a row** (`p4m` needs five rows for its 34). The clock
starts **stopped**, with a progress slider to scrub by hand.

## Evaluating it

One **initialization cell** holds everything — catalog, renderer, tab helpers
— and the notebook sets `InitializationCellEvaluation -> True`, so the front
end runs it when the notebook is opened, in about 0.05 s. After that,
evaluating any section on its own gives that section's animation.

If the front end ever skips the automatic run, a section fails with
`Manipulate::vstype`. The notebook deliberately keeps the initialization-cell
prompt enabled rather than failing silently, and *Evaluation ▸ Evaluate
Initialization Cells* fixes it.

## Staying small

Every `Manipulate` sets `SaveDefinitions -> True`, so its stored output keeps
working for a reader on Wolfram Community who never evaluates anything. Two
consequences shape the code, and both are load-bearing:

- `SaveDefinitions` walks the **body** and does not look inside an
  `Initialization` option, so anything reached only from there is missing from
  the stored output and the viewer arrives dead. Everything a body touches is
  therefore an ordinary definition. There are no `Initialization` options.
- `SaveDefinitions` saves **whole symbols**. A single shared `$FG` would
  therefore put all 275 groups into all 17 stored outputs — a 4.1 MB notebook
  to say what fits in 1.2 MB. So the catalog goes in as seventeen
  associations, `FG$p1` … `FG$p6m`, each section mentions only its own, and
  nothing a viewer touches may reach `$FG`. That is also why the renderer
  takes a group's Association rather than looking it up by name: use
  `FilmGroupFrame[FilmGroup["g248"], 0.3]` to draw one by hand.

## Files

- `FilmGroupsGuide.nb` — the notebook. Generated; do not edit by hand.
- `guide-src.wl` — the renderer, embedded verbatim into the notebook by the
  builder. Edit this, not the notebook.
- `make-guide.wls` — the builder: reads `../docs/data/catalog.json`, emits the
  catalog, embeds `guide-src.wl`, writes the notebook.
  `wolframscript -f make-guide.wls`.

## Correctness

Three paths are checked, in a fresh kernel each time:

- **warm** — evaluate the initialization cell, then a section. The init cell
  alone defines all 275 groups, the 17 tab rows and the renderer, in 0.05 s.
- **cold** — a kernel that has never seen the notebook, given only one
  section's stored output. Releasing `p6m`'s saved definitions defines
  `FG$p6m` **and no other catalog** — not `$FG`, not the other sixteen — and
  the section still draws, tabs and all. This is the Community reader, and it
  is also the check that the per-wallpaper split holds.
- **front end** — a real front end evaluating the whole notebook: 17 outputs,
  **0 messages**, every one a `DynamicModule` carrying its own definitions;
  193 KB shipped, 1.24 MB once evaluated, per-output size tracking each
  wallpaper's group count (30 KB for `p1`'s 4, 67 KB for `p4m`'s 34).
  Evaluating a section without the initialization gives `Manipulate::vstype`,
  which is what the retained prompt is there to prevent. A headless front end
  does no open-time evaluation at all, so `InitializationCellEvaluation`
  itself can only be confirmed in the GUI.

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
