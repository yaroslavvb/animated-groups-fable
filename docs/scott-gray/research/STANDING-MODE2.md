# Two standing patterns at the same parameters

The g95 atlas has a second patterned periodic orbit at `F = 0.00403`,
`k = 0.02`, `Du = 0.16`, `Dv = 0.08`, and full cell side `L = 256`.
Both examples use N48, M128, and the same five-point diffusion stencil.
The first standing pattern has period **346.0986014565**; the second has
period **340.2768277990** and two spatial cells along each side.

This difference is not a time phase or spatial coordinate relabeling.
Time-averaged spatial Fourier-shell powers are unchanged by time shifts,
translations, and square-lattice rotations/reflections. The first pattern
has 43.58% of its spatial variance in the first axis Fourier shell. The
second has zero power in that shell and 93.67% in the second shell.
[`standing-mode2-distinction.json`](standing-mode2-distinction.json) records
these measurements. Both movies pass the resolved minimal-period checks.

The second pattern obeys the actual g95 relation
`q(R90 x, t + T/2) = q(x,t)` in both concentrations. The exported Float32 field
has exact candidate symmetry, independent refined return RMS `3.66e-9`,
trajectory RMS `5.26e-9`, and maximum generator phase RMS `4.22e-9`.
Its numerical-grid temporal and spatial RMS variations are about `.02444`.
The checked payload is
[`g95-mode2-F0p00403-N48-M128.json`](../data/orbits/g95-mode2-F0p00403-N48-M128.json).

## Reproduction

From this directory, with Python 3, NumPy, SciPy, a C++17 compiler, and Node
20 or newer:

```sh
python3 reproduce_standing_mode.py --output standing-mode2
node audit-continuation.mjs standing-mode2/candidates.json \
  --primary-only --output standing-mode2/bundles
```

The defaults reproduce the parameter point above from an analytic Hopf
seed, without a prerecorded field. The solver uses a smaller side-128
periodic cell: first N12, then N24. Repeating that cell twice in each
spatial direction gives the full side-256 fields on N24 and N48,
respectively. The physical spacing is unchanged by this repetition:
`128/24 = 256/48`. Each local stencil and reaction term therefore agrees
exactly with the same field evolved on the full grid. No time replay,
seam blending, or modified equation is used in this extension.

Newton shooting solves a half-period spatially rotated return with a phase
condition. Both the smaller-cell solve and the full-field independent atlas
audit use forward reaction–diffusion evolution. The atlas audit projects
only the measured shooting roundoff (RMS `1.15e-12` here), exports Float32,
and independently integrates the exact decoded bytes at two timesteps.
Only the resulting accepted field is included in the offline catalog build.
The browser reuses the stored parameters, diagnostics, and thumbnail from
`../data/precomputed-atlas.json`, and checks the selected payload's SHA-256
integrity before playback. It does not repeat the numerical audit on page load.

At fixed physical parameters, N24-to-N48 refinement changes the period by
0.0314% and the full movie by 2.05% of the coarse movie's temporal variation.
[`standing-mode2-refinement.json`](standing-mode2-refinement.json) includes
the settings and measurements. These quantify finite-grid sensitivity;
they are not a rigorous continuum error bound or existence theorem.

This even-mode field has extra instantaneous half-cell translations.
Consequently it cannot realize g98's **nontrivial** half-period centering
shift. This is a restriction of this particular pattern, not an impossibility
result for g98 at these parameters: the first standing branch already
supplies a verified g98 example there. The reproduction command uses
`--primary-only` to export just the independently checked g95 pattern.
