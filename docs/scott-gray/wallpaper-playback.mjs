/** Saved-field playback on the metric used by the offline solver. */
import {createPlayer,drawCPU} from './p6/playback.mjs';
import {createWebGLGrayScott} from './webgl.mjs';
import {renderField} from './render.mjs';
/** The WebGL engine only displays uploaded saved frames here; its simulation uniforms are
 * irrelevant to playback, so non-Gray–Scott records hand it placeholder chemistry. */
const displayParams=record=>record.model==='gray-scott'||!record.model?record.config.params:{Du:.16,Dv:.08,F:.026,k:.055,dx:record.config.params.dx,stencil:'five-point'};
export function createWallpaperPlayer(gpuCanvas,cpuCanvas,record){
 const triangular=record.config.params.stencil==='triangular-six',c=record.config;
 let engine=null,lost=false;
 const fallback=()=>{lost=true;engine?.dispose();engine=null;gpuCanvas.hidden=true;cpuCanvas.hidden=false;};
 try{engine=triangular?createPlayer(gpuCanvas,record,{onContextLost:fallback}):createWebGLGrayScott({canvas:gpuCanvas,N:c.N,initial:Float32Array.from(record.field.slice(0,2*c.N*c.N)),params:displayParams(record),onContextLost:fallback});}catch{fallback();}
 gpuCanvas.hidden=!engine;cpuCanvas.hidden=!!engine;
 const loss=e=>{e.preventDefault();fallback();};if(!triangular)gpuCanvas.addEventListener('webglcontextlost',loss);
 return {get backend(){return engine?'WebGL playback':'CPU playback';},draw(phase,options={}){
  const range=record.ranges[options.palette==='concentration'?'v':'u'];
  if(engine){try{if(triangular)engine.draw(phase,options);else{const S=2*c.N*c.N,f=((phase%1+1)%1)*c.M,t=Math.floor(f),a=f-t,frame=new Float32Array(S);for(let i=0;i<S;i++)frame[i]=(1-a)*record.field[t*S+i]+a*record.field[((t+1)%c.M)*S+i];engine.upload(frame);engine.render({...options,range,width:gpuCanvas.width,height:gpuCanvas.height});}}catch{fallback();}}
  if(!engine){if(triangular)drawCPU(cpuCanvas,record,phase,options);else renderField(cpuCanvas,record.field,c.N,c.M,phase,{...options,range});}
 },dispose(){gpuCanvas.removeEventListener('webglcontextlost',loss);engine?.dispose();engine=null;}};
}
