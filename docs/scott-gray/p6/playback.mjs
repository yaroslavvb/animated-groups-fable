/** Playback of saved fields on the Euclidean triangular lattice. No PDE solver. */
export const mod=(x,n=1)=>((x%n)+n)%n;
const SQRT3=Math.sqrt(3);
const PALETTES={ember:[[0,18,9,39],[.22,65,12,94],[.43,99,25,116],[.58,171,45,90],[.69,240,111,32],[.78,252,181,42],[.89,253,219,94],[1,252,242,158]],ceramic:[[0,91,64,57],[.15,171,111,87],[.33,247,159,119],[.48,239,175,130],[.59,77,41,97],[.68,37,47,120],[.77,117,125,180],[.86,208,213,235],[1,252,249,238]],concentration:[[0,18,18,24],[1,245,245,251]]};
const paletteCache=new Map();
export function paletteColors(name='ember'){
  if(paletteCache.has(name))return paletteCache.get(name);
  const stops=PALETTES[name];if(!stops)throw Error('Unknown colour map.');
  const colors=new Uint8Array(1024*4);
  for(let i=0;i<1024;i++){const z=i/1023;let j=1;while(j<stops.length-1&&stops[j][0]<z)j++;const a=stops[j-1],b=stops[j],f=(z-a[0])/(b[0]-a[0]);for(let c=0;c<3;c++)colors[4*i+c]=Math.round(a[c+1]+f*(b[c+1]-a[c+1]));colors[4*i+3]=255;}
  paletteCache.set(name,colors);return colors;
}
export const latticeToCartesian=([u,v])=>[u-v/2,SQRT3*v/2];
export const cartesianToLattice=([x,y])=>[x+y/SQRT3,2*y/SQRT3];
/** Square screen, centered at the sixfold rotation. Physical y points upward. */
export const screenToLattice=([x,y],tiles=2)=>cartesianToLattice([(x-.5)*tiles,(.5-y)*tiles]);
export const latticeToScreen=(p,tiles=2)=>{const [x,y]=latticeToCartesian(p);return [.5+x/tiles,.5-y/tiles];};
export function inverseOperation(p,operation){
  if(!operation)return p;
  const M=operation.M??operation.matrix,v=operation.v??operation.translation,det=M[0][0]*M[1][1]-M[0][1]*M[1][0];
  const x=p[0]-v[0],y=p[1]-v[1];
  return [(M[1][1]*x-M[0][1]*y)/det,(-M[1][0]*x+M[0][0]*y)/det];
}
export function valueAt(record,channel,u,v,phase){
  const {N,M}=record.config,S=N*N,ft=mod(phase)*M,t=Math.floor(ft),a=ft-t,x=mod(u)*N,y=mod(v)*N,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  // The (0,0)→(1,1) diagonal splits this 120° rhombus into equilateral
  // triangles. Piecewise-linear interpolation therefore commutes with R60;
  // ordinary bilinear interpolation on lattice-coordinate squares does not.
  const sample=(dx,dy)=>{const i=channel*S+mod(y0+dy,N)*N+mod(x0+dx,N);return (1-a)*record.field[t*2*S+i]+a*record.field[mod(t+1,M)*2*S+i];};
  return fx>=fy?(1-fx)*sample(0,0)+(fx-fy)*sample(1,0)+fy*sample(1,1):(1-fy)*sample(0,0)+(fy-fx)*sample(0,1)+fx*sample(1,1);
}
/** Compare both concentrations, on their actual lattice nodes. */
export function comparisonErrors(record,phase,operation){
  const N=record.config.N;let shifted=0,spatial=0;
  for(let c=0;c<2;c++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const [u,v]=inverseOperation([x/N,y/N],operation),left=valueAt(record,c,u,v,phase);
    shifted+=(left-valueAt(record,c,x/N,y/N,phase+operation.tau))**2;
    spatial+=(left-valueAt(record,c,x/N,y/N,phase))**2;
  }
  return {shiftedRms:Math.sqrt(shifted/(2*N*N)),sameTimeRms:Math.sqrt(spatial/(2*N*N))};
}
export function renderPixels(record,phase,{width=192,height=width,tiles=2,palette='ember',operation=null}={}){
  const channel=palette==='concentration'?1:0,[lo,hi]=record.ranges[channel?'v':'u'],colors=paletteColors(palette),pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const point=inverseOperation(screenToLattice([(x+.5)/width,(y+.5)/height],tiles),operation);
    const z=(valueAt(record,channel,...point,phase)-lo)/(hi-lo),index=4*Math.max(0,Math.min(1023,Math.round(z*1023))),offset=4*(y*width+x);
    for(let c=0;c<4;c++)pixels[offset+c]=colors[index+c];
  }
  return pixels;
}
export function drawCPU(canvas,record,phase,options={}){
  const context=canvas.getContext('2d'),pixels=renderPixels(record,phase,{width:canvas.width,height:canvas.height,...options});
  const image=context.createImageData(canvas.width,canvas.height);image.data.set(pixels);context.putImageData(image,0,0);
}
const VERTEX=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FRAGMENT=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D field;uniform sampler2D colors;uniform int size;uniform float phaseMix;uniform float tiles;uniform vec2 viewport;uniform vec2 limits;uniform int channel;
out vec4 outColor;
ivec2 wrap(ivec2 p){return (p%size+size)%size;}
vec4 at(ivec2 p){return texelFetch(field,wrap(p),0);}
void main(){
  vec2 physical=(gl_FragCoord.xy/viewport-.5)*tiles;
  vec2 lattice=vec2(physical.x+physical.y/sqrt(3.),2.*physical.y/sqrt(3.));
  vec2 grid=fract(lattice)*float(size),f=fract(grid);ivec2 p=ivec2(floor(grid));
  vec4 sampleValue=f.x>=f.y?(1.-f.x)*at(p)+(f.x-f.y)*at(p+ivec2(1,0))+f.y*at(p+ivec2(1,1)):(1.-f.y)*at(p)+(f.y-f.x)*at(p+ivec2(0,1))+f.x*at(p+ivec2(1,1));
  float z=channel==0?mix(sampleValue.x,sampleValue.z,phaseMix):mix(sampleValue.y,sampleValue.w,phaseMix);
  int index=int(floor(clamp((z-limits.x)/(limits.y-limits.x),0.,1.)*1023.+.5));
  outColor=texelFetch(colors,ivec2(index,0),0);
}`;
/** WebGL only interpolates saved samples; no reaction or diffusion step occurs. */
export function createPlayer(canvas,record,{onContextLost=()=>{}}={}){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});if(!gl)throw Error('WebGL 2 unavailable.');
  const shaders=[],textures=[];
  function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  function texture(unit,internal,width,height,type,data){const t=gl.createTexture();textures.push(t);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,internal,width,height,0,gl.RGBA,type,data);return t;}
  const {N,M}=record.config,S=N*N,frame=new Float32Array(4*S),fieldTexture=texture(0,gl.RGBA32F,N,N,gl.FLOAT,null),colorTexture=texture(1,gl.RGBA8,1024,1,gl.UNSIGNED_BYTE,paletteColors());
  const uniforms=Object.fromEntries(['field','colors','size','phaseMix','tiles','viewport','limits','channel'].map(name=>[name,gl.getUniformLocation(program,name)]));
  let previousFrame=-1,previousPalette='ember';
  const lost=e=>{e.preventDefault();onContextLost();};canvas.addEventListener('webglcontextlost',lost);
  return {backend:'WebGL playback',draw(phase,{tiles=2,palette='ember'}={}){
    const ft=mod(phase)*M,t=Math.floor(ft),next=mod(t+1,M);
    if(t!==previousFrame){for(let i=0;i<S;i++){frame[4*i]=record.field[2*S*t+i];frame[4*i+1]=record.field[2*S*t+S+i];frame[4*i+2]=record.field[2*S*next+i];frame[4*i+3]=record.field[2*S*next+S+i];}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fieldTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.FLOAT,frame);previousFrame=t;}
    if(palette!==previousPalette){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,colorTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,1024,1,gl.RGBA,gl.UNSIGNED_BYTE,paletteColors(palette));previousPalette=palette;}
    gl.useProgram(program);gl.uniform1i(uniforms.field,0);gl.uniform1i(uniforms.colors,1);gl.uniform1i(uniforms.size,N);gl.uniform1f(uniforms.phaseMix,ft-t);gl.uniform1f(uniforms.tiles,tiles);gl.uniform2f(uniforms.viewport,canvas.width,canvas.height);gl.uniform2fv(uniforms.limits,record.ranges[palette==='concentration'?'v':'u']);gl.uniform1i(uniforms.channel,palette==='concentration'?1:0);gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);
  },dispose(){canvas.removeEventListener('webglcontextlost',lost);for(const t of textures)gl.deleteTexture(t);for(const s of shaders)gl.deleteShader(s);gl.deleteProgram(program);}};
}
