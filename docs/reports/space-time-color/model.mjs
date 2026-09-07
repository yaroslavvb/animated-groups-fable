// An analytic 442 movie, independent of the numerical reaction–diffusion data.
export const TAU = 2 * Math.PI;
export function field(x, y, phase, bias = 0) {
  return Math.sin(TAU*x)*Math.cos(TAU*phase)
    + Math.sin(TAU*y)*Math.sin(TAU*phase)
    + bias*(Math.cos(TAU*x)+Math.cos(TAU*y));
}
export function rotate(x, y, quarterTurns) {
  switch ((quarterTurns % 4 + 4) % 4) {
    case 1: return [-y, x];
    case 2: return [-x, -y];
    case 3: return [y, -x];
    default: return [x, y];
  }
}
export function transformed(x, y, phase, rotation, shift, swap, bias=0) {
  const [rx,ry]=rotate(x,y,rotation);
  return (swap ? -1 : 1)*field(rx,ry,phase+shift,bias);
}
// A whole-loop sample, not a claim that the sample itself proves the identity.
// The symbolic proof is on the report page. Neutral nodal boundaries are omitted.
export function auditModel(rotation, shift, swap, bias=0) {
  let max=0,sum=0,mismatch=0,count=0,colored=0;
  for(let k=0;k<24;k++) for(let j=0;j<23;j++) for(let i=0;i<23;i++) {
    const x=(i+.37)/23,y=(j+.19)/23,t=(k+.23)/24;
    const a=field(x,y,t,bias),b=transformed(x,y,t,rotation,shift,swap,bias),d=a-b;
    max=Math.max(max,Math.abs(d));sum+=d*d;count++;
    if(Math.abs(a)>1e-10 && Math.abs(b)>1e-10) {colored++;if(a*b<0)mismatch++;}
  }
  return {max,rms:Math.sqrt(sum/count),mismatch:mismatch/colored,count};
}
