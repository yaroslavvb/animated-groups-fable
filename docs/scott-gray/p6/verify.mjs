/** Offline admission of exact saved 632 fields. This module never projects a
 * candidate or an independently evolved frame, and ignores claimed diagnostics.
 * The only spatial stencil is the isotropic six-neighbour triangular lattice.
 */
import {readFile} from 'node:fs/promises';
import {auditPhases} from './phase-audit.mjs';
import {analyticExclusion} from '../feasibility.mjs';

export const GATE_VERSION='recomputed-triangular-field-v1';
export const LIMITS=Object.freeze({pdeRms:2e-5,relativePde:.02,symmetryMax:2e-7,
  candidatePhaseRms:2e-7,candidatePhaseRelative:2e-5,
  closureRms:2e-5,relativeClosure:.002,trajectoryRms:2e-5,relativeTrajectory:.002,
  independentPhaseRms:5e-5,independentPhaseRelative:.005,
  refinementRms:2e-6,relativeRefinement:.0002,minTemporal:.008,minSpatial:.012});
const canonical=JSON.parse(await readFile(new URL('groups.json',import.meta.url)));
const mod=(x,n)=>((x%n)+n)%n;
const assert=(value,message)=>{if(!value)throw Error(message);};
const rms=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;return Math.sqrt(sum/a.length);};

export function normalizeConfig(raw){
  assert(raw&&typeof raw==='object','A candidate configuration is required.');
  const group=canonical.find(g=>g.id===raw.groupId);
  assert(group,'Select one of the six canonical 632 groups.');
  assert(raw.ops===undefined||JSON.stringify(raw.ops)===JSON.stringify(group.render.ops),'Operations do not match the canonical 632 character.');
  const {N,M,period}=raw;
  assert(Number.isInteger(N)&&N>=6&&N<=126&&N%6===0,'Spatial grid must be divisible by six, from 6 to 126.');
  assert(Number.isInteger(M)&&M>=12&&M<=768&&M%6===0,'The temporal grid must be divisible by six, from 12 to 768 frames.');
  assert(Number.isFinite(period)&&period>0,'The orbit period must be positive and finite.');
  const p=raw.params;
  assert(p?.stencil==='triangular-six','A 632 field requires the triangular-six stencil; a square-grid field is not admissible.');
  for(const key of ['Du','Dv','F','k','dx'])assert(Number.isFinite(p[key])&&p[key]>=0&&(!['Du','Dv','dx'].includes(key)||p[key]>0),`Invalid physical parameter ${key}.`);
  const L=N*p.dx;
  assert(raw.L===undefined||(Number.isFinite(raw.L)&&Math.abs(raw.L-L)<=1e-10*Math.max(1,L)),'Physical lattice length must equal N × dx.');
  return {N,M,period,L,groupId:group.id,seed:typeof raw.seed==='string'?raw.seed:'triangular-shooting',
    params:{F:p.F,k:p.k,Du:p.Du,Dv:p.Dv,dx:p.dx,stencil:'triangular-six'},
    ops:structuredClone(group.render.ops),minTemporal:LIMITS.minTemporal,minSpatial:LIMITS.minSpatial};
}

/** Independent JavaScript implementation; the search uses a separate C++ RHS. */
export function createTriangularRhs({N,params:{Du,Dv,F,k,dx}}){
  const S=N*N,neighbors=new Int32Array(6*S),factor=2/(3*dx*dx);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const p=y*N+x;
    for(const [j,[a,b]] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]].entries())neighbors[6*p+j]=mod(y+b,N)*N+mod(x+a,N);
  }
  return (field,base=0,out=new Float64Array(2*S))=>{
    for(let p=0;p<S;p++){
      const u=field[base+p],v=field[base+S+p];let lu=-6*u,lv=-6*v;
      for(let j=0;j<6;j++){const n=neighbors[6*p+j];lu+=field[base+n];lv+=field[base+S+n];}
      const reaction=u*v*v;
      out[p]=Du*factor*lu-reaction+F*(1-u);out[S+p]=Dv*factor*lv+reaction-(F+k)*v;
    }
    return out;
  };
}

