# `build-monochrome-catalog.py` — the black-and-white catalog

One script builds everything under `../data/`: the catalog the monochrome pages
read, the thumbnails the showcase grid shows, and (for offline-search records)
the orbit fields themselves.

```
../data/monochrome-atlas.json          the catalog     (schema monochrome-atlas-v2)
../data/thumbs/mono-<kind>-<sha12>-<tag>.png   one frame per entry, framed by view.tiles
../data/orbits/<sha256>.f32            fields that came in through --records
featured.json                          the editorial judgement, entry id -> one sentence
```

Two other scripts live in this folder and belong to the pages, not to the
catalog; each is documented in its own docstring.

* `make-family-pages.py` stamps the landing and the seventeen family pages from
  one template. It bakes the catalog's counts into the markup so the pages read
  correctly with JavaScript off, which means **it must be re-run after every
  catalog build**; `--check` exits 1 on a stale stamp and the browser suite
  shells out to it.
* `add-nav.py` is the site-wide header rewriter of §A.9 of the design note: it
  makes `Showcase` the first link under **Catalogues** and renames the
  **Colour** group to **Colourings**, holding Entangled colourings / Gyre /
  Trefoil / Monochrome. It reads each page's own prefix off its Catalogues
  links, handles both header formats (the 86 nested ones and the two report
  pages that write one group per line), preserves each page's `class="here"`,
  and is idempotent, so it is safe to re-run.

  ```sh
  python3 docs/monochrome/tools/add-nav.py docs                    # rewrite
  python3 docs/monochrome/tools/add-nav.py docs --check --verify    # CI line
  ```

  `--check` exits 1 naming every page that differs from a fresh rewrite;
  `--verify` additionally resolves every href in every nav against the tree.
  All **88** pages that carry a site header pass both. The standalone viewers
  (`scott-gray/ember/`, `…/crosslet/`, and their siblings) have no site header
  — they are edge-to-edge immersive pages — so they are not rewritten.

Everything below is about `build-monochrome-catalog.py`.

Dependencies: **python3 + numpy**. Nothing else — the PNGs are written with
`zlib` and `struct`. It reads `../../scott-gray/data/wallpaper-atlas.json`,
`../../scott-gray/wallpaper-groups.json`, the equation table (but **not** the
prose) of `../../colour/data/colour-atlas.json`, and any number of search record
directories. It never writes outside `../data/`.

```sh
cd docs/monochrome/tools
python3 build-monochrome-catalog.py --jobs 16 \
    --records ../../scott-gray/research/monochrome/out/modal/sq-phase \
    --records ../../scott-gray/research/monochrome/out/modal/sq-phase2 \
    --records ../../scott-gray/research/monochrome/out/modal/sq-hopf \
    --records ../../scott-gray/research/monochrome/out/modal/probe \
    --records ../../scott-gray/research/colour/out/long \
    --records ../../scott-gray/research/colour/out/first \
    --records ../../scott-gray/research/colour/out/first2 \
    --records ../../scott-gray/research/colour/out/cal
```

That is the shipped build: **50 seconds** on sixteen workers (plus six for the
motion sweep), 397 fields, 2 061 entries, 4.42 MB of JSON, 3.8 MB of
thumbnails and 173 MB of orbit bytes.

---

## 1. What a monochrome picture is, and the two tiers

The page draws the **sign** of a difference field `w`. Three families of rule:

| kind | `w` | what swaps black and white |
| --- | --- | --- |
| `half-period` | `U(x, t) − U(x, t + T/2)` | a shift of half a period |
| `half-turn`, `mirror`, `glide`, `half-shift` | `U(x, t) − U(s x, t)`, `s` an involution | `s` itself |
| `threshold` | `U(x, t) − median U` | nothing |

The second family rests on an identity, not on a property of the field: if
`s∘s` is the identity modulo the lattice then

