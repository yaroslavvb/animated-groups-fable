// theme.js — the colours that follow the device's light or dark setting, read by line builders when they draw.
export const THEME = {
  dark: false,
  ink: [0.1, 0.1, 0.12],        // rims of plain holes, labels
  soft: [0.5, 0.5, 0.55],       // outlines, the map's edges
  front: [0.5, 0.79, 0.75],     // the paper's front (teal) and back (sand), as in The Folding's print
  back: [0.93, 0.85, 0.63],
  opacity: 0.8,
};
export function setDark(dark) {
  THEME.dark = dark;
  THEME.ink = dark ? [0.93, 0.93, 0.95] : [0.1, 0.1, 0.12];
  THEME.soft = dark ? [0.62, 0.62, 0.68] : [0.5, 0.5, 0.55];
  THEME.front = dark ? [0.42, 0.74, 0.7] : [0.5, 0.79, 0.75];
  THEME.back = dark ? [0.88, 0.78, 0.52] : [0.93, 0.85, 0.63];
}
