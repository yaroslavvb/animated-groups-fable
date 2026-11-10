// groupdata/motif.js — WRITTEN BY tools/motif-place.mjs: do not edit by hand. Regenerate it with
//   node tools/motif-place.mjs
// after any change of the group data (lattice, coset representatives, viewHalf, the default preset), of the default
// tile (src/domain.js), of the rules in src/motif.js, of a fold's shape at t = 1 or of the default view; test/motif.test.js
// fails while it is stale. One big comma per group (src/motif.js motifFor; qa/fill-judge.md): the unit comma
// (commaOutline) scaled by s across and s * stretch along its head -> tail axis, turned by `angle` (radians), centred
// at `at`. Its copies under the group stay FILL_GAP * sqrt(domainArea) apart, outline to outline (as drawn); `fit` is
// the largest s that keeps that gap there; it covers `cover` of the tile (FILL_TARGET, or `coverFit` when that is less);
// `inTile` of it lies inside the default preset's tile (exactly); `seen` is the share of the default 3D view at t = 1
// that is comma; radius = s * stretch. key = placementKey(group) of the data it was computed from, view = viewKey(group)
// of the folded default tile it was seen on (null: a kaleidoscope); PLACEMENT_SOURCE = fnv1a of tools/motif-place.mjs.
// The seam groups (xx) are placed by rule in src/motif.js.
export const PLACEMENT_SOURCE = 'acb06e96';
export const PLACEMENTS = {
  "333": {"key":"9af8e13c","view":"c17f3cb9","at":[0.300195,-0.119702],"angle":1.513139,"s":0.234803,"stretch":1,"fit":0.265228,"cover":0.3,"coverFit":0.3828,"inTile":0.9802,"seen":0.4429,"radius":0.234803},
  "442": {"key":"be8fd1d4","view":"9d0b7fbf","at":[0.179036,0.2125],"angle":0.117728,"s":0.218509,"stretch":1,"fit":0.263379,"cover":0.3,"coverFit":0.4359,"inTile":0.9967,"seen":0.4992,"radius":0.218509},
  "632": {"key":"2beba566","view":"c797504f","at":[0.377474,0.035274],"angle":2.152809,"s":0.166031,"stretch":1,"fit":0.167049,"cover":0.3,"coverFit":0.3037,"inTile":0.9817,"seen":0.3575,"radius":0.166031},
  "2222": {"key":"1b77fdf8","view":"83e63f12","at":[0.274953,0.098547],"angle":6.109457,"s":0.352336,"stretch":1,"fit":0.359553,"cover":0.3,"coverFit":0.3124,"inTile":0.98,"seen":0.4391,"radius":0.352336},
  "o": {"key":"37e638b5","view":"f9134358","at":[0.146783,0.403],"angle":3.860641,"s":0.459,"stretch":1,"fit":0.459,"cover":0.2946,"coverFit":0.2946,"inTile":0.2366,"seen":0.4796,"radius":0.459},
  "**": {"key":"7e0637a1","view":"5f653c4f","at":[0.18875,0.2375],"angle":0.105456,"s":0.355518,"stretch":1,"fit":0.355518,"cover":0.2757,"coverFit":0.2757,"inTile":0.8305,"seen":0.5054,"radius":0.355518},
  "*x": {"key":"b76426fc","view":"18bdf29a","at":[0.928125,0.09],"angle":1.721377,"s":0.179355,"stretch":2,"fit":0.179355,"cover":0.2105,"coverFit":0.2105,"inTile":1,"seen":0.2886,"radius":0.35871},
  "22x": {"key":"bf408070","view":"917b92be","at":[0.290221,1.287773],"angle":5.334285,"s":0.334255,"stretch":1,"fit":0.337134,"cover":0.3,"coverFit":0.3052,"inTile":0.983,"seen":0.4685,"radius":0.334255},
  "22*": {"key":"3db85978","view":"5b2828be","at":[0.302572,0.742396],"angle":5.378771,"s":0.315139,"stretch":1,"fit":0.317159,"cover":0.3,"coverFit":0.3039,"inTile":0.9887,"seen":0.3509,"radius":0.315139},
  "*2222": {"key":"31bcc429","view":null,"at":[0.281667,0.15],"angle":1.700796,"s":0.249139,"stretch":1,"fit":0.261708,"cover":0.3,"coverFit":0.331,"inTile":1,"seen":0,"radius":0.249139},
  "2*22": {"key":"96fba392","view":"df6828c2","at":[0.227604,0.232917],"angle":5.138447,"s":0.214094,"stretch":1,"fit":0.215753,"cover":0.3,"coverFit":0.3047,"inTile":0.9999,"seen":0.3597,"radius":0.214094},
  "3*3": {"key":"4d9b21ae","view":"e25ce824","at":[0.417578,0.180614],"angle":5.49024,"s":0.166031,"stretch":1,"fit":0.1673,"cover":0.3,"coverFit":0.3046,"inTile":0.9847,"seen":0.2789,"radius":0.166031},
  "*333": {"key":"dab4b64a","view":null,"at":[0.316667,-0.07698],"angle":1.177198,"s":0.166031,"stretch":1,"fit":0.170016,"cover":0.3,"coverFit":0.3146,"inTile":1,"seen":0,"radius":0.166031},
  "4*2": {"key":"35f6acb8","view":"80df53e0","at":[0.441504,0.295866],"angle":4.118094,"s":0.154509,"stretch":1,"fit":0.155452,"cover":0.3,"coverFit":0.3037,"inTile":0.9828,"seen":0.3854,"radius":0.154509},
  "*442": {"key":"cdf4e937","view":null,"at":[0.183333,0.316667],"angle":2.747994,"s":0.154509,"stretch":1,"fit":0.170952,"cover":0.3,"coverFit":0.3672,"inTile":1,"seen":0,"radius":0.154509},
  "*632": {"key":"6b8e9655","view":null,"at":[-0.3,-0.245374],"angle":5.365988,"s":0.117401,"stretch":1,"fit":0.12201,"cover":0.3,"coverFit":0.324,"inTile":1,"seen":0,"radius":0.117401},
};
