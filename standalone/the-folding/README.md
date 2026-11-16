# The Folding

Live: https://spacesheep.dev/@yaroslavvb/the-folding

Pick a wallpaper orbifold from the Hasse diagram (the chip at the top), try cuts on the 2D symmetry plane (drag, presets,
Wavy), and press **Fold**: the pattern gathers onto one tile, and the tile's edges zip up into the orbifold. Pillows and
pouches for the rotation groups, torus, tube, Möbius band and Klein bottle for the strip groups, a cross-cap for 22×.
Zipped edges share a colour; the whole state (group, pattern, cut, Wavy, fold, 3D view) is kept in the URL.
Companion of [The Unfolding](https://spacesheep.dev/@yaroslavvb/the-unfolding) and of
[Classification of Surfaces](https://spacesheep.dev/@yaroslavvb/classification-of-surfaces).

**One journey** (15 Nov 2026, `notes/unify.md`, SPEC 12): a single scrubber runs **surface — tile — pattern**, with
**Fold** at its left and one button at its right that reads **Unfold** and then **Tile**. What is folded is the tile
alone; its copies are the pattern, and the 3D pane lays them out by rigid motions (a mirror's copy turns over under the
paper). A tile that is not flat has no copies. The four kaleidoscopes (∗2222, ∗442, ∗333, ∗632) have no zipper, so
their tile is their surface, a disk: their Fold is the gathering of the pattern, which is the tiling run backwards. The
page names each orbifold as Conway's chapter 8 does (a punched sphere, a sphere with a handle, a punched crosscap, a
pair of crosscaps), with no crystallographic names, and each caption links into the matching part of the
Classification of Surfaces page.

**Pattern** (the selector at the top right): the paper carries a print that the group leaves as it is, front teal and
back sand, two tones each, so the whole surface is covered and one sees which side is up. Since 14 Nov 2026 (the pattern
round, `notes/patterns-round.md`) there are six: **Paisley** (the default: a big comma and smaller ones nestled round
it), **Soft commas** (one big soft comma with an eye per tile, half the paper dark), **Tomoe** (every tile split by an S
into a dark and a light comma), the **Checkerboard** (checks, or triangles and hexagons on the hexagonal lattices),
**Rings** round the cone points, and the **Comma**, the page's own comma, now on the same paper. The first three and the
comma are shape prints (`src/shapes.js`, the motifs in `src/patterns/`): the union of every copy of a motif under the
group. While the page is idle it makes the current pattern's prints of the other groups, so a group change does not wait
for them. Every browser shows the same patterns: Paisley's page groups draw a table of the marks its search grew, since
the search itself follows the last bit of the browser's Math (`test/patterns-engines.test.js`). The two shapes that pass through themselves, the Klein bottle (××)
and the cross-cap (22×), fold **re-cut first**: a tile that is not the default cut is cut into pieces, each carried by
an element of the group into the default cut (the Rectangle, the Pocket), which then folds with no paper passing
through paper. The lab that tried the looks and motions for 22× is in `lab22x/`
([The Folding: 22× lab](https://spacesheep.dev/@yaroslavvb/the-folding-22x)).

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/` | ES modules: groups and kaleidoscopes, tiles (`domain.js`), meshes, the folds (`folds/`, with `recut.js`: re-cut first), the journey (`journey.js`) and the copies in the 3D pane (`tiling3d.js`), the prints (`pattern.js`; shape prints `shapes.js`, `sdf.js`; the shipped motifs and their idle making `patterns/`), plane view, WebGL renderer, picker, app |
| `test/` | node:test suite |
| `tools/` | `shot.mjs`, `filmstrip.mjs`, `qa-matrix.mjs` (headless Chrome), `motif-place.mjs` (comma placement table), `test-all.mjs` (runs the suite on a lab box or the mini), `browser.mjs` + `remote/` (Chrome pool on the mini) |
| `SPEC.md` | the design contract the build followed, round by round |
| `notes/`, `qa/*.md` | development log and the design decisions (Klein bottle: `notes/bottle.md` for the classic bottle of 14 Nov 2026; filling the orbifold; review triage) |
| `dev/` | demo pages used by the tools; `dev/recut/` the probes of the 13 Nov round (self-crossing of a motion, the prints found, a real-browser check); `dev/patterns/` the pattern round's designs, kit and tools (`README.md`); `dev/turntable/` the 3D view's turntable in Chrome and WebKit; `dev/unify/` the journey's film, its transport check and the live check of 15 Nov |
| `lab22x/` | the 22× lab: several looks and motions of the cross-cap side by side (its own page, `lab22x/dist/index.html` as deployed) |

Build: `node build.mjs` (bundles with `npx esbuild`). Tests: `node --test 'test/**/*.test.js'` (and `lab22x/test/*.test.js`). Comma table after any
change to group data or folds: `node tools/motif-place.mjs`. The browser tools expect Google Chrome and Playwright 1.62.1.

Before a change to the header, the legend or a hint ships, run the layout test in a real Chrome (it is opt-in, so the
plain suite skips it): `SHELL_LAYOUT=1 node --test test/shell-layout.test.js` — 23 window sizes x 17 groups x the six
patterns, about four minutes (`SHELL_LAYOUT_PAGE=dist/index.html` for the built page) — and the same checks in Safari's
engine on the built page: `bash dev/recut/webkit-layout.sh` (WebKit on the M5).
Then `node dev/recut/browser-check.mjs`, `node dev/unify/transport-check.mjs` and `node tools/qa-matrix.mjs --interact`;
after a deploy, `node dev/unify/live-check.mjs` on the real viewer.
