# The pattern round — 13 and 14 Nov 2026

The record of the round that gave the page its shape prints: what the owner asked, the eleven designs, how they were
judged, what shipped and why, what did not, and where the pictures are. The machinery is in
`notes/patterns-foundation.md` (and `notes/patterns-renderer.md`); the contracts are in SPEC.md §11.

## The ask

The owner, 13 Nov 2026 (dictated: "hints" and "tensors" are TINTS):

> augment the-folding with more patterns. Currently, I just have 2. I like the checkerboard pattern idea of using
> slightly different hints for one side than another side, so we use that idea for the patterns you offer. The tiling
> one, I kind of don't like that it's too small, and the comma leaves too much empty space. Come up with some patterns
> which are more like a comma but they fill more of the space. And they reuse the idea of the checkerboard by giving
> different tensors to forward to the two sides.

And his page comment `88289462` on the live page (13 Nov, 22:10; https://spacesheep.dev/@yaroslavvb/the-folding):

> I want to reuse the two different shades from "checkerboard" pattern for all patterns

The comment is the complaint the two-shade Comma answers (below). SPEC.md §10.2 left it to this round.

## How

- **A kind of print for any motif** (`src/shapes.js`, `src/sdf.js`, the renderer's mode 3, the glue in
  `src/pattern.js`, the plane's cached layers). A SHAPE print's dark tone is the union of g(motif) over every element g
  of the group, so it is a pattern of the orbifold by construction, and is printed like the checkerboard: opaque paper,
  front teal, back sand, two tones each. Built by four agents, reviewed by three (mathematics, the GPU picture, the
  app), fixed by a fifth: `notes/patterns-foundation.md`, `dev/patterns/round1/`.
- **Eleven designers**, each a motif of their own (`dev/patterns/designs/<key>/design.js`), drawn with the kit's rules
  (`dev/patterns/kit.js`), seen with `dev/patterns/proto.mjs` (flat, with numbers) and `app-sheet.mjs` (the real app,
  folded). A critic then improved each design and tested it folded (`designs/<key>/CRITIQUE.md`).
- **Five judges** ranked all eleven, each through one lens: graphic design, the owner's eye, how well a print helps one
  follow the fold, the worst group of each design, and the mathematics (exact symmetry, measured near-symmetries).
  `dev/patterns/round2/judges.json`; per shipped design `round2/judges-<folder>.md`.
- **Three polishers** fixed what the judges asked of the three that ship (`designs/<folder>/NOTES.md`, section
  "Polish (14 Nov)"); a shell agent gave each a swatch; the integrator shipped them (this note, SPEC §11).

## The eleven designs

| design (folder) | the idea, as its meta says it | mean of five | ship sets |
|---|---|---|---|
| **Paisley** (`paisley`) | a big comma and smaller ones nestled around it, as on a paisley cloth | **76.4** | 5 of 5 |
| **Tomoe** (`tomoe`) | every tile split by an S into a dark and a light comma, each with an eye | **71.6** | 5 of 5 |
| **Soft commas** (`blobs`) | big soft commas with an eye, half the paper dark (the level set of a sum of comma-shaped bumps) | **70.2** | 3 of 5 |
| Big comma (`bigcomma`) | one big comma per tile, nested with its neighbours: an eye in its head | 67.0 | 1 |
| Mosaic (`mosaic`) | dark tiles with light grout between them, a big light comma inlaid in each | 57.0 | 1 |
| Ripples (`ripple`) | a comma and its echoes: bands at equal distance from it | 53.8 | 1 |
| Spirals (`spiral`) | one spiral arm per tile: a comma whose tail keeps winding | 47.4 | 1 |
| Letter F (`glyph`) | a bold F in every tile: it turns about the centres and reads backwards across a mirror or a glide | 47.4 | 0 |
| Footprints (`feet`) | a left footprint in every tile: a mirror or a glide makes it a right one | 47.2 | 0 |
| Swell (`swell`) | interlocking commas, each swollen into the room around it | 43.8 | 0 |
| Hooks (`hook`) | a bold hook per tile: the long stroke points, the short one shows the hand | 40.4 | 0 |

Scores out of 100 (seven criteria: comma-like, fills, big, helps the fold, two sides, clean, all groups). The totals
per judge (design, owner, fold, worst, math): Paisley 84, 76, 76, 70, 76; Tomoe 70, 70, 72, 66, 80; Soft commas 77,
80, 68, 60, 66. `designs/demo/` is the page's comma as a shape print (the baseline: about 30 % dark, a bare patch of
0.7 to 2 tile sizes), `designs/stress/` a hard case for the machinery.

## What shipped, and why

The selector's order: **Paisley, Soft commas, Tomoe, Checkerboard, Rings, Comma**. Nothing was removed.

- **Paisley is the default.** All five judges asked for a new default, none for the checkerboard. Paisley has the best
  mean score, is in every judge's ship set, and is the only design that stays commas in the kaleidoscopes (`*333`,
  `*442`, `*632`, `3*3`, `4*2`), where every one-mark design turned into bones, crosses or rosettes. Two judges named it
  the default (design, fold), two named Tomoe (worst, math: the most exact, the fastest), one Soft commas (owner: the
  calmest). The polish then fixed what the judges held against it: the bare 6-fold centre of `*632` (bare disc
  0.497 → 0.430), the time of its find (72–127 ms → 6–25 ms in Chrome, through a table of the winning start per group),
  the specks on a phone (every tip round and at least 0.04 tile sizes across), at most three marks a tile but in
  `*2222` and `*333`.
