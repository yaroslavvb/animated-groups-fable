# What the five judges said about "tomoe" (14 Nov 2026)

## judge:design (total 70/100; ships it: yes; default pick: 'paisley')

- scores: commaLike 8, fills 8, big 9, helpsFold 8, twoSides 8, clean 6, allGroups 6
- best: Inside the default tile it is a perfect yin-yang with eyes (**, xx, 22x, *2222, 2*22). Folded, the pillows show one whole yin-yang, the clearest landmark of the round in 3D.
- worst: On the open plane the marks are tile-shaped halves with straight edges, keyholes and floating dots. The white grout redraws the default tiling, so any other cut shows two grids at once. The kaleidoscopes become a triangle mesh of keyholes, and *x is two slugs.
- MUST FIX: The white channel runs along the default tile's rim, so with another cut or a dragged seed the plane shows a second tiling. I checked o with Hexagon and 442 with Pentagon (judge-design/tomoe-cut2-plane.png). Take the channel off the tile's edges, or drop it where dark meets light.
- MUST FIX: Kaleidoscopes and *x: keyholes and slugs, no comma reads

## judge:owner (total 70/100; ships it: yes; default pick: 'blobs')

- scores: commaLike 7, fills 8, big 8, helpsFold 7, twoSides 8, clean 6, allGroups 5
- best: o, 2222, xx, 22x, 333, 442: a whole taijitu in the default tile, with no background. The eyes are landmarks you find again on the closed cross-cap, on 632 and on *442.
- worst: *333, *442, *632, 3*3: the dark comma is the chamber itself, a dark triangle with a light keyhole, so the kaleidoscopes look like a checkerboard of triangles again. *x is two slugs.
- MUST FIX: The straight white channels on the rim of its Dirichlet tile (o, 2222, 333, 442, 632) draw the default tile on the paper. They stay put when the cut is dragged and read as a second cut, so bend or close them.

## judge:fold (total 72/100; ships it: yes; default pick: 'paisley')

