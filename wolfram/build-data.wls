#!/usr/bin/env wolframscript
(* ::Package:: *)

(* build-data.wls — regenerate FilmGroupsData.wl from ../docs/data/catalog.json.

   The JSON catalog stores translation parts and time shifts as decimal
   floats; here they are restored to exact rationals (halves, quarters,
   thirds, sixths), and the hexagonal basis to {{1,0},{-1/2,Sqrt[3]/2}},
   so that the group axioms can be verified in exact arithmetic.

   Usage:  wolframscript -f build-data.wls                                  *)

dir = DirectoryName[$InputFileName];
catalogPath = FileNameJoin[{dir, "..", "docs", "data", "catalog.json"}];
outPath = FileNameJoin[{dir, "FilmGroupsData.wl"}];

(* decode explicitly from bytes: wolframscript's default file decoding can
   depend on the terminal locale, which mangles the notation symbols *)
json = ImportByteArray[ReadByteArray[catalogPath], "RawJSON"];
groups = json["groups"];
Print["catalog: ", Length[groups], " groups"];

(* fractions in the render specs are k/12 or k/4 etc.; 10^-4 tolerance
   recovers them exactly from the 6-decimal JSON floats *)
exactFrac[x_] := Module[{r = Rationalize[x, 1*^-4]},
  If[Denominator[r] > 12, Throw[{"bad fraction", x}], r]];

exactBasis[b_] := Which[
  Norm[N[b - {{1, 0}, {0, 1}}]] < 1*^-9, {{1, 0}, {0, 1}},
  Norm[N[b - {{1, 0}, {-1/2, Sqrt[3]/2}}]] < 1*^-9, {{1, 0}, {-1/2, Sqrt[3]/2}},
  True, Throw[{"unrecognized basis", b}]];

convertOp[op_] := <|
  "M" -> Round[op["M"]],
  "v" -> exactFrac /@ op["v"],
  "s" -> Round[op["s"]],
  "Tau" -> exactFrac[op["tau"]]
|>;

convertGroup[g_, i_] := <|
  "Index" -> i,
  "ID" -> g["id"],
  "Symbol" -> g["symbol"],
  "Class" -> g["cls"],
  "HM" -> g["hm"],
  "System" -> g["system"],
  "Bravais" -> g["bravais"],
  "BaseWallpaperGroup" -> g["base"],
  "ForwardTime" -> g["forward"],
  "Product" -> g["product"],
  "Symmorphic" -> g["symmorphic"],
  "Generators" -> g["generators"],
  "Notes" -> g["notes"],
  "Basis" -> exactBasis[g["render"]["basis"]],
  "Ops" -> convertOp /@ g["render"]["ops"],
  "BasePoint" -> g["render"]["base"]
|>;

result = Catch[MapIndexed[convertGroup[#1, First[#2]] &, groups]];
If[! MatchQ[result, {__Association}],
  Print["CONVERSION FAILED: ", result]; Exit[1]];

meta = json["meta"];

header = "(* ::Package:: *)\n\n" <>
  "(* FilmGroupsData.wl — catalog of the 275 film groups (2+1-dimensional\n" <>
  "   space-time symmetry groups).  AUTO-GENERATED from docs/data/catalog.json\n" <>
  "   by build-data.wls; do not edit by hand.\n\n" <>
  "   Each entry is an Association; \"Ops\" lists coset representatives\n" <>
  "   {M, v, s, Tau} of the group modulo Z^2 (lattice) x Z (time period),\n" <>
  "   acting on spacetime as (x, t) -> (M.x + v, s t + Tau) with x, v in\n" <>
  "   lattice coordinates and t, Tau in units of the time period.  All\n" <>
  "   group data is exact (integers, rationals, Sqrt[3]/2). *)\n\n";

str = header <>
  "FilmGroups`Data`$Meta = " <> ToString[meta, InputForm] <> ";\n\n" <>
  "FilmGroups`Data`$Groups = " <> ToString[result, InputForm] <> ";\n";

(* emit pure ASCII: escape every non-ASCII character as \:xxxx so the data
   file is immune to encoding settings wherever it is read *)
str = StringJoin @ Map[
   If[# > 126, "\\:" <> IntegerString[#, 16, 4], FromCharacterCode[#]] &,
   ToCharacterCode[str]];

Export[outPath, str, "Text"];
Print["wrote ", outPath, " (", FileByteCount[outPath], " bytes)"];

(* sanity: re-read and count *)
Get[outPath];
Print["reloaded: ", Length[FilmGroups`Data`$Groups], " groups; meta total = ",
  FilmGroups`Data`$Meta["total"]];
