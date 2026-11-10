# Fill competition: the judge's decision

Tue 10 Nov 2026, about 00:50. The owner's ask (9 Nov): "find a way to occupy more space on the Orbifold … there should be
less empty space", then "I meant for all the examples."

## No prototype was built, so the judge ran the experiment

None of the three designers got past setting up. Every agent in the workspace stopped writing at 23:29, probably on a
usage limit.

| Designer | Concept | What exists |
|---|---|---|
| A | "glyph field": several glyphs per tile | `dev/fill-a/src` is byte-identical to `dev/klein-a/src`. No pictures. |
| B | "symmetric field": a G-invariant field over the surface | Same: an untouched copy. No pictures. |
| C | "big figure": one glyph per tile, much larger | Same, plus a 10-line `dump-groups.mjs`. No pictures. |

I checked this with `diff -rq dev/klein-a/src dev/fill-<k>/src` (no output for any of the three) and with the notes,
which stop at their setup line.

To have something to judge, I built the cheapest version of concept C, plus its variants, in `dev/fill-judge/`. It is a
copy of `dev/klein-a/src`, with hash knobs for the experiments. Nothing under `src/`, `test/`, `tools/` or `dist/` was
touched. A and B are judged on principle below, not on pictures.

## Decision: concept C, one big comma per tile, filled in 3D

1. **Size.** Each group's comma covers **30 % of its tile**. Today it covers 1 to 6 %. The exceptions are the strip
   tiles: o 29 %, ** 28 %, \*x 21 % and xx 20 %.
2. **Placement.** The placement comes from a search for each group:
   - every copy stays at least 0.07 sqrt(area) away from the comma, measured outline to outline;
   - the radius is at most 0.34 viewHalf;
   - among the placements that reach 30 %, the search takes the one lying most inside the default tile. For 13 groups
     the default tile holds the whole comma (98 to 100 %).
3. **Fill.** The comma is filled in 3D for **all 17 groups**, in a deep teal (0.33, 0.55, 0.55), the surface's own hue.
   Its outline stays.
4. **Kaleidoscopes.** They keep their grey star. The renderer's tint becomes two bits: ghost and fill.
5. **Plane.** The plane commas are drawn lighter: alpha 0.40 over white, down from 0.54.
6. **xx.** The comma keeps the Klein story but becomes two lobes wide. It straddles the glide seam, centred on the
   tile's middle glide axis, at 2.6 x the old width and 1.4 x stretched along the axis.
7. **\*x.** The comma is stretched 2 x along its strip. No other group is stretched.

Pictures (all in `qa/fill-judge/`):

| What | Before | After |
|---|---|---|
| t = 1, laptop, 17 groups | `base-laptop-fold1.png` | `final3-laptop-fold1.png` |
| t = 1, phone | `qa/matrix/*-390-1.png` | `final3-phone-fold1.png` |
| plane, phone | `qa/matrix/*-390-0.png` | `final3-phone-plane0.png` |
| plane, laptop | `base-laptop-plane0.png` | `final3-laptop-plane0.png` |
| motion | | `film-333.png`, `film-22x.png`, `film-s442.png`, `film-o.png`, `film-442-p2-wavy.png`, `xx-film-wide.png` |

## Why

**The owner's question: is every folded orbifold now occupied?** Yes. In `final3-*-fold1` every one of the 17 shapes
carries a large teal comma. The xx band and the 2\*22 comma, which in the default view sits mostly on the far face, are
the weakest. Today every shape is a blank shell with a thin outline.

**One comma is also the honest picture.** The orbifold is the plane divided by the group, so it carries exactly one copy
of the motif. A big comma fills the orbifold without adding any concept, any orbit or any colour meaning.

**The symmetry type still reads at a glance.**
- Each comma keeps its hand.
- Around every rotation centre the commas form a pinwheel (333, 442, 632, 3\*3, 4\*2). This makes the centres easier to
  see than today.
