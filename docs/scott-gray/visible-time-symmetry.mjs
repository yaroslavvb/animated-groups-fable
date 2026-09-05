/** A gallery visibility policy, separate from proving numerical PDE closure.
 * Every displayed channel must visibly break each nonzero-offset rotation at
 * every phase of the actual linearly interpolated playback, including its seam.
 * Rotations in the zero-offset kernel and pure translations are not tested.
 */
export const VISIBILITY_VERSION='per-channel-rotation-contrast-v1';
export const VISIBILITY_LIMITS=Object.freeze({minimumRelativeColorRange:.05,minimumAbsoluteRms:.002,noiseFactor:100});
const mod=(x,n)=>((x%n)+n)%n;
const assert=(value,message)=>{if(!value)throw Error(message);};

export function auditVisibleTimeSymmetry({field,N,M,ops,noiseRms=0}){
  assert(Number.isInteger(N)&&N>=2&&Number.isInteger(M)&&M>=2,'Visibility audit needs complete spatial and temporal grids.');
  const S=N*N,stride=2*S;
  assert(field?.length===M*stride&&Array.isArray(ops)&&ops.length,'Visibility audit needs the complete movie and canonical operations.');
  assert(Number.isFinite(noiseRms)&&noiseRms>=0,'Visibility uncertainty must be finite and nonnegative.');
  const ranges=[[Infinity,-Infinity],[Infinity,-Infinity]];
  for(let t=0;t<M;t++)for(let c=0;c<2;c++)for(let p=0;p<S;p++){
    const v=field[t*stride+c*S+p];assert(Number.isFinite(v),'Visibility audit rejects nonfinite fields.');
    ranges[c][0]=Math.min(ranges[c][0],v);ranges[c][1]=Math.max(ranges[c][1],v);
  }
  const floor=Math.max(VISIBILITY_LIMITS.minimumAbsoluteRms,VISIBILITY_LIMITS.noiseFactor*noiseRms),operations=[],reasons=[];
  assert(Number.isFinite(floor),'Visibility uncertainty is too large.');
  for(const [operation,op] of ops.entries()){
    const A=op.M,tau=mod(op.tau??0,1),v=op.v??[0,0];
    assert(Array.isArray(A)&&A.length===2&&A.every(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isInteger)),'Visibility audit needs integer lattice operations.');
    assert(Number.isFinite(op.tau??0),'Generator phase must be finite.');
    assert((op.s??1)===1,'Visibility audit only supports forward time shifts.');
    assert(Array.isArray(v)&&v.length===2&&v.every(Number.isFinite),'Generator translation must be finite.');
    const offsets=v.map(x=>x*N);assert(offsets.every(x=>Math.abs(x-Math.round(x))<1e-8),'Generator does not map the lattice exactly.');
    const [[a,b],[c,d]]=A;
    if(!tau||a*d-b*c!==1||(a===1&&b===0&&c===0&&d===1))continue;
    const [tx,ty]=offsets.map(Math.round),map=new Int32Array(S);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)map[y*N+x]=mod(c*x+d*y+ty,N)*N+mod(a*x+b*y+tx,N);
    const channels=[];
    for(let species=0;species<2;species++){
      let minimumSquared=Infinity,phase=0;
      for(let t=0;t<M;t++){
        const first=t*stride+species*S,next=mod(t+1,M)*stride+species*S;
        let aa=0,bb=0,cc=0;
        for(let p=0;p<S;p++){
          const d0=field[first+map[p]]-field[first+p],delta=field[next+map[p]]-field[next+p]-d0;
          aa+=delta*delta;bb+=d0*delta;cc+=d0*d0;
        }
        // Exact minimum of ||d0 + alpha*(d1-d0)||² on this segment.
        const alpha=aa?Math.max(0,Math.min(1,-bb/aa)):0,squared=Math.max(0,(cc+2*bb*alpha+aa*alpha*alpha)/S);
        if(squared<minimumSquared){minimumSquared=squared;phase=mod((t+alpha)/M,1);}
      }
      const minimumRms=Math.sqrt(minimumSquared),range=ranges[species][1]-ranges[species][0];
      const minimumRelativeColorRange=range>0?minimumRms/range:0;
      const passed=minimumRms>=floor&&minimumRelativeColorRange>=VISIBILITY_LIMITS.minimumRelativeColorRange;
      channels.push({channel:species?'V':'U',minimumRms,minimumRelativeColorRange,phase,passed});
      if(!passed)reasons.push(`Rotation ${operation}, ${species?'V':'U'}: an unshifted frame is too close to its rotation near phase ${phase.toFixed(4)}.`);
    }
    operations.push({operation,tau,channels,passed:channels.every(c=>c.passed)});
  }
  return {version:VISIBILITY_VERSION,passed:reasons.length===0,referenceOnly:operations.length===0,
    thresholds:{...VISIBILITY_LIMITS,effectiveAbsoluteFloor:floor},noiseRms,operations,reasons,
    minimumRelativeColorRange:operations.length?Math.min(...operations.flatMap(o=>o.channels.map(c=>c.minimumRelativeColorRange))):null,
    scope:'Both displayed concentrations; every nonzero-offset rotation; exact minimum over every linear playback segment, including the loop seam. Zero-offset spatial symmetries are allowed. This is a visibility policy, not a continuum existence proof.'};
}
