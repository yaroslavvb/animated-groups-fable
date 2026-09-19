// The two-colour generator overlay: the measured operations of the picture's
// own two-colour group, drawn over the picture.
//
// It is the Colour category's `colour-generators.mjs` idea with two stations
// instead of three — white at twelve, black at six — so a mark carries one bit
// rather than a permutation of three colours. A **swap** is drawn in terracotta
// with the two stations exchanged (black-left swatch); a **keep** is drawn in
// green with them where they were (white-left). Everything drawn comes off
// `entry.symmetries`, which the builder measured by exhaustive search over the
// point operations, every node translation and every time shift, and re-checked
// directly; nothing here re-derives anything.
//
// The marks are OFF by default on every animation on this site. The page ticks
// them on from the checkbox under the picture, or from `?marks=1`.
//
// If an entry carries no mark data — an older or a partial catalog — `plan()`
// returns an empty list and the page disables the checkbox with a note rather
// than drawing an empty layer over the picture.

const NS = 'http://www.w3.org/2000/svg';
export const KEEP = '#2f6f52';
export const SWAP = '#a8391f';
/** How many lattice units of marks may be drawn at once, and how many marks a
 * unit may carry. Past this the overlay is noise rather than notation. */
export const MAX_UNITS = 25;
export const MAX_MARKS = 8;

const mod = (value, n) => ((value % n) + n) % n;
const det = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const isIdentity = M => M[0][0] === 1 && M[0][1] === 0 && M[1][0] === 0 && M[1][1] === 1;

/** The order of an integer point operation: 1, 2, 3, 4 or 6 for a rotation. */
export function rotationOrder(M) {
  const trace = M[0][0] + M[1][1];
  if (det(M) !== 1) return 0;
  return {2: 1, 1: 6, 0: 4, [-1]: 3, [-2]: 2}[trace] ?? 0;
}

/** Where `x ↦ M x + v/N` fixes a point, in lattice coordinates, or null when it
 * fixes a line (a reflection) or nothing (a translation). */
function centreOf(M, v, N) {
  const a = 1 - M[0][0], b = -M[0][1], c = -M[1][0], d = 1 - M[1][1];
  const D = a * d - b * c;
  if (!D) return null;
  const p = [(d * v[0] - b * v[1]) / D / N, (-c * v[0] + a * v[1]) / D / N];
  return [p[0] - Math.floor(p[0]), p[1] - Math.floor(p[1])];
}

/** The axis of a reflection or a glide `x ↦ M x + v/N`, as a point on it and a
 * direction, both in lattice coordinates.
 *
 * The midpoint of x and s(x) lies on the axis for every x — for a plain mirror
 * because the axis bisects the pair, and for a glide because the glide part runs
 * ALONG the axis. So the axis is the image of `x ↦ ((I + M)x + v/N)/2`, a line
 * through `v/2N` in the direction of the one non-zero column of `I + M`. */
function axisOf(M, v, N) {
  const sum = [[1 + M[0][0], M[0][1]], [M[1][0], 1 + M[1][1]]];
  const columns = [[sum[0][0], sum[1][0]], [sum[0][1], sum[1][1]]];
  const direction = columns.find(([x, y]) => x || y);
  if (!direction) return null;                       // M = −I, a half turn
  return {point: [v[0] / (2 * N), v[1] / (2 * N)], direction};
}

/** What the overlay will draw for one entry, and what the legend describes.
 *
 * Rows are taken round-robin over the point operation, so every operation that
 * occurs has a representative before any has two: the first eight rows of a
 * 32-row table would otherwise all be translations. */
