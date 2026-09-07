import {createWallpaperCatalog,MODELS} from './wallpaper-atlas.mjs?v=20260907-equations';
import {createWallpaperPlayer} from './wallpaper-playback.mjs?v=20260907-equations';
import {makeWallpaperCellView} from './wallpaper-cell.mjs?v=20260907-equations';
import {renderWallpaperOverlay,wallpaperGeneratorPlacements,wallpaperOperationLabel} from './wallpaper-overlay.mjs?v=20260907-local-motion';
import {readViewState,writeViewHash} from './view-state.mjs?v=20260907-generator-direction';
import {createLocalMotionCatalog,localMotionCentreKey} from './local-motion.mjs?v=20260907-local-motion';

const VERSION = '20260907-equations';
const root = new URL('./', import.meta.url);
const $ = id => document.getElementById(id);
const familyId = $('family-nav').dataset.family;
const mod = value => ((value % 1) + 1) % 1;
const star = text => String(text).replace(/\*/g, '∗');
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const scientific = value => Number.isFinite(value) ? value.toExponential(2) : '—';
const fixed = value => Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : '—';
/** How each equation is named, written and charted. The catalog validates the parameters. */
const EQUATIONS = {
  'gray-scott': {name: 'Gray–Scott', axes: ['F', 'k'], labels: {F: 'F', k: 'k', Du: 'Dᵤ', Dv: 'Dᵥ'}, channels: ['U', 'V'],
    equation: 'uₜ = Dᵤ∇²u − uv² + F(1 − u)\nvₜ = Dᵥ∇²v + uv² − (F + k)v'},
  'ginzburg-landau': {name: 'Ginzburg–Landau', axes: ['alpha', 'beta'], labels: {alpha: 'α', beta: 'β', D: 'D'}, channels: ['Re A', 'Im A'],
    equation: 'Aₜ = A + (1 + iα)D∇²A − (1 − iβ)|A|²A,  A = u + iv'},
  'brusselator': {name: 'Brusselator', axes: ['b', 'a'], labels: {a: 'a', b: 'b', Du: 'Dᵤ', Dv: 'Dᵥ'}, channels: ['U', 'V'],
    equation: 'uₜ = Dᵤ∇²u + a − (b + 1)u + u²v\nvₜ = Dᵥ∇²v + bu − u²v'},
};
const MODEL_ORDER = Object.keys(EQUATIONS);
const PROVENANCE = {'new-shooting': 'Gray–Scott shooting result', 'audited-subgroup': 're-audited saved Gray–Scott field', 'equation-search': 'equation search result'};
const spec = model => MODELS[model] ?? MODELS['gray-scott'];
const parameterKey = config => JSON.stringify([config.model ?? 'gray-scott', ...spec(config.model ?? 'gray-scott').parameters.map(name => config.params[name]), config.L ?? config.N * config.params.dx, config.params.stencil]);
const parameterText = (config, names) => names.map(name => `${EQUATIONS[config.model ?? 'gray-scott'].labels[name] ?? name} ${fixed(config.params[name])}`).join(' · ');
const patternLabel = record => `${record.patternName ?? record.name ?? 'Periodic wave'} · T ${record.config.period.toFixed(2)} · ${record.config.N}²`;
let family, groups, manifest, catalog, group, record, player, cellView;
let motionCatalog = null, motionState = 'loading';
let selectedId = null, selectedKey = null, generatorName = null, modelId = null, lastBackend = null;
let phase = 0, playing = false, lastTime = 0, selectionToken = 0, mapGeometry;
let requestedPlayback = {phase: 0, play: true};
const remembered = new Map();
const entries = () => catalog?.summaries(group?.id) ?? [];
const modelEntries = model => entries().filter(item => item.model === model);
const modelsPresent = () => MODEL_ORDER.filter(model => modelEntries(model).length);
const selectedGenerator = () => group?.namedGenerators.find(item => item.name === generatorName?.split('@')[0]) ?? group?.namedGenerators[0];

