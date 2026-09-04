/**
 * Gray–Scott periodic-orbit collocation on a square torus.
 *
 * Layout: frame * (2*N*N), followed by N*N U values then N*N V values.
 * Coordinates are x=i/N,y=j/N. All concentrations are dimensionless;
 * dx is the physical spacing, so the physical side length is N*dx.
 * Operations obey q(M*x+v,t+tau*T)=q(x,t); tau is a fraction of T.
 *
 * The optimizer searches the actual two-species PDE residual. A projected
 * animation is only a seed: small symmetry error alone is not a solution.
 */

const mod = (a, n) => ((a % n) + n) % n;
const dot = (a, b) => { let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
const rms = a => Math.sqrt(dot(a,a)/a.length);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const tick = () => new Promise(resolve => setTimeout(resolve,0));

export function createProblem(options = {}) {
  const N = options.N ?? 24, M = options.M ?? 24;
  if (!Number.isInteger(N)||!Number.isInteger(M)||N<4||M<4||N%4||M%4)
    throw new Error('N and M must be positive multiples of four (at least four).');
  const S=N*N, frames=M, length=2*S*M, points=S*M;
  const params = {Du:0.16,Dv:0.08,F:0.026,k:0.055,dx:1,...options.params};
  for (const key of ['Du','Dv','F','k','dx']) if(!Number.isFinite(params[key])||params[key]<0)
    throw new Error(`Invalid parameter ${key}`);
  if(!params.dx) throw new Error('dx must be positive.');
  const ops=options.ops??[{M:[[1,0],[0,1]],v:[0,0],s:1,tau:0}];
  if(!ops.length) throw new Error('At least one symmetry operation is required.');
  const periodBounds=options.periodBounds??[8,20000];
  if(!(periodBounds[0]>0&&periodBounds[1]>periodBounds[0])) throw new Error('Invalid period bounds.');
  const rateScale=options.rateScale??0.02;
  if(!(rateScale>0)) throw new Error('rateScale must be positive.');
  const minTemporal=options.minTemporal??0.012, minSpatial=options.minSpatial??0.04;
  const weights={temporal:1,spatial:1,phase:0.01,...options.weights};
  const concentrationBounds=options.concentrationBounds??[0,1.2];
  const left=new Int32Array(S),right=new Int32Array(S),up=new Int32Array(S),down=new Int32Array(S);
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
    const p=y*N+x; left[p]=y*N+mod(x-1,N); right[p]=y*N+mod(x+1,N);
    up[p]=mod(y-1,N)*N+x;down[p]=mod(y+1,N)*N+x;
  }
  // Union-find creates the exact invariant subspace, including the closure of
  // the supplied operations. It avoids repeated averaging roundoff/drift.
  const parent=new Int32Array(points),rank=new Uint8Array(points);
  for(let i=0;i<points;i++) parent[i]=i;
  function root(x) { let r=x;while(parent[r]!==r)r=parent[r];while(parent[x]!==x){const y=parent[x];parent[x]=r;x=y;}return r; }
  function union(a,b){a=root(a);b=root(b);if(a===b)return;if(rank[a]<rank[b]) [a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;}
  const maps=ops.map((op,opIndex)=> {
    const A=op.M??op.matrix,v=op.v??op.shift??[0,0],tau=op.tau??op.timeShift??0,s=op.s??1;
    if(s!==1) throw new Error('Only forward-time operations are supported; time reversal is not a Gray–Scott equivariance.');
    if(!A||A.length!==2||A.some(row=>row.length!==2)||A.flat().some(x=>!Number.isInteger(x))) throw new Error('Operations need a 2×2 integer matrix.');
    const [a,b]=A[0],[c,d]=A[1];
    if(a*a+c*c!==1||b*b+d*d!==1||a*b+c*d!==0) throw new Error('Only square-lattice isometries are supported.');
    const tx=v[0]*N,ty=v[1]*N,tt=tau*M;
    if([tx,ty,tt].some(x=>!Number.isFinite(x)||Math.abs(x-Math.round(x))>1e-8)) throw new Error(`Operation ${opIndex} does not map this space/time grid to itself.`);
    const shiftX=Math.round(tx),shiftY=Math.round(ty),shiftT=Math.round(tt),map=new Int32Array(points);
    for(let k=0;k<M;k++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const i=k*S+y*N+x,j=mod(k+shiftT,M)*S+mod(c*x+d*y+shiftY,N)*N+mod(a*x+b*y+shiftX,N);
      map[i]=j;union(i,j);
    }
    return map;
  });
  const orbitIndex=new Int32Array(points),rootIds=new Map();
  for(let i=0;i<points;i++){const r=root(i);if(!rootIds.has(r))rootIds.set(r,rootIds.size);orbitIndex[i]=rootIds.get(r);}
  const orbitCount=rootIds.size,orbitSizes=new Int32Array(orbitCount);
  for(const i of orbitIndex)orbitSizes[i]++;
  function checkField(q){if(q.length!==length)throw new Error(`Expected ${length} field values, got ${q.length}.`);}
  function project(q,out=new Float64Array(length)){
    checkField(q);
    const sums=new Float64Array(2*orbitCount);
    for(let k=0;k<M;k++)for(let p=0;p<S;p++){
      const o=orbitIndex[k*S+p];sums[o]+=q[k*2*S+p];sums[orbitCount+o]+=q[k*2*S+S+p];
    }
    for(let k=0;k<M;k++)for(let p=0;p<S;p++){
      const o=orbitIndex[k*S+p];out[k*2*S+p]=sums[o]/orbitSizes[o];out[k*2*S+S+p]=sums[orbitCount+o]/orbitSizes[o];
    }
    return out;
  }
  function rhsFrame(q,base=0,out=new Float64Array(2*S),outBase=0){
    const {Du,Dv,F,k,dx}=params, invDx2=1/(dx*dx);
    for(let p=0;p<S;p++){
      const U=q[base+p],V=q[base+S+p],reaction=U*V*V;
      const lapU=(q[base+left[p]]+q[base+right[p]]+q[base+up[p]]+q[base+down[p]]-4*U)*invDx2;
      const lapV=(q[base+S+left[p]]+q[base+S+right[p]]+q[base+S+up[p]]+q[base+S+down[p]]-4*V)*invDx2;
      out[outBase+p]=Du*lapU-reaction+F*(1-U);
      out[outBase+S+p]=Dv*lapV+reaction-(F+k)*V;
    }
    return out;
  }
  function variations(q,gradient=false){
    const timeMean=new Float64Array(2*S),spaceMean=new Float64Array(2*M);
    for(let k=0;k<M;k++)for(let species=0;species<2;species++)for(let p=0;p<S;p++){
      const value=q[k*2*S+species*S+p];timeMean[species*S+p]+=value/M;spaceMean[2*k+species]+=value/S;
    }
    let temporalSq=0,spatialSq=0;
    const td=gradient?new Float64Array(length):null,sd=gradient?new Float64Array(length):null;
    for(let k=0;k<M;k++)for(let species=0;species<2;species++)for(let p=0;p<S;p++){
      const i=k*2*S+species*S+p,dt=q[i]-timeMean[species*S+p],ds=q[i]-spaceMean[2*k+species];
      temporalSq+=dt*dt;spatialSq+=ds*ds;if(gradient){td[i]=dt;sd[i]=ds;}
    }
    return {temporalRms:Math.sqrt(temporalSq/length),spatialRms:Math.sqrt(spatialSq/length),temporalDifference:td,spatialDifference:sd};
  }
  let phaseReference=null,phaseTangent=null,phaseNormSq=0;
  function setPhaseReference(q){
    checkField(q);phaseReference=Float64Array.from(q);phaseTangent=new Float64Array(length);
    for(let k=0;k<M;k++)for(let p=0;p<2*S;p++)phaseTangent[k*2*S+p]=(q[mod(k+1,M)*2*S+p]-q[mod(k-1,M)*2*S+p])*M/2;
    phaseNormSq=dot(phaseTangent,phaseTangent)/length;
  }
  function evaluate(q,period,{gradient=false,projectGradient=true}={}) {
    checkField(q);if(!(period>0&&Number.isFinite(period)))throw new Error('Period must be positive and finite.');
    const h=period/M,invH=1/h,rates=new Float64Array(length),residual=new Float64Array(length);
    for(let k=0;k<M;k++)rhsFrame(q,k*2*S,rates,k*2*S);
    let sumR2=0,sumD2=0,sumF2=0,logPeriodGradient=0;
    const scale=1/(length*rateScale*rateScale);
    for(let k=0;k<M;k++)for(let p=0;p<2*S;p++){
      const i=k*2*S+p,j=mod(k+1,M)*2*S+p,deriv=(q[j]-q[i])*invH,avgF=.5*(rates[i]+rates[j]),r=deriv-avgF;
      residual[i]=r;sumR2+=r*r;sumD2+=deriv*deriv;sumF2+=avgF*avgF;logPeriodGradient-=r*deriv*scale;
    }
    let objective=.5*sumR2*scale;
    const grad=gradient?new Float64Array(length):null;
    if(gradient){
      const {Du,Dv,F,k:kill,dx}=params, invDx2=1/(dx*dx);
      for(let k=0;k<M;k++){
        const base=k*2*S,prev=mod(k-1,M)*2*S;
        for(let p=0;p<S;p++){
          const i=base+p,iv=i+S,U=q[i],V=q[iv];
          const wU=-.5*(residual[i]+residual[prev+p]),wV=-.5*(residual[iv]+residual[prev+S+p]);
          let lapWU=0,lapWV=0;
          for(const n of [left[p],right[p],up[p],down[p]]){
            lapWU+=-.5*(residual[base+n]+residual[prev+n]);
            lapWV+=-.5*(residual[base+S+n]+residual[prev+S+n]);
          }
          lapWU=(lapWU-4*wU)*invDx2;lapWV=(lapWV-4*wV)*invDx2;
          grad[i]=scale*((residual[prev+p]-residual[i])*invH+Du*lapWU+(-V*V-F)*wU+V*V*wV);
          grad[iv]=scale*((residual[prev+S+p]-residual[iv])*invH+Dv*lapWV-2*U*V*wU+(2*U*V-F-kill)*wV);
        }
      }
    }
    const variation=variations(q,gradient);
    for(const [name,min,weight,difference] of [
      ['temporalRms',minTemporal,weights.temporal,variation.temporalDifference],
      ['spatialRms',minSpatial,weights.spatial,variation.spatialDifference]
    ]){
      const value=variation[name];
      if(min>0&&value<min){
        const gap=(min-value)/min;objective+=.5*weight*gap*gap;
        // The norm has no unique derivative at a constant field. A constant
        // seed stays rejected by diagnostics; callers should seed variation.
        if(gradient&&value>1e-14){const c=-weight*gap/(min*value*length);for(let i=0;i<length;i++)grad[i]+=c*difference[i];}
      }
    }
    let phaseError=0;
    if(phaseReference&&phaseNormSq>1e-16&&weights.phase>0){
      for(let i=0;i<length;i++)phaseError+=(q[i]-phaseReference[i])*phaseTangent[i]/length;
      objective+=.5*weights.phase*phaseError*phaseError/phaseNormSq;
      if(gradient){const c=weights.phase*phaseError/(phaseNormSq*length);for(let i=0;i<length;i++)grad[i]+=c*phaseTangent[i];}
    }
    const pdeRms=Math.sqrt(sumR2/length),timeDerivativeRms=Math.sqrt(sumD2/length),rhsRms=Math.sqrt(sumF2/length);
    return {objective,pdeObjective:.5*sumR2*scale,pdeRms,relativePde:pdeRms/Math.max(timeDerivativeRms,rhsRms,1e-12),timeDerivativeRms,rhsRms,
      temporalRms:variation.temporalRms,spatialRms:variation.spatialRms,phaseError,
      gradient:gradient?(projectGradient?project(grad):grad):undefined,
      logPeriodGradient:gradient?logPeriodGradient:undefined,residual};
  }
  function symmetryDiagnostics(q){
    checkField(q);return maps.map((map,index)=>{
      let sum=0,max=0;for(let k=0;k<M;k++)for(let p=0;p<S;p++){
        const j=map[k*S+p],targetBase=Math.floor(j/S)*2*S,targetP=j%S;
        for(let species=0;species<2;species++){
          const diff=q[k*2*S+species*S+p]-q[targetBase+species*S+targetP];sum+=diff*diff;max=Math.max(max,Math.abs(diff));
        }
      }
      return {operation:index,rms:Math.sqrt(sum/length),max};
    });
  }
  // Independent, unprojected explicit RK4 shooting. No cyclic frames or
  // symmetry constraint is imposed during integration.
  function shoot(q,period,{shootingSteps=0,maxShootingSteps=30000,shootingDt=0.5}={}){
    checkField(q);
    const stableDt=Math.min(shootingDt,0.15*params.dx*params.dx/Math.max(params.Du,params.Dv,1e-12));
    // A multiple of M lands exactly on every collocation frame as well as T.
    const needed=M*Math.ceil(Math.max(shootingSteps,Math.ceil(period/stableDt),M*4)/M);
    const steps=Math.min(maxShootingSteps,needed);
    if(steps<needed) return {computed:false,reason:`Shooting needs ${needed} steps; limit is ${maxShootingSteps}.`,stepsNeeded:needed};
    const initial=q.slice(0,2*S),state=Float64Array.from(initial),temp=new Float64Array(2*S);
    const k1=new Float64Array(2*S),k2=new Float64Array(2*S),k3=new Float64Array(2*S),k4=new Float64Array(2*S),dt=period/steps;
    let maxAbs=0,trajectorySq=0,trajectoryMax=0;
    for(let step=0;step<steps;step++){
      rhsFrame(state,0,k1);
      for(let p=0;p<2*S;p++)temp[p]=state[p]+.5*dt*k1[p];rhsFrame(temp,0,k2);
      for(let p=0;p<2*S;p++)temp[p]=state[p]+.5*dt*k2[p];rhsFrame(temp,0,k3);
      for(let p=0;p<2*S;p++)temp[p]=state[p]+dt*k3[p];rhsFrame(temp,0,k4);
      for(let p=0;p<2*S;p++)state[p]+=dt*(k1[p]+2*k2[p]+2*k3[p]+k4[p])/6;
      if(step%32===0&&state.some(x=>!Number.isFinite(x)||Math.abs(x)>10)) return {computed:false,reason:'Independent forward integration diverged.',steps:step};
      if((step+1)%(steps/M)===0){
        const frame=((step+1)/(steps/M))%M;
        for(let p=0;p<2*S;p++){
          const error=state[p]-q[frame*2*S+p];trajectorySq+=error*error;trajectoryMax=Math.max(trajectoryMax,Math.abs(error));
        }
      }
    }
    let sum=0,sumU=0,sumV=0;
    for(let i=0;i<2*S;i++){const diff=state[i]-initial[i];sum+=diff*diff;if(i<S)sumU+=diff*diff;else sumV+=diff*diff;maxAbs=Math.max(maxAbs,Math.abs(diff));}
    const closureRms=Math.sqrt(sum/(2*S)),trajectoryRms=Math.sqrt(trajectorySq/length),temporalRms=variations(q).temporalRms;
    return {computed:true,steps,dt,closureRms,closureURms:Math.sqrt(sumU/S),closureVRms:Math.sqrt(sumV/S),closureMax:maxAbs,
      relativeClosure:closureRms/Math.max(temporalRms,1e-12),trajectoryRms,trajectoryMax,
      relativeTrajectory:trajectoryRms/Math.max(temporalRms,1e-12),finalState:state};
  }
  function diagnostics(q,period,settings={}){
    const e=evaluate(q,period),symmetry=symmetryDiagnostics(q);
    // A nonconstant movie can still repeat several times inside the supplied
    // T. Such an orbit satisfies the operations but may collapse a specified
    // time character. Report this separately from ordinary invariance.
    const shifts=[...new Set([M/4,M/2,3*M/4,...ops.map(op=>mod(Math.round((op.tau??op.timeShift??0)*M),M))])].filter(x=>x>0);
    const temporalRepeats=shifts.map(shift=>{
      let sum=0;for(let k=0;k<M;k++)for(let p=0;p<2*S;p++){const error=q[mod(k+shift,M)*2*S+p]-q[k*2*S+p];sum+=error*error;}
      const errorRms=Math.sqrt(sum/length);
      return {shiftFraction:shift/M,rms:errorRms,relativeToTemporalVariation:errorRms/Math.max(e.temporalRms,1e-12)};
    });
    const requiredShifts=[...new Set(ops.map(op=>mod(Math.round((op.tau??op.timeShift??0)*M),M)))].filter(x=>x>0);
    const faithfulTimeShifts=requiredShifts.every(shift=>temporalRepeats.find(row=>Math.abs(row.shiftFraction-shift/M)<1e-12).relativeToTemporalVariation>1e-3);
    const primitiveAtTestedShifts=temporalRepeats.every(row=>row.relativeToTemporalVariation>1e-3);
    let minimum=Infinity,maximum=-Infinity;for(const value of q){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
    const closure=settings.shooting===false?{computed:false,reason:'Independent forward shooting has not been run.'}:shoot(q,period,settings);
    const thresholds={pdeRms:2e-4,relativePde:0.05,relativeClosure:0.1,closureRms:0.01,relativeTrajectory:0.1,trajectoryRms:0.01,symmetryMax:1e-10,...settings.thresholds};
    const symmetryMax=Math.max(...symmetry.map(s=>s.max));
    const nontrivial=e.temporalRms>=minTemporal*.99&&e.spatialRms>=minSpatial*.99;
    const validConcentrations=Number.isFinite(minimum)&&Number.isFinite(maximum)&&minimum>=-1e-8&&maximum<=concentrationBounds[1]+1e-8;
    const reasons=[];
    if(!nontrivial) reasons.push('Temporal or spatial variation is below the nontriviality floor.');
    if(!validConcentrations) reasons.push('Concentrations are outside the permitted range.');
    if(!(e.pdeRms<=thresholds.pdeRms&&e.relativePde<=thresholds.relativePde)) reasons.push('The collocation PDE residual is too large.');
    if(!(symmetryMax<=thresholds.symmetryMax)) reasons.push('Space-time symmetry error is too large.');
    if(settings.requireFaithfulTimeShifts&&!faithfulTimeShifts)reasons.push('A requested nonzero time shift acts trivially: the candidate has a shorter temporal repeat.');
    if(!closure.computed) reasons.push(closure.reason);
    else {
      if(!(closure.closureRms<=thresholds.closureRms&&closure.relativeClosure<=thresholds.relativeClosure))reasons.push('Independent forward integration does not close closely enough.');
      if(!(closure.trajectoryRms<=thresholds.trajectoryRms&&closure.relativeTrajectory<=thresholds.relativeTrajectory))reasons.push('Independent forward integration does not follow the candidate trajectory closely enough.');
    }
    return {period,N,M,dx:params.dx,physicalSide:N*params.dx,frameDt:period/M,
      pdeRms:e.pdeRms,relativePde:e.relativePde,timeDerivativeRms:e.timeDerivativeRms,rhsRms:e.rhsRms,
      temporalRms:e.temporalRms,spatialRms:e.spatialRms,nontrivial,minimum,maximum,symmetry,symmetryMax,
      temporalRepeats,faithfulTimeShifts,primitiveAtTestedShifts,
      closure,periodicConstruction:true,validated:reasons.length===0,status:reasons.length?'unverified candidate':'numerically validated candidate',reasons,thresholds,
      caveat:'Finite-grid numerical evidence, not a proof of existence. A refinement study is required for continuum accuracy.'};
  }
  const api={N,M,S,length,params,ops,orbitCount,periodBounds,concentrationBounds,minTemporal,minSpatial,rateScale,weights,
    project,rhsFrame,evaluate,variations,symmetryDiagnostics,setPhaseReference,shoot,diagnostics,
    fitOrbit:settings=>fitOrbit({problem:api,...settings})};
  return api;
}

/** Projected limited-memory BFGS with an Armijo line search.
 * onProgress receives an independent field copy and scalar diagnostics.
 * A completed optimization is not automatically a validated PDE orbit.
 */
export async function fitOrbit({problem,field,period=400,iterations=120,memory=6,onProgress,yieldEvery=3,
  signal,gradientTolerance=1e-9,fitPeriod=true,validate=true,...diagnosticSettings}={}){
  if(!problem)throw new Error('fitOrbit requires a problem from createProblem.');
  const n=problem.length,lo=problem.concentrationBounds[0],hi=problem.concentrationBounds[1],periodScale=Math.sqrt(n);
  let q=problem.project(field),logT=Math.log(clamp(period,...problem.periodBounds));
  for(let i=0;i<n;i++)q[i]=clamp(q[i],lo,hi);
  problem.setPhaseReference(q);
  let current=problem.evaluate(q,Math.exp(logT),{gradient:true});
  // Scale log(T) by sqrt(n), so a scalar period variable has a comparable
  // metric to n concentrations in the mean-squared-residual objective.
  let g=new Float64Array(n+1);g.set(current.gradient);g[n]=fitPeriod?current.logPeriodGradient/periodScale:0;
  const history=[];let completed=0,reason='iteration limit',accepted=0;
  function report(iteration){if(onProgress){const {gradient,residual,...summary}=current;onProgress({iteration,field:Float64Array.from(q),period:Math.exp(logT),...summary,gradientRms:rms(g),historySize:history.length});}}
  report(0);await tick();
  for(let iteration=1;iteration<=iterations;iteration++){
    if(signal?.aborted){reason='cancelled';break;}
    if(rms(g)<gradientTolerance){reason='small objective gradient (validation still required)';break;}
    const direction=Float64Array.from(g),alphas=new Float64Array(history.length);
    for(let j=history.length-1;j>=0;j--){const item=history[j],a=item.rho*dot(item.s,direction);alphas[j]=a;for(let i=0;i<=n;i++)direction[i]-=a*item.y[i];}
    let inverseScale=n;
    if(history.length){const last=history[history.length-1];inverseScale=dot(last.s,last.y)/Math.max(dot(last.y,last.y),1e-30);}
    for(let i=0;i<=n;i++)direction[i]*=inverseScale;
    for(let j=0;j<history.length;j++){const item=history[j],b=item.rho*dot(item.y,direction);for(let i=0;i<=n;i++)direction[i]+=item.s[i]*(alphas[j]-b);}
    for(let i=0;i<=n;i++)direction[i]=-direction[i];
    if(dot(direction,g)>=0||direction.some(x=>!Number.isFinite(x))){history.length=0;for(let i=0;i<=n;i++)direction[i]=-g[i]*n;}
    // Limit first proposals to a useful concentration/period trust region.
    let factor=1,maxConcentrationStep=0;for(let i=0;i<n;i++)maxConcentrationStep=Math.max(maxConcentrationStep,Math.abs(direction[i]));
    if(maxConcentrationStep>.2)factor=Math.min(factor,.2/maxConcentrationStep);
    if(Math.abs(direction[n])/periodScale>.25)factor=Math.min(factor,.25*periodScale/Math.abs(direction[n]));
    for(let i=0;i<=n;i++)direction[i]*=factor;
    let step=1,next=null,newQ=null,newLogT=logT,delta=null;
    for(let search=0;search<22;search++){
      newQ=new Float64Array(n);delta=new Float64Array(n+1);
      for(let i=0;i<n;i++){newQ[i]=clamp(q[i]+step*direction[i],lo,hi);delta[i]=newQ[i]-q[i];}
      // q and direction are invariant; pointwise box clipping preserves it.
      newLogT=fitPeriod?clamp(logT+step*direction[n]/periodScale,Math.log(problem.periodBounds[0]),Math.log(problem.periodBounds[1])):logT;
      delta[n]=(newLogT-logT)*periodScale;
      next=problem.evaluate(newQ,Math.exp(newLogT));
      const predicted=dot(g,delta);
      if(predicted<0&&Number.isFinite(next.objective)&&next.objective<=current.objective+1e-4*predicted)break;
      next=null;step*=.5;
    }
    if(!next){reason='line search stalled (candidate retained)';break;}
    const nextFull=problem.evaluate(newQ,Math.exp(newLogT),{gradient:true}),newG=new Float64Array(n+1);newG.set(nextFull.gradient);newG[n]=fitPeriod?nextFull.logPeriodGradient/periodScale:0;
    const y=new Float64Array(n+1);for(let i=0;i<=n;i++)y[i]=newG[i]-g[i];
    const curvature=dot(delta,y);
    if(curvature>1e-12*Math.sqrt(dot(delta,delta)*dot(y,y))&&curvature>1e-30){history.push({s:delta,y,rho:1/curvature});if(history.length>memory)history.shift();}
    q=newQ;logT=newLogT;g=newG;current=nextFull;completed=iteration;accepted++;
    if(iteration%yieldEvery===0){report(iteration);await tick();}
  }
  report(completed);
  // Project once more to remove floating point optimizer drift.
  q=problem.project(q);
  const result={field:q,period:Math.exp(logT),iterations:completed,accepted,reason,objective:current.objective,
    diagnostics:problem.diagnostics(q,Math.exp(logT),{...diagnosticSettings,shooting:validate})};
  return result;
}
