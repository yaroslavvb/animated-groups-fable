/** Shared, versioned links for the seventeen Monochrome explorer pages:
 *
 *   #g97?v=1&rule=half-turn&model=gray-scott&pattern=mono%3Ahalf-turn%3A470ec64e6ba1%3AR1800.0
 *        &channel=u&framing=simulation&tiles=2&palette=mono&speed=1&marks=0&notation=0
 *        &phase=0.320&play=1&x=0.5&y=0.5&scale=380&angle=0
 *
 * Modelled line for line on `../colour/colour-view-state.mjs`, which is modelled
 * on `../scott-gray/view-state.mjs`: every field is validated on the way in and
 * on the way out, an unknown version keeps only the film group, and a
 * hand-edited link can never throw. The camera is in the hash as well as the
 * selection, because the endless framing pans and zooms and a share link has to
 * carry where the reader got to.
 *
 * Serialised after a user action and after a gesture ENDS — never per frame.
 * The parameter set is not in the hash: it is implied by `pattern`.
 *
 * `marks` defaults to **false**. The generator marks are off on every animation
 * on this site; a link that says nothing about them shows the picture alone.
 */
const DEFAULTS = Object.freeze({
  groupId: null,
  rule: null,
  model: null,
  patternId: null,
  channel: null,
  tier: null,
  framing: 'simulation',
  tiles: 2,
  palette: 'mono',
  speed: 1,
  marks: false,
  notation: false,
  phase: 0,
  play: true,
  x: null,
  y: null,
  scale: null,
  angle: 0,
});

const RULES = new Set(['half-turn', 'mirror', 'glide', 'half-shift', 'half-period', 'threshold']);
/** How many lattice lengths the fixed frame may show. The catalog's own framing
 * gate reaches eight: the finest pictures show ten strands at two cells across
 * and the coarsest show one, so a fixed tile count cannot serve both. */
const TILES = [1, 2, 3, 4, 5, 6, 7, 8];
const PALETTES = new Set(['mono', 'ember', 'concentration']);
const FRAMINGS = new Set(['endless', 'simulation']);
const CHANNELS = new Set(['u', 'v']);
const TIERS = new Set(['all', 'strict', 'broad']);
const validGroup = value => (typeof value === 'string' && /^g\d+$/.test(value) ? value : null);
const validKey = (value, max = 64) => (typeof value === 'string' && value.trim() && value.length <= max && /^[A-Za-z0-9:._|,+/-]+$/.test(value) ? value : null);
const validPattern = value => (typeof value === 'string' && value.trim() && value.length <= 512 ? value : null);
const numberChoice = (value, choices, fallback) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return fallback;
  const number = Number(value);
  return choices.includes(number) ? number : fallback;
};
const validPhase = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number % 1 : 0;
};
const booleanChoice = (value, fallback) => (value === true || value === '1' ? true : value === false || value === '0' ? false : fallback);
const wrapUnit = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number - Math.floor(number) : null;
};
const finitePositive = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const wrapDegrees = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const a = number - 360 * Math.floor((number + 180) / 360);
  return a <= -180 ? a + 360 : a;
};

export function normalize(state = {}) {
  return {
    groupId: validGroup(state.groupId),
    rule: RULES.has(state.rule) ? state.rule : null,
    model: validKey(state.model),
    patternId: validPattern(state.patternId),
    channel: CHANNELS.has(state.channel) ? state.channel : null,
    tier: TIERS.has(state.tier) ? state.tier : null,
    framing: FRAMINGS.has(state.framing) ? state.framing : DEFAULTS.framing,
    tiles: numberChoice(state.tiles, TILES, DEFAULTS.tiles),
    palette: PALETTES.has(state.palette) ? state.palette : DEFAULTS.palette,
    speed: numberChoice(state.speed, [0.5, 1, 2], DEFAULTS.speed),
    marks: booleanChoice(state.marks, DEFAULTS.marks),
    notation: booleanChoice(state.notation, DEFAULTS.notation),
    phase: validPhase(state.phase),
    play: booleanChoice(state.play, DEFAULTS.play),
    x: wrapUnit(state.x),
    y: wrapUnit(state.y),
    scale: finitePositive(state.scale),
    angle: wrapDegrees(state.angle),
  };
}

export function readViewState(hash) {
  if (typeof hash !== 'string') return {...DEFAULTS};
  const source = hash.startsWith('#') ? hash.slice(1) : hash;
  const separator = source.indexOf('?');
  const groupId = validGroup(separator < 0 ? source : source.slice(0, separator));
  const parameters = new URLSearchParams(separator < 0 ? '' : source.slice(separator + 1));
  if (parameters.get('v') !== '1') return {...DEFAULTS, groupId};
  return normalize({
    groupId,
    rule: parameters.get('rule'),
    model: parameters.get('model'),
    patternId: parameters.get('pattern'),
    channel: parameters.get('channel'),
    tier: parameters.get('tier'),
    framing: parameters.get('framing'),
    tiles: parameters.get('tiles'),
    palette: parameters.get('palette'),
    speed: parameters.get('speed'),
    marks: parameters.get('marks'),
    notation: parameters.get('notation'),
    phase: parameters.get('phase'),
    play: parameters.get('play'),
    x: parameters.get('x'),
    y: parameters.get('y'),
    scale: parameters.get('scale'),
    angle: parameters.get('angle'),
  });
}

export function writeViewHash(state) {
  const view = normalize(state ?? {});
  if (!view.groupId) return '';
  const parameters = new URLSearchParams();
  parameters.set('v', '1');
  if (view.rule) parameters.set('rule', view.rule);
  if (view.tier) parameters.set('tier', view.tier);
  if (view.model) parameters.set('model', view.model);
  if (view.patternId) parameters.set('pattern', view.patternId);
  if (view.channel) parameters.set('channel', view.channel);
  parameters.set('framing', view.framing);
  parameters.set('tiles', String(view.tiles));
  parameters.set('palette', view.palette);
  parameters.set('speed', String(view.speed));
  parameters.set('marks', view.marks ? '1' : '0');
  parameters.set('notation', view.notation ? '1' : '0');
  parameters.set('phase', view.phase.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0'));
  parameters.set('play', view.play ? '1' : '0');
  // The camera belongs to the endless framing only; the fixed frame is implied
  // by `framing` and `tiles`, so a simulation-width link stays short.
  if (view.framing === 'endless') {
    if (view.x !== null) parameters.set('x', view.x.toFixed(6));
    if (view.y !== null) parameters.set('y', view.y.toFixed(6));
    if (view.scale !== null) parameters.set('scale', view.scale.toFixed(3));
    if (view.angle) parameters.set('angle', view.angle.toFixed(3));
  }
  return `#${view.groupId}?${parameters}`;
}
