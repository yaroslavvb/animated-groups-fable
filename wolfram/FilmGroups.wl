(* ::Package:: *)

(* FilmGroups.wl — the 275 film groups (2+1-dimensional space-time symmetry
   groups) as interactive Mathematica animations.

   A film group acts on spacetime by  g: (x, t) -> (M.x + v, s t + Tau)
   with M a 2x2 integer matrix (lattice coordinates), s = +-1 a time
   direction, and v, Tau fractional translations.  A pattern with that
   symmetry is the orbit of one animated motif: the copy placed by (M | v)
   runs at internal time s (t - Tau).  The motif is an asymmetric vessel
   that fills once per period — a non-rotational clock, so phase and
   orientation stay independent readouts; time-reversed copies drain.

   The catalog (FilmGroupsData.wl, generated from the web catalog) stores
   each group as exact coset representatives modulo Z^2 x Z, so the group
   axioms are machine-verified in exact arithmetic: VerifyFilmGroup.

   Companion to the interactive atlas at
   https://yaroslavvb.github.io/animated-groups-fable                     *)

BeginPackage["FilmGroups`"];

FilmGroupData::usage =
  "FilmGroupData[] returns the catalog of all 275 film groups as a Dataset.\n" <>
  "FilmGroupData[g] returns the catalog entry for group g as an Association; \
g may be an integer 1\[Dash]275, an ID string like \"g17\", or a notation Symbol \
string from the catalog.\n" <>
  "FilmGroupData[g, prop] returns a single property, e.g. \
FilmGroupData[17, \"Generators\"].";

FilmGroupFrame::usage =
  "FilmGroupFrame[g, t] renders one time slice (at time t, in periods) of the \
pattern of film group g as Graphics.  Options: \"Cells\" (window size in \
lattice translations, Automatic | c | {cx, cy}), \"MotifScale\", \"ShowCell\" \
(draw the lattice grid), \"Colors\", Background, ImageSize, PlotLabel.";

FilmGroupFrames::usage =
  "FilmGroupFrames[g, n] returns n frames spanning one period, suitable for \
Export[\"anim.gif\", frames, \"DisplayDurations\" -> 4/n].  Takes the same \
options as FilmGroupFrame.";

FilmGroupAnimation::usage =
  "FilmGroupAnimation[g] returns a Manipulate animating the pattern of film \
group g over one period, with a play/pause Animator (initially paused).  \
Options of FilmGroupFrame, plus AnimationRate (periods per second, default \
1/4), \"Label\" (True shows the group symbol), and SaveDefinitions.";

FilmGroupBrowser::usage =
  "FilmGroupBrowser[] returns a Manipulate for browsing all 275 film groups, \
with a group selector and a time animator.";

FilmGroupMotif::usage =
  "FilmGroupMotif[theta] renders the bare motif at internal time theta (in \
periods): a vessel that fills as theta goes 0 to 1, surface marked in red.";

VerifyFilmGroup::usage =
  "VerifyFilmGroup[g] checks in exact arithmetic that the catalog operations \
of group g are coset representatives of a group modulo Z^2 x Z (identity, \
inverses, closure) and returns <|\"OK\" -> True|False, \"Errors\" -> {...}|>.";

FilmGroups::notfound = "No film group matches `1`.  Specify an integer \
1\[Dash]275, an ID string like \"g17\", or a Symbol string from the catalog \
(first column of FilmGroupData[]).";

Begin["`Private`"];

(* ------------------------------------------------------------ catalog *)

Get[FileNameJoin[{DirectoryName[$InputFileName], "FilmGroupsData.wl"}]];

$groups = FilmGroups`Data`$Groups;

FilmGroupData[] := FilmGroupData[] = Dataset[$groups];

resolve[i_Integer] /; 1 <= i <= Length[$groups] := $groups[[i]];
resolve[id_String] := resolve[id] = Module[{hit},
   hit = SelectFirst[$groups, #ID === id || #Symbol === id &];
   If[MissingQ[hit], $Failed, hit]];
resolve[a_Association] /; KeyExistsQ[a, "Ops"] || KeyExistsQ[a, "ops"] :=
  normalizeSpec[a];
resolve[_] := $Failed;

resolveOrFail[g_] := Module[{e = resolve[g]},
  If[e === $Failed, Message[FilmGroups::notfound, g]];
  e];

(* accept raw render specs in the web catalog's JSON spelling *)
normalizeSpec[a_Association] := <|
  "ID" -> Lookup[a, "ID", "custom-" <> IntegerString[Hash[a], 36]],
  "Symbol" -> Lookup[a, "Symbol", "custom"],
  "Basis" -> Lookup[a, "Basis", Lookup[a, "basis"]],
  "Ops" -> Map[<|"M" -> Lookup[#, "M"],
      "v" -> Lookup[#, "v"],
      "s" -> Lookup[#, "s"],
      "Tau" -> Lookup[#, "Tau", Lookup[#, "tau", 0]]|> &,
    Lookup[a, "Ops", Lookup[a, "ops"]]],
  "BasePoint" -> Lookup[a, "BasePoint", Lookup[a, "base", {0.31, 0.17}]]|>;

FilmGroupData[g_] := resolveOrFail[g];
FilmGroupData[g_, prop_String] := Module[{e = resolveOrFail[g]},
  If[e === $Failed, $Failed, Lookup[e, prop]]];

(* ------------------------------------------- exact group verification *)

composeOp[g1_, g2_] := <|
  "M" -> g1["M"] . g2["M"],
  "v" -> g1["M"] . g2["v"] + g1["v"],
  "s" -> g1["s"] g2["s"],
  "Tau" -> g1["s"] g2["Tau"] + g1["Tau"]|>;

inverseOp[g_] := Module[{mi = Inverse[g["M"]]},
  <|"M" -> mi, "v" -> -mi . g["v"], "s" -> g["s"],
    "Tau" -> -g["s"] g["Tau"]|>];

(* canonical key modulo integer lattice and time translations *)
opKey[g_] := {g["M"], Mod[g["v"], 1], g["s"], Mod[g["Tau"], 1]};

VerifyFilmGroup[g_] := Module[{e = resolveOrFail[g], ops, keys, errors = {}},
  If[e === $Failed, Return[$Failed]];
  ops = Map[MapAt[Rationalize[#, 1*^-6] &, #, {{"v"}, {"Tau"}}] &, e["Ops"]];
  keys = AssociationMap[Automatic &, opKey /@ ops];
  If[Length[keys] =!= Length[ops], AppendTo[errors, "duplicate operations"]];
  If[! KeyExistsQ[keys, {{{1, 0}, {0, 1}}, {0, 0}, 1, 0}],
   AppendTo[errors, "identity missing"]];
  Do[
   If[! KeyExistsQ[keys, opKey[inverseOp[op]]],
    AppendTo[errors, "inverse missing for " <> ToString[opKey[op]]]],
   {op, ops}];
  Do[
   If[! KeyExistsQ[keys, opKey[composeOp[op1, op2]]],
    AppendTo[errors, "closure fails: " <> ToString[opKey[op1]] <> " . " <>
      ToString[opKey[op2]]]],
   {op1, ops}, {op2, ops}];
  <|"OK" -> errors === {}, "Errors" -> errors|>];

(* ------------------------------------------------------------- motif *)

(* The motif is drawn in y-down design coordinates (as on the web site) at
   unit radius; placements apply r * (B.M.Inverse[B]) . {{1,0},{0,-1}}.
   Body spans design y in [bodyTop, bodyBot]; fill level = theta mod 1. *)

$bodyTop = -0.85;
$bodyBot = 0.5;

bezier[p0_, p1_, p2_, p3_] := Table[With[{s = k/16.}, {
    (1 - s)^3 p0[[1]] + 3 (1 - s)^2 s p1[[1]] + 3 (1 - s) s^2 p2[[1]] + s^3 p3[[1]],
    (1 - s)^3 p0[[2]] + 3 (1 - s)^2 s p1[[2]] + 3 (1 - s) s^2 p2[[2]] + s^3 p3[[2]]}],
   {k, 0, 16}];

$unitBody = N @ Join[
    bezier[{-0.15, -0.5}, {0.65, -0.55}, {0.55, 0.28}, {0.05, 0.42}],
    bezier[{0.05, 0.42}, {-0.28, 0.5}, {-0.42, 0.12}, {-0.15, -0.5}]];
$unitBeak = N @ {{-0.15, -0.5}, {0.1, -0.85}, {0.22, -0.45}};
$unitPolys = {$unitBody, $unitBeak};

(* Sutherland-Hodgman clip to the half-plane y >= y0 (the liquid) *)
clipBelow[poly_, y0_] := Module[{out = {}, n = Length[poly], a, b, ain, bin, s},
  Do[
   a = poly[[i]]; b = poly[[Mod[i, n] + 1]];
   ain = a[[2]] >= y0; bin = b[[2]] >= y0;
   If[ain, AppendTo[out, a]];
   If[ain =!= bin,
    s = (y0 - a[[2]])/(b[[2]] - a[[2]]);
    AppendTo[out, {a[[1]] + s (b[[1]] - a[[1]]), y0}]],
   {i, n}];
  out];

surfaceSegment[cp_, y0_] := Module[{xs},
  xs = Select[cp, Abs[#[[2]] - y0] < 1*^-9 &][[All, 1]];
  If[Length[xs] >= 2, {{Min[xs], y0}, {Max[xs], y0}}, Nothing]];

$defaultColors = <|
  "Body" -> RGBColor["#dbe6f2"], "Outline" -> RGBColor["#7d93ab"],
  "Fill" -> RGBColor["#3b6ea5"], "Line" -> RGBColor["#c0392b"],
  "Background" -> RGBColor["#faf9f6"], "Grid" -> GrayLevel[0.82]|>;

FilmGroupMotif[theta_?NumericQ, r : _?NumericQ : 1] := Module[
  {flip = {{r, 0}, {0, -r}}, ph, yl, cps, segs, c = $defaultColors},
  ph = Mod[theta, 1.]; yl = $bodyBot - ph ($bodyBot - $bodyTop);
  cps = Select[clipBelow[#, yl] & /@ $unitPolys, Length[#] >= 3 &];
  segs = surfaceSegment[#, yl] & /@ cps;
  Graphics[{
    FaceForm[c["Body"]], EdgeForm[{c["Outline"], AbsoluteThickness[1.5]}],
    Polygon[Map[flip . # &, $unitPolys, {2}]],
    c["Fill"], EdgeForm[None],
    If[cps === {}, Nothing, Polygon[Map[flip . # &, cps, {2}]]],
    c["Line"], AbsoluteThickness[3],
    If[segs === {}, Nothing, Line[Map[flip . # &, segs, {2}]]]},
   PlotRange -> 1.1 r, ImageSize -> Small]];

(* ---------------------------------------------------------- geometry *)

(* Window size in lattice translations, chosen (as on the web site) so that
   roughly 16 motif copies are visible: sparse cells get more repeats,
   dense ones fewer.  Sites are counted by distinct spatial part, since
   time-reversal partners share a site and draw superimposed. *)
autoCells[spec_] := Module[{nSites, bdet},
  nSites = Length @ DeleteDuplicates @ Map[
     {#M, Round[1*^6 Mod[N[#v], 1]]} &, spec["Ops"]];
  bdet = Abs @ Det @ N @ spec["Basis"];
  Clip[Sqrt[16. bdet/nSites], {1.3, 3.}]];

(* Static per-group geometry: placements of the motif orbit over the window,
   motif radius from the minimum orbit distance (stamps must not overlap:
   painting is layered but overlap would still break exact invariance). *)
staticGeometry[spec_, cells_, motifScale_] := Module[
  {basis, a1, a2, bcols, binv, base, cx, cy, sites, minD, r, tf,
   m1lo, m1hi, m2lo, m2hi, placements, bodyPolys},
  basis = N[spec["Basis"]]; {a1, a2} = basis;
  bcols = Transpose[basis]; binv = Inverse[bcols];
  base = N @ Lookup[spec, "BasePoint", {0.31, 0.17}];
  {cx, cy} = If[ListQ[cells], N[cells], {N[cells], N[cells]}];
  (* motif radius: site coordinates mod 1, with a {0,1} shift window to
     cover all relative lattice offsets *)
  sites = Flatten[Table[
     Mod[N[#M . base + #v], 1] + {m1, m2}, {m1, 0, 1}, {m2, 0, 1}] & /@
     spec["Ops"], 2];
  minD = Min[Min[Norm[a1], Norm[a2]],
    Min @ Map[Norm[(#[[1]] - #[[2]]) . basis] &,
      Select[Subsets[sites, {2}], Norm[#[[1]] - #[[2]]] > 1*^-6 &]]];
  r = Min[0.30 Min[Norm[a1], Norm[a2]], 0.60 minD] motifScale;
  (* lattice window covering the view rectangle, with margin *)
  {m1lo, m1hi, m2lo, m2hi} = latticeWindow[binv, cx, cy];
  placements = Flatten @ Table[
     Module[{pos, mat},
      pos = (N[op["M"] . base + op["v"]] + {m1, m2}) . basis;
      If[Abs[pos[[1]]] > cx/2 + 3 r || Abs[pos[[2]]] > cy/2 + 3 r,
       Nothing,
       mat = r bcols . op["M"] . binv . {{1, 0}, {0, -1}};
       <|"Mat" -> mat, "Pos" -> pos, "S" -> op["s"], "Tau" -> N[op["Tau"]]|>]],
     {op, spec["Ops"]}, {m1, m1lo, m1hi}, {m2, m2lo, m2hi}];
  bodyPolys = Flatten[Map[Function[pl,
      Map[pl["Mat"] . # + pl["Pos"] &, $unitPolys, {2}]], placements], 1];
  <|"Placements" -> placements, "R" -> r, "Basis" -> basis,
    "BodyPolys" -> bodyPolys, "Window" -> {cx, cy},
    "LatticeRanges" -> {m1lo, m1hi, m2lo, m2hi},
    "PlotRange" -> {{-cx/2, cx/2}, {-cy/2, cy/2}},
    (* placements grouped by internal-time class (s, tau): the liquid shape
       is clipped once per class per frame, then affine-mapped per copy *)
    "Classes" -> Map[
      <|"S" -> #[[1, "S"]], "Tau" -> #[[1, "Tau"]],
        "MatTs" -> Transpose /@ #[[All, "Mat"]],
        "Poss" -> #[[All, "Pos"]]|> &,
      GatherBy[placements, {#S, #Tau} &]]|>];

latticeWindow[binv_, cx_, cy_] := Module[{ms, pad = 1.6},
  ms = (binv . ({cx, cy} #/2)) & /@ Tuples[{-1, 1}, 2];
  {Floor[Min[ms[[All, 1]]] - pad], Ceiling[Max[ms[[All, 1]]] + pad],
   Floor[Min[ms[[All, 2]]] - pad], Ceiling[Max[ms[[All, 2]]] + pad]}];

geometryCache[id_, cells_, motifScale_] := geometryCache[id, cells, motifScale] =
  staticGeometry[resolve[id], cells, motifScale];

geometryFor[spec_, cellsOpt_, motifScale_] := Module[
  {cells = If[cellsOpt === Automatic, autoCells[spec], cellsOpt]},
  If[StringQ[spec["ID"]],
   geometryCache[spec["ID"], cells, motifScale],
   staticGeometry[spec, cells, motifScale]]];

(* ------------------------------------------------------ frame drawing *)

(* One time slice from precomputed geometry.  Painting is layered — all
   vessels, then all liquid, then all surface lines — so it is
   order-independent and coincident copies (time-reversal partners share a
   site) superimpose both surface lines instead of occluding one another. *)
iRenderFrame[static_, t_, colors_, showCell_, background_, imageSize_, label_] :=
 Module[{r, wx, wy, fills, segs, grid, thO, thL, c},
  c = colors; r = static["R"]; {wx, wy} = static["Window"];
  thO = Max[0.045 r/wx, 0.0012]; thL = Max[0.09 r/wx, 0.0025];
  {fills, segs} = Map[Flatten[#, 1] &] @ Transpose @ Table[
     Module[{ph, yl, cps, ss, matTs = cls["MatTs"], poss = cls["Poss"]},
      ph = Mod[cls["S"] (t - cls["Tau"]), 1.];
      yl = $bodyBot - ph ($bodyBot - $bodyTop);
      cps = Select[clipBelow[#, yl] & /@ $unitPolys, Length[#] >= 3 &];
      ss = surfaceSegment[#, yl] & /@ cps;
      {Flatten[Table[cp . matTs[[i]] + ConstantArray[poss[[i]], Length[cp]],
         {i, Length[matTs]}, {cp, cps}], 1],
       Flatten[Table[sg . matTs[[i]] + ConstantArray[poss[[i]], 2],
         {i, Length[matTs]}, {sg, ss}], 1]}],
     {cls, static["Classes"]}];
  grid = If[showCell,
    Module[{m1lo, m1hi, m2lo, m2hi, a1, a2},
     {m1lo, m1hi, m2lo, m2hi} = static["LatticeRanges"];
     {a1, a2} = static["Basis"];
     {c["Grid"], AbsoluteThickness[0.6],
      Table[Line[{m1 a1 + m2lo a2, m1 a1 + m2hi a2}], {m1, m1lo, m1hi}],
      Table[Line[{m1lo a1 + m2 a2, m1hi a1 + m2 a2}], {m2, m2lo, m2hi}]}],
    Nothing];
  Graphics[{
    grid,
    FaceForm[c["Body"]], EdgeForm[{c["Outline"], Thickness[thO]}],
    Polygon[static["BodyPolys"]],
    c["Fill"], EdgeForm[None], If[fills === {}, Nothing, Polygon[fills]],
    c["Line"], Thickness[thL],
    If[segs === {}, Nothing, Line[segs]]},
   PlotRange -> static["PlotRange"], PlotRangeClipping -> True,
   PlotRangePadding -> 0, AspectRatio -> Automatic,
   Background -> If[background === Automatic, c["Background"], background],
   ImageSize -> imageSize, PlotLabel -> label]];

Options[FilmGroupFrame] = {
  "Cells" -> Automatic, "MotifScale" -> 1, "ShowCell" -> False,
  "Colors" -> <||>, Background -> Automatic, ImageSize -> 360,
  PlotLabel -> None};

FilmGroupFrame[g_, t_?NumericQ, opts : OptionsPattern[]] := Module[
  {spec = resolveOrFail[g], static, colors},
  If[spec === $Failed, Return[$Failed]];
  static = geometryFor[spec, OptionValue["Cells"], OptionValue["MotifScale"]];
  colors = Join[$defaultColors, Association @ OptionValue["Colors"]];
  iRenderFrame[static, N[t], colors, TrueQ @ OptionValue["ShowCell"],
   OptionValue[Background], OptionValue[ImageSize], OptionValue[PlotLabel]]];

Options[FilmGroupFrames] = Options[FilmGroupFrame];

FilmGroupFrames[g_, n_Integer?Positive, opts : OptionsPattern[]] :=
  Table[FilmGroupFrame[g, k/n, opts], {k, 0, n - 1}];

(* --------------------------------------------------------- animation *)

Options[FilmGroupAnimation] = Join[Options[FilmGroupFrame], {
   AnimationRate -> 1/4, "Label" -> True, SaveDefinitions -> True}];

FilmGroupAnimation[g_, opts : OptionsPattern[]] := Module[
  {spec = resolveOrFail[g], static, colors, label, rate, sd},
  If[spec === $Failed, Return[$Failed]];
  static = geometryFor[spec, OptionValue["Cells"], OptionValue["MotifScale"]];
  colors = Join[$defaultColors, Association @ OptionValue["Colors"]];
  label = Which[
    OptionValue[PlotLabel] =!= None, OptionValue[PlotLabel],
    TrueQ @ OptionValue["Label"] && KeyExistsQ[spec, "System"],
    Style[Row[{spec["Symbol"], "   (", spec["System"], ", from ",
       spec["BaseWallpaperGroup"], ")"}], "Text", 12, GrayLevel[0.25]],
    True, None];
  rate = N @ OptionValue[AnimationRate];
  sd = OptionValue[SaveDefinitions];
  With[{st = static, cl = colors, lb = label, rt = rate,
    sc = TrueQ @ OptionValue["ShowCell"], bg = OptionValue[Background],
    is = OptionValue[ImageSize]},
   Manipulate[
    FilmGroups`Private`iRenderFrame[st, t, cl, sc, bg, is, lb],
    {{t, 0., "time"}, 0., 1., ControlType -> Animator,
     AnimationRate -> rt, AnimationRunning -> False,
     AppearanceElements -> {"ProgressSlider", "PlayPauseButton"}},
    SaveDefinitions -> sd, FrameMargins -> 2]]];

FilmGroupBrowser[] := With[{n = Length[$groups],
   labels = MapIndexed[First[#2] ->
       Row[{First[#2], ": ", #Symbol, "   (", #System, ", from ",
         #BaseWallpaperGroup, ")"}] &, $groups]},
  Manipulate[
   FilmGroupFrame[k, t, "ShowCell" -> grid, PlotLabel ->
     Style[Row[{FilmGroupData[k, "Symbol"], "   \[LongDash]   ",
        FilmGroupData[k, "System"], ", from ",
        FilmGroupData[k, "BaseWallpaperGroup"]}], "Text", 12]],
   {{k, 1, "group"}, labels, ControlType -> PopupMenu},
   {{t, 0., "time"}, 0., 1., ControlType -> Animator,
    AnimationRate -> 1/4, AnimationRunning -> False,
    AppearanceElements -> {"ProgressSlider", "PlayPauseButton"}},
   {{grid, False, "show lattice"}, {True, False}},
   TrackedSymbols :> {k, t, grid}, FrameMargins -> 2]];

End[];
EndPackage[];
