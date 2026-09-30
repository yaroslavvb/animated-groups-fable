// app.mjs — the page: draw the symbol, build the seed, drive the worker, plot the
// residual, then play the orbit that the search found.
import { G227, DEFAULTS, makeMesh, makeCharacter, characterStarSeed, rotationCentres, waveShells } from './core.mjs';
import { makeFieldPainter, drawResidual, symbolSvg, SITE_U_RANGE, toCartesian } from './render.mjs';

const $ = id => document.getElementById(id);
const fmt = (x, d = 3) => (x === null || x === undefined || !isFinite(x) ? '—' : Number(x).toExponential(d));
const PUBLISHED_PERIOD = 6.390159918584649;
const LOOP_SECONDS = 8;                        // the site's speed: one period per 8 s

const N = DEFAULTS.N, L = DEFAULTS.L, M = DEFAULTS.M;
const p = { a: DEFAULTS.a, b: DEFAULTS.b, Du: DEFAULTS.Du, Dv: DEFAULTS.Dv, h: L / N };
const mesh = makeMesh(N), ch = makeCharacter(G227, N), n = mesh.n;
const centres = rotationCentres(G227);

const state = {
  history: [], frames: null, playing: false, phase: 0, lastTick: 0, worker: null,
  running: false, field: null, range: 'auto', style: 'ember', overlay: true,
  result: null, harmonic: null, vortices: [],
};

// ---------------------------------------------------------------- the symbol panel
$('symbol').innerHTML = symbolSvg(centres);
$('symbolLegend').innerHTML = [0, 1, 2].map(k => {
  const c = centres.filter(x => x.k === k).length;
  const w = centres.find(x => x.k === k).predictedWinding;
  const name = k === 0 ? '3' : k === 1 ? '3₁' : '3₂';
  return `<tr><td><span class="dot k${k}"></span>${name}</td><td>τ = ${k}/3</td><td>${c} centres</td><td>winding ${w > 0 ? '+' : ''}${w}</td></tr>`;
}).join('');

// ---------------------------------------------------------------- the seed panel
const seed = characterStarSeed(ch, p, { N, L, amplitude: 0.5 });
const shells = waveShells(ch, N, L, { radius: 2 });
$('shellTable').innerHTML = shells.slice(0, 3).map((s, i) => `<tr><td>${i + 1}</td><td>${s.waves.length}</td><td>${s.surviving.length}</td><td>${s.surviving.map(w => `(${w})`).join(' ')}</td><td>${s.norms.map(x => x.toFixed(2)).join(' ')}</td></tr>`).join('');

// ---------------------------------------------------------------- canvases
const field = $('field'), plot = $('plot');
let painter = makeFieldPainter(field, N, { tiles: 2, centre: [0, 0] });
function sizeCanvases() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const [c, cap] of [[field, 520], [plot, 900]]) {
    const w = Math.max(120, Math.min(c.clientWidth, cap / dpr));
    c.width = Math.round(w * dpr);
    c.height = Math.round((c === field ? w : c.clientHeight) * dpr);
  }
  painter.invalidate();
  redrawField();
  drawResidual(plot, state.history);
}
window.addEventListener('resize', () => { requestAnimationFrame(sizeCanvases); });

const scratch = new Float32Array(n);
function fieldAt(phase) {
  if (!state.frames) return state.field;
  const t = ((phase % 1) + 1) % 1 * M, k = Math.floor(t), f = t - k;
  const a = state.frames.subarray((k % M) * n, (k % M) * n + n);
  const b = state.frames.subarray(((k + 1) % M) * n, ((k + 1) % M) * n + n);
  for (let i = 0; i < n; i++) scratch[i] = (1 - f) * a[i] + f * b[i];
  return scratch;
}
function halfPeriodDifference(phase) {
  const t = ((phase % 1) + 1) % 1 * M, k = Math.round(t) % M, h = (k + M / 2) % M;
  const a = state.frames.subarray(k * n, k * n + n), b = state.frames.subarray(h * n, h * n + n);
  for (let i = 0; i < n; i++) scratch[i] = a[i] - b[i];
  return scratch;
}

function redrawField() {
  const ctx = field.getContext('2d');
  let range = null, mono = false, data;
  if (state.style === 'mono' && state.frames) { data = halfPeriodDifference(state.phase); mono = true; }
  else {
    data = state.frames ? fieldAt(state.phase) : state.field;
    range = state.range === 'site' && state.frames ? SITE_U_RANGE : null;
  }
  if (!data) return;
  const [lo, hi] = painter.draw(data, { range, mono });
  $('rangeOut').textContent = mono ? `w > ${0.426}` : `u ∈ [${lo.toFixed(3)}, ${hi.toFixed(3)}]`;
  if (state.overlay) drawOverlay(ctx);
}