- Mirror pairs face each other across the ink lines.
- Glides alternate the hand.
- The gap rule keeps the commas from fusing into yin-yang discs, which is what killed the maximum packing.
- With alpha 0.40, the mirrors, dashed glide axes and centre glyphs stay on top.

**The bold edges still read through the surface.** Seams and rims are drawn over the fill exactly as before. The teal
fill is the surface's own hue, so the coloured seams keep their contrast, and front and back overlaps stay clean. The
grey fill turned muddy at this size (`fc62-*`, `t35-*`).

**The motion stays smooth.** The fill is part of the sheet, so nothing changes colour in time (`film-*`).
- The kaleidoscope flaps carry their filled commas onto the copy beneath, which coincides with them.
- The seams still close: the gap is 1e-16 to 1e-8 tile sizes.
- When the cut is dragged with the shape folded, the comma stays put on the orbifold while the seams slide. The pattern
  is fixed, and at t = 1 the hinge and cross-cap shapes depend only on the anchor.

**The xx story survives** (`xx-film-wide.png`):
- At t = 0 the tile holds the head half across the top edge, and the glide-mirrored other half across the bottom edge.
- From t of about 0.8 to 0.9 the two halves ride at the two open ends.
- At t = 1 they are one comma, wrapped round the bottle's lower left; on the phone the curl shows at the bottom right.
- Coverage goes from 2 % to 20 %.

**What it costs:**
- About 4 to 6 source files.
- The rebuild takes 0 to 4 ms more (node, median of 7, final settings). The worst is o, at 7.7 ms against 3.6, spent in
  `motifTintMesh`'s point-in-outline tests; a bounding-box grid would cut it. A drag step stays well inside a frame.
- At most 12,220 triangles (xx), under the renderer's 20k.
- No new control, text or hash key, and no change to coordinates, so URLs stay valid.
- Three motif tests encode the old small-glyph contract and must be rewritten to the new one, by the owner's ask.

## Rejected

- **A, glyph field (not built).**
  - k glyphs per tile means k orbits, so the orbifold carries k commas and the plane k times as many.
  - That is busier, and it risks false symmetry unless the glyphs differ.
  - Several fills on translucent front and back layers clutter.
  - It drops "one tile = one comma", and C already reaches about 30 % with one comma.
- **B, symmetric field (not built).**
  - Full coverage on a translucent closed surface shows the back of the field through the front: a double image that
    fights the bold edges.
  - Handedness and glides read worse in a smooth field than in commas.
  - It needs a continuous colour channel and per-pixel plane drawing, the largest change of the three.
- **C at maximum packing (45 to 69 %).** The commas lock into yin-yang discs, so 22x lost its handedness, and the
  kaleidoscope planes turn to clutter (`big85-*`, `t35-*`).
- **Grey 3D fill.** It is heavy and muddy where front and back overlap (`t35-laptop-fold1`, `fc62-laptop-fold1`).
- **Stretching o and \*\*.** The commas look like claws and whales (`t25teal-phone-plane0`).
- **xx in one lobe (the klein-judge rule).** Only 10 %, the emptiest shape of all (`xx-film-seam16.png`, `xxseam-*`).
- **xx with the largest comma and no seam rule.** It covers 30 %, but the comma is cut into four corner pieces and the
  tile's middle is empty (`xx-film-table30.png`, `xxtable-*`).

## Known weak spots (accepted)

- **xx.** The joined comma wraps both lobes and reads as a band with a curl, not as a crisp comma. The joining is told by
  the closing frames. The right side of the ring stays bare, because it is the tile's middle.
- **o, \*\*.** The comma wraps the tube partly. It reads as a broad swirl.
- **2\*22, 2222.** In the default view much of the comma lies on the far face, seen lighter through the near one.
- **Kaleidoscope planes on a phone** (\*632, \*442) are still dense: big commas, ink mirrors and dashed glides. Alpha
  0.40 makes them readable, not quiet.
- **The table.** The placement is generated offline from the group data. A test must catch a stale table.

## Port plan, owners, acceptance