export function candidateDiagnostics(field,c){
  const {N,M,period}=c,S=N*N,stride=2*S,timeMean=new Float64Array(stride),spaceMean=new Float64Array(2*M);
  let minimum=Infinity,maximum=-Infinity,temporalSq=0,spatialSq=0;
  for(let t=0;t<M;t++)for(let species=0;species<2;species++)for(let p=0;p<S;p++){
    const value=field[t*stride+species*S+p];timeMean[species*S+p]+=value/M;spaceMean[2*t+species]+=value/S;minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
  }
  for(let t=0;t<M;t++)for(let species=0;species<2;species++)for(let p=0;p<S;p++){
    const value=field[t*stride+species*S+p];temporalSq+=(value-timeMean[species*S+p])**2;spatialSq+=(value-spaceMean[2*t+species])**2;
  }
  const rhs=createTriangularRhs(c),rates=new Float64Array(field.length);
  for(let t=0;t<M;t++)rhs(field,t*stride,rates.subarray(t*stride,(t+1)*stride));
  let residualSq=0,derivativeSq=0,rateSq=0;
  for(let t=0;t<M;t++)for(let p=0;p<stride;p++){
    const i=t*stride+p,j=mod(t+1,M)*stride+p,derivative=(field[j]-field[i])*M/period,rate=.5*(rates[i]+rates[j]);
    residualSq+=(derivative-rate)**2;derivativeSq+=derivative**2;rateSq+=rate**2;
  }
  const pdeRms=Math.sqrt(residualSq/field.length),timeDerivativeRms=Math.sqrt(derivativeSq/field.length),rhsRms=Math.sqrt(rateSq/field.length);
  return{N,M,period,minimum,maximum,temporalRms:Math.sqrt(temporalSq/field.length),spatialRms:Math.sqrt(spatialSq/field.length),pdeRms,timeDerivativeRms,rhsRms,relativePde:pdeRms/Math.max(timeDerivativeRms,rhsRms,1e-12)};
}

