# Classification of Surfaces

Live: https://spacesheep.dev/@yaroslavvb/classification-of-surfaces (anyone with the link) ·
tailnet: http://intel/reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html

Made Sun 15 Nov 2026 (week 46) on the Intel, at his ask: *"read … The Symmetries of Things, Chapter 8 and come up
with a way to understand classification of surfaces by interactively allowing me to construct/deconstruct these kinds
of surfaces. Reuse 3d visualization code from https://spacesheep.dev/@yaroslavvb/the-folding . Create a page called
'Classification of Surfaces' which walks me through the examples in the book by also adding interactive elements"*.

Chapter 8 (printed pp. 93–106) of Conway, Burgiel & Goodman-Strauss, *The Symmetries of Things*, as one 3D stage with
four tabs, in the book's order:

| tab | pages | what you do |
|---|---|---|
| 1 Zippers | 93–95 | one hole or two, arrows opposite or the same: scrub a cap, a crosscap, a handle, a cross-handle shut |
| 2 Tidy surfaces | 96, 101–103 | add holes, handles, crosscaps, cross-handles to a sphere; a hole walks through a crosscap (Fig. 8.11); the trade ⊗ = ××; χ, boundaries, sides |
| 3 Zip it up | 96–100, Fig. 8.1–8.10 | the Tidying Lemma by hand: tap an arrow, the pair is zipped, what you hold is tidy again |
| 4 Examples | 104–106 | the book's seven surfaces; count a map, the boundaries, the sides; the symbol follows |

The way in: every surface is polygons and zippers; zipping one pair at a time keeps it a sphere with holes, handles,
crosscaps and cross-handles; two trades remove the cross-handles and the mixed case. Tab 3 lets you do that to the
book's own strange surface (p. 104) from its five pieces and watch it become ○∗∗.

## Files

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/vendor/the-folding/` | The Folding's `render3d.js`, `palette.js`, `timeline.js`, unchanged (animated-groups-fable `0a82435`) |
| `src/geo/` | the surface kit: sites and their charts, cells with holes, tubes, the crosscap collar, the flat patch, the twelve-site ball |
| `src/zipper/` | tab 3: `engine.js` (the lemma's bookkeeping, pure), `view.js` (how a state is drawn), `parts.js` and `moves.js` (the motion of each zip) |
| `src/examples/` | tab 4: the seven surfaces as cell complexes, their counts computed, the pinwheel |
| `src/tabs/` | one module per tab; `src/app.js` the shell; `src/index.template.html` all the static words |
| `src/formulas.mjs` | the LaTeX the page composes while it runs; MathJax typesets everything at build time |
| `test/` | `node --test`: the engine against an independent count (400 random gluings), the seven examples against the book |
| `tools/check_quotes.mjs` | every book citation quotes words that are on that page (needs the PDF and `pdftotext`) |

Build: `node build.mjs` (esbuild through `npx`; MathJax from `~/.cache/mathjax-full-3.2.2`, `npm i mathjax-full@3.2.2`
there). `--hide prove,name` leaves a tab's button out, `--out dist/x.html` writes another file.
Tests: `node --test`. Quotes: `node tools/check_quotes.mjs`.
Screenshots: `node ~/git/animated-groups-fable/standalone/the-folding/tools/shot.mjs --root "$PWD" --page dist/index.html --steps steps.json`
(`window.__surfaces = { show(tab, state), tabs, stage }`; `tabs.prove.dry(id)` runs every phase of a zip at once).
Publish: `~/git0/flush-util/sheep publish reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html --as-rendered --name '…'`.

## How the 3D is built

A body is cut into cells, one round each site: the flat patch of tab 1 has one or two, the ball has the twelve
pentagons of a dodecahedron. A cell is a polar grid from its hole's rim to its outline; what a zipper makes is a
separate patch welded to that rim (`src/geo/scene.js`). A zip is drawn by moving vertices, never by changing the mesh:
the purse closes a hole, a tube half grows along a Bezier arc, the crosscap's collar rises onto its crossing segment.
The renderer paints the two sides of the paper teal and sand by triangle winding, so where a one-sided surface is
zipped, teal meets sand along the seam. That is the book's "front against back", for free.

Tab 3's pictures are honest where the book's are: gaping zips leave eyelets (Fig. 8.6, 8.8, 8.9), a gaping crosscap is
a half-twisted strap across the hole (a punched Möbius band, Fig. 8.7). After each zip the picture is redrawn tidy;
that step is a cut, not a motion ("we can just push the holes around", p. 96).

## What is not there

- A join that involves a ball (not two polygons) changes the picture without motion: the two arrows stand out, then the
  picture is redrawn.
- After a zip that leaves rim over, the tidy redraw is a cut: an eyelet becomes a hole at a site of its own in one step.
- The chapter's frontispiece surface (p. 92) is not classified in the book and is not on the page.
- The scan of the book is on the tailnet only, so the page-number links open for him and for nobody else.

## Checked

- `node --test`: 58 tests. The zipping's bookkeeping against an independent count of the glued surface (400 random
  gluings, three zip orders each); the seven examples' counts against the book's table.
- Every zip of every preset and of 40 random deals, in three orders, stepped through all its phases in a browser: no error.
- `node tools/check_quotes.mjs`: 33 citations, each at most 15 words and on its page.
- Looked at in headless Chrome at 1280 and 390 px wide, light and dark, with reduced motion; a real tap on an arrow,
  the chips, Unzip, and the deep links (`#zip&kind=handle`, `#tidy&k=oox*`, `#prove&k=fig810`, `#name&k=klein`).
  And in WebKit (Safari's engine) on the M5, at 390 and 1280 px: no error, no sideways scroll, the same layout as Chrome.
  Not tried on a real phone.
- A reader who had not written the page went through it from screenshots and the chapter's text: no wrong count,
  symbol or citation; fourteen findings on wording and on the links between the tabs, the wording ones applied
  (which way the arrows run is now always said "round the rim"; the trade of a cross-handle for two crosscaps links
  to Figure 8.10 in tab 3; the pinwheel is explained; the symbol is worked out from the three numbers).
