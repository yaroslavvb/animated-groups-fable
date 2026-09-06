/** Primitive translation cells for any rank-two wallpaper lattice.
 * Input translations are an offline-certified complete same-time subgroup.
 * Camera construction is Euclidean: no anisotropic scaling of the chemistry.
 */
import {viewTransform,latticePointToScreen,screenPointToLattice} from './view-transform.mjs';
import {cellCountLabel,cellGuideMarkup} from './cell-view.mjs';
const EPS=1e-8,mod=x=>((x%1)+1)%1;
const mul=(A,p)=>A.map(r=>r[0]*p[0]+r[1]*p[1]);
const mm=(A,B)=>A.map(r=>[r[0]*B[0][0]+r[1]*B[1][0],r[0]*B[0][1]+r[1]*B[1][1]]);
const det=(a,b)=>a[0]*b[1]-a[1]*b[0];
const inv=A=>{const d=det(A[0],A[1]);return [[A[1][1]/d,-A[0][1]/d],[-A[1][0]/d,A[0][0]/d]];};
const matrix=lattice=>{if(lattice==='square')return [[1,0],[0,1]];if(lattice==='triangular')return [[1,-.5],[0,Math.sqrt(3)/2]];throw Error('Unknown lattice metric.');};
export function wallpaperPrimitiveCell({lattice='square',translations=[]}={}){
 const metric=matrix(lattice),unique=new Map();
 for(const t of [[0,0],...translations]){const v=Array.isArray(t)?t:t?.v;if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))throw Error('Invalid cell translation.');const p=v.map(x=>mod(x)<EPS||1-mod(x)<EPS?0:mod(x));unique.set(p.map(x=>Math.round(x*1e9)).join(','),p);}
 const n=unique.size;if(n>4096)throw Error('Translation subgroup is too large.');
 const key=v=>v.map(x=>((Math.round(x)%n)+n)%n).join(',');
 const points=[...unique.values()].map(v=>v.map(x=>{const r=Math.round(x*n);if(Math.abs(r/n-x)>EPS)throw Error('Translations are not a complete finite subgroup.');return r;}));
 const members=new Set(points.map(key));for(const a of points)for(const b of points)if(!members.has(key([a[0]+b[0],a[1]+b[1]])))throw Error('Translations are not closed.');
 const vectors=[];
 for(const p of points)for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const v=[p[0]/n+i,p[1]/n+j],physical=mul(metric,v),length=physical[0]**2+physical[1]**2;if(length<EPS*EPS)continue;let angle=Math.atan2(physical[1],physical[0]);if(Math.abs(angle)<EPS)angle=0;vectors.push({v,physical,length,angle});}
 const positive=vectors.filter(c=>c.angle>=0&&c.angle<Math.PI-EPS);
 positive.sort((a,b)=>Math.abs(a.length-b.length)>EPS?a.length-b.length:a.angle-b.angle);
 const a=positive[0];
 const choices=vectors.filter(b=>Math.abs(det(a.v,b.v)-1/n)<EPS/n);
 choices.sort((a,b)=>Math.abs(a.length-b.length)>EPS?a.length-b.length:Math.abs(a.v[0])-Math.abs(b.v[0])||a.v[1]-b.v[1]);
 const b=choices[0];if(!b)throw Error('Could not resolve a primitive cell.');
 const B=[[a.v[0],b.v[0]],[a.v[1],b.v[1]]];
 return {lattice,family:lattice==='triangular'?'p6':'p4',index:n,basis:[a.v,b.v],inverse:inv(B),physicalBasis:[a.physical,b.physical],areaRatio:1/n,physicalArea:det(a.physical,b.physical),angle:a.angle,angleDegrees:a.angle*180/Math.PI};
}
export function makeWallpaperCellView({lattice='square',translations=[],count=2,framing='cells',padding=.055}={}){
 if(!Number.isFinite(padding)||padding<0||padding>=.5)throw Error('Invalid cell padding.');
 const countLabel=cellCountLabel(count),cell=wallpaperPrimitiveCell({lattice,translations}),B=[[cell.basis[0][0],cell.basis[1][0]],[cell.basis[0][1],cell.basis[1][1]]];
 const cellToLattice=p=>mul(B,p),cellCorners=[[0,0],[count,0],[count,count],[0,count]];
 let transform,originalCorners;
 if(framing==='simulation'){
  transform=viewTransform({family:cell.family,tiles:count});originalCorners=[[0,0],[1,0],[1,1],[0,1]].map(p=>screenPointToLattice(p,transform));
 }else{
  if(framing!=='cells')throw Error('Unknown cell framing.');
  const c=Math.cos(cell.angle),s=Math.sin(cell.angle),rotation=[[c,s],[-s,c]],metric=matrix(lattice);
  originalCorners=cellCorners.map(cellToLattice);
  const cart=originalCorners.map(p=>mul(rotation,mul(metric,p))),extent=[0,1].map(axis=>Math.max(...cart.map(p=>p[axis]))-Math.min(...cart.map(p=>p[axis]))),scale=Math.max(...extent)/(1-2*padding);
  const viewMatrix=mm(inv(metric),[[c,-s],[s,c]]).map(r=>r.map(v=>v*scale));
  transform=viewTransform({family:cell.family,viewMatrix,viewOrigin:cellToLattice([count/2,count/2])});
 }
 const originalToScreen=p=>latticePointToScreen(p,transform),screenToOriginal=p=>screenPointToLattice(p,transform),corners=originalCorners.map(originalToScreen);
 const contains=p=>{const q=framing==='cells'?mul(cell.inverse,p):originalToScreen(p),bound=framing==='cells'?count:1;return q.every(x=>Number.isFinite(x)&&x>=-EPS&&x<=bound+EPS);};
 const view={cell,count,countLabel,framing,cellCorners,originalCorners,corners,padding,originalToScreen,latticeToScreen:originalToScreen,screenToOriginal,cellToScreen:p=>originalToScreen(cellToLattice(p)),contains,
 viewOptions:{viewMatrix:transform.matrix,viewOrigin:transform.origin},latticeBounds:{min:[0,1].map(i=>Math.min(...originalCorners.map(p=>p[i]))),max:[0,1].map(i=>Math.max(...originalCorners.map(p=>p[i])))},glyphAngleOffset:framing==='cells'?cell.angleDegrees:0,
 clipPath:framing==='cells'?`polygon(${corners.map(p=>p.map(x=>`${x*100}%`).join(' ')).join(', ')})`:''};
 view.guideMarkup=framing==='cells'?cellGuideMarkup(view):'';return view;
}
