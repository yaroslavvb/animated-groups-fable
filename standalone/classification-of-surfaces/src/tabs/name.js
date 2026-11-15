// tabs/name.js — tab 4, "Examples" (pp. 104-106): the book's seven example surfaces, each to be NAMED by counting
// three things on it. "We can immediately work out the tidy form of a surface just by drawing a map on the surface
// and calculating its Euler characteristic, counting the number of boundaries, and checking whether the surface is
// orientable" (p. 105). Three probes show the counting:
//   Map         the surface's map (its vertices, edges and faces), and V - E + F
//   Boundaries  every boundary curve in a colour of its own
//   Sides       the book's pinwheel (p. 101), carried once round a loop: it comes back as it left, or mirrored
// Every number shown is counted on the map by src/examples/complex.js; nothing about a surface is typed in here but
// its caption. The symbol follows from the three numbers by Theorem 8.2, and "Show it tidy" opens it in tab 2.
//
//   #name&k=mobius            deep link to a surface
//   tab.select(key)  tab.setProbe('map' | 'rims' | 'sides', on)  tab.pin(u)  tab.progress()  tab.numbers()   for the tools

import { Scene } from '../geo/scene.js';
import { ZIP_COLORS } from '../geo/features.js';
import { THEME } from '../theme.js';
import { M, num, symbol } from '../mathbank.js';
import { SURFACES, ORDER, measure } from '../examples/surfaces.js';
import { buildMesh, edgeLine, loopLine } from '../examples/mesh.js';
import { loopPath, pinwheelAt, pathLine } from '../examples/pinwheel.js';

const PIN = ZIP_COLORS[2];          // the pinwheel and its journey: the one colour no boundary of these surfaces takes
const PROBES = ['map', 'rims', 'sides'];

// One line per surface: what the three numbers say (the book's sentence is in the citation's popover).
const CAPTIONS = {
  disk: ['One boundary, two sides: a sphere with a hole punched in it.', 105, 'it is an orientable surface with Euler characteristic 1 and one boundary'],
  annulus: ['Two boundaries, two sides: a sphere punched twice.', 105, 'is orientable, and has two boundaries; it is therefore ∗∗—a twice-punched sphere'],
  torus: ['No boundary, two sides: a sphere with one handle.', 105, 'The torus has Euler characteristic 0, is orientable, and has no boundary'],
  mobius: ['One side, so somewhere the teal has to meet the sand. A crosscap with a hole punched in it.', 105, 'is non-orientable, and has one boundary; it is ∗×, a punched crosscap'],
  klein: ['One side and no boundary: a pair of crosscaps. Teal meets sand round the base, where the tube comes back to itself from inside.', 106, 'is non-orientable, and has no boundary; it is ××, a pair of crosscaps'],
  punched: ['A half twist in the strip between the holes: one side (teal meets sand where the strip ends), and the figure-eight is a single boundary. A Möbius band with one more hole.', 106, 'This strange-looking surface is just a punched Möbius band'],
  strange: ['Three half twists, yet two sides: any round trip passes an even number of them. A torus with two holes.', 105, 'not visible at a glance but can only be ○∗∗'],
};

const css = (c) => `rgb(${c.map((x) => Math.round(255 * x)).join(',')})`;
const blend = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const NOTE = 'font-weight:500;font-size:14px;color:var(--muted)';

