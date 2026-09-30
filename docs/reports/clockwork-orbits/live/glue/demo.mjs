// demo.mjs — the embeddable delayed-glue demonstration.
//
//   import { mountGlueDemo } from './live/glue/demo.mjs';
//   mountGlueDemo(document.querySelector('#glue'));
//
// Builds its own markup inside the element it is given and styles itself from the page's
// CSS custom properties (--c1, --c2, --c4, --ink, --ink-2, --muted, --grid, --axis,
// --surface, --page), so it looks right in both the light and the dark theme.

import { buildGlue, G227, PUBLISHED_PERIOD } from './glue.mjs';
import { drawDomain, domainStats } from './domain.mjs';
import { rotationCentres, DEFAULTS } from '../newton/core.mjs';
import { makeFieldPainter, SITE_U_RANGE } from '../newton/render.mjs';

const CSS = `
.glue-demo { margin: 14px 0 6px; }
.glue-demo .glue-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); }
.glue-demo figure { margin: 0; background: var(--surface); border: 1px solid var(--border, var(--grid)); border-radius: 12px; padding: 12px; }
.glue-demo figure h4 { margin: 0 0 8px; font-size: 0.82rem; letter-spacing: 0.02em; color: var(--ink-2); font-weight: 600; }
.glue-demo canvas { display: block; width: 100%; border-radius: 8px; }
.glue-demo canvas.field { aspect-ratio: 1 / 1; height: auto; background: #12091f; }
.glue-demo canvas.plot { height: 132px; }
.glue-demo figcaption { color: var(--ink-2); font-size: 0.8rem; margin-top: 8px; line-height: 1.5; }
.glue-demo .glue-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.78rem; color: var(--ink-2); margin-top: 8px; }
.glue-demo .glue-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; vertical-align: -1px; margin-right: 5px; }
.glue-demo .glue-controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 14px 0 8px; }
.glue-demo .glue-controls button { font: inherit; font-size: 0.86rem; border-radius: 999px; padding: 7px 16px; min-height: 36px; cursor: pointer;
  background: var(--ink); color: var(--page); border: 1px solid var(--ink); font-weight: 600; }
.glue-demo .glue-controls button.ghost { background: var(--surface); color: var(--ink-2); border-color: var(--border, var(--grid)); font-weight: 400; }
.glue-demo .glue-controls button:disabled { opacity: 0.42; cursor: default; }
.glue-demo .glue-controls label { font-size: 0.82rem; color: var(--ink-2); display: inline-flex; gap: 6px; align-items: center; }
.glue-demo .glue-controls select { font: inherit; font-size: 0.82rem; background: var(--surface); color: var(--ink); border: 1px solid var(--border, var(--grid));
  border-radius: 8px; padding: 6px 8px; min-height: 36px; }
.glue-demo .glue-status { font-size: 0.88rem; color: var(--ink); margin: 6px 0; min-height: 1.5em; font-variant-numeric: tabular-nums; }
.glue-demo .glue-result { margin-top: 10px; }
.glue-demo .glue-result table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
.glue-demo .glue-result th, .glue-demo .glue-result td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--grid); }
.glue-demo .glue-result th { color: var(--ink-2); font-weight: 600; }
.glue-demo .glue-result td.num, .glue-demo .glue-result th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.glue-demo .glue-found { font-size: 1rem; font-weight: 600; margin: 10px 0 4px; }
.glue-demo .glue-found b { font-variant-numeric: tabular-nums; }
.glue-demo .ok { color: var(--ok, var(--c3)); }
.glue-demo .bad { color: var(--bad, var(--c2)); }
.glue-demo .table-wrap { overflow-x: auto; }
@media (max-width: 430px) {
  .glue-demo figure { padding: 10px; }
  .glue-demo .glue-result table { font-size: 0.76rem; }
}
`;

