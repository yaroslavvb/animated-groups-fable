// Exact names and F,k values from Vladimir Bulatov, symhub (MIT); see data/BULATOV-LICENSE.txt.
// Source snapshot: 37e3520df40ba0ef38e2c916090790b9bbaec3dc, retrieved 2026-09-04.
export const PRESET_SOURCE = 'https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/gray_scott_presets.js';
const RAW_PROFILES = [
  {
    "id": "u-skate",
    "name": "The U-Skate",
    "F": 0.062,
    "k": 0.0609,
    "seed": "skate",
    "featured": true,
    "sourceName": "The U-Skate"
  },
  {
    "id": "u-skate-variable",
    "name": "The U-Skate (variable lengh)",
    "F": 0.0647,
    "k": 0.0609,
    "seed": "skate",
    "featured": true,
    "sourceName": "The U-Skate (variable lengh)"
  },
  {
    "id": "equilibrium-1",
    "name": "Equilibrium 1",
    "F": 0.18804,
    "k": 0.02384,
    "seed": "skate",
    "featured": true,
    "sourceName": "Equilibrium 1"
  },
  {
    "id": "bulatov-04",
    "name": "Equilibrium 2",
    "F": 0.1337,
    "k": 0.0454,
    "seed": "skate",
    "featured": false,
    "sourceName": "Equilibrium 2"
  },
  {
    "id": "bulatov-05",
    "name": "Equilibrium 3",
    "F": 0.1,
    "k": 0.05551,
    "seed": "skate",
    "featured": false,
    "sourceName": "Equilibrium 3"
  },
  {
    "id": "bulatov-06",
    "name": "stable straight branches",
    "F": 0.10041,
    "k": 0.0559,
    "seed": "skate",
    "featured": false,
    "sourceName": "stable straight branches"
  },
  {
    "id": "bulatov-07",
    "name": "Stable regions",
    "F": 0.09861,
    "k": 0.0559,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable regions"
  },
  {
    "id": "moving-u-bands",
    "name": "Moving U-bands",
    "F": 0.09836,
    "k": 0.0559,
    "seed": "skate",
    "featured": true,
    "sourceName": "Moving U-bands"
  },
  {
    "id": "bulatov-09",
    "name": "Positive bubbles (rho)",
    "F": 0.098,
    "k": 0.057,
    "seed": "skate",
    "featured": false,
    "sourceName": "Positive bubbles (rho)"
  },
  {
    "id": "bulatov-10",
    "name": "Stable Loops",
    "F": 0.098,
    "k": 0.0559,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable Loops"
  },
  {
    "id": "bulatov-11",
    "name": "Negative bubbles (sigma)",
    "F": 0.098,
    "k": 0.0555,
    "seed": "skate",
    "featured": false,
    "sourceName": "Negative bubbles (sigma)"
  },
  {
    "id": "bulatov-12",
    "name": "Stable loops and large areas",
    "F": 0.098,
    "k": 0.05606,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable loops and large areas"
  },
  {
    "id": "bulatov-13",
    "name": "Equilibrioum 4",
    "F": 0.09,
    "k": 0.058,
    "seed": "skate",
    "featured": false,
    "sourceName": "Equilibrioum 4"
  },
  {
    "id": "bulatov-14",
    "name": "Straight lines",
    "F": 0.0841,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Straight lines"
  },
  {
    "id": "bulatov-15",
    "name": "Stable straight lines",
    "F": 0.082,
    "k": 0.0616,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable straight lines"
  },
  {
    "id": "bulatov-16",
    "name": "Straight lines and branches",
    "F": 0.082,
    "k": 0.0615,
    "seed": "skate",
    "featured": false,
    "sourceName": "Straight lines and branches"
  },
  {
    "id": "bulatov-17",
    "name": "Circles",
    "F": 0.082,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Circles"
  },
  {
    "id": "bulatov-18",
    "name": "Stable loops",
    "F": 0.082,
    "k": 0.0606,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable loops"
  },
  {
    "id": "bulatov-19",
    "name": "Worms and loops (kappa)",
    "F": 0.082,
    "k": 0.06,
    "seed": "skate",
    "featured": false,
    "sourceName": "Worms and loops (kappa)"
  },
  {
    "id": "bulatov-20",
    "name": "Slow growing regions",
    "F": 0.082,
    "k": 0.0595,
    "seed": "skate",
    "featured": false,
    "sourceName": "Slow growing regions"
  },
  {
    "id": "bulatov-21",
    "name": "Unstable Voronoi Regions",
    "F": 0.082,
    "k": 0.05917,
    "seed": "skate",
    "featured": false,
    "sourceName": "Unstable Voronoi Regions"
  },
  {
    "id": "bulatov-22",
    "name": "Precritical bubbles (loops)",
    "F": 0.082,
    "k": 0.059,
    "seed": "skate",
    "featured": false,
    "sourceName": "Precritical bubbles (loops)"
  },
  {
    "id": "bulatov-23",
    "name": "Voronoi Regions",
    "F": 0.082,
    "k": 0.05883,
    "seed": "skate",
    "featured": false,
    "sourceName": "Voronoi Regions"
  },
  {
    "id": "bulatov-24",
    "name": "Moving loops with pushing lines",
    "F": 0.081,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Moving loops with pushing lines"
  },
  {
    "id": "bulatov-25",
    "name": "Moving loops with pushing lines 2",
    "F": 0.081,
    "k": 0.06071,
    "seed": "skate",
    "featured": false,
    "sourceName": "Moving loops with pushing lines 2"
  },
  {
    "id": "bulatov-26",
    "name": "stable loops",
    "F": 0.081,
    "k": 0.0608,
    "seed": "skate",
    "featured": false,
    "sourceName": "stable loops"
  },
  {
    "id": "bulatov-27",
    "name": "Straight worms",
    "F": 0.08,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Straight worms"
  },
  {
    "id": "bulatov-28",
    "name": "Lines pushing loops",
    "F": 0.0798,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Lines pushing loops"
  },
  {
    "id": "bulatov-29",
    "name": "long bend loops",
    "F": 0.078,
    "k": 0.0609,
    "seed": "skate",
    "featured": false,
    "sourceName": "long bend loops"
  },
  {
    "id": "bulatov-30",
    "name": "Worms (unstable)",
    "F": 0.078,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Worms (unstable)"
  },
  {
    "id": "bulatov-31",
    "name": "Worms (unstable) 2",
    "F": 0.077,
    "k": 0.061,
    "seed": "skate",
    "featured": false,
    "sourceName": "Worms (unstable) 2"
  },
  {
    "id": "bulatov-32",
    "name": "straight worms and spots",
    "F": 0.075,
    "k": 0.06,
    "seed": "skate",
    "featured": false,
    "sourceName": "straight worms and spots"
  },
  {
    "id": "bulatov-33",
    "name": "Stable solitons (nu)",
    "F": 0.074,
    "k": 0.064,
    "seed": "skate",
    "featured": false,
    "sourceName": "Stable solitons (nu)"
  },
  {
    "id": "u-skate-world",
    "name": "The U-Skate World 1",
    "F": 0.069,
    "k": 0.0607,
    "seed": "skate",
    "featured": true,
    "sourceName": "The U-Skate World 1"
  },
  {
    "id": "bulatov-35",
    "name": "The U-Skate World 2",
    "F": 0.062,
    "k": 0.0609,
    "seed": "skate",
    "featured": false,
    "sourceName": "The U-Skate World 2"
  },
  {
    "id": "bulatov-36",
    "name": "Lines making lines",
    "F": 0.061,
    "k": 0.0624,
    "seed": "skate",
    "featured": false,
    "sourceName": "Lines making lines"
  },
  {
    "id": "bulatov-37",
    "name": "Lines making dots",
    "F": 0.061,
    "k": 0.0614,
    "seed": "skate",
    "featured": false,
    "sourceName": "Lines making dots"
  },
  {
    "id": "worms",
    "name": "Worms (mu)",
    "F": 0.058,
    "k": 0.065,
    "seed": "spots",
    "featured": true,
    "sourceName": "Worms (mu)"
  },
  {
    "id": "bulatov-39",
    "name": "straight worms and spots",
    "F": 0.054,
    "k": 0.061,
    "seed": "spots",
    "featured": false,
    "sourceName": "straight worms and spots"
  },
  {
    "id": "bulatov-40",
    "name": "Negatons (iota)",
    "F": 0.046,
    "k": 0.0594,
    "seed": "spots",
    "featured": false,
    "sourceName": "Negatons (iota)"
  },
  {
    "id": "maze",
    "name": "Worms join into maze (kappa)",
    "F": 0.046,
    "k": 0.063,
    "seed": "spots",
    "featured": true,
    "sourceName": "Worms join into maze (kappa)"
  },
  {
    "id": "bulatov-42",
    "name": "Turing patterns (delta)",
    "F": 0.042,
    "k": 0.059,
    "seed": "spots",
    "featured": false,
    "sourceName": "Turing patterns (delta)"
  },
  {
    "id": "bulatov-43",
    "name": "Chaos to Turing negatons (beta)",
    "F": 0.039,
    "k": 0.058,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos to Turing negatons (beta)"
  },
  {
    "id": "bulatov-44",
    "name": "Fingerprints (theta/kappa)",
    "F": 0.037,
    "k": 0.06,
    "seed": "spots",
    "featured": false,
    "sourceName": "Fingerprints (theta/kappa)"
  },
  {
    "id": "bulatov-45",
    "name": "Chaos with negatons (beta/delta)",
    "F": 0.0353,
    "k": 0.0566,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos with negatons (beta/delta)"
  },
  {
    "id": "bulatov-46",
    "name": "Holes and negative worms",
    "F": 0.034,
    "k": 0.057,
    "seed": "spots",
    "featured": false,
    "sourceName": "Holes and negative worms"
  },
  {
    "id": "bulatov-47",
    "name": "Long moving worms and few spots",
    "F": 0.034,
    "k": 0.061,
    "seed": "spots",
    "featured": false,
    "sourceName": "Long moving worms and few spots"
  },
  {
    "id": "moving-worms",
    "name": "Long moving worms",
    "F": 0.034,
    "k": 0.06,
    "seed": "spots",
    "featured": true,
    "sourceName": "Long moving worms"
  },
  {
    "id": "bulatov-49",
    "name": "Spots and worms (eta)",
    "F": 0.034,
    "k": 0.0618,
    "seed": "spots",
    "featured": false,
    "sourceName": "Spots and worms (eta)"
  },
  {
    "id": "bulatov-50",
    "name": "Chaos and holes",
    "F": 0.034,
    "k": 0.056,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos and holes"
  },
  {
    "id": "replicating-spots",
    "name": "Self-replicating spots (lambda)",
    "F": 0.03,
    "k": 0.063,
    "seed": "spots",
    "featured": true,
    "sourceName": "Self-replicating spots (lambda)"
  },
  {
    "id": "bulatov-52",
    "name": "super resonant mases (theta)",
    "F": 0.03,
    "k": 0.0565,
    "seed": "spots",
    "featured": false,
    "sourceName": "super resonant mases (theta)"
  },
  {
    "id": "bulatov-53",
    "name": "Solitons",
    "F": 0.03,
    "k": 0.062,
    "seed": "spots",
    "featured": false,
    "sourceName": "Solitons"
  },
  {
    "id": "bulatov-54",
    "name": "Mazes",
    "F": 0.029,
    "k": 0.057,
    "seed": "spots",
    "featured": false,
    "sourceName": "Mazes"
  },
  {
    "id": "bulatov-55",
    "name": "Mazes with some chaos (gamma)",
    "F": 0.026,
    "k": 0.055,
    "seed": "spots",
    "featured": false,
    "sourceName": "Mazes with some chaos (gamma)"
  },
  {
    "id": "bulatov-56",
    "name": "Mazes with more chaos",
    "F": 0.023662,
    "k": 0.055478,
    "seed": "spots",
    "featured": false,
    "sourceName": "Mazes with more chaos"
  },
  {
    "id": "bulatov-57",
    "name": "Chaos",
    "F": 0.026,
    "k": 0.051,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos"
  },
  {
    "id": "bulatov-58",
    "name": "Chaos 2 (with holes)",
    "F": 0.0257,
    "k": 0.0517,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos 2 (with holes)"
  },
  {
    "id": "bulatov-59",
    "name": "Chaos 3",
    "F": 0.027,
    "k": 0.051535,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos 3"
  },
  {
    "id": "pulsating-spots",
    "name": "pulsating spots and worms",
    "F": 0.0256,
    "k": 0.0576,
    "seed": "spots",
    "featured": true,
    "sourceName": "pulsating spots and worms"
  },
  {
    "id": "bulatov-61",
    "name": "Pulsating solitons *zeta)",
    "F": 0.025,
    "k": 0.06,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating solitons *zeta)"
  },
  {
    "id": "bulatov-62",
    "name": "Pulsating worms and spots",
    "F": 0.0246,
    "k": 0.0565,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating worms and spots"
  },
  {
    "id": "pulsating-worms",
    "name": "Pulsating worms",
    "F": 0.0246,
    "k": 0.0559,
    "seed": "spots",
    "featured": true,
    "sourceName": "Pulsating worms"
  },
  {
    "id": "bulatov-64",
    "name": "Pulsating maze",
    "F": 0.0246,
    "k": 0.0544,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating maze"
  },
  {
    "id": "bulatov-65",
    "name": "Pulsating maze to chaos",
    "F": 0.0246,
    "k": 0.0552,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating maze to chaos"
  },
  {
    "id": "bulatov-66",
    "name": "Pulsating maze to chaos 2",
    "F": 0.0246,
    "k": 0.0564,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating maze to chaos 2"
  },
  {
    "id": "bulatov-67",
    "name": "Pulsating spots to chaos 3",
    "F": 0.0246,
    "k": 0.0579,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating spots to chaos 3"
  },
  {
    "id": "bulatov-68",
    "name": "Stable spots on hex grid",
    "F": 0.0246,
    "k": 0.0626,
    "seed": "spots",
    "featured": false,
    "sourceName": "Stable spots on hex grid"
  },
  {
    "id": "bulatov-69",
    "name": "Chaos on hex grid",
    "F": 0.023,
    "k": 0.051,
    "seed": "spots",
    "featured": false,
    "sourceName": "Chaos on hex grid"
  },
  {
    "id": "bulatov-70",
    "name": "Warring microbes (epsilon)",
    "F": 0.022,
    "k": 0.059,
    "seed": "spots",
    "featured": false,
    "sourceName": "Warring microbes (epsilon)"
  },
  {
    "id": "bulatov-71",
    "name": "Regular holes and chaos",
    "F": 0.022,
    "k": 0.0499,
    "seed": "spots",
    "featured": false,
    "sourceName": "Regular holes and chaos"
  },
  {
    "id": "bulatov-72",
    "name": "Pulsating worms and spots 2",
    "F": 0.022,
    "k": 0.0539,
    "seed": "spots",
    "featured": false,
    "sourceName": "Pulsating worms and spots 2"
  },
  {
    "id": "bulatov-73",
    "name": "Spots and loops",
    "F": 0.018,
    "k": 0.051,
    "seed": "spots",
    "featured": false,
    "sourceName": "Spots and loops"
  },
  {
    "id": "bulatov-74",
    "name": "Spots and loops 2",
    "F": 0.018,
    "k": 0.049,
    "seed": "spots",
    "featured": false,
    "sourceName": "Spots and loops 2"
  },
  {
    "id": "moving-spots",
    "name": "Moving spots (alpha)",
    "F": 0.014,
    "k": 0.054,
    "seed": "spots",
    "featured": true,
    "sourceName": "Moving spots (alpha)"
  },
  {
    "id": "bulatov-76",
    "name": "Waves (xi)",
    "F": 0.014,
    "k": 0.045,
    "seed": "spots",
    "featured": false,
    "sourceName": "Waves (xi)"
  },
  {
    "id": "bulatov-77",
    "name": "Waves 1",
    "F": 0.016477,
    "k": 0.045654,
    "seed": "spots",
    "featured": false,
    "sourceName": "Waves 1"
  },
  {
    "id": "bulatov-78",
    "name": "Waves 2",
    "F": 0.010047,
    "k": 0.034862,
    "seed": "spots",
    "featured": false,
    "sourceName": "Waves 2"
  },
  {
    "id": "bulatov-79",
    "name": "Waves 2",
    "F": 0.003571,
    "k": 0.020782,
    "seed": "spots",
    "featured": false,
    "sourceName": "Waves 2"
  },
  {
    "id": "bulatov-80",
    "name": "Wave 3",
    "F": 0.007025,
    "k": 0.019678,
    "seed": "spots",
    "featured": false,
    "sourceName": "Wave 3"
  },
  {
    "id": "spiral-waves",
    "name": "Waves 4",
    "F": 0.007457,
    "k": 0.033896,
    "seed": "broken-wave",
    "featured": true,
    "sourceName": "Waves 4"
  }
];

