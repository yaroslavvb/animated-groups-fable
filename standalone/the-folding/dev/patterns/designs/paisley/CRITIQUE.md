# Paisley — the critique

13 Nov 2026, evening · the second critic (art director and mathematician, speaking for the owner) · the design judged is
`design.v1.js`, the designer's delivery. The first critic's draft (cut off at 17:18) is folded in here; its numbers were
checked again.

Fresh pictures of v1 are in `~/drive.unsynced/artifacts/the-folding-patterns/paisley/r2/`:
- flat: `v1-sheet.png`, `v1-A.png`, `v1-B.png`, `v1-C.png` (520 px), `v1-zoom.png`, `v1-back.png`;
- the app: `v1-app-t06.png`, `v1-fold-t1.png`, `v1-fold-t0-busy.png`, `v1-app-phone.png`.

Counts come from `lab/r2/ev.mjs` (the marks), `lab/r2/near2.mjs` (near-symmetries; the first critic's `lab/ad/near.mjs`
with knobs) and `rows.json` (the kit's `measure` in the mini's Chrome).

## Starting point

The first critic had begun a second version in `design.js` (now kept as `design.v2.js`). Side by side on the flat sheet
(`r2/v1-sheet.png`, `r2/crit1-sheet.png`):
- **It had removed the specks** but left the corners of the kaleidoscopes bare: bare disc 0.94 in ∗632, 0.61 in ∗333 and
  ∗442, 0.56 in ∗2222, 0.51 in ∗x. White stars stood at the corners.
- **Its tail-first placement never once fitted.** In ∗632 no tail passed at any head radius from 0.03 to 0.2. Aiming the
  head-to-tip chord at the corner instead of the tip's own heading did not help either: a count of the failed checks
  (∗442) showed the head running into the neighbouring marks. Next to a full-size big comma the room in a corner is too
  small for a comma of fair size.

v1 is the better start, and the second version was built on it.

## Verdict on v1

The idea is right and it shows. Every group reads as a paisley cloth, the big comma is on the scale of the tile, the
default tile holds it whole in all 17, and no hard rule is broken. What is wrong is the small change. A third of the
marks are fillers too small to be commas at the page's size. They gather into ornaments at the corners, and in a few
groups the pattern looks as if it had a symmetry it does not have.

## Findings, worst first

1. **The fillers are specks (c, f).** 20 of 63 marks are shorter than 0.30 tile sizes or have a head under 0.13. The
   smallest are 0.16 long with a 0.07 head (∗632, ∗333); there are more in ∗2222, ∗442, 2∗22, 442, 22∗ and 3∗3. Their
   tails are thinner than 0.04 for the last fifth to two fifths of the spine. In the app at 760 × 470 the plane pane
   shows a tile of about 60 px, so such a mark is a 10 px dot with a hair. Six groups carry five marks (∗x, ∗2222, 2∗22,
   442, ∗442, ∗632), against the brief's one to four.
2. **The specks make figures nobody asked for (f).** Mirrors and centres copy a speck four, six or eight times round a
   point:
   - four-petalled florets at the 4-fold centres of 4∗2 and 442;
   - "owl faces" across the mirrors of ∗2222 and ∗442;
   - fleurs-de-lis at the 3-fold corners of ∗632;
   - a hair under the big tail in 22∗.

   The eye goes to them, not to the commas. Not quiet.
3. **Near-symmetries (a).** The symmetry group is exactly the group in all 17 (the marks are disjoint, the big comma
   has no symmetry and no other mark is congruent to it). The eye does not read exactly, though. An isometry outside the
   group keeps this share of the tone (chance is one half):

   | group | share kept | the outsider | what one sees |
   |---|---|---|---|
   | 3∗3 | 83 % | a turn of order 6 | six alike petals round the 3-fold centre: it reads as ∗632 |
   | ∗442 | 83 % | a translation | the big comma is a bean on the triangle's axis |
   | ○ | 80 % | a reflection | the long comma is close to a leaf with an axis |
   | 4∗2 | 77 % | a translation | |
4. **Three glyphs, not one (a, f).** The knob `e` gives three different marks:
   - a curled yin-yang comma (2222, 442);
   - a long horn with an even 70° bend (○, ∗∗, ∗x, 22∗, ∗632), whose direction is clear but whose hand is faint;
   - a bean whose tail hardly leaves the head (the big mark of ∗442, e = 0.13).

   They are relatives, not one family.
5. **∗x is the thinnest and the busiest (b, c), and the owner named it** ("in ∗x most of the surface is empty").
   - It is 44 % dark, with five marks in a strip 0.43 wide.
   - The main mark is 0.29 across, two thirds of the width there is.
