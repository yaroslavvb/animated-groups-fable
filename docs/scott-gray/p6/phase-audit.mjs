/** Whole-concentration checks of a cyclic colour action.
 * A spatial operation acts on both U and V as q(g*x,t+tau*T)=q(x,t).
 * This module measures that relation; it never projects or modifies a field.
 */
const mod = (x,n) => ((x%n)+n)%n;

function spectrum(field,stride,M) {
  const means=new Float64Array(stride),energies=new Float64Array(Math.floor(M/2)+1);
  for(let t=0;t<M;t++)for(let p=0;p<stride;p++)means[p]+=field[t*stride+p]/M;
  let temporalSq=0;
  for(let t=0;t<M;t++)for(let p=0;p<stride;p++)temporalSq+=(field[t*stride+p]-means[p])**2;
  // Most exported movies have 128 frames. A radix-two FFT makes the complete
  // field audit O(stride * M log M), rather than O(stride * M²). Every site and
  // both species still contribute; non-power-of-two grids use the DFT below.
  if((M&(M-1))===0){
    const real=new Float64Array(M),imaginary=new Float64Array(M),reverse=new Int32Array(M);
    const cosine=new Float64Array(M/2),sine=new Float64Array(M/2),bits=Math.log2(M);
    for(let t=0;t<M;t++){let value=t,index=0;for(let b=0;b<bits;b++){index=(index<<1)|(value&1);value>>=1;}reverse[t]=index;}
    for(let k=0;k<M/2;k++){cosine[k]=Math.cos(2*Math.PI*k/M);sine[k]=-Math.sin(2*Math.PI*k/M);}
    for(let p=0;p<stride;p++){
      imaginary.fill(0);
      for(let t=0;t<M;t++)real[reverse[t]]=field[t*stride+p]-means[p];
      for(let size=2;size<=M;size*=2){
        const half=size/2,step=M/size;
        for(let start=0;start<M;start+=size)for(let j=0;j<half;j++){
          const a=start+j,b=a+half,k=j*step,c=cosine[k],s=sine[k];
          const r=c*real[b]-s*imaginary[b],im=s*real[b]+c*imaginary[b];
          real[b]=real[a]-r;imaginary[b]=imaginary[a]-im;real[a]+=r;imaginary[a]+=im;
        }
      }
      for(let k=1;k<energies.length;k++)energies[k]+=(real[k]*real[k]+imaginary[k]*imaginary[k])*(k*2===M?1:2)/(stride*M*M);
    }
    return {energies,temporalRms:Math.sqrt(temporalSq/(stride*M))};
  }
  // Aggregate Parseval energy over every site and both chemical species.
  // Keeping the full field prevents a quiet probe or one displayed channel
  // from concealing a phase mismatch elsewhere in the pattern.
  for(let k=1;k<energies.length;k++){
    const cosine=Float64Array.from({length:M},(_,t)=>Math.cos(2*Math.PI*k*t/M));
    const sine=Float64Array.from({length:M},(_,t)=>Math.sin(2*Math.PI*k*t/M));
    let energy=0;
    for(let p=0;p<stride;p++){
      let real=0,imaginary=0;
      for(let t=0;t<M;t++){
        const centered=field[t*stride+p]-means[p];
        real+=centered*cosine[t];imaginary+=centered*sine[t];
      }
      energy+=real*real+imaginary*imaginary;
    }
    energies[k]=energy*(k*2===M?1:2)/(stride*M*M);
  }
  return {energies,temporalRms:Math.sqrt(temporalSq/(stride*M))};
}

/**
 * `field` contains exactly M planar U,V frames. If `trajectoryFrames` is
 * supplied, it is an independently integrated trajectory extending through
 * frame M-1+max(tau*M); future frames are read directly, never time-wrapped.
 *
 * Tight tolerances should be supplied for a projected candidate. Defaults
 * are the finite-grid forward-evolution acceptance tolerances. `noiseRms`
 * should be measured from independent integrations at two timesteps.
 * This audit alone does not establish the PDE, closure, or spatial contrast.
 */