export const PROFILES = RAW_PROFILES.map(p => Object.freeze({...p, Du: .2097, Dv: .105, stencil: 'bulatov9', source: PRESET_SOURCE}));
export const PARAMETER_BOUNDS = Object.freeze({F: [0, .2], k: [0, .08]});
export const DEFAULT_FILTER = 'periodic';
export const FILTERS = Object.freeze([
  {id: 'all', label: 'Explore freely', description: 'Any nonnegative feed and kill in this chart; untested points are allowed.'},
  {id: 'source', label: 'Bulatov presets', description: 'Snap to 81 named source presets. A source preset is a lead, not a verified periodic solution.'},
  {id: 'observed', label: 'Observed moving patterns', description: 'Snap to preset points with nonuniform motion in a documented local test. Load the recorded grid, seed and numerical settings.'},
  {id: 'periodic', label: 'Verified periodic solutions', description: 'Only independently verified nonuniform periodic orbits for this time-symmetry group. This collection is currently empty.'},
]);

const mod = (a,n=1) => ((a % n) + n) % n;
const nearestPeriodicDistance = (a,b) => mod(a-b+.5)-.5;
export function reactiveEquilibrium(F,k) {
  if (!(F>0)) return [1,0];
  const disc=1-4*(F+k)**2/F;
  if(disc<0) return [1,0];
  const u=(1-Math.sqrt(disc))/2;
  return [u,F*(1-u)/(F+k)];
}