6. **Uneven ground (b).** Channels are 0.06 where two marks run side by side and open into bare wedges beside the long
   tails. Bare discs of 0.40–0.42 (inside the 0.45 target) sit at the 6-fold centre of 632 and at mirror corners of 3∗3,
   ∗333 and ∗442.
7. **In the fold.**
   - The specks add nothing: in 3D they are not legible (`v1-fold-t1.png`), and on a phone they are noise
     (`v1-app-phone.png`).
   - The big marks carry the fold. At t = 0 the flat tile shows one whole comma with a head and a tail, so one can follow
     where they go.
   - On the Möbius band and the cross-cap the marks stay commas. On the thin tubes of the torus and the Klein bottle they
     become soft stripes, as any print does.
   - Sand side (`v1-back.png`): the big marks read; the small hooks fade (∗2222's corners, the hair in 22∗).
8. **Not robust (rule 2).** Without presets the same group gets another family (632: three marks, ∗632: four), and the
   designer's fuzz saw ties fall the other way under a turn. Every one passes the checks; they are not the same pattern.

## The rules and the targets for v1

| | holds | fails or is weak |
|---|---|---|
| rule 1 pure, deterministic | yes | |
| rule 2 reads only the group | yes | another family without presets (8) |
| rule 3 all 17 | yes | |
| rule 4 copies ≥ 0.02 apart | yes: smallest gap 0.059, overlap 0 | |
| rule 5 ≤ 2400 points, smooth | yes: 383–644 points | |
| rule 6 fast | 6–31 ms (mini) | |
| a comma-like | the group is exact | 3, 4 |
| b fills | dark 0.44–0.60, bare ≤ 0.42, solid ≤ 0.50 | 5, 6 |
| c big | main mark 0.90–1.45 long | 1: specks, five marks in six groups |
| d helps the fold | the tile holds the big comma whole in all 17 | the specks add nothing one can follow |
| e two sides | the big marks read on sand | the small hooks fade |
| f clean | smooth outlines | 1, 2, 4 |

## What the second version (`design.js`) does about it

Details and numbers are in NOTES.md, "After the critique". In short:

| finding | v1 | now |
|---|---|---|
| 1 specks | 20 small marks; the smallest 0.16 long, head 0.07; tails under 0.04 | 6 small; none under 0.22 long or 0.12 across; every tail at least 0.057 wide at 70 % of the spine |
| 1 marks per tile | 5 in six groups | at most 4 everywhere; 2 in ○, xx, 22∗, 2∗22, 442 and 632 |
| 2 figures | florets of specks at the corners | the hairline ones are gone; the corner commas of ∗2222, ∗442, ∗632 and 4∗2 are stout and twice the size, but still make a small rosette |
| 3 near-symmetry | worst 83 % (3∗3, ∗442) | worst 81 % (∗442); 3∗3 is below 77 %; ∗2222 and ∗333 rose to 78 % |
| 4 glyphs | yin-yang, horn, bean | no big bean (a big comma is curled no further than e = 3/8); small marks are one stout cut |
| 5 ∗x | 44 % dark, 5 marks, main 0.29 across | 46 % dark, 4 marks, main 0.29 across |
| 6 ground | bare ≤ 0.42 | bare ≤ 0.447 in 16 groups; **∗632 0.497** |
| 8 robustness | | not solved (the greedy is as touchy as before) |

## What is still wrong, worst first

1. **∗632 leaves its 6-fold point bare** (0.497; target 0.45, cap 0.6; v1 had 0.354). Twelve tails meet there and stop
   about 0.25 short, which leaves a white star. Every start was tried: a big comma pinned into the 30° corner, corner to
   corner, made smaller. The best keeps the star.
2. **Kaleidoscope corners still carry small rosettes** of stout commas (0.22–0.35 long) in ∗2222, ∗442, ∗632, 4∗2 and
   ∗333. They are legible and fat, not hairs, but they are a second figure beside the big commas.
3. **Near-symmetries of 78–81 %** in ∗442, ○, ∗2222, ∗333 and 4∗2.
4. **The greedy is touchy.** Without presets ∗632 has a bare disc of 0.49–0.51, and one turned placement of ∗x is 0.393
   dark. A knob a hair off gives another family.
5. **Three times slower than v1.**
   - 8–92 ms per group in the mini's Chrome (v1: up to 31).
   - Up to about 300 ms in node on the loaded Intel.
   - On a phone a group change may take a few hundred milliseconds (cached afterwards).
