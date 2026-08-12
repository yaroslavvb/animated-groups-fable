#!/usr/bin/env wolframscript
(* ::Package:: *)

(* make-guide.wls — regenerate FilmGroupsGuide.nb: ONE self-contained
   notebook. It carries the catalog and the renderer inside it, so it needs
   no package files and no network; evaluate it and you get the atlas.

   Usage:  wolframscript -f make-guide.wls                                  *)

dir = DirectoryName[$InputFileName];
catPath = FileNameJoin[{dir, "..", "docs", "data", "catalog.json"}];
srcPath = FileNameJoin[{dir, "guide-src.wl"}];
outPath = FileNameJoin[{dir, "FilmGroupsGuide.nb"}];

cat = Import[catPath, "RawJSON"];
groups = cat["groups"];

(* --------------------------------------------------------------- data *)
(* The group itself — the matrices M, the fractional translations v and the
   time offsets tau — is stored EXACTLY: those are what the classification is
   about and what any verification runs on. The basis is a display modulus
   (enumerate/optimize_aspect.py picks it so the orbit is isotropic on
   screen), so it stays machine-precision. *)
ex[x_] := With[{r = Rationalize[x, 10^-6]},
  If[Abs[N[r] - x] > 10^-6, Throw[{"inexact", x}], r]];

num[x_] := If[Round[x] == x, Round[x], N[x]];

