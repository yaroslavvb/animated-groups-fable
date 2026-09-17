// WebGL 2 renderer for the marked chair tiling.
//
// One instanced draw call: the 24-facet chair mesh, once per chair, with the
// chair's rotation, translation and explode offset as instance attributes.
// The three marks are drawn procedurally in the fragment shader from the
// facet's own (u, v) frame, so they stay crisp at any zoom and cost no
// geometry. Nothing is fetched at runtime.
import {CENTROID} from './marking.data.mjs';
import {INSTANCE_FLOATS, buildChairMesh, buildPatch} from './tiling.mjs';

export const COLOUR_MODES = ['plain', 'hierarchy', 'centre'];

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in float aMark;
layout(location = 4) in vec3 aCol0;
layout(location = 5) in vec3 aCol1;
layout(location = 6) in vec3 aCol2;
layout(location = 7) in vec3 aTrans;
layout(location = 8) in vec3 aExplode;
layout(location = 9) in vec2 aMeta;
uniform mat4 uViewProj;
uniform vec3 uCentroid;
uniform float uShrink;
uniform float uExplode;
uniform vec3 uViewDir;
uniform vec3 uViewCentre;
uniform float uViewRadius;
out vec3 vNormal;
out vec2 vUV;
out float vDepth;
flat out float vMark;
flat out vec2 vMeta;
void main() {
  mat3 L = mat3(aCol0, aCol1, aCol2);
  vec3 local = uCentroid + (aPos - uCentroid) * uShrink;
  vec3 world = L * local + aTrans + aExplode * uExplode;
  vNormal = L * aNormal;
  vUV = aUV;
  vMark = aMark;
  vMeta = aMeta;
  // How near the camera this point is, in units of the object's own radius.
  // The dent's walls have the same normals as the outer faces, so only depth
  // can tell a pit from a bump: this is the page's aerial perspective.
  vDepth = dot(world - uViewCentre, uViewDir) / uViewRadius;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

// Glyphs live in the facet's own unit square, with the marked corner (the
// "site") at (1, 1). The arrow runs along the diagonal from (0, 0) to (1, 1):
// a long purple bar with a solid head (F) or an open V (H), and a short blue
// arrow (B). Two purple quarters of one 2x2 face therefore read as a single
// bar with a solid head at one end and a hollow head at the other, exactly as
// in the hand sketch.
const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in float vDepth;
flat in float vMark;
flat in vec2 vMeta;
uniform float uMarkings;
uniform float uColourMode;
uniform vec3 uHues[8];
out vec4 fragColour;

const vec3 BONE = vec3(0.914, 0.886, 0.824);
const vec3 PURPLE = vec3(0.404, 0.153, 0.792);
const vec3 BLUE = vec3(0.106, 0.549, 0.816);
const vec3 INK = vec3(0.180, 0.161, 0.149);
const vec2 DIR = vec2(0.7071068, 0.7071068);
const vec2 PERP = vec2(-0.7071068, 0.7071068);

float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = BONE;
  if (uColourMode > 1.5) {
    base = vMeta.y > 0.5 ? vec3(0.941, 0.671, 0.290) : vec3(0.831, 0.812, 0.769);
  } else if (uColourMode > 0.5) {
    base = uHues[int(vMeta.x + 0.5)];
  }
  // Static three-point-ish lighting; the three faces visible down the body
  // diagonal each get their own tone so the solid reads without motion.
  float key = clamp(dot(n, normalize(vec3(0.34, 0.56, 0.92))), 0.0, 1.0);
  float rim = clamp(dot(n, normalize(vec3(-0.80, -0.42, 0.26))), 0.0, 1.0);
  float toward = clamp(vDepth * 0.58 + 0.54, 0.0, 1.0);
  float shade = (0.46 + 0.50 * key + 0.16 * rim) * mix(0.38, 1.06, toward);
  vec3 colour = base * shade;

  // How wide one device pixel is in facet units: about 1 / (facet size in
  // pixels). Marks drop out once a facet is too small to draw one legibly,
  // and the grid follows a little later, so deep levels stay readable.
  float px = max(fwidth(vUV.x), fwidth(vUV.y));
  float detail = 1.0 - smoothstep(0.055, 0.145, px);
  float gridFade = 1.0 - smoothstep(0.130, 0.320, px);

  // A hairline on every unit-facet boundary: the light grid of the sketch.
  float edge = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));
  float grid = (1.0 - smoothstep(0.004, 0.004 + px * 1.6, edge)) * gridFade;
  colour = mix(colour, INK * shade, grid * 0.27);

  if (uMarkings > 0.5 && detail > 0.01) {
    vec2 p = vUV;
    vec2 site = vec2(1.0);
    vec2 tip = site - DIR * 0.075;
    float headLen = vMark > 1.5 ? 0.26 : 0.30;
    float halfW = vMark > 1.5 ? 0.115 : 0.135;
    vec2 baseC = tip - DIR * headLen;
    vec2 shaftEnd = tip - DIR * (headLen * 0.72);
    vec2 shaftStart = vMark > 1.5 ? site - DIR * 0.72 : DIR * 0.10;
    float sd = sdSegment(p, shaftStart, shaftEnd, 0.044);
    if (vMark < 0.5 || vMark > 1.5) {
      sd = min(sd, sdTriangle(p, tip, baseC + PERP * halfW, baseC - PERP * halfW));
    } else {
      sd = min(sd, sdSegment(p, tip, baseC + PERP * halfW, 0.042));
      sd = min(sd, sdSegment(p, tip, baseC - PERP * halfW, 0.042));
    }
    float aa = max(fwidth(sd), 0.0015);
    float ink = (1.0 - smoothstep(-aa, aa, sd)) * detail;
    vec3 markColour = vMark > 1.5 ? BLUE : PURPLE;
    colour = mix(colour, markColour * (0.55 + 0.45 * shade), ink * 0.94);
  }

  fragColour = vec4(colour, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl, vertSource, fragSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`shader failed to link: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

// Eight tints for the eight children of the top-level supertile: seven corner
// slots around the wheel, and the central one warm and light so it stands out
// when the supertile is pulled apart.
const HUES = [
  [0.898, 0.435, 0.380], [0.933, 0.647, 0.302], [0.816, 0.792, 0.353],
  [0.478, 0.784, 0.478], [0.357, 0.745, 0.749], [0.435, 0.604, 0.906],
  [0.706, 0.510, 0.898], [0.976, 0.898, 0.741],
];

export function createRenderer(canvas, options = {}) {
  const gl = canvas.getContext('webgl2', {antialias: true, alpha: true, depth: true, premultipliedAlpha: true, powerPreference: 'high-performance'});
  if (!gl) throw new Error('This page needs WebGL 2. Try a current Safari, Chrome or Firefox.');

  const program = link(gl, VERT, FRAG);
  const u = name => gl.getUniformLocation(program, name);
  const uniforms = {
    viewProj: u('uViewProj'), centroid: u('uCentroid'), shrink: u('uShrink'),
    explode: u('uExplode'), markings: u('uMarkings'), colourMode: u('uColourMode'), hues: u('uHues[0]'),
    viewDir: u('uViewDir'), viewCentre: u('uViewCentre'), viewRadius: u('uViewRadius'),
  };

  const mesh = buildChairMesh();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const staticBuffer = (data, location, size) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  };
  staticBuffer(mesh.positions, 0, 3);
  staticBuffer(mesh.normals, 1, 3);
  staticBuffer(mesh.uvs, 2, 2);
  staticBuffer(mesh.marks, 3, 1);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const instanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  const stride = INSTANCE_FLOATS * 4;
  for (const [location, size, offset] of [[4, 3, 0], [5, 3, 3], [6, 3, 6], [7, 3, 9], [8, 3, 12], [9, 2, 15]]) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4);
    gl.vertexAttribDivisor(location, 1);
  }
  gl.bindVertexArray(null);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);

  let patch = null, level = -1;
  const state = {markings: true, colourMode: 0, explode: 0, shrink: 0.980};

  function setLevel(next) {
    if (next === level) return;
    level = next;
    patch = buildPatch(level);
    // The gap between neighbouring chairs is a fixed distance in world units,
    // so as the supertile grows it falls below a pixel and the chair seams stop
    // being distinguishable from the facet grid inside one chair — the solid
    // reads as level 0 with a texture. Widen the gap in proportion, to a cap.
    state.shrink = 1 - Math.min(0.075, Math.max(0.020, 0.0016 * patch.size));
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.data, gl.STATIC_DRAW);
  }
  setLevel(options.level ?? 1);

  function draw(viewProj, pixelWidth, pixelHeight, view) {
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(uniforms.viewProj, false, viewProj);
    gl.uniform3fv(uniforms.centroid, CENTROID);
    gl.uniform1f(uniforms.shrink, state.shrink);
    gl.uniform1f(uniforms.explode, state.explode);
    gl.uniform1f(uniforms.markings, state.markings ? 1 : 0);
    gl.uniform1f(uniforms.colourMode, state.colourMode);
    gl.uniform3fv(uniforms.hues, HUES.flat());
    gl.uniform3fv(uniforms.viewDir, view.direction);
    gl.uniform3fv(uniforms.viewCentre, view.centre);
    gl.uniform1f(uniforms.viewRadius, Math.max(view.radius, 1e-3));
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0, patch.count);
    gl.bindVertexArray(null);
  }

  return {
    gl, state, draw, setLevel,
    get level() { return level; },
    get count() { return patch.count; },
    get size() { return patch.size; },
    get explodeRatio() { return patch.explodeRatio; },
    lost: () => gl.isContextLost(),
  };
}