function syncUrl() {
  if (!group) return;
  history.replaceState(null, '', writeViewHash({groupId: group.id, patternId: selectedId,
    palette: $('palette').value, tiles: +$('tiles').value, framing: $('framing').value,
    speed: +$('speed').value, generator: generatorName, overlay: $('show-generators').checked,
    approximate: false, ...(record ? {phase, play: playing} : requestedPlayback)}));
}

function parameterSets(model = modelId) {
  const sets = new Map();
  for (const summary of modelEntries(model)) {
    const key = parameterKey(summary.config);
    if (!sets.has(key)) sets.set(key, {key, config: summary.config, patterns: []});
    sets.get(key).patterns.push(summary);
  }
  const [x, y] = EQUATIONS[model]?.axes ?? ['F', 'k'];
  return [...sets.values()].sort((a, b) => b.patterns.length - a.patterns.length || a.config.params[x] - b.config.params[x] || a.config.params[y] - b.config.params[y] || a.config.L - b.config.L);
}

function setPlaying(value) {
  playing = !!record && !!value;
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}

function controls() {
  for (const id of ['play', 'rewind', 'phase', 'export']) $(id).disabled = !record;
  $('parameter-set').disabled = !modelEntries(modelId).length;
  $('solution').disabled = !modelEntries(modelId).length;
  $('show-generators').disabled = !record;
  $('operation').disabled = !record;
}

function engineLabel() {
  const backend = player?.backend ?? null;
  if (backend === lastBackend) return;
  lastBackend = backend;
  $('engine-label').textContent = record && backend ? `${backend} · ${record.config.N}² × ${record.config.M} · T ${record.config.period.toFixed(2)}` : 'No orbit loaded';
}

function empty({loading = false, error = null} = {}) {
  player?.dispose(); player = null; record = null; cellView = null; setPlaying(false);
  $('gpu-pattern').hidden = true; $('pattern').hidden = false; $('empty-state').hidden = false;
  $('generator-overlay').toggleAttribute('hidden', true); $('generator-overlay').replaceChildren();
  $('cell-guide').toggleAttribute('hidden', true); $('cell-guide').replaceChildren();
  $('pattern').style.clipPath = ''; $('gpu-pattern').style.clipPath = '';
  document.querySelector('.canvas-wrap').classList.remove('cell-framing');
  const zeroOffset = group && !group.hasTimeShift;
  $('empty-state').querySelector('h2').textContent = loading ? 'Loading saved animation…' : error ? 'Animation unavailable' : zeroOffset ? 'Zero-offset symmetry' : 'No verified pattern yet';
  $('empty-description').textContent = loading ? 'Downloading the saved field.' : error ? error : zeroOffset ? 'This symmetry type has no nonzero time shift.' : 'No candidate has passed verification for this time symmetry and equation. Existence remains unresolved.';
  $('retry-animation').hidden = !error;
  $('mode-label').textContent = loading ? 'Loading saved animation' : error ? 'Download failed' : zeroOffset ? 'No time offset' : 'Existence unresolved';
  engineLabel(); $('phase-label').textContent = '—'; $('phase').value = 0;
  $('display-range').textContent = ''; $('scale-label').textContent = '';
  $('caption').textContent = error ?? (zeroOffset ? 'No nonzero time-shift example is assigned to this entry.' : 'Only accepted numerical solutions are displayed.');
  for (const id of ['pde', 'symmetry', 'motion', 'return']) $(id).textContent = '—';
  const context = $('pattern').getContext('2d'); context.fillStyle = '#271337'; context.fillRect(0, 0, $('pattern').width, $('pattern').height);
  controls();
}

