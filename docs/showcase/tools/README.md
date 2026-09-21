# Building the Showcase

Three scripts and one shared reader. No script owns a fact: every name, group,
equation, signature and field on a card is read out of a catalog that already
owns it, and the only things decided here are **which rows become cards**,
**what each clip is called**, **which clips look alike**, and **the link that
reopens the original page with that selection already made**.

```
showcase_common.py   one reading of the three catalogs, shared by the scripts
make-previews.py     the 36-frame loops and their posters
look-alikes.py       data/look-alikes.json — which clips draw the same picture
make-manifest.py     data/showcase.json, and the static part of index.html
```

## The usual run

```sh
python3 docs/showcase/tools/make-previews.py --kind all --broad   # ~2 min on 18 cores
python3 docs/showcase/tools/look-alikes.py --broad                # clips → clusters, 18 s
python3 docs/showcase/tools/make-manifest.py --broad --require-previews
node     docs/showcase/tests/showcase.browser.mjs                 # and BROWSER=webkit
```

**`look-alikes.py` runs before `make-manifest.py`, and after `make-previews.py`.**
It reads the clips, so a redrawn clip changes the clustering; the manifest reads
the clustering, so a changed clustering changes which card is a representative.
`make-manifest.py` refuses to run without `data/look-alikes.json` and says whose
job it is; `--no-look-alikes` builds a page that folds nothing, which is only
useful for bootstrapping — the shipped page folds.

**One pass is enough, including after a catalogue change.** Both scripts take
their clip list from the three catalogs through `showcase_common.all_rows`, with
the same `--broad`, so `look-alikes.py` running first already sees the clip set
`make-manifest.py` is about to card. It used to read `data/showcase.json` —
which `make-manifest.py` writes — so the first pass clustered the *previous*
clip set and every clip the change added shipped as its own unfolded card, the
duplicate the fold exists to hide; the order had to be run twice and remembered.
What is left of that is a gate rather than a ritual: the clustering carries a
`clipsDigest` over its sorted clip ids, `make-manifest.py` hashes the ids of the
rows it is about to ship, and a disagreement is now a refusal on a build and on
`--check` alike, naming `tools/look-alikes.py --broad`.

One manifest row is one card, and it carries exactly what a card draws, where
it goes and what it stands for:

```
{id, kind, family, groupId, name, equation, signature, dims, params,
 reading?, preview, poster, href, featured, siblings?, alsoIn?,
 look?, alike?, alikeOf?}
```

`reading` is what tells a card from its neighbours (below); `siblings` and
`alsoIn` are the catalogue's deduplication, and `look` / `alike` / `alikeOf`
the reader's (**Look-alikes**, below). Beside the rows the manifest carries
`counts` — `clips`, `total`, `distinct`, `folded`, `records`, `equations` and
one per kind — and `families`, each with `counts.total`, `counts.distinct` and
a count per kind.

**`--broad` belongs on all three scripts and on both `--check` lines.** It is
what the shipped tree is built with: without it the monochrome side collapses
from 1 830 clips to 326, `look-alikes.py --check` reports a clip set of 1 119
against the file's 2 623, and `make-manifest.py --check` reports the shipped
manifest as stale. Both `--check` runs say the tier is the reason in as many
words — one of them offers `--broad` by name — rather than printing three
thousand row diffs.

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

**CI runs both `--check` lines, not one:**

```sh
python3 docs/showcase/tools/look-alikes.py   --broad --check  # the clustering
python3 docs/showcase/tools/make-manifest.py --broad --check  # the manifest and the page
```

`make-manifest.py --broad --check` exits 1 if either output is stale — **with
`--broad`**, or it compares the shipped broad manifest against a strict build
and reports it stale (it says so in as many words and still exits 1). It
compares the rows **and** the sha256 of the four files the manifest was built
from — the three catalogs and `data/look-alikes.json`: a rebuilt catalog, or a
re-clustering, that happens to produce the same card set still makes the
manifest stale, and saying otherwise is how the shipped manifest once came to
name a superseded atlas while `--check` printed "current". It also refuses a
clustering whose `clipsDigest` is not the clip set it is shipping (above) — but
a sha256 of that file cannot see a clip the *catalogue* added, which is why the
clustering's own `--check` belongs in CI beside it.

