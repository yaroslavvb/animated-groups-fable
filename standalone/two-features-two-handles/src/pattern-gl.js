// pattern-gl.js — WebGL2 Poincaré disc fragment renderer for hyperbolic orbifolds (60 FPS, zero edge pop-in).
// Stacks an interactive tight disc-bound <canvas class="pat-gl"> behind the transparent 2D overlay canvas (#pattern),
// folding each pixel inside a 32-gon disc proxy into the fundamental domain D via spill-free Cyrus-Beck Klein
// geodesic ray-marching + PSU(1,1) x Z2 side-pairings. Reads geometry from std140 UBOs, culls commas/edges/segments/
// marks in 1 Minkowski dot product, renders rigid hyperbolic-arc dashes, and uses a reusable offscreen FBO during scroll.

import { apply } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { PRINT_FRONT, hexToRgb } from '../../2026-11-15-classification-of-surfaces/src/vendor/the-folding/palette.js';
import { psuI, psuInv, psuMul, psuApplyDisc, psuToSO21, so21ToPSU, discDist } from './handles.js';

const FRONT = hexToRgb(PRINT_FRONT[0]);
const FRONT_INK = hexToRgb(PRINT_FRONT[1]);
const DARK = [0.08, 0.09, 0.12];
const RED = [0.835, 0.369, 0];
const BLUE = [0, 0.447, 0.698];

const COMMA_TEX_SIZE = 256;
const MAX_ITEMS = 128;
const MAX_EDGES = 32;
const MAX_POLY_VERTS = 256;

const FOLD_UBO_FLOATS = MAX_EDGES * 4 * 4;
const COMMA_UBO_FLOATS = MAX_ITEMS * 3 * 4;
const SEG_UBO_FLOATS = MAX_ITEMS * 5 * 4;
const MARK_UBO_FLOATS = MAX_ITEMS * 3 * 4;

const FULLSCREEN_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  vUv = 0.5 * vec2(x, y) + 0.5;
  gl_Position = vec4(x, y, 0.0, 1.0);
}`;

const DISC_VS = `#version 300 es
precision highp float;
uniform vec4 uDiscClip; // (cxNdc, cyNdc, rxNdc, ryNdc)
void main() {
  int tri = gl_VertexID / 3;
  int corner = gl_VertexID % 3;
  if (corner == 0) {
    gl_Position = vec4(uDiscClip.xy, 0.0, 1.0);
  } else {
    float ang = float(tri + corner - 1) * 0.19634954084936207; // 2*PI / 32
    gl_Position = vec4(uDiscClip.xy + vec2(cos(ang), sin(ang)) * uDiscClip.zw, 0.0, 1.0);
  }
}`;

const SDF_BAKE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPolyTex;
uniform int uVertCount;
uniform float uRBox;
out vec4 fragColor;

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uRBox;
  float d2 = 1e20;
  bool inside = false;
  vec2 prev = texelFetch(uPolyTex, ivec2(uVertCount - 1, 0), 0).xy;
  for (int i = 0; i < 256; i++) {
    if (i >= uVertCount) break;
    vec2 cur = texelFetch(uPolyTex, ivec2(i, 0), 0).xy;
    vec2 e = cur - prev;
    vec2 w = p - prev;
    float ee = max(1e-18, dot(e, e));
    float t = clamp(dot(w, e) / ee, 0.0, 1.0);
    vec2 diff = w - e * t;
    d2 = min(d2, dot(diff, diff));
    if ((cur.y > p.y) != (prev.y > p.y)) {
      float xInt = prev.x + (p.y - prev.y) * (cur.x - prev.x) / (cur.y - prev.y);
      if (p.x < xInt) inside = !inside;
    }
    prev = cur;
  }
  float sd = (inside ? -1.0 : 1.0) * sqrt(d2);
  float band = 0.22 * uRBox;
  float texel = (2.0 * uRBox) / ${COMMA_TEX_SIZE}.0;
  float r = clamp(0.5 + sd / (2.0 * band), 0.0, 1.0);
  float g = smoothstep(0.65 * texel, -0.65 * texel, sd);
  fragColor = vec4(r, g, 0.0, 1.0);
}`;

const MAIN_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform vec4 uGeom;       // (cxLocalCss, cyLocalCss, RCss, effDpr)
uniform vec2 uInvPxScale; // (gW / fboW, gH / fboH)
uniform float uViewportH; // gH in CSS px
uniform vec4 uInvView;    // psuInv(vPsu) = (ar, ai, br, bi)
uniform float uInvViewFlip;
uniform vec2 uAtD;        // D.at in Poincare disc
uniform vec4 uParams;     // (hScale, showEdges, dimMarksFlag, maxSegHalfW)
uniform ivec4 uCounts;    // (nEdges, nCommas, nSegs, nMarks)
uniform vec4 uPick;       // (pickType, pickId, pickExtra, dimAlpha)
uniform vec3 uRimColor;   // fallback rim color when folding reaches max steps

layout(std140) uniform FoldBlock {
  vec4 eNorm[32];  // Euclidean-unit (Nx, Ny, Pz) + starPlus1
  vec4 eInvM[32];  // (ar, ai, br, bi)
  vec4 eMeta[32];  // (invFlip, nextLast, lenH, eucToMink)
  vec4 eS[32];     // (ar, ai, br, bi)
};

layout(std140) uniform CommaBlock {
  vec4 cM[128];     // (ar, ai, br, bi)
  vec4 cMeta[128];  // (flip, layer, rBox, inv2rBox)
  vec4 cBound[128]; // (-Cx, -Cy, +Cz, coshBoundRad)
};

layout(std140) uniform SegBlock {
  vec4 sNorm[128]; // (Nx, Ny, Pz, grpId)
  vec4 sS[128];    // (ar, ai, br, bi)
  vec4 sCol[128];  // (r, g, b, alpha)
  vec4 sWd[128];   // (width, lenH, dashOn, dashOff)
  vec4 sMeta[128]; // (kind, grpIdx, scaleMode, tanhHalfLen)
};

layout(std140) uniform MarkBlock {
  vec4 mPos[128];   // (px, py, ux, uy)
  vec4 mMeta[128];  // (order, isCone, clsId, isAlso)
  vec4 mBound[128]; // (-Mx, -My, +Mz, 0.0)
};

uniform sampler2DArray uCommaTex; // 256 x 256 x N RGBA8

out vec4 fragColor;

const vec3 C_FRONT = vec3(${FRONT[0].toFixed(5)}, ${FRONT[1].toFixed(5)}, ${FRONT[2].toFixed(5)});
const vec3 C_INK   = vec3(${FRONT_INK[0].toFixed(5)}, ${FRONT_INK[1].toFixed(5)}, ${FRONT_INK[2].toFixed(5)});
const vec3 C_DARK  = vec3(${DARK[0].toFixed(5)}, ${DARK[1].toFixed(5)}, ${DARK[2].toFixed(5)});
const vec3 C_RED   = vec3(${RED[0].toFixed(5)}, ${RED[1].toFixed(5)}, ${RED[2].toFixed(5)});
const vec3 C_BLUE  = vec3(${BLUE[0].toFixed(5)}, ${BLUE[1].toFixed(5)}, ${BLUE[2].toFixed(5)});
const float PI = 3.141592653589793;

vec2 clampDisc(vec2 w) {
  float r2 = dot(w, w);
  if (r2 >= 0.999999) return w * (0.999999 * inversesqrt(r2));
  return w;
}

vec2 discToKlein(vec2 w) {
  return (2.0 * w) / (1.0 + dot(w, w));
}

vec2 kleinToDisc(vec2 k) {
  float r2 = dot(k, k);
  return k / (1.0 + sqrt(max(1e-12, 1.0 - r2)));
}

vec2 psuApply(vec4 g, float flip, vec2 w) {
  float u = w.x;
  float v = flip > 0.5 ? -w.y : w.y;
  float nr = g.x * u - g.y * v + g.z;
  float ni = g.x * v + g.y * u + g.w;
  float dr = g.z * u + g.w * v + g.x;
  float di = g.z * v - g.w * u - g.y;
  float d2 = max(1e-20, dr * dr + di * di);
  return vec2(nr * dr + ni * di, ni * dr - nr * di) / d2;
}

vec2 psuPushDir(vec4 g, float flip, vec2 p0, vec2 dir0) {
  float u = p0.x;
  float v = flip > 0.5 ? -p0.y : p0.y;
  float dr = g.z * u + g.w * v + g.x;
  float di = g.z * v - g.w * u - g.y;
  vec2 ds = vec2(dir0.x, flip > 0.5 ? -dir0.y : dir0.y);
  vec2 den2 = vec2(dr * dr - di * di, 2.0 * dr * di);
  vec2 dw = vec2(ds.x * den2.x + ds.y * den2.y, ds.y * den2.x - ds.x * den2.y);
  float l2 = dot(dw, dw);
  return l2 > 1e-24 ? dw * inversesqrt(l2) : dir0;
}

vec4 psuInv(vec4 g, float flip) {
  return flip > 0.5 ? vec4(g.x, g.y, -g.z, g.w) : vec4(g.x, -g.y, -g.z, -g.w);
}