function injectCss() {
  if (document.getElementById('glue-demo-css')) return;
  const s = document.createElement('style');
  s.id = 'glue-demo-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

function readColours(el) {
  const cs = getComputedStyle(el);
  const g = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
  return {
    c1: g('--c1', '#2a78d6'), c2: g('--c2', '#eb6834'), c3: g('--c3', '#1baf7a'),
    c4: g('--c4', '#eda100'), c5: g('--c5', '#e87ba4'), c7: g('--c7', '#4a3aa7'),
    ink: g('--ink', '#0b0b0b'), ink2: g('--ink-2', '#52514e'), muted: g('--muted', '#898781'),
    grid: g('--grid', '#e1e0d9'), axis: g('--axis', '#c3c2b7'),
    surface: g('--surface', '#fcfcfb'), page: g('--page', '#f9f9f7'),
  };
}

const fmt = (x, d = 3) => (x == null || !isFinite(x) ? '—' : x.toExponential(d));

// ------------------------------------------------------------------ small line plots

function drawPlot(canvas, series, colours, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 300, cssH = parseInt(canvas.style.height) || 132;
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const pad = { l: 46, r: 8, t: 10, b: 20 };
  const xs = series.map(p => p.x), ys = series.map(p => p.y);
  const log = !!opts.log;
  let ymin = opts.ymin, ymax = opts.ymax;
  if (ymin == null) ymin = ys.length ? Math.min(...ys) : 0;
  if (ymax == null) ymax = ys.length ? Math.max(...ys) : 1;
  if (opts.reference != null) { ymin = Math.min(ymin, opts.reference); ymax = Math.max(ymax, opts.reference); }
  if (log) { ymin = Math.log10(Math.max(ymin, 1e-14)); ymax = Math.log10(Math.max(ymax, 1e-13)); }
  if (ymax - ymin < 1e-12) { ymax = ymin + 1e-12; }
  const padY = (ymax - ymin) * 0.10; ymin -= padY; ymax += padY;
  const xmin = 0, xmax = Math.max(opts.xmax || 0, xs.length ? Math.max(...xs) : 1, 4);
  const X = v => pad.l + (cssW - pad.l - pad.r) * (v - xmin) / (xmax - xmin || 1);
  const Y = v => pad.t + (cssH - pad.t - pad.b) * (1 - ((log ? Math.log10(Math.max(v, 1e-14)) : v) - ymin) / (ymax - ymin));

  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.strokeStyle = colours.grid; ctx.fillStyle = colours.muted; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const v = ymin + (ymax - ymin) * i / 3, y = pad.t + (cssH - pad.t - pad.b) * (1 - i / 3);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    const label = log ? `1e${Math.round(v)}` : (opts.tick ? opts.tick(v) : v.toFixed(3));
    ctx.fillText(label, 3, y + 3.5);
  }
  ctx.strokeStyle = colours.axis;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, cssH - pad.b); ctx.stroke();
  ctx.fillStyle = colours.ink2;
  ctx.fillText(opts.xlabel || 'periods', pad.l + 2, cssH - 6);

  if (opts.reference != null) {
    ctx.strokeStyle = colours.c3; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, Y(opts.reference)); ctx.lineTo(cssW - pad.r, Y(opts.reference)); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!series.length) return;
  ctx.strokeStyle = opts.colour || colours.c2; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  series.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
  ctx.stroke();
  ctx.fillStyle = opts.colour || colours.c2;
  const lastP = series[series.length - 1];
  ctx.beginPath(); ctx.arc(X(lastP.x), Y(lastP.y), 2.6, 0, 7); ctx.fill();
}

// ------------------------------------------------------------------ the demo