- **Soft commas**: one big soft comma with an eye per tile, exactly half the paper dark: the calmest print, and the
  closest to the page's own comma. The polish gave its kaleidoscopes a big and one or two small commas per chamber (the
  judges: "fill the chamber with two smaller commas as paisley does") and the light eye in the head that three judges
  suggested borrowing from Big comma.
- **Tomoe**: no background at all — every tile split by an S into a dark and a light comma — so a closed pillow shows
  one whole yin-yang, the best landmark for following a tile into 3D. The polish bent its tile, so its white channel no
  longer runs along the default tile's rim (all five judges had noted that its channels drew the default cut, a second
  grid beside the one the person drags).
- **The Comma, on the paper** (the owner's comment 88289462): the page's own comma (`src/motif.js`) is printed like the
  others now, front teal and back sand, two tones each. Its tail used to end in a needle the 3D texture could not hold
  (26–57 texels of outline under 1.5 texels): the print's copy keeps the tail at least 2 texels thick, to a round end.
  The picture before the prints (one comma cut into a translucent sheet) stays only as the sheet: what a pattern
  without a print for a group falls back to, and the default of the pure `buildScene`, whose tests were written for it.

The shipped files `src/patterns/paisley.js`, `soft.js`, `tomoe.js` are the design files as the polishers left them (last
edited 23:04 to 23:30 on 14 Nov), copied at 23:41 by `dev/patterns/scratch-integrator/copy-designs.mjs` (only the
imports and the first lines change); they give the same motif as their design files in all 17 groups, so Paisley's
table of winning starts still matches. A later change to a design file fails `test/patterns-shipped.test.js` until the
copy is made again.

The numbers of the shipped three, in all 17 groups (`test/patterns-shipped.test.js`, node, the page's own prints):

| | dark share | largest bare disc | smallest gap between copies | vertices | find (node, cold) | thin parts at 1.5 texels |
|---|---|---|---|---|---|---|
| Paisley | 0.482–0.594 | 0.430 (`*2222`, `*632`) | 0.059 | 344–491 | 16–81 ms | none |
| Soft commas | 0.497–0.502 | 0.457 (`2*22`) | 0.043 | 224–391 | 9–50 ms | none |
| Tomoe | 0.459–0.580 | 0.455 (`*333`) | 0.026 | 411–663 | 6–26 ms | none |
| Comma | 0.217–0.303 | 0.70–2.0 | 0.070 | 99 | 1–12 ms | none (motif.js's own: 37–57 texels) |

The Comma's tail in 3D, read as the shader reads the texture along the tail's middle line: motif.js's needle loses its
last 8.5 to 21.5 texels in every group; the round end loses none (`dev/patterns/scratch-integrator/tip-held.mjs`, and
the test). The closed shapes with the Comma: `integrate/comma-t1.png`, `integrate/comma-t1-fold.png` (on xx's bottle the
comma lies over the body, motif.js's place for it, so the bottle shows a dark band of sand rather than a comma).

## What did not ship, and why

- **Big comma** (fourth): the strongest single mark, but beside Paisley and Soft commas "a third version of teal
  commas on white"; its tails are thin in 3D in all 17 groups (10–11 texels), and its kaleidoscope marks are 94 %
  mirror-symmetric teardrops. Its best idea, the light eye in the head, went into Soft commas.
- **Mosaic**: grout along the default tile's rim prints the default cut, and in `*x` its two teardrops sit on the glide
  axis and hide the glide.
- **Ripples**: thin band ends in all 17 groups (18–49 texels, as bad as the old comma), and it loses the comma in the
  fold.
- **Spirals, Letter F, Footprints, Swell, Hooks**: in the mirror groups and `*x` they stop reading as a mark (stripes,
  combs, a Greek key); the F lines up into near-symmetries in eight groups, the hooks in five; Swell's outlines are
  ragged at zoom 3; the feet's hand lives only in toes that vanish on a phone.

## Still open (the polishers' own words, shortened)

- Paisley: two to four marks per tile is the concept, so it is busier than a one-mark print; `*2222` and `*333` keep a
  fourth small comma. A group moved without presets (only the tests make one) runs the full search, about 300 ms in
  node; the page never does. The table of winning starts must be made again (`lab/r3/winners.mjs make`, then `check`)
  when a knob, the group data or the default cut changes: a stale table still gives a valid motif, not the searched one.
  Since 15 Nov the table of grown marks too (`lab/r3/grown.mjs make`, then `check`; the fingerprint test of
  `test/patterns-engines.test.js` fails until it is).
- Soft commas: `2*22`'s bare disc is 0.455 (just over the 0.45 the judges asked; the test's bound is 0.5). The
  kaleidoscope corners still make rosettes (a 12-point white star round the 6-fold centre of `*632`).
- Tomoe: `*333`'s bare disc is 0.455; the kaleidoscope marks read as curved blades with a keyhole more than as clean
  commas; `3*3` keeps a doubled thin strip along its base mirror; `o`'s light bodies form wavy rows.
- None of the three was seen on a real phone or a retina screen; Safari only through the WebKit layout gate (SPEC §11).

## After the three reviews (15 Nov 2026, the fixer)

Three reviewers looked at what the integrator shipped: its correctness (measured on aifoundry1, faults planted), the
built page in Chrome as the owner would use it (laptop, phone, retina), and the built page in Safari's engine (WebKit
26.5 on the M5). Two said ship, one said ship after one fix. What was done (SPEC §11 has the contracts):

- **Paisley was another pattern in Safari** (the one major finding). Its search is greedy, and a greedy search follows
  the last bit of `Math.cos`, `sin`, `hypot`, …, which WebKit's libm gives otherwise for 4–38 % of their arguments: all
  17 tiles grew other marks there (`*632` and `4*2` with flaws of 0.54 and 0.46 against 0.24 and 0.08). Chrome 157
  differed from node too (a small mark of `*333` elsewhere). Now the page's 17 tiles DRAW the marks the search grew in
  node (`GROWN` in `paisley.js` and its design file; `lab/r3/grown.mjs`): node and Chrome agree to 2e-16 in every group,
  the find costs 1 ms instead of 8 (22.7 at most), and `test/patterns-engines.test.js` moves the last bit of Math and
  keeps a fingerprint of all four shape patterns. Paisley's `*333` is now the node-grown one, not the one Chrome had
  shown the reviewers (the same flaw, 0.062 against 0.061; one small mark in another place).
- **The sharp check** (`exactlyInvariant`) had no test of its own guard: one that passes nothing it could not read, and
  that reads both sides of an outline (`test/pattern.test.js`; the review's three planted faults fail it now).
- **The warmer**: a hidden page makes nothing; a slot must hold the longest print of the pattern so far (capped, so a
  long print takes a whole idle period); Safari's timer chain treats a late timer as a busy page; the page's wiring is
  checked in a real Chrome by `dev/recut/browser-check.mjs` (made after the load, held back by frames and by a hidden
  page; four faults planted in copies of the sources fail it). The timing table of SPEC §11 was measured again with
  the warmer stopped after every change (the old one had stopped it once, and 5 to 11 of 16 prints were made ahead).
- **The Comma** of a turned, scaled, shifted or mirrored copy of a page group is that group's comma carried along
  (it threw before); the layout gate wants a shape print of it in every group; its hint no longer says "as before the
  prints".
- `tools/.mini-pool.json` (the live Chrome pool) is ignored by git (`tools/.gitignore`); `dev/patterns/README.md` lists
  the six built-in patterns; `notes/patterns-foundation.md` says which of its open items the round closed.
- Left as they are: the Comma reads fainter in 3D than the old outlined comma (the paper's two tones, as comment
  88289462 asked; the owner should see `review-chrome/oldnew/comma-old-new.png`); Soft commas' print takes up to 65 ms
  on a phone-speed CPU, longer than any idle slot (it takes a whole idle period; a tap then can wait that long).
- Not re-run after the fixes: WebKit (the M5 was off the tailnet from 01:30 on 15 Nov). The ulp-chaos test stands in
  for it in node; the commands that run it on the M5 are at the end of SPEC §11.

## The pictures

All under `~/drive.unsynced/artifacts/the-folding-patterns/` (not in git):

- per design, `<folder>/`: `sheet.png` (all 17 flat, with numbers; `rows.json`), `zoom.png`, `back.png`, and the real
  app: `app-t0.png`, `app-t06.png`, `app-t1.png` (flat, half folded, closed), `app-back.png`, `app-phone.png`,
  `app-recut.png`, `app-tile.png`; the older versions as `*.v1.*`, `*.v2.*`; the polish's own in `polish/`;
- the judges' renders: `judge-design/`, `judge-owner/`, `judge-fold/`, `judge-worst/`, `judge-math/`;
- the shell's swatches and header sheets: `shell/` (`hdr/sheet-<w>x<h>.png`, `hdr/pill-laptop.png`);
- the shipped page: `integrate/` — `dist-<pattern>-t06.png` (the built page, all 17 groups, each pattern),
  `try-comma.png`, the timings `setgroup-*.json`, `print-time.json`;
- the reviews: `review-correct/`, `review-chrome/`, `review-webkit/` (`motif-paisley-engines.png`: Paisley in Chrome,
  WebKit and node before `GROWN`); the fixer's: `fixer3/` — `<pattern>-t06.png` and `paisley-t0-close.png` (the built
  page after the fixes), `perf-dist.json`, `print-time.json`, `phone-perf.log`, the gates' outputs, `fp/` (every
  print's motif in node, Chrome and WebKit).
