# Exploring verified periodic orbits

The solution viewer and its two-dimensional parameter selector contain **only
orbits accepted for the selected cyclic time character**. Every generator acts
as `q(gx,t+tau*T)=q(x,t)` on both U and V. No forward-only chemical preset,
geometric animation, or merely moving pattern can enter the atlas.

The parameter plane snaps to the nearest admitted orbit of the current group,
using distances normalized by its F and k axis ranges. Selection loads the exact
period, grid, diffusion coefficients and stencil of that orbit. If a group has
no accepted record, there is no point to snap to. This is not a proof of
nonexistence.

## Three stages of exploration

1. Choose the cyclic time symmetry g94–g99.
2. Choose a precomputed physical parameter set. The dropdown and zoomed F/k
   plane contain only parameter sets with an admitted nonuniform periodic field.
   Diffusivities, cell length and stencil are shown beside the selector.
3. Choose an actual pattern thumbnail at those parameters. Different periods or
   spatial wavelengths can be distinct solutions of the same equations. Where
   only one pattern is known, the interface explicitly says so. A different
   time origin of the same loop is not a new discovered branch.

Each thumbnail is rendered from verified concentration data. Playback uses a
fixed concentration scale for the whole orbit. Choosing a new pattern preserves
its physical parameter set; choosing new parameters updates the available
patterns. Only measured points are admitted, not the entire region between them.
The open space between points does not imply either existence or impossibility.

## Starting from a known orbit

Select a verified orbit and use **Continue the selected verified orbit** as the
initial movie. Modify the search parameters, then search that point or a 3×3
neighborhood. These actions run the periodic solver, followed by independent
acceptance tests. The displayed orbit stays verified throughout; failed search
candidates are reported in the search log and are never displayed as solutions.

The 81 source parameter pairs from
[Bulatov's simulator](https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/gray_scott_presets.js)
are available only as starting guesses. The optional GPU chemical initial-guess
mode computes a transient internally before projecting its entire space–time
movie into the requested character. This is preparation for an orbit search,
not a claimed time-symmetric solution.

## Two efficient shooting constructions

The bundled standing and rotating concentration waves were found by solving a
shorter return equation:

- g95 standing branch: `Phi(T/2,q) = q(R90^-1 x)`, with its same-time half-turn.
- g96 rotating branch: `Phi(T/4,q) = q(R90^-1 x)`.

`Phi` is unprojected numerical Gray–Scott evolution. A phase condition removes
the arbitrary time origin. Analytic Hopf eigenmodes provide the initial state;
additional mirror symmetries of these particular branches reduce the number of
unknowns. This does not assert that every solution has those extra mirrors.
Spatial translations and reflections of the two branches supply related
examples of the other requested groups. Each derived example is separately
checked against its full canonical operations.

See [VERIFIED-ORBITS.md](VERIFIED-ORBITS.md) for the numerical evidence and
[research/reproduce_orbits.py](research/reproduce_orbits.py) to reproduce both
branches without using a prerecorded field. A broad census requires continuation,
multiple initial branches, and stability/bifurcation analysis; these examples do
not exhaust the parameter space.

## Admission and exclusions

`solution-atlas.mjs` ignores supplied validation flags and recomputes the PDE,
all phase constraints, full independent return and trajectory error, and a second
integration at half the actual timestep. Future phases come from actual
integration beyond T, never from wrapping a transient recording. A fixed
concentration scale over all frames keeps visual comparisons meaningful.

`phase-audit.mjs` also compares rotation alone with rotation plus phase, requires
nonzero phases to exceed the measured numerical uncertainty, and tests resolved
shorter periods using the complete temporal spectrum. Testing odd divisors
prevents a triple repetition of a g97 movie from being mislabeled as g96.

The zero-feed axis has an analytic exclusion for nonstationary nonnegative
periodic solutions under positive diffusion and periodic boundaries. See
[the proof](ANALYTIC-EXCLUSIONS.md). Other failed searches remain unresolved.

## Historical forward-only screen

`data/preset-evidence.json` preserves 78 earlier runs: 13 source presets in each
of six instantaneous spatial kernels. Fifty-two showed motion, fourteen became
stationary, and twelve became nearly uniform. They did not test the nonzero
phase relations and are not selectable solution records. Reproduce that
historical screen with `node tests/sample-presets.mjs .` from this directory;
its labels must never substitute for periodic-orbit admission.