export function mountGlueDemo(root, opts = {}) {
  injectCss();
  root.classList.add('glue-demo');
  const N = DEFAULTS.N;
  root.innerHTML = `
  <div class="glue-grid">
    <figure>
      <h4>the fundamental domain and its glue</h4>
      <canvas class="domain"></canvas>
      <div class="glue-legend">
        <span><i style="background:var(--ink)"></i>integrated (<b class="nrep">146</b>)</span>
        <span><i style="background:var(--c1)"></i>copied now (<b class="ninst">290</b>)</span>
        <span><i style="background:var(--c2)"></i>read at t − T/3 (<b class="nd1">430</b>)</span>
        <span><i style="background:var(--c4)"></i>read at t − 2T/3 (<b class="nd2">430</b>)</span>
      </div>
      <figcaption class="domaincap"></figcaption>
    </figure>
    <figure>
      <h4>the whole pattern, rebuilt through the glue</h4>
      <canvas class="field"></canvas>
      <figcaption class="fieldcap">Two lattice cells of the <i>u</i> channel in the site's ember colours.
      Nothing is being copied from a stored answer: every node outside the domain is either a
      neighbour's value now, or its value a third or two thirds of a period ago.</figcaption>
    </figure>
  </div>
  <div class="glue-controls">
    <button class="start">Start from noise</button>
    <button class="stop ghost" disabled>Stop</button>
    <label>seed <select class="seed"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
    <label>speed <select class="speed">
      <option value="7">slow</option>
      <option value="14" selected>normal</option>
      <option value="56">fast</option>
      <option value="336">as fast as it will go</option>
    </select></label>
    <label><input type="checkbox" class="polish" checked> finish with Newton</label>
  </div>
  <p class="glue-status">Press <b>Start from noise</b>. The delay begins at the Hopf period
    <b>6.355088</b> and is corrected once per period.</p>
  <div class="glue-grid">
    <figure>
      <h4>the delay T</h4>
      <canvas class="plot delayplot" style="height:132px"></canvas>
      <figcaption>Green dashed: the published period <b>6.390159918584649</b>. The delay is
      never told what it should be; it is measured off the state once per period.</figcaption>
    </figure>
    <figure>
      <h4>rms | q(t) − q(t − T) |</h4>
      <canvas class="plot driftplot" style="height:132px"></canvas>
      <figcaption>How far the domain is from repeating after one delay. On a log axis it
      falls as a straight line — a fixed factor per period.</figcaption>
    </figure>
  </div>
  <div class="glue-result"></div>`;

  const $ = s => root.querySelector(s);
  const colours = readColours(root);
  const glue = buildGlue(G227, N);
  const centres = rotationCentres(G227);
  const stats = domainStats(glue);
  $('.nrep').textContent = stats.representatives;
  $('.ninst').textContent = stats.instant;
  $('.nd1').textContent = stats.third;
  $('.nd2').textContent = stats.twoThirds;
  $('.domaincap').innerHTML =
    `<b>${stats.representatives}</b> of the <b>${glue.n}</b> mesh nodes are integrated — one ninth of the
     drawn cell, a reduction of <b>${stats.reductionFactor.toFixed(3)}×</b>. The stubs on the boundary are the
     glued edges: <b>${stats.bonds[0]}</b> of them read a neighbour at the same instant,
     <b>${stats.bonds[1]}</b> read the domain as it was <b>T/3</b> ago and <b>${stats.bonds[2]}</b> as it was
     <b>2T/3</b> ago. The three marked corners are the cone points of the <b>333</b> orbifold; their
     labels <b>3</b>, <b>3₁</b>, <b>3₂</b> are the clockwork symbol <b>r33₁3₂</b> itself.`;

  const domainCanvas = $('.domain'), fieldCanvas = $('.field');
  let painter = makeFieldPainter(fieldCanvas, N, { tiles: 2, centre: [0, 0] });

  function sizeField() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(160, Math.round((fieldCanvas.clientWidth || 300) * dpr));
    if (fieldCanvas.width !== w) { fieldCanvas.width = w; fieldCanvas.height = w; painter.invalidate(); }
  }
  function redrawDomain() { drawDomain(domainCanvas, glue, readColours(root), { centres }); }
  sizeField(); redrawDomain();

  let field = new Float32Array(N * N);
  let uLo = SITE_U_RANGE[0], uHi = SITE_U_RANGE[1], haveField = false;
  function paintField() {
    sizeField();
    if (haveField) painter.draw(field, { range: [uLo, uHi] });
  }

  let delaySeries = [], driftSeries = [];
  function redrawPlots() {
    const c = readColours(root);
    drawPlot($('.delayplot'), delaySeries, c, {
      reference: PUBLISHED_PERIOD, colour: c.c2, xmax: 32,
      tick: v => v.toFixed(3),
    });
    drawPlot($('.driftplot'), driftSeries, c, { log: true, colour: c.c1, xmax: 32 });
  }
  redrawPlots();

  let worker = null, running = false;
  const state = { last: null, polished: null, assembled: null, setup: null, errors: [] };
  root.glueState = state;                     // for tests

  const status = $('.glue-status'), result = $('.glue-result');

  function setRunning(on) {
    running = on;
    $('.start').disabled = on;
    $('.stop').disabled = !on;
    $('.seed').disabled = on; $('.speed').disabled = on; $('.polish').disabled = on;
  }

  function start() {
    if (worker) worker.terminate();
    delaySeries = []; driftSeries = []; haveField = false;
    state.last = null; state.polished = null; state.assembled = null; state.errors = [];
    result.innerHTML = '';
    redrawPlots();
    worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
    worker.onerror = e => { state.errors.push(String(e.message || e)); status.textContent = 'worker error: ' + (e.message || e); setRunning(false); };
    worker.onmessage = ev => onMessage(ev.data);
    setRunning(true);
    status.innerHTML = 'starting from white noise on the <b>146</b>-node domain…';
    worker.postMessage({
      cmd: 'run', seed: Number($('.seed').value), tol: opts.tol ?? 1e-5,
      stepsPerChunk: Number($('.speed').value), polish: $('.polish').checked,
    });
  }

  function onMessage(msg) {
    if (msg.type === 'error') { state.errors.push(msg.message); status.textContent = 'error: ' + msg.message; setRunning(false); return; }
    if (msg.type === 'setup') { state.setup = msg; return; }
    if (msg.type === 'frame') {
      field = msg.field; haveField = true; state.frame = msg;
      // smooth the colour range so the picture does not flicker while the pattern grows
      const [lo, hi] = msg.uRange;
      uLo = uLo * 0.85 + lo * 0.15; uHi = uHi * 0.85 + hi * 0.15;
      paintField();
      if (msg.delays) {
        delaySeries = msg.delays.filter(d => d.periods > 0).map(d => ({ x: d.periods, y: d.T }));
        driftSeries = msg.drift.map(d => ({ x: d.periods, y: Math.max(d.driftRms, 1e-14) }));
        redrawPlots();
      }
      const d = msg.delays ? msg.delays[msg.delays.length - 1] : null;
      status.innerHTML = `period <b>${msg.periods}</b> · t = <b>${msg.t.toFixed(1)}</b> · delay T = <b>${msg.T.toFixed(9)}</b>`
        + (d && d.deltaT != null ? ` · last change <b>${fmt(d.deltaT, 2)}</b>` : '')
        + ` · <b>${msg.rhsCalls.toLocaleString('en-GB')}</b> right-hand sides · <b>${msg.seconds.toFixed(1)} s</b>`;
      // one drawn frame per animation frame: ask the worker for the next one
      const w = worker;
      requestAnimationFrame(() => { if (w === worker && running) w.postMessage({ cmd: 'ack' }); });
      return;
    }
    if (msg.type === 'assembled') {
      state.assembled = msg;
      uLo = SITE_U_RANGE[0]; uHi = SITE_U_RANGE[1]; paintField();
      showAssembled(msg);
      if (!$('.polish').checked) setRunning(false);
      return;
    }
    if (msg.type === 'newton') {
      state.last = msg;
      status.innerHTML = `Newton step <b>${msg.iteration}</b> · residual <b>${fmt(msg.residualRms, 2)}</b> · T = <b>${msg.T.toFixed(12)}</b>`;
      return;
    }
    if (msg.type === 'polished') { state.polished = msg; showPolished(msg); return; }
    if (msg.type === 'end' || msg.type === 'cancelled') { setRunning(false); return; }
  }

  function showAssembled(m) {
    const rel = m.relativePeriodError;
    const rows = m.centres.map(c => `<tr>
      <td><b>${['3', '3₁', '3₂'][c.k]}</b> at (${c.lattice.map(v => Math.round(v * 3)).join(',')})/3</td>
      <td class="num">${c.k}/3</td><td class="num">${c.predicted > 0 ? '+' : ''}${c.predicted}</td>
      <td class="num">${c.measured > 0 ? '+' : ''}${c.measured}</td>
      <td class="num">${fmt(c.relativeAmplitude, 1)}</td>
      <td class="num ${c.agrees ? 'ok' : 'bad'}">${c.agrees ? '✓' : '✗'}</td></tr>`).join('');
    result.innerHTML = `
      <p class="glue-found">period found: <b>${m.T.toFixed(12)}</b></p>
      <p class="small" style="color:var(--ink-2);font-size:0.85rem;margin:0 0 10px">
        published <b>${PUBLISHED_PERIOD}</b> · difference <b>${(m.T - PUBLISHED_PERIOD).toExponential(3)}</b>
        (relative <b>${rel.toExponential(3)}</b>) · <b>${m.periods}</b> periods of forward simulation,
        <b>${m.rhsCalls.toLocaleString('en-GB')}</b> right-hand sides on <b>146</b> nodes,
        <b>${m.seconds.toFixed(1)} s</b>. Stopped because the delay moved by less than
        <b>${fmt(m.lastDeltaT, 1)}</b> twice running. No Newton step has been taken yet.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>centre</th><th class="num">offset</th>
        <th class="num">forced winding</th>
        <th class="num">measured</th><th class="num">|Â| / max</th><th class="num"></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p style="color:var(--ink-2);font-size:0.85rem;margin-top:8px">
        Positions are given in thirds of the simulation cell.
        <b>${m.vortices}</b> charged cores in the box, total charge <b>${m.totalCharge}</b> — the six the
        symbol forces, and no others. The windings are
        measured on an unprojected RK4 replay of the state the glue ended on — they were never
        imposed. Symmetry error of that replay: <b>${fmt(m.symmetryMaxRaw, 2)}</b>.</p>
      <div class="newtonbox"></div>`;
  }

  function showPolished(m) {
    const box = root.querySelector('.newtonbox');
    if (!box) return;
    box.innerHTML = `<p class="glue-found" style="margin-top:14px">after <b>${m.iterations}</b> Newton
      steps: <b>${m.T.toFixed(15)}</b></p>
      <p style="color:var(--ink-2);font-size:0.85rem;margin:0">
        published <b>${PUBLISHED_PERIOD}</b> · difference <b>${(m.T - PUBLISHED_PERIOD).toExponential(3)}</b>
        (relative <b>${m.relativePeriodError.toExponential(3)}</b>) · shooting residual
        <b>${fmt(m.residualRms, 2)}</b> · <b>${m.rhsCalls.toLocaleString('en-GB')}</b> right-hand sides on the
        full torus, <b>${m.seconds.toFixed(1)} s</b>.</p>`;
    status.innerHTML = `done — period <b>${m.T.toFixed(15)}</b>`;
  }

  $('.start').addEventListener('click', start);
  $('.stop').addEventListener('click', () => { if (worker) worker.postMessage({ cmd: 'cancel' }); });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { painter.invalidate(); redrawDomain(); redrawPlots(); paintField(); }, 120);
  });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { redrawDomain(); redrawPlots(); });
  }

  return { start, stop: () => worker && worker.postMessage({ cmd: 'cancel' }), state, glue, stats };
}