export function plan(entry, {max = MAX_MARKS, lead = null} = {}) {
  const rows = entry?.symmetries ?? [];
  if (!rows.length) return [];
  const N = entry.N;
  /** The operation the reader has just chosen in step 2 — the rule's own `s`, or
   * the folded reading they picked. It is drawn first and heavier, so the chip
   * and the picture agree about which operation is being talked about. */
  const wanted = lead ?? (entry.spatial ? {op: entry.op, v: entry.v} : null);
  const isLead = row => !!wanted && row.op === wanted.op
    && mod(row.v[0] - wanted.v[0], N) === 0 && mod(row.v[1] - wanted.v[1], N) === 0;
  const byOp = new Map();
  for (const row of rows) {
    // A pure time shift moves nothing on the plane; it belongs in the table and
    // in the legend, not as a glyph over the picture.
    if (isIdentity(row.M) && !row.v[0] && !row.v[1]) continue;
    const key = row.op;
    if (!byOp.has(key)) byOp.set(key, []);
    // The chosen operation goes to the head of its own queue, and its queue to
    // the head of the round robin, so it survives the cut and is drawn first.
    if (isLead(row)) byOp.get(key).unshift(row); else byOp.get(key).push(row);
  }
  // Half the budget to each ink behaviour. The packed table lists every
  // preserving row before every swapping one, so a round robin over the
  // operation alone drew eight keeps and not one swap — on a layer whose whole
  // job is to show which operations exchange the two colours.
  // …and, inside each half, the most informative operation first. The packed
  // table lists the point operations in the lattice's own order — 1, R90, R180,
  // R270, then the four reflections — so a plain round robin spent the whole
  // budget on rotations and drew no mirror line at all on a p4g picture whose
  // mirrors are the thing worth seeing.
  const rank = row => (det(row.M) === -1 ? 0 : isIdentity(row.M) ? 2 : 1);
  const order = side => {
    const queues = [...byOp.values()].map(queue => queue.filter(row => row.keep === side)).filter(queue => queue.length);
    // Interleaved by KIND, not merely sorted by it: a p4g picture has four
    // reflections and four rotations, and taking the reflections first spent the
    // whole budget on lines and drew no rotation centre, while taking them in
    // table order drew no line. One of each kind in turn draws both.
    const buckets = [[], [], []];
    for (const queue of queues.sort((a, b) => Number(isLead(b[0])) - Number(isLead(a[0])))) buckets[rank(queue[0])].push(queue);
    const out = [];
    for (let i = 0; out.length < queues.length; i++) for (const bucket of buckets) if (bucket[i]) out.push(bucket[i]);
    return out;
  };
  const take = (queues, want) => {
    const out = [];
    while (out.length < want && queues.some(queue => queue.length)) {
      for (const queue of queues) {
        if (out.length >= want) break;
        if (queue.length) out.push(queue.shift());
      }
    }
    return out;
  };
  const swaps = take(order(false), Math.ceil(max / 2));
  const keeps = take(order(true), max - swaps.length);
  const more = take(order(false), max - swaps.length - keeps.length);
  const picked = [...swaps, ...more, ...keeps];
  return picked.map(row => {
    const order = rotationOrder(row.M);
    const reflects = det(row.M) === -1;
    const glide = reflects && (() => {
      // A glide is a reflection whose translation has a part ALONG the axis:
      // v + M v is twice that part, so it vanishes exactly for a pure mirror.
      const along = [row.v[0] + row.M[0][0] * row.v[0] + row.M[0][1] * row.v[1],
        row.v[1] + row.M[1][0] * row.v[0] + row.M[1][1] * row.v[1]];
      return mod(along[0], 2 * N) !== 0 || mod(along[1], 2 * N) !== 0;
    })();
    const base = {
      op: row.op, M: row.M, v: row.v, frames: row.frames, keep: row.keep,
      colour: row.keep ? KEEP : SWAP, lead: isLead(row),
    };
    if (isIdentity(row.M)) return {...base, glyph: 'slide', vector: [row.v[0] / N, row.v[1] / N]};
    if (reflects) {
      const axis = axisOf(row.M, row.v, N);
      return axis ? {...base, glyph: glide ? 'glide' : 'mirror', ...axis} : {...base, glyph: 'turn', order: 2, centre: [0, 0]};
    }
    return {...base, glyph: 'turn', order: order || 2, centre: centreOf(row.M, row.v, N) ?? [0, 0]};
  });
}