/** Deterministic concentration seed, planar U then V. The seed is local geometry,
 * not an evolved Bulatov field. Orbit maximum gives exact zero-phase symmetry
 * without diluting small localized perturbations by averaging. */
export function makeInitial(profile,{N=64,L=128,ops=[]}={}) {
  if (!Number.isInteger(N) || N<4 || N%4 || !(L>0)) throw new Error('Seed grid must be a positive multiple of four, with positive L.');
  const state=new Float32Array(2*N*N), nn=N*N;
  const kernel=ops.filter(o=>Math.abs(o.tau)<1e-12);
  if(!kernel.length)kernel.push({M:[[1,0],[0,1]],v:[0,0],tau:0});
  const seed=profile.seed||'spots', bg=seed==='skate'?reactiveEquilibrium(profile.F,profile.k):[1,0];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let intensity=0;
    for(const op of kernel){
      const u=x/N-op.v[0],v=y/N-op.v[1];
      const sx=mod(op.M[0][0]*u+op.M[1][0]*v),sy=mod(op.M[0][1]*u+op.M[1][1]*v);
      const dx=nearestPeriodicDistance(sx,.27)*L,dy=nearestPeriodicDistance(sy,.23)*L;
      let a;
      if(seed==='skate'){
        const r=8,leg=10;
        const d=dy>0?Math.abs(Math.hypot(dx,dy)-r):Math.hypot(Math.abs(dx)-r,Math.min(0,dy+leg));
        a=Math.exp(-.5*(d/2.25)**2);
        a=Math.max(a,.9*Math.exp(-.5*((dx/2.2)**2+((dy+1)/2.2)**2)));
      }else if(seed==='broken-wave'){
        // An off-axis broken arc is a candidate spiral-wave initial condition.
        const a1=Math.atan2(dy,dx),r=Math.hypot(dx,dy);
        a=Math.exp(-.5*((r-13)/2.4)**2)*(a1>-.8&&a1<2.4?1:0);
      }else{
        a=Math.max(Math.exp(-.5*((dx/4.0)**2+(dy/4.0)**2)),.78*Math.exp(-.5*(((dx-13)/2.8)**2+((dy+7)/2.8)**2)));
      }
      intensity=Math.max(intensity,a);
    }
    const i=y*N+x;
    state[i]=bg[0]+((seed==='skate'?1:.5)-bg[0])*intensity;
    state[nn+i]=bg[1]+((seed==='skate'?0:.25)-bg[1])*intensity;
  }
  return state;
}