export function createNameTab(ctx) {
  const { stage, badge } = ctx;
  const $ = (id) => document.getElementById(id);
  const panel = document.querySelector('.panel[data-tab-only="name"]');
  const probeButtons = [...document.querySelectorAll('#probes [data-probe]')];

  // ---- what the template leaves to this module: the seven chips, the "tidy" chip, the caption line
  const chips = ORDER.map((k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.k = k; b.textContent = SURFACES[k].label;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => select(k));
    $('name-presets').append(b);
    return b;
  });
  const tidyRow = document.createElement('div');
  tidyRow.className = 'row';
  const tidy = document.createElement('button');
  tidy.type = 'button'; tidy.className = 'chip'; tidy.id = 'name-tidy'; tidy.textContent = 'Show it tidy';
  tidy.addEventListener('click', () => ctx.goTidy({ ...cur.m.counts }));
  tidyRow.append(tidy);
  const pieces = document.createElement('button');
  pieces.type = 'button'; pieces.className = 'chip'; pieces.id = 'name-pieces'; pieces.textContent = 'Zip it up from its pieces';
  pieces.addEventListener('click', () => ctx.goProve(key));
  tidyRow.append(pieces);
  const cap = document.createElement('p');
  cap.className = 'name-cap';
  cap.style.cssText = 'margin:0;font-size:15px;line-height:1.4;color:var(--muted)';
  cap.setAttribute('aria-live', 'polite');
  for (const k of ORDER) {
    const [words, page, quote] = CAPTIONS[k], s = document.createElement('span'), a = document.createElement('a');
    s.dataset.k = k; s.hidden = true; s.textContent = words + ' ';
    a.className = 'bk'; a.dataset.p = String(page); a.dataset.q = quote; a.textContent = 'p. ' + page;   // bookref.js wires it at start-up
    s.append(a); cap.append(s);
  }
  panel.append(tidyRow, cap);

  // ---- state
  let key = ORDER[0], active = false, cur = null;
  const probes = { map: false, rims: false, sides: false };
  const seen = Object.fromEntries(ORDER.map((k) => [k, new Set()]));     // probes tried on each surface so far
  const pin = { u: 0, cancel: null, timer: 0 };
  const built = new Map();

  /** A surface's map, mesh and lines; made once. */
  function prepare(k) {
    if (built.has(k)) return built.get(k);
    const m = measure(k), { cx } = m, mesh = buildMesh(cx, m.paint.sign), path = loopPath(cx, m.loop);
    const used = new Set();
    for (const f of cx.faces) for (const s of f.sides) if (s) { used.add(s.from); used.add(s.to); }
    const out = {
      m, mesh, path,
      inner: cx.edges.filter((e) => e.uses.length === 2).map((e) => edgeLine(cx, e)),      // the map's edges inside the surface
      rims: m.boundaries.map((loop) => loopLine(cx, loop)),                                // one closed line per boundary
      dots: [...used].map((v) => cx.verts[v].p),
      journey: pathLine(path), start: pinwheelAt(path, 0, m.def.mark),
    };
    built.set(k, out);
    return out;
  }

  function lines() {
    const out = [], mapInk = blend(THEME.soft, THEME.ink, 0.5);
    if (probes.map) for (const points of cur.inner) out.push({ points, color: mapInk, width: 1.5, xray: 0.5 });
    cur.rims.forEach((points, i) => out.push(probes.rims
      ? { points, color: ZIP_COLORS[i % ZIP_COLORS.length], width: 3.6, loop: true, xray: 0.5 }
      : { points, color: THEME.ink, width: 1.7, loop: true, xray: 0.4 }));
    if (probes.sides) {
      const size = cur.m.def.mark;
      out.push({ points: cur.journey, color: PIN, width: 1.4, alpha: 0.6, dashed: true, loop: true, xray: 0.5 });
      // the copy left at the start, thin and dark; the traveller, bold, is drawn over it: home again it either
      // covers the copy or shows as its mirror image
      out.push({ points: cur.start, color: THEME.ink, width: 1.5, alpha: 0.6, xray: 0.5 });
      out.push({ points: pinwheelAt(cur.path, cur.path.index(pin.u), size), color: PIN, width: 3, xray: 0.6 });
    }
    return out;
  }
  function markers() {
    const out = [];
    if (probes.map) for (const p of cur.dots) out.push({ p, color: THEME.ink, size: 5.5, shape: 'dot' });
    return out;
  }

  function build() {
    cur = prepare(key);
    const scene = new Scene(), { positions, indices } = cur.mesh;
    scene.alloc(positions.length / 3);
    for (let t = 0; t < indices.length; t += 3) scene.tri(indices[t], indices[t + 1], indices[t + 2]);
    scene.onUpdate((P) => P.set(positions));            // the paper does not move; only the lines on it change
    scene.addLines(lines);
    scene.addMarkers(markers);
    stage.setScene(scene, cur.m.def.frame);
    stage.R.setView(cur.m.def.view);
    stage.R.render();
  }

  // ---- the readouts
  function readout() {
    pieces.hidden = !(key === 'strange' || key === 'punched');      // the two that tab 3 builds from their pieces
    const { m } = cur;
    for (const p of PROBES) if (probes[p]) seen[key].add(p);
    const counted = seen[key].size === PROBES.length;              // the symbol goes on the stage once all three have been looked at
    badge.innerHTML = `${counted ? `<span class="badge-sym">${symbol(m.counts)}</span>` : ''}<span class="badge-name">${m.def.label}</span>`;
    // with the map on: the three counts, each under its letter
    const over = [M('V'), M('minus'), M('E'), M('plus'), M('F'), M('eq'), M('chi')].map((h) => `<span style="${NOTE}">${h}</span>`).join('');
    const under = [num(m.V), M('minus'), num(m.E), M('plus'), num(m.F), M('eq'), num(m.chi)].map((h) => `<span>${h}</span>`).join('');
    $('name-chi').innerHTML = probes.map
      ? `<span style="display:inline-grid;grid-template-columns:repeat(7,auto);gap:1px 0.3em;justify-items:center;align-items:baseline">${over}${under}</span>`
      : `${M('chi')} ${M('eq')} ${num(m.chi)}`;
    const dots = probes.rims ? m.boundaries.map((_, i) => `<span aria-hidden="true" style="display:inline-block;width:10px;height:10px;margin-right:5px;border-radius:50%;background:${css(ZIP_COLORS[i % ZIP_COLORS.length])}"></span>`).join('') : '';
    $('name-b').innerHTML = m.b ? dots + num(m.b) : 'none';
    const back = probes.sides ? ` <span style="${NOTE}">· comes back ${cur.path.turned < 0 ? 'mirrored' : 'the same'}</span>` : '';
    $('name-sides').innerHTML = (m.orientable ? 'two' : 'one') + back;
    $('name-sym').innerHTML = `${symbol(m.counts)} <span style="${NOTE}">${m.def.name}</span>`;
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.k === key));
    for (const b of probeButtons) b.setAttribute('aria-pressed', String(!!probes[b.dataset.probe]));
    for (const s of cap.children) s.hidden = s.dataset.k !== key;
    ctx.changed();
  }

  // ---- the pinwheel's journey: once round, a pause to compare it with the copy it left, and again
  function stopPin() {
    if (pin.cancel) { pin.cancel(); pin.cancel = null; }
    clearTimeout(pin.timer); pin.timer = 0;
  }
  function lap() {
    stopPin();
    if (!active || !probes.sides) return;
    if (stage.R.reducedMotion) { pin.u = 1; stage.refresh(); return; }       // no motion: the pinwheel home again, on its copy
    pin.u = 0;
    const seconds = Math.min(9, Math.max(5, 1.5 * cur.path.length));
    // slow away from the start and slow home again
    pin.cancel = stage.animate(seconds, (u) => { pin.u = u - (0.6 * Math.sin(2 * Math.PI * u)) / (2 * Math.PI); }, () => { pin.cancel = null; pin.timer = setTimeout(lap, 1600); });
  }

  function select(k) {
    if (!SURFACES[k]) return;
    stopPin();
    key = k; pin.u = 0;
    if (!active) return;
    build();
    readout();
    lap();
  }
  function setProbe(name, on) {
    if (!(name in probes)) return;
    probes[name] = on === undefined ? !probes[name] : !!on;
    if (!active) return;
    readout();
    if (name === 'sides') { pin.u = 0; lap(); }
    stage.refresh();
  }
  for (const b of probeButtons) b.addEventListener('click', () => setProbe(b.dataset.probe));

  return {
    enter() { active = true; select(key); },
    leave() { active = false; stopPin(); },
    when() { return 'name:' + key; },
    get() { return { k: key }; },
    // k: the surface; p (optional, for the tools): the probes that are on, as letters of "mrs"
    set(s) {
      if (s.k && SURFACES[s.k]) key = s.k;
      if (typeof s.p === 'string') { probes.map = s.p.includes('m'); probes.rims = s.p.includes('r'); probes.sides = s.p.includes('s'); }
    },
    select, setProbe,
    /** Hold the pinwheel at the fraction u of its journey (1: home again); progress(): where it is now. */
    pin(u) { stopPin(); pin.u = u; stage.refresh(); },
    progress: () => pin.u,
    numbers: () => { const { m } = prepare(key); return { key, V: m.V, E: m.E, F: m.F, chi: m.chi, b: m.b, sides: m.orientable ? 2 : 1, counts: m.counts, turned: prepare(key).path.turned }; },
  };
}
