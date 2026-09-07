// The saved g134 orbit is a relative equilibrium B(x,y) exp(-2πi phase).
// Interpolate its spatial field, then rotate analytically on the GPU. This
// preserves the original orbit without frame interpolation or integration drift.
export const INITIAL_PHASE = 0.552387499999992;
export const LOOP_SECONDS = 4;
// Source desktop canvas: 760 CSS pixels across 3 simulation lattice lengths.
// Keep this scale through window resizing and fullscreen; reveal more repeats.
export const TILE_PIXELS = 760 / 3;
export const GRID_SIZE = 36;

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uRotation;
uniform float uTilePixels;
out vec4 color;
const int N = 36;
vec2 node(ivec2 p) { return texelFetch(uField, ((p % N) + N) % N, 0).rg; }
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
vec2 field(vec2 p) {
  // Periodic Catmull–Rom reconstruction, including across repeat boundaries.
  p = fract(p) * float(N);
  ivec2 base = ivec2(floor(p));
  vec4 wx = cubicWeights(fract(p.x)), wy = cubicWeights(fract(p.y));
  vec2 value = vec2(0.0);
  for (int j = 0; j < 4; j++) {
    vec2 row = vec2(0.0);
    for (int i = 0; i < 4; i++) row += wx[i] * node(base + ivec2(i-1,j-1));
    value += wy[j] * row;
  }
  return value;
}
vec3 ember(float t) {
  // Continuous interpolation of the source's exact ember color stops.
  if (t < .22) return mix(vec3(18,9,39),vec3(65,12,94),t/.22);
  if (t < .43) return mix(vec3(65,12,94),vec3(99,25,116),(t-.22)/.21);
  if (t < .58) return mix(vec3(99,25,116),vec3(171,45,90),(t-.43)/.15);
  if (t < .69) return mix(vec3(171,45,90),vec3(240,111,32),(t-.58)/.11);
  if (t < .78) return mix(vec3(240,111,32),vec3(252,181,42),(t-.69)/.09);
  if (t < .89) return mix(vec3(252,181,42),vec3(253,219,94),(t-.78)/.11);
  return mix(vec3(253,219,94),vec3(252,242,158),(t-.89)/.11);
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y;
  vec2 p = vec2(1.5) + screen * uCssSize / uTilePixels;
  float value = dot(field(p), uRotation);
  float t = clamp((value + 1.1433281898498535) / 2.286656379699707, 0.0, 1.0);
  // Sub-byte, stationary dither reduces banding without animation noise.
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715)))) - .5;
  color = vec4((ember(t) + dither) / 255.0, 1.0);
}`;

export function createRenderer(canvas, planar) {
  if (planar.length !== GRID_SIZE * GRID_SIZE * 2 || !planar.every(Number.isFinite)) {
    throw new Error('The pattern data is incomplete. Please reload.');
  }
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or open this page in a recent browser.');
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
      throw new Error(`Could not start the animation: ${message}`);
    }
    return shader;
  }
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const data = new Float32Array(planar.length), count = GRID_SIZE * GRID_SIZE;
  for (let i = 0; i < count; i++) { data[2*i] = planar[i]; data[2*i+1] = planar[count+i]; }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, GRID_SIZE, GRID_SIZE, 0, gl.RG, gl.FLOAT, data);
  gl.uniform1i(gl.getUniformLocation(program, 'uField'), 0);
  gl.uniform1f(gl.getUniformLocation(program, 'uTilePixels'), TILE_PIXELS);
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const cssSize = gl.getUniformLocation(program, 'uCssSize');
  const rotation = gl.getUniformLocation(program, 'uRotation');
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  return {
    draw(phase) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      // Native device pixels, with hardware limits and a 32-megapixel ceiling.
      const ratio = Math.min(devicePixelRatio || 1, maxSize / width, maxSize / height, Math.sqrt(33554432 / (width * height)));
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resolution, w, h); gl.uniform2f(cssSize, width, height);
      const angle = 2 * Math.PI * phase;
      gl.uniform2f(rotation, Math.cos(angle), Math.sin(angle));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteVertexArray(vao); },
  };
}
