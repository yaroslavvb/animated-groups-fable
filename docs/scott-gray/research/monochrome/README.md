# Orbits for the monochrome pages

`../plume-monochrome/` and `../weave-monochrome/` each paint **one** field in black and
white. This directory looks for many more, on **every** lattice, so that a monochrome
explorer has something to explore: new periodic orbits of equations the site does not yet
publish, on the square-lattice film groups as well as the hexagonal ones.

It extends `../equations/rdlab.py`, `../equations/admit.py` and `../colour/rdlab_colour.py`
and re-uses `../colour/search_colour.py`'s strategies unchanged; none of those files is
edited. Records carry the gate `colour-offline-v1` and the SHA-256 of
`rdlab.py` + `admit.py` + `rdlab_colour.py`, exactly as the colour records do.

## The monochrome rule, and why the group only gives you one of them

For a `T`-periodic field `U` the **half-period rule** is

```
w(x, t) = U(x, t) - U(x, t + T/2)          black where w > 0, white where w < 0
```

`w(x, t + T/2) = -w(x, t)` is an identity of the subtraction, so the half-period shift
swaps black and white for *any* field, and every same-time symmetry of `U` preserves the
colouring.

If the film group contains an operation `(s, T/2)` with `s` an involution — a half turn, a
mirror, a glide, or a half-lattice translation — then the film relation
`U(s x, t + T/2) = U(x, t)` says `U(s x, t)` and `U(x, t + T/2)` are the *same samples*.
So

```
U(x, t) - U(s x, t)  =  U(x, t) - U(x, t + T/2)  =  w(x, t)
```

and `s` alone swaps black and white too, while `(s, T/2)` preserves it. That is exactly the
published plume-monochrome wave: one field `w`, two independent antisymmetries. It also
means every `T/2` involution of the group gives back the *same* picture — the group hands
you one monochrome field per orbit, however many `T/2` elements it has. 44 of the 68 film
groups have at least one; `modal_search.involution_hosts` lists them.

The variety therefore has to come from somewhere else, and it does:

**Free involutions.** For *any* involution `s` of the mesh — a half turn about any centre,
a lattice mirror at any offset, a half-lattice translation — `w = U(x, t) - U(s x, t)`
satisfies `w(s x, t) = -w(x, t)` identically, so `s` swaps black and white whether or not
it is a symmetry of the film. If `s` *is* a same-time symmetry, `w` vanishes and there is
no picture; the interesting ones are the involutions the group does **not** contain.
`modal_search.free_involution_rules` scans the half-turn centres on a step-3 grid, the
lattice mirrors on a step-6 grid and the three half-lattice translations, drops the ones
where `w` vanishes, measures balance, zero-set fraction, contrast, boundary density and
speckle on the saved Float32 bytes, and keeps one representative of each distinct
signature. Every admitted record carries its ranked list.

Two honest limits on that scan. The signature it dedupes on is the measured statistics, so
two involutions whose pictures differ only by a *translation* survive as separate rows: on
a single-wavevector field (see below) the eleven surviving half-turn centres all give the
same wavy stripe shifted, and only the multi-mode fields get genuinely different pictures
out of it. Deduping on a translation-invariant signature — the magnitude of the spatial
FFT of `sign(w)` — would collapse those. And the scan is over involutions only; a rule
built from an order-three or order-four operation is a colouring, not a two-colouring, and
belongs to `../colour/`.

## The search

`modal_search.py` is `../equations/modal_equations.py`'s bounded pattern applied to
`../colour/search_colour.py`'s `run_phase` (relative equilibria `B(x) e^{iΩt}` of the
phase-symmetric families) and `run_twisted` (Hopf-seeded and kernel-projected Newton–Krylov
twisted shooting), with the hexagonal-only group loader replaced by the full 68.

