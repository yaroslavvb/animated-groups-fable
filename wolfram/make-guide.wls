#!/usr/bin/env wolframscript
(* ::Package:: *)

(* make-guide.wls — regenerate FilmGroupsGuide.nb, the Wolfram Community
   guide notebook for the FilmGroups package.
   Usage:  wolframscript -f make-guide.wls                                *)

dir = DirectoryName[$InputFileName];
outPath = FileNameJoin[{dir, "FilmGroupsGuide.nb"}];

text[s_] := Cell[s, "Text"];
input[s_] := Cell[s, "Input"];
section[s_] := Cell[s, "Section"];
subsection[s_] := Cell[s, "Subsection"];

cells = {
   Cell["Film Groups", "Title"],
   Cell["The 275 space-time symmetry groups of the plane, animated", "Subtitle"],

   text["A film is a map from spacetime \
\!\(\*SuperscriptBox[\(\[DoubleStruckCapitalR]\), \(2\)]\)\[Times]\[DoubleStruckCapitalR] to colors. \
A film group is a crystallographic group of symmetries of such a film: transformations \
g : (x, t) \[RightArrow] (M.x + v, s\[ThinSpace]t + \[Tau]), with M a 2\[Times]2 point \
operation, v a spatial translation, s = \[PlusMinus]1 a time direction, and \[Tau] a \
time offset, containing a lattice of two independent spatial translations and one time \
period. Up to crystallographic equivalence there are exactly 275 such groups \
(Ke & Wu, arXiv:2604.05619) \[LongDash] the space-time analogue of the 17 wallpaper \
groups, and a subfamily of the 230 space groups read with one axis as time \
(Fletcher, Math. Gazette 40 (1956) 15\[Dash]19; the 1+1-dimensional count of 13 is in \
Xu & Wu, Phys. Rev. Lett. 120, 096401 (2018))."],
   text["This notebook accompanies the FilmGroups package, a port of the interactive \
atlas at https://yaroslavvb.github.io/animated-groups-fable . Every group is stored as \
exact data, machine-verified against the group axioms, and rendered as a looping \
animation: the orbit of a single animated motif under the group."],

   section["Setup"],
   text["Place FilmGroups.wl and FilmGroupsData.wl in the same directory as this \
notebook and load:"],
   input["SetDirectory[NotebookDirectory[]];\nGet[\"FilmGroups.wl\"]"],

   section["The motif: a clock that cannot alias"],
   text["Each copy of the motif displays its own internal time \[Theta] = s\[ThinSpace](t \[Minus] \[Tau]): \
a vessel that fills once per period, its surface marked in red. The fill level is an \
injective function of \[Theta] mod 1, and it cannot be rotated \[LongDash] so two copies at \
different internal times always look different in a frozen frame, no matter how the \
pattern's own rotations act. Orientation and phase are independent readouts. The vessel is \
chiral and asymmetric (no accidental symmetry), and time-reversed copies drain instead of \
filling."],
   input["Row[Table[FilmGroupMotif[\[Theta]], {\[Theta], 0, 5/6, 1/6}], Spacer[4]]"],

   section["Animating a group"],
   text["FilmGroupAnimation accepts an index 1\[Dash]275, an ID like \"g95\", or a \
notation symbol from the catalog. Group #95 is 4\:20824\:20822, the film analogue of the \
space group P4\:2082: a fourfold time screw \[LongDash] each quarter turn about a 4\:2082 \
centre advances the film by half a period. Press play."],
   input["FilmGroupAnimation[95]"],
   text["A hexagonal time screw, 6\:20823\:20822 (#244): the sixfold centres advance the \
film by a third of a period per sixth of a turn, so equal fill levels spiral around each \
centre."],
   input["FilmGroupAnimation[\"g244\"]"],
   text["Time reversal. In o/m\[Prime][cm] (#2) a mirror runs the film backwards: \
reflected copies drain while their partners fill. Mirror pairs share a site and are drawn \
superimposed, showing both surface lines."],
   input["FilmGroupAnimation[2]"],
   text["The animations are Manipulates with SaveDefinitions \[Rule] True, so they keep \
working \[LongDash] play button and all \[LongDash] in a notebook opened without the \
package."],

   section["Window size and other options"],
   text["\"Cells\" sets the width of the window in lattice translations; the default \
Automatic sizes the window so roughly 16 copies are visible. \"ShowCell\" overlays the \
lattice. A frame at a single time t is a Graphics:"],
   input["GraphicsRow[{FilmGroupFrame[95, 0.3, \"Cells\" -> 2],\n  FilmGroupFrame[95, 0.3, \"Cells\" -> 4, \"ShowCell\" -> True]}, ImageSize -> 600]"],
   text["\"MotifScale\" shrinks the stamps, \"Colors\" overrides any of \"Body\", \
\"Outline\", \"Fill\", \"Line\", \"Background\", and Background and ImageSize pass \
through to Graphics."],
   input["FilmGroupFrame[258, 0.25, \"Cells\" -> {6, 3}, \"MotifScale\" -> 0.9,\n  \"Colors\" -> <|\"Fill\" -> RGBColor[\"#8c4a3a\"], \"Line\" -> RGBColor[\"#1a3a5c\"]|>,\n  ImageSize -> 640]"],

   section["Browsing all 275"],
   text["The browser steps through the whole catalog (requires the package loaded in the \
current session):"],
   input["FilmGroupBrowser[]"],

   section["The catalog"],
   text["FilmGroupData[] is the full catalog as a Dataset. Each entry records the \
notation Symbol (Conway orbifold notation with time decorations: gyration subscripts \
n\:2096 for time screws, \[Tilde] for time glides, \[Prime] for time reversal, c/r \
prefixes for space-time-centred lattices \[LongDash] see the atlas notation page), the \
crystal System, the base wallpaper group of the spatial projection, the flags \
ForwardTime / Product / Symmorphic, human-readable Generators, and the exact rendering \
spec (Basis, Ops, BasePoint)."],
   input["FilmGroupData[]"],
   input["Normal @ FilmGroupData[][GroupBy[\"System\"], Length]"],
   input["FilmGroupData[][Select[#ForwardTime && ! #Symmorphic &], Length]"],
   input["Column @ FilmGroupData[95, \"Generators\"]"],

   section["Verified symmetry"],
   text["\"Ops\" lists coset representatives of the group modulo \
\!\(\*SuperscriptBox[\(\[DoubleStruckCapitalZ]\), \(2\)]\)\[Times]\[DoubleStruckCapitalZ] \
(lattice and time period), stored exactly \[LongDash] integer matrices, rational offsets, \
Sqrt[3]/2. VerifyFilmGroup checks identity, inverses and closure in exact arithmetic. The \
whole catalog passes:"],
   input["AllTrue[Range[275], VerifyFilmGroup[#][\"OK\"] &]"],
   text["Rendering then inherits the symmetry by construction: a frame is drawn as the \
explicit orbit of the base motif under these representatives and the lattice, so applying \
any listed operation to the picture at time t reproduces the picture at time \
s\[ThinSpace]t + \[Tau] exactly."],

   section["Exporting"],
   text["Frames export to an animated GIF (here 40 frames, 4 seconds per period, matching \
the atlas):"],
   input["Export[\"film-group-95.gif\", FilmGroupFrames[95, 40, ImageSize -> 320],\n  \"DisplayDurations\" -> 0.1, \"AnimationRepetitions\" -> Infinity]"],

   section["References"],
   text["T. J. Fletcher, Film groups, Math. Gazette 40 (1956) 15\[Dash]19.\n\
Ke & Wu, Space-time groups in 2+1 dimensions, arXiv:2604.05619.\n\
Xu & Wu, Space-time crystals in 1+1 dimensions, Phys. Rev. Lett. 120, 096401 (2018).\n\
J. H. Conway, H. Burgiel, C. Goodman-Strauss, The Symmetries of Things (2008) \
\[LongDash] orbifold notation.\n\
Interactive atlas: https://yaroslavvb.github.io/animated-groups-fable\n\
Source: https://github.com/yaroslavvb/animated-groups-fable (wolfram/ directory; the \
catalog data is generated from the atlas's own, and both renderers agree frame by \
frame)."]
   };

nb = Notebook[cells, StyleDefinitions -> "Default.nb",
   WindowSize -> {900, 800}];

Export[outPath, nb, "NB"];
Print["wrote ", outPath, " (", FileByteCount[outPath], " bytes)"];

(* sanity: the file must round-trip as a notebook expression *)
back = Get[outPath];
Print["cells: ", Length[First[back]], "  head: ", Head[back]];