export function classifyRun(stats,thresholds={spatial:.012,motion:.0001}) {
  if(!stats || stats.finite!==true || !['spatialRms','temporalRms','minimum','maximum'].every(k=>Number.isFinite(stats[k])) || stats.spatialRms<0 || stats.temporalRms<0 || stats.minimum>stats.maximum)return 'numerical-failure';
  if(!(thresholds.spatial>0&&thresholds.motion>0&&Number.isFinite(thresholds.spatial)&&Number.isFinite(thresholds.motion)))return 'numerical-failure';
  if(stats.minimum < -1e-6 || stats.maximum > 2)return 'out-of-range';
  if(stats.spatialRms < thresholds.spatial)return 'uniform-or-decayed';
  if(stats.temporalRms < thresholds.motion)return 'stationary-pattern';
  return 'moving-pattern';
}

const GROUP_IDS=['g94','g95','g96','g97','g98','g99'];
const CONTEXT_KEYS=['groupId','N','L','Du','Dv','dt','stencil','integrator','seed','boundary','precision','horizon','observationStart','observationEnd','sampleInterval'];
const sameNumber=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-12;
function rows(evidence){const list=Array.isArray(evidence)?evidence:evidence?.runs;return Array.isArray(list)?list.filter(r=>r&&typeof r==='object'):[];}
function profileMatches(record,profile){return record.profileId===profile.id&&sameNumber(record.F,profile.F)&&sameNumber(record.k,profile.k);}
function validContext(c){
  return c&&GROUP_IDS.includes(c.groupId)&&Number.isInteger(c.N)&&c.N>=4&&c.N%4===0
    &&['L','Du','Dv','dt','horizon','sampleInterval'].every(k=>Number.isFinite(c[k])&&c[k]>0)
    &&Number.isFinite(c.observationStart)&&c.observationStart>=0&&Number.isFinite(c.observationEnd)
    &&c.observationEnd>c.observationStart&&sameNumber(c.observationEnd,c.horizon)
    &&c.sampleInterval<=c.observationEnd-c.observationStart
    &&c.boundary==='periodic'&&['float32','float64'].includes(c.precision)
    &&['bulatov9','five-point'].includes(c.stencil)&&c.integrator==='midpoint'&&typeof c.seed==='string'&&c.seed.length>0;
}
function validScreen(record){
  return validContext(record.context)&&record.classification===classifyRun(record.stats)
    &&Number.isFinite(record.stats?.kernelSymmetryRms)&&record.stats.kernelSymmetryRms>=0&&record.stats.kernelSymmetryRms<=1e-3;
}
const bounded=(value,max)=>Number.isFinite(value)&&value>=0&&value<=max;
function passingReturn(c){return c?.computed===true&&Number.isFinite(c.dt)&&c.dt>0&&Number.isInteger(c.steps)&&c.steps>0
  &&bounded(c.closureRms,.01)&&bounded(c.relativeClosure,.1)&&bounded(c.trajectoryRms,.01)&&bounded(c.relativeTrajectory,.1);}
