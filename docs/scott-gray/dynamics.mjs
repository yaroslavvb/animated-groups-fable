import {mod} from './seeds.mjs';
export function mapIndex(x,y,N,op,inverse=false) {
  let a,b;
  if (inverse) {const u=x-op.v[0]*N,v=y-op.v[1]*N;a=op.M[0][0]*u+op.M[1][0]*v;b=op.M[0][1]*u+op.M[1][1]*v;}
  else {a=op.M[0][0]*x+op.M[0][1]*y+op.v[0]*N;b=op.M[1][0]*x+op.M[1][1]*y+op.v[1]*N;}
  return mod(Math.round(b),N)*N+mod(Math.round(a),N);
}
export function projectKernel(state,N,ops) {
  const kernel=ops.filter(o=>o.tau===0), nn=N*N, out=new Float64Array(2*nn);
  for(const op of kernel) for(let y=0;y<N;y++) for(let x=0;x<N;x++) {const i=y*N+x,j=mapIndex(x,y,N,op);for(let c=0;c<2;c++) out[c*nn+i]+=state[c*nn+j]/kernel.length;}
  return out;
}
export function rhs(state,N,p,out=new Float64Array(state.length)) {
  const nn=N*N, inv=1/(p.dx*p.dx);
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
    const i=y*N+x, l=y*N+mod(x-1,N), r=y*N+mod(x+1,N), d=mod(y-1,N)*N+x, u=mod(y+1,N)*N+x;
    const U=state[i],V=state[nn+i],reaction=U*V*V;
    out[i]=p.Du*inv*(state[l]+state[r]+state[d]+state[u]-4*U)-reaction+p.F*(1-U);
    out[nn+i]=p.Dv*inv*(state[nn+l]+state[nn+r]+state[nn+d]+state[nn+u]-4*V)+reaction-(p.F+p.k)*V;
  }
  return out;
}
export function createStepper(initial,N,p) {
  let state=Float64Array.from(initial);const a=new Float64Array(state.length),b=a.slice(),mid=a.slice();
  // Explicit midpoint with a conservative diffusion / reaction step cap.
  const maxDt=Math.min(.4,.18*p.dx*p.dx/Math.max(p.Du,p.Dv));
  return {get state(){return state;},maxDt,advance(duration){const steps=Math.ceil(duration/maxDt),dt=duration/steps;
    for(let s=0;s<steps;s++){rhs(state,N,p,a);for(let i=0;i<state.length;i++)mid[i]=state[i]+dt*.5*a[i];rhs(mid,N,p,b);for(let i=0;i<state.length;i++){state[i]+=dt*b[i];if(!Number.isFinite(state[i])||Math.abs(state[i])>10)throw Error('Integration diverged. Reduce the cell size or adjust the parameters.');}}
    return state;
  }};
}
export function movieStats(field,N,M,ops) {
  const nn=N*N, stride=2*nn;let temporal=0,spatial=0,sy=0,count=0;
  for(let i=0;i<stride;i++){let mean=0;for(let t=0;t<M;t++)mean+=field[t*stride+i]/M;for(let t=0;t<M;t++)temporal+=(field[t*stride+i]-mean)**2;}
  for(let t=0;t<M;t++)for(let c=0;c<2;c++){let mean=0;for(let i=0;i<nn;i++)mean+=field[t*stride+c*nn+i]/nn;for(let i=0;i<nn;i++)spatial+=(field[t*stride+c*nn+i]-mean)**2;}
  for(const op of ops)for(let t=0;t<M;t++){const t2=mod(t+Math.round(op.tau*M),M);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,j=mapIndex(x,y,N,op);for(let c=0;c<2;c++){sy+=(field[t*stride+c*nn+i]-field[t2*stride+c*nn+j])**2;count++;}}}
  return {temporalRms:Math.sqrt(temporal/field.length),spatialRms:Math.sqrt(spatial/field.length),symmetryRms:Math.sqrt(sy/count)};
}
