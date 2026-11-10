# The Folding

Live: https://spacesheep.dev/@yaroslavvb/the-folding

Pick a wallpaper orbifold from the Hasse diagram (the chip at the top), try cuts on the 2D symmetry plane (drag, presets,
Wavy), press **Tile** to watch the tile replicate into the tiling by its own side pairings, press **Fold** and watch the tile close up into the orbifold: pillows and pouches for the rotation groups, torus,
tube, Möbius band and Klein bottle for the strip groups, a cross-cap for 22×, paper-snowflake folds for the four
kaleidoscopes. Glued edges share a colour; the whole state (group, cut, Wavy, fold, 3D view) is kept in the URL.
Companion of [The Unfolding](https://spacesheep.dev/@yaroslavvb/the-unfolding).

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/` | ES modules: groups and kaleidoscopes, tiles (`domain.js`), meshes, the folds (`folds/`), plane view, WebGL renderer, picker, app |
| `test/` | node:test suite |
| `tools/` | `shot.mjs`, `filmstrip.mjs`, `qa-matrix.mjs` (headless Chrome), `motif-place.mjs` (comma placement table), `test-all.mjs` (runs the suite on a lab box or the mini), `browser.mjs` + `remote/` (Chrome pool on the mini) |
| `SPEC.md` | the design contract the build followed, round by round |
| `notes/`, `qa/*.md` | development log and the design decisions (Klein bottle, filling the orbifold, review triage) |
| `dev/` | demo pages used by the tools |

Build: `node build.mjs` (bundles with `npx esbuild`). Tests: `node --test 'test/**/*.test.js'`. Comma table after any
change to group data or folds: `node tools/motif-place.mjs`. The browser tools expect Google Chrome and Playwright 1.62.1.
