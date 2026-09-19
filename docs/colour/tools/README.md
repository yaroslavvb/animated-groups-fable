# `build-colour-catalog.py` — the three-colour catalog

One script builds everything under `../data/`: the catalog the two explorer
pages read, the orbit fields they load, and the thumbnails they show.

```
../data/colour-atlas.json         the catalog          (schema colour-atlas-v1)
../data/colour-atlas-build.json   the build record     (schema colour-atlas-build-v1)
../data/orbits/<sha256>.f32       admitted search fields, byte-identical copies
../data/thumbs/colour-<kind>-<sha12>.png   one 512-pixel frame per entry
```

Dependencies: **python3 + numpy**. Nothing else — the PNGs are written with
`zlib` and `struct`. It reads `../../scott-gray/data/wallpaper-atlas.json`,
`../../scott-gray/wallpaper-groups.json` and any number of search record
directories, and it never writes outside `../data/`.

```sh
cd docs/colour/tools
python3 build-colour-catalog.py \
    --records ../../scott-gray/research/colour/out/first \
    --records ../../scott-gray/research/colour/out/first2 \
    --records ../../scott-gray/research/colour/out/cal \
    --records ../../scott-gray/research/colour/out/long
```

That is the whole shipped build: about four minutes on ten workers.

---

## What it does

### 1. Two sources, one pipeline

| source | what it is |
| --- | --- |
| the wallpaper atlas | every `triangular-six` orbit of `wallpaper-atlas.json`, one record per distinct field; the union of the ops every film group lists for it |
| `--records DIR` | one folder per admitted candidate of the offline equation search (`../../scott-gray/research/colour/`), each holding `candidate.json` (`colour-candidate-v1`) and its Float32 payload |

A record is admitted here only if its own certificate says so: the schema, the
gate `colour-offline-v1` on both the record and the certificate, `passed`, the
`triangular-six` stencil, a model present in the builder's `MODELS` table, the
field file present and of the length the certificate names. Everything refused
is listed with its reason in the build record.

From there the two sources are indistinguishable. Each field gets the same
treatment: the Gyre turn-centre sweep, the Trefoil check, the exhaustive
symmetry search over all twelve point operations × N² translations × M time
shifts × 6 recolourings, the metrics, the generator marks and the thumbnail.

### 2. De-duplication, and the chirality pairs

The search reaches one orbit from several seeds, amplitudes and transients, and
solves the two chiralities separately on mirror-image film groups. Records are
bucketed by `(model, parameters, L, N, M)`; inside a bucket, pairs whose periods
agree to 1e-6 relative and whose quantile fingerprints are close get the exact
test, `motion_match`:

* `‖a∘g − b‖² = ‖a‖² + ‖b‖² − 2⟨a∘g, b⟩`, and the inner product over **every**
  node translation and **every** time shift at once is a 3-D cyclic
  cross-correlation, so one FFT per point operation settles all N²·M motions;
* two independent Newton solves of one orbit stop at different phases, and the
  offset need not be a whole saved frame, so the time axis is oversampled
  64-fold at the winning translation — one padded 1-D transform — and the
  sub-frame shift is found too;
* a **proper** motion within 1e-3 relative RMS means one orbit reached twice:
  the copy whose best measured colouring has the lower boundary density is kept
  and the other is dropped, with the relation recorded;
* a **mirror** means the two chiralities: **both are kept**, and each carries
  `source.chirality` naming its partner, the mirror that relates them and the
  residual.

The gap is wide: true matches land between 1e-8 and 3e-4, unrelated fields
between 0.09 and 1.9.

### 3. Generator marks, derived and then tested

Every entry carries `generators` in the exact shape
`../../scott-gray/trefoil/generators.mjs` exports, so the pages' overlay code
works unchanged — `name, glyph, kind, order, k, n, centreSixths |
vectorSixths, turn, degrees, sixths, perm, cycle, symbol, html, ascii, base,
sub, sup, chipDeg, labelDeg, labelR, side, lead, rotationShort, timeShort,
colourShort, rotationText, timeText, colourText, reading` — plus the exact
geometry (`centre`, `centreExact` as numerator/denominator pairs, `v` in whole
nodes, `frames`) and the evidence (`violations`, `masterRule`,
`masterRuleTime`).

Nothing is assumed. For each entry the builder:

