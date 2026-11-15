# Mosaic — the critique (run 3, 13 Nov 2026, a fresh pair of eyes)

What was judged: `design.js` as delivered at 23:16 (run 2), rendered fresh at 23:20–23:45. The pictures are in
`~/drive.unsynced/artifacts/the-folding-patterns/mosaic/critique/`:

- the flat sheet: `sheet.png`, `rows.json`;
- closer looks: `zoomA.png`, `zoomB.png`, `zoomC.png` (520 px, zoom 1.8) and `zoom3-weak.png` (zoom 3);
- the sand side: `back.png`;
- the app: `app-t06.png`, `app-t0-weak.png`, `fold06-A.png`, `fold1-all.png`, `fold1-big.png` (1100 x 700),
  `app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`;
- the checkerboard for comparison: `checker-fold1.png`.

The numbers come from `r3/shares.mjs` and from the designer's `check.mjs`.

## What it is

The dark tiles are the Voronoi cells of the default cut's seed, which means they are the page's default tiles. Each
tile has a light comma inlaid, with the comma's tail fused into the light grout.

| part of the plane | share |
|---|---|
| dark frame | 0.53–0.58 |
| light comma | 0.27–0.35 |
| light grout | 0.10–0.16 |

## What is good

- **The symmetry is exactly the group in all 17.**
  - Every dark piece is one copy of an asymmetric tile-with-a-bite. `check.mjs` gives a self-overlap of at most
    0.72 under any turn or mirror, and the stabilizer is 1.
  - No extra mirror, half-turn or half-translation appears anywhere.
- **No hard rule is broken.**
  - Gap 0.055 everywhere; nothing thinner than 0.04 (the opening test takes nothing away).
  - At most 756 vertices; at most 12 ms in the browser.
  - The motif lies wholly in the default tile in every group.
- **Flat, it is the boldest and calmest of the round.**
  - Each comma is one big clean shape. In o, 2222, \*\*, xx, 22x, \*2222, 442, \*333, 4\*2 and \*442, the direction
    and the hand read at a glance, and mirrored or glided tiles visibly curl the other way.
  - It reads on the sand side (`back.png`).
  - The re-cut and the Tile step carry it in register (`app-recut.png`, `app-tile.png`).

## Findings, ranked by how much they would bother the owner

1. **In the fold, it says about as much as today's Comma.**
   - The light comma covers 0.27–0.35 of the plane; today's Comma covers 0.30. The "filling" is a flat dark frame
     (0.53–0.58) and grout. The dark share and the bare-disc number pass because the frame counts as dark, not
     because more of the surface carries marks.
   - On a closed shape the one comma per tile is stretched over the whole surface and becomes a pale blob. The
     torus, the 2222 pillow, 333, 632 and 442 at t = 1 (`fold1-big.png`) show light sand patches. Nobody would
     recognise them as a comma.
   - The flat frame shows nothing of how the paper bends. The checkerboard shows it everywhere (`checker-fold1.png`).
   - The owner's likely words: "it is the comma, inverted, with the background coloured in". This is built into "one
     cell per orbit point", so it can be softened, not removed.
2. **The grout lies on the seams, and in the fold the seams are its loudest feature.**
   - The cells are the default tiles, so the grout runs along every seam of the default cut and every mirror. In the
     plane, a light band doubles each edge of the tiling the page already draws.
   - Folded, every seam is a light band under the coloured seam line. The 2222 pillow shows a light "X" along its
     four seams, louder than its comma; the torus shows two light rings.
   - No mark crosses a seam in the default cut, so the fold never shows a mark joining up. Only a re-cut, Wavy or a
     dragged seed does.
   - At 0.055 the grout is wider than the 0.04 the rules ask of a channel.
3. **\*x, the owner's own example, is stripes.**
   - The strip is 5.3 : 1. The comma is a round head of 0.13 with a wedge of a tail, 2 tile sizes long, rising 0.1
     over its whole length between dark rims 0.065 thick.
   - Flat, it reads as horizontal bands with thin wedges.
   - On the Möbius band it is one light stripe along the band (`fold06-A.png`, `fold1-all.png`). No hand is visible,
     so the band's flip, which is the point of a Möbius band, cannot be seen.
