import {primitiveCell} from './cell-geometry.mjs';
import {makeCellView,renderCellGuide,cellCountLabel} from './cell-view.mjs';

/** The cell guide, all canvases, and markers share the returned camera. */
export function updateCellFraming({family,translations,near,count,framing}) {
  const approximate=!!near;
  const cell=primitiveCell({family,translations:near?.translations??translations});
  const view=makeCellView(cell,count,{view:framing});
  const $=id=>document.getElementById(id);
  renderCellGuide($('cell-guide'),view);
  for(const id of ['pattern','gpu-pattern'])$(id).style.clipPath=view?.clipPath??'';
  document.querySelector('.canvas-wrap').classList.toggle('cell-framing',!!view);
  $('tile-label').textContent=view?'Cells':'Width';
  $('tiles').setAttribute('aria-label',view?'Number of pattern cells':'Simulation width in L');
  for(const option of $('tiles').options)option.textContent=view?cellCountLabel(+option.value).replace('cell',approximate?'approx. cell':'cell'):(option.value==='1'?'L':option.value+' L');
  document.querySelector('.scale-label').textContent=view?`${cellCountLabel(count).replace('cell',approximate?'approximate cell':'cell')} · ${family==='p6'?'triangular':'square'} lattice`:`Physical width ${count===1?'L':count+' L'}`;
  $('view-scale-explanation').textContent=view?
    `Each outlined ${family==='p6'?'rhombus':'square'} is one ${approximate?'approximate ':''}pattern repeat cell. Cell side ${cell.index===1?'L':`L/√${cell.index} (${cell.sideLength.toFixed(3)} L)`}. ${approximate?'The smaller repeats and their dashed generators are approximate; solid generators remain verified.':'The pattern and generators use the same cell coordinates.'}`:
    'Original simulation-width view. L is the saved simulation lattice length; this mode may contain several smaller pattern repeats.';
  return view;
}