function renderGroups() {
  $('groups').style.setProperty('--group-count', groups.length);
  $('groups').replaceChildren(...groups.map(item => {
    const button = document.createElement('button'); button.className = 'group'; button.type = 'button';
    button.dataset.groupId = item.id; button.setAttribute('aria-pressed', String(item.id === group?.id));
    const name = document.createElement('strong'); name.textContent = star(item.signature);
    const count = document.createElement('span'); count.textContent = plural(catalog.size(item.id), 'pattern');
    button.append(name, count); button.title = `${item.id} · ${item.phaseOrder === 1 ? 'no time offset' : `${item.phaseOrder} phases`}`;
    button.onclick = () => chooseGroup(item.id, {user: true}); return button;
  }));
}

function renderEquations() {
  $('equations').replaceChildren(...MODEL_ORDER.map(model => {
    const count = modelEntries(model).length, button = document.createElement('button');
    button.type = 'button'; button.className = 'equation'; button.dataset.model = model; button.disabled = !count;
    button.setAttribute('aria-pressed', String(model === modelId));
    const small = document.createElement('small'); small.textContent = count ? plural(count, 'pattern') : 'none';
    button.append(EQUATIONS[model].name, small); button.title = EQUATIONS[model].equation.replace('\n', '; ');
    button.onclick = () => chooseModel(model, {user: true}); return button;
  }));
  $('equation-description').textContent = modelId ? EQUATIONS[modelId].equation : '';
}

function populateSelectors() {
  const sets = parameterSets(), selectedSet = sets.find(set => set.key === selectedKey), patterns = selectedSet?.patterns ?? [];
  const names = modelId ? spec(modelId).parameters : [];
  $('parameter-set').replaceChildren(...(sets.length ? sets.map(set => {
    const option = document.createElement('option'); option.value = set.key;
    option.textContent = `${parameterText(set.config, names.slice(0, 2))} · L ${fixed(set.config.L)} · ${plural(set.patterns.length, 'pattern')}`;
    option.selected = set.key === selectedKey; return option;
  }) : [new Option('No verified parameters', '')]));
  $('parameter-values').textContent = selectedSet ? `${parameterText(selectedSet.config, names)} · L ${fixed(selectedSet.config.L)}` : 'No verified parameter sets';
  $('solution').replaceChildren(...(patterns.length ? patterns.map(item => {
    const option = new Option(patternLabel(item), item.id); option.selected = item.id === selectedId; return option;
  }) : [new Option('No verified patterns', '')]));
  $('pattern-thumbnails').replaceChildren(...patterns.map((item, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'pattern-thumb'; button.dataset.patternId = item.id;
    button.setAttribute('aria-pressed', String(item.id === selectedId)); button.setAttribute('aria-label', `Pattern ${index + 1}: ${patternLabel(item)}`);
    const image = document.createElement('img'); image.src = new URL(item.thumbnails[$('palette').value], root); image.alt = ''; image.width = 160; image.height = 160; image.loading = 'lazy';
    const caption = document.createElement('span'); caption.textContent = `${index + 1}. ${item.patternName ?? item.name ?? 'Periodic wave'}`;
    button.append(image, caption); button.onclick = () => selectPattern(item.id, {user: true}); return button;
  }));
  $('pattern-count').textContent = plural(patterns.length, 'verified pattern');
  $('solution-count').textContent = `${plural(modelsPresent().length, 'equation')} · ${plural(entries().length, 'pattern')}`;
  renderEquations(); renderParameterMap(sets); controls();
}