The plan is the same as in the structured answer returned to the orchestrator. Port the mechanisms, not the folder:

| Files | Owner (SPEC 8) | What |
|---|---|---|
| new `tools/motif-place.mjs`, new `src/groupdata/motif.js` | motif / Klein work | the placement search (`dev/fill-judge/tools/bigcomma.mjs`) and its generated table |
| `src/motif.js` | motif / Klein work | `motifFor` from the table at 30 %, the wide xx seam comma, `motifTintMesh` (outline copies, triangle's piece, two-bit tint) |
| `src/render3d.js` | renderer | tint bit 1 = fill, `uFill`, `style.fill` |
| `src/app.js` | ui-app | fill every fold; `ghostColor` back to the star only; `setStyle({ fill })` |
| `src/palette.js` | motif / Klein work | `MOTIF_FILL_3D = [0.33, 0.55, 0.55]` |
| `src/plane.js` | plane | motif fill alpha 0.40 |
| `test/motif.test.js`, `test/klein.test.js`, `test/folds.test.js`, `test/render3d.test.js` | each file's owner | the new contract (see acceptance) |

The experiment's hash knobs (`ft fc fs fx fsc fss fxw pa fill fseam`) are **not** ported.

---

## Log (as I went)

### 23:40 — nothing to judge

The table above. Today's comma covers 1 to 6 % of its tile (`node dev/fill-c/tools/dump-groups.mjs`):

| group | cover | group | cover | group | cover |
|---|---|---|---|---|---|
| o | 2.8 % | 333 | 5.7 % | 632 | 3.9 % |
| 2222 | 4.2 % | 22x | 5.0 % | 3\*3 | 3.8 % |
| \*\* | 2.7 % | 22\* | 5.7 % | \*333 | 3.7 % |
| xx | 2.1 % | \*2222 | 4.4 % | 4\*2 | 3.3 % |
| \*x | 1.1 % | 2\*22 | 5.7 % | \*442 | 3.9 % |
| | | 442 | 4.5 % | \*632 | 3.3 % |

The caps that cause it (`src/motif.js`): SIZE_CAP 0.19 sqrt(area), VIEW_CAP 0.105 viewHalf, and K_CLEAR 0.68 of half
the distance to the nearest copy. On top of that, in 3D the comma is only an outline, except for xx.

### 00:20 — the experiment

- `dev/fill-judge/tools/bigcomma.mjs`: for each group, the largest comma whose copies stay a true distance apart, angle
  free, centre in the default tile (a fundamental domain), with `--target` to prefer placements inside the default tile.
  It takes about 1 s per group on one core.
- `dev/fill-judge/src/motif-big.js` is its table. `motif.js` builds the comma from it (knobs in the hash).
- `motifTintMesh` is applied to every fold, with the triangle's own piece for split vertices. `dev/fill-judge/tools/piececheck.mjs`
  shows this is not observable today: hinge `at(t)` ignores the piece, and the star duplicates its vertices per piece. It
  is what `mesh.js`'s contract asks for, so it is kept.
- Renderer tint: two bits.
- `tools/sheet.mjs` makes contact sheets of all 17 groups (one Chrome from the mini's pool). `tools/cost.mjs` measures the
  rebuild cost. `tools/scenecheck.mjs` checks build and map, with no non-finite points in any group.

Findings, in order:

1. Maximum packing (45 to 69 %) fuses commas into discs and clutters the kaleidoscope planes.
2. A true distance gap with 25 to 35 % coverage keeps the plane readable, and the pinwheels help.
3. A teal fill beats grey.
4. Stretch only the \*x strip.
5. xx in one lobe covers 10 %. With the largest comma it covers 30 % but is cut into corner pieces. Two lobes wide,
   centred on the middle glide axis, it covers 20 % and keeps the story.
6. Placements that lie in the default tile give a whole comma in the default picture for 13 groups at 30 %.

Final coverage, read from the outlines: o 29.4, 2222 30.0, \*\* 27.8, xx 19.5, \*x 21.2, all others 30.0 %.