opWL[o_] := {Round /@ # & /@ o["M"], ex /@ o["v"], Round[o["s"]], ex[o["tau"]]};

wl[e_] := ToString[e, InputForm];

entry[g_] := StringJoin[
  "\"", g["id"], "\"-><|\"Symbol\"->", wl[g["symbol"]],
  ",\"Base\"->", wl[g["base"]],
  ",\"Forward\"->", wl[g["forward"]],
  ",\"Product\"->", wl[g["product"]],
  ",\"Basis\"->", wl[num /@ # & /@ g["render"]["basis"]],
  ",\"Point\"->", wl[num /@ g["render"]["base"]],
  ",\"Ops\"->", wl[opWL /@ g["render"]["ops"]], "|>"];

(* the 17 wallpaper groups, orbifold and IT name, in the atlas's order *)
wps = {{"p1", "o"}, {"p2", "2222"}, {"pm", "**"}, {"pg", "\[Times]\[Times]"},
  {"cm", "*\[Times]"}, {"pmm", "*2222"}, {"pmg", "22*"}, {"pgg", "22\[Times]"},
  {"cmm", "2*22"}, {"p4", "442"}, {"p4m", "*442"}, {"p4g", "4*2"},
  {"p3", "333"}, {"p3m1", "*333"}, {"p31m", "3*3"}, {"p6", "632"},
  {"p6m", "*632"}};

hms = wps[[All, 1]];

wpCell = "$WP=" <> wl[wps] <> ";";

(* The catalog goes in as SEVENTEEN associations, one per wallpaper, and $FG
   is their join. That split is what keeps the evaluated notebook small: each
   section's Manipulate mentions only its own FG$<name>, and SaveDefinitions
   saves whole symbols, so a single shared $FG would put all 275 groups into
   all 17 stored outputs — a 4 MB notebook to say what fits in well under
   one. Nothing the viewers touch may reach $FG for the same reason; it is
   here for reading the catalog by hand. *)
wpData[hm_] := StringJoin["FG$", hm, "=<|\n",
  StringRiffle[entry /@ Select[groups, #["base"] === hm &], ",\n"], "\n|>;"];

dataCell = StringJoin[
  StringRiffle[wpData /@ hms, "\n\n"],
  "\n\n$FG=Join[", StringRiffle["FG$" <> # & /@ hms, ","], "];"];

src = Import[srcPath, "Text"];
(* the build-time header of the source file is not wanted in the notebook *)
src = StringTrim@StringDrop[src, StringPosition[src, "*)"][[1, 2]]];

(* ------------------------------------------------------------ viewer *)
(* The tabs, worked out once here rather than per frame. Everything the
   Manipulate's body touches has to be a DEFINITION, because SaveDefinitions
   walks the body and saves what it finds: it does NOT look inside an
   Initialization option, so anything reached only from there would be missing
   from the stored output and the viewer would come up dead for a reader who
   never evaluates the notebook. *)
helpers = "\
(* --------------------------------------------------------------- tabs *)
(* Every film group over a wallpaper EXCEPT its trivial clock: the one whose
   symbol is just the wallpaper's own orbifold name, a spatial group carrying
   a time coordinate it does nothing with. There is exactly one per wallpaper,
   so this leaves 258 of the 275. Forward groups first, then time reversal. *)
FG$over[w_] := SortBy[
  Select[Keys[$FG],
    $FG[#][\"Base\"] === w && ! ($FG[#][\"Forward\"] && $FG[#][\"Product\"]) &],
  {If[$FG[#][\"Forward\"], 0, 1] &, ToExpression@StringDrop[#, 1] &}];

FG$tabs = Association[# -> FG$over[#] & /@ $WP[[All, 1]]];

(* The tab captions, worked out now: green for a group that only moves
   forward in time, grey for one with a time reversal. Finished Style
   expressions rather than a function of $FG, so that reading a caption does
   not drag the whole catalog into every stored output. *)
FG$labels = Association[# -> Style[$FG[#][\"Symbol\"],
    If[$FG[#][\"Forward\"], RGBColor[0.18, 0.42, 0.27], GrayLevel[0.3]]] & /@
  Flatten[Values[FG$tabs]]];

(* for reading the catalog by hand: FilmGroupFrame[FilmGroup[\"g248\"], 0.3] *)
FilmGroup[g_String] := Lookup[$FG, g,
  SelectFirst[Values[$FG], #[\"Symbol\"] === g &, $Failed]];

(* what a section shows until the reader picks something else. A default
   DownValue, not an assignment made while the viewer runs: the SetterBar's
   click writes FG$pick[w] and that specific value then wins. *)
FG$pick[w_] := First[FG$tabs[w]];

(* The tab rows, eight setters to a row at most. They all write the same
   value, so whichever row holds the current group is the one that shows a
   selection and the others show none — one exclusive choice across the
   block, which a single SetterBar could not wrap onto several lines. *)
FG$bar[w_] := Column[
  SetterBar[Dynamic[FG$pick[w]], (# -> FG$labels[#]) & /@ #] & /@
    Partition[FG$tabs[w], UpTo[8]],
  Center, 0.3];";

(* One of these per wallpaper. The clock starts stopped -- AnimationRunning ->
   False -- with a progress slider to scrub by hand, and TrackedSymbols :> {}
   keeps the body from being rebuilt on every tick: the tab rows are static
   and the frame is already inside its own Dynamic. *)
viewerFor[hm_] := StringReplace["\
Manipulate[
  Column[{FG$bar[\"WP\"],
          Dynamic@FilmGroupFrame[FG$WP[FG$pick[\"WP\"]], t, {660, 300}]},
   Center, 1],
  {{t, 0, \"t\"}, 0, 1, ControlType -> Animator, AnimationRate -> 1/4,
    AnimationRunning -> False,
    AppearanceElements -> {\"ProgressSlider\", \"PlayPauseButton\"}},
  TrackedSymbols :> {}, SaveDefinitions -> True, ControlPlacement -> Top]",
  "WP" -> hm];

(* ----------------------------------------------------------- notebook *)
refs = "T. J. Fletcher, Film Groups, Math. Gazette 40 (1956) 15\[Dash]19, \
doi:10.2307/3610262.\n\
S. Xu, C. Wu, Space-Time Crystal and Space-Time Group, Phys. Rev. Lett. 120, \
096401 (2018), arXiv:1703.03388.\n\
C. Ke, C. Wu, Two-Dimensional Space-Time Groups: Classification and \
Applications (2026), arXiv:2604.05619 \[LongDash] the 275.\n\
J. H. Conway, H. Burgiel, C. Goodman-Strauss, The Symmetries of Things \
(2008) \[LongDash] orbifold notation.\n\
Atlas and source: https://yaroslavvb.github.io/animated-groups-fable \
\[LongDash] https://github.com/yaroslavvb/animated-groups-fable";

(* ONE initialization cell: the catalog, the wallpaper list, the renderer and
   the tab helpers, so the only other cell in the notebook is the Manipulate.

   InitializationCell -> True tags the cell; InitializationCellEvaluation ->
   True is what asks for it to be run, on open. The warning is deliberately
   left ON: a front end driven headlessly does no open-time evaluation at all
   and goes straight to the Manipulate, which then fails with
   Manipulate::vstype on the undefined $WP, so if the automatic run ever does
   not happen the reader should be asked rather than shown a broken viewer.
   Answering it costs one click and about a twentieth of a second. *)
initCell = StringRiffle[{dataCell, wpCell, src, helpers}, "\n\n"];

(* one section per wallpaper group, headed by its orbifold and IT names *)
sectionFor[{hm_, orb_}] := Cell[CellGroupData[{
  Cell[orb <> " \[CenterDot] " <> hm, "Subsection"],
  Cell[viewerFor[hm], "Input"]}, Open]];

cells = {
  Cell["Film groups", "Title"],
  Cell["258 space-time groups of the plane, by wallpaper group \[LongDash] \
the 17 that do nothing with time are left out. Evaluate the notebook.", "Text"],
  Cell[refs, "Text"],
  Cell[CellGroupData[{
    Cell["Catalog and renderer", "Section"],
    Cell[initCell, "Input", InitializationCell -> True]}, Closed]],
  Cell[CellGroupData[
    Prepend[sectionFor /@ wps, Cell["The 17 wallpaper groups", "Section"]],
    Open]]};

(* wide enough for a full row of eight tabs: the longest of them, p6m's, comes
   to about 1260 pixels *)
nb = Notebook[cells, StyleDefinitions -> "Default.nb", WindowSize -> {1320, 850},
  InitializationCellEvaluation -> True];
Export[outPath, nb, "NB"];
Print["wrote ", outPath, "  ", FileByteCount[outPath], " bytes"];

back = Get[outPath];
Print["round-trips: ", Head[back] === Notebook, "   cells: ", Length[First[back]]];
views = Cases[back, c : Cell[s_String, "Input", ___] /; FreeQ[c, InitializationCell] :> s,
  Infinity];
Print["init cells: ",
  Length@Cases[back, Cell[_String, "Input", ___, InitializationCell -> True, ___], Infinity],
  "   section cells: ", Length[views],
  "   subsections: ", Length@Cases[back, Cell[_, "Subsection", ___], Infinity]];
(* Options[Notebook[...]] reports the SYMBOL's options, not the expression's,
   so check the notebook expression itself *)
Print["evaluates on open: ", ! FreeQ[back, InitializationCellEvaluation -> True],
  "   every section cell is only a Manipulate: ",
  AllTrue[views, StringStartsQ[StringTrim[#], "Manipulate["] &],
  "   none animate on arrival: ",
  AllTrue[views, StringContainsQ[#, "AnimationRunning -> False"] &],
  "   all save definitions: ",
  AllTrue[views, StringContainsQ[#, "SaveDefinitions -> True"] &]];
Print["wallpapers covered: ",
  Union@Flatten@StringCases[views, "FG$bar[\"" ~~ w : WordCharacter .. ~~ "\"]" :> w]];
