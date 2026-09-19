# Building the Showcase

Two scripts and one shared reader. Neither script owns a fact: every name,
group, equation, signature and field on a card is read out of a catalog that
already owns it, and the only things decided here are **which rows become
cards**, **what each clip is called**, and **the link that reopens the original
page with that selection already made**.

```
showcase_common.py   one reading of the three catalogs, shared by both scripts
make-previews.py     the 36-frame loops and their posters
make-manifest.py     data/showcase.json, and the static part of index.html
```

## The usual run

```sh
python3 docs/showcase/tools/make-previews.py --kind all --broad   # ~2 min on 18 cores
python3 docs/showcase/tools/make-manifest.py --broad --require-previews
node     docs/showcase/tests/showcase.browser.mjs                 # and BROWSER=webkit
```

**`--broad` belongs on both, and on `--check`.** It is what the shipped tree is
built with: without it the monochrome side collapses from 1 830 clips to 326 and
`make-manifest.py --check` reports the shipped manifest as stale. A `--check`
run whose tier disagrees with the shipped manifest says so in as many words
rather than printing three thousand row diffs.

The site header on this page, and on all 87 others, is written by
`../../monochrome/tools/add-nav.py` (§A.9 of the design note), which puts
`Showcase` first under **Catalogues**, renames the **Colour** group to
**Colourings**, and gives every page the fifth **Superseded** group — the two
report pages were written with four. `make-manifest.py` only rewrites what is
between its own three pairs of markers, so the two never touch the same bytes
and either may be run first.

`make-previews.py` is idempotent: a clip whose `.mp4` and `.webp` are both newer
than the field it was drawn from, **than this script and than
`showcase_common.py`**, is skipped, so re-running after one catalog changes
costs only that catalog. Both scripts are in the comparison because both decide
pixels — the renderers are here, every camera is there (`mono_tiles`,
`screen_lattice`, the `_render` blocks, `TILES`, `SIZE`) — and while only this
one was watched, a change to the other left 2 632 stale clips with `--kind all
--broad` reporting nothing to do. The cost is that editing either invalidates
the tree: a full redraw is 140 s on 18 cores, and a one-kind change is best
re-run as `--kind <the one you changed>`. `--force` redraws; `--no-prune` keeps
clips the catalogs no longer name.

`make-manifest.py --broad --check` exits 1 if either output is stale, which is
the line to put in CI — **with `--broad`**, or it compares the shipped broad
manifest against a strict build and reports it stale (it says so in as many
words and still exits 1). It compares the rows **and** the sha256 of the three
catalogs the manifest was built from: a rebuilt catalog that happens to produce
the same card set still makes the manifest stale, and saying otherwise is how
the shipped manifest once came to name a superseded atlas while `--check`
printed "current".

## What a preview is

36 frames of one period at 176 px, h264 CRF 30 (`yuv420p`, GOP 36 so every loop
begins on a keyframe, `+faststart`), plus a WebP poster of frame 0. The format
was decided by encoding a real two-tone loop and a real ember loop every
plausible way: animated WebP is ten times heavier overall and twenty-five times
heavier on the ember loops, because it has no motion compensation worth the
name and an ember field's every pixel changes every frame.

The **two-colour clips are encoded at CRF 26** (`--crf-mono`), not 30. A pure
black/white source is the worst case for chroma-subsampled h264 and at 30 the
mono clips carried visible mosquito noise hugging the one contour that is the
whole point of the picture. The measured cost on one clip was 16.5 kB → 22.6 kB;
across the tier it was absorbed by the framing change below. The whole tree is
about 62 MB.

Each frame is drawn by the CPU twin of the shader the live page uses. Nothing is
captured off a running page — every pixel comes from the same saved float32 the
page loads — but a clip is a **reconstruction and not a recording**: one
temporal sample per output frame, box-filtered down from `--supersample`, where
the live pages composite a multi-tap shutter. A boundary moving fast is a little
crisper here than it is there, and the page says so. The one card that is not
even a reconstruction is the chair tiling, which has no field: its clip is that
page's own shipped preview image, held still, and `index.html` names it.