/** One sentence per mark, for the Notation panel and for the SVG's own label. */
export function describeMark(mark, {M: frames = 1} = {}) {
  const colour = mark.keep ? 'keeps the two inks' : 'exchanges the two inks';
  const wait = mark.frames ? ` after waiting ${mark.frames}/${frames} of a period` : '';
  if (mark.glyph === 'slide') return `a slide by (${mark.v.join(', ')}) nodes${wait} — ${colour}`;
  if (mark.glyph === 'mirror') return `the mirror ${mark.op}${wait} — ${colour}`;
  if (mark.glyph === 'glide') return `the glide ${mark.op}${wait} — ${colour}`;
  return `${mark.order === 2 ? 'a half turn' : `a ${mark.order}-fold turn`} (${mark.op})${wait} — ${colour}`;
}

const create = (name, attributes) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};

/** The glyph for one mark, drawn once in screen space. Everything is stroked
 * twice — a wide translucent white halo first, then the colour — so it reads on
 * a white ink and on a black one, which is the whole difficulty of annotating a
 * two-tone picture. */
function glyphFor(mark) {
  const group = create('g', {class: `mono-mark mono-mark-${mark.glyph} ${mark.keep ? 'keep' : 'swap'}${mark.lead ? ' lead' : ''}`, fill: 'none'});
  const halo = {stroke: '#ffffff', 'stroke-opacity': '.72', 'stroke-width': mark.lead ? 6 : 4.5, 'stroke-linecap': 'round'};
  const ink = {stroke: mark.colour, 'stroke-width': mark.lead ? 3 : 1.8, 'stroke-linecap': 'round'};
  if (mark.glyph === 'turn') {
    const r = mark.order >= 4 ? 11 : 9;
    const points = mark.order === 2
      ? `M 0 ${-r} A ${1.7 * r} ${1.7 * r} 0 0 1 0 ${r} A ${1.7 * r} ${1.7 * r} 0 0 1 0 ${-r}`
      : Array.from({length: mark.order}, (_, i) => {
        const a = -Math.PI / 2 + 2 * Math.PI * i / mark.order;
        return `${i ? 'L' : 'M'} ${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
      }).join(' ') + ' Z';
    group.append(create('path', {...halo, d: points}), create('path', {...ink, d: points}));
    // The two stations: white at twelve, black at six — exchanged on a swap.
    const top = mark.keep ? '#ffffff' : '#111111', bottom = mark.keep ? '#111111' : '#ffffff';
    group.append(create('circle', {cx: 0, cy: -r - 5, r: 3.1, fill: top, stroke: mark.colour, 'stroke-width': 1.1}));
    group.append(create('circle', {cx: 0, cy: r + 5, r: 3.1, fill: bottom, stroke: mark.colour, 'stroke-width': 1.1}));
  } else if (mark.glyph === 'slide') {
    group.append(create('line', {...halo, class: 'shaft', x1: 0, y1: 0, x2: 0, y2: 0}));
    group.append(create('line', {...ink, class: 'shaft', x1: 0, y1: 0, x2: 0, y2: 0}));
    group.append(create('path', {...halo, class: 'head', d: 'M 0 0'}));
    group.append(create('path', {...ink, class: 'head', d: 'M 0 0'}));
    group.append(create('circle', {class: 'station', cx: 0, cy: 0, r: 3.4, fill: mark.keep ? '#ffffff' : '#111111', stroke: mark.colour, 'stroke-width': 1.1}));
  } else {
    const dash = mark.glyph === 'glide' ? {'stroke-dasharray': '9 6'} : {};
    group.append(create('line', {...halo, ...dash, class: 'axis', x1: 0, y1: 0, x2: 0, y2: 0}));
    group.append(create('line', {...ink, ...dash, class: 'axis', x1: 0, y1: 0, x2: 0, y2: 0}));
    group.append(create('circle', {class: 'station', cx: 0, cy: 0, r: 3.4, fill: mark.keep ? '#ffffff' : '#111111', stroke: mark.colour, 'stroke-width': 1.1}));
  }
  return group;
}

/** Clips the infinite line `point + t·direction` (both in CSS pixels) to the
 * canvas rectangle, returning its two endpoints or null when it misses. */
function clipLine([px, py], [dx, dy], width, height) {
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-9)) return null;
  const ux = dx / length, uy = dy / length;
  let lo = -Infinity, hi = Infinity;
  for (const [p, u, limit] of [[px, ux, width], [py, uy, height]]) {
    if (Math.abs(u) < 1e-9) { if (p < -2 || p > limit + 2) return null; continue; }
    const a = (-2 - p) / u, b = (limit + 2 - p) / u;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  if (!(hi > lo)) return null;
  return [[px + ux * lo, py + uy * lo], [px + ux * hi, py + uy * hi]];
}

/** The overlay. `svg` is the `#marks` layer, `view` the camera from
 * `mono-renderer.mjs`; `marks` is `plan(entry)`. */
export function createMarkOverlay(svg, view, {marks = [], maxUnits = MAX_UNITS} = {}) {
  const layer = create('g', {});
  svg.append(layer);
  const lattice = view.lattice;
  let units = [], window = null;

  /** Lattice point → CSS pixel, through the current camera. */
  const project = ([u, v], width, height, scale, cos, sin) => {
    const [cx, cy] = view.center;
    const [x, y] = lattice.toPlane([u - cx, v - cy]);
    return [width / 2 + scale * (cos * x - sin * y), height / 2 + scale * (sin * x + cos * y)];
  };

  function build(offsets) {
    layer.replaceChildren();
    units = offsets.map(offset => {
      const node = create('g', {});
      const glyphs = marks.map(mark => { const g = glyphFor(mark); node.append(g); return g; });
      layer.append(node);
      return {offset, glyphs};
    });
  }

  return {
    get count() { return units.length; },
    get marksPerUnit() { return marks.length; },
    /** Every glyph the layer currently holds — what the browser test counts. */
    get nodeCount() { return layer.querySelectorAll('.mono-mark').length; },
    description() {
      if (!marks.length) return 'No generator marks are available for this picture.';
      const swaps = marks.filter(mark => !mark.keep).length;
      return `Generator marks: ${marks.length} operations of the measured two-colour group, ${swaps} of which exchange black and white.`;
    },
    update(width, height, {force = false} = {}) {
      if (!marks.length || !(width > 0 && height > 0)) { layer.replaceChildren(); units = []; return; }
      const scale = view.scale(width, height), angle = view.angle;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // How many lattice cells reach across the canvas, plus one either side —
      // and ordered OUTWARD from the screen centre, so that the cap keeps the
      // cells a reader can see. Row-major order with a cap kept the top-left
      // corner of the window and drew nothing at all on screen.
      const reach = Math.min(Math.ceil(Math.hypot(width, height) / Math.max(scale, 1)) + 1, 6);
      const offsets = [];
      for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) offsets.push([i, j]);
      offsets.sort((a, b) => Math.max(Math.abs(a[0]), Math.abs(a[1])) - Math.max(Math.abs(b[0]), Math.abs(b[1]))
        || (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
      offsets.length = Math.min(offsets.length, maxUnits);
      const key = `${offsets.length}:${marks.length}`;
      if (force || key !== window) { build(offsets); window = key; }
      // One axis of a mirror and its lattice translates land on the SAME screen
      // line over and over — twenty-five copies of one glide axis read as a grid
      // rather than as a mark — so a glyph whose drawn geometry has already been
      // laid down this update is hidden rather than stacked on top of it.
      const drawn = new Set();
      const once = (glyph, id) => { if (drawn.has(id)) { glyph.style.display = 'none'; return false; } drawn.add(id); return true; };
      for (const unit of units) {
        const [ou, ov] = unit.offset;
        for (const [index, mark] of marks.entries()) {
          const glyph = unit.glyphs[index];
          if (!glyph) continue;
          if (mark.glyph === 'turn') {
            const [x, y] = project([mark.centre[0] + ou, mark.centre[1] + ov], width, height, scale, cos, sin);
            const off = x < -20 || y < -20 || x > width + 20 || y > height + 20;
            glyph.setAttribute('transform', `translate(${x.toFixed(2)}, ${y.toFixed(2)})`);
            glyph.style.display = off ? 'none' : '';
            if (!off) once(glyph, `t${index}:${Math.round(x)}:${Math.round(y)}`);
          } else if (mark.glyph === 'slide') {
            const [x0, y0] = project([ou, ov], width, height, scale, cos, sin);
            const [x1, y1] = project([mark.vector[0] + ou, mark.vector[1] + ov], width, height, scale, cos, sin);
            const off = Math.max(x0, x1) < -20 || Math.max(y0, y1) < -20 || Math.min(x0, x1) > width + 20 || Math.min(y0, y1) > height + 20;
            glyph.style.display = off ? 'none' : '';
            glyph.removeAttribute('transform');
            if (off || !once(glyph, `s${index}:${Math.round(x0)}:${Math.round(y0)}`)) continue;
            for (const shaft of glyph.querySelectorAll('.shaft')) {
              shaft.setAttribute('x1', x0.toFixed(2)); shaft.setAttribute('y1', y0.toFixed(2));
              shaft.setAttribute('x2', x1.toFixed(2)); shaft.setAttribute('y2', y1.toFixed(2));
            }
            const a = Math.atan2(y1 - y0, x1 - x0), h = 7;
            const head = `M ${(x1 - h * Math.cos(a - 0.4)).toFixed(2)} ${(y1 - h * Math.sin(a - 0.4)).toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${(x1 - h * Math.cos(a + 0.4)).toFixed(2)} ${(y1 - h * Math.sin(a + 0.4)).toFixed(2)}`;
            for (const node of glyph.querySelectorAll('.head')) node.setAttribute('d', head);
            const station = glyph.querySelector('.station');
            station.setAttribute('cx', ((x0 + x1) / 2).toFixed(2));
            station.setAttribute('cy', ((y0 + y1) / 2).toFixed(2));
          } else {
            const [x0, y0] = project([mark.point[0] + ou, mark.point[1] + ov], width, height, scale, cos, sin);
            const [x1, y1] = project([mark.point[0] + mark.direction[0] + ou, mark.point[1] + mark.direction[1] + ov], width, height, scale, cos, sin);
            const clipped = clipLine([x0, y0], [x1 - x0, y1 - y0], width, height);
            glyph.style.display = clipped ? '' : 'none';
            glyph.removeAttribute('transform');
            if (!clipped) continue;
            if (!once(glyph, `a${index}:${Math.round(clipped[0][0])}:${Math.round(clipped[0][1])}:${Math.round(clipped[1][0])}:${Math.round(clipped[1][1])}`)) continue;
            for (const axis of glyph.querySelectorAll('.axis')) {
              axis.setAttribute('x1', clipped[0][0].toFixed(2)); axis.setAttribute('y1', clipped[0][1].toFixed(2));
              axis.setAttribute('x2', clipped[1][0].toFixed(2)); axis.setAttribute('y2', clipped[1][1].toFixed(2));
            }
            const station = glyph.querySelector('.station');
            station.setAttribute('cx', x0.toFixed(2)); station.setAttribute('cy', y0.toFixed(2));
          }
        }
      }
      // Two identical axes a lattice length apart are one line on screen; the
      // duplicates are harmless (they are exactly coincident) and cheap.
    },
    dispose() { layer.remove(); },
  };
}

/** The Notation panel's markup: what each glyph means, and the measured claim
 * behind it. Written from the entry, never from a constant. */
export function legendMarkup(entry, marks) {
  const rows = marks.map(mark => `<li><b style="color:${mark.keep ? KEEP : SWAP}">${mark.keep ? 'keep' : 'swap'}</b> — ${describeMark(mark, entry)}</li>`).join('');
  return `<p class="small">Each glyph is one operation of the measured two-colour group of <b>this</b> picture: a lens or polygon at a rotation centre, a line along a mirror, a dashed line along a glide axis, an arrow along a slide. `
    + `The two little stations on a glyph are the inks — white at twelve, black at six — and a <b style="color:${SWAP}">swap</b> draws them exchanged, a <b style="color:${KEEP}">keep</b> where they were.</p>`
    + `<ul class="small">${rows}</ul>`
    + `<p class="small">All ${entry.preserve + entry.swap} operations were found by exhaustive search over the point operations of the ${entry.lattice} lattice, all ${entry.N} × ${entry.N} node translations and all ${entry.M} time shifts, then re-checked directly on the saved bytes. At most ${MAX_MARKS} are drawn — half of them exchanging the inks and half keeping them, one per point operation and one of each kind of glyph before any is repeated — and the rest are in the table below. Where a lattice translate of a mark lands on a line already drawn, it is not drawn twice.</p>`;
}