function renderParameterMap(sets) {
  const canvas = $('parameter-map'), context = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  canvas.parentElement.hidden = sets.length < 2; mapGeometry = null; if (sets.length < 2) return;
  const [xName, yCandidate] = EQUATIONS[modelId].axes, labels = EQUATIONS[modelId].labels;
  const vertical = sets.every(set => set.config.params[yCandidate] === sets[0].config.params[yCandidate]) ? 'L' : yCandidate;
  const points = sets.map(set => ({set, x: set.config.params[xName], y: vertical === 'L' ? set.config.L : set.config.params[vertical]}));
  const extent = axis => {const lo = Math.min(...points.map(p => p[axis])), hi = Math.max(...points.map(p => p[axis])); const pad = Math.max((hi - lo) * .15, Math.abs(lo) * .04, 1e-5); return [lo - pad, hi + pad];};
  const [xmin, xmax] = extent('x'), [ymin, ymax] = extent('y'), margin = {left: 72, right: 26, top: 24, bottom: 52};
  const project = p => [margin.left + (p.x - xmin) / (xmax - xmin) * (width - margin.left - margin.right), height - margin.bottom - (p.y - ymin) / (ymax - ymin) * (height - margin.top - margin.bottom)];
  context.clearRect(0, 0, width, height); context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#dfdbe8'; context.lineWidth = 1; context.beginPath(); context.moveTo(margin.left, margin.top); context.lineTo(margin.left, height - margin.bottom); context.lineTo(width - margin.right, height - margin.bottom); context.stroke();
  context.fillStyle = '#6b7280'; context.font = '18px system-ui'; context.textAlign = 'center'; context.fillText(labels[xName] ?? xName, width / 2, height - 10); context.fillText(vertical === 'L' ? 'L' : labels[vertical] ?? vertical, 27, margin.top + 15);
  context.font = '15px system-ui'; for (const x of [xmin, xmax]) context.fillText(fixed(x), project({x, y: ymin})[0], height - margin.bottom + 24);
  context.textAlign = 'right'; for (const y of [ymin, ymax]) context.fillText(fixed(y), margin.left - 8, project({x: xmin, y})[1] + 5);
  for (const point of points) {const [x, y] = project(point), selected = point.set.key === selectedKey; context.beginPath(); context.arc(x, y, selected ? 9 : 6, 0, 2 * Math.PI); context.fillStyle = selected ? '#3b6ea5' : '#9db4d0'; context.fill(); if (selected) {context.lineWidth = 3; context.strokeStyle = '#d3e0ef'; context.stroke();}}
  mapGeometry = points.map(p => ({set: p.set, point: project(p)}));
  canvas.setAttribute('aria-label', `Saved ${EQUATIONS[modelId].name} parameter sets, ${labels[xName] ?? xName} versus ${vertical === 'L' ? 'L' : labels[vertical] ?? vertical}. Click to select the closest verified point, or use arrow keys.`);
}

function renderOverlay() {
  let operation = selectedGenerator();
  // A reflected copy of α can turn the other way. Retain the actual placement
  // on selection and in shared links instead of collapsing it to its name.
  const placements = record && cellView && ($('show-generators').checked || generatorName?.includes('@'))
    ? wallpaperGeneratorPlacements(group, {cellView, translations: record.translations ?? []}) : [];
  const motions = motionCatalog?.forRecord(record, group, cellView) ?? new Map();
  for (const item of placements) if (item.kind === 'rotation') item.localMotion = motions.get(localMotionCentreKey(item.point));
  const placement = placements.find(item => item.key === generatorName);
  if (placement) operation = placement;
  else if (record && generatorName?.includes('@')) generatorName = operation?.name;
  const options = (group?.namedGenerators ?? []).map(item => new Option(wallpaperOperationLabel(item, cellView), item.name));
  if (placement) options.push(new Option(`${wallpaperOperationLabel(placement, cellView)} · selected ${placement.kind === 'rotation' ? 'centre' : 'axis'}`, placement.key));
  $('operation').replaceChildren(...options);
  $('operation').value = generatorName ?? '';
  const local = operation?.kind === 'rotation' ? motions.get(localMotionCentreKey(operation.point ?? operation.marker.centre)) : null;
  const motionText = operation?.kind !== 'rotation' ? '' : motionState === 'loading' ? ' Motion measurement loading.' : motionState === 'unavailable' ? ' Motion measurement unavailable.' : local?.direction ? ` Local motion: ${local.direction}.` : ' Local motion: no reliable direction measured.';
  $('generator-description').textContent = operation ? `${wallpaperOperationLabel(operation, cellView)}.${operation.kind === 'rotation' && operation.marker.order === 2 ? ' A half-turn has no clockwise/counterclockwise distinction.' : ''}${motionText}` : '';
  document.querySelector('.phase-rule').hidden = !$('show-generators').checked || !record;
  if (!record || !cellView) {$('generator-overlay').toggleAttribute('hidden', true); return;}
  renderWallpaperOverlay($('generator-overlay'), group, {cellView, placements, visible: $('show-generators').checked, selected: generatorName, translations: record.translations ?? [], onSelect: item => {generatorName = item.key; renderOverlay(); syncUrl();}});
}

