/** Acceptance of an already independently verified, nonuniform candidate.
 * This checks numerical evidence; it neither constructs nor proves an orbit. */
const DEFAULT_LIMITS=Object.freeze({pdeRms:2e-4,relativePde:.05,symmetryMax:1e-10,closureRms:.01,relativeClosure:.1,trajectoryRms:.01,relativeTrajectory:.1});
const SHOOTING_METRICS=['closureRms','closureURms','closureVRms','closureMax','relativeClosure','trajectoryRms','trajectoryMax','relativeTrajectory'];
const nonnegativeFinite=v=>Number.isFinite(v)&&v>=0;
const positiveFinite=v=>Number.isFinite(v)&&v>0;

/** Halve the step actually taken, including diffusion/frame-spacing caps. */
export function refinedShootingOptions(closure){
  if(closure?.computed!==true||!positiveFinite(closure.dt)||!Number.isInteger(closure.steps)||closure.steps<=0)throw new Error('A completed coarse integration is required before timestep refinement.');
  return {shootingDt:closure.dt/2,shootingSteps:2*closure.steps,maxShootingSteps:130000};
}

function limitsFor(d){
  if(!d?.thresholds)return null;
  const limits={};
  for(const [key,maximum] of Object.entries(DEFAULT_LIMITS)){
    const requested=d.thresholds[key];
    if(!nonnegativeFinite(requested))return null;
    limits[key]=Math.min(requested,maximum);
  }
  return limits;
}
function within(value,limit){return nonnegativeFinite(value)&&value<=limit;}
function passingShoot(s,d,limits){
  if(s?.computed!==true||!positiveFinite(s.dt)||!Number.isInteger(s.steps)||s.steps<4*d.M||s.steps%d.M!==0)return false;
  if(Math.abs(s.steps*s.dt-d.period)>2e-12*Math.max(1,d.period))return false;
  if(!SHOOTING_METRICS.every(key=>nonnegativeFinite(s[key])))return false;
  if(!['closureRms','relativeClosure','trajectoryRms','relativeTrajectory'].every(key=>within(s[key],limits[key])))return false;
  const final=s.finalState;
  return (Array.isArray(final)||ArrayBuffer.isView(final))&&final.length===2*d.N*d.N&&Array.from(final).every(Number.isFinite);
}

export function hasRefinedAcceptance(d){
  if(!d||d.validated!==true||d.nontrivial!==true||d.faithfulTimeShifts!==true||!Array.isArray(d.reasons)||d.reasons.length)return false;
  if(!positiveFinite(d.period)||!Number.isInteger(d.N)||d.N<4||d.N%4||!Number.isInteger(d.M)||d.M<4||d.M%4)return false;
  if(!positiveFinite(d.temporalRms)||!positiveFinite(d.spatialRms)||!Number.isFinite(d.minimum)||!Number.isFinite(d.maximum)||d.minimum < -1e-8||d.maximum>1.2+1e-8||d.minimum>d.maximum)return false;
  const limits=limitsFor(d);if(!limits)return false;
  if(!['pdeRms','relativePde','symmetryMax'].every(key=>within(d[key],limits[key])))return false;
  if(!Array.isArray(d.symmetry)||!d.symmetry.length||!d.symmetry.every((s,i)=>s.operation===i&&within(s.max,limits.symmetryMax)&&within(s.rms,limits.symmetryMax)))return false;
  if(!passingShoot(d.closure,d,limits)||!passingShoot(d.refinedClosure,d,limits))return false;
  // The requested step can be clipped or rounded. Compare returned actual steps.
  return d.refinedClosure.steps>=2*d.closure.steps
    &&d.refinedClosure.dt<d.closure.dt
    &&d.refinedClosure.dt<=.5*d.closure.dt*(1+2e-12);
}
