/**
 * WebGL2 Gray–Scott forward integration on a periodic square lattice.
 *
 * Architecture follows Vladimir Bulatov's symhub Gray–Scott simulator:
 * float concentration textures, fragment-shader reaction/diffusion, and
 * ping-pong framebuffer updates. This implementation uses RGBA32F for portable
 * float readback, integer lattice addressing, and explicit midpoint time steps.
 * Bulatov's optional nine-point stencil is retained without renormalization:
 * 0.8 * axial + 0.2 * diagonal - 4 * center (continuum factor 1.2).
 *
 * State layout: N*N U values followed by N*N V values, x fastest;
 * node coordinates x=i/N, y=j/N. No time-shift symmetry is imposed here.
 * Numerical periodic-orbit acceptance remains the independent CPU solver's job.
 */

export const WEBGL_PROVENANCE = Object.freeze({
  simulator: 'https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/gray_scott_simulation.js',
  shader: 'https://github.com/vbulatov2011/symhub/blob/37e3520df40ba0ef38e2c916090790b9bbaec3dc/apps/symsim/gray_scott/js/shaders/grayScottShader.glsl.mjs',
  stencil: 'Bulatov nine-point: 0.8 axial + 0.2 diagonal − 4 center; effective continuum multiplier 1.2.',
});

const VERTEX = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const LATTICE = `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uSource;
uniform int uN;
ivec2 wrapNode(ivec2 p) { return ((p % uN) + uN) % uN; }
vec2 sampleNode(ivec2 p) { return texelFetch(uSource, wrapNode(p), 0).rg; }
`;

const STEP = `#version 300 es
${LATTICE}
uniform sampler2D uBase;
uniform vec4 uChemistry;
uniform float uInvDx2;
uniform float uDt;
uniform bool uNinePoint;
out vec4 outValue;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 q = sampleNode(p);
  vec2 axial = sampleNode(p+ivec2(-1,0)) + sampleNode(p+ivec2(1,0))
             + sampleNode(p+ivec2(0,-1)) + sampleNode(p+ivec2(0,1));
  vec2 lap;
  if (uNinePoint) {
    vec2 diagonal = sampleNode(p+ivec2(-1,-1)) + sampleNode(p+ivec2(1,-1))
                  + sampleNode(p+ivec2(-1,1)) + sampleNode(p+ivec2(1,1));
    lap = 0.8 * axial + 0.2 * diagonal - 4.0 * q;
  } else { lap = axial - 4.0 * q; }
  float reaction = q.r * q.g * q.g;
  vec2 rate = uChemistry.xy * uInvDx2 * lap
            + vec2(-reaction + uChemistry.z * (1.0-q.r),
                    reaction - (uChemistry.z+uChemistry.w) * q.g);
  outValue = vec4(texelFetch(uBase,p,0).rg + uDt * rate, 0.0, 1.0);
}`;

const PROJECT = `#version 300 es
${LATTICE}
uniform int uOperationCount;
uniform ivec4 uMatrices[64];
uniform ivec2 uShifts[64];
out vec4 outValue;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 value = vec2(0.0);
  for (int i=0; i<64; i++) {
    if (i >= uOperationCount) break;
    ivec4 a = uMatrices[i];
    ivec2 q = ivec2(a.x*p.x+a.y*p.y, a.z*p.x+a.w*p.y) + uShifts[i];
    value += sampleNode(q);
  }
  outValue = vec4(value / float(uOperationCount), 0.0, 1.0);
}`;

const PRESENT = `#version 300 es
${LATTICE}
uniform sampler2D uPalette;
uniform vec2 uResolution;
uniform float uTiles;
uniform mat2 uInverseMatrix;
uniform vec2 uShift;
uniform bool uConcentration;
out vec4 outColor;
void main() {
  // Screen y increases downward, matching the CPU field and generator overlay.
  vec2 point = vec2(gl_FragCoord.x, uResolution.y-gl_FragCoord.y)
             / uResolution * uTiles;
  vec2 p = uInverseMatrix * (point-uShift) * float(uN);
  ivec2 base = ivec2(floor(p));
  vec2 a = fract(p);
  vec2 q = mix(mix(sampleNode(base),sampleNode(base+ivec2(1,0)),a.x),
               mix(sampleNode(base+ivec2(0,1)),sampleNode(base+ivec2(1,1)),a.x),a.y);
  float value = clamp(uConcentration ? q.g/0.4 : (q.r-0.3)/0.56,0.0,1.0);
  outColor = texelFetch(uPalette,ivec2(int(floor(value*1023.0+0.5)),0),0);
}`;