4. **22\* and 2\*22 are bananas.**
   - The tiles are 3.3 : 1 and 2.7 : 1, the heads 0.18, the marks 1.4–1.6 long. They read as eyebrows or lying
     teardrops, not commas.
   - Under each comma a long dark wedge tapers to a point.
   - In 2\*22 the tail leaves a narrow dark finger in the bottom-right corner; in 22\* the tail runs into a corner.
5. **Twelve-spoke stars at the 6-fold centres of 632, 3\*3 and \*632.**
   - Twelve 30-degree corners meet there, so the grout ends in a white star about 0.4 across.
   - In 632 the grout web (triangles 3.5 : 1) is the loudest thing on the plane. Its small curled commas (0.85 long)
     sit in the middle of long triangles.
6. **The closed shapes mostly show the sand side** in their default views (2222, 333, 442, 632, 3\*3, 22\*, 2\*22,
   the kaleidoscopes). The light-on-dark-sand comma is weaker there. The colours are fixed, so only bolder marks help.
7. **It is a family of commas, not one comma.**
   - The shapes differ by group: a "9" in tall tiles, curls in compact ones, J's in long ones, a tadpole in \*x.
   - Head radii run from 0.13 to 0.22, and the commas were placed by hand per group (a table of 17 rows).
   - It looks consistent at sheet size and less so side by side at zoom.
8. **The comma is a bay of the grout network.**
   - Its tail fuses into the grout at a T, so the light tone is one connected web.
   - Where the web is dense (632, \*632, 3\*3 on a phone), the commas read as drops hanging off a net, not as marks.
9. **It is fragile against data changes.**
   - The table repeats the presets' seeds in the group's frame. If a seed changes, the tiles stop coinciding with the
     default tile (the print stays valid).
   - The fallback for an unknown id is darker than the targets (0.60–0.81).

## What I will try (step 2), in this order

- A narrower grout: 0.044 instead of 0.055 (findings 2, 5). This quiets the seams and shrinks the stars.
- Smaller rounding at the acute corners (finding 5).
- A real comma in \*x, with a curled, visible hand (finding 3).
- Real commas in 22\* and 2\*22 (finding 4).
- Then re-judge findings 1 and 7, which are about the idea itself, on the pictures.

## After step 2: where each finding stands

The details are in `NOTES.md`, "After the critique" and "In the fold". The run-2 design is kept as `design.v1.js`.

| # | finding | status |
|---|---|---|
| 1 | in the fold, about as much as today's Comma | **softened, not fixed.** The comma now covers 0.29–0.38 (was 0.27–0.35) and is a whole mark. Closed, the band, the kaleidoscopes, 22\*, 2\*22, \*\* and 22x show it. The torus, the Klein bottle, the 2222 pillow, 333, 442 and 632 still show a pale stretched blob. It is built into "one cell per orbit point". |
| 2 | grout on the seams | **quieter.** The grout is 0.044, down from 0.055. It still runs on every seam of the default cut. |
| 3 | \*x is stripes | **fixed.** Two commas per strip, their tails curling late. The hand shows in the plane and on the closed band. |
| 4 | 22\* and 2\*22 are bananas | **fixed.** Floating, the designer's arcs are clean lying commas with a fine tip; the wedge and the finger are gone. |
| 5 | stars at the 6-fold centres | **smaller.** About 0.31 across, down from 0.41, with thinner spokes. Still the busiest place. |
| 6 | the sand side in the 3D views | **unchanged.** The colours are fixed. |
| 7 | a family, not one comma | **more uniform.** Every comma is now the same kind of mark, floating with a fine tip. The table of 17 hand-placed commas stays. |
| 8 | the comma is a bay of the grout | **fixed.** The commas float, which was the largest single gain. |
| 9 | fragile against data changes | **unchanged.** The fallback stays valid. |

Nothing got worse on the numbers:

- dark 0.496–0.597 (was 0.524–0.581);
- bare at most 0.434 (was 0.429);
- solid at most 0.496 (unchanged);
- 503–778 vertices;
- at most 22 ms;
- gap 0.044, with no thin feature anywhere.

All validators pass.