```
w(s x, t) = U(s x, t) − U(s s x, t) = −(U(x, t) − U(s x, t)) = −w(x, t)
```

exactly — and in floating point too, because `a − b` and `b − a` are exact
negations in IEEE arithmetic. So the swap law is free and the catalog's job is
to measure everything else: what else swaps, what preserves, and whether the
picture is legible.

**`entry.tier` says how strong the claim is**, and the three values are three
different sentences a page may print:

| tier | the claim | entries |
| --- | --- | --- |
| `strict` | `(s, T/2)` is an exact spacetime symmetry of the FIELD, so `s` alone swaps the inks, `T/2` alone swaps them, and the two together preserve them: a two-colour **spacetime** group | 326 |
| `broad` | `s` is a **free** involution: it swaps the inks by the algebra above and by nothing else — *not* because it is a symmetry of the field. Each frozen frame is a two-colour wallpaper pattern | 1 504 |
| `control` | the threshold, which swaps nothing and is here to be compared against | 231 |

**The tier is a fact about `s` against the field, never about the picture, and
in particular it says nothing about time.** `tiers.broad.title` used to read
"exact in space only" and the pages built a sentence on it — "waiting half a
period does not … so this is not a spacetime one" — which was the opposite of
the truth on **832 of the 1 504** broad readings. On the phase-symmetric
equations (`ginzburg-landau`, `lambda-omega`, `cgl-quintic`) a constant phase is
an exact symmetry, so `U(x, t + T/2) = −U(x, t)` identically and *every* rule's
difference field inherits the half-period law, free involution or not. Whether
it does is measured per entry in `laws.halfPeriod`, counted in
`counts.broadHalfPeriodExact` and `counts.broadHalfPeriodExactByModel`, and it is
the only thing a page may build that sentence on.

**The collapse, and why a field has at most one strict picture.** If
`U(s x, t + T/2) = U(x, t)` then `U(s x, t) = U(x, t − T/2)` and so
`w_s ≡ w_halfPeriod` *identically*. Every strict rule is the half-period rule
wearing a different hat; the builder detects this from the symmetry list, keeps
the half-period entry, and lists the others in `rule.strictReadings`. So the
strict tier is keyed by **field**, not by (field, rule): 326 of the 397 fields
have a strict picture and 71 have none. It is why
`../../scott-gray/weave-monochrome/`'s README can say that the half turn about
the origin, the half-cell slide and the half-period difference "are the same
function". The pictures that are *not* the half-period rule are the ones whose
`s` is not a symmetry of the field at all — the monochrome analogue of
`../../scott-gray/gyre/`'s turn about a point that is not a symmetry centre.

One honesty note the builder records rather than hides. `(s, T/2)` holds on the
saved float32 samples to the search's residual (`--residual`, 2e−7), not to the
last bit, so of the **923** readings the strict tier offers as chips, **225** are
not bit-exact and **61** — on 18 entries — draw a different ink at a handful of
samples a frame. Those samples sit where `|w|` is at the float32 noise floor: on
a symmetric reading that includes the fixed set of `s` (the centres of a half
turn, the line of a mirror), where the antisymmetry forces `w = 0` and the
samples give 1e−9 instead — but it is **not confined to it**. A half slide has
no fixed node at all and still mismatches on a few, and both inks occur there,
so the older "they are the fixed points of `s`, and 1e−9 is white" is wrong on
both halves.

Every reading is therefore measured, not only the first:

```
laws.strictEach   one row per rule.strictReadings row, in the same order:
                  [relative residual, 1 if bit-exact,
                   fraction of node-frames whose DRAWN inks are not exchanged,
                   1 if none]
laws.strict       strictEach[0][0..1], kept for readers that only want the first
laws.strictDrawn  strictEach[0][2..3], likewise
```

