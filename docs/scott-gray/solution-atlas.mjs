/** Verified periodic-orbit collection. Importing a claimed result is never admission.
 * The catalog supplied at construction must be the application's groups.json.
 * Fields, parameters, group operations and independent forward checks are copied
 * and recomputed before any record becomes visible in the collection.
 */
import {createProblem} from './core.mjs';
import {hasRefinedAcceptance} from './acceptance.mjs';
import {auditPhases} from './phase-audit.mjs?v=20260904-fft';
import {analyticExclusion} from './feasibility.mjs';

const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const finiteNonnegative=v=>Number.isFinite(v)&&v>=0;
const MAX_STEPS=130000;
function cancelled(signal){if(signal?.aborted){const error=new Error('Orbit verification cancelled.');error.name='AbortError';throw error;}}
function deepCopy(value){
  if(ArrayBuffer.isView(value))return Array.from(value);
  if(Array.isArray(value))return value.map(deepCopy);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deepCopy(item)]));
  return value;
}
function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
function snapshot(value){return freeze(deepCopy(value));}
function sameOps(a,b){return Array.isArray(a)&&a.length===b.length&&a.every((op,i)=>{
  const ref=b[i];return op?.s===ref.s&&op?.tau===ref.tau&&Array.isArray(op.v)&&op.v.length===2&&op.v.every((v,j)=>v===ref.v[j])
    &&Array.isArray(op.M)&&op.M.length===2&&op.M.every((row,j)=>Array.isArray(row)&&row.length===2&&row.every((v,k)=>v===ref.M[j][k]));
});}
function rmsDifference(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;return Math.sqrt(sum/a.length);}
function bounded(value,maximum){return finiteNonnegative(value)&&value<=maximum;}

/** Capture unprojected RK4 evolution beyond T so all time-shift comparisons use
 * actual future frames. There is no modulo-time lookup or trajectory projection.
 * `steps` counts one period; `integrationSteps` includes the extended phase audit.
 */
async function captureForward(problem,field,period,steps,{signal,onPhase,label}={}) {
  const {N,M,S}=problem,stride=2*S,dt=period/steps,stepsPerFrame=steps/M;
  const maxShift=Math.max(...problem.ops.map(op=>Math.round(op.tau*M))),lastFrame=M+maxShift;
  const integrationSteps=lastFrame*stepsPerFrame;
  if(!Number.isInteger(stepsPerFrame)||stepsPerFrame<4||integrationSteps>MAX_STEPS)throw Error('The independent phase audit exceeds its safe integration budget. Reduce the trial period or refine in a separate run.');
  const state=Float64Array.from(field.slice(0,stride)),initial=state.slice(),temp=new Float64Array(stride);
  const k1=new Float64Array(stride),k2=k1.slice(),k3=k1.slice(),k4=k1.slice();
  const frames=new Float64Array((lastFrame+1)*stride);frames.set(state);
  let finalState=null,trajectorySq=0,trajectoryMax=0,minimum=Infinity,maximum=-Infinity;
  function inspect(){for(const value of state){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);if(!Number.isFinite(value)||value< -1e-8||value>1.2+1e-8)throw Error('Independent evolution left the permitted concentration range.');}}
  inspect();
  for(let step=0;step<integrationSteps;step++){
    if(step%64===0){cancelled(signal);if(step%2048===0)onPhase?.(`${label}: ${Math.round(100*step/integrationSteps)}% of the independent phase audit`);await pause();cancelled(signal);}
    problem.rhsFrame(state,0,k1);
    for(let i=0;i<stride;i++)temp[i]=state[i]+.5*dt*k1[i];problem.rhsFrame(temp,0,k2);
    for(let i=0;i<stride;i++)temp[i]=state[i]+.5*dt*k2[i];problem.rhsFrame(temp,0,k3);
    for(let i=0;i<stride;i++)temp[i]=state[i]+dt*k3[i];problem.rhsFrame(temp,0,k4);
    for(let i=0;i<stride;i++)state[i]+=dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
    inspect();
    if((step+1)%stepsPerFrame===0){
      const frame=(step+1)/stepsPerFrame;frames.set(state,frame*stride);
      if(frame<=M){
        const base=(frame%M)*stride;
        for(let i=0;i<stride;i++){const error=state[i]-field[base+i];trajectorySq+=error*error;trajectoryMax=Math.max(trajectoryMax,Math.abs(error));}
      }
      if(frame===M)finalState=state.slice();
    }
  }
  cancelled(signal);
  let sum=0,sumU=0,sumV=0,closureMax=0;
  for(let i=0;i<stride;i++){const difference=finalState[i]-initial[i];sum+=difference*difference;if(i<S)sumU+=difference*difference;else sumV+=difference*difference;closureMax=Math.max(closureMax,Math.abs(difference));}
  const temporalRms=problem.variations(field).temporalRms,closureRms=Math.sqrt(sum/stride),trajectoryRms=Math.sqrt(trajectorySq/field.length);
  return {frames,diagnostics:{computed:true,steps,dt,integrationSteps,recordedFrames:lastFrame+1,N,M,
    closureRms,closureURms:Math.sqrt(sumU/S),closureVRms:Math.sqrt(sumV/S),closureMax,
    relativeClosure:closureRms/Math.max(temporalRms,1e-12),trajectoryRms,trajectoryMax,
    relativeTrajectory:trajectoryRms/Math.max(temporalRms,1e-12),minimum,maximum,finalState}};
}