1. enumerates every rotation centre of the coloured picture inside one saved
   cell, in exact `Fraction` arithmetic, from the **measured** symmetry list —
   a listed row `(P, v)` names `|det(I − P)|` centres modulo the lattice;
2. picks the presentation — for Trefoil the 632 triple α (a sixfold centre),
   β (threefold), γ (twofold) with the fundamental triangle smallest and β due
   east, for Gyre the third-turn `g` about `p` and its square — and **requires
   the relation to close**: the motions compose to the identity, the waits to a
   whole number of periods, the colour permutations to the identity;
3. reads each mark's time shift and permutation off its measured row, never
   from the rule;
4. checks the master rule `σ(c) = (−1)^m c − j` against what was measured;
5. re-tests every mark directly, at all N²·M node-frames, in integer
   arithmetic, and records the count of violations — which is 0 for every entry
   in the shipped catalog.

Run against the field the site already publishes, this reproduces
`trefoil/generators.mjs` exactly: `centreSixths` `[0,0] [2,0] [2,1]`,
`vectorSixths` `[2,4]`, the turns, the subscripts 5 · 2 · 1, the permutations,
and the symbol **6₅⁽¹²⁾ 3₂⁽⁰²¹⁾ 2₁⁽⁰¹⁾ · τ⁽⁰²¹⁾**. That agreement is the
reason to believe the other entries' marks.

`entry.centres` is the whole periodic set — every rotation centre in one cell
with its order, its place, its class in the picture lattice and one compact row
`[m sixths, frames, perm, j]` per power — so the overlay can put a mark at
every centre in view and not only at the generators.

### 4. Models

`atlas.models` is the equation table the pages read: `name`, `axes`, `labels`,
`parameters`, `diffusion`, `channels`, `equation` (plain text), `equationHtml`
and a one-paragraph `description`. Seven equations are in it today —
Gray–Scott, Ginzburg–Landau, cubic–quintic Ginzburg–Landau, the λ–ω normal
form, Brusselator, Schnakenberg and Sel'kov.

Per `research/colour-pages-design.md` §4 the pages read this table rather than
closing over a list, so **adding an equation is adding one object to `MODELS`
in this script and re-running**. No page code changes. The catalog test fails
if an entry names a model the table does not describe, and if a model's `axes`
are not among its `parameters`.

### 5. Budgets

| | ceiling | shipped |
| --- | --- | --- |
| `colour-atlas.json` | 3.0 MB (`--json-mb`) | see `counts` in the file |
| one thumbnail | 40 000 bytes (`--thumb-bytes`) | max 17 633 |
| fields in the JSON | never inline | `source.fieldUrl`, `field.sha256`, `byteLength` |

Fields are copied byte-identically into `../data/orbits/<sha256>.f32` and
re-hashed on the way in; a record whose bytes do not hash to the sha its
certificate names stops the build.

The JSON is kept inside its budget two ways. **Losslessly**, by hoisting what
every entry repeats — the six failure captions, the point-operation matrices and
`vLattice`, the standing prose on `gate`, `centres` and `colouring` — into
top-level tables,
and by rounding floats to nine significant digits (every exact claim is an
integer or a numerator/denominator pair beside it). `atlas.shape` says so in the
file itself. **Lossily**, by capping how many patterns one verified parameter
set contributes: `--per-set N`, lowered automatically until the JSON fits, with
two extra allowed per Trefoil cell because Trefoil is the scarcer colouring. If
one pattern per set is still too many, the selection falls back to the head of a
**round robin** over the cells, so what goes is the twentieth pattern of a
crowded cell and never the only pattern of a rare one. Atlas entries and
featured entries are never dropped, so the budget always holds and the ladder
never loses a rung. Every entry that was mined but not shipped is named in
`colour-atlas-build.json`, so widening the catalog is `--per-set 3 --json-mb 5`
and nothing else.

Thumbnails and orbit files this build did not write are deleted (`--no-prune`
keeps them).

### 6. Featured

`FEATURED` in the script is a dict of entry id → one sentence. It is a
**judgement about how a picture looks**, nothing else; every entry in the
catalog is exact. The sixteen atlas entries were chosen by eye from the
512-pixel thumbnails and the 12-frame strips, and the fourteen search entries
were chosen the same way, from contact sheets of all 118 new pictures laid out
per equation — two or three per equation, spread over the motifs the search
actually produced and over both chiralities where it found a pair.