| kind | rule | where it came from |
| --- | --- | --- |
| `ember` | the ember ramp on the record's own U range | `../../scott-gray/render.mjs` |
| `colour` | argmax of the three samples the entry's `colouring` names | `../../colour/colour-renderer.mjs` |
| `mono` | the sign of the difference field, on the doubled grid | `../../scott-gray/weave-monochrome/renderer.mjs` |
| `viewer` | each standalone page's own field, rule and framing | that page's `renderer.mjs` |

For `ember` and `colour` the camera is the framing the card's own link opens on
(`framing=simulation&tiles=2`), so a preview and the page behind it show the
same amount of the plane.

**Monochrome is framed differently, because its explorer is.** `mono-app.mjs`
overwrites any `tiles` in the hash with its own `homeTiles(entry)` — the
catalog's per-entry `view.tiles`, rescaled to whatever canvas the reader has,
then dropped until the strand clears 14 px. A clip that ignored that and always
showed two cells drew 45 of the 326 strict pictures with a strand under 14 px
and 19 over 60. `sc.mono_tiles()` is that same law transcribed and evaluated at
176 px: every clip now lands between 17 and 55 px, centred on the lattice origin
as the explorer centres it, and at the same pixels-per-cell the page will use.
The mono href therefore carries **no `tiles`** — it was a number the address bar
never kept.

Sampling is periodic Catmull–Rom in space and in time. Every frame is drawn at three times the output size and box-filtered
down, so what is averaged is the **colours** the rule assigned and never the
field: the average of a field still has one sharp boundary, only displaced,
while the average of the colours carries the boundary across every pixel it
swept.

Clips are named by **content**, not by row — `previews/ember/<field-sha12>.mp4`,
`previews/colour/<entry-id>.mp4`, `previews/mono/<picture-id>.mp4`,
`previews/viewer/<slug>.mp4` — so records that share a field share one clip.
The generator prints a per-kind byte total and fails past `--ceiling-mb`
(80 MB); the current tree is 62.3 MB over 2 632 clips — 0.26 viewer, 7.8 ember,
11.6 colour, 42.6 monochrome.

Because a clip is named by content and a card by (picture, group), **2 632
pictures stand behind 4 138 cards**. That is not a duplicate: a wave hosted by
twelve film groups is carded in each of the twelve sections, because that is
where a reader looking for a p4g picture looks. Every such card carries
`alsoIn` — the other groups that card the same clip — the page says so in the
card's tooltip and in its own note, and the summary line counts pictures and
cards separately.

At 4 138 cards no reader meets them all at once, and nothing here tries to make
them: the served HTML carries the first `--static` (240), `showcase.mjs` mounts
a batch at a time and evicts the family furthest from the viewport past 1 000
mounted, and the biggest section (p6, 640) still fits inside that ceiling, so
**Show all** on any one family always completes.

## Which rows become cards

| kind | one card per | why |
| --- | --- | --- |
| `ember` | (family, field) | an ember picture is a function of the field alone, so several records of one family that share a field are one picture catalogued under several clockworks |
| `colour` | catalog entry | a colour entry already is one picture |
| `mono` | distinct sign picture, filed under every family that hosts the field | inside a strict fold every reading computes literally the same function, so they are one picture with several true sentences about it; a broad reading is its own picture and keeps its own card |
| `viewer` | page | they are pages, not catalogue rows |

The monochrome side ships **both antisymmetric tiers**, which is what `--broad`
on both scripts does. The **strict** ones are the pictures whose two-colour law
holds in space *and* time — what the word *spacetime* earns, and what the two
shipped classics are; inside a strict fold every reading computes literally the
same function, so the fold is one card and the rest are its `siblings`. The
**broad** ones are the free involutions: each is a genuine two-colour wallpaper
pattern of a frozen frame and a different picture from its neighbours, so each
keeps its own card. Several readings of one wave therefore stand next to each
other in a section, and that is the grid's whole subject rather than a fault in
it — 326 strict pictures and 1 504 broad ones, carded 615 and 2 400 times, is
the difference between a sampler and a catalogue you can scroll.