export function auditPhases({field,N,M,ops,trajectoryFrames,
  absoluteTolerance=.01,relativeTolerance=.1,noiseRms=0,
  minPhaseContrast=.002,contrastNoiseFactor=4,
  primitiveRelativeTolerance=.03,spectralTailTolerance=.01}={}) {
  if(!Number.isInteger(N)||N<4||!Number.isInteger(M)||M<12||M%6)
    throw new Error('Phase audit needs N >= 4 and at least twelve time frames, with M divisible by six.');
  const S=N*N,stride=2*S,length=stride*M;
  if(!field||field.length!==length)throw new Error('Phase audit requires the complete M-frame U,V field.');
  if(!Array.isArray(ops)||!ops.length)throw new Error('Phase audit requires the canonical group operations.');
  for(const [name,value] of Object.entries({absoluteTolerance,relativeTolerance,noiseRms,minPhaseContrast,contrastNoiseFactor,primitiveRelativeTolerance,spectralTailTolerance}))
    if(!Number.isFinite(value)||value<0)throw new Error(`Invalid phase-audit tolerance: ${name}.`);
  const maps=ops.map((op,operation)=>{
    const A=op.M,v=op.v??[0,0],tau=mod(op.tau??0,1);
    if((op.s??1)!==1||!A||A.length!==2||A.some(row=>row.length!==2)||A.flat().some(x=>!Number.isInteger(x)))
      throw new Error(`Invalid forward spatial operation ${operation}.`);
    const [a,b]=A[0],[c,d]=A[1];
    if(a*a-a*c+c*c!==1||b*b-b*d+d*d!==1||2*a*b-a*d-b*c+2*c*d!==-1)throw new Error('Phase audit requires triangular-lattice isometries.');
    const coordinates=[v[0]*N,v[1]*N,tau*M];
    if(coordinates.some(x=>!Number.isFinite(x)||Math.abs(x-Math.round(x))>1e-8))
      throw new Error(`Operation ${operation} does not map the space-time grid exactly.`);
    const [tx,ty,shift]=coordinates.map(Math.round),map=new Int32Array(S);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)map[y*N+x]=mod(c*x+d*y+ty,N)*N+mod(a*x+b*y+tx,N);
    return {operation,tau,shift,map};
  });
  const actual=trajectoryFrames??field,maxShift=Math.max(...maps.map(op=>op.shift));
  if(trajectoryFrames&&trajectoryFrames.length<(M+maxShift)*stride)
    throw new Error('Independent phase audit requires actual future frames; wrapping a recording is forbidden.');
  if(actual.length%stride)throw new Error('Trajectory contains an incomplete U,V frame.');
  for(const array of [field,actual])for(const value of array)if(!Number.isFinite(value))
    throw new Error('Phase audit rejects nonfinite concentrations.');
  if(trajectoryFrames){
    for(let i=0;i<length;i++)if(field[i]!==trajectoryFrames[i])
      throw new Error('Phase audit field must be the first M frames of its independent trajectory.');
  }
  const {energies,temporalRms}=spectrum(field,stride,M),scale=Math.max(temporalRms,1e-15),reasons=[];
  const operations=maps.map(({operation,tau,shift,map})=>{
    let shiftedSq=0,sameTimeSq=0,phaseSq=0,shiftedMax=0;
    for(let t=0;t<M;t++){
      const future=trajectoryFrames?t+shift:mod(t+shift,M),base=t*stride,target=future*stride;
      for(let species=0;species<2;species++)for(let p=0;p<S;p++){
        const value=field[base+species*S+p],transformed=map[p];
        const error=actual[target+species*S+transformed]-value;
        shiftedSq+=error*error;shiftedMax=Math.max(shiftedMax,Math.abs(error));
        sameTimeSq+=(field[base+species*S+transformed]-value)**2;
        phaseSq+=(actual[target+species*S+p]-value)**2;
      }
    }
    const shiftedRms=Math.sqrt(shiftedSq/length),sameTimeRms=Math.sqrt(sameTimeSq/length),phaseRms=Math.sqrt(phaseSq/length);
    const relativeShifted=shiftedRms/scale,contrastFloor=Math.max(minPhaseContrast,contrastNoiseFactor*Math.max(noiseRms,shiftedRms));
    const symmetryPassed=shiftedRms<=absoluteTolerance&&relativeShifted<=relativeTolerance;
    const nontrivialPhase=!shift||(sameTimeRms>contrastFloor&&phaseRms>contrastFloor);
    if(!symmetryPassed)reasons.push(`Operation ${operation}: spatial + time-shift error exceeds the numerical tolerance.`);
    if(!nontrivialPhase)reasons.push(`Operation ${operation}: its nonzero colour phase is not resolved above the numerical error.`);
    return {operation,tau,shiftedRms,shiftedMax,relativeShifted,sameTimeRms,phaseRms,contrastFloor,symmetryPassed,nontrivialPhase,passed:symmetryPassed&&nontrivialPhase};
  });
  const totalEnergy=energies.reduce((a,b)=>a+b,0),tailEnergy=energies.reduce((sum,e,k)=>sum+(k>M/4?e:0),0);
  const tailFraction=tailEnergy/Math.max(totalEnergy,1e-30),spectrumResolved=tailFraction<=spectralTailTolerance;
  const repeatFloor=Math.max(primitiveRelativeTolerance*scale,contrastNoiseFactor*noiseRms);
  const periodChecks=[];
  for(let divisor=2;divisor<=Math.floor(M/2);divisor++){
    let offHarmonicEnergy=0,shiftSq=0;
    for(let k=1;k<energies.length;k++){
      if(k%divisor)offHarmonicEnergy+=energies[k];
      shiftSq+=2*(1-Math.cos(2*Math.PI*k/divisor))*energies[k];
    }
    const projectionRms=Math.sqrt(Math.max(0,offHarmonicEnergy));
    // Distance to the nearest movie of period T/divisor, not merely its
    // small-lag error. A smooth primitive orbit also changes little at T/128.
    periodChecks.push({divisor,projectionRms,relativeProjection:projectionRms/scale,
      shiftRms:Math.sqrt(Math.max(0,shiftSq)),possibleRepeat:projectionRms<=repeatFloor});
  }
  const resolvedMotion=temporalRms>Math.max(1e-8,contrastNoiseFactor*noiseRms);
  const primitiveAtResolvedDivisors=resolvedMotion&&!periodChecks.some(row=>row.possibleRepeat);
  if(!resolvedMotion)reasons.push('Temporal variation is not resolved above the numerical error.');
  if(!spectrumResolved)reasons.push('Temporal sampling is too coarse to resolve the minimal period; increase the number of frames.');
  const possibleDivisors=periodChecks.filter(row=>row.possibleRepeat).map(row=>row.divisor);
  if(possibleDivisors.length)reasons.push(`A shorter period T/d cannot be excluded for d = ${possibleDivisors.join(', ')}.`);
  return {passed:reasons.length===0,reasons,N,M,temporalRms,operations,
    independentForwardFrames:!!trajectoryFrames,phaseFrameCount:actual.length/stride,
    temporalEnergies:Array.from(energies),tailFraction,spectrumResolved,periodChecks,primitiveAtResolvedDivisors,
    tolerances:{absoluteTolerance,relativeTolerance,noiseRms,minPhaseContrast,contrastNoiseFactor,primitiveRelativeTolerance,spectralTailTolerance,repeatFloor},
    caveat:'Finite-grid phase and resolved-period checks, not a proof of a minimal continuum period or a Gray–Scott solution.'};
}
