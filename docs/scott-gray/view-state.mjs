/**
 * Shared, versioned gallery links: #g95?v=1&pattern=<stable catalog id>&…
 * A saved pattern identifies its physical parameters; catalog indexes are never
 * serialized. Legacy group anchors retain autoplay and the default view. Unknown
 * versions retain only the group. Catalog membership is checked by each gallery.
 * Serialize after a user action, never on every animation frame: a paused link
 * keeps the exact numeric phase, while a playing link resumes from that phase.
 */
const DEFAULTS = Object.freeze({
  groupId: null,
  patternId: null,
  palette: 'ember',
  tiles: 2,
  speed: 1,
  generator: null,
  overlay: false,
  phase: 0,
  play: true,
});

const palettes = new Set(['ember', 'ceramic', 'concentration']);
const generators = new Set(['α', 'β', 'γ']);
const validGroup = value => typeof value === 'string' && /^g\d+$/.test(value) ? value : null;
const validPattern = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 ? value : null;
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
const booleanChoice = (value, fallback) => value === true || value === '1' ? true : value === false || value === '0' ? false : fallback;

function normalize(state = {}) {
  return {
    groupId: validGroup(state.groupId),
    patternId: validPattern(state.patternId),
    palette: palettes.has(state.palette) ? state.palette : DEFAULTS.palette,
    tiles: numberChoice(state.tiles, [1, 2, 3], DEFAULTS.tiles),
    speed: numberChoice(state.speed, [0.5, 1, 2], DEFAULTS.speed),
    generator: generators.has(state.generator) ? state.generator : null,
    overlay: booleanChoice(state.overlay, DEFAULTS.overlay),
    phase: validPhase(state.phase),
    play: booleanChoice(state.play, DEFAULTS.play),
  };
}

export function readViewState(hash) {
  if (typeof hash !== 'string') return { ...DEFAULTS };
  const source = hash.startsWith('#') ? hash.slice(1) : hash;
  const separator = source.indexOf('?');
  const groupId = validGroup(separator < 0 ? source : source.slice(0, separator));
  const parameters = new URLSearchParams(separator < 0 ? '' : source.slice(separator + 1));
  if (parameters.get('v') !== '1') return { ...DEFAULTS, groupId };
  return normalize({
    groupId,
    patternId: parameters.get('pattern'),
    palette: parameters.get('palette'),
    tiles: parameters.get('tiles'),
    speed: parameters.get('speed'),
    generator: parameters.get('generator'),
    overlay: parameters.get('overlay'),
    phase: parameters.get('phase'),
    play: parameters.get('play'),
  });
}

export function writeViewHash(state) {
  const view = normalize(state ?? {});
  if (!view.groupId) return '';
  const parameters = new URLSearchParams();
  parameters.set('v', '1');
  if (view.patternId) parameters.set('pattern', view.patternId);
  parameters.set('palette', view.palette);
  parameters.set('tiles', String(view.tiles));
  parameters.set('speed', String(view.speed));
  if (view.generator) parameters.set('generator', view.generator);
  parameters.set('overlay', view.overlay ? '1' : '0');
  parameters.set('phase', String(view.phase));
  parameters.set('play', view.play ? '1' : '0');
  return `#${view.groupId}?${parameters}`;
}