To re-do that judgement: run with `--strips DIR`, tile the PNGs, look, edit
`FEATURED`, re-run.

---

## Interface

```
--records DIR        a search output directory of admitted records (repeatable)
--records-limit N    stop after N records (a smoke test)
--no-atlas           skip the wallpaper atlas entirely
--no-dedupe          keep every admitted record, even copies of one orbit
--only PREFIX        restrict to fields whose sha starts with PREFIX
--limit N            stop after N fields

--jobs N             worker processes                      (default: cpus - 2)
--coarse N           turn centres per lattice direction in the Gyre sweep  (20)
--keep N             sweep survivors rescored on all frames                 (6)

--out PATH           the catalog            (default ../data/colour-atlas.json)
--orbits-dir DIR     where record fields are copied      (default ../data/orbits)
--strips DIR         also write 12-frame inspection strips there
--no-thumbs          skip the thumbnails
--no-prune           keep thumbnails and orbit files this build did not write

--per-set N          patterns kept per (kind, equation, parameter set, group)  (3)
--runners N          alternate Gyre turn centres listed per entry              (2)
--json-mb F          ceiling on the catalog JSON, in megabytes               (3.0)
--thumb-bytes N      ceiling on one thumbnail                              (40000)
```

Useful shapes:

```sh
# one field, end to end, in three seconds
python3 build-colour-catalog.py --only 8fcde9bc --jobs 1 --no-thumbs --out /tmp/one.json

# the new equations alone, without the atlas
python3 build-colour-catalog.py --no-atlas --records ../../scott-gray/research/colour/out/long

# a wider catalog, budget raised to match
python3 build-colour-catalog.py --records ... --per-set 3 --json-mb 5
```

---

## Re-running when the long search finishes

The search in `../../scott-gray/research/colour/` writes records continuously,
so a build is a snapshot. To take a fresh one:

```sh
cd ../../scott-gray/research/colour

# 1. Is it still running?  The ledger has one line per job, all batches.
wc -l out/ledger.jsonl
tail -3 out/ledger.jsonl
pgrep -fl search_colour.py

# 2. Stop it cleanly — it finishes the job in flight and exits.
touch out/STOP

# 3. Bring every record's turn-shift sweep to full resolution.  A record
#    produced by a worker with a coarse turnStep has only seen turn centres on
#    threefold centres of the field, where the Gyre rule degenerates.
python rescore_colour.py --batch long --workers 14 --step 1

# 4. Look at what came in.
python report_colour.py --records

# 5. Rebuild.  The builder re-reads every candidate.json, so anything admitted
#    since the last run is picked up, and anything already copied into
#    ../data/orbits is left alone (it is re-hashed, not re-written).
cd ../../../colour/tools
python3 build-colour-catalog.py \
    --records ../../scott-gray/research/colour/out/first \
    --records ../../scott-gray/research/colour/out/first2 \
    --records ../../scott-gray/research/colour/out/cal \
    --records ../../scott-gray/research/colour/out/long

# 6. Check it.
cd ../.. && node --test colour/tests/catalog.test.mjs
```

Do **not** rebuild while the search is mid-batch unless you mean to: a record
directory can be half-written, and `load_records` will skip it for a length
mismatch and say so in the build record — correct, but it makes the counts
non-reproducible. `touch out/STOP` first, or point `--records` only at batches
the ledger shows as finished.

A rebuild that ships fewer entries prunes the thumbnails and orbit files the
previous one left; a rebuild that ships more copies the new fields in. Either
way the whole of `../data/` is a function of the inputs and this script, and the
script's own sha256 is in `provenance.builderSha256`.

---

## Tests

```sh
node --test docs/colour/tests/catalog.test.mjs          # ~20 s, sampled
COLOUR_FULL=1 node --test docs/colour/tests/catalog.test.mjs   # every phase
```

`catalog.test.mjs` has no dependencies and re-derives everything in JavaScript
from the Float32 bytes the pages will load: the colouring itself, every measured
symmetry, every generator mark, the tie count and the colour shares. It also
checks the schema gates of the design's §2.8, the manifest's own counts, the
sort order, the hoisting, the field lengths and hashes, and that every
thumbnail exists and is inside its ceiling. A catalog that only agreed with
itself would prove nothing; this is what makes its numbers measurements.