`strictEach` is **omitted** exactly when every row would be `[0, 1, 0, 1]` — 244
of the 326 strict entries — so a strict entry without it has every reading exact.
Residuals are rounded to nine *significant* digits, not nine decimal places, so a
residual of 3e−10 never ships as a flat `0.0` beside an exact flag of `0`.

**U and V are one picture.** On every orbit measured, the V-channel picture
reproduces the U-channel picture at some time lag. So **U is canonical and V is
an option on the same entry**, never a second entry: `entry.channelV` carries
`{lagFrames, lag, agreement, inverted, sameFunction, score, boundaryDensity}`
and the page offers it as `?channel=v`. 951 of the 2 061 entries have `V`
*exactly* the U picture at a lag; the rest agree to a fraction of a percent.
(The old v1 catalog shipped 513 V entries as separate pictures.)

## 2. What the build does

### 2.1 One orbit reached twice is one picture

Before anything is chosen or measured, every field — the whole wallpaper atlas
and the whole record corpus — is swept for repeats. Two fields can only be the
same orbit when the equation, the parameters, the box, the grid and the period
agree, so those bucket the work; inside a bucket `motion_match` (ported from
`../../colour/tools/build-colour-catalog.py`) settles it exactly. One point
operation, node translation and — because two independent Newton solves stop
wherever they stop — sub-frame phase shift is allowed, and the whole thing is
one FFT per point operation.

**996 of the 1 991 fields swept were another field moved.** The survivor keeps
every film group, family, atlas id and job name of every member, so one picture
is listed once and still filed under every group that hosts it; the measured
relation is in `atlas.sameOrbit` and in `fields[key].sameOrbit`. Which member
survives: a field a shipped page draws, else an atlas field (it costs no new
repository bytes), else the one with the most placements, else the lowest sha.

### 2.2 Which record fields earn repository bytes

Orbit bytes are the whole cost of this catalog: the corpus on disk is 1 621
admitted records and 1.6 GB, which is not going in a git repository.
`--orbit-mb` (200 by default) is the ceiling on **new** field bytes, and the
selection is a spread rather than a prefix:

1. every Modal orbit that is **not** a single-mode travelling stripe wave — 47
   of 849, identified by `spatialRms == temporalRms` to machine precision, and
   the only ones that are a different motif;
2. the first orbit of every (family, equation) cell, so no equation and no
   family is represented by nothing;
3. up to `--per-cell` (3) per cell after that, preferring a non-stripe record,
   then one whose film group is new for that equation, then one from a
   parameter set the cell does not have.

Shipped: **174 fields, 173 MB**, over 66 (family, equation) cells and nine
equations, 112 square and 62 triangular. All 47 non-stripe Modal orbits are
there — 37 as their own field, 10 collapsed onto a field already shipped.
The other **577 orbits (574 MB) stay on disk** and are listed in
`atlas.recordsOnDisk` with their model, family, group, byte length and the
directory they live in, so folding one in later is `--records` and a bigger
`--orbit-mb`. `--plan` prints the whole selection, with a reason a line, and
stops before copying anything.

### 2.3 Per field