vec4 psuMul(vec4 g1, float f1, vec4 g2, float f2, out float fout) {
  float s = f1 > 0.5 ? -1.0 : 1.0;
  float ar2 = g2.x, ai2 = s * g2.y, br2 = g2.z, bi2 = s * g2.w;
  vec4 r = vec4(
    (g1.x * ar2 - g1.y * ai2) + (g1.z * br2 + g1.w * bi2),
    (g1.x * ai2 + g1.y * ar2) + (g1.w * br2 - g1.z * bi2),
    (g1.x * br2 - g1.y * bi2) + (g1.z * ar2 + g1.w * ai2),
    (g1.x * bi2 + g1.y * br2) + (g1.w * ar2 - g1.z * ai2)
  );
  float n2 = max(1e-12, dot(r.xy, r.xy) - dot(r.zw, r.zw));
  fout = abs(f1 - f2);
  return r * inversesqrt(n2);
}

float segDistHyp(vec2 q, vec4 S, float lenH) {
  vec2 u = psuApply(S, 0.0, q);
  float r2 = dot(u, u);
  float oneMinusR2 = max(1e-6, 1.0 - r2);
  float uxK = 2.0 * u.x / (1.0 + r2);
  if (uxK <= 0.0) {
    return 2.0 * atanh(min(0.99999, length(u)));
  }
  float tb = tanh(0.5 * lenH);
  if ((1.0 + tb * tb) * u.x >= tb * (1.0 + r2)) {
    vec2 db = u - vec2(tb, 0.0);
    vec2 den = vec2(1.0 - tb * u.x, -tb * u.y);
    float arg = min(0.99999, sqrt(dot(db, db) / max(1e-12, dot(den, den))));
    return 2.0 * atanh(arg);
  }
  return asinh(2.0 * abs(u.y) / oneMinusR2);
}

float segDistAndSymH(vec2 q, vec4 S, float lenH, float tb, out float sSym) {
  vec2 u = psuApply(S, 0.0, q);
  float r2 = dot(u, u);
  if (u.x <= 0.0) {
    sSym = 0.5 * lenH;
    return 2.0 * atanh(min(0.99999, length(u)));
  }
  if ((1.0 + tb * tb) * u.x >= tb * (1.0 + r2)) {
    sSym = 0.5 * lenH;
    vec2 db = u - vec2(tb, 0.0);
    vec2 den = vec2(1.0 - tb * u.x, -tb * u.y);
    float arg = min(0.99999, sqrt(dot(db, db) / max(1e-12, dot(den, den))));
    return 2.0 * atanh(arg);
  }
  float yy = u.y * u.y;
  float num = (1.0 + u.x) * (1.0 + u.x) + yy;
  float den = max(1e-12, (1.0 - u.x) * (1.0 - u.x) + yy);
  float sH = 0.5 * log(num / den);
  sSym = abs(sH - 0.5 * lenH);
  return asinh(2.0 * abs(u.y) / max(1e-6, 1.0 - r2));
}

float lineCov(float distCss, float halfW, float dpr) {
  float hp = 0.5 / dpr;
  return clamp((min(halfW, distCss + hp) - max(-halfW, distCss - hp)) * dpr, 0.0, 1.0);
}

float bucket3(float sPx, float v0, float v1, float v2) {
  float t1 = smoothstep(5.5, 8.5, sPx);
  float t2 = smoothstep(18.0, 22.0, sPx);
  return mix(v2, mix(v1, v0, t2), t1);
}

float vesicaSDF(vec2 p, float r) {
  float a = 1.25 * r;
  float h = 0.475 * r;
  vec2 q = abs(p);
  float yc = (a * a - h * h) / (2.0 * h);
  float rc = h + yc;
  if (q.x * yc > a * (q.y + yc)) {
    return length(q - vec2(a, 0.0));
  }
  return length(q + vec2(0.0, yc)) - rc;
}

float regularPolySDF(vec2 p, int m, float rr) {
  float an = PI / float(m);
  float ang = atan(p.y, p.x);
  float bn = mod(ang, 2.0 * an) - an;
  vec2 q = length(p) * vec2(cos(bn), abs(sin(bn)));
  vec2 d = vec2(q.x - rr * cos(an), max(0.0, q.y - rr * sin(an)));
  return d.x < 0.0 ? d.x : length(d);
}