| | |
| --- | --- |
| 24 containers per app, 2 physical cores + 8 GiB each | same as `modal_equations.py` |
| `retries=0`, no schedules, endpoints, GPUs or deployments | same |
| 300 s task timeout, 260 s worker alarm | `modal_equations.py` used 420 s |
| 120 s startup timeout, 10 s scale-down | same |
| 1024 jobs per batch, $26 per batch, $70 for the session | `modal_equations.py` used 256 / $12 |
| dry run by default; `--launch` to spend | same |

Worst case per job: `(300 + 120 + 10) × $0.00004396 = $0.0189`, plus $3 per app.
`out/reservations.json` refuses a launch that would take the session past $70, and
`compute-ledger.json` records the result, including the measured worker seconds next to the
reservation so the gap between the two is visible.

Shortening the task timeout from 420 s to 300 s is what buys the extra jobs, and it is not
free: about one `sq-hopf` job in seven hit the 260 s worker alarm and returned `budget`.
A 420 s box would convert a few of those at 1.4× the reservation per job. For the
phase plans, whose median job is 11 s, the shorter box costs nothing at all.

```sh
python modal_search.py --groups                      # the 68 entries, their T/2 hosts, what the atlas has
python modal_search.py --plan sq-phase               # dry run: job count, worst-case USD, wall clock
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY MODAL_PROFILE=yaroslavvb \
  python -m modal run modal_search.py --jobs out/sq-phase/jobs.json \
                                      --output out/modal/sq-phase --launch
python modal_search.py --audit out/modal/sq-phase    # re-derive every certificate locally
python modal_search.py --index                       # out/monochrome-index.json for the pages
python modal_search.py --report                      # admitted orbits per equation / group / lattice
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY MODAL_PROFILE=yaroslavvb \
  python -m modal app list --json > out/app-list.json
python modal_search.py --ledger --app-states out/app-list.json    # compute-ledger.json
```

The Modal client speaks gRPC and cannot use this machine's HTTP proxy; unset the proxy
variables for every `modal` command or the client fails instantly with
"Could not connect to the Modal server".

## Plans

| plan | what it buys |
| --- | --- |
| `sq-phase` | relative equilibria of Ginzburg–Landau, λ–ω and cubic-quintic CGL on the square-lattice entries, ordered so the entries the published atlas has only Gray–Scott for come first. The site has no λ–ω or cubic-quintic orbit anywhere. ~10 s a job, ~38 % admitted. |
| `sq-hopf` | Hopf-seeded twisted shooting of Brusselator, Lengyel–Epstein, Schnakenberg and Sel'kov on the square entries that host a `T/2` involution. |
| `probe` | the three families the local hexagonal run never reached (FitzHugh–Nagumo, Oregonator, rock–paper–scissors) on both lattices, the kernel-projected route for the order-two hexagonal entries that carry no relative equilibrium, and Gray–Scott at new parameters on the hexagonal entries the atlas has only the published Gray–Scott orbit for. |

`EXTRA_SETS` adds seven parameter sets to `rdlab_colour.PARAMETER_SETS`: four more
phase-symmetric ones (which oscillate at every coefficient in those ranges by
construction) and two Brusselator sets just past `b = 1 + a²`.

### What paid off, and what did not

Admission rate per parameter set over the 2 905 jobs of the first session, worth reading
before planning another one:

| tier | sets | admitted |
| --- | --- | --- |
| phase, square + hexagonal | `cgl-f` `cgl-e` `lw-e` `cgl-d` `cq-d` `lw-a` `cgl-g` `cq-c` | 47–63 % |
| phase | `lw-b` `lw-c` `lw-d` `cq-a` `cgl-a` `cgl-b` | 27–37 % |
| phase | `cq-b` `cgl-c` | 10–17 % |
| hopf-seed | `bru-a` `le-a` `le-c` `le-d` `bru-b` `sch-b` `fhn-b` | 5–20 % |
| hopf-seed | every other Brusselator, Schnakenberg, Sel'kov, Lengyel–Epstein, rps, Oregonator and FitzHugh–Nagumo set | **0 %** |
| projected, Gray–Scott | `gs-a` `gs-b` `gs-c` | **0 %** |