/** A catalog acceptance gate, not a verifier: the diagnostics must come from
 * independent numerical verification of the associated saved orbit asset. */
function passingPeriodicRecord(record,profile,groupId){
  const d=record.diagnostics,c=record.context,a=record.orbit;
  if(record.verifiedPeriodic!==true||!profileMatches(record,profile)||!c||c.groupId!==groupId||!d||d.validated!==true||d.nontrivial!==true)return false;
  if(!a||typeof a.url!=='string'||!a.url.length||!/^[a-f0-9]{64}$/i.test(a.sha256||'')||a.layout!=='planar-uv')return false;
  if(!Number.isInteger(c.N)||c.N<4||c.N%4||!Number.isFinite(c.L)||c.L<=0||c.boundary!=='periodic'||!['bulatov9','five-point'].includes(c.stencil))return false;
  if(!sameNumber(d.N,c.N)||!sameNumber(d.physicalSide,c.L)||d.stencil!==c.stencil||!Number.isInteger(d.M)||d.M<4||d.M%4||!Number.isFinite(d.period)||d.period<=0)return false;
  if(!bounded(d.pdeRms,2e-4)||!bounded(d.relativePde,.05)||!bounded(d.symmetryMax,1e-10))return false;
  if(!Number.isFinite(d.temporalRms)||d.temporalRms<.008*.99||!Number.isFinite(d.spatialRms)||d.spatialRms<.012*.99)return false;
  if(!Number.isFinite(d.minimum)||!Number.isFinite(d.maximum)||d.minimum < -1e-8||d.maximum>1.2+1e-8||d.minimum>d.maximum)return false;
  const opCount=['g98','g99'].includes(groupId)?8:4;
  if(!Array.isArray(d.symmetry)||d.symmetry.length!==opCount||!d.symmetry.every((s,i)=>s.operation===i&&bounded(s.max,1e-10)&&bounded(s.rms,1e-10)))return false;
  if(d.faithfulTimeShifts!==true||d.primitiveAtTestedShifts!==true||!Array.isArray(d.temporalRepeats))return false;
  if(![.25,.5,.75].every(shift=>d.temporalRepeats.some(r=>sameNumber(r.shiftFraction,shift)&&Number.isFinite(r.relativeToTemporalVariation)&&r.relativeToTemporalVariation>1e-3)))return false;
  if(!passingReturn(d.closure)||!passingReturn(d.refinedClosure)||!(d.refinedClosure.dt<d.closure.dt))return false;
  if([d.closure,d.refinedClosure].some(r=>Math.abs(r.steps*r.dt-d.period)>1e-8))return false;
  return Array.isArray(d.reasons)&&d.reasons.length===0;
}