/** Capture actual future times past T, without wrapping or symmetry projection. */
export async function captureForward(field,c,steps,{onProgress=()=>{}}={}){
  const {N,M,period}=c,S=N*N,stride=2*S,dt=period/steps,stepsPerFrame=steps/M;
  const lastFrame=M+Math.max(...c.ops.map(o=>Math.round(o.tau*M))),integrationSteps=lastFrame*stepsPerFrame;
  assert(Number.isInteger(stepsPerFrame)&&stepsPerFrame>=4&&integrationSteps<=260000,'Independent integration exceeds its step budget.');
  const state=Float64Array.from(field.subarray(0,stride)),initial=state.slice(),temp=state.slice();
  const k1=state.slice(),k2=state.slice(),k3=state.slice(),k4=state.slice(),rhs=createTriangularRhs(c);
  const frames=new Float64Array((lastFrame+1)*stride);frames.set(state);
  let finalState,trajectorySq=0,trajectoryMax=0,minimum=Infinity,maximum=-Infinity;
  for(let step=0;step<integrationSteps;step++){
    rhs(state,0,k1);for(let p=0;p<stride;p++)temp[p]=state[p]+.5*dt*k1[p];
    rhs(temp,0,k2);for(let p=0;p<stride;p++)temp[p]=state[p]+.5*dt*k2[p];
    rhs(temp,0,k3);for(let p=0;p<stride;p++)temp[p]=state[p]+dt*k3[p];rhs(temp,0,k4);
    for(let p=0;p<stride;p++){
      state[p]+=dt*(k1[p]+2*k2[p]+2*k3[p]+k4[p])/6;
      const value=state[p];minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
      assert(Number.isFinite(value)&&value>=-1e-8&&value<=1.2+1e-8,'Independent evolution left the concentration range.');
    }
    if((step+1)%stepsPerFrame===0){
      const frame=(step+1)/stepsPerFrame;frames.set(state,frame*stride);
      if(frame<=M)for(let p=0;p<stride;p++){const error=state[p]-field[mod(frame,M)*stride+p];trajectorySq+=error**2;trajectoryMax=Math.max(trajectoryMax,Math.abs(error));}
      if(frame===M)finalState=state.slice();
    }
    if(step%2048===0){onProgress(step/integrationSteps);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  let closureU=0,closureV=0,closureMax=0;
  for(let p=0;p<stride;p++){const error=finalState[p]-initial[p];if(p<S)closureU+=error**2;else closureV+=error**2;closureMax=Math.max(closureMax,Math.abs(error));}
  return{frames,diagnostics:{computed:true,steps,dt,integrationSteps,recordedFrames:lastFrame+1,N,M,closureRms:Math.sqrt((closureU+closureV)/stride),closureURms:Math.sqrt(closureU/S),closureVRms:Math.sqrt(closureV/S),closureMax,trajectoryRms:Math.sqrt(trajectorySq/field.length),trajectoryMax,minimum,maximum}};
}

export async function verifyCandidate(candidate,{onProgress=()=>{}}={}){
  try{
    const config=normalizeConfig(candidate?.config),{N,M,period,ops}=config;
    const excluded=analyticExclusion(config.params);assert(!excluded,excluded?.conclusion);
    assert(Array.isArray(candidate.field)||ArrayBuffer.isView(candidate.field),'A complete field is required.');
    assert(candidate.field.length===2*N*N*M,'Wrong field sample count.');
    const field=Float64Array.from(candidate.field);assert(field.every(Number.isFinite),'Concentrations must all be finite.');
    const diagnostics={...candidateDiagnostics(field,config),thresholds:{...LIMITS},atlasVerification:GATE_VERSION,validated:false,reasons:[]};
    const reasons=diagnostics.reasons;
    if(diagnostics.minimum < -1e-8||diagnostics.maximum>1.2+1e-8)reasons.push('Concentrations are outside the permitted range.');
    diagnostics.nontrivial=diagnostics.temporalRms>=LIMITS.minTemporal&&diagnostics.spatialRms>=LIMITS.minSpatial;
    if(!diagnostics.nontrivial)reasons.push('Temporal or spatial variation is below the nontriviality floor.');
    for(const key of ['pdeRms','relativePde'])if(diagnostics[key]>LIMITS[key])reasons.push(`The independently recomputed ${key} exceeds its tolerance.`);
    diagnostics.candidatePhase=auditPhases({field,N,M,ops,absoluteTolerance:LIMITS.candidatePhaseRms,relativeTolerance:LIMITS.candidatePhaseRelative});
    const phase=diagnostics.candidatePhase;
    diagnostics.symmetry=phase.operations.map(o=>({operation:o.operation,rms:o.shiftedRms,max:o.shiftedMax}));
    diagnostics.symmetryMax=Math.max(...diagnostics.symmetry.map(o=>o.max));
    diagnostics.faithfulTimeShifts=phase.operations.every(o=>o.nontrivialPhase);
    if(diagnostics.symmetryMax>LIMITS.symmetryMax)reasons.push('Candidate space–time symmetry maximum exceeds its tolerance.');
    if(!phase.passed)reasons.push(...phase.reasons.map(reason=>'Candidate phase audit: '+reason));
    if(reasons.length)return{accepted:false,reasons,diagnostics};
    const stableDt=Math.min(.4,.15*config.params.dx**2/Math.max(config.params.Du,config.params.Dv));
    const steps=M*Math.ceil(Math.max(period/stableDt,4*M)/M);
    const coarse=await captureForward(field,config,steps,{onProgress:p=>onProgress('forward',p)});
    const fine=await captureForward(field,config,steps*2,{onProgress:p=>onProgress('half-timestep',p)});
    diagnostics.closure=coarse.diagnostics;diagnostics.refinedClosure=fine.diagnostics;
    const scale=Math.max(diagnostics.temporalRms,1e-12);
    for(const [name,d] of [['Forward',coarse.diagnostics],['Refined',fine.diagnostics]]){
      d.relativeClosure=d.closureRms/scale;d.relativeTrajectory=d.trajectoryRms/scale;
      for(const key of ['closureRms','relativeClosure','trajectoryRms','relativeTrajectory'])if(d[key]>LIMITS[key])reasons.push(`${name} ${key} exceeds its tolerance.`);
    }
    diagnostics.refinementRms=rms(coarse.frames,fine.frames);diagnostics.relativeRefinement=diagnostics.refinementRms/scale;
    for(const key of ['refinementRms','relativeRefinement'])if(diagnostics[key]>LIMITS[key])reasons.push(`${key} exceeds its tolerance.`);
    diagnostics.phaseUncertaintyRms=Math.max(diagnostics.refinementRms,coarse.diagnostics.trajectoryRms,fine.diagnostics.trajectoryRms);
    for(const [name,forward] of [['independentPhase',coarse],['refinedPhase',fine]]){
      diagnostics[name]=auditPhases({field:forward.frames.subarray(0,field.length),N,M,ops,trajectoryFrames:forward.frames,
        noiseRms:diagnostics.phaseUncertaintyRms,absoluteTolerance:LIMITS.independentPhaseRms,relativeTolerance:LIMITS.independentPhaseRelative});
      if(!diagnostics[name].passed)reasons.push(...diagnostics[name].reasons.map(reason=>`${name}: ${reason}`));
    }
    diagnostics.validated=reasons.length===0;
    diagnostics.status=diagnostics.validated?'independently verified triangular periodic orbit':'unverified triangular candidate';
    diagnostics.caveat='Finite triangular-grid numerical evidence, with timestep refinement; not a proof of continuum existence or uniqueness.';
    return{accepted:diagnostics.validated,reasons,diagnostics,record:diagnostics.validated?{config,field,diagnostics}:null};
  }catch(error){return{accepted:false,reasons:[error.message??String(error)]};}
}