`look-alikes.py --broad --check` is the other half, and it reads the file it
vouches for: the `clipsDigest` and the `fingerprint` (which covers the script's
own bytes, the threshold and the guard), then the clusters themselves — the
counts recomputed from them, every rep listed first among its own members, no
clip in two clusters, no singletons, one **kind** and one **equation** per
cluster (checked against the clip records the run just read, so a member no
catalog names any more is caught too), a `dists` of the right length whose rep
row agrees with `spread`, and the `clustersDigest`, a sha256 of the `clusters`
array itself. That last one is what makes the counts unfudgeable: deleting a
cluster and decrementing `counts.clusters` and `counts.folded` to match left
every other invariant true and still printed "current". `make-manifest.py`
holds the same kind-and-equation line from the other side, comparing each
cluster with the rows it is about to card.

`make-manifest.py`'s own flags: `--broad` (above), `--require-previews`,
`--check`, `--look-alikes <path>` (default `data/look-alikes.json`),
`--no-look-alikes`, and `--per-section N` — how many **default-visible** cards
of **every** section go into the served HTML, 50 by default. It replaced
`--static`, which was one page-wide budget of 240 that ran out inside p2 and
left fifteen of the seventeen wallpaper groups served empty.

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
them: the served HTML carries the first `--per-section` (50) **distinct-looking**
cards of every section — all of them in the three groups that hold fewer, and
there the bar is served hidden, as it is where the step and "all" would mount
the same cards — `showcase.mjs` raises one section's quota at a time
("Show 50 more", "Show all N") and evicts the family furthest from the viewport
past 1 000 mounted. **Show all** on any one family completes as long as that
family's representatives fit inside the ceiling; past that the grid says how
many it is still holding back and brings them in as the reader arrives.

## Look-alikes

A catalog that sweeps a parameter hands the Showcase long runs of cards that are
one picture: F .00395, .00398, .004 … .00405 of a Gray–Scott standing wave are
the same animation to the eye. `look-alikes.py` finds those runs so a section can
show one card per picture and fold the rest behind a `+N alike` chip.