const PALETTES = {
  ember: [[0,18,9,39],[.22,65,12,94],[.43,99,25,116],[.58,171,45,90],[.69,240,111,32],[.78,252,181,42],[.89,253,219,94],[1,252,242,158]],
  ceramic: [[0,91,64,57],[.15,171,111,87],[.33,247,159,119],[.48,239,175,130],[.59,77,41,97],[.68,37,47,120],[.77,117,125,180],[.86,208,213,235],[1,252,249,238]],
  concentration: [[0,18,18,24],[1,245,245,251]],
};

function paletteData(name) {
  const stops=PALETTES[name];
  if(!stops) throw new Error(`Unknown palette: ${name}`);
  const data=new Uint8Array(1024*4);
  for(let i=0;i<1024;i++) {
    const value=i/1023;let j=1;
    while(j<stops.length-1&&stops[j][0]<value)j++;
    const a=stops[j-1],b=stops[j],t=(value-a[0])/(b[0]-a[0]);
    for(let c=0;c<3;c++)data[4*i+c]=Math.round(a[c+1]+t*(b[c+1]-a[c+1]));
    data[4*i+3]=255;
  }
  return data;
}

function validateOperation(op,N) {
  const a=op?.M,v=op?.v;
  if(!a||!v||a.length!==2||a.some(row=>row.length!==2)||v.length!==2
      ||a.flat().some(x=>!Number.isInteger(x))||v.some(x=>!Number.isFinite(x)))
    throw new Error('A spatial operation requires an integer 2×2 M and a finite 2-vector v.');
  const [[aa,b],[c,d]]=a;
  if(aa*aa+c*c!==1||b*b+d*d!==1||aa*b+c*d!==0)
    throw new Error('Spatial operations must be square-lattice isometries.');
  if(v.some(x=>Math.abs(x*N-Math.round(x*N))>1e-7))
    throw new Error('A spatial operation does not preserve this lattice.');
}

