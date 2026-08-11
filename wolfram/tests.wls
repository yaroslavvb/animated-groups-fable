#!/usr/bin/env wolframscript
(* ::Package:: *)

(* tests.wls — test suite for FilmGroups.wl, run with
     wolframscript -f tests.wls [outdir]
   Exports sample frames/GIF to outdir (default: ./out-test).           *)

dir = DirectoryName[$InputFileName];
outDir = If[Length[$ScriptCommandLine] >= 2, $ScriptCommandLine[[2]],
   FileNameJoin[{dir, "out-test"}]];
If[! DirectoryQ[outDir], CreateDirectory[outDir]];

fails = 0;
check[label_, cond_] := If[TrueQ[cond],
   Print["  ok    ", label],
   fails++; Print["  FAIL  ", label]];
fmt[x_] := ToString @ N @ Round[x, 0.001];

Print["[1] load package"];
tLoad = First @ AbsoluteTiming[Get[FileNameJoin[{dir, "FilmGroups.wl"}]]];
Print["  loaded in ", fmt[tLoad], " s"];
check["catalog has 275 groups", Length[Normal @ FilmGroupData[]] === 275];
check["meta agrees", FilmGroups`Data`$Meta["total"] === 275];

Print["[2] lookup"];
check["by index", FilmGroupData[1]["ID"] === "g1"];
check["by id", FilmGroupData["g17"]["Index"] === 17];
check["by symbol", FilmGroupData[FilmGroupData[137]["Symbol"]]["Index"] === 137];
check["property access", StringQ @ FilmGroupData[42, "System"]];
Block[{$MessageList = {}},
  Quiet[bad = FilmGroupData["nonsense-xyz"], FilmGroups::notfound];
  check["bad name -> $Failed", bad === $Failed]];

Print["[3] exact group axioms, all 275 groups"];
tVer = First @ AbsoluteTiming[
   verdicts = Table[VerifyFilmGroup[k], {k, 275}]];
badV = Position[verdicts, KeyValuePattern["OK" -> False], {1}, Heads -> False];
Print["  verified in ", fmt[tVer], " s"];
check["all 275 satisfy group axioms", badV === {}];
If[badV =!= {},
  Do[Print["   axioms fail for #", First[p], ": ",
     verdicts[[First[p]]]["Errors"]], {p, Take[badV, UpTo[5]]}]];