async function loadLocalMotion() {
  try {
    const response = await fetch(new URL('data/local-motion.json?v=20260907-local-motion', root));
    if (!response.ok) throw Error('Motion measurements unavailable.');
    motionCatalog = createLocalMotionCatalog(await response.json()); motionState = 'ready';
  } catch {motionCatalog = null; motionState = 'unavailable';}
  renderOverlay();
}

// Marker caps are in displayed pixels, so recompute them when the viewer grows
// or shrinks without changing the field camera or the selected shared view.
new ResizeObserver(() => {
  if (record && cellView && $('show-generators').checked) renderOverlay();
}).observe(document.querySelector('.canvas-wrap'));

function updateFraming() {
  if (!record) return;
  const count = +$('tiles').value, framing = $('framing').value;
  cellView = makeWallpaperCellView({lattice: group.lattice, translations: record.translations ?? [], count, framing});
  const clip = cellView?.clipPath ?? ''; $('pattern').style.clipPath = clip; $('gpu-pattern').style.clipPath = clip;
  document.querySelector('.canvas-wrap').classList.toggle('cell-framing', framing === 'cells');
  $('cell-guide').innerHTML = cellView?.guideMarkup ?? ''; $('cell-guide').toggleAttribute('hidden', !$('cell-guide').innerHTML);
  $('tile-label').textContent = framing === 'cells' ? 'Cells' : 'Width';
  $('tiles').setAttribute('aria-label', framing === 'cells' ? 'Number of pattern cells' : 'Simulation width');
  for (const option of $('tiles').options) option.textContent = framing === 'cells' ? (option.value === '1' ? '1 cell' : `${option.value} × ${option.value} cells`) : (option.value === '1' ? 'L' : `${option.value} L`);
  $('scale-label').textContent = framing === 'cells' ? (cellView?.countLabel ?? `${count} × ${count} cells`) : `Physical width ${count === 1 ? '' : count + ' '}L`;
  $('view-scale-explanation').textContent = framing === 'cells' ? 'Each outlined region is one numerically checked spatial repeat cell. The pattern and generators share the same coordinates.' : 'The displayed width is measured in simulation lattice lengths L.';
  renderOverlay(); draw();
}

function draw() {
  if (!record || !player) return;
  player.draw(phase, {palette: $('palette').value, tiles: +$('tiles').value, ...(cellView?.viewOptions ?? {})});
  $('phase').value = phase; $('phase-label').textContent = `${phase.toFixed(3)} T`; engineLabel();
}

function updateDisplayRange() {
  if (!record) {$('display-range').textContent = ''; return;}
  const channel = $('palette').value === 'concentration' ? 1 : 0, range = record.ranges[channel ? 'v' : 'u'];
  $('display-range').textContent = `${EQUATIONS[record.model]?.channels[channel] ?? (channel ? 'V' : 'U')} ${fixed(range[0])} – ${fixed(range[1])}`;
}