void main() {
  float cx = uGeom.x, cy = uGeom.y, R = uGeom.z, dpr = uGeom.w;
  float xCss = gl_FragCoord.x * uInvPxScale.x;
  float yCss = uViewportH - gl_FragCoord.y * uInvPxScale.y;
  vec2 ws = vec2(xCss - cx, -(yCss - cy)) / R;
  float r2s = dot(ws, ws);
  float rs = sqrt(r2s);
  float rimDist = (rs - 1.0) * R;
  if (rimDist > 2.5) {
    fragColor = vec4(0.0);
    return;
  }

  vec2 wClamped = r2s >= 0.9990 ? ws * (0.999499 / rs) : ws;
  float oneMinusWs2 = max(1e-5, 1.0 - dot(wClamped, wClamped));
  float pxPerHyp = 0.5 * R * oneMinusWs2;
  float hScale = uParams.x;
  float sPx = hScale * pxPerHyp;

  vec4 T = uInvView;
  float Tflip = uInvViewFlip;
  vec2 qD = clampDisc(psuApply(T, Tflip, wClamped));
  int nEdges = uCounts.x;
  bool converged = false;

  if (rs < 0.996) {
    vec2 pD = uAtD;
    int lastEdge = -1;
    int zeroRun = 0;

    for (int step = 0; step < 56; step++) {
      vec2 qK = discToKlein(qD);
      vec2 pK = discToKlein(pD);
      float minSq = 1e9;
      int bestEdge = -1;
      float bestT = 1e9;
      int fbEdge = -1;
      float fbT = 1e9;
      for (int i = 0; i < 32; i++) {
        if (i >= nEdges) break;
        vec3 N = eNorm[i].xyz;
        float sq = N.x * qK.x + N.y * qK.y + N.z;
        minSq = min(minSq, sq);
        if (sq < -1e-7) {
          float sp = max(0.0, N.x * pK.x + N.y * pK.y + N.z);
          float t = sp / (sp - sq);
          if (i == lastEdge) {
            if (t < fbT) { fbT = t; fbEdge = i; }
          } else {
            if (t < bestT) { bestT = t; bestEdge = i; }
          }
        }
      }
      if (minSq >= -1e-6) {
        converged = true;
        break;
      }
      if (bestEdge < 0) {
        if (fbEdge < 0) break;
        bestEdge = fbEdge;
        bestT = fbT;
      }
      if (bestT < 1e-6) {
        zeroRun++;
        if (zeroRun > 10) {
          pD = mix(pD, uAtD, 1e-4);
          zeroRun = 0;
          lastEdge = -1;
          continue;
        }
      } else {
        zeroRun = 0;
      }
      vec4 invM = eInvM[bestEdge];
      vec4 meta = eMeta[bestEdge];
      float invFlip = meta.x;
      qD = clampDisc(psuApply(invM, invFlip, qD));
      float nextFlip;
      T = psuMul(invM, invFlip, T, Tflip, nextFlip);
      Tflip = nextFlip;
      vec2 wK = mix(pK, qK, bestT);
      pD = clampDisc(psuApply(invM, invFlip, kleinToDisc(wK)));
      lastEdge = int(meta.y + 0.5);
    }
  }

  vec3 col = C_FRONT;
  if (!converged) {
    col = uRimColor;
  } else {
    float q2 = dot(qD, qD);
    float inv1m = 1.0 / max(1e-6, 1.0 - q2);
    vec3 Q = vec3(2.0 * qD.x * inv1m, 2.0 * qD.y * inv1m, (1.0 + q2) * inv1m);

    // ---- 1. Smooth Commas (1-dot Minkowski cull + coherent SDF/mip branch)
    int nCommas = uCounts.y;
    float commaCov = 0.0;
    for (int i = 0; i < 128; i++) {
      if (i >= nCommas) break;
      vec4 bnd = cBound[i];
      if (dot(Q, bnd.xyz) > bnd.w) continue;
      vec4 cMetaV = cMeta[i];
      vec2 qc = psuApply(cM[i], cMetaV.x, qD);
      float rBox = cMetaV.z;
      if (abs(qc.x) > rBox || abs(qc.y) > rBox) continue;
      float inv2rBox = cMetaV.w;
      vec2 uv = 0.5 + qc * inv2rBox;
      float duv = ((1.0 - dot(qc, qc)) / oneMinusWs2) * inv2rBox / (R * dpr);
      float layer = cMetaV.y;
      float tpp = duv * ${COMMA_TEX_SIZE}.0;
      float cov;
      if (tpp <= 0.75) {
        float sdfR = textureLod(uCommaTex, vec3(uv, layer), 0.0).r;
        float sdPx = (sdfR - 0.5) * 0.22 / max(duv, 1e-6);
        cov = smoothstep(0.65, -0.65, sdPx);
      } else if (tpp >= 2.2) {
        cov = textureGrad(uCommaTex, vec3(uv, layer), vec2(duv, 0.0), vec2(0.0, duv)).g;
      } else {
        float sdfR = textureLod(uCommaTex, vec3(uv, layer), 0.0).r;
        float covMip = textureGrad(uCommaTex, vec3(uv, layer), vec2(duv, 0.0), vec2(0.0, duv)).g;
        float sdPx = (sdfR - 0.5) * 0.22 / max(duv, 1e-6);
        float covSdf = smoothstep(0.65, -0.65, sdPx);
        cov = mix(covSdf, covMip, smoothstep(0.75, 2.2, tpp));
      }
      commaCov = max(commaCov, cov);
    }
    col = mix(col, C_INK, commaCov);

    // ---- 2. Tile Edges & Mirrors (1-dot Minkowski cull)
    bool showEdges = uParams.y > 0.5;
    float edgeFade = showEdges ? smoothstep(1.5, 2.5, sPx) : 0.0;
    float edgeW = bucket3(sPx, 0.9, 0.7, 0.5);
    float edgeA = bucket3(sPx, 0.20, 0.16, 0.12) * edgeFade;
    float mirWBase = bucket3(sPx, 2.1, 1.4, 0.8);

    float minEdgeD = 1e9;
    float minMirNormD = 1e9;
    float minMirDimD = 1e9;
    float minMirPickD = 1e9;

    float pickType = uPick.x;
    float pickId = uPick.y;
    float pickExtra = uPick.z;
    float dimA = uPick.w;

    float maxEdgeW = (pickType > 0.5 && pickType < 1.5) ? 1.8 * mirWBase : 0.5 * mirWBase;
    float maxEdgeSinh = sinh(min(4.0, (max(0.5 * edgeW, maxEdgeW) + 1.5) / pxPerHyp)) * 1.05 + 2e-3;

    for (int i = 0; i < 32; i++) {
      if (i >= nEdges) break;
      vec4 en = eNorm[i];
      float starIdx = en.w - 1.0;
      if (edgeFade <= 0.0 && starIdx < -0.5) continue;
      if (abs(dot(Q, en.xyz)) * eMeta[i].w > maxEdgeSinh) continue;
      float dCss = segDistHyp(qD, eS[i], eMeta[i].z) * pxPerHyp;
      if (edgeFade > 0.0) minEdgeD = min(minEdgeD, dCss);
      if (starIdx >= -0.5) {
        bool isOn = (pickType > 0.5 && pickType < 1.5 && abs(starIdx - pickId) < 0.25);
        bool isNear = (pickType > 3.5 && pickExtra > -0.5 && abs(starIdx - pickExtra) < 0.25);
        if (isOn) minMirPickD = min(minMirPickD, dCss);
        else if (isNear || pickType < 0.5) minMirNormD = min(minMirNormD, dCss);
        else minMirDimD = min(minMirDimD, dCss);
      }
    }
    if (edgeFade > 0.0 && minEdgeD < 0.5 * edgeW + 1.0) {
      col = mix(col, C_DARK, lineCov(minEdgeD, 0.5 * edgeW, dpr) * edgeA);
    }
    if (pickType > 0.5 && pickType < 1.5 && minMirPickD < 1.8 * mirWBase + 1.5) {
      col = mix(col, C_RED, lineCov(minMirPickD, 1.8 * mirWBase, dpr) * 0.25);
    }
    if (minMirDimD < 0.5 * mirWBase + 1.0) {
      col = mix(col, C_RED, lineCov(minMirDimD, 0.5 * mirWBase, dpr) * dimA);
    }
    if (minMirNormD < 0.5 * mirWBase + 1.0) {
      col = mix(col, C_RED, lineCov(minMirNormD, 0.5 * mirWBase, dpr));
    }
    if (pickType > 0.5 && pickType < 1.5 && minMirPickD < 0.925 * mirWBase + 1.0) {
      col = mix(col, C_RED, lineCov(minMirPickD, 0.925 * mirWBase, dpr));
    }

    // ---- 3. Repeating Segments (1-dot Minkowski cull + rigid intrinsic hyperbolic dashing)
    int nSegs = uCounts.z;
    float maxSegHalfW = uParams.w;
    float maxSegSinh = sinh(min(4.0, (maxSegHalfW + 1.5) / pxPerHyp)) * 1.05 + 2e-3;
    float scaleM0 = bucket3(sPx, 2.1, 1.4, 0.8) / 2.1;
    float scaleM1 = bucket3(sPx, 1.0, 0.7, 0.4);
    float invRef = 2.0 / R;

    if (pickType > 1.5 && pickType < 3.5 && nSegs > 0) {
      float glowMaxSinh = sinh(min(4.0, (maxSegHalfW * 3.8 + 1.5) / pxPerHyp)) * 1.05 + 2e-3;
      float glowCov = 0.0;
      vec3 glowCol = vec3(0.0);
      float glowAlpha = 0.0;
      for (int i = 0; i < 128; i++) {
        if (i >= nSegs) break;
        vec4 sn = sNorm[i];
        if (abs(dot(Q, sn.xyz)) > glowMaxSinh) continue;
        vec4 sMetaV = sMeta[i];
        float kind = sMetaV.x;
        float grpIdx = sMetaV.y;
        bool isOn = (pickType < 2.5 && kind < 0.5 && abs(grpIdx - pickId) < 0.25) ||
                    (pickType > 2.5 && kind > 1.5);
        if (!isOn) continue;
        vec4 wd = sWd[i];
        float dCss = segDistHyp(qD, sS[i], wd.y) * pxPerHyp;
        float scaleF = sMetaV.z < 0.5 ? scaleM0 : scaleM1;
        float halfGW = kind < 0.5 ? 1.8 * 2.1 * scaleF : 1.6 * wd.x * scaleF;
        if (dCss < halfGW + 1.5) {
          float cov = lineCov(dCss, halfGW, dpr);
          vec3 gCol = kind < 0.5 ? C_RED : sCol[i].rgb;
          float gA = kind < 0.5 ? 0.24 : 0.26;
          if (cov > glowCov) { glowCov = cov; glowCol = gCol; glowAlpha = gA; }
        }
      }
      if (glowCov > 0.0) col = mix(col, glowCol, glowCov * glowAlpha);
    }

    float curGroup = -1.0;
    float grpCov = 0.0;
    vec3 grpCol = vec3(0.0);
    float grpAlpha = 0.0;

    for (int i = 0; i < 128; i++) {
      if (i >= nSegs) break;
      vec4 sn = sNorm[i];
      if (abs(dot(Q, sn.xyz)) > maxSegSinh) continue;

      vec4 wd = sWd[i];
      vec4 sMetaV = sMeta[i];
      float grpId = sn.w;
      float kind = sMetaV.x;
      float grpIdx = sMetaV.y;
      float scaleF = sMetaV.z < 0.5 ? scaleM0 : scaleM1;
      bool isOn = (pickType > 1.5 && pickType < 2.5 && kind < 0.5 && abs(grpIdx - pickId) < 0.25) ||
                  (pickType > 2.5 && pickType < 3.5 && kind > 1.5);
      float halfW = 0.5 * wd.x * (isOn ? (kind < 0.5 ? 1.85 : 1.8) : 1.0) * scaleF;

      float sSym;
      float dCss = segDistAndSymH(qD, sS[i], wd.y, sMetaV.w, sSym) * pxPerHyp;
      if (dCss >= halfW + 1.5) continue;

      if (curGroup > -0.5 && abs(grpId - curGroup) > 0.25) {
        if (grpCov > 0.0) col = mix(col, grpCol, grpCov * grpAlpha);
        grpCov = 0.0;
      }

      vec4 ca = sCol[i];
      float alpha = isOn ? 1.0 : ca.a * (kind < 0.5 ? (pickType > 0.5 ? dimA : 1.0) : (pickType > 0.5 ? 0.38 : 1.0));
      float cov = lineCov(dCss, halfW, dpr);
      if (wd.z > 0.0 && wd.w > 0.0) {
        float dOnH = wd.z * invRef;
        float dOffH = wd.w * invRef;
        float perH = dOnH + dOffH;
        float perPx = perH * pxPerHyp;
        float dBlend = smoothstep(2.2, 4.8, perPx);
        alpha *= mix(0.78, 1.0, dBlend);
        if (dBlend > 0.01) {
          float phH = mod(sSym + 0.5 * dOnH, perH);
          float sdAlongH = phH <= dOnH ? -min(phH, dOnH - phH) : min(phH - dOnH, perH - phH);
          float aa = 0.6 / dpr;
          float dashCov = 1.0 - smoothstep(-aa, aa, sdAlongH * pxPerHyp);
          cov *= mix(1.0, dashCov, dBlend);
        }
      }
      if (cov > grpCov) {
        grpCov = cov;
        grpCol = ca.rgb;
        grpAlpha = alpha;
      }
      curGroup = grpId;
    }
    if (curGroup > -0.5 && grpCov > 0.0) {
      col = mix(col, grpCol, grpCov * grpAlpha);
    }

    // ---- 4. Marked Vertices (1-dot Minkowski cull before psuApply)
    int nMarks = uCounts.w;
    bool dimMarks = uParams.z > 0.5;
    vec4 Tinv = psuInv(T, Tflip);
    float TinvFlip = Tflip;

    if (pickType > 3.5 && nMarks > 0) {
      float haloMaxCosh = cosh(min(5.0, (24.0 / pxPerHyp) * 1.05 + 0.02));
      float haloFillCov = 0.0;
      float haloRingCov = 0.0;
      vec3 haloCol = C_BLUE;
      for (int i = 0; i < 128; i++) {
        if (i >= nMarks) break;
        if (dot(Q, mBound[i].xyz) > haloMaxCosh) continue;
        vec4 mMetaV = mMeta[i];
        if (abs(mMetaV.z - pickId) > 0.25) continue;
        vec2 ps = psuApply(Tinv, TinvFlip, mPos[i].xy);
        float mpx = hScale * R * 0.5 * max(1e-5, 1.0 - dot(ps, ps));
        float r = min(10.0, 0.36 * mpx);
        if (mpx < 3.0 || r < 2.2) continue;
        float hr = 1.85 * r;
        float d = length((wClamped - ps) * R);
        if (d > hr + 2.0) continue;
        haloCol = mMetaV.y > 0.5 ? C_BLUE : C_RED;
        float fCov = clamp((hr + 0.5 / dpr - d) * dpr, 0.0, 1.0);
        float rCov = lineCov(abs(d - hr), 0.8, dpr);
        haloFillCov = max(haloFillCov, fCov);
        haloRingCov = max(haloRingCov, rCov);
      }
      if (haloFillCov > 0.0) col = mix(col, haloCol, haloFillCov * 0.22);
      if (haloRingCov > 0.0) col = mix(col, haloCol, haloRingCov * 0.78);
    }

    if (nMarks > 0) {
      float markMaxCosh = cosh(min(5.0, (18.0 / pxPerHyp) * 1.05 + 0.02));
      for (int i = 0; i < 128; i++) {
        if (i >= nMarks) break;
        if (dot(Q, mBound[i].xyz) > markMaxCosh) continue;
        vec4 mPosV = mPos[i];
        vec2 ps = psuApply(Tinv, TinvFlip, mPosV.xy);
        vec2 dDisc = (wClamped - ps) * R;
        if (dot(dDisc, dDisc) > 324.0) continue;
        float mpx = hScale * R * 0.5 * max(1e-5, 1.0 - dot(ps, ps));
        vec4 mMetaV = mMeta[i];
        int order = int(mMetaV.x + 0.5);
        bool isCone = mMetaV.y > 0.5;
        bool picked = (pickType > 3.5 && abs(mMetaV.z - pickId) < 0.25);
        bool on = picked || (pickType < 0.5 && mMetaV.w > 0.5);
        if (mpx < (picked ? 3.0 : 4.5)) continue;
        float r = min(picked ? 10.0 : (on ? 9.5 : 6.5), (picked ? 0.36 : (on ? 0.34 : 0.24)) * mpx);
        if (r < 1.1) continue;
        float boundR = (order == 2 || order == 3 ? 1.25 : 1.08) * r + 2.5;
        if (dot(dDisc, dDisc) > boundR * boundR) continue;

        vec2 us = psuPushDir(Tinv, TinvFlip, mPosV.xy, mPosV.zw);
        vec2 localPx = vec2(dDisc.x * us.x + dDisc.y * us.y, dDisc.y * us.x - dDisc.x * us.y);
        float sd = order == 2
          ? vesicaSDF(localPx, r)
          : regularPolySDF(localPx, order, r * (order == 3 ? 1.25 : 1.08));

        bool hasAnySel = (pickType > 0.5) || (uPick.w < 0.99);
        bool full = on || !hasAnySel || (pickType < 0.5 && !dimMarks);
        float fAlpha = full ? 1.0 : dimA;
        float sWidth = picked ? 2.0 : (on ? 1.6 : 1.0);
        float sAlpha = full ? 0.95 : 0.5;
        float hp = 0.5 / dpr;
        float fillCov = clamp((hp - sd) * dpr, 0.0, 1.0);
        float strokeCov = lineCov(abs(sd), 0.5 * sWidth, dpr);
        vec3 mCol = isCone ? C_BLUE : C_RED;
        col = mix(col, mCol, fillCov * fAlpha);
        col = mix(col, vec3(1.0), strokeCov * sAlpha);
      }
    }

    if (rs > 0.992) {
      col = mix(col, uRimColor, smoothstep(0.992, 0.996, rs));
    }
  }

  // ---- 5. Crisp disc clip & 1.2 px rim border
  float hp = 0.5 / dpr;
  float discAlpha = clamp((hp - rimDist) * dpr, 0.0, 1.0);
  float rimStroke = lineCov(abs(rimDist), 0.6, dpr) * 0.55;
  float outA = rimStroke + discAlpha * (1.0 - rimStroke);
  vec3 outRgb = C_DARK * rimStroke + col * (discAlpha * (1.0 - rimStroke));
  fragColor = vec4(outRgb, outA);
}`;

const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
const discToH = (w) => {
  const r2 = w[0] * w[0] + w[1] * w[1];
  const inv = 1 / Math.max(1e-12, 1 - r2);
  return [2 * w[0] * inv, 2 * w[1] * inv, (1 + r2) * inv];
};
const discToKlein = (w) => {
  const s = 2 / (1 + w[0] * w[0] + w[1] * w[1]);
  return [w[0] * s, w[1] * s];
};
const isIdPsu = (g) => Math.abs(g[0] - 1) < 1e-12 && !g[4] && Math.hypot(g[1], g[2], g[3]) < 1e-12;

function pushDirDisc(g, p0, dir0) {
  const u = p0[0], v = g[4] ? -p0[1] : p0[1];
  const dr = g[2] * u + g[3] * v + g[0];
  const di = g[2] * v - g[3] * u - g[1];
  const sx = dir0[0], sy = g[4] ? -dir0[1] : dir0[1];
  const d2r = dr * dr - di * di, d2i = 2 * dr * di;
  const wx = sx * d2r + sy * d2i, wy = sy * d2r - sx * d2i;
  const l = Math.hypot(wx, wy) || 1;
  return [wx / l, wy / l];
}

function buildKleinNorms(D) {
  if (D._minkNorms) return D._minkNorms;
  const norms = [];
  for (let i = 0; i < D.n; i++) {
    const a = D.verts[i], b = D.verts[(i + 1) % D.n];
    // Store Euclidean-unit inward normal (Nx, Ny, Pz) for zero-sqrt folding + eucToMink factor for exact sinh distance
    const N = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const el = Math.hypot(N[0], N[1], N[2]) || 1;
    const ml = Math.sqrt(Math.max(1e-18, N[0] * N[0] + N[1] * N[1] - N[2] * N[2]));
    const u = [N[0] / el, N[1] / el, N[2] / el, el / ml];
    if (u[0] * D.at[0] + u[1] * D.at[1] + u[2] * D.at[2] < 0) {
      u[0] = -u[0]; u[1] = -u[1]; u[2] = -u[2];
    }
    norms.push(u);
  }
  D._minkNorms = norms;
  return norms;
}

function segMinkNorm(aH, bH) {
  const N = [aH[1] * bH[2] - aH[2] * bH[1], aH[2] * bH[0] - aH[0] * bH[2], aH[0] * bH[1] - aH[1] * bH[0]];
  const ml = Math.sqrt(Math.max(1e-18, N[0] * N[0] + N[1] * N[1] - N[2] * N[2]));
  return [N[0] / ml, N[1] / ml, N[2] / ml];
}

function segDistHypCPU(wD, S, lenH) {
  const u = psuApplyDisc(S, wD);
  const r2 = u[0] * u[0] + u[1] * u[1];
  const uxK = (2 * u[0]) / (1 + r2);
  if (uxK <= 0) return 2 * Math.atanh(Math.min(1 - 1e-12, Math.hypot(u[0], u[1])));
  if (uxK >= Math.tanh(lenH)) return discDist(u, [Math.tanh(0.5 * lenH), 0]);
  return Math.asinh((2 * Math.abs(u[1])) / Math.max(1e-12, 1 - r2));
}

function pointDistToD(wD, D, norms, S_edges, edgeLens) {
  const k = discToKlein(wD);
  let inside = true;
  for (let i = 0; i < D.n; i++) {
    const N = norms[i];
    if (N[0] * k[0] + N[1] * k[1] + N[2] < -1e-9) { inside = false; break; }
  }
  if (inside) return 0;
  let best = Infinity;
  for (let i = 0; i < D.n; i++) {
    const d = segDistHypCPU(wD, S_edges[i], edgeLens[i]);
    if (d < best) best = d;
  }
  return best;
}

function kleinSegsCross(a0, b0, a1, b1) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(a1, b1, a0), d2 = cross(a1, b1, b0);
  const d3 = cross(a0, b0, a1), d4 = cross(a0, b0, b1);
  return ((d1 > 1e-10 && d2 < -1e-10) || (d1 < -1e-10 && d2 > 1e-10)) &&
         ((d3 > 1e-10 && d4 < -1e-10) || (d3 < -1e-10 && d4 > 1e-10));
}

function segDistToD(aD, bD, S_ab, len_ab, D, norms, S_edges, edgeLens, vDiscs, vKleins) {
  if (pointDistToD(aD, D, norms, S_edges, edgeLens) === 0) return 0;
  if (pointDistToD(bD, D, norms, S_edges, edgeLens) === 0) return 0;
  const aK = discToKlein(aD), bK = discToKlein(bD);
  for (let i = 0; i < D.n; i++) {
    if (kleinSegsCross(aK, bK, vKleins[i], vKleins[(i + 1) % D.n])) return 0;
  }
  let best = Infinity;
  for (let i = 0; i < D.n; i++) {
    best = Math.min(best, segDistHypCPU(aD, S_edges[i], edgeLens[i]), segDistHypCPU(bD, S_edges[i], edgeLens[i]), segDistHypCPU(vDiscs[i], S_ab, len_ab));
  }
  return best;
}

function sampleSmoothCommaDisc(pts0, L_si, smoothClosedPath) {
  const n = pts0.length;
  const rawX = new Float64Array(n), rawY = new Float64Array(n);
  let rc = 0;
  for (let i = 0; i < n; i++) {
    const q = psuApplyDisc(L_si, toDisc(pts0[i]));
    if (!rc || Math.hypot(q[0] - rawX[rc - 1], q[1] - rawY[rc - 1]) > 1e-5) {
      rawX[rc] = q[0]; rawY[rc] = q[1]; rc++;
    }
  }
  while (rc > 1 && Math.hypot(rawX[0] - rawX[rc - 1], rawY[0] - rawY[rc - 1]) <= 1e-5) rc--;
  if (rc < 3) return null;

  for (const sub of [4, 3, 2, 1]) {
    const vx = [], vy = [];
    let cx = 0, cy = 0;
    const rec = {
      moveTo(x, y) { cx = x; cy = y; vx.push(x); vy.push(y); },
      lineTo(x, y) {
        if (Math.hypot(x - cx, y - cy) > 1e-5) { vx.push(x); vy.push(y); cx = x; cy = y; }
      },
      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        const x0 = cx, y0 = cy;
        for (let k = 1; k <= sub; k++) {
          const t = k / sub, u = 1 - t;
          const px = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x;
          const py = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y;
          if (!vx.length || Math.hypot(px - vx[vx.length - 1], py - vy[vy.length - 1]) > 1e-5) {
            vx.push(px); vy.push(py);
          }
        }
        cx = x; cy = y;
      },
      closePath() {},
    };
    smoothClosedPath(rec, rawX, rawY, rc);
    while (vx.length > 1 && Math.hypot(vx[0] - vx[vx.length - 1], vy[0] - vy[vy.length - 1]) <= 1e-5) {
      vx.pop(); vy.pop();
    }
    if (vx.length <= MAX_POLY_VERTS || sub === 1) {
      const count = Math.min(MAX_POLY_VERTS, vx.length);
      if (count < 3) return null;
      const verts = new Float32Array(count * 2);
      let rMax = 0, area2 = 0;
      for (let i = 0; i < count; i++) {
        const x = vx[i], y = vy[i], j = (i + 1) % count;
        verts[2 * i] = x; verts[2 * i + 1] = y;
        rMax = Math.max(rMax, Math.abs(x), Math.abs(y));
        area2 += x * vy[j] - vx[j] * y;
      }
      const rBox = Math.max(0.05, rMax * 1.25);
      const hypArea = 2 * Math.abs(area2);
      const hashParts = [count, Math.round(rBox * 1e4)];
      for (let i = 0; i < count; i++) hashParts.push(Math.round(verts[2 * i] * 1e4), Math.round(verts[2 * i + 1] * 1e4));
      return { verts, count, rBox, hypArea, sig: hashParts.join(',') };
    }
  }
  return null;
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'compile error';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || 'link error';
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  return prog;
}

/**
 * Create a WebGL2 Poincaré disc renderer paired behind `canvas2d`.
 * Returns `null` cleanly in Node/headless or non-WebGL2 environments so the caller keeps Canvas2D active.
 */
export function createHyperbolicGL(canvas2d) {
  if (typeof document === 'undefined' || !canvas2d || !canvas2d.parentElement) return null;
  const wrap = canvas2d.parentElement;
  const glCanvas = document.createElement('canvas');
  glCanvas.className = 'pat-gl';
  glCanvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:0;display:none;';
  wrap.insertBefore(glCanvas, canvas2d);
  canvas2d.style.position = 'relative';
  canvas2d.style.zIndex = '1';
  canvas2d.style.background = 'transparent';

  let gl = null;
  try {
    gl = glCanvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
  } catch (e) { gl = null; }
  if (!gl) { glCanvas.remove(); return null; }

  let lost = false;
  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  glCanvas.addEventListener('webglcontextrestored', () => { lost = false; initResources(); });

  let bakeProg = null, mainProg = null, emptyVao = null;
  let polyTex = null, commaTex = null, bakeFbo = null;
  let foldUbo = null, commaUbo = null, segUbo = null, markUbo = null;
  let interactFbo = null, interactTex = null, interactW = 0, interactH = 0;
  let commaLayers = 0, cachedSigs = [];
  let bakeLocs = null, mainLocs = null;

  const foldData = new Float32Array(FOLD_UBO_FLOATS);
  const commaData = new Float32Array(COMMA_UBO_FLOATS);
  const segData = new Float32Array(SEG_UBO_FLOATS);
  const markData = new Float32Array(MARK_UBO_FLOATS);
  const polyData = new Float32Array(MAX_POLY_VERTS * 2);

  let modelInfo = null;
  let lastBox = { left: 0, top: 0, w: 0, h: 0 };
  let lastRenderScale = 1;

  function makeUbo(floatLen) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, buf);
    gl.bufferData(gl.UNIFORM_BUFFER, floatLen * 4, gl.DYNAMIC_DRAW);
    return buf;
  }

  function initResources() {
    bakeProg = createProgram(gl, FULLSCREEN_VS, SDF_BAKE_FS);
    mainProg = createProgram(gl, DISC_VS, MAIN_FS);
    emptyVao = gl.createVertexArray();

    bakeLocs = {
      uPolyTex: gl.getUniformLocation(bakeProg, 'uPolyTex'),
      uVertCount: gl.getUniformLocation(bakeProg, 'uVertCount'),
      uRBox: gl.getUniformLocation(bakeProg, 'uRBox'),
    };
    mainLocs = {
      uDiscClip: gl.getUniformLocation(mainProg, 'uDiscClip'),
      uGeom: gl.getUniformLocation(mainProg, 'uGeom'),
      uInvPxScale: gl.getUniformLocation(mainProg, 'uInvPxScale'),
      uViewportH: gl.getUniformLocation(mainProg, 'uViewportH'),
      uInvView: gl.getUniformLocation(mainProg, 'uInvView'),
      uInvViewFlip: gl.getUniformLocation(mainProg, 'uInvViewFlip'),
      uAtD: gl.getUniformLocation(mainProg, 'uAtD'),
      uParams: gl.getUniformLocation(mainProg, 'uParams'),
      uCounts: gl.getUniformLocation(mainProg, 'uCounts'),
      uPick: gl.getUniformLocation(mainProg, 'uPick'),
      uRimColor: gl.getUniformLocation(mainProg, 'uRimColor'),
      uCommaTex: gl.getUniformLocation(mainProg, 'uCommaTex'),
    };

    foldUbo = makeUbo(FOLD_UBO_FLOATS);
    commaUbo = makeUbo(COMMA_UBO_FLOATS);
    segUbo = makeUbo(SEG_UBO_FLOATS);
    markUbo = makeUbo(MARK_UBO_FLOATS);
    const bindBlock = (name, slot, buf) => {
      const idx = gl.getUniformBlockIndex(mainProg, name);
      if (idx !== 0xffffffff && idx >= 0) {
        gl.uniformBlockBinding(mainProg, idx, slot);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, slot, buf);
      }
    };
    bindBlock('FoldBlock', 0, foldUbo);
    bindBlock('CommaBlock', 1, commaUbo);
    bindBlock('SegBlock', 2, segUbo);
    bindBlock('MarkBlock', 3, markUbo);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    polyTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, polyTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, MAX_POLY_VERTS, 1, 0, gl.RG, gl.FLOAT, null);

    bakeFbo = gl.createFramebuffer();
    interactFbo = gl.createFramebuffer();
    interactTex = null;
    interactW = 0;
    interactH = 0;
    commaLayers = 0;
    commaTex = null;
    cachedSigs = [];
  }

  try {
    initResources();
  } catch (err) {
    glCanvas.remove();
    return null;
  }

  function ensureCommaArray(layers) {
    const need = Math.max(1, layers);
    if (commaTex && commaLayers >= need) return;
    if (commaTex) gl.deleteTexture(commaTex);
    commaLayers = Math.max(need, 8);
    commaTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, commaTex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 9, gl.RGBA8, COMMA_TEX_SIZE, COMMA_TEX_SIZE, commaLayers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    cachedSigs = [];
  }

  function ensureInteractTarget(w, h) {
    if (interactTex && interactW === w && interactH === h) return;
    if (interactTex) gl.deleteTexture(interactTex);
    interactW = w;
    interactH = h;
    interactTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, interactTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, interactFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, interactTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function bakeCommas(shapes) {
    ensureCommaArray(shapes.length);
    let anyBaked = false;
    gl.useProgram(bakeProg);
    gl.bindVertexArray(emptyVao);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, polyTex);
    gl.uniform1i(bakeLocs.uPolyTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bakeFbo);
    gl.viewport(0, 0, COMMA_TEX_SIZE, COMMA_TEX_SIZE);

    for (let si = 0; si < shapes.length; si++) {
      const sh = shapes[si];
      if (!sh || cachedSigs[si] === sh.sig) continue;
      anyBaked = true;
      polyData.fill(0);
      polyData.set(sh.verts);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_POLY_VERTS, 1, gl.RG, gl.FLOAT, polyData);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, commaTex, 0, si);
      gl.uniform1i(bakeLocs.uVertCount, sh.count);
      gl.uniform1f(bakeLocs.uRBox, sh.rBox);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cachedSigs[si] = sh.sig;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (anyBaked) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, commaTex);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    }
  }

  function putVec4(arr, blockBase, index, x, y, z, w) {
    const off = (blockBase + index) * 4;
    arr[off] = x; arr[off + 1] = y; arr[off + 2] = z; arr[off + 3] = w;
  }

  function buildCandidateTiles(D, A, { repSegs, commaSamples, locateTile, norms, S_edges, edgeLens }) {
    const maps2 = A.maps2 || A.maps.map((M, i) => so21ToPSU(M, !!(D.edges[i].mirror || D.edges[i].rev)));
    const atD = toDisc(D.at);
    const n = D.n;
    const vDiscs = D.verts.map(toDisc);

    const needVertex = new Uint8Array(n);
    for (const c of A.classes) {
      if (c.n > 1) for (const vi of c.verts) needVertex[vi] = 1;
    }
    const commaMargin = 0.08;
    const commaBoundary = new Uint8Array(commaSamples.length);
    let anyCommaNearBoundary = false;
    for (let si = 0; si < commaSamples.length; si++) {
      const cs = commaSamples[si];
      let minE = Infinity;
      for (let ei = 0; ei < n; ei++) minE = Math.min(minE, segDistHypCPU(cs.atD, S_edges[ei], edgeLens[ei]));
      if (minE <= cs.rad + commaMargin) {
        commaBoundary[si] = 1;
        anyCommaNearBoundary = true;
        for (let vi = 0; vi < n; vi++) {
          if (discDist(vDiscs[vi], cs.atD) <= cs.rad + 0.35) needVertex[vi] = 1;
        }
      }
    }
    const fastOnlyEdges = repSegs.length === 0 && !anyCommaNearBoundary;

    const tiles = [];
    const seen = [];
    const addTile = (g) => {
      const flip = g[4] ? 1 : 0;
      const w = psuApplyDisc(g, atD);
      for (let i = 0; i < seen.length; i++) {
        if (seen[i].flip === flip && discDist(seen[i].w, w) < 1e-4) return false;
      }
      seen.push({ flip, w });
      tiles.push(g);
      return true;
    };

    const gI = psuI();
    addTile(gI);

    if (fastOnlyEdges) {
      for (let e = 0; e < n; e++) addTile(maps2[e]);
      let qi = 0;
      while (qi < tiles.length && tiles.length < 96) {
        const g = tiles[qi++];
        const gv = vDiscs.map((v) => psuApplyDisc(g, v));
        let touchesNeeded = isIdPsu(g);
        if (!touchesNeeded) {
          for (let i = 0; i < n && !touchesNeeded; i++) {
            if (!needVertex[i]) continue;
            for (let j = 0; j < n; j++) {
              if (discDist(vDiscs[i], gv[j]) < 1e-3) { touchesNeeded = true; break; }
            }
          }
        }
        if (!touchesNeeded) continue;
        for (let i = 0; i < n; i++) {
          const gn = psuMul(g, maps2[i]);
          let shared = false;
          for (let a = 0; a < n && !shared; a++) {
            if (!needVertex[a]) continue;
            const dA = vDiscs[a];
            for (let b = 0; b < n; b++) {
              if (discDist(dA, psuApplyDisc(gn, vDiscs[b])) < 1e-3) { shared = true; break; }
            }
          }
          if (shared) addTile(gn);
        }
      }
      return tiles;
    }

    let qi = 0;
    while (qi < tiles.length && tiles.length < 96) {
      const g = tiles[qi++];
      for (let i = 0; i < n; i++) {
        const gn = psuMul(g, maps2[i]);
        let shared = isIdPsu(g);
        for (let a = 0; a < n && !shared; a++) {
          const dA = vDiscs[a];
          for (let b = 0; b < n; b++) {
            if (discDist(dA, psuApplyDisc(gn, vDiscs[b])) < 1e-3) { shared = true; break; }
          }
        }
        if (shared) addTile(gn);
      }
    }

    const probePoint = (ptH) => {
      const res = locateTile(D, A, toDisc(ptH));
      if (!res || !res.g) return;
      const gBase = psuInv(res.g);
      addTile(gBase);
      for (let e = 0; e < n && tiles.length < 112; e++) addTile(psuMul(gBase, maps2[e]));
    };
    const G = D.G;
    for (const seg of repSegs) {
      for (let k = 0; k <= 4; k++) probePoint(k === 0 ? seg.a : k === 4 ? seg.b : G.mix(seg.a, seg.b, k / 4));
    }
    for (let si = 0; si < commaSamples.length; si++) {
      if (commaSamples[si].pts && commaSamples[si].pts.length) {
        const pts = commaSamples[si].pts;
        probePoint(commaSamples[si].atH);
        for (let k = 0; k < 4; k++) probePoint(pts[Math.floor((k * pts.length) / 4)]);
      }
    }
    void norms;
    return tiles;
  }

  return {
    isReady: () => !lost && !!mainProg,

    lastScale: () => lastRenderScale,

    setVisible(vis) {
      glCanvas.style.display = vis ? 'block' : 'none';
    },

    resize() {
      // Sizing is driven directly from disc layout inside render() to avoid blank/oversized allocations.
    },

    setModel(model, opts) {
      if (!gl || lost || !model || !model.D || model.D.n <= 0 || model.D.n > MAX_EDGES) return false;
      const { D, A } = model;
      const { des, desAt, desRad, area, smoothClosedPath, locateTile } = opts;
      const G = D.G;
      const n = D.n;
      const norms = buildKleinNorms(D);
      const maps2 = A.maps2 || A.maps.map((M, i) => so21ToPSU(M, !!(D.edges[i].mirror || D.edges[i].rev)));
      const invMaps2 = maps2.map((m) => psuInv(m));
      const vDiscs = D.verts.map(toDisc);
      const vKleins = vDiscs.map(discToKlein);

      const starOf = new Array(n).fill(-1);
      A.stars.forEach((s, k) => s.edges.forEach((e) => { starOf[e] = k; }));
      const S_edges = [], edgeLens = [];
      for (let i = 0; i < n; i++) {
        const a = D.verts[i], b = D.verts[(i + 1) % n];
        S_edges.push(psuInv(so21ToPSU(G.frame(a, b), false)));
        edgeLens.push(G.dist(a, b));
      }

      const localFrames = [];
      const bakedInfos = [];
      const commaSamples = [];
      let totalCommaArea = 0;
      for (let si = 0; si < des.length; si++) {
        const pts = des[si] && des[si].pts;
        if (!pts || pts.length < 3) {
          localFrames.push(null);
          bakedInfos.push(null);
          commaSamples.push({ atH: desAt[si] || D.at, atD: toDisc(desAt[si] || D.at), rad: 0, pts: [] });
          continue;
        }
        const atH = desAt[si] || D.at;
        let farPt = pts[0], farD = -1;
        for (const p of pts) {
          const d = G.dist(atH, p);
          if (d > farD) { farD = d; farPt = p; }
        }
        const L_si = farD > 1e-6
          ? psuInv(so21ToPSU(G.frame(atH, farPt), false))
          : psuInv(so21ToPSU(G.translate(G.origin, atH), false));
        const info = sampleSmoothCommaDisc(pts, L_si, smoothClosedPath);
        if (info) totalCommaArea += info.hypArea;
        localFrames.push(L_si);
        bakedInfos.push(info);
        commaSamples.push({ atH, atD: toDisc(atH), rad: desRad[si] || 0, pts });
      }

      const repSegs = [];
      A.glides.forEach((g, k) => {
        if (g.seg) repSegs.push({
          a: g.seg[0], b: g.seg[1], color: RED, alpha: 1, width: 2.1, dash: [2.1 * 3.2, 2.1 * 3],
          kind: 0, grpIdx: k, scaleMode: 0, groupId: k,
        });
      });
      (model.lines || []).forEach((ln, k) => {
        if (ln.once) return;
        repSegs.push({
          a: ln.a, b: ln.b,
          color: ln.color || DARK,
          alpha: ln.alpha === undefined ? 1 : ln.alpha,
          width: ln.width || 2,
          dash: ln.dash || null,
          kind: ln.role === 'o' ? 2 : 1,
          grpIdx: k,
          scaleMode: 1,
          groupId: A.glides.length + k,
        });
      });

      const candTiles = buildCandidateTiles(D, A, { repSegs, commaSamples, locateTile, norms, S_edges, edgeLens });

      const commaInst = [];
      for (let si = 0; si < des.length; si++) {
        const info = bakedInfos[si], L_si = localFrames[si], cs = commaSamples[si];
        if (!info || !L_si) continue;
        const cSeen = [];
        const rCorner = Math.SQRT2 * info.rBox;
        const coshBound = rCorner < 0.995
          ? ((1 + rCorner * rCorner) / (1 - rCorner * rCorner)) * 1.005 + 1e-3
          : 1e9;
        for (const g of candTiles) {
          const centerG = psuApplyDisc(g, cs.atD);
          if (pointDistToD(centerG, D, norms, S_edges, edgeLens) > cs.rad + 0.06) continue;
          const flip = g[4] ? 1 : 0;
          let dup = false;
          for (const prev of cSeen) {
            if (prev.flip === flip && discDist(prev.c, centerG) < 1e-4) { dup = true; break; }
          }
          if (dup) continue;
          cSeen.push({ flip, c: centerG });
          if (commaInst.length >= MAX_ITEMS) return false;
          const M_c = psuMul(L_si, psuInv(g));
          const cH = discToH(centerG);
          commaInst.push({ M: M_c, flip: M_c[4] ? 1 : 0, layer: si, rBox: info.rBox, cH, coshBound });
        }
      }

      const segInst = [];
      let maxSegHalfW = 2.0;
      for (const seg of repSegs) {
        const a0 = toDisc(seg.a), b0 = toDisc(seg.b), sSeen = [];
        const lenH = G.dist(seg.a, seg.b);
        if (lenH < 1e-7) continue;
        const segMargin = (seg.kind === 0 || seg.kind === 2) ? 0.14 : 0.075;
        const tb = Math.tanh(0.5 * lenH);
        for (const g of candTiles) {
          const M = psuToSO21(g);
          const gaH = apply(M, seg.a), gbH = apply(M, seg.b);
          const ga = psuApplyDisc(g, a0), gb = psuApplyDisc(g, b0);
          let dup = false;
          for (const p of sSeen) {
            if ((discDist(p.a, ga) < 1e-3 && discDist(p.b, gb) < 1e-3) ||
                (discDist(p.a, gb) < 1e-3 && discDist(p.b, ga) < 1e-3)) { dup = true; break; }
          }
          if (dup) continue;
          const S_ab = psuInv(so21ToPSU(G.frame(gaH, gbH), false));
          if (segDistToD(ga, gb, S_ab, lenH, D, norms, S_edges, edgeLens, vDiscs, vKleins) > segMargin) continue;
          sSeen.push({ a: ga, b: gb });
          if (segInst.length >= MAX_ITEMS) return false;
          const sN = segMinkNorm(gaH, gbH);
          const peakHalfW = 0.5 * seg.width * (seg.kind === 1 ? 1.0 : 1.85);
          if (peakHalfW > maxSegHalfW) maxSegHalfW = peakHalfW;
          segInst.push({
            N: sN, S: S_ab, lenH, tb,
            color: seg.color, alpha: seg.alpha, width: seg.width,
            dashOn: seg.dash ? seg.dash[0] : 0, dashOff: seg.dash ? seg.dash[1] : 0,
            kind: seg.kind, grpIdx: seg.grpIdx, scaleMode: seg.scaleMode, groupId: seg.groupId,
          });
        }
      }

      const alsoSet = model.marks ? new Set(model.marks) : null;
      const marked = A.classes.filter((c) => c.n > 1).map((c) => {
        const ref = model.markRefs && model.markRefs[c.id];
        const v = ref ? ref.v : c.verts[0];
        let toward = null;
        if (!ref && c.kind === 'corner') {
          const en = c.ends[0];
          toward = en.side === 'start' ? (en.e + 1) % n : en.e;
        }
        return { c, v, toward, dir: ref ? ref.dir : null };
      });
      const markInst = [];
      const hScale = Math.min(0.75, Math.max(0.45, 0.30 * Math.sqrt(area)));
      for (const mk of marked) {
        const pH = D.verts[mk.v], p0 = toDisc(pH);
        let dir0;
        if (mk.dir) {
          const u = mk.dir;
          const dx = u[0] * (1 + pH[2]) - pH[0] * u[2];
          const dy = u[1] * (1 + pH[2]) - pH[1] * u[2];
          const l = Math.hypot(dx, dy) || 1;
          dir0 = [dx / l, dy / l];
        } else {
          const tgt = mk.toward === null ? D.at : D.verts[mk.toward];
          const d = G.dist(pH, tgt);
          const u = d > 1e-6 ? 0.06 : 0;
          const q = G.norm([pH[0] + (tgt[0] - pH[0]) * u, pH[1] + (tgt[1] - pH[1]) * u, pH[2] + (tgt[2] - pH[2]) * u]);
          const qD = toDisc(q);
          const dx = qD[0] - p0[0], dy = qD[1] - p0[1], l = Math.hypot(dx, dy) || 1;
          dir0 = [dx / l, dy / l];
        }
        const mSeen = [];
        for (const g of candTiles) {
          const pg = psuApplyDisc(g, p0);
          if (pointDistToD(pg, D, norms, S_edges, edgeLens) > 0.72 * hScale) continue;
          let dup = false;
          for (const prev of mSeen) { if (discDist(prev, pg) < 1e-3) { dup = true; break; } }
          if (dup) continue;
          mSeen.push(pg);
          if (markInst.length >= MAX_ITEMS) return false;
          const ug = pushDirDisc(g, p0, dir0);
          const mH = discToH(pg);
          markInst.push({
            p: pg, u: ug, mH, order: mk.c.n,
            isCone: mk.c.kind === 'cone' ? 1 : 0,
            clsId: mk.c.id,
            isAlso: alsoSet && alsoSet.has(mk.c.id) ? 1 : 0,
          });
        }
      }

      // Pack and upload 4 std140 UBOs once per model change
      foldData.fill(0);
      for (let i = 0; i < n; i++) {
        const N = norms[i], im = invMaps2[i], Se = S_edges[i];
        const e = D.edges[i], nextLast = e.mirror ? i : e.to;
        putVec4(foldData, 0 * MAX_EDGES, i, N[0], N[1], N[2], starOf[i] + 1);
        putVec4(foldData, 1 * MAX_EDGES, i, im[0], im[1], im[2], im[3]);
        putVec4(foldData, 2 * MAX_EDGES, i, im[4] ? 1 : 0, nextLast, edgeLens[i], N[3]);
        putVec4(foldData, 3 * MAX_EDGES, i, Se[0], Se[1], Se[2], Se[3]);
      }
      gl.bindBuffer(gl.UNIFORM_BUFFER, foldUbo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, foldData);

      commaData.fill(0);
      for (let i = 0; i < commaInst.length; i++) {
        const c = commaInst[i];
        putVec4(commaData, 0 * MAX_ITEMS, i, c.M[0], c.M[1], c.M[2], c.M[3]);
        putVec4(commaData, 1 * MAX_ITEMS, i, c.flip, c.layer, c.rBox, 1 / (2 * c.rBox));
        putVec4(commaData, 2 * MAX_ITEMS, i, -c.cH[0], -c.cH[1], c.cH[2], c.coshBound);
      }
      gl.bindBuffer(gl.UNIFORM_BUFFER, commaUbo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, commaData);

      segData.fill(0);
      for (let i = 0; i < segInst.length; i++) {
        const s = segInst[i];
        putVec4(segData, 0 * MAX_ITEMS, i, s.N[0], s.N[1], s.N[2], s.groupId);
        putVec4(segData, 1 * MAX_ITEMS, i, s.S[0], s.S[1], s.S[2], s.S[3]);
        putVec4(segData, 2 * MAX_ITEMS, i, s.color[0], s.color[1], s.color[2], s.alpha);
        putVec4(segData, 3 * MAX_ITEMS, i, s.width, s.lenH, s.dashOn, s.dashOff);
        putVec4(segData, 4 * MAX_ITEMS, i, s.kind, s.grpIdx, s.scaleMode, s.tb);
      }
      gl.bindBuffer(gl.UNIFORM_BUFFER, segUbo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, segData);

      markData.fill(0);
      for (let i = 0; i < markInst.length; i++) {
        const mk = markInst[i];
        putVec4(markData, 0 * MAX_ITEMS, i, mk.p[0], mk.p[1], mk.u[0], mk.u[1]);
        putVec4(markData, 1 * MAX_ITEMS, i, mk.order, mk.isCone, mk.clsId, mk.isAlso);
        putVec4(markData, 2 * MAX_ITEMS, i, -mk.mH[0], -mk.mH[1], mk.mH[2], 0);
      }
      gl.bindBuffer(gl.UNIFORM_BUFFER, markUbo);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, markData);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);

      bakeCommas(bakedInfos);

      const inkFrac = Math.min(0.42, Math.max(0.10, totalCommaArea / Math.max(0.05, area)));
      const baseMix = A.stars.length ? 0.35 : 0;
      const baseC = [
        FRONT[0] + (RED[0] - FRONT[0]) * baseMix,
        FRONT[1] + (RED[1] - FRONT[1]) * baseMix,
        FRONT[2] + (RED[2] - FRONT[2]) * baseMix,
      ];
      const rimColor = [
        baseC[0] + (FRONT_INK[0] - baseC[0]) * inkFrac * 0.45,
        baseC[1] + (FRONT_INK[1] - baseC[1]) * inkFrac * 0.45,
        baseC[2] + (FRONT_INK[2] - baseC[2]) * inkFrac * 0.45,
      ];

      modelInfo = {
        atD: toDisc(D.at),
        hScale,
        showEdges: model.tileEdges !== false ? 1 : 0,
        dimMarks: model.dimMarks === false ? 0 : 1,
        maxSegHalfW,
        nEdges: n,
        nCommas: commaInst.length,
        nSegs: segInst.length,
        nMarks: markInst.length,
        nGlides: A.glides.length,
        rimColor,
      };
      return true;
    },

    render({ W, H, dpr, cx, cy, R, vPsu, pick, also, interactive = false }) {
      if (!gl || lost || !modelInfo || !W || !H) return;
      const pad = 4;
      const gLeft = Math.max(0, Math.floor(cx - R - pad));
      const gTop = Math.max(0, Math.floor(cy - R - pad));
      const gRight = Math.min(W, Math.ceil(cx + R + pad));
      const gBot = Math.min(H, Math.ceil(cy + R + pad));
      const gW = Math.max(1, gRight - gLeft);
      const gH = Math.max(1, gBot - gTop);
      if (lastBox.left !== gLeft || lastBox.top !== gTop || lastBox.w !== gW || lastBox.h !== gH) {
        glCanvas.style.left = `${gLeft}px`;
        glCanvas.style.top = `${gTop}px`;
        glCanvas.style.width = `${gW}px`;
        glCanvas.style.height = `${gH}px`;
        lastBox = { left: gLeft, top: gTop, w: gW, h: gH };
      }
      const wPx = Math.max(1, Math.round(gW * dpr));
      const hPx = Math.max(1, Math.round(gH * dpr));
      if (glCanvas.width !== wPx || glCanvas.height !== hPx) {
        glCanvas.width = wPx;
        glCanvas.height = hPx;
      }

      const scale = interactive && (dpr > 1.25 || wPx * hPx > 1_600_000)
        ? Math.min(0.75, Math.max(0.40, Math.sqrt(1_250_000 / Math.max(1, wPx * hPx))))
        : 1.0;
      lastRenderScale = scale;

      const scaled = scale < 0.95;
      const targetW = scaled ? Math.max(64, Math.round(wPx * scale)) : wPx;
      const targetH = scaled ? Math.max(64, Math.round(hPx * scale)) : hPx;
      const effDpr = dpr * scale;

      if (scaled) {
        ensureInteractTarget(targetW, targetH);
        gl.bindFramebuffer(gl.FRAMEBUFFER, interactFbo);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, targetW, targetH);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.SCISSOR_TEST);
      }
      gl.viewport(0, 0, targetW, targetH);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (scaled) gl.disable(gl.SCISSOR_TEST);

      const cxL = cx - gLeft, cyL = cy - gTop;
      const cxNdc = (2 * cxL) / gW - 1;
      const cyNdc = 1 - (2 * cyL) / gH;
      const radCss = (R + 3.5) * 1.006;
      const rxNdc = (2 * radCss) / gW;
      const ryNdc = (2 * radCss) / gH;

      const invV = psuInv(vPsu);
      let pickType = 0, pickId = 0, pickExtra = -1;
      if (pick) {
        if (pick.t === '*') { pickType = 1; pickId = pick.star; }
        else if (pick.t === 'x') { pickType = 2; pickId = modelInfo.nGlides ? (pick.k % modelInfo.nGlides) : 0; }
        else if (pick.t === 'o') { pickType = 3; }
        else if (pick.t === 'd') {
          pickType = 4; pickId = pick.cls;
          pickExtra = pick.role === 'corner' && pick.star !== undefined ? pick.star : -1;
        }
      }
      const dimAlpha = pick ? 0.32 : also ? 0.38 : 1.0;

      gl.useProgram(mainProg);
      gl.bindVertexArray(emptyVao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, commaTex);
      gl.uniform1i(mainLocs.uCommaTex, 0);

      gl.uniform4f(mainLocs.uDiscClip, cxNdc, cyNdc, rxNdc, ryNdc);
      gl.uniform4f(mainLocs.uGeom, cxL, cyL, R, effDpr);
      gl.uniform2f(mainLocs.uInvPxScale, gW / targetW, gH / targetH);
      gl.uniform1f(mainLocs.uViewportH, gH);
      gl.uniform4f(mainLocs.uInvView, invV[0], invV[1], invV[2], invV[3]);
      gl.uniform1f(mainLocs.uInvViewFlip, invV[4] ? 1 : 0);
      gl.uniform2f(mainLocs.uAtD, modelInfo.atD[0], modelInfo.atD[1]);
      gl.uniform4f(mainLocs.uParams, modelInfo.hScale, modelInfo.showEdges, modelInfo.dimMarks, modelInfo.maxSegHalfW);
      gl.uniform4i(mainLocs.uCounts, modelInfo.nEdges, modelInfo.nCommas, modelInfo.nSegs, modelInfo.nMarks);
      gl.uniform4f(mainLocs.uPick, pickType, pickId, pickExtra, dimAlpha);
      gl.uniform3f(mainLocs.uRimColor, modelInfo.rimColor[0], modelInfo.rimColor[1], modelInfo.rimColor[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 96);

      if (scaled) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, interactFbo);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(0, 0, targetW, targetH, 0, 0, wPx, hPx, gl.COLOR_BUFFER_BIT, gl.LINEAR);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }
    },

    /** Render current native-resolution frame and return top-down RGBA Uint8ClampedArray patch (composited over white + 2D overlay). */
    readPatch(xCss, yCss, rPx, overlayCanvas, frame) {
      this.render({ ...frame, interactive: false });
      const dpr = frame.dpr;
      const wPx = glCanvas.width, hPx = glCanvas.height;
      const glCxPx = Math.round((xCss - lastBox.left) * dpr);
      const glCyCssPx = Math.round((yCss - lastBox.top) * dpr);
      const ovCxPx = Math.round(xCss * dpr);
      const ovCyCssPx = Math.round(yCss * dpr);
      const side = 2 * rPx + 1;
      const out = new Uint8ClampedArray(side * side * 4);
      out.fill(255);

      const x0 = Math.max(0, glCxPx - rPx), x1 = Math.min(wPx, glCxPx + rPx + 1);
      const yTop0 = Math.max(0, glCyCssPx - rPx), yTop1 = Math.min(hPx, glCyCssPx + rPx + 1);
      const rw = x1 - x0, rh = yTop1 - yTop0;
      if (rw > 0 && rh > 0) {
        const yBot0 = hPx - yTop1;
        const buf = new Uint8Array(rw * rh * 4);
        gl.readPixels(x0, yBot0, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let row = 0; row < rh; row++) {
          const glRow = rh - 1 - row;
          const outY = yTop0 + row - (glCyCssPx - rPx);
          for (let col = 0; col < rw; col++) {
            const gi = (glRow * rw + col) * 4;
            const outX = x0 + col - (glCxPx - rPx);
            const oi = (outY * side + outX) * 4;
            const a = buf[gi + 3] / 255;
            out[oi] = Math.round(buf[gi] + 255 * (1 - a));
            out[oi + 1] = Math.round(buf[gi + 1] + 255 * (1 - a));
            out[oi + 2] = Math.round(buf[gi + 2] + 255 * (1 - a));
            out[oi + 3] = 255;
          }
        }
      }
      if (overlayCanvas) {
        const owPx = overlayCanvas.width, ohPx = overlayCanvas.height;
        const ox0 = Math.max(0, ovCxPx - rPx), ox1 = Math.min(owPx, ovCxPx + rPx + 1);
        const oy0 = Math.max(0, ovCyCssPx - rPx), oy1 = Math.min(ohPx, ovCyCssPx + rPx + 1);
        const orw = ox1 - ox0, orh = oy1 - oy0;
        if (orw > 0 && orh > 0) {
          const octx = overlayCanvas.getContext('2d');
          const ov = octx.getImageData(ox0, oy0, orw, orh).data;
          for (let row = 0; row < orh; row++) {
            const outY = oy0 + row - (ovCyCssPx - rPx);
            for (let col = 0; col < orw; col++) {
              const vi = (row * orw + col) * 4;
              const va = ov[vi + 3] / 255;
              if (va > 0) {
                const outX = ox0 + col - (ovCxPx - rPx);
                const oi = (outY * side + outX) * 4;
                out[oi] = Math.round(ov[vi] * va + out[oi] * (1 - va));
                out[oi + 1] = Math.round(ov[vi + 1] * va + out[oi + 1] * (1 - va));
                out[oi + 2] = Math.round(ov[vi + 2] * va + out[oi + 2] * (1 - va));
              }
            }
          }
        }
      }
      return out;
    },
  };
}
