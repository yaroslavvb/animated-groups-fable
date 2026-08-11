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

dataCell = StringJoin["$FG=<|\n",
  StringRiffle[entry /@ groups, ",\n"], "\n|>;"];

(* the 17 wallpaper groups, orbifold name and count, in the atlas's order *)
wps = {{"p1", "o"}, {"p2", "2222"}, {"pm", "**"}, {"pg", "\[Times]\[Times]"},
  {"cm", "*\[Times]"}, {"pmm", "*2222"}, {"pmg", "22*"}, {"pgg", "22\[Times]"},
  {"cmm", "2*22"}, {"p4", "442"}, {"p4m", "*442"}, {"p4g", "4*2"},
  {"p3", "333"}, {"p3m1", "*333"}, {"p31m", "3*3"}, {"p6", "632"},
  {"p6m", "*632"}};

wpCell = "$WP=" <> wl[wps] <> ";";

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
(* Tab order, as in the atlas: the groups that do something with time first,
   the trivial clock (identical to its wallpaper group) last of that run and
   greyed, then the groups with time reversal. *)
FG$rank[g_] := Which[! g[\"Forward\"], 2, g[\"Product\"], 1, True, 0];

FG$over[w_] := SortBy[Select[Keys[$FG], $FG[#][\"Base\"] === w &],
  {FG$rank[$FG[#]] &, ToExpression@StringDrop[#, 1] &}];

FG$tabs = Association[# -> FG$over[#] & /@ $WP[[All, 1]]];

FG$label[g_] := Style[$FG[g][\"Symbol\"],
  Which[$FG[g][\"Product\"] && $FG[g][\"Forward\"], GrayLevel[0.6],
        $FG[g][\"Forward\"], RGBColor[0.18, 0.42, 0.27],
        True, GrayLevel[0.3]]];

(* what a wallpaper's tab row shows until the reader picks something else.
   A default DownValue, not an assignment made while the viewer runs: the
   SetterBar's click writes FG$pick[w] and that specific value then wins. *)
FG$pick[w_] := First[FG$tabs[w]];";

viewer = "\
Manipulate[
  Column[{
    SetterBar[Dynamic[FG$pick[w]], (# -> FG$label[#]) & /@ FG$tabs[w]],
    Dynamic@FilmGroupFrame[FG$pick[w], t, {660, 300}]},
   Center, 1],
  {{w, \"p6\", \"\"}, #[[1]] -> Row[{Style[#[[2]], Bold], \" \", #[[1]]}] & /@ $WP,
    ControlType -> SetterBar},
  {{t, 0, \"t\"}, 0, 1, ControlType -> Animator, AnimationRate -> 1/4,
    AppearanceElements -> {\"PlayPauseButton\"}},
  TrackedSymbols :> {w},   (* the clock redraws the frame, not the tab row *)
  SaveDefinitions -> True, ControlPlacement -> Top]";

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

cells = {
  Cell["Film groups", "Title"],
  Cell["The 275 space-time groups of the plane, by wallpaper group. \
Evaluate the animation below.", "Text"],
  Cell[refs, "Text"],
  Cell[CellGroupData[{
    Cell["Catalog and renderer", "Section"],
    Cell[initCell, "Input", InitializationCell -> True]}, Closed]],
  Cell["The 17 wallpaper groups", "Section"],
  Cell[viewer, "Input"]};

nb = Notebook[cells, StyleDefinitions -> "Default.nb", WindowSize -> {1000, 800},
  InitializationCellEvaluation -> True];
Export[outPath, nb, "NB"];
Print["wrote ", outPath, "  ", FileByteCount[outPath], " bytes"];

back = Get[outPath];
Print["round-trips: ", Head[back] === Notebook, "   cells: ", Length[First[back]]];
Print["init cells: ",
  Length@Cases[back, Cell[_String, "Input", ___, InitializationCell -> True, ___], Infinity],
  "   plain Input cells: ",
  Length@Cases[back, c : Cell[_String, "Input", ___] /; FreeQ[c, InitializationCell], Infinity]];
(* Options[Notebook[...]] reports the SYMBOL's options, not the expression's,
   so check the notebook expression itself *)
Print["evaluates on open: ", ! FreeQ[back, InitializationCellEvaluation -> True],
  "   viewer cell is only the Manipulate: ",
  StringStartsQ[StringTrim@Last@Cases[
    back, c : Cell[s_String, "Input", ___] /; FreeQ[c, InitializationCell] :> s, Infinity],
    "Manipulate["]];