async function selectPattern(id, {user = false, view = null} = {}) {
  const summary = catalog.get(id); if (!summary || summary.groupId !== group.id) return;
  const token = ++selectionToken, targetGroup = group.id;
  selectedId = id; selectedKey = parameterKey(summary.config); modelId = summary.model; remembered.set(targetGroup, id);
  requestedPlayback = view ? {phase: view.phase, play: view.play} : {phase: 0, play: true};
  empty({loading: true}); populateSelectors(); $('status').textContent = 'Loading saved animation…';
  if (user) syncUrl();
  try {
    const loaded = await catalog.load(id); if (token !== selectionToken || group.id !== targetGroup) return;
    if (!catalog.isVerified(loaded, targetGroup)) throw Error('The field is not part of the verified catalog.');
    record = loaded; phase = requestedPlayback.phase; player = createWallpaperPlayer($('gpu-pattern'), $('pattern'), record);
    $('empty-state').hidden = true; $('mode-label').textContent = group.hasTimeShift ? 'Numerically verified time symmetry' : 'Numerically verified · zero time offset';
    lastBackend = null; engineLabel();
    const d = record.wallpaperVerification ?? {}, checks = d.independentDynamics?.checks ?? [], last = checks[checks.length - 1];
    $('pde').textContent = scientific(last?.trajectoryRms);
    $('symmetry').textContent = scientific(d.phaseRelations?.operations?.length ? Math.max(...d.phaseRelations.operations.map(item => item.maximum)) : undefined);
    $('motion').textContent = scientific(d.temporalRms);
    $('return').textContent = scientific(last?.closureRms);
    $('caption').textContent = `${record.patternName ?? record.name} · ${EQUATIONS[record.model]?.name ?? record.model} · ${PROVENANCE[record.provenance?.kind] ?? 'saved record'} · ${record.config.N}² nodes, ${record.config.M} frames`;
    updateDisplayRange();
    $('status').textContent = 'Saved animation ready.';
    updateFraming(); populateSelectors(); lastTime = performance.now(); setPlaying(requestedPlayback.play); controls();
    syncUrl();
  } catch (error) {if (token !== selectionToken) return; empty({error: error.message}); $('status').textContent = error.message;}
}

function chooseModel(model, {user = false} = {}) {
  if (!modelEntries(model).length) return;
  modelId = model;
  const first = parameterSets(model)[0]?.patterns[0]?.id ?? null;
  if (first) selectPattern(first, {user}); else {selectedId = null; selectedKey = null; empty(); populateSelectors(); if (user) syncUrl();}
}

function chooseGroup(id, {user = false, view = null} = {}) {
  const next = groups.find(item => item.id === id) ?? groups.find(item => catalog.size(item.id) > 0) ?? groups[0];
  group = next; ++selectionToken;
  generatorName = group.namedGenerators.some(item => item.name === view?.generator?.split('@')[0]) ? view.generator : group.namedGenerators.find(item => item.tau !== 0)?.name ?? group.namedGenerators[0]?.name;
  $('group-label').textContent = `${group.id} · ${star(family.orbifold)}`; $('selected-id').textContent = group.id; $('selected-title').textContent = star(group.signature);
  $('selected-description').textContent = group.hasTimeShift ? `${plural(group.phaseOrder, 'phase')} per period` : 'Zero time offset';
  const requested = catalog.get(view?.patternId), rememberedId = remembered.get(group.id);
  const present = modelsPresent();
  modelId = requested?.groupId === group.id ? requested.model : catalog.get(rememberedId)?.model ?? (present.includes(modelId) ? modelId : present[0] ?? MODEL_ORDER[0]);
  selectedId = requested?.groupId === group.id ? requested.id : rememberedId ?? parameterSets()[0]?.patterns[0]?.id ?? null;
  selectedKey = selectedId ? parameterKey(catalog.get(selectedId).config) : null;
  renderGroups(); populateSelectors();
  if (selectedId) selectPattern(selectedId, {user, view}); else {requestedPlayback = view ? {phase: view.phase, play: view.play} : {phase: 0, play: true}; empty(); renderOverlay(); $('status').textContent = group.hasTimeShift ? 'No verified pattern in the saved search results.' : 'This entry has no nonzero time shift.'; if (user) syncUrl();}
}