export function profilesForFilter(mode,evidence,groupId){
  if(mode==='all'||mode==='source')return [...PROFILES];
  if(!GROUP_IDS.includes(groupId))return [];
  if(mode==='periodic')return PROFILES.filter(p=>rows(evidence).some(r=>passingPeriodicRecord(r,p,groupId)));
  if(mode==='observed')return PROFILES.filter(p=>rows(evidence).some(r=>profileMatches(r,p)&&r.context?.groupId===groupId&&validScreen(r)&&r.classification==='moving-pattern'));
  return [];
}

/** Chart-distance snapping: never treats an interval between tested points as tested. */
export function nearestProfile(F,k,candidates=PROFILES){
  if(!Number.isFinite(F)||!Number.isFinite(k)||!Array.isArray(candidates))return null;
  const finite=candidates.filter(p=>p&&Number.isFinite(p.F)&&Number.isFinite(p.k));
  if(!finite.length)return null;
  return finite.reduce((a,b)=>distance(a)<distance(b)?a:b);
  function distance(p){return ((p.F-F)/.2)**2+((p.k-k)/.08)**2;}
}

/** Context F and k are the current controls; profile F,k identify the preset.
 * A recorded observation horizon is part of the evidence, not a lifetime claim. */
export function matchingEvidence(profile,context,evidence){
  if(!profile||!validContext(context)||!sameNumber(context.F,profile.F)||!sameNumber(context.k,profile.k))return null;
  return rows(evidence).find(r=>profileMatches(r,profile)&&validScreen(r)&&CONTEXT_KEYS.every(key=>{
    const a=r.context[key],b=context[key];return typeof a==='number'&&typeof b==='number'?sameNumber(a,b):a===b;
  }))||null;
}

export function assessProfile(profile,context,evidence){
  const record=matchingEvidence(profile,context,evidence);
  if(!record)return {status:'untested',record:null,message:'These feed/kill values, grid, seed, group, numerical settings or observation horizon have no matching local test.'};
  const meaning={
    'moving-pattern':'Nonuniform motion occurred in that observation window. Periodicity and the nonzero time shifts remain unverified.',
    'stationary-pattern':'A nonuniform pattern survived but motion fell below the recorded threshold. This seed did not produce a moving candidate in this run.',
    'uniform-or-decayed':'This seed became nearly uniform by the end of that run. This is not a nonexistence result.',
    'out-of-range':'The recorded concentration range failed the exploration screen; change the timestep or initial condition.',
    'numerical-failure':'This numerical run failed. It does not establish impossibility of a mathematical solution.'
  };
  return {status:record.classification,record,message:`Observed at t=${record.context.observationStart}–${record.context.observationEnd} after evolution to t=${record.context.horizon}. ${meaning[record.classification]||'Read the numerical record for this point.'}`};
}
