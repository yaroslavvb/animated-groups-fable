# Pattern designs — the round of 13 Nov 2026

The owner's ask: patterns "more like a comma but they fill more of the space", printed like the checkerboard (opaque
paper, teal front, sand back, two tones each). A pattern is a SHAPE PRINT: the dark tone is the union of g(motif) over
every element g of the group, so it is a pattern of the orbifold by construction.

## A design

`dev/patterns/designs/<key>/design.js`

```js
export const meta = { key: '<key>', label: '<at most 12 chars>', hint: '<one line>' };
export function find(group) { return { shapes: [{ pts: [[x, y], ...], hole: false }, ...], info: {} }; }
```

The rules are in the header of `dev/patterns/kit.js`; the production twin is `src/shapes.js` (`validateShapes`,
`measureShapes`). `designs/demo/` is today's comma as a shape print (the baseline), `designs/stress/` a hard case.

**The page refuses a motif that would be drawn wrong** (`src/shapes.js printable`, asked by `src/pattern.js printFor`;
the fixer, 13 Nov): copies that cross, touch or lie in each other, a polygon that touches itself or has no area, a hole
outside its polygon, a symmetry kept only roughly, more than 2400 vertices, copies nearer than 2 texels of the 3D
texture (0.003 tile sizes in o, 0.0073 in \*632). The group then shows the comma, one `console.warn` names the problem,
and app-sheet.mjs FAILS for it (the `CONSOLE WARN` line says why). GAP_MIN (0.02) stays the kit's rule for a finished
design: app-sheet.mjs prints it as `RULES`, the page still shows the print.

**Thin parts** (`src/shapes.js thinParts`): the 3D view prints a distance texture of 1024 texels a cell, which holds
nothing thinner than about 1.5 texels — a needle's tip is cut short or breaks into specks there, while the plane draws
it whole. app-sheet.mjs prints `THIN <id>` when a part of the motif is under 1.5 texels along more than 6 texels of its
outline (the page's comma: 26–57; bigcomma 11; paisley, glyph: none). A tip rounded to a radius of 1.5 texels keeps.

## Seeing it (Chrome runs on the mini: put `FOLDING_BROWSER=mini` in front; one browser tool at a time)

Run from `standalone/the-folding/`. Pictures go to `~/drive.unsynced/artifacts/the-folding-patterns/<key>/` (OUT below).

**Flat, with the numbers** (dark share, largest bare disc, largest solid disc, vertices, ms), drawn as the plane pane
draws a print:

```
FOLDING_BROWSER=mini node dev/patterns/proto.mjs --design designs/<key>/design.js --out OUT/<key>/sheet.png --json OUT/<key>/rows.json
   [--ids '333,*x,*632'] [--px 520 --cols 3]   a closer look        [--zoom 1.8]   the tile itself
   [--side back]                               the sand side        [--measure 0]  faster, no numbers
```

**In the real app** (the plane on the left, the fold in 3D on the right; about 15–20 s for all 17 groups):

```
FOLDING_BROWSER=mini node dev/patterns/app-sheet.mjs --design designs/<key>/design.js --t 0.6 --out OUT/<key>/app-t06.png
   --t 0 | 0.6 | 1                  flat, half folded, closed
   --ids 'o,*x,22x'                 some groups (quote ids with * in the shell)
   --phone                          a 390 x 780 window (the panes stack)
   --preset 1 | 2                   another cut: with --ids 'xx,22x' --t 0.25 a re-cut is under way
   --tile 0.5                       the Tile step half way (the cards carry the print)
   --view az/el/zoom                the 3D view in degrees (el < 0 looks at the back of a flat sheet)
   --dpr 2                          a retina screen          --clip fold | plane | stage   shoot one part
   --json <file>                    what was seen per group (the print, errors, validateShapes problems)
   --pat <key> --designs a,b        another pattern: a built-in one (paisley, soft, tomoe, checker, rings, comma) or registered designs
```

It fails loudly (exit code 1) when the pattern did not take (find threw, or the motif breaks a rule the page refuses)
or the page had errors; `RULES` and `THIN` lines are for the designer, not failures.

The standard set of a finished design, in OUT/<key>/:

| file | command (add `--design designs/<key>/design.js --out OUT/<key>/<file>`) |
|---|---|
| `sheet.png`, `rows.json` | proto.mjs `--json OUT/<key>/rows.json` |
| `zoom.png` | proto.mjs `--zoom 1.8` |
| `back.png` | proto.mjs `--side back --zoom 1.8` |
| `app-t0.png`, `app-t06.png`, `app-t1.png` | app-sheet.mjs `--t 0` / `--t 0.6` / `--t 1` |
| `app-back.png` | app-sheet.mjs `--t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1` (or any view that shows the sand side) |
| `app-phone.png` | app-sheet.mjs `--phone --t 0.6 --ids 'o,*x,22x,333,*632'` |
| `app-recut.png` | app-sheet.mjs `--ids 'xx,22x' --preset 1 --t 0.25` |
| `app-tile.png` | app-sheet.mjs `--ids '2222,*442,333' --tile 0.5` |

Interactively: serve the folder and open `dev/patterns/app.html?design=designs/<key>/design.js#g=333&pat=dev`.

## Tests

`bash dev/patterns/suite.sh [files]` runs the suite on the mini on a copy of the workspace as it is now (no argument: all
of `test/` and `lab22x/test/`, about a minute).

## The foundation

`notes/patterns-foundation.md`: what the shape prints are made of (`src/shapes.js`, `src/sdf.js`, the renderer's mode 3,
the glue in `src/pattern.js` and `src/app.js`, the plane's cached layers), their contracts, the measured costs, and what
is not done.
