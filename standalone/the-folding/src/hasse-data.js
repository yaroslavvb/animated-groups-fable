// hasse-data.js — layout of the inclusion (Hasse) diagram of the 17 wallpaper groups, in a 540 x 565 box.
// Smallest group on top: o, then tiers by the order of the point group (1, 2, 3, 4, 6, 8, 12), *632 at the bottom.
// An edge joins a group to a minimal supergroup below it; `index` is the index of the upper group in the lower one.
// (Layout taken from the page the owner pointed at: spacesheep.dev/@yaroslavvb/wallpaper-group-inclusions-hasse-diagram.)

export const HASSE_BOX = { w: 540, h: 565 };

export const HASSE_TIERS = [
  { order: 1, y: 42 }, { order: 2, y: 132 }, { order: 3, y: 212 }, { order: 4, y: 296 },
  { order: 6, y: 382 }, { order: 8, y: 454 }, { order: 12, y: 524 },
];

export const HASSE_NODES = [
  { id: 'o', x: 270, y: 42 },
  { id: '*x', x: 195, y: 132 }, { id: '2222', x: 285, y: 132 }, { id: '**', x: 375, y: 132 }, { id: 'xx', x: 465, y: 132 },
  { id: '333', x: 105, y: 212 },
  { id: '2*22', x: 195, y: 296 }, { id: '442', x: 290, y: 296 }, { id: '*2222', x: 382, y: 296 },
  { id: '22*', x: 452, y: 252 }, { id: '22x', x: 480, y: 312 },
  { id: '632', x: 56, y: 382 }, { id: '*333', x: 146, y: 382 }, { id: '3*3', x: 240, y: 382 },
  { id: '*442', x: 340, y: 454 }, { id: '4*2', x: 445, y: 454 },
  { id: '*632', x: 146, y: 524 },
];

// [upper (subgroup), lower (supergroup), index]
export const HASSE_EDGES = [
  ['o', '2222', 2], ['o', '**', 2], ['o', '*x', 2], ['o', 'xx', 2], ['o', '333', 3],
  ['2222', '*2222', 2], ['**', '*2222', 2], ['2222', '2*22', 2], ['*x', '2*22', 2],
  ['2222', '22*', 2], ['**', '22*', 2], ['xx', '22*', 2], ['2222', '22x', 2], ['xx', '22x', 2], ['2222', '442', 2],
  ['333', '632', 2], ['2222', '632', 3], ['333', '*333', 2], ['*x', '*333', 3], ['333', '3*3', 2], ['*x', '3*3', 3],
  ['442', '*442', 2], ['*2222', '*442', 2], ['2*22', '*442', 2], ['442', '4*2', 2], ['2*22', '4*2', 2], ['22x', '4*2', 2],
  ['632', '*632', 2], ['*333', '*632', 2], ['3*3', '*632', 2], ['2*22', '*632', 3],
];
