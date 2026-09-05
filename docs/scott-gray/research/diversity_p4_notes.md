# Searching beyond the original 442 wave

The original atlas mostly followed one standing and one rotating branch as feed and kill changed. To obtain different images at a fixed physical parameter set, the search now starts in several reciprocal-lattice eigenspaces and varies the mixture of a star with its reflected star.

A reciprocal star means the four wavevectors obtained by repeatedly rotating `(m,n)` through 90 degrees. The seed is projected into the requested complex character only when constructing an initial guess. Every shooting trajectory then evolves the ordinary, unprojected two-species Gray–Scott equations. The unknown initial concentrations and period solve `Phi(T/4)q = q(R90^-1 x)` for g96 or `Phi(T/2)q = q(R90^-1 x)` for g95.

`diversity_p4_search.py` supports `--wave m n`, `--charge 1|2`, `--unrestricted`, `--mix`, and `--mix-phase`. The last two arguments vary the relative amplitude and temporal phase of the reflected reciprocal star. The old standing-wave axial mirror restriction is optional; disabling it lets the solver find oblique and mixed patterns. A prescribed nonzero seed projection and an unknown feed produce the initial Hopf branch. Supplying `--feed` fixes physical parameters instead.

CPU examples:

```sh
python diversity_p4_search.py --wave 3 1 --charge 1 --mix 1 \
  --grid 16 --amplitude .015 --method hybr --output seed
python diversity_p4_search.py --wave 3 1 --charge 1 --mix 1 \
  --grid 24 --feed .00395 --initial seed/candidate.json \
  --method hybr --output coarse
```

The batch helper runs one or two CPU processes with a 180-second limit on each stage. The Fourier preconditioner is useful for some fine-grid corrections but can stall on a mixed branch. A stalled solve is not an impossibility result.

`diversity_p4_modal.py` supplies the alternative dense Newton correction. It reuses the existing batched FP64 CUDA RK4 kernel. Each perturbation of the shooting state is integrated independently, the Jacobian is assembled from finite differences, and a GPU linear solve supplies the Newton direction. The wrapper supports the full state and the exact instantaneous symmetry kernel, rather than forcing the original branch's axial mirrors. Extra translations are used only when the input already has them to roundoff. All retained fields must still pass the independent full-field verifier.

The GPU entry point takes a JSON list of `{name, path, targets?}` records. `path` refers to N48/N64/N96,M128 candidate metadata; its field contains at least the first Float64 concentration state. Optional feed targets are reached through bounded continuation steps. A Hopf-amplitude predictor helps avoid Newton convergence toward the zero-amplitude homogeneous equilibrium, and the time-phase condition is refreshed for each continuation step. The container returns only initial states and reports. `diversity_p4_reconstruct.py` reconstructs full movies using the independent C++ RK4 implementation before the site's actual Float32 admission checks.

Two first successful morphology comparisons are particularly useful: single-star versus mixed-star rotating Q5 patterns at F=.004 have a sampled phase/translation/D4-adjusted shape distance about .80; single-star versus mixed-star standing Q10 patterns at F=.00395 have distance about .79. These pairs have the same leading wavelength but visibly different shapes. The descriptor removes each frame's spatial mean, compares both concentration species over a complete normalized period, and never treats time reversal as a PDE symmetry. It is a sampled numerical distinction, not a complete classification under arbitrary continuous changes of coordinates.

A different filename, random seed, time origin, reflected coordinate copy, or translated first frame is not counted as a new branch. Different wavelengths are described as wavelength choices. Every final atlas record must pass the existing period, nontriviality, PDE, primitive-period, and prescribed time-offset tests on its actual exported Float32 bytes. This work establishes finite-grid numerical evidence, not rigorous continuum existence or stability.

The task's Modal budget remains $100. This P4 subsearch has a $20 allocation, uses at most four A100-40GB containers, no retries, no persistent deployment, a 16 GiB host-memory limit, a 300-second startup limit, a 300-second function limit, and an earlier 220-second numerical-work cutoff. Costs and failed setup attempts belong in `diversity_p4_ledger.json`; no failed candidate should be included merely to reach a desired pattern count.

The later search uses one richer shared parameter point, F=.0038, k=.02, L=256, to make higher spatial modes available. `diversity_p4_richer_seeds.py` prepares16 single/reflected-star seeds for Q13,Q16,Q17,Q18,Q20 using two local CPU workers. The GPU continuation reports `targetReached` separately from numerical convergence; an orbit that stopped at an intermediate feed is not advertised at the requested parameter value. Eight established branches are also continued to this same point.

Strong time action is checked over every linearly interpolated playback interval. For each rotation assigned a nonzero time shift, form d(t)=V(gx,t)-V(x,t), minimize its quadratic squared norm exactly between each pair of stored frames, and compare with the whole-orbit spatial RMS. The chosen floor is .20 normalized plus .002 absolute concentration RMS, accompanied by both-species checks. Rotations belonging to the instantaneous kernel, such as R180 for g95, must not be rejected. Spatially symmetric g94 belongs in its separate category. These contrast tests show that the time shift remains necessary during playback; they are separate from the full-PDE/time-character correctness tests.

High-shell N16 guesses can fail after direct interpolation to N48. The optional `correctSeedWithFreeFeed` stage addresses that discretization change by solving for feed together with state and period while fixing a nonzero spatial-mode amplitude. It uses the same GPU RK4 flow with a different feed for each Jacobian perturbation; feed is fixed again during target continuation. This is a search aid, never a relaxation of the final fixed-parameter PDE test. All failed seeds remain in the search inventory instead of the atlas.

The completed richer-point search delivered twelve distinct base candidates at F=.0038, k=.02, L=256: four primary standing-character branches and eight primary rotating-character branches. This is twelve across the two characters, not twelve in each selected group. Every delivered pair has independently reconstructed coarse and finer-grid movies at identical physical parameters. The finer grids are N64 or N96. Continuous time/space/D4 alignment of all 66 base-pair comparisons gave a minimum normalized shape distance of .7733; the single-star and reflected-star Q20 pair is the closest pair, so their difference is more than a phase or translation choice. Actual exported Float32 admission and the visible-time-action filter remain the final authority.

Fourteen bounded Modal apps accounted for 98 submitted case definitions, including failed setup attempts and unsuccessful roots. Every app is stopped. The conservative resource-lifetime estimate is $5.65884; provider billing was not queried. Some standing branches could be continued near F=.00387 or .00381 but did not reach .0038. These failures do not prove nonexistence. The search does not establish rigorous continuum existence, stability, glider behavior, or twelve solutions within every color group.