## Telling two cards apart

Every word on a card comes from a catalog, and in a section of one wave read
many ways most of those words are shared. Each row therefore carries a
`reading`, which leads the card's last line and is the one thing its neighbours
do not say:

* **mono** — the rule, in the explorer's own chip wording (`RULE_LABELS` and
  `chipDetail` of `mono-app.mjs`): *Half period*, *Glide Mx, slide (2, 18)*,
  *Half turn about (1/12, 1/24)*. 330 distinct readings over 3 015 cards.
* **colour** — the colouring, in the colour explorer's own words: *Gyre about
  w (23, 11)* is the whole node vector that reaches the turn centre, *Trefoil at
  b (12, 24)* the node offset between the three compared samples. The badge says
  `three-colour` for both kinds, so without this a Gyre card and a Trefoil card
  of one orbit were the same card twice.
* **anything still tied** — the saved field's own 8-hex digest, the same one the
  clip is named by. Three verified g55 orbits at F = .0038, k = .02 are all
  called "Woven standing wave · (2,1)", and six Trefoil colourings of one
  Sel'kov orbit agree about b, the swap and every parameter: at that point the
  field IS the difference. `sc.disambiguate` adds it to 314 of the 4 138 cards
  and to no others.

The result is asserted, not hoped for: **no two cards in one section read the
same**, in the desktop layout and in the phone one. The phone drops the group
and equation line for room, and in twelve of the eighteen sections that is the
line that tells a g247 card from a g248 one, so `make-manifest.py` marks those
grids `data-where="keep"` and the stylesheet keeps the line exactly there.

The **threshold control** is carded by neither tier. It has no antisymmetry in
it at all — it exists so the other two can be compared with something that has
no two-colour law — and in a grid it would read as one more two-colour picture
and be none. It is read in the explorer, beside the sentence that says what it
is. `mono_rows` drops it before it folds anything, so no flag brings it back.

Independent agreement worth recording: deduplicating the wallpaper atlas this
way yields **691 ember placements** with the per-family split
12 · 42 · 6 · 8 · 28 · 34 · 34 · 41 · 47 · 141 · 43 · 70 · 58 · 14 · 19 · 78 · 16,
which is exactly the table the design note's own symmetry sweep produced from
the other direction.

## The links

Each was read off the app that has to parse it again, and the round trip is
asserted in the browser suite by *following* a card and checking that the page
wrote that very picture back into its own hash:

* field → `../scott-gray/<family>/#<gN>?v=2&pattern=…` — `../../scott-gray/view-state.mjs`.
  **p4 has no directory of its own**; its page is `../scott-gray/`, and that
  wart lives in `Groups.page()` and nowhere else.
* colour → `../colour/{gyre,trefoil}/#<gN>?v=1&sub=all&…` — `../../colour/colour-view-state.mjs`.
* monochrome → `../monochrome/<family>/#<gN>?v=1&rule=<hyphenated-kind>&tier=<the
  entry's own>&…` — `../../monochrome/mono-view-state.mjs`. The rule kind keeps
  its hyphen (`half-turn`, not `halfturn`), and the tier is the **entry's**, not
  the run's: a strict picture opened on the broad chip is one the sentence above
  it is false about, and the explorer would have to widen the chip back to
  `all` to find it at all. No
  `tiles`: the explorer frames by `homeTiles` and overrides whatever the link
  says, so a `tiles` here would be a promise the address bar breaks.
* viewer → its own directory.

## The page

`make-manifest.py` also stamps `index.html` between three pairs of markers —
`<!-- summary:… -->`, `<!-- rail:… -->` and `<!-- cards:… -->` — with the
counts, the eighteen rail anchors, the eighteen section headings and the first
`--static` (240) cards. Nothing between those markers is hand-edited. That is
what makes the page a real, crawlable, linkable list of pictures with
JavaScript off, and it is why an unloaded card looks like a card rather than a
black hole.
