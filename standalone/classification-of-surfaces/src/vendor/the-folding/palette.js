// palette.js — the one place colours are defined. Used by the plane view, the 3D view, the picker and the CSS.
// White ground, near-black ink, one teal accent; seam colours are a colour-blind-safe categorical set
// that never includes the accent hue. No red or pink surfaces anywhere.

export const INK = '#1a1a1f';        // primary text, mirror lines
export const MUTED = '#52514a';      // secondary text (>= 7:1 on white)
export const FAINT = '#8a8a93';      // incidental marks only (never reading text)
export const HAIRLINE = '#e5e5ea';   // borders, rules
export const CARD = '#f7f7f8';       // barely-grey fills
export const GROUND = '#ffffff';
export const ACCENT = '#0f766e';     // teal: the current tile, the primary button, the selected node
export const ACCENT_SOFT = 'rgba(15,118,110,0.14)';

// Glue classes: cut edges that are sewn together share one colour (index = Domain edge .cls, modulo length).
export const CLASS_COLORS = ['#0072B2', '#E69F00', '#7A5CC7', '#56B4E9', '#8C6D1F', '#B5489C', '#5C7D12', '#3D4C8F'];
export const MIRROR_COLOR = INK;     // mirror edges of the tile and mirror lines of the pattern
export const CREASE_COLOR = '#9a9aa3'; // where the tile bends while folding (not a feature of the orbifold)
export const GLIDE_COLOR = '#6b6b74';
export const MOTIF_COLOR = '#3b3b44';

// 3D surface (linear-ish 0..1 RGB). Front = the side of the tile you see in the plane.
export const SURFACE_FRONT = [0.56, 0.80, 0.77];
export const SURFACE_BACK = [0.80, 0.88, 0.87];
export const SURFACE_GHOST = [0.86, 0.87, 0.89]; // secondary tiles (the snowflake star)
export const SURFACE_OPACITY = 0.62;
// The comma filled in 3D, every fold: the renderer's `fill` colour (tint bit 1 of a mesh from motif.js motifTintMesh).
// A deep teal, the surface's own hue, so the coloured seams keep their contrast over it and the front and back overlaps
// stay clean (the fill judge, qa/fill-judge.md: a grey fill at this size turned muddy).
export const MOTIF_FILL_3D = [0.33, 0.55, 0.55];
// The commas of the plane: MOTIF_COLOR at this opacity over the white ground (lighter than the 0.54 of the small
// commas: the big ones are 6 to 10 times larger, and the mirrors, glide axes and centre glyphs stay on top).
export const MOTIF_ALPHA_PLANE = 0.4;

// The prints (src/pattern.js: the checkerboard, the rings), 13 Nov 2026. The paper has two sides: its FRONT (the side
// the plane shows) is teal, its BACK sand; each has a light and a dark tone ([light, dark]), the 22x lab's Checkerboard
// colours. The seam colours stay readable over both. The plane draws the dark tone at PRINT_PLANE_ALPHA over the white
// ground everywhere, and the tile itself in the front's two tones, as the flat paper in the 3D pane.
export const PRINT_FRONT = ['#9ad5cc', '#4fa397'];
export const PRINT_BACK = ['#f5e6c6', '#d8bd85'];
export const PRINT_PLANE_ALPHA = 0.2;
// ... and on the tiles of the other hand the BACK's dark tone at this (they lie face down: plane.js)
export const PRINT_PLANE_ALPHA_BACK = 0.42;
// A printed sheet is paper, not glass: nearly opaque (the bold seams still shine through it, render3d.js x-ray).
export const PRINT_OPACITY = 0.96;
// The lines of a re-cut (src/folds/recut.js): where the tile is cut into pieces, the rim of the tile it is re-cut into.
export const RECUT_COLOR = '#52514a';

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function classColor(cls) { return CLASS_COLORS[((cls % CLASS_COLORS.length) + CLASS_COLORS.length) % CLASS_COLORS.length]; }