1. **Every exact symmetry of the field.** One 3-D cyclic cross-correlation per
   point operation settles all N² translations and all M time shifts at once
   (`FFT(f ∘ P⁻¹)[k] = FFT(f)[Pᵀk]`, so one transform serves every operation);
   each hit is then confirmed by a direct comparison and keeps its max-abs
   residual. Anything under `--residual` (2e−7, the atlas's own gate) counts.
2. **Every involution of the lattice**, from `(I + P)c ≡ 0 (mod N)` over the 8
   square or 12 triangular point operations — N² half turns, 2N per mirror
   direction, three half-cell slides. `(I + P)c ≡ 0 (mod 2N)` separates a true
   mirror from a glide.
3. **Quotient by the field's own symmetries.** Conjugating `(P, c)` by a field
   symmetry `(Q, u)` gives `(QPQ⁻¹, Qc + u − QPQ⁻¹u)`, and the picture of the
   conjugate is the picture of the original, moved. One representative per class
   is scored. A class containing both a mirror and a glide is named for its
   mirror, because conjugation by an element with a half-cell slide of its own
   turns one into the other.
4. **Score the survivors** on a subsample of frames and keep the best few per
   kind (`--per-kind`), with turn centres at least `--separation` of a cell
   apart, plus the half-period and threshold rules that every field has.
5. **Fold the duplicates.** Two rules of one field are the same picture when one
   is a shift of the other — a translation, a phase, or the inks exchanged. The
   translation-invariant `|FFT|` fingerprint shortlists and an exact
   cross-correlation peak decides; the survivor lists the rest in `rule.sameAs`
   with the shift, so the claim is one a reader can re-run. (v1 tested raw byte
   equality, which missed every pair differing by a translation — on a stripe
   wave, most of them. It is also why only 231 of the 397 fields have a
   threshold entry: on a single-mode wave `sign(U − median U)` *is* the
   half-period picture, shifted.)
6. **Gate and frame** (§3), **measure** at full resolution — the laws, the whole
   two-colour group (the same FFT shortlist on the sign volume, each hit
   confirmed by an integer array comparison, ties carried along), the balance,
   the zero set, the boundary density, the speckle, the churn — and **draw** an
   indexed PNG of phase 0 at that entry's own `view.tiles`.

Everything is exact integer arithmetic on the saved nodes. The FFT only ever
shortlists, and the quality gate of §3 is the one deliberate exception.

## 3. The quality gate and the framing, on the grid the viewer draws

`entry.quality` is measured on the spectrally **doubled** grid — the
reconstruction grid the shipped viewers upsample to on load — with the boolean
`w > 0` they draw. This is not a detail:

* On the node grid with a three-way sign, the exact zero set along a
  colour-reversing mirror line counts as speckle. The Weave, which
  `../../scott-gray/weave-monochrome/README.md` publishes as speckle-free,
  scores **0.084** that way and **0** this way. A gate built on the node-grid
  number rejects hundreds of perfectly good pictures.
* A fixed tile count does not frame them. At `tiles = 2` the coarsest pictures
  show one strand and the finest show ten. So each entry carries its own
  `view.tiles`, chosen so one strand lands `--strand-pixels` (34) wide in a
  `--tile-pixels` (380) box — inside the 20–60 CSS pixel band the two shipped
  pages sit in. `quality.strandNodes` is in saved nodes, so it reproduces the
  Weave's published 8.09; `quality.strandCells` is the same length as a
  fraction of the cell, which is the only form that compares two orbits saved
  at different N.

The gate itself (`gates.limits`): speckle ≤ `--max-speckle` (1e−4), white share
strictly inside (0.30, 0.70), boundary density > 0.002 (not a blank), relative
range of `w` > 0.02 (not flat), strand ≤ `--max-strand-cells` (0.75) of a cell.
**Every broad entry must pass**; the half-period and threshold entries of a
field are kept whatever they score, because the strict tier is one picture per
field and the control is what the others are read against. 1 988 of the 2 061
shipped entries pass, and the 73 that do not are all half-period or threshold
with their reasons in `quality.failed`.

## 4. Budgets

| | ceiling | shipped |
| --- | --- | --- |
| `monochrome-atlas.json` | 4.5 MB (`--json-mb`) | 4 421 080 bytes, 686 entries trimmed |
| one thumbnail | 40 000 bytes (`--thumb-bytes`) | max 6 763, 3.8 MB for 2 061 |
| new orbit bytes | 200 MB (`--orbit-mb`) | 173 187 072 for 174 fields |
| fields | never inline | `fields[key].fieldUrl`, relative to `docs/` |

The JSON is kept small by hoisting what every entry repeats (the point-operation
tables, the rule-kind and tier prose, the gate name and limits, the tile box,
the `sameAs` sentences) into top-level tables, by packing the symmetry list into
rows of five small integers and `sameAs` into rows of nine, and by rounding
floats to nine significant digits — every exact claim is an integer or a flag.
`atlas.shape` says all of this in the file itself. The budget is measured on the
bytes that will be written, with a reserve for `provenance`, and the final file
size is asserted against the ceiling before the build is called a success.

If a build does not fit, `select()` keeps four things unconditionally — every
featured entry, every field's best entry, every field's half-period entry and
every field's threshold entry — and fills the rest from a **round robin** over
the (family, tier, kind, model) cells, so what goes is the fourth broad picture
of a crowded cell and never the only picture of a rare one.

Thumbnails and orbit copies this build did not write are deleted (`--no-prune`
keeps them). An orbit file is only ever written after its bytes are re-hashed
and the sha matches.

## 5. The two classics

`../../scott-gray/plume-monochrome/` and `../../scott-gray/weave-monochrome/`
are already on the site, so the catalog reproduces them or the build fails.
`CLASSICS` names them — **the wave** (field `731aa45654d4`, 16 preserving + 16
swapping) and **the weave** (field `459f00246aed`, 32 + 32) — and after the
selection the builder checks that each is present, strict, at its published
group order and at zero speckle on the doubled grid, and raises otherwise. The
measured numbers are written back into `atlas.classics[name].measured`, and
`catalog.test.mjs` re-derives them from the field bytes, including the Weave's
8.09-node strand with an upsample written in JavaScript.

## 6. Featured

`featured.json` maps entry id → one sentence. It is a **judgement about how a
picture looks**; every entry in the catalog is exact. The 55 shipped flags were
chosen by eye from the per-family contact sheets this script writes with
`--sheets`, three or four per wallpaper family (every family has at least two,
counting the multi-family fields), spread over the ten equations and both
lattices. 38 are strict-tier, because the strict tier is the spine; 6 are free
involutions, so the broad tier has a face; two are the pictures the site already
ships.

To re-do the judgement:

```sh
python3 build-monochrome-catalog.py --jobs 16 --sheets /tmp/sheets --records …
# /tmp/sheets/<family>.png is a montage of that family's best pictures, one per
# field, strict tier first, 128 pixels each, ten to a row; /tmp/sheets/<family>.txt
# is the index:
#   row,col <id> <tier> <kind> <model> score <s> strand <n> tiles <t> speckle <k> <preserve>+<swap>
# look, edit featured.json, re-run.  A key naming an entry the build no longer
# produces is simply ignored, so check the `featured` count afterwards.
```

An id is a function of the field, the rule kind and the rule's own vector, so it
survives a rebuild unless the rule itself stops being picked — which can happen
when a scoring change reorders that field's candidates. So **check that every
`featured.json` key is still in the catalog after a rebuild**; the test does it
for you by asserting that every family still has two featured pictures.

## 7. Adding records — `--records DIR`

Exactly like `../../colour/tools/build-colour-catalog.py`: one folder per
admitted candidate of an offline equation search, each holding `candidate.json`
and its Float32 payload, which is the shape
`../../scott-gray/research/colour/out/<batch>/<job>/` and
`../../scott-gray/research/monochrome/out/modal/<batch>/<job>/` write.

A record is admitted only if its own certificate says so: `schema` one of
`colour-candidate-v1` / `monochrome-candidate-v1`, the gate `colour-offline-v1`
or `monochrome-offline-v1` on both the record and the certificate,
`certificate.passed`, and a field file of exactly `M·2·N²·4` bytes. A record
whose sha is already in the wallpaper atlas, or duplicated inside the corpus, is
refused as `already catalogued` (21 of them in the shipped build, and that is
the only refusal reason there). Everything else goes through the motion sweep of
§2.1 and the budget of §2.2; only what is **chosen** is copied into
`../data/orbits/<sha256>.f32`, and every copy is **re-hashed on the way in** — a
mismatch removes the copy and refuses the record.

From there the two sources are indistinguishable: same symmetry search, same
involution enumeration, same metrics, same gate, same thumbnails. A record needs
no `ops` — the search finds the field's symmetries from the samples. `lattice`
comes from the record, or from `params.stencil` (`triangular-six` → triangular,
anything else → square).

**A record's name is measured, not its job id.** `fields[].names[0]` used to be
the search job id — `g6-cq-a-L56-N36-s0-phase` — on all 174 record fields, and
that string is what the explorer's caption, its status line, four of the
seventeen family headlines and 175 showcase cards printed. `record_name` now
says what the certificate measured instead: a single-Fourier-mode relative
equilibrium (`spatialRms == temporalRms` to the last bit) is a *travelling
stripe wave*, anything else is a *periodic wave*, and the box separates two
otherwise identical names. Inside any one (film group, equation, parameter set)
the names are unique — checked across all 397 fields. The job id keeps its place
as `names[1]`, and `jobLabel` and `recordDir` are untouched.

New equations need an entry in the model table so the pages can print them. That
table is `../../colour/data/colour-atlas.json`'s `models` (nine equations) plus
`MODEL_EXTRA` in this script, which today holds **FitzHugh–Nagumo** (lifted from
`../../scott-gray/research/equations/rdlab.py`) — the one equation the Modal
campaign admitted that the colour table had never seen. The catalog test fails
if an entry names a model the table does not describe, or a model without an
equation to print.

What is inherited is the **mathematics** — axes, parameters, the equation in
text and in HTML, the labels — and nothing else. Every `description` that comes
in with the colour table is dropped and rewritten by `describe_models`, because
the colour paragraphs describe the colour corpus: they counted *its* Gray–Scott
fields (74, split 19/55; this catalog holds 153, split 64 new-shooting / 89
audited-subgroup), named *its* Trefoils and Gyres, said "the colourings read u"
and compared colour shares — on a page with two inks and no colouring at all.
The corpus-dependent clauses (`gray-scott`'s provenance split,
`lengyel-epstein`'s parameter sets, `cgl-quintic`'s (α, β) pairs) are **computed
from the fields that ship**, and every paragraph ends with one generated
sentence counting this catalog's own fields, readings, tiers and half-period
law. A model with no monochrome paragraph ships none rather than the colour
one.

The shipped build ingests all eight directories listed at the top of this file:
849 Modal records and 772 local hexagonal ones, 1 621 admitted, 751 distinct
orbits, 174 shipped. Ten equations now have a picture — Gray–Scott,
Ginzburg–Landau, cubic-quintic CGL, λ–ω, Brusselator, Schnakenberg, Selkov,
Lengyel–Epstein, rock–paper–scissors and FitzHugh–Nagumo — where the v1 catalog
had three.

## 8. Interface

```
--records DIR        a search output directory of admitted records (repeatable)
--no-atlas           skip the wallpaper atlas entirely
--only PREFIX        restrict to fields whose sha256 starts with PREFIX
--limit N            stop after N fields
--plan               print the record selection and stop, before anything is copied

--jobs N             worker processes                        (default: cpus - 2)
--frames N           frames in the cheap candidate sweep                      (8)
--per-kind N         rules kept per kind per field                            (2)
--separation F       least distance between two kept turn centres, in cells (0.08)
--tol F              relative rms for the FFT shortlist                    (2e-6)
--residual F         max abs residual an exact field symmetry may have     (2e-7)

--motion-tol F       relative rms under which two fields are one orbit     (1e-3)
--no-collapse        skip the motion sweep of §2.1
--orbit-mb F         ceiling on NEW field bytes copied in from --records     (200)
--per-cell N         record fields shipped per (family, equation) cell         (3)

--upscale N          reconstruction factor the quality gate is measured on     (2)
--max-speckle F      isolated-node fraction the gate allows                 (1e-4)
--max-strand-cells F widest strand the gate calls a picture, in cells       (0.75)
--tile-pixels N      the CSS box one tile is drawn in, for view.tiles        (380)
--strand-pixels F    the CSS width view.tiles aims one strand at             (34)
--tiles-max N        most cells view.tiles will ask for                        (8)
--loop-seconds F     the loop length the pages animate at                      (8)

--out PATH           the catalog        (default ../data/monochrome-atlas.json)
--thumb-size N       thumbnail edge, in pixels                              (512)
--no-thumbs          skip the thumbnails
--sheets DIR         per-family contact sheets and their indexes
--sheet-top N        tiles per sheet, at most one per field                  (60)
--preview-size N     tile edge in a contact sheet                           (128)
--strips DIR         also write 12-frame inspection strips there
--no-prune           keep thumbnails and orbit copies this build did not write

--json-mb F          ceiling on the catalog JSON, in megabytes              (4.5)
--thumb-bytes N      ceiling on one thumbnail                             (40000)
```

Useful shapes:

```sh
# one field, end to end, in a second
python3 build-monochrome-catalog.py --only 459f0024 --jobs 1 --no-collapse \
    --out /tmp/one.json

# what would be copied in, and why, without copying it
python3 build-monochrome-catalog.py --plan --records ../../scott-gray/research/colour/out/long

# a wider catalog: four pictures per kind per field, budget raised to match
python3 build-monochrome-catalog.py --per-kind 4 --json-mb 6

# the records alone
python3 build-monochrome-catalog.py --no-atlas --records ../../scott-gray/research/colour/out/long
```

## 9. Tests

```sh
node --test docs/monochrome/tests/catalog.test.mjs              # ~10 s, 90 entries
MONO_SAMPLE=600 node --test docs/monochrome/tests/catalog.test.mjs   # ~30 s
MONO_FULL=1 node --test docs/monochrome/tests/catalog.test.mjs  # every entry, slow
```

`catalog.test.mjs` has no dependencies and re-derives everything in JavaScript
from the Float32 bytes the pages will load:

* the rule itself, the swap law, the half-period law, the preserving law and, on
  a strict entry, **every** `strictReading` — each one re-tested as an exact
  spacetime symmetry of the field, and then shown to compute this very picture;
* every `rule.sameAs` claim that carries a shift, re-applied node-frame by
  node-frame (notes 2–5 must hold at every sample; note 0, the collapse, is
  allowed the fixed-point exception of §1);
* the measured **U/V lag**, searched for again over every time shift, and its
  agreement;
* the **dedupe's negative claim** — that no two entries of one field are the
  same picture at another origin — by a shift-invariant profile filter and then,
  on the pairs it cannot separate, a full search over every time shift and node
  translation;
* every number in the metrics block, and a sample of the claimed two-colour
  symmetries at every saved node-frame, plus one operation that is *not* in the
  list, which must fail;
* the **doubled-grid gate** on the Weave, with a band-limited 2× upsample
  written here (a plain O(n²) DFT per line, because N is not a power of two):
  zero speckle, an 8.09-node strand, a 50/50 split;
* the tier vocabulary and its invariants — at most one strict picture per field,
  `strictReadings` only on a strict entry, `sIsFieldSymmetryAt` an integer and
  never null, the control tier exactly the threshold rule;
* the schema gates, the manifest's own counts (including `byFamilyTierModel`),
  the sort order, the packed-row widths, the framing band, the ingested records
  resolving to files in `../data/orbits/` with their reason and their research
  directory, the `sameOrbit` rows keeping every placement, the field lengths and
  a sha256 sample **from each origin**, that every thumbnail exists and is a PNG
  inside its ceiling, that every family has two featured pictures, and that the
  wave and the weave come out at 16 + 16 and 32 + 32.

A catalog that only agreed with itself would prove nothing; this is what makes
its numbers measurements.
