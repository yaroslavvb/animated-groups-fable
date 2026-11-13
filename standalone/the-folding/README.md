# The Folding

Live: https://spacesheep.dev/@yaroslavvb/the-folding

Pick a wallpaper orbifold from the Hasse diagram (the chip at the top), try cuts on the 2D symmetry plane (drag, presets,
Wavy), press **Tile** to watch the tile replicate into the tiling by its own side pairings, press **Fold** and watch the tile close up into the orbifold: pillows and pouches for the rotation groups, torus,
tube, Möbius band and Klein bottle for the strip groups, a cross-cap for 22×, paper-snowflake folds for the four
kaleidoscopes. Glued edges share a colour; the whole state (group, pattern, cut, Wavy, fold, 3D view) is kept in the URL.
Companion of [The Unfolding](https://spacesheep.dev/@yaroslavvb/the-unfolding).

**Pattern** (the selector at the top right, 13 Nov 2026): the paper carries a print that the group leaves as it is — a
**Checkerboard** (the default: checks, or triangles and hexagons on the hexagonal lattices) or **Rings** round the cone
points — front teal, back sand, so the whole surface is covered and one sees which side is up; **Comma** is the
earlier picture, one comma on a translucent sheet. The two shapes that pass through themselves, the Klein bottle (××)
and the cross-cap (22×), fold **re-cut first**: a tile that is not the default cut is cut into pieces, each carried by
an element of the group into the default cut (the Rectangle, the Pocket), which then folds with no paper passing
through paper. The lab that tried the looks and motions for 22× is in `lab22x/`
([The Folding: 22× lab](https://spacesheep.dev/@yaroslavvb/the-folding-22x)).

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/` | ES modules: groups and kaleidoscopes, tiles (`domain.js`), meshes, the folds (`folds/`, with `recut.js`: re-cut first), the prints (`pattern.js`), plane view, WebGL renderer, picker, app |
| `test/` | node:test suite |
| `tools/` | `shot.mjs`, `filmstrip.mjs`, `qa-matrix.mjs` (headless Chrome), `motif-place.mjs` (comma placement table), `test-all.mjs` (runs the suite on a lab box or the mini), `browser.mjs` + `remote/` (Chrome pool on the mini) |
| `SPEC.md` | the design contract the build followed, round by round |
| `notes/`, `qa/*.md` | development log and the design decisions (Klein bottle, filling the orbifold, review triage) |
| `dev/` | demo pages used by the tools; `dev/recut/` the probes of the 13 Nov round (self-crossing of a motion, the prints found, a real-browser check) |
| `lab22x/` | the 22× lab: several looks and motions of the cross-cap side by side (its own page, `lab22x/dist/index.html` as deployed) |

Build: `node build.mjs` (bundles with `npx esbuild`). Tests: `node --test 'test/**/*.test.js'` (and `lab22x/test/*.test.js`). Comma table after any
change to group data or folds: `node tools/motif-place.mjs`. The browser tools expect Google Chrome and Playwright 1.62.1.

Before a change to the header, the legend or a hint ships, run the layout test in a real Chrome (it is opt-in, so the
plain suite skips it): `SHELL_LAYOUT=1 node --test test/shell-layout.test.js` — 23 window sizes x 17 groups, about
40 s. Then `node dev/recut/browser-check.mjs` and `node tools/qa-matrix.mjs --interact`.