Four of the eight best sets are `EXTRA_SETS` this file added, so widening the
phase-symmetric coefficient range is the cheapest thing to do next. The zero rows are the
expensive ones: rock–paper–scissors averaged 200 s a job and admitted nothing.

Two of those zeroes are structural rather than unlucky:

* **Gray–Scott cannot be found by `rpo_twisted`.** A `g`-symmetric *steady* state satisfies
  the twisted equation `S_g Φ_{T/m}(q) = q` at every `T`, and `rpo_polish` is not bounded
  by the period window it was given, so Newton drives `T → 0` (observed: `T = 5.6e-9`,
  residual 1.8e-11) and `search_colour` correctly reports `converged-to-steady-state`.
  Gray–Scott needs `rdlab.rpo_from_attractor`, not the twisted route.
* **FitzHugh–Nagumo, the Oregonator and rock–paper–scissors synchronise.** 101 of the 276
  `probe` jobs ended `synchronised-to-uniform`: their uniform limit cycle is stable enough
  that the Hopf-seeded spiral relaxes onto it before Newton can close an orbit. Only one
  FitzHugh–Nagumo orbit survived, on `g64`.

### What the phase plans actually produce

Read the records before choosing from them. On the square lattice the phase-symmetric
families converge overwhelmingly onto **single-Fourier-mode relative equilibria** — a
travelling stripe wave `A = B₀ e^{i(k·x + Ωt)}` with `|A|` constant — rather than spiral
lattices. They are genuine periodic orbits: the residual is at round-off (`F(B) = iΩB`
holds pointwise for a constant modulus), the character is exact to 1e-16, and the
independent RK4 re-integration closes. They are also excellent monochrome subjects, which
is the point here. But they are one motif: `spatialRms == temporalRms` to machine
precision identifies them, and 802 of the 849 records admitted in this session are of that
kind. The 47 that are not include **every one** of the 36 Brusselator, Lengyel–Epstein,
Schnakenberg and FitzHugh–Nagumo orbits from `sq-hopf` and `probe` — not one of those is
single-mode — plus eleven multi-mode `p1`/`pmm`/`cmm`/`pgg` λ–ω and CGL states. A catalogue
that wants spiral lattices on the square entries should weight towards `sq-hopf`, or seed
the phase search off a spiral rather than off noise.

## Output

`out/modal/<batch>/<job>/` holds `result.json` (the worker's record, including the
certificate and the monochrome measurements) and, for an admitted orbit, `candidate.f32` +
`candidate.json` in `rdlab_colour.export_candidate`'s `colour-candidate-v1` layout.
`--audit` re-derives the certificate from the saved bytes on this machine and writes
`audit.json` with one row per record; `--index` collapses the audited rows into
`out/monochrome-index.json`, one compact entry per record with its family, lattice, model,
period, field sha and its ranked usable monochrome rules — enough to build an explorer
without reading a single field.

## What the first session found

`compute-ledger.json` has the accounting and `out/monochrome-index.json` the records; these
are the shapes of the answer, in round numbers, so that a reader knows what to expect
before running anything.

* 2 905 jobs over five apps, all 2 905 returned, **849 admitted orbits**, every one
  re-admitted locally from its own saved bytes with the sha unchanged (849 of 849).
* Every admitted orbit is a *distinct* field: 849 records, 849 distinct field SHA-256s, and
  no two share a `(group, equation, period, cell side)`. 821 square, 28 hexagonal.
* 736 of them carry at least one monochrome rule that passes the quality gate, and the
  pictures are distinct **up to translation**: 3 974 within-record and **3 413 distinct
  across the whole session**, which is the size of a showcase grid built from this run
  alone.
* 17 entries gained their first orbit outside Gray–Scott, and four of them — `g231` (p3m1),
  `g233` and `g269`, `g271` (p31m, p6m) — are hexagonal order-two entries the local
  hexagonal search had admitted **nothing** for. They do carry Ginzburg–Landau and λ–ω
  relative equilibria; what they do not carry is a *spiral* one.
