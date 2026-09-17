// An orthographic orbit camera.
//
// Orthographic because the sketch is: the chair drawn down its body diagonal,
// where the bounding cube's silhouette is a regular hexagon and the three
// visible faces are congruent rhombi. The home view is exactly that, looking
// into the dent from the (1, 1, 1) side, with the z axis upright on screen.

export const HOME_AZIMUTH = Math.PI / 4;                 // atan2(1, 1)
export const HOME_ELEVATION = Math.asin(1 / Math.sqrt(3)); // 35.264 degrees
const MAX_ELEVATION = Math.PI / 2 - 0.02;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function createCamera({target = [0, 0, 0], radius = 1} = {}) {
  const home = {target: [...target], radius, azimuth: HOME_AZIMUTH, elevation: HOME_ELEVATION, roll: 0, halfHeight: radius};
  const state = {target: [...home.target], azimuth: home.azimuth, elevation: home.elevation, roll: home.roll, halfHeight: home.halfHeight, radius};
  // Everything is nudged this far along clip-space x, so the object can sit in
  // the strip of canvas the caption panel leaves free without the camera's own
  // target moving. 0 is dead centre, 1 is half a viewport to the right.
  let shift = 0;
  // The user's zoom, as a multiple of the framed size. Keeping the zoom rather
  // than an absolute half-height is what lets the framing change underneath it
  // — a resize, a level change, the explode's extra room — without throwing
  // away the view the reader chose.
  const zoomFactor = () => (home.halfHeight > 0 ? state.halfHeight / home.halfHeight : 1);

  function basis() {
    const ce = Math.cos(state.elevation);
    const back = [ce * Math.cos(state.azimuth), ce * Math.sin(state.azimuth), Math.sin(state.elevation)];
    let right = cross([0, 0, 1], back);
    if (Math.hypot(...right) < 1e-6) right = [1, 0, 0];
    right = norm(right);
    let up = norm(cross(back, right));
    if (state.roll) {
      const c = Math.cos(state.roll), s = Math.sin(state.roll);
      const r2 = [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s];
      const u2 = [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s];
      right = r2; up = u2;
    }
    return {right, up, back};
  }

  // Column-major view-projection for an orthographic camera looking at target.
  function viewProjection(aspect, out = new Float32Array(16)) {
    const {right, up, back} = basis();
    const span = state.radius * 8 + 16;
    const eye = [state.target[0] + back[0] * span, state.target[1] + back[1] * span, state.target[2] + back[2] * span];
    const halfH = state.halfHeight, halfW = halfH * Math.max(aspect, 1e-4);
    const near = 0.01, far = span * 2 + state.radius * 4;
    const sx = 1 / halfW, sy = 1 / halfH, sz = -2 / (far - near), tz = -(far + near) / (far - near);
    out[0] = right[0] * sx; out[1] = up[0] * sy; out[2] = back[0] * sz; out[3] = 0;
    out[4] = right[1] * sx; out[5] = up[1] * sy; out[6] = back[1] * sz; out[7] = 0;
    out[8] = right[2] * sx; out[9] = up[2] * sy; out[10] = back[2] * sz; out[11] = 0;
    out[12] = -dot(right, eye) * sx + shift; out[13] = -dot(up, eye) * sy; out[14] = -dot(back, eye) * sz + tz; out[15] = 1;
    return out;
  }

  return {
    state,
    viewProjection,
    basis,
    // `keepView` is for a WebGL context restore, where the scene is rebuilt but
    // the reader's viewpoint should survive.
    setHome({target: t, radius: r, keepView = false}) {
      const zoom = zoomFactor();
      home.target = [...t]; home.radius = r; home.halfHeight = r;
      state.radius = r;
      if (keepView) state.halfHeight = home.halfHeight * zoom;
      else this.reset();
    },
    reset() {
      state.target = [...home.target];
      state.azimuth = home.azimuth; state.elevation = home.elevation; state.roll = 0;
      state.halfHeight = home.halfHeight; state.radius = home.radius;
    },
    isHome() {
      return Math.abs(state.azimuth - home.azimuth) < 1e-6 && Math.abs(state.elevation - home.elevation) < 1e-6
        && Math.abs(state.roll) < 1e-6 && Math.abs(zoomFactor() - 1) < 1e-6
        && state.target.every((v, i) => Math.abs(v - home.target[i]) < 1e-6);
    },
    orbit(dx, dy) {
      state.azimuth -= dx * 0.0062;
      state.elevation = Math.max(-MAX_ELEVATION, Math.min(MAX_ELEVATION, state.elevation + dy * 0.0062));
    },
    rollBy(delta) { state.roll += delta; },
    zoomBy(factor) {
      state.halfHeight = Math.max(home.halfHeight / 90, Math.min(home.halfHeight * 7, state.halfHeight / factor));
    },
    // Zoom keeping the world point under (px, py) in pixels fixed on screen.
    zoomAt(factor, px, py, width, height) {
      const before = this.screenToWorldOffset(px, py, width, height);
      this.zoomBy(factor);
      const after = this.screenToWorldOffset(px, py, width, height);
      for (let i = 0; i < 3; i++) state.target[i] += before[i] - after[i];
    },
    screenToWorldOffset(px, py, width, height) {
      const {right, up} = basis();
      const nx = (px / width) * 2 - 1 - shift, ny = 1 - (py / height) * 2;
      const halfH = state.halfHeight, halfW = halfH * (width / Math.max(height, 1));
      return [0, 1, 2].map(i => right[i] * nx * halfW + up[i] * ny * halfH);
    },
    panBy(dx, dy, height) {
      const {right, up} = basis();
      const k = (2 * state.halfHeight) / Math.max(height, 1);
      for (let i = 0; i < 3; i++) state.target[i] -= right[i] * dx * k - up[i] * dy * k;
    },
    zoomLevel() { return home.halfHeight / state.halfHeight; },
    // Fit the home framing to the viewport shape. `radius` is the hexagon's
    // circumradius, so it is half the silhouette's height and 1/sqrt(3) of its
    // width; in portrait the width is what limits it. `extra` leaves room for
    // the exploded view, and `free` is the fraction of the width the object may
    // use — less than 1 while the caption panel holds the left of the canvas.
    //
    // The user's zoom rides along as a factor, so a resize, a level change or
    // the explode's extra room re-frames the object without discarding the view.
    fit(aspect, extra = 1, free = 1) {
      const zoom = zoomFactor();
      const wide = Math.sqrt(3) / 2 / Math.max(aspect * free, 1e-4);
      home.halfHeight = home.radius * 1.08 * Math.max(1, wide) * extra;
      state.halfHeight = home.halfHeight * zoom;
      // Centre the object in the free strip rather than in the whole canvas.
      shift = 1 - free;
    },
    // The supertile doubles when a level is added; scaling the whole camera
    // about the origin keeps the picture, and the user's viewpoint, unchanged.
    rescale(factor) {
      for (let i = 0; i < 3; i++) { home.target[i] *= factor; state.target[i] *= factor; }
      home.radius *= factor; home.halfHeight *= factor;
      state.halfHeight *= factor; state.radius *= factor;
    },
  };
}
