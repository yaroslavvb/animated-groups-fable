(* guide-src.wl — the renderer embedded verbatim into FilmGroupsGuide.nb by
   make-guide.wls. It is self-contained: a frame is drawn from one group's
   Association, and nothing here reaches the catalog.

   A port of docs/js/renderer.js. Canvas convention there is y-DOWN; here the
   pixel basis keeps y up, the motif outline is reflected once at build time,
   and a canvas angle a is drawn at -a. Everything else is the same arithmetic
   with the same constants, so a frame matches the browser's. *)

(* ---------------------------------------------------------------- motif *)
(* thick comma: five cubics, sampled, recentred on its bounding box, scaled to
   circumradius 0.64, and reflected into y-up *)
FG$bez[{p0_, p1_, p2_, p3_}] :=
  Table[(1 - u)^3 p0 + 3 (1 - u)^2 u p1 + 3 (1 - u) u^2 p2 + u^3 p3,
        {u, 0, 1, 1/24}];

FG$comma = With[
  {pts = Flatten[FG$bez /@ {
     {{0.40, -0.30}, {0.52, 0.18}, {0.32, 0.56}, {-0.52, 0.74}},
     {{-0.52, 0.74}, {-0.10, 0.52}, {0.18, 0.26}, {0.06, 0.02}},
     {{0.06, 0.02}, {-0.14, 0.02}, {-0.40, -0.10}, {-0.40, -0.30}},
     {{-0.40, -0.30}, {-0.40, -0.54}, {-0.22, -0.68}, {0.00, -0.68}},
     {{0.00, -0.68}, {0.24, -0.68}, {0.40, -0.54}, {0.40, -0.30}}}, 1]},
  With[{c = (Min /@ Transpose[pts] + Max /@ Transpose[pts])/2},
    With[{k = 0.64/Max[Norm[# - c] & /@ pts]},
      {1, -1} # & /@ (k (# - c) & /@ pts)]]];

{FG$bot, FG$top} = MinMax[FG$comma[[All, 2]]];   (* y-up: bot < top *)

(* Sutherland-Hodgman against a horizontal half-plane. Written without
   AppendTo: this runs over every vertex of every motif of every frame.
   Consecutive duplicate vertices (the sampled cubics share endpoints) are
   safe — they always agree on the test, so the edge is never split. *)
FG$clip[poly_, y0_, below_] := Module[{keep},
  keep = If[below, #[[2]] <= y0 &, #[[2]] >= y0 &];
  Flatten[MapThread[
    Function[{a, b}, Module[{ai = keep[a], u},
      If[ai === keep[b],
        If[ai, {a}, {}],
        u = (y0 - a[[2]])/(b[[2]] - a[[2]]);
        If[ai, {a, a + u (b - a)}, {a + u (b - a)}]]]],
    {poly, RotateLeft[poly]}], 1]];

(* CONTINUOUS ONE-WAY WIPE: a sweep line crosses the comma once per half
   period, always the same way; the colour is behind it while filling and
   ahead of it while emptying, so the loop closes without a jump and the map
   theta -> coloured region stays injective on [0,1). *)
FG$motif[theta_, r_, layer_] := Module[
  {ph = Mod[theta, 1], rising, p, yl, poly, cp},
  rising = ph < 1/2;  p = Mod[2 ph, 1];
  yl = (FG$bot + p (FG$top - FG$bot)) r;
  poly = r # & /@ FG$comma;
  Switch[layer,
    "body", {FG$col["Body"], EdgeForm[{FG$col["Outline"],
             AbsoluteThickness[Max[0.6, 0.045 r]]}], Polygon[poly]},
    (* canvas fills BELOW the sweep line while rising; below on screen is
       smaller y here, which is what FG$clip's `below` keeps *)
    _, cp = FG$clip[poly, yl, rising];
       If[Length[cp] >= 3, {FG$col["Fill"], EdgeForm[None], Polygon[cp]}, {}]]];

(* ----------------------------------------------------------- phase ring *)
(* A fixed ruler of n arcs with a hand riding it: the point sits at turn
   theta, so it sweeps one turn per period at constant speed, and which
   interval the copy is in is read off from where the point is. Drawn in
   SCREEN coordinates — never rotated with its copy — so one interval is one
   arc on every copy. Which way it sweeps is the copy's direction of time. *)
FG$at[a_, rad_] := rad {Cos[a], -Sin[a]};        (* canvas angle -> y-up point *)

FG$ring[theta_, r_, n_, s_] := Module[
  {gap, rr, lw, tip, head, base, tail, a0, a1},
  If[r < 6.5, Return[{}]];
  gap = Min[0.125/n, 0.022] 2 Pi;  rr = 0.76 r;  lw = Max[1.1, 0.12 r];
  {If[r >= 9,
     tip = -Pi/2 + Mod[theta, 1] 2 Pi;
     head = 1.7 lw/rr;  base = tip - s head;  tail = base - s head 1.4;
     {a0, a1} = MinMax[{base, tail}];
     {FG$col["BeatOn"], AbsoluteThickness[lw], CapForm["Butt"],
      Circle[{0, 0}, rr, {-a1, -a0}],
      Polygon[{FG$at[base, rr - 1.15 lw], FG$at[base, rr + 1.15 lw],
               FG$at[tip, rr]}]},
     {}],
   {Opacity[0.4], FG$col["BeatOff"], AbsoluteThickness[lw], CapForm["Butt"],
    Table[With[{b0 = -Pi/2 + (k/n) 2 Pi + gap, b1 = -Pi/2 + ((k + 1)/n) 2 Pi - gap},
      Circle[{0, 0}, rr, {-b1, -b0}]], {k, 0, n - 1}]}}];

(* ------------------------------------------------------- time structure *)
(* N: the intervals the loop's distinguished instants cut the period into —
   the beat k/B from the time translations, together with the fixed points
   tau/2, tau/2 + 1/2 of every time reversal. The ring is that ruler wrapped
   into a circle. *)
FG$order[xs_] := Apply[LCM, Denominator[Rationalize[Mod[xs, 1], 10^-6]]];

FG$intervals[ops_] := Module[{b = FG$order[ops[[All, 4]]], m},
  m = Union[Table[k/b, {k, 0, b - 1}],
    Flatten[If[#[[3]] < 0, {Mod[#[[4]]/2, 1], Mod[#[[4]]/2 + 1/2, 1]}, {}] & /@ ops]];
  FG$order[m]];

(* ------------------------------------------------------------ geometry *)
FG$sites[ops_] := DeleteDuplicates[{#[[1]], Mod[#[[2]], 1]} & /@ ops];

FG$cellFor[basis_, {w_, h_}, k_] := Module[{minS = Min[w, h], hs},
  hs = If[minS == h, Max[Abs[basis[[1, 2]]], Abs[basis[[2, 2]]]],
                     Max[Abs[basis[[1, 1]]], Abs[basis[[2, 1]]]]];
  Max[minS/(k If[hs == 0, 1, hs]), 24]];

(* memoised: this is quadratic in the orbit and is asked for once per frame *)
FG$radius[spec_, cell_] := FG$radius[spec, cell] = Module[
  {b1, b2, l1, l2, base, pts, d},
  {b1, b2} = cell spec["Basis"];
  {l1, l2} = Norm /@ {b1, b2};
  base = spec["Point"];
  pts = Flatten[Table[Mod[#[[1]] . base + #[[2]], 1] + {m1, m2},
         {m1, 0, 1}, {m2, 0, 1}] & /@ spec["Ops"], 2];
  d = Min[Select[Norm[(#[[1]] - #[[2]]) . {b1, b2}] & /@ Subsets[pts, {2}],
                 # > 10^-6 &] ~Join~ {Min[l1, l2]}];
  Min[0.40 Min[l1, l2], 0.52 d]];

(* CELLS repeats on the short side, then raised without bound until the motif
   reaches the size floor (no group's copies may come out smaller than
   another's), then raised again if more than 18 motifs would be shown
   across. All three only ever raise the cell, so they cannot fight. *)
FG$cell[spec_, size : {w_, h_}] := FG$cell[spec, size] = Module[
  {cell, r, floor, cols, ns, bdet},
  cell = FG$cellFor[spec["Basis"], size, 4];
  floor = Max[13, Min[w, h] 0.52/5.8];
  r = FG$radius[spec, cell];
  If[r > 0 && r < floor, cell *= floor/r];
  ns = Length@FG$sites[spec["Ops"]];
  bdet = Abs@Det[spec["Basis"]];
  cols = w/Sqrt[If[bdet == 0, 1, bdet] cell^2/ns];
  If[cols > 18, cell *= cols/18];
  cell];

(* ------------------------------------------------------- frame drawing *)
FG$col = <|"Body" -> RGBColor[219/255, 230/255, 242/255],
  "Outline" -> RGBColor[125/255, 147/255, 171/255],
  "Fill" -> RGBColor[59/255, 110/255, 165/255],
  "BeatOn" -> RGBColor[192/255, 57/255, 43/255],
  "BeatOff" -> RGBColor[179/255, 170/255, 150/255],
  "Background" -> RGBColor[250/255, 249/255, 246/255]|>;

(* spec: one group's Association, straight from the catalog. Deliberately NOT
   a lookup by name: a name would have to reach the whole catalog, and
   SaveDefinitions saves whole symbols, so every stored output in the notebook
   would then carry all 275 groups. FilmGroup["g248"] does the lookup. *)
FilmGroupFrame[spec_Association, t_, size : {w_, h_} : {680, 300}] := Module[
  {cell, b1, b2, r, n, binv, ms, m1r, m2r, place, prim},
  cell = FG$cell[spec, size];
  {b1, b2} = cell spec["Basis"];
  r = FG$radius[spec, cell];
  n = FG$intervals[spec["Ops"]];
  binv = Inverse[Transpose[{b1, b2}]];
  ms = binv . # & /@ {{-w, -h}, {w, -h}, {-w, h}, {w, h}}/2;
  m1r = Range[Floor[Min[ms[[All, 1]]] - 1.6], Ceiling[Max[ms[[All, 1]]] + 1.6]];
  m2r = Range[Floor[Min[ms[[All, 2]]] - 1.6], Ceiling[Max[ms[[All, 2]]] + 1.6]];
  (* The explicit orbit: copy op at lattice offset (m1,m2), at internal time
     s (t - tau); invariance of the frame is then by construction. Every copy
     of one op shares that internal time, so the motif and the ring are built
     ONCE per op and only placed per copy — the clip is the expensive part and
     it does not depend on where the copy sits. Layers are drawn in three
     passes so painting is order-independent: coincident copies (a reversal
     partner shares its site) show the union of their coloured regions. *)
  place = Table[With[
     {M = op[[1]], v = op[[2]], s = op[[3]], tau = op[[4]]},
     With[{th = op[[3]] (t - op[[4]]),
           mp = Transpose[{b1, b2}] . op[[1]] . binv,
           pos = Flatten[Table[
             With[{p = (op[[1]] . spec["Point"] + op[[2]] + {m1, m2}) . {b1, b2}},
               If[Abs[p[[1]]] > w/2 + 3 r || Abs[p[[2]]] > h/2 + 3 r, Nothing, p]],
             {m1, m1r}, {m2, m2r}], 1]},
       (* built once here, placed many times below *)
       With[{body = GeometricTransformation[FG$motif[th, r, "body"], mp],
             fill = GeometricTransformation[FG$motif[th, r, "fill"], mp],
             rg = FG$ring[th, r, n, op[[3]]]},
         {Translate[body, #] & /@ pos,
          Translate[fill, #] & /@ pos,
          Translate[rg, #] & /@ pos}]]],
     {op, spec["Ops"]}];
  prim = {place[[All, 1]], place[[All, 2]], place[[All, 3]]};
  Graphics[prim, PlotRange -> {{-w, w}, {-h, h}}/2, ImageSize -> size,
    Background -> FG$col["Background"], PlotRangePadding -> 0,
    ImagePadding -> 0, AspectRatio -> Full]];