* λ–ω (267) and cubic-quintic CGL (177) now have orbits on the site for the first time; so
  do Lengyel–Epstein (23, on 14 square entries), Schnakenberg (2) and, once on `g64`,
  FitzHugh–Nagumo. Ginzburg–Landau gains 369 and the Brusselator 10.
* 10 entries that have **no time-shift element at all** (`g1`, `g8`, `g10`, `g11`, `g54`,
  `g56`, `g58`, `g68`, `g95`, `g128`) now have monochrome pictures. Only the
  free-involution construction can give them one; the film group gives them nothing.
* The hexagonal records are monochrome-usable but **not** Gyre- or Trefoil-usable: being
  single-mode, their argmax ties along whole lines (576 tied node-frames of 124 416 in a
  typical one). They enlarge the colour catalogue's field pool without adding a colouring.

## Feeding the records to the catalogues

**Hexagonal records → `docs/colour/`, unchanged.** They pass
`build-colour-catalog.py`'s `load_records` gate as they are:

```sh
python3 ../../../colour/tools/build-colour-catalog.py --records out/modal/sq-phase \
                                                      --records out/modal/probe
```

(checked: of `out/modal/sq-phase`'s 492 admitted records the builder accepts the 28
triangular ones and skips the 464 square ones, every one of them with the single reason
`not on the triangular six-neighbour stencil`.)

**Square and hexagonal records → `docs/monochrome/`.** `docs/monochrome/tools/build-monochrome-catalog.py`
takes `colour-candidate-v1` records under either gate and derives the lattice from the
stencil, so the whole session feeds it unchanged:

```sh
python3 ../../../monochrome/tools/build-monochrome-catalog.py \
    --records out/modal/sq-phase  --records out/modal/sq-phase2 \
    --records out/modal/sq-hopf   --records out/modal/probe
```

(checked against its `record_fields`: 817 records accepted, 0 refused, 789 square and 28
triangular. Run `--audit` on every batch first — `candidate.json` is written by the local
re-admission, not by the worker.)

The **hexagonal** half of the corpus is already on disk from the local search, in exactly
the same record layout, and the same builder takes it with no changes:

```sh
--records ../colour/out/long --records ../colour/out/first --records ../colour/out/first2
```

(checked: 770 records accepted, 0 refused — 218 `p3`, 355 `p6`, 197 `p31m`.) This session's
records cover 15 of the 17 families and are missing exactly `p3` and `p6`; the local
hexagonal records are those two plus `p31m`. **Together the two sources cover all 17
wallpaper families**, which is what a monochrome explorer subdivided by group type needs.

**The site's own wallpaper atlas is a different matter.** Two doors, both shut:

* `build-colour-catalog.py` filters on `stencil == 'triangular-six'`, and rightly so — its
  Gyre and Trefoil rules, its `POINT_OPS` and its whole colour-symmetry sweep are
  hexagonal. Square orbits are not a colour-catalogue problem.
* `../equations/build_equation_atlas.py` reads the *older* `modal_equations.py` output
  (`outcome == 'candidate'`, a `refined` block, a `coarse.f32` it re-integrates) and its
  `MODEL_NAMES` knows only Ginzburg–Landau and Brusselator. It cannot read a
  `colour-candidate-v1` record and has no name for λ–ω, cubic-quintic CGL,
  Lengyel–Epstein or FitzHugh–Nagumo.

The clean route for the square records is a `build_monochrome_atlas.py` beside this file
that reads `out/monochrome-index.json` plus the `candidate.f32`/`candidate.json` pairs and
emits a `scott-gray-equation-atlas-v1`-shaped file, which
`../wallpaper/merge_atlas.py --equations <file>` then merges into
`data/wallpaper-atlas.json` exactly as it merges the equation atlas today. Every record
already carries the certificate that merge step re-checks.