/** The nine threefold centres, and once the orbit is known the vortex charges,
 *  drawn on top of the field. */
function drawOverlay(ctx) {
  const dpr = field.width / field.clientWidth || 1;
  ctx.lineWidth = 1.2 * dpr;
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  for (const c of centres) {
    for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) {
      const [x, y] = painter.pixelOf(c.lattice[0] + du, c.lattice[1] + dv);
      if (x < -20 || y < -20 || x > field.width + 20 || y > field.height + 20) continue;
      const colour = c.k === 0 ? '#5ec8f0' : c.k === 1 ? '#ff7a3a' : '#ffe07a';
      ctx.strokeStyle = colour; ctx.fillStyle = colour;
      const r = 5 * dpr;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = (i * 120 - 90) * Math.PI / 180; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
      if (c.k) { ctx.fillText(c.k === 1 ? '−1' : '+1', x + 7 * dpr, y + 4 * dpr); }
    }
  }
}

// ---------------------------------------------------------------- the log table
function logRow(info) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${info.iteration}</td><td class="num">${fmt(info.residualRms)}</td><td class="num">${info.T.toFixed(9)}</td>`
    + `<td class="num">${info.inner}</td><td class="num">${info.step || ''}</td><td class="num">${info.flows}</td><td class="num">${info.seconds.toFixed(2)}</td>`;
  $('log').appendChild(tr);
  $('log').parentElement.scrollTop = 1e6;
}

// ---------------------------------------------------------------- run
function run() {
  if (state.running) return;
  state.running = true; state.history = []; state.frames = null; state.result = null;
  state.playing = false; $('log').innerHTML = ''; $('verdict').hidden = true;
  $('run').disabled = true; $('cancel').disabled = false;
  $('status').textContent = 'starting…';
  const amp = Number($('amp').value);
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  state.worker = worker;
  worker.onmessage = ev => handle(ev.data);
  worker.postMessage({ cmd: 'run', amp, N, M, maxiter: Number($('maxiter').value), innerMaxiter: 30, reduced: $('reduced').checked });
}

function handle(msg) {
  if (msg.type === 'setup') {
    state.field = msg.field || null;
    $('setupOut').innerHTML = `unknowns <b>${msg.unknowns}</b> (${msg.kernelOrbits} kernel orbits × 2 channels + log&nbsp;T) · RK4 step <b>${msg.dt}</b> · shooting time <b>T/${msg.order}</b>`;
    state.field = msg.seedField;
    state.range = 'auto';
    redrawField();
    $('seedOut').innerHTML = `wave (${msg.seed.wave}) · |k|² = ${msg.seed.k2.toFixed(5)} · ω = ${msg.seed.omega.toFixed(6)} · T₀ = <b>${msg.seed.T0.toFixed(6)}</b> · growth rate ${msg.seed.growth.toFixed(4)}`;
  } else if (msg.type === 'progress') {
    $('status').textContent = `searching — ${msg.flows} trajectories integrated (${(msg.rk4Steps / 1000).toFixed(0)}k RK4 steps), ${msg.seconds.toFixed(1)} s`;
  } else if (msg.type === 'step') {
    state.history.push(msg); state.field = msg.field; state.result = msg;
    logRow(msg); drawResidual(plot, state.history); redrawField();
    $('residualOut').innerHTML = `residual rms <b>${fmt(msg.residualRms)}</b> · period <b>${msg.T.toFixed(12)}</b>`;
  } else if (msg.type === 'movie') {
    state.frames = msg.frames; state.harmonic = msg.harmonic; state.vortices = msg.vortices;
    state.converged = msg.converged; state.movie = msg;
    state.range = 'site'; state.playing = true; state.lastTick = performance.now();
    $('run').disabled = false; $('cancel').disabled = true; state.running = false;
    $('status').textContent = msg.converged
      ? `converged — ${msg.solve.flows} trajectories, ${msg.solve.seconds.toFixed(2)} s`
      : `stopped at the iteration limit — residual ${fmt(msg.residualRms)} after ${msg.solve.flows} trajectories, ${msg.solve.seconds.toFixed(2)} s. `
        + `This seed does not lead Newton to an orbit; the animation below is NOT a solution.`;
    verdict(msg);
    requestAnimationFrame(tick);
  } else if (msg.type === 'cancelled') {
    state.running = false; $('run').disabled = false; $('cancel').disabled = true;
    $('status').textContent = 'cancelled';
  }
}

function verdict(msg) {
  const rel = Math.abs(msg.period - PUBLISHED_PERIOD) / PUBLISHED_PERIOD;
  const digits = Math.max(0, Math.floor(-Math.log10(rel)));
  const solved = msg.converged && rel < 1e-9;
  $('verdict').hidden = false;
  $('verdictHeading').textContent = solved
    ? '5 \u00b7 yes \u2014 this is the published orbit'
    : (msg.converged ? '5 \u00b7 converged, but to a different orbit' : '5 \u00b7 no \u2014 Newton stalled, the numbers below are not a solution');
  $('verdictOut').innerHTML = `
    <div><span>solved?</span><b>${msg.converged ? 'residual ' + fmt(msg.residualRms) + ' \u2014 yes' : 'residual ' + fmt(msg.residualRms) + ' \u2014 no, iteration limit'}</b></div>
    <div><span>period found</span><b>${msg.period.toFixed(15)}</b></div>
    <div><span>published record</span><b>${PUBLISHED_PERIOD.toFixed(15)}</b></div>
    <div><span>relative difference</span><b>${fmt(rel, 2)}</b> (${digits} digits)</div>
    <div><span>Newton iterations</span><b>${msg.iterations}</b></div>
    <div><span>trajectories integrated</span><b>${msg.solve.flows}</b> (${msg.solve.rhsCalls.toLocaleString()} right-hand sides)</div>
    <div><span>wall clock</span><b>${msg.solve.seconds.toFixed(2)} s</b> search, ${msg.total.seconds.toFixed(2)} s with the movie</div>
    <div><span>symmetry error of the movie</span><b>${fmt(msg.symmetryMax, 2)}</b> (atlas limit 2e-7)</div>
    <div><span>u range</span><b>[${msg.uRange[0].toFixed(4)}, ${msg.uRange[1].toFixed(4)}]</b> (record [0.5700, 1.9852])</div>`;
  // the magic-theorem table: predicted winding against the measured vortex charge
  const maxA = Math.max(...Array.from(msg.harmonic.re, (r, i) => Math.hypot(r, msg.harmonic.im[i])));
  $('chargeTable').innerHTML = centres.map(c => {
    const i = Math.round(c.lattice[1] * N) % N * N + Math.round(c.lattice[0] * N) % N;
    const amp = Math.hypot(msg.harmonic.re[i], msg.harmonic.im[i]) / maxA;
    const v = msg.vortices.find(v => Math.abs(v.lattice[0] - c.lattice[0]) < 1e-6 && Math.abs(v.lattice[1] - c.lattice[1]) < 1e-6);
    const measured = v ? v.charge : 0;
    const ok = measured === c.predictedWinding;
    return `<tr><td>(${(c.lattice[0] * 3).toFixed(0)}/3, ${(c.lattice[1] * 3).toFixed(0)}/3)</td><td>${c.k}/3</td>`
      + `<td>${c.predictedWinding > 0 ? '+' : ''}${c.predictedWinding}</td><td>${measured > 0 ? '+' : ''}${measured}</td>`
      + `<td class="num">${amp.toExponential(1)}</td><td>${ok ? '✓' : '✗'}</td></tr>`;
  }).join('');
}

function tick(now) {
  if (!state.playing || !state.frames) return;
  const dt = (now - state.lastTick) / 1000; state.lastTick = now;
  state.phase = (state.phase + dt / LOOP_SECONDS) % 1;
  redrawField();
  $('phaseOut').textContent = `t = ${(state.phase * (state.result ? state.result.T : 1)).toFixed(3)} of ${(state.result ? state.result.T : 0).toFixed(3)}`;
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- controls
$('run').addEventListener('click', run);
$('cancel').addEventListener('click', () => state.worker && state.worker.postMessage({ cmd: 'cancel' }));
$('play').addEventListener('click', () => {
  if (!state.frames) return;
  state.playing = !state.playing; state.lastTick = performance.now();
  $('play').textContent = state.playing ? 'pause' : 'play';
  if (state.playing) requestAnimationFrame(tick);
});
$('style').addEventListener('change', e => { state.style = e.target.value; redrawField(); });
$('overlayToggle').addEventListener('change', e => { state.overlay = e.target.checked; redrawField(); });

// initial picture: the three-wave seed
state.field = Float32Array.from(seed.seed.subarray(0, n));
$('seedOut').innerHTML = `wave (${seed.wave}) · |k|² = ${seed.k2.toFixed(5)} · ω = ${seed.omega.toFixed(6)} · T₀ = <b>${seed.T0.toFixed(6)}</b> · growth rate ${seed.growth.toFixed(4)}`;
$('setupOut').innerHTML = `unknowns <b>${2 * ch.reduction.count + 1}</b> (${ch.reduction.count} kernel orbits × 2 channels + log&nbsp;T) · shooting time <b>T/3</b>`;
sizeCanvases();
drawResidual(plot, []);
window.__live = state;        // for the headless check