(* sample groups spanning the catalog's variety *)
pick[crit_, lbl_] := Module[{i = SelectFirst[Normal @ FilmGroupData[], crit]},
  Print["  sample (", lbl, "): #", i["Index"], "  ", i["ID"], "  ", i["Symbol"],
   "  [", i["System"], ", ", i["BaseWallpaperGroup"], ", ",
   Length[i["Ops"]], " ops]"];
  i["Index"]];
samples = {
  pick[#BaseWallpaperGroup === "p1" &, "p1 product"],
  pick[! #ForwardTime && MemberQ[#Ops[[All, "s"]], -1] &, "time reversal"],
  pick[#BaseWallpaperGroup === "p4" && ! #Symmorphic &, "p4 time screw"],
  pick[#Bravais =!= "P" &, "centred lattice"],
  pick[Length[#Ops] === 36 &, "densest (36 ops)"],
  pick[#BaseWallpaperGroup === "pgg" &, "pgg-based"]};

Print["[4] placement-level frame invariance"];
(* For every group element g (cartesian spatial part Tg, vg): applying g to
   the set of placed motif copies of the frame at time t must reproduce the
   placements of the frame at time  s_g t + tau_g,  matching position,
   orientation matrix, and internal time.  Checked away from the window
   edge, where the placement sets are complete. *)
invariantQ[idx_, t_] := Module[
  {e, spec, static, basis, bcols, binv, ok = True, tg, vgc, t2, pls, r, cx, cy},
  e = FilmGroupData[idx];
  static = FilmGroups`Private`geometryFor[e, Automatic, 1];
  basis = N[e["Basis"]]; bcols = Transpose[basis]; binv = Inverse[bcols];
  pls = static["Placements"]; r = static["R"];
  {cx, cy} = static["Window"];
  Do[
   tg = bcols . op["M"] . binv; vgc = bcols . N[op["v"]];
   t2 = op["s"] t + N[op["Tau"]];
   Do[
    Module[{pos2, mat2, th1, match},
     pos2 = tg . pl["Pos"] + vgc;
     (* only test images that land well inside the covered window *)
     If[Abs[pos2[[1]]] > cx/2 || Abs[pos2[[2]]] > cy/2, Continue[]];
     mat2 = tg . pl["Mat"];
     th1 = Mod[pl["S"] (t - pl["Tau"]), 1.];
     match = SelectFirst[pls,
       Norm[#Pos - pos2] < 1*^-6 && Norm[#Mat - mat2, "Frobenius"] < 1*^-6 &&
         Abs[Mod[#S (t2 - #Tau), 1.] - th1] < 1*^-6 &];
     If[MissingQ[match], ok = False]],
    {pl, pls}],
   {op, e["Ops"]}];
  ok];
Do[check["frame invariance, group #" <> ToString[k], invariantQ[k, 0.137]],
  {k, samples}];

Print["[5] rendering"];
Do[
  Module[{g, png, tR},
   {tR, g} = AbsoluteTiming @ FilmGroupFrame[k, 0.3];
   check["frame renders, #" <> ToString[k],
    Head[g] === Graphics && FreeQ[g, $Failed]];
   png = FileNameJoin[{outDir, "wl-g" <> ToString[k] <> ".png"}];
   Export[png, g, ImageSize -> 480];
   check["png exports, #" <> ToString[k], FileByteCount[png] > 10000]],
  {k, samples}];
(* cold + warm timing on the densest sample *)
dense = samples[[5]];
t1 = First @ AbsoluteTiming[FilmGroupFrame[dense, 0.11, "Cells" -> 2.5]];
t2 = First @ AbsoluteTiming[FilmGroupFrame[dense, 0.12, "Cells" -> 2.5]];
Print["  frame timing (36-op group): cold ", fmt[t1], " s, warm ", fmt[t2], " s"];
check["warm frame under 150 ms", t2 < 0.15];

Print["[6] options"];
g = FilmGroupFrame[samples[[3]], 0.25, "Cells" -> {4, 2}, "ShowCell" -> True,
   "MotifScale" -> 0.8, Background -> White];
check["options accepted", Head[g] === Graphics];
check["window honours Cells {4,2}",
  (PlotRange /. Options[g, PlotRange]) === {{-2., 2.}, {-1., 1.}}];
check["frames list", Length[FilmGroupFrames[1, 8]] === 8 &&
   MatchQ[FilmGroupFrames[1, 8], {__Graphics}]];
(* raw render specs in the web catalog's JSON spelling *)
rawSpec = <|"basis" -> {{1, 0}, {0, 1}}, "base" -> {0.31, 0.17},
   "ops" -> {
     <|"M" -> {{1, 0}, {0, 1}}, "v" -> {0, 0}, "s" -> 1, "tau" -> 0.|>,
     <|"M" -> {{-1, 0}, {0, -1}}, "v" -> {0, 0}, "s" -> 1, "tau" -> 0.5|>}|>;
rawG = FilmGroupFrame[rawSpec, 0.4];
(* every Polygon must carry an explicit list of numeric point matrices —
   catches unevaluated junk like Polygon[fills$nnn] from a broken pipeline *)
rawPolys = Cases[rawG, Polygon[a_] :> a, Infinity];
check["raw spec renders", Head[rawG] === Graphics && FreeQ[rawG, $Failed] &&
   rawPolys =!= {} && AllTrue[rawPolys, VectorQ[#, MatrixQ] &]];
check["raw spec verifies", VerifyFilmGroup[rawSpec]["OK"]];
(* float-valued raw spec (JSON sources may deliver reals throughout) *)
floatSpec = MapAt[N, rawSpec, "basis"];
floatSpec["ops"] = Map[MapAt[N, #, "M"] &, floatSpec["ops"]];
check["float raw spec verifies", VerifyFilmGroup[floatSpec]["OK"]];
(* degenerate window: every placement culled must yield a clean empty frame *)
tinyG = Quiet @ FilmGroupFrame[2, 0.3, "Cells" -> 0.2, "MotifScale" -> 0.05];
check["degenerate window renders clean",
  Head[tinyG] === Graphics && FreeQ[tinyG, Transpose] && FreeQ[tinyG, $Failed]];

Print["[7] animation constructors"];
m = FilmGroupAnimation[samples[[3]]];
check["FilmGroupAnimation -> Manipulate", Head[m] === Manipulate];
b = FilmGroupBrowser[];
check["FilmGroupBrowser -> Manipulate", Head[b] === Manipulate];
check["motif renders", Head[FilmGroupMotif[0.42]] === Graphics];

Print["[8] GIF export"];
gifPath = FileNameJoin[{outDir, "wl-sample.gif"}];
tG = First @ AbsoluteTiming[
   Export[gifPath, FilmGroupFrames[samples[[3]], 20, ImageSize -> 240],
    "DisplayDurations" -> 0.2, "AnimationRepetitions" -> Infinity]];
check["gif exports", FileByteCount[gifPath] > 20000];
Print["  gif: ", FileByteCount[gifPath], " bytes in ", fmt[tG], " s"];

Print[];
If[fails === 0,
  Print["ALL TESTS PASSED"],
  Print[fails, " TEST(S) FAILED"]; Exit[1]];
