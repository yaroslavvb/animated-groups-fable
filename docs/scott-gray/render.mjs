import {mod} from './seeds.mjs';
const palettes={ember:[[0,18,9,39],[.22,65,12,94],[.43,99,25,116],[.58,171,45,90],[.69,240,111,32],[.78,252,181,42],[.89,253,219,94],[1,252,242,158]],ceramic:[[0,91,64,57],[.15,171,111,87],[.33,247,159,119],[.48,239,175,130],[.59,77,41,97],[.68,37,47,120],[.77,117,125,180],[.86,208,213,235],[1,252,249,238]],concentration:[[0,18,18,24],[1,245,245,251]]};
const tile=document.createElement('canvas'),ctx=tile.getContext('2d');
let paletteName,colours;
export const fmt=v=>Number.isFinite(v)?v===0?'0':Math.abs(v)<.001?v.toExponential(2):v.toFixed(4):'—';
export function valueAt(field,c,x,y,t,N,M){
  const nn=N*N,ft=mod(t)*M,k=Math.floor(ft),a=ft-k;
  const x0=Math.floor(x),y0=Math.floor(y),fx=mod(x,1),fy=mod(y,1);let v=0;
  for(let ky=0;ky<2;ky++)for(let kx=0;kx<2;kx++){
    const i=mod(y0+ky,N)*N+mod(x0+kx,N),w=(kx?fx:1-fx)*(ky?fy:1-fy);
    v+=w*((1-a)*field[k*2*nn+c*nn+i]+a*field[mod(k+1,M)*2*nn+c*nn+i]);
  }return v;
}
export function clearCanvas(canvas,text=''){
  const c=canvas.getContext('2d');c.fillStyle='#271337';c.fillRect(0,0,canvas.width,canvas.height);
  if(text){c.fillStyle='#cbbfd7';c.font='12px sans-serif';c.textAlign='center';c.fillText(text,canvas.width/2,canvas.height/2);}
}
export function renderField(canvas,field,N,M,t,{tiles=1,palette='ember',operation=null,range=null}={}){
  if(range!==null&&(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||!(range[1]>range[0])))throw Error('A concentration range requires two finite increasing endpoints.');
  const lower=range?.[0]??(palette==='concentration'?0:.3),span=range?range[1]-range[0]:(palette==='concentration'?.4:.56);
  if(paletteName!==palette){paletteName=palette;const stops=palettes[palette];colours=Array.from({length:1024},(_,i)=>{const v=i/1023;let j=1;while(j<stops.length-1&&stops[j][0]<v)j++;const a=stops[j-1],b=stops[j],f=(v-a[0])/(b[0]-a[0]);return [1,2,3].map(i=>Math.round(a[i]+(b[i]-a[i])*f));});}
  // A node at i/N belongs on the cell boundary at screen coordinate i*size/N,
  // not at the center of image pixel i. A periodic one-node border permits
  // bilinear filtering across the seam without clamping the last sample.
  const padded=N+2;tile.width=padded;tile.height=padded;const data=ctx.createImageData(padded,padded);
  for(let y=-1;y<=N;y++)for(let x=-1;x<=N;x++){
    let sx=x,sy=y;
    if(operation){const a=x-operation.v[0]*N,b=y-operation.v[1]*N;sx=operation.M[0][0]*a+operation.M[1][0]*b;sy=operation.M[0][1]*a+operation.M[1][1]*b;}
    const v=valueAt(field,1,sx,sy,t,N,M),u=valueAt(field,0,sx,sy,t,N,M),z=((palette==='concentration'?v:u)-lower)/span;
    const rgb=colours[Math.max(0,Math.min(1023,Math.round(z*1023)))],i=((y+1)*padded+x+1)*4;
    data.data[i]=rgb[0];data.data[i+1]=rgb[1];data.data[i+2]=rgb[2];data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);const c=canvas.getContext('2d'),sizeX=canvas.width/tiles,sizeY=canvas.height/tiles,unitX=sizeX/N,unitY=sizeY/N;
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='low';
  for(let y=0;y<tiles;y++)for(let x=0;x<tiles;x++){
    c.save();c.beginPath();c.rect(x*sizeX,y*sizeY,sizeX,sizeY);c.clip();
    c.drawImage(tile,x*sizeX-1.5*unitX,y*sizeY-1.5*unitY,padded*unitX,padded*unitY);c.restore();
  }
}
/** Periodic bilinear spatial resampling; no temporal seam blending. */
export function resampleState(state,N,target){
  if(N===target)return Float64Array.from(state);
  const out=new Float64Array(2*target*target);
  for(let c=0;c<2;c++)for(let y=0;y<target;y++)for(let x=0;x<target;x++)out[c*target*target+y*target+x]=valueAt(state,c,x*N/target,y*N/target,0,N,1);
  return out;
}
