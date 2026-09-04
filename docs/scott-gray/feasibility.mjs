/** A sufficient analytic exclusion, not a classification of parameter space.
 * Scope: nonnegative classical Gray–Scott concentrations on a periodic box,
 * positive diffusion coefficients, and time-independent uniform parameters.
 */
export function analyticExclusion(params,{boundary='periodic'}={}) {
  if(boundary!=='periodic'||!params)return null;
  const {F,k,Du,Dv}=params;
  if(![F,k,Du,Dv].every(Number.isFinite)||F<0||k<0||Du<=0||Dv<=0)return null;
  // Exact zero only. A small positive feed is not covered by this argument.
  if(F!==0)return null;
  return {
    id:'zero-feed-no-nonstationary-periodic-orbit',
    status:'analytically excluded',
    conclusion:'No nonstationary nonnegative periodic Gray–Scott solution exists at F = 0.',
    scope:'All six colour groups; any period or periodic-box size; Du > 0, Dv > 0, k ≥ 0.',
    assumptions:['nonnegative concentrations','periodic spatial boundary','uniform time-independent parameters','positive diffusion'],
    proof:'Integrating the U equation over one space-time period gives integral(U V²) = 0. Nonnegativity forces U V² = 0 everywhere. The remaining heat equation for U and diffusion-plus-linear-loss equation for V admit only stationary time-periodic solutions.',
    reference:'ANALYTIC-EXCLUSIONS.md'
  };
}