/** Throws a descriptive error when float render targets are unavailable. */
export function createWebGLGrayScott({canvas,N,initial,params={},stencil=params.stencil??'five-point',onContextLost=()=>{}}={}) {
  if(!Number.isInteger(N)||N<4)throw new Error('WebGL grid size must be an integer of at least four.');
  if(!canvas?.getContext)throw new Error('A fresh canvas is required for WebGL2.');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('WebGL2 is unavailable; use the CPU integrator.');
  if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Float framebuffer support is unavailable; use the CPU integrator.');
  if(N>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw new Error('The selected lattice is larger than the GPU texture limit.');
  let disposed=false,lost=false,time=0,currentPalette=null;
  const targets=[],programs=[],textures=[];
  const stateParams={Du:.16,Dv:.08,F:.026,k:.055,dx:1,dt:.4,...params};
  let currentStencil=stencil;
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  function assertReady(){if(disposed)throw new Error('WebGL integrator has been disposed.');if(lost||gl.isContextLost())throw new Error('WebGL context lost; restart the simulation.');}
  function checkParams(p) {
    for(const name of ['Du','Dv','F','k','dx','dt'])
      if(!Number.isFinite(p[name])||p[name]<0||(['dx','dt'].includes(name)&&p[name]===0))throw new Error(`Invalid Gray–Scott parameter: ${name}`);
  }
  function setParams(next={}) {
    assertReady();const proposed={...stateParams,...next};checkParams(proposed);
    if(next.stencil!==undefined) {
      if(!['five-point','bulatov9','bulatov-nine-point'].includes(next.stencil))throw new Error('Unknown diffusion stencil.');
      currentStencil=next.stencil==='bulatov-nine-point'?'bulatov9':next.stencil;
    }
    Object.assign(stateParams,proposed);
  }
  function compile(type,source) {
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('WebGL shader compilation failed: '+reason);}
    return shader;
  }
  function program(fragment) {
    const vertex=compile(gl.VERTEX_SHADER,VERTEX),pixel=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();
    gl.attachShader(p,vertex);gl.attachShader(p,pixel);gl.linkProgram(p);gl.deleteShader(vertex);gl.deleteShader(pixel);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const reason=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('WebGL shader linking failed: '+reason);}
    programs.push(p);const locations=new Map();
    return {p,uniform(name){if(!locations.has(name))locations.set(name,gl.getUniformLocation(p,name));return locations.get(name);}};
  }
  function texture(internalFormat,width,height,format,type,data=null) {
    const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,width,height,0,format,type,data);return t;
  }
  function target() {
    const t=texture(gl.RGBA32F,N,N,gl.RGBA,gl.FLOAT),fbo=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    const out={t,fbo};targets.push(out);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('RGBA32F framebuffer is incomplete; use the CPU integrator.');
    return out;
  }
  function bindTexture(t,unit) {gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
  let stepProgram,projectProgram,presentProgram,read,write,middle,paletteTexture;
  function lostHandler(event){event.preventDefault();lost=true;onContextLost();}
  function dispose() {
    if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostHandler);
    for(const t of targets)gl.deleteFramebuffer(t.fbo);
    for(const t of textures)gl.deleteTexture(t);
    for(const p of programs)gl.deleteProgram(p);
    gl.deleteVertexArray(vao);
  }
  try {
    setParams({stencil});
    stepProgram=program(STEP);projectProgram=program(PROJECT);presentProgram=program(PRESENT);
    read=target();write=target();middle=target();
    paletteTexture=texture(gl.RGBA8,1024,1,gl.RGBA,gl.UNSIGNED_BYTE,paletteData('ember'));currentPalette='ember';
    gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);
    canvas.addEventListener('webglcontextlost',lostHandler);
  }catch(error){dispose();throw error;}
  function upload(planar) {
    assertReady();if(planar.length!==2*N*N)throw new Error(`Expected ${2*N*N} planar concentrations.`);
    const rgba=new Float32Array(4*N*N),nn=N*N;
    for(let i=0;i<nn;i++) {
      const u=planar[i],v=planar[nn+i];
      if(!Number.isFinite(u)||!Number.isFinite(v))throw new Error('Cannot upload nonfinite concentrations.');
      rgba[4*i]=u;rgba[4*i+1]=v;rgba[4*i+3]=1;
    }
    bindTexture(read.t,0);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.FLOAT,rgba);time=0;
  }
  // Explicit midpoint diffusion is stable on the negative real axis to −2.
  // The 0.18 factor leaves margin below the five-point limit of 0.25.
  // Nine-point high-frequency eigenvalues are no larger in absolute value.
  function maxDt(){return Math.min(.4,.18*stateParams.dx*stateParams.dx/Math.max(stateParams.Du,stateParams.Dv,1e-12));}
  function effectiveDt(){return Math.min(stateParams.dt,maxDt());}
  function step(count=1,requestedDt=effectiveDt()) {
    assertReady();if(!Number.isInteger(count)||count<0)throw new Error('Step count must be a nonnegative integer.');
    if(!(requestedDt>0)||!Number.isFinite(requestedDt))throw new Error('The timestep must be positive and finite.');
    const dt=Math.min(requestedDt,maxDt()),p=stepProgram;
    gl.useProgram(p.p);gl.bindVertexArray(vao);gl.viewport(0,0,N,N);
    gl.uniform1i(p.uniform('uSource'),0);gl.uniform1i(p.uniform('uBase'),1);gl.uniform1i(p.uniform('uN'),N);
    gl.uniform4f(p.uniform('uChemistry'),stateParams.Du,stateParams.Dv,stateParams.F,stateParams.k);
    gl.uniform1f(p.uniform('uInvDx2'),1/(stateParams.dx*stateParams.dx));gl.uniform1i(p.uniform('uNinePoint'),currentStencil==='bulatov9');
    for(let i=0;i<count;i++) {
      bindTexture(read.t,0);bindTexture(read.t,1);gl.uniform1f(p.uniform('uDt'),dt*.5);
      gl.bindFramebuffer(gl.FRAMEBUFFER,middle.fbo);gl.drawArrays(gl.TRIANGLES,0,3);
      bindTexture(middle.t,0);gl.uniform1f(p.uniform('uDt'),dt);
      gl.bindFramebuffer(gl.FRAMEBUFFER,write.fbo);gl.drawArrays(gl.TRIANGLES,0,3);
      [read,write]=[write,read];
    }
    time+=count*dt;return {steps:count,dt,duration:count*dt,time};
  }
  function advance(duration) {
    assertReady();if(!Number.isFinite(duration)||duration<0)throw new Error('Duration must be finite and nonnegative.');
    if(duration===0)return {steps:0,dt:0,duration:0,time};
    const count=Math.ceil(duration/effectiveDt());return step(count,duration/count);
  }
  function projectKernel(operations) {
    assertReady();const ops=operations.filter(op=>Math.abs(op.tau??0)<1e-12);
    if(!ops.length)throw new Error('The spatial kernel must include the identity.');
    if(ops.length>64)throw new Error('At most 64 instantaneous spatial operations are supported.');
    const matrices=new Int32Array(4*ops.length),shifts=new Int32Array(2*ops.length);
    ops.forEach((op,i)=>{validateOperation(op,N);if((op.s??1)!==1)throw new Error('Time reversal is not a Gray–Scott equivariance.');matrices.set(op.M.flat(),4*i);shifts.set(op.v.map(x=>Math.round(x*N)),2*i);});
    const p=projectProgram;gl.useProgram(p.p);gl.bindVertexArray(vao);bindTexture(read.t,0);
    gl.uniform1i(p.uniform('uSource'),0);gl.uniform1i(p.uniform('uN'),N);gl.uniform1i(p.uniform('uOperationCount'),ops.length);
    gl.uniform4iv(p.uniform('uMatrices[0]'),matrices);gl.uniform2iv(p.uniform('uShifts[0]'),shifts);
    gl.viewport(0,0,N,N);gl.bindFramebuffer(gl.FRAMEBUFFER,write.fbo);gl.drawArrays(gl.TRIANGLES,0,3);[read,write]=[write,read];
  }
  function readback() {
    assertReady();const packed=new Float32Array(4*N*N),planar=new Float32Array(2*N*N);
    gl.bindFramebuffer(gl.FRAMEBUFFER,read.fbo);gl.readPixels(0,0,N,N,gl.RGBA,gl.FLOAT,packed);
    const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(`WebGL concentration readback failed (${error}).`);
    for(let i=0;i<N*N;i++){planar[i]=packed[4*i];planar[N*N+i]=packed[4*i+1];}
    return planar;
  }
  function render({width=canvas.width,height=canvas.height,tiles=1,palette='ember',operation=null}={}) {
    assertReady();if(!(width>0&&height>0&&tiles>0)||![width,height,tiles].every(Number.isFinite))throw new Error('Invalid render size or tile count.');
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    if(currentPalette!==palette){bindTexture(paletteTexture,1);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,1024,1,gl.RGBA,gl.UNSIGNED_BYTE,paletteData(palette));currentPalette=palette;}
    if(operation)validateOperation(operation,N);
    const matrix=operation?.M??[[1,0],[0,1]],shift=operation?.v??[0,0],p=presentProgram;
    gl.useProgram(p.p);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    bindTexture(read.t,0);bindTexture(paletteTexture,1);gl.uniform1i(p.uniform('uSource'),0);gl.uniform1i(p.uniform('uPalette'),1);
    gl.uniform1i(p.uniform('uN'),N);gl.uniform2f(p.uniform('uResolution'),canvas.width,canvas.height);gl.uniform1f(p.uniform('uTiles'),tiles);
    // For an orthogonal M, inverse is transpose; row-major M is its GL column-major inverse.
    gl.uniformMatrix2fv(p.uniform('uInverseMatrix'),false,matrix.flat());gl.uniform2f(p.uniform('uShift'),shift[0],shift[1]);
    gl.uniform1i(p.uniform('uConcentration'),palette==='concentration');gl.drawArrays(gl.TRIANGLES,0,3);
    return canvas;
  }
  try {if(initial)upload(initial);else {const initialState=new Float32Array(2*N*N);initialState.fill(1,0,N*N);upload(initialState);}}
  catch(error){dispose();throw error;}
  return {
    canvas,N,backend:'WebGL2 · RGBA32F',setParams,upload,step,advance,projectKernel,readback,render,dispose,
    get maxDt(){return maxDt();},get effectiveDt(){return effectiveDt();},get time(){return time;},get lost(){return lost||gl.isContextLost();},
    get params(){return {...stateParams,stencil:currentStencil};},
  };
}