function restoreUrl() {
  const view = readViewState(location.hash);
  $('palette').value = view.palette; $('tiles').value = view.tiles; $('framing').value = view.framing;
  $('speed').value = view.speed; $('show-generators').checked = view.overlay;
  chooseGroup(view.groupId, {view});
}

$('retry-animation').onclick = () => catalog && selectedId ? selectPattern(selectedId, {user: true, view: requestedPlayback}) : location.reload();
function togglePlayback() {if (!record) return; setPlaying(!playing); draw(); syncUrl();}
$('play').onclick = togglePlayback;
for (const id of ['pattern', 'gpu-pattern']) {$(id).onclick = togglePlayback; $(id).onkeydown = event => {if (event.code === 'Space') {event.preventDefault(); togglePlayback();}};}
$('rewind').onclick = () => {phase = 0; draw(); syncUrl();};
$('phase').oninput = () => {phase = Math.min(Math.max(+$('phase').value, 0), 1 - 1e-6); setPlaying(false); draw(); syncUrl();};
$('speed').onchange = syncUrl;
$('framing').onchange = $('tiles').onchange = () => {updateFraming(); syncUrl();};
$('palette').onchange = () => {populateSelectors(); updateDisplayRange(); draw(); syncUrl();};
$('show-generators').onchange = () => {renderOverlay(); syncUrl();};
$('operation').onchange = () => {generatorName = $('operation').value; renderOverlay(); syncUrl();};
$('parameter-set').onchange = () => {const set = parameterSets().find(item => item.key === $('parameter-set').value); if (set) selectPattern(set.patterns[0].id, {user: true});};
$('solution').onchange = () => selectPattern($('solution').value, {user: true});
$('parameter-map').onclick = event => {
  if (!mapGeometry?.length) return; const rect = $('parameter-map').getBoundingClientRect(), point = [(event.clientX - rect.left) / rect.width * $('parameter-map').width, (event.clientY - rect.top) / rect.height * $('parameter-map').height];
  const nearest = mapGeometry.reduce((best, item) => {const distance = (point[0] - item.point[0]) ** 2 + (point[1] - item.point[1]) ** 2; return !best || distance < best.distance ? {...item, distance} : best;}, null);
  selectPattern(nearest.set.patterns[0].id, {user: true});
};
$('parameter-map').onkeydown = event => {if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const sets = parameterSets(), i = sets.findIndex(set => set.key === selectedKey), step = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1; if (sets.length) selectPattern(sets[(i + step + sets.length) % sets.length].patterns[0].id, {user: true});};
$('export').onclick = () => {if (!record) return; const blob = new Blob([JSON.stringify({schema: 'scott-gray-verified-orbit-export-v1', group, record: {...record, field: Array.from(record.field)}})], {type: 'application/json'}), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${record.id.replace(/[^a-z0-9._-]/gi, '-')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);};

function animate(now) {if (playing && record) {phase = mod(phase + Math.max(0, Math.min(now - lastTime, 100)) / 8000 * +$('speed').value); draw();} lastTime = now; requestAnimationFrame(animate);}

try {
  const responses = await Promise.all([fetch(new URL(`wallpaper-groups.json?v=${VERSION}`, root)), fetch(new URL(`data/wallpaper-atlas.json?v=${VERSION}`, root))]);
  if (responses.some(response => !response.ok)) throw Error('The saved wallpaper catalog could not be loaded.');
  const [metadata, data] = await Promise.all(responses.map(response => response.json())); manifest = data;
  family = metadata.families.find(item => item.id === familyId); if (!family) throw Error('Unknown wallpaper family.');
  groups = family.groupIds.map(id => metadata.groups.find(item => item.id === id));
  catalog = createWallpaperCatalog(manifest, {groups: metadata.groups, baseUrl: root});
  restoreUrl(); loadLocalMotion(); window.addEventListener('hashchange', restoreUrl); requestAnimationFrame(animate);
} catch (error) {empty({error: error.message}); $('status').textContent = error.message;}
