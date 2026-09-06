# Periodic Gray–Scott orbits for the 17 wallpaper groups

This extension uses all 68 forward-time entries of the correspondence catalog: 51 nonzero time-shift characters and 17 zero-offset references. Spatial mirrors and glides are allowed; they do not reverse time. The original Gray–Scott equations are unchanged:

\[
 u_t=D_u\Delta u-uv^2+F(1-u),\qquad
 v_t=D_v\Delta v+uv^2-(F+k)v.
\]

Every target operation is an affine lattice action with the convention
\(q(Mx+a,t+\tau T)=q(x,t)\), for both concentrations. The square families use the five-point Laplacian; the triangular families use the six-neighbor triangular Laplacian. These are finite-grid numerical orbits, not proofs of continuum existence or classifications of their maximal symmetry.

## Search and refinement

The general solver in `search.py` reads the complete canonical affine operation set from `../../wallpaper-groups.json`. It constructs the instantaneous kernel (operations with zero time offset), reduces only the initial-state variables by that kernel, and solves a twisted shooting equation for a primitive phase generator:

\[
 \Phi_{T/m}(q_0)=q_0\circ g^{-1}.
\]

A time-phase condition removes the continuous phase freedom. The Newton iterations integrate the unmodified equations without applying a symmetry projection during evolution. Near a nonuniform Hopf point, an amplitude condition also determines the feed rate. Analytic reciprocal-wave seeds are averaged with the desired complex character, rather than changing the dynamical equations. The earlier Bulatov-preset exploration did not by itself establish closed time-shift orbits; the successful saved branches are Hopf/shooting searches, with their actual parameters recorded.

The initial expansion comprised 328 searches: 41 new nonzero-offset entries, four reciprocal vectors `(1,0)`, `(1,1)`, `(2,1)`, `(1,2)`, and two amplitudes. All used `N=12`, `M=96`, `L=256`, `k=.02`, `Du=.16`, and `Dv=.08`. Seventy-seven complete candidate movies converged and passed the initial finite-grid checks. Each was continued to `N=24`, `M=192` at fixed feed, kill, and physical lattice length. Seventy-six corrections converged; 74 passed the final admission criteria. The three branches without an admitted refined result are omitted from the published extension.

A separate 36-job search targeted the remaining difficult `g270` mirror character, with `N=24`, `M=192`, reciprocal vectors `(2,1)`, `(3,1)`, `(3,2)`, lengths 256, 512, 1024, and amplitudes .008, .012, .018, .035. Twelve candidates converged, and five passed the required variation and visibility criteria. Thus 441 bounded cloud jobs returned exactly once. Seventy-nine refined or targeted outputs passed; exact-byte deduplication leaves 75 new group entries, alongside 331 explicitly identified subgroup witnesses from previously verified movies. The extension therefore contains 406 selectable entries across the 15 added families; all 56 added correspondence variants have at least one admitted entry.

The failed searches and rejected candidates are retained in the batch summaries. A failure is not an impossibility result. In particular, small-amplitude mirror solutions can converge mathematically while falling below the gallery's deliberate visibility threshold.

## Saved-byte admission

`audit.py` reads the actual exported Float32 movie. It validates the dimensions and physical parameters, including `dx=L/N`, stencil, and diffusion coefficients. It checks:

- Every canonical affine operation at every saved phase, both concentrations, with maximum discrepancy at most `2e-7`.
- Every nonzero-offset operation against the same-time movie. For each concentration, the smallest spatial RMS discrepancy over every linear playback interval, including the seam, must be at least `.002` and at least 5% of that concentration's full movie range. The quadratic minimum inside each interval is evaluated analytically.
- Nonuniform spatial RMS at least `.012`, temporal RMS at least `.008`, finite concentrations in `[0,1.2]`, and a resolved primitive period. Primitive-period tests measure distance to lower-period Fourier subspaces, not a misleading small-lag difference.
- At most 1% of the nonconstant temporal Fourier energy above one quarter of the frame sampling rate.
- Explicit target-operation bounds on the periodically extended independent cycle: target phase RMS and maximum error are bounded by the corresponding saved-field error plus twice the trajectory error. Both bounds must be at most `1e-6`. The pointwise trajectory maximum also bounds the loss of same-time contrast separately for both concentrations and throughout linear playback; the original visibility thresholds must still hold. The largest phase maximum bound among the published entries is `4.66e-7`. This certifies the wrapped numerical cycle, with closure measured separately, and does not claim exact equality at arbitrary unwrapped times.
- Independent full-cycle forward integrations starting from the exported Float32 initial state at timestep limits `.2` and `.1`. Each trajectory and closure RMS error must be at most `1e-5`. These are fresh integrations of the native RK4 implementation, not an independent integration algorithm. No projection is used.

The 17 zero-offset entries are explicit moving spatial references. They have no nonzero time-offset visibility claim. They are admitted using the same periodicity and spatial verification of their saved source fields.

`audit_subgroups.py` separately tests existing byte-identical p4/p6 fields against the target group's complete operations and visibility conditions. These entries retain their original dynamics certificate and source identity; they are labelled `audited-subgroup`, not new numerical searches. A field can have more symmetry than the selected wallpaper group. Reusing it establishes satisfaction of the selected action, not that this action is its full symmetry group.

The builder deduplicates byte-identical fields within each target entry, retains at most 20 patterns per entry, stores only admitted fine-grid new movies, and reuses original URLs for existing fields. Complete provenance, hashes, criteria, and certificates are stored in `../../data/wallpaper-atlas.json`. Its `searchResults` array gives the exact row-level counts and outcomes. Browser navigation only downloads saved fields; it performs no search.

## Reproduction

Python 3, NumPy, SciPy, Pillow, Node.js, and a C++17 compiler are needed locally. The cloud wrapper additionally needs the Modal SDK and a signed-in account.

```sh
python search.py --job a-single-job.json --groups ../../wallpaper-groups.json --output /tmp/orbit
python audit.py /tmp/orbit/candidate.json
python -m unittest discover -s . -p 'test_*.py'
```

`search-jobs.json` records all 328 exploratory jobs. `refinement-jobs.json` includes the compact converged initial states used for continuation; `mirror-search-jobs.json` records the targeted mirror jobs. The Modal wrapper limits a batch to 256 jobs, so split `search-jobs.json` into the first 256 and remaining 72 jobs before rerunning. A cloud run requires an explicit `--launch`:

```sh
modal run modal_search.py --jobs a-batch.json --output /tmp/new-results --launch
python audit_batch.py /tmp/new-results /tmp/audit-results.json
```

The wrapper enforces two physical CPU cores and 8 GiB memory per container, at most 24 concurrent containers per app, no retries, a 120-second subprocess timeout, a 150-second function timeout, and a 120-second startup timeout. There are no deployed endpoints or schedules. CPU fan-out was sufficient; this expansion allocated no GPUs.

## Compute accounting

`compute-ledger.json` records every task-created app, its final stopped state, all job counts, hard resource limits, and pricing source. All 441 jobs returned, and all task apps have zero active tasks. The conservative new resource and build/accounting reservation is **$20.43**. Including the earlier $18.82 conservative reservation, the combined bound is **$39.25**, within the user's $100 ceiling. This bound is deliberately conservative and is not a provider invoice.

The verifier fingerprint is SHA-256 of the concatenated file bytes in this fixed order: `audit.py`, `search.py`, `../gray_scott_rk4.cpp`, `../p6/gray_scott_triangular.cpp`, `audit_subgroups.py`, `check_source_certificates.mjs`. The ordered names are also recorded in the catalog. Configuration fingerprints use JavaScript `JSON.stringify` serialization to match browser validation exactly.
