/**
 * Shared, versioned gallery links: #g95?v=2&pattern=<stable catalog id>&…
 * A saved pattern identifies its physical parameters; catalog indexes are never
 * serialized. Legacy group anchors retain autoplay and the default view. Unknown
 * versions retain only the group. Version 1 migrates its requested count to
 * corrected pattern-cell framing. Version 2 records cells vs simulation width
 * explicitly. Catalog membership is checked by each gallery.
 * Serialize after a user action, never on every animation frame: a paused link
 * keeps the exact numeric phase, while a playing link resumes from that phase.
 */
const DEFAULTS = Object.freeze({
  groupId: null,
  patternId: null,
  palette: 'ember',
  tiles: 2,
  framing: 'cells',
  speed: 1,
  generator: null,
  overlay: false,
  approximate: true,
  phase: 0,
  play: true,
});

const palettes = new Set(['ember', 'ceramic', 'concentration']);
const generators = new Set(['α', 'β', 'γ', 'δ', 'P', 'Q', 'R', 'S', 'X', 'Y', 'Z']);
const validGenerator = value => {
  if (generators.has(value)) return value;
  if (typeof value !== 'string' || value.length > 64) return null;
  const match = value.match(/^([αβγδPQRSXYZ])@(0(?:\.\d{1,9})?),(0(?:\.\d{1,9})?)$/);
  return match && Number(match[2]) < 1 && Number(match[3]) < 1 ? value : null;
};
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
    framing: state.framing === 'simulation' ? 'simulation' : 'cells',
    speed: numberChoice(state.speed, [0.5, 1, 2], DEFAULTS.speed),
    generator: validGenerator(state.generator),
    overlay: booleanChoice(state.overlay, DEFAULTS.overlay),
    approximate: booleanChoice(state.approximate, DEFAULTS.approximate),
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
  if (!['1','2'].includes(parameters.get('v'))) return { ...DEFAULTS, groupId };
  return normalize({
    groupId,
    patternId: parameters.get('pattern'),
    palette: parameters.get('palette'),
    tiles: parameters.get('tiles'),
    // Old tile counts were presented as cells. Correct their framing on load.
    framing: parameters.get('v') === '2' ? parameters.get('framing') : 'cells',
    speed: parameters.get('speed'),
    generator: parameters.get('generator'),
    overlay: parameters.get('overlay'),
    approximate: parameters.get('approx'),
    phase: parameters.get('phase'),
    play: parameters.get('play'),
  });
}

export function writeViewHash(state) {
  const view = normalize(state ?? {});
  if (!view.groupId) return '';
  const parameters = new URLSearchParams();
  parameters.set('v', '2');
  if (view.patternId) parameters.set('pattern', view.patternId);
  parameters.set('palette', view.palette);
  parameters.set('tiles', String(view.tiles));
  parameters.set('framing', view.framing);
  parameters.set('speed', String(view.speed));
  if (view.generator) parameters.set('generator', view.generator);
  parameters.set('overlay', view.overlay ? '1' : '0');
  parameters.set('approx', view.approximate ? '1' : '0');
  parameters.set('phase', String(view.phase));
  parameters.set('play', view.play ? '1' : '0');
  return `#${view.groupId}?${parameters}`;
}