/** Only `admit` can insert. List/get/nearest return immutable defensive copies;
 * their fields are frozen ordinary numeric arrays, compatible with rendering
 * and Float64Array.from. No writable typed-array buffer escapes with a badge.
 */
export function createSolutionAtlas(groups){
  if(!Array.isArray(groups))throw Error('The canonical groups.json catalog is required.');
  const canonical=new Map();
  for(const group of groups){
    if(!/^g9[4-9]$/.test(group?.id)||!Array.isArray(group.render?.ops))continue;
    const ops=snapshot(group.render.ops);
    // Validate the fixed catalog before accepting caller-provided candidate data.
    createProblem({N:8,M:8,ops});canonical.set(group.id,ops);
  }
  if(canonical.size!==6)throw Error('All six canonical 442 groups are required.');
  const records=new Map(),branded=new WeakSet();let sequence=0;
  function output(record){if(!record)return null;const out=snapshot(record);branded.add(out);return out;}
  async function admit(candidate,{groupId,signal,onPhase}={}){
    try{
      cancelled(signal);
      if(!canonical.has(groupId))throw Error('Select a canonical 442 group before verifying an orbit.');
      const raw=candidate?.config;
      if(!raw||raw.groupId!==groupId)throw Error('The submitted field belongs to a different selected group.');
      const ops=canonical.get(groupId);
      if(raw.ops!==undefined&&!sameOps(raw.ops,ops))throw Error('The supplied operations do not match the selected groups.json record.');
      const {N,M,period}=raw;
      if(!Number.isInteger(N)||N<4||N%4||!Number.isInteger(M)||M<4||M%4||!(Number.isFinite(period)&&period>0))throw Error('The spatial grid, time grid and period must be valid.');
      const params={Du:.16,Dv:.08,F:.026,k:.055,dx:1,stencil:'five-point',...raw.params};
      for(const name of ['Du','Dv','F','k','dx'])if(!finiteNonnegative(params[name])||(['Du','Dv','dx'].includes(name)&&params[name]===0))throw Error(`Invalid orbit parameter: ${name}; diffusivities and cell spacing must be positive.`);
      const excluded=analyticExclusion(params);if(excluded)throw Error(excluded.conclusion);
      if(!['five-point','bulatov9'].includes(params.stencil))throw Error('Unknown diffusion stencil.');
      const L=N*params.dx;
      if(raw.L!==undefined&&(!Number.isFinite(raw.L)||Math.abs(raw.L-L)>1e-10*Math.max(1,L)))throw Error('Physical cell length does not agree with N × dx.');
      if(!(Array.isArray(candidate.field)||ArrayBuffer.isView(candidate.field))||candidate.field.length!==2*N*N*M)throw Error('The supplied orbit has the wrong number of concentration samples.');
      const field=Float64Array.from(candidate.field);
      if(!field.every(Number.isFinite))throw Error('All orbit concentrations must be finite.');
      const config={N,M,period,L,groupId,seed:typeof raw.seed==='string'?raw.seed:'submitted-field',params:deepCopy(params),ops:deepCopy(ops),minTemporal:.008,minSpatial:.012};
      const problem=createProblem({...config,periodBounds:[Math.min(1,period/2),Math.max(20000,period*2)],minTemporal:.008,minSpatial:.012});
      onPhase?.('Recomputing the equations and every canonical space–time operation');await pause();cancelled(signal);
      const initial=problem.diagnostics(field,period,{shooting:false,requireFaithfulTimeShifts:true});
      const reasons=initial.reasons.filter(reason=>reason!==initial.closure.reason);
      const candidatePhase=auditPhases({field,N,M,ops,absoluteTolerance:1e-10,relativeTolerance:1e-8});
      if(!candidatePhase.passed)reasons.push(...candidatePhase.reasons.map(reason=>'Candidate phase audit: '+reason));
      if(reasons.length)return {accepted:false,reasons,diagnostics:{...initial,candidatePhase,validated:false,reasons}};
      const stableDt=Math.min(.4,.15*params.dx*params.dx/Math.max(params.Du,params.Dv,1e-12));
      const steps=M*Math.ceil(Math.max(Math.ceil(period/stableDt),M*4)/M);
      const coarse=await captureForward(problem,field,period,steps,{signal,onPhase,label:'Forward integration'});
      const refined=await captureForward(problem,field,period,2*steps,{signal,onPhase,label:'Half-timestep integration'});
      cancelled(signal);
      const first=coarse.frames.subarray(0,field.length),fine=refined.frames.subarray(0,field.length);
      const refinementRms=rmsDifference(coarse.frames,refined.frames);
      const noiseRms=Math.max(refinementRms,coarse.diagnostics.trajectoryRms,refined.diagnostics.trajectoryRms);
      const independentPhase=auditPhases({field:first,N,M,ops,trajectoryFrames:coarse.frames,noiseRms});
      const refinedPhase=auditPhases({field:fine,N,M,ops,trajectoryFrames:refined.frames,noiseRms});
      if(!independentPhase.passed)reasons.push(...independentPhase.reasons.map(reason=>'Independent phase audit: '+reason));
      if(!refinedPhase.passed)reasons.push(...refinedPhase.reasons.map(reason=>'Refined phase audit: '+reason));
      for(const [name,result] of [['Forward integration',coarse.diagnostics],['Half-timestep integration',refined.diagnostics]]){
        for(const key of ['closureRms','relativeClosure','trajectoryRms','relativeTrajectory'])if(!bounded(result[key],initial.thresholds[key]))reasons.push(`${name}: ${key} exceeds the acceptance tolerance.`);
      }
      const diagnostics={...initial,closure:coarse.diagnostics,refinedClosure:refined.diagnostics,candidatePhase,independentPhase,refinedPhase,refinementRms,
        phaseUncertaintyRms:noiseRms,atlasVerification:'recomputed-from-field-v1',validated:reasons.length===0,reasons,status:reasons.length?'unverified candidate':'independently verified periodic orbit'};
      if(!hasRefinedAcceptance(diagnostics)){if(!reasons.length)reasons.push('The complete independent acceptance gate failed.');diagnostics.validated=false;}
      cancelled(signal);
      if(reasons.length)return {accepted:false,reasons,diagnostics};
      const id=`verified-${++sequence}`;
      // Original candidate and caller-supplied diagnostics are never retained.
      // Keep exact Float32 payloads compact while browsing many parameter sets.
      // This never rounds a higher-precision candidate after its verification.
      const storedField=field.every(value=>Math.fround(value)===value)?Float32Array.from(field):field.slice();
      records.set(id,{id,atlasId:id,kind:'verified-periodic',config,field:storedField,diagnostics:deepCopy(diagnostics)});
      return {accepted:true,reasons:[],id,record:output(records.get(id))};
    }catch(error){return {accepted:false,cancelled:error.name==='AbortError',reasons:[error.message||String(error)]};}
  }
  function list(groupId){return [...records.values()].filter(record=>record.config.groupId===groupId).map(output);}
  function summaries(groupId){return Object.freeze([...records.values()].filter(record=>record.config.groupId===groupId).map(record=>snapshot({id:record.id,config:record.config})));}
  function nearest(groupId,point,{scales={F:.2,k:.08}}={}){
    if(!canonical.has(groupId)||!Number.isFinite(point?.F)||!Number.isFinite(point?.k))return null;
    if(!Number.isFinite(scales?.F)||scales.F<=0||!Number.isFinite(scales?.k)||scales.k<=0)return null;
    let closest=null,distance=Infinity;
    for(const record of records.values()){
      if(record.config.groupId!==groupId)continue;
      const p=record.config.params,value=((p.F-point.F)/scales.F)**2+((p.k-point.k)/scales.k)**2;
      if(value<distance){closest=record;distance=value;}
    }
    return output(closest);
  }
  return Object.freeze({admit,list,summaries,nearest,get:id=>output(records.get(id)),size:groupId=>groupId===undefined?records.size:[...records.values()].filter(record=>record.config.groupId===groupId).length,
    isVerified:(record,groupId=record?.config?.groupId)=>branded.has(record)&&record.config.groupId===groupId&&records.has(record.id)});
}