- scores: commaLike 7, fills 8, big 8, helpsFold 7, twoSides 8, clean 7, allGroups 7
- best: Each default tile holds one whole yin-yang with two eyes. The eyes are clear landmarks on the cross-cap, the 632 cone and the 3*3 pouch, and the re-cut visibly puts the yin-yang back together.
- worst: Its light channel follows the default tile's rim, so every default seam closes on a pale strip that no mark crosses (seen on the nearly closed torus and cross-cap). The print frames the seams instead of showing them close. *x is two slugs.
- MUST FIX: Take the S-split from a tile whose rim is not the default cut (another seed than presets[0]'s), so that marks cross the default seams

## judge:worst (total 66/100; ships it: yes; default pick: 'tomoe')

- scores: commaLike 8, fills 8, big 8, helpsFold 8, twoSides 8, clean 7, allGroups 6
- best: o, 2222, xx, 22x, 333, 442, 632: one whole yin-yang in the default tile, with eyes that mark the way through the fold and the re-cut. It has the strongest hand of the round (nearest extra symmetry 0.57, every mark's mirror-likeness at most 0.83) and runs in 2-6 ms.
- worst: In *333, *442, *632, 3*3 and 4*2 the dark comma fills the chamber, so the plane reads as a grid of dark triangles with light keyholes. *x is two long slugs (bare 0.47). The default tile's rim shows as straight white lines, and they stay after the cut is changed (the old hexagons in 333 'In between').
- MUST FIX: kaleidoscopes: an S-split whose dark half does not fill the chamber to its rim, so the mark reads as a comma and not as the chamber
- MUST FIX: *x: give the slugs heads (bare 0.47 down to 0.45 or less)
- MUST FIX: curve or remove the straight channel along the default tile's rim: it prints the default cut

## judge:math (total 80/100; ships it: yes; default pick: 'tomoe')

- scores: commaLike 8, fills 8, big 8, helpsFold 9, twoSides 8, clean 7, allGroups 7
- best: The most exact print of the round: its worst near-symmetry is k 0.57, below the old comma's 0.69. Each tile holds one dark and one light comma with eyes, so every closed pillow shows a whole yin-yang and the eyes are landmarks through the fold, on teal and on sand alike.
- worst: In the kaleidoscopes the dark mark is the whole chamber and the hand rests on a light tadpole, which in 3*3 is a near-symmetric keyhole. In o, 2222, 333, 442 and 632 the white channels redraw the default cut (333 reads as tumbling blocks). *x is two slugs.

## The judges' notes (all designs; read what concerns this one)

### judge:design
1. Recurring flaw: some prints draw a tiling. Tomoe, mosaic and spiral, and ripple's cells more softly, run a white channel along the default tile's rim, so the plane prints the default tiling. With any other cut, or a dragged seed, the plane shows two grids, and the grout competes with the cut lines on a page whose whole point is choosing the cut. Seen in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-design/tomoe-cut2-plane.png (o Hexagon, 2222, 442 Pentagon) and in the xx Hexagon and 22x Bowl re-cut pictures of tomoe and mosaic. The checkerboard avoids this because its marks are small and sit on the group's lattice.

2. The kaleidoscopes (*333, *442, *632, 3*3, 4*2) are the shared weak spot. With one mark per chamber, every design becomes lace, bones, frets, rims or froth there. Paisley's several commas per chamber is the only approach that keeps commas. Worth merging into blobs or bigcomma for those groups.

3. Loose small pieces read as noise wherever they occur: bigcomma's dots and bubbles, glyph's square blocks, hook's dot in **, feet's toe specks, tomoe's floating dots. A kit rule would lift several designs at once, for example no free piece under about 0.1 tile, and at most one a tile.

4. Merge worth trying: bigcomma's light eye in the head of paisley's or blobs' big comma. In the folded shapes the eye was the best landmark of the round.

5. Edge quality checked at zoom 3 (judge-design/*-close.png). Swell's outlines are ragged: teeth along 3*3's mirror, bumps in 22*, a drip in **. Blobs' level sets are smooth. Ripple's band rims have straight facets and spikes where they meet the cell borders. Paisley's outlines are smooth.

6. Timing: in my proto run, paisley's find() took 108 ms for *632 and 90 ms for 4*2 on the mini, and proto flagged the 108. Its own report gives a maximum of 92 ms. Fix this before it becomes the default.

7. Freshness: the design.js of spiral, swell, blobs and hook is 1-2 minutes newer than their pictures. My renders from the current files of hook (xx, 22x, 442, **), spiral (o, *x, 632, *442), blobs and swell match the stored pictures, with the same vertex counts where shown. No picture was missing.

8. No tool failed or misled me: proto.mjs and app-sheet.mjs ran first time on every call. I changed no file of any design or of W. My renders are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-design/ and my working notes are in /Users/yaroslavvb/.ctmp/claude-501/-Users-yaroslavvb-git-animated-groups-fable/cc3b1316-130e-516c-9006-dc6da49f820b/scratchpad/judge-notes.txt

### judge:owner
1. Thin parts (THIN) were never checked for most designs. The THIN check (src/shapes.js thinParts at 1.5 texels of the 3D texture) arrived at 23:49, after the critics of ripple, bigcomma, paisley, glyph, spiral, feet, blobs and mosaic had finished. I ran it on all 11 designs in all 17 groups in node with /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-owner/thin-census.mjs; its numbers match app-sheet.mjs exactly (bigcomma o 10.8, ripple *442 35.5).
- ripple: 17 of 17 groups, 18 to 49 texels, as bad as the page's comma.
- bigcomma: 17 of 17, 10.3 to 11.1 texels (the tail tips).
- spiral: 5 of 17, 7 to 11 texels.
- The other eight: none.
The verdicts of ripple and bigcomma ('no validateShapes problem') never saw this check.

2. Three prints draw the default tile: mosaic (grout around every tile), spiral (tile-shaped slabs) and tomoe (straight channels along the rim of its Dirichlet tile). The lines stay in the plane when the cut is dragged and look like a second cut; on the closed shapes they double the seams. Blobs, paisley, bigcomma, swell, ripple, glyph and feet do not do this.

3. The common failure is the kaleidoscopes *333, *442 and *632 (and 3*3): one mark per chamber fuses with its mirror images into a rosette. Only paisley, with several commas per chamber, stays commas there. A merge worth trying later: blobs as it is, plus paisley's smaller second comma only in those four groups.

4. Bigcomma sits between blobs and tomoe (blobs plus an eye), so do not ship it beside them. If an eye is wanted, add tomoe's or bigcomma's eye to blobs.

5. Paisley's find() is near the time budget: 92 to 98 ms for *632 and *x in its own sheets, and 130 ms for *x in a render on the mini at 00:21, which proto flagged in orange. The kit asks for well under 100 ms. The owner will not see it, but it should be watched.

6. Six design files (bigcomma, blobs, glyph, hook, spiral, swell) were edited 1 to 5 minutes after their pictures were taken. My renders today give the same vertex counts as their sheets (swell: the same maxima as its verdict), so the pictures are current.

7. The default should be blobs. Keep the Checkerboard and Rings in the selector: their fine grids still show stretching better than any comma print.

8. My pictures are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-owner/:
- <key>-hard.png: the hardest groups (*x, 2*22 or *2222, 3*3, *333, *442, *632) of all 11 designs, flat. The blobs, bigcomma and paisley ones are from the earlier judge run at 00:20.
- <key>-fold-t1.png: the closed fold of o, xx, 22x, 2222, 632 and *442, at full scale, for blobs, paisley, tomoe, bigcomma, mosaic, ripple and swell.
I changed no file of any design.

### judge:fold
1. Stale pictures. design.js is newer than its OUT pictures for bigcomma (23:19 vs 23:14-23:16), swell (00:01 vs 23:58-00:00), spiral (23:45 vs 23:43), glyph (23:10 vs 23:07), blobs (23:39 vs 23:37-23:38) and hook (00:02 vs 00:00-00:02). Re-render these before anything ships. My side-by-side renders load the current files.
2. A recurring fold flaw. Tomoe, spiral and mosaic each put a light channel (or grout) exactly on the default tile's rim. At the default cut every seam closes on a pale strip that no mark crosses, so the print frames the seams instead of demonstrating that it closes without a break. Seen on the nearly closed torus and cross-cap (judge-fold/seams-o.png, seams-22x.png). A dragged cut does not have it; the cure is to build the cells from a seed other than presets[0]'s.
3. Merge. Bigcomma's light eye in the head is the best 3D landmark of the round (cross-cap, 632 cone, ** tube, 3*3 pouch). Paisley's big comma, and blobs', could carry it.
4. Verified in the real app on the mini's Chrome (judge-fold/thin.mjs, one page with all designs registered): all 11 designs take in all 17 groups, with 0 validateShapes problems and no page errors. thinParts at 1.5 texels flags ripple in every group (18-49 texels; today's comma reads 26-57), bigcomma in every group (10-11, the tail tip) and spiral in 333, 442, *333, 4*2 and *442 (7-11). At view zoom 1.9 on 2222 and 333 I saw no specks.
5. Geometry, not design. Thin tubes (o and xx at t = 0.6) turn every design into bands, and the cones compress all marks near the apex.
6. Hook's 442 hooks have lumpy outlines. At the size I rendered (520 px), hook's and glyph's 4*2 read as a Greek-key meander, not as hooked crosses.
7. Not verified: a retina screen (--dpr 2), Safari, a real phone (only the 390 x 780 window). I did not read the designs' NOTES.md or CRITIQUE.md; every score comes from pictures.
8. Process slip: one multi-line python3 -c ran inline instead of from a file (it only read my thin.json).
9. My renders and tools are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-fold/: compare.mjs (all designs side by side per group: --ids, --t, --view, --phone, --preset, --tile, --clip), thin.mjs and thin.json, and the pictures t1-*.png, t06-*.png, phone-*.png, recut-*.png, seams-*.png, tile-333.png, thinzoom-*.png and hook-442.png. I changed no file of the workspace.

### judge:worst
1. Every pattern took in my re-run. I ran all 11 designs in the real app with app-sheet --t 1, all 17 groups each: no RULES lines, no page errors. Six design.js files are newer than their pictures (bigcomma, swell, spiral, glyph, blobs, hook). Their vertex counts in all 17 groups equal rows.json, so the pictures are current.

2. THIN parts, from app-sheet:
   - bigcomma 17/17 (tail tips of about 11 texels);
   - ripple 17/17 (18-49 texels, near-zero width, at the band ends);
   - spiral 5/17;
   - none elsewhere.
   All are within the page comma's own 26-57 texels. A 2.2x flat 3D view of ripple in 2222, 333 and 442 showed no specks, but the windows may have missed the thin spots.

3. Speed of find() on the mini:
   - paisley: 92-127 ms in *x and 89-96 ms in *632 (its rows against my run), over the kit's 100 ms;
   - swell: 44-84 ms;
   - bigcomma: up to 64 ms;
   - every other design: 22 ms or less.

4. Designs built on the default tile print the default cut. With preset 1, mosaic and spiral fold the 2222 Book pillow with a white X of seams that are not there, and tomoe draws the old hexagons in the 333 plane. A page about cuts should not print one cut.

5. Two flaws recur across designs:
   - The kaleidoscopes (*333, *442, *632, 3*3, 4*2) are weak in every design. One mark per chamber, next to its mirror image, reads as a symmetric ornament. Paisley (several commas per chamber) and mosaic (flat, a light comma inlaid per chamber) cope best.
   - A starburst of thin white rays at the 6-fold centre of 632 in glyph, blobs, spiral, feet and hook.

6. *x, the group the owner named, separates the designs most. Paisley, blobs, feet and mosaic carry real marks there. Tomoe (slugs) and bigcomma (wedges) are weak. Ripple shows chain links. Spiral, hook, swell and glyph show stripes or combs.

7. From judge-math's sym/summary.txt (read, not recomputed): no design has an exact extra symmetry. The nearest extra symmetry runs from tomoe 0.57 and paisley 0.62 (the best) up to mosaic 0.89 (*x), glyph 0.82 (22*) and hook 0.80 (*x). The baseline comma is 0.69. Feet's sole has mirror-likeness 0.90-0.97, so its hand lives only in the toes.

8. A possible merge: paisley's filler commas would fix the bare patches of blobs (2*22 0.51, 4*2 0.50) and bigcomma (*2222 0.53), and blobs' smooth comma could serve as paisley's big comma.

9. No tool failed and none lied. Paisley's 127 ms came from my own proto run while other judges shared the pool, so timings vary by about 30 %.

10. My renders are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-worst/:
   - hard-<key>.png: *x, *632, *333 and ** at 2.4x, for all 11 designs;
   - othercut-mosaic.png, othercut-spiral.png, othercut-tomoe.png;
   - <key>-t1.png and <key>-t1.json: the fresh app runs with the THIN report;
   - ripple-3d-zoom.png;
   - rows-table.mjs and stale.mjs.

### judge:math
Measured, not only seen. The tool is /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-math/tools/symcheck.mjs, run on aifoundry1 through remote-sym.sh; reports and a table are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-math/sym/ (summary.txt).
- Exactness: for all 11 designs and all 17 groups, the group keeps the print exactly, and no print has an exact extra symmetry. The highest overlaps are mosaic *x at 0.945 and glyph 22* at 0.924, each under its exactness level (0.971 and 0.975).
- Near-symmetries. k is the overlap above chance; the old comma reaches 0.69. Tomoe peaks at 0.57, paisley at 0.62, bigcomma at 0.68. Swell, feet, ripple, spiral and blobs each have one group at 0.71 to 0.78. Hook has five groups at 0.72 or more, glyph eight.

Recurring flaws:
1. *x, the thin strip, is where most designs fail. Mosaic hides the glide: its two identical teardrops sit on the glide axis (0.945). Blobs and glyph line up two or three marks per tile (0.888 and 0.846). Hook, spiral and swell become stripes or bars (0.88 to 0.91 under a half-turn).
2. Two marks per tile that are near-translates of each other: glyph 22* (0.924) and 2*22 (0.869), blobs *x, mosaic *x.
3. In *442 and 4*2, glyph, ripple, hook, bigcomma, blobs, mosaic and paisley nearly keep the half-diagonal translation (0.80 to 0.88), so the two different 4-fold corners look alike. Tomoe, feet and spiral stay under 0.70.
4. Tomoe, spiral and mosaic build the default tile's rim into the print, so the default cut stays visible after a re-cut.

Merge suggestion: bigcomma's single comma with an eye wins the rotation groups, and paisley's handed small commas win the kaleidoscopes, where bigcomma's mark is a 94 % mirror-symmetric teardrop. Swell's whirls are the best 3-, 4- and 6-fold pinwheels and could serve either.

Caveat on the measure: k reads the dark tone only. Mosaic's hand lives in its light holes, so k overstates mosaic's problem everywhere except *x, where it is real.

Pictures:
- All pictures exist for all 11 designs.
- Six design.js files (bigcomma, glyph, blobs, spiral, swell, hook) are 1 to 3 minutes newer than their pictures. Their dark shares agree with rows.json within 0.025, the same spread as for tomoe and mosaic, whose pictures came after their last edit. So the pictures are current.
- Close renders are in /Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/judge-math/: hook-442-4s2.png, mosaic-sx-22s.png, glyph-22s-2s22.png, tomoe-333-632-3s3.png.

Process: no file of W was changed. Four browser runs went through the mini pool, one at a time, and the heavy computation ran on aifoundry1.
