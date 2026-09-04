# Analytic exclusions for periodic Gray–Scott motion

The implemented certificate concerns **zero feed only**. It is independent
of the selected colour group. It excludes nonstationary periodic solutions;
stationary concentrations are still possible. A failed numerical search is
not an exclusion certificate.

Consider nonnegative classical concentrations on a periodic spatial box,
with constant parameters `Du > 0`, `Dv > 0`, `k ≥ 0`, and `F = 0`:

```
u_t = Du Δu − uv²
v_t = Dv Δv + uv² − kv.
```

Suppose the concentrations have time period `T > 0`. Integrate the first
equation over the spatial box and one complete time period. Both the time
derivative and periodic-boundary Laplacian integrate to zero. Consequently,

```
∫₀ᵀ ∫Ω uv² dx dt = 0.
```

The integrand is nonnegative and continuous, so `uv² = 0` everywhere.
The equations reduce to a heat equation for `u` and a diffusion equation
with linear loss for `v`. Multiply each by its concentration and integrate
over the same space-time period. Integration by parts gives

```
Du ∫₀ᵀ ∫Ω |∇u|² dx dt = 0
Dv ∫₀ᵀ ∫Ω |∇v|² dx dt + k ∫₀ᵀ ∫Ω v² dx dt = 0.
```

Both fields are spatially constant. Their reduced equations then force
them to be constant in time as well (`v = 0` when `k > 0`). Thus no
nonstationary nonnegative time-periodic solution exists at zero feed.
The same energy argument applies to the periodic finite grids used here:
both supported symmetric diffusion stencils have nonpositive energy forms.

`feasibility.mjs` checks these parameter assumptions and returns this
certificate. It uses exact `F === 0`; small positive feed is not covered.
Other parameter values remain unclassified by this certificate.

In particular, **no zero-kill exclusion is asserted**. The sum of the full
equations contains the term `F(1 − u − v) − kv`, so the zero-feed argument
does not establish a corresponding result at `k = 0`, `F > 0`.