It decodes every clip a non-viewer **catalogue** row names — the same
`showcase_common.all_rows(…, broad=…)` the manifest ships, so it can run first
and still see the right clip set, and never a directory scan, so a clip no
catalog names any more cannot enter a cluster — to 36 grayscale frames at 40×40, blurs
each frame with a periodic Gaussian (σ 1.6: the reader's eye, because a
one-pixel wobble of a hard black-and-white boundary is a large RMS and an
invisible difference), and z-scores it. The distance between two clips is their
RMS difference minimised over every cyclic shift **in time and in the two screen
axes**. Time, because a clip is one period and two readings of one wave start at
different phases; translation, because a catalog gives a pattern whatever origin
its solver landed on — pairs that are the same pinwheel tiling sit at 1.414
(orthogonal, the metric's word for unrelated) and fall to 0.005 once a shift is
allowed, and without the search they are never folded. The full 3-D search on
every pair would be hours; the magnitude spectra give an admissible lower bound
on it, so only the tenth of pairs that bound cannot rule out is searched.

Clips are clustered by single linkage at **0.28**, within one (kind, equation)
and never across it, refusing any merge that would put two members more than
0.35 apart (1.25 × the threshold); a cluster's representative is its medoid.
Complete linkage was tried and rejected: it leaves pairs 0.084 apart —
indistinguishable — in different clusters. The 2 623 non-viewer clips fall into
503 clusters and 1 324 clips are folded away, leaving **1 299 distinct-looking
pictures**; 15 s on 18 cores. (The page's own `distinct` is larger — 1 985 —
because it counts *cards*: one distinct-looking picture is a representative once
in every family that cards it, and the nine viewers are cards nothing is folded
behind.)

The diameter guard is not only insurance at 1.25: it refuses the merges that
would have joined 20 pairs of clusters, so no two members of a shipped cluster
are more than 0.349 apart, and every distance the fold could turn on is refined
exactly out to 0.35 — comfortably past the 0.28 it splits on.

97 of those 2 623 `.mp4`s are byte-identical to another one — 2 526 distinct
files in 69 groups of copies — because a clip is named by its record's hash and
not by the pixels it draws. `counts.clips` counts paths, so the summary says
2 632 pictures where the 2 632 files are 2 532 distinct ones. The fold hides
every copy from the grid (a distance of exactly 0 always clusters), so what is
left of it is 1.3 MB of disk and a number, not a duplicate the reader meets.

**A cluster is not a chip, because single linkage chains.** A run of steps each
under the threshold can carry a hard rectangular checkerboard to a rounded
pillow lattice: one cluster, plainly two pictures, and whichever of them a
section happened to card first stood for the other — so pmm showed the
checkerboard over four pillow lattices while pmg showed the pillow lattice over
three checkerboards. The clustering therefore promises only the weaker true
thing (every pair under the threshold is in one cluster) and publishes `dists`,
each cluster's full pairwise matrix, so `make-manifest.fold_look_alikes` can
split a family's members into as many chips as it takes. It is a greedy leader
pass: the leader is the card the section shows, everything within the threshold
of it is folded behind it nearest first, and whatever is left starts another
chip — and therefore another visible card, whose `look` gets `~1`, `~2` … so the
page can tell two chips of one cluster apart. What the reader can check falls
out of it:

* no card is hidden behind a card more than **0.28** away from it;
* no two cards a section **shows** are within 0.28 of each other.

The browser suite asserts both, over every folded row and every shown pair, out
of `data/look-alikes.json` itself.

The threshold was read off montages, not chosen to hit a number, and the pairs
were judged with the metric's own best (dt, dy, dx) applied — so neither a phase
difference nor a translation can stand in for a difference the eye would call
real. Below 0.26 a sampled pair is one picture every time. From 0.30 up it
routinely is not: wavy ribbons against straight stripes at 0.354, a diamond
checkerboard against rows of bells at 0.350, a lattice of squares against a
lattice of rings at 0.323, clean circles against a melted checkerboard at 0.310.
0.40 and then 0.36 were earlier readings, and both folded that whole band: about
260 of the folds at 0.36 were pairs a reader would have called two pictures, and
the page's "distinct-looking" counts were that much too flattering. 0.28 is the
last line the eye agrees with. `--montages DIR` redraws what it was judged by:
the largest clusters, the widest pairs a chip may hide, and the closest pairs the
page shows as two cards.

`make-manifest.py` consumes `data/look-alikes.json` and puts `look`, `alike` and
`alikeOf` on the rows, so run `look-alikes.py --broad` first. It maps each row to a
cluster by its clip id (the preview path without the extension) and folds
**per family**, because a cluster is a set of clips and a section is a set of
cards: one clip is carded in every family that hosts its field, so a cluster of
nine can put nine cards in p1 and one in p4m. A cluster with fewer than two
cards in a section folds nothing there.

| field | on | what it is |
| --- | --- | --- |
| `look` | both | the chip id — the cluster id, plus `~n` where one family-cluster split into several chips |
| `alike` | the representative | how many rows are folded behind it **in this family** |
| `alikeOf` | a folded row | the id of its representative, which is always a row of the same family |

The representative of a chip is the featured row if it has one — the one closest
to the cluster's medoid, where the site features two — else the cluster's own
global `rep` if that clip is carded in this family, else the family's first
member in manifest order. Featured wins on every chip of a split, so a featured
row is never folded behind an unfeatured one; the 16 that are folded at all sit
behind another **featured** card of the same section, 0.07 to 0.26 away. (That
is an amendment to the design, which asked for every featured row to stay
default-visible: showing both would put two cards of one picture side by side —
the complaint the fold answers — and would break the second promise above.
Being featured buys the guarantee that matters, which is never being hidden
behind something different.) Nothing is dropped: a folded row is a full manifest
row with its own parameters, its own reading and its own link, and the page
mounts it directly after its representative when the reader opens the chip.
`counts.distinct` is the default-visible cards over all families, the nine
viewers included because nothing is ever folded behind them, and
`counts.folded` what is behind them; `distinct + folded == total`, and the
browser suite asserts it along with every place the page prints either number.
`counts.distinctClips` is the same fold counted in **pictures** (1 299 + the
nine viewers = 1 308), which is what the summary line carries in the title of
its "distinct-looking cards" span so the two can never be read as each other.

## Which rows become cards

| kind | one card per | why |
| --- | --- | --- |
| `ember` | (family, field) | an ember picture is a function of the field alone, so several records of one family that share a field are one picture catalogued under several clockworks |
| `colour` | catalog entry | a colour entry already is one picture |
| `mono` | distinct sign picture, filed under every family that hosts the field | inside a strict fold every reading computes literally the same function, so they are one picture with several true sentences about it; a broad reading is its own picture and keeps its own card |
| `viewer` | page | they are pages, not catalogue rows |

The monochrome side ships **both antisymmetric tiers**, which is what `--broad`
on all three scripts does. The **strict** ones are the pictures whose two-colour law
holds in space *and* time — what the word *spacetime* earns, and what the two
shipped classics are; inside a strict fold every reading computes literally the
same function, so the fold is one card and the rest are its `siblings`. The
**broad** ones are the free involutions: each is a genuine two-colour wallpaper
pattern of a frozen frame and a different picture from its neighbours, so each
keeps its own card. Several readings of one wave therefore stand next to each
other in a section — 326 strict pictures and 1 504 broad ones, carded 615 and
2 400 times, is the difference between a sampler and a catalogue you can
scroll. Where two of those readings also *draw* the same picture, the fold
above puts the second behind the first, so what stands next to each other is
readings that differ to the eye and not only on paper.

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

Telling two cards apart is not the same as their looking different, and the
second problem is the one the fold above answers: seven verified g54 solutions
at F = .00395 … .00405 have seven different last lines and draw one picture.
Every word on those cards is true and the run of them is still a wall of the
same black diamond, which is what a reader meant by "there's a lot of duplicate
looking".

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
counts, the eighteen rail anchors, the eighteen section headings, the first
`--per-section` (50) distinct-looking cards of every section and each section's
own `<div class="load-more">` of two buttons. Nothing between those markers is
hand-edited. That is what makes the page a real, crawlable, linkable list of
pictures with JavaScript off, and it is why an unloaded card looks like a card
rather than a black hole.

A card is a `<div class="loop-card">` holding one stretched `<a class="open">`
and, where its clip has look-alikes behind it, one `<button class="alike">`. It
has to be a div: a button inside an anchor is invalid, and the chip has to be a
button because it does something on the page rather than going anywhere.
`card_html()` here and `cardElement()` in `showcase.mjs` write that markup
twice, in two languages; the browser suite evicts a section, brings it back and
compares a served card with the mounted one attribute for attribute, which is
the only thing keeping the two spellings one card.

The page's numbers, and where each of them is printed:

| number | summary | heading | rail pill | grid |
| --- | --- | --- | --- | --- |
| cards in this family | — | `… of N loops` | `title` | `data-total` |
| distinct-looking | `distinct-looking cards` | `N distinct of …` | the pill itself | `data-distinct` |
| folded behind them | `folded behind them` | — | — | — |

### One card per wave

The clip metric is exact about pixels and wrong about people. Six cards of the
g6 Gray–Scott rotating wave — F .00395 … .00408, read as half period, half
slide, half turn and mirror — cycle through the same stripes, bones and
chequers in a different order and at a slightly different spacing, so no
alignment of one whole loop onto another is close and the metric calls them
unrelated (0.8 to 1.41). A reader watching six synchronised loops in a row
calls them the same card six times. The catalogue already says so: they share
a *name* under one film group of one equation.

So `make-manifest.py` folds twice. After the look-alike fold, `fold_waves()`
folds every visible ember and black-and-white card of one `(kind, groupId,
equation, name)` in a section behind one of them — the featured one, else the
one already hiding the most, else the first — and the cards folded behind it
come along. Colourings are left alone: a colouring is its own picture. Each
folded row says which promise it is under, `fold: "look"` (within the
threshold of the card shown) or `fold: "wave"` (the same wave as it). A card
that already hides look-alikes of *another* wave is not folded, because its
followers would land behind a card that is neither the same wave nor close to
them; it stays visible, and the suite checks that every second card of a wave
in a section is exactly that case.
