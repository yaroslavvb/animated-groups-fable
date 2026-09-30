"""Words for the Shubnikov page (docs/shubnikov/).

A module of constants only: no imports at load time, no side effects, no DOM,
no data reads.  ``make_page.py`` imports it and stamps the strings into
``docs/shubnikov/index.html``.

Every value is either a plain string of HTML or a dict of them.  British
spelling, light theme, HTML entities for the maths (so the module is pure
ASCII and cannot be mangled by a stamping run under a non-UTF-8 locale), no
MathJax, no emoji.

One placeholder is left for the page builder to fill:

    {{TWO_COLOUR_TYPES}}   how many of the 46 two-colour wallpaper types the
                           237 clock-invisible two-colourings realise

It appears exactly once, in ``SECTIONS`` under the id ``shubnikov``.  See
``PLACEHOLDERS``.  ``make_page.fill_placeholders`` cuts the whole sentence
when the number is not available, matching from the previous full stop or tag
to the next full stop, so that sentence is kept short, tag-free and free of
any fact that is not repeated elsewhere.  ``check()`` enforces that.

Class names used here that ``docs/css/style.css`` already styles:
``.tablewrap``, ``table.counts``, ``tr.total``, ``th.txt``/``td.txt``,
``dl.facts``.  One more is used and is in no stylesheet: ``p.formula``, the
display equation in the "how" section; it degrades to an ordinary paragraph,
which reads correctly, and the page's own sheet may centre it later.

Run ``python3 prose.py`` to check that every HTML string has balanced tags,
that the placeholder appears exactly once and can be cut cleanly, and that
every relative link resolves to a file that exists.
"""

PLACEHOLDERS = ("TWO_COLOUR_TYPES",)


# ---------------------------------------------------------------- head matter
#
# TITLE, SUBTITLE and DESCRIPTION are stamped through html.escape, so they are
# plain text: no entities, no tags.  The rest of the module is HTML.

TITLE = "Shubnikov — Spacetime Groups"

SUBTITLE = (
    "990 cyclic colourings of the 68 forward film groups, "
    "one monochrome animation each."
)

DESCRIPTION = (
    "990 cyclic colourings of the 68 forward film groups, one monochrome "
    "animation each: Shubnikov's black-and-white groups and the 683 beyond them."
)

LEDE_HTML = """
<p>A <b>film group</b> <var>G</var> is the symmetry group of a looping animation of a plane pattern &mdash; a crystal with two directions of space and one of time. There are 275 of them. Sixty-eight run <b>forward</b>: no symmetry of the film turns time round. Those 68 are what this page colours.</p>
<p>A <b>cyclic <var>n</var>-colouring</b> of <var>G</var> is a rule &sigma; that hands every symmetry <var>g</var> a colour shift &sigma;(<var>g</var>) in &#8484;<sub><var>n</var></sub>, the integers modulo <var>n</var>: performing <var>g</var> carries colour <var>k</var> to colour <var>k</var> + &sigma;(<var>g</var>), and no shift goes unused. Counted up to a change of coordinates and a renaming of the colours there are <b>990</b> such rules for <var>n</var> = 2, 3, 4 and 6, and each one has an animation below, drawn in <var>n</var> greys. The <var>n</var> = 2 slice is Shubnikov's black-and-white groups.</p>
""".strip()


# ------------------------------------------------------------------- sections

_HOW_HTML = """
<p>Each of the 990 classes gets its own complex field, a sum of 12 to 72 travelling plane waves</p>
<p class="formula">&Psi;(<var>x</var>,&nbsp;<var>t</var>) = &Sigma;<sub><var>p</var></sub> <var>b</var><sub><var>p</var></sub> exp(2&pi;i(<var>p</var>&middot;<var>x</var> + &nu;<sub><var>p</var></sub><var>t</var>)),</p>
<p>with <var>x</var> in lattice coordinates and <var>t</var> in film periods. The wavevectors <var>p</var> lie in a ring around one wavelength &mdash; about two waves to a lattice edge &mdash; as a Turing instability selects; the frequencies &nu;<sub><var>p</var></sub> lie in &nu;<sub>0</sub> + {&minus;1,&nbsp;0,&nbsp;1} cycles per period, locked to the film's clock, as a Hopf bifurcation does. Plane waves are the normal modes of every linear reaction&ndash;diffusion or wave equation, so these pictures speak that alphabet near a Turing&ndash;Hopf onset. They are not simulations of any one named equation &mdash; nothing here solves Gray&ndash;Scott or the Brusselator. For waves integrated from a chemistry, see the <a href="../monochrome/">Monochrome</a> atlas and the <a href="../colour/">colour pages</a>.</p>
<p><b>Colour is phase.</b> A point takes colour <var>k</var> when the phase of &Psi; there falls in the <var>k</var>-th <var>n</var>-th of the circle. The coefficients are set so that &Psi;(<var>g</var>&middot;<var>z</var>) = e<sup>2&pi;i&sigma;(<var>g</var>)/<var>n</var></sup>&nbsp;&Psi;(<var>z</var>) for every symmetry <var>g</var> of the film, which turns the phase by exactly &sigma;(<var>g</var>) sectors: <var>g</var> carries colour <var>k</var> to <var>k</var>&nbsp;+&nbsp;&sigma;(<var>g</var>) exactly, not to within a pixel. One period multiplies &Psi; by e<sup>2&pi;i<var>c</var><sub>t</sub>/<var>n</var></sup>, so the coloured film repeats after exactly <var>m</var> periods.</p>
<p><b>Two views.</b> In greys the <var>n</var> colours are <var>n</var> evenly spaced lightnesses, dark at colour 0 and light at colour <var>n</var>&nbsp;&minus;&nbsp;1. The <b>one colour</b> view paints colour 0 near-black and the rest near-white, so the black set has exactly the symmetry of ker&nbsp;&sigma;, the index-<var>n</var> subgroup that keeps the colours.</p>
<p><b>The audit.</b> A field obeying the law can still carry symmetry nobody asked for. So the builder works in exact rational arithmetic &mdash; each orbit of waves takes a distinct amplitude and a phase of <var>k</var>/7919 of a turn &mdash; and solves, over every isometry of the lattice, with and without time reversal, on &Psi; and on its conjugate, for all constant-phase symmetries. A picture is kept only if those are exactly the elements of <var>G</var>, with shifts exactly &sigma;. 798 of the 990 passed on the narrowest ring; 192 needed a wider one. In the worked case, <code>g128</code> over p4m with all three mirrors swapping colours, a narrow ring leaves a spurious half-cell antitranslation, and the ring widens until the next shell of waves breaks it.</p>
"""

_SHUBNIKOV_HTML = """
<p>Set <var>n</var> = 2. A two-colouring of <var>G</var> is a homomorphism onto &#8484;<sub>2</sub>, which is the same thing as a subgroup of index 2 &mdash; the symmetries that keep the colours. Every index-2 subgroup is normal, so at two colours "cyclic" costs nothing: this slice is the whole two-colour theory, Shubnikov's antisymmetry, black and white, or, in physics, time reversal.</p>
<p>Heesch (1930) counted the 122 "four-dimensional" point groups of ordinary space as abstract mathematics; Shubnikov's <i>Symmetry and Antisymmetry of Finite Figures</i> (1951) has 32 ordinary + 32 grey + 58 black-and-white point groups; Zamorzaev (1953) and, independently, Belov, Neronova and Smirnova (1955) reached the space groups, in a paper titled "1651 Shubnikov groups": 1651 = 230 ordinary + 230 grey + 1191 black-and-white.</p>
<p>That gives a check. The 68 forward film groups are exactly the 68 <b>polar</b> space groups, read with the polar axis as time, and over those 68 the magnetic-group tables list <b>304</b> black-and-white groups: 129 of type III, where no translation swaps the colours, and 175 of type IV, where one does. This census gives 309 or 307, depending on which changes of coordinates are allowed.</p>
<div class="tablewrap"><table class="counts">
<thead><tr><th class="txt" scope="col">Count</th><th scope="col">Two-colourings</th><th class="txt" scope="col">What it is</th></tr></thead>
<tbody>
<tr><td class="txt">magnetic-group tables</td><td>304</td><td class="txt">129 type III + 175 type IV, over the 68 polar space groups</td></tr>
<tr><td class="txt">+ five time-axis splits</td><td>+5</td><td class="txt">P1 (1&nbsp;&rarr;&nbsp;2), Pm (5&nbsp;&rarr;&nbsp;8), Cc (2&nbsp;&rarr;&nbsp;3)</td></tr>
<tr class="total"><td class="txt">this census, E<sub>p3</sub></td><td>309</td><td class="txt">mirror-image colourings kept apart</td></tr>
<tr><td class="txt">&minus; two mirror-image merges</td><td>&minus;2</td><td class="txt">P4<sub>2</sub> (5&nbsp;&rarr;&nbsp;4), I4<sub>1</sub> (3&nbsp;&rarr;&nbsp;2)</td></tr>
<tr class="total"><td class="txt">this census, E<sub>fwd</sub> &mdash; shown here</td><td>307</td><td class="txt">a bare mirror of spacetime allowed</td></tr>
</tbody>
</table></div>
<p><b>The five splits.</b> In P1, Pm and Cc the polar direction is not unique: a crystal has more than one axis it could call time and need not choose, while a film must. "The colours swap every period" and "the colours swap from one stripe of the pattern to the next" are two different films, and a crystal may turn one into the other by relabelling axes. So P1 gains a class here, Pm three and Cc one. Nothing is lost by it: every one of the 309 lands on one of the 304, every one of the 304 is hit, and 65 of the 68 groups agree exactly.</p>
<p><b>The two merges.</b> E<sub>fwd</sub>, the version shipped here, also allows a plain mirror of spacetime, so a colouring and its mirror image count as one. That merges two enantiomorphic pairs of colourings the magnetic tables keep apart: P<sub>c</sub>4<sub>1</sub> with P<sub>c</sub>4<sub>3</sub> over P4<sub>2</sub>, and P<sub>I</sub>4<sub>1</sub> with P<sub>I</sub>4<sub>3</sub> over I4<sub>1</sub> &mdash; the whole of the gap between 309 and 307.</p>
<p>The 237 two-colourings the clock cannot see are plain black-and-white patterns of the plane. Between them they realise {{TWO_COLOUR_TYPES}} two-colour wallpaper types. The other 683 classes here use three, four or six colours, where Shubnikov's tables do not reach.</p>
"""

_BEYOND_HTML = """
<p>More than two colours arrived quickly. Belov and Tarkhova, "Groups of coloured symmetry" (1956), let a symmetry cycle through <var>p</var> colours rather than swap two &mdash; the cyclic case, which is the case on this page. Then Indenbom (1959) and Niggli (1959) gave it its proper setting: colour groups come from the one-dimensional representations of the group. A real one, with values &plusmn;1, is a black-and-white group; a complex one is polychromatic. A map &sigma;: <var>G</var> &rarr; &#8484;<sub><var>n</var></sub> is exactly a one-dimensional representation with values in the <var>n</var>-th roots of unity, which is also why the picture here can be a single complex field with the colour read off its phase.</p>
<p>Koptsik (1966) published the atlas of all 1651, and Shubnikov and Koptsik's <i>Symmetry in Science and Art</i> (Nauka 1972; Plenum 1974) carried the subject to a general readership. For three-dimensional space groups beyond two colours the papers are Harker, <i>Acta Cryst.</i> A37, 286 (1981), for three colours, and Sivardi&egrave;re A40, 573 (1984), Roth A41, 484 (1985) and Sivardi&egrave;re A44, 735 (1988) for four and six.</p>
<p>Their counts have <i>not</i> been read, so nothing at <var>n</var> = 3, 4 or 6 on this page is checked against the literature. The 683 classes beyond two colours stand on this site's own arithmetic; the two-colour comparison above is the only external anchor.</p>
"""

_READING_HTML = """
<p>One card is one class, not one film. A film appears once for every colouring it carries, so <code>g10</code> appears 35 times and <code>g247</code> four.</p>
<dl class="facts">
<dt>the film</dt><dd>its number in the 275 (<code>g128</code>), its wallpaper group (p4m), and the 3D polar space group it is when time is read as the polar axis (P4mm). The 275 are in the <a href="../catalog.html">catalogue</a>; the 68 forward ones are laid out by wallpaper group on the <a href="../correspondence.html">correspondence pages</a>.</dd>
<dt><var>n</var></dt><dd>how many colours: 2, 3, 4 or 6.</dd>
<dt><var>c</var><sub>t</sub></dt><dd>&sigma; of one film period &mdash; how far the colours advance while the film runs once through. <var>c</var><sub>t</sub> = 0 means the clock changes nothing.</dd>
<dt><var>m</var></dt><dd><var>n</var>/gcd(<var>c</var><sub>t</sub>,&nbsp;<var>n</var>): how many periods of the film the <i>coloured</i> film takes to repeat. The card loops <var>m</var> periods.</dd>
<dt>the greys</dt><dd>colour 0 darkest, colour <var>n</var>&nbsp;&minus;&nbsp;1 lightest, evenly spaced between. A boundary is where the phase crosses from one <var>n</var>-th of the circle to the next.</dd>
<dt>one colour</dt><dd>the second view: colour 0 black, the rest white. What you are then looking at is ker&nbsp;&sigma;, the index-<var>n</var> subgroup that keeps colour 0 where it is.</dd>
</dl>
<p>Two cards of the same class, drawn from different seeds, would look different and mean the same thing.</p>
"""

_EQUIVALENCE_HTML = """
<p>Two colourings are the same when a change of coordinates carries one to the other and the colours can be renamed to match. Which changes of coordinates are allowed is a real choice, and it changes the total.</p>
<ul>
<li><b>E<sub>fwd</sub></b> &mdash; any affine map of spacetime that keeps the direction of time. Mirrors of space are allowed, and so are shears that tilt space against time, which is only a change of moving frame. <b>990</b> classes: 307 at <var>n</var>&nbsp;=&nbsp;2, 89 at 3, 241 at 4, 353 at 6.</li>
<li><b>E<sub>p3</sub></b> &mdash; only maps of determinant +1 in three dimensions. A bare mirror of space is dropped; a mirror taken together with a reversal of time is admitted in its place, since the two minus signs cancel. It is therefore not a narrowing of E<sub>fwd</sub>: on the eight screw films whose mirror image is a different film it allows twice as much. <b>1006</b> classes: 309, 93, 243, 361.</li>
</ul>
<p>Either way the equivalence acts <i>inside</i> one film group, on that group's colourings: a colouring and its mirror image may be one class. Which film is which is never in question &mdash; P4<sub>1</sub> and P4<sub>3</sub> are two of the 68 under both counts, and so are P3<sub>1</sub>/P3<sub>2</sub>, P6<sub>1</sub>/P6<sub>5</sub> and P6<sub>2</sub>/P6<sub>4</sub>.</p>
<p>The two disagree in exactly <b>14</b> of the 272 (film, <var>n</var>) cells, all in the three chiral families p4, p3 and p6. What is chiral in those cells is the colouring, not the film: the film group has no mirror of its own, so &sigma; and its mirror image can be two different rules, and E<sub>fwd</sub>, which allows the bare mirror, merges them where E<sub>p3</sub> does not. The films that really do come in a left hand and a right hand are exactly the ones where nothing differs at all.</p>
<ul>
<li><b>p4</b>, six cells: P4 at <var>n</var>&nbsp;=&nbsp;4 (9 against 10), P4<sub>2</sub> at <var>n</var>&nbsp;=&nbsp;2 and 6 (4 against 5, twice), I4 at <var>n</var>&nbsp;=&nbsp;4 (5 against 6), I4<sub>1</sub> at <var>n</var>&nbsp;=&nbsp;2 and 6 (2 against 3, twice).</li>
<li><b>p3</b>, four cells: P3 at <var>n</var>&nbsp;=&nbsp;3 and 6 (5 against 6, twice), R3 at <var>n</var>&nbsp;=&nbsp;3 and 6 (3 against 4, twice).</li>
<li><b>p6</b>, four cells: P6 at <var>n</var>&nbsp;=&nbsp;3 (3 against 4) and at <var>n</var>&nbsp;=&nbsp;6 (9 against 12), P6<sub>3</sub> at <var>n</var>&nbsp;=&nbsp;3 and 6 (3 against 4, twice).</li>
</ul>
<p>The <a href="../reports/symmetry-meeting-notes-week-38/">week-38 review</a> recommended E<sub>p3</sub>, on the grounds that crystallography keeps enantiomorphs apart and a film should too. Representatives were built and audited for E<sub>fwd</sub> only, so this page shows 990 and says which equivalence it is showing. The difference is small, listed above in full, and not hidden.</p>
"""

SECTIONS = [
    {
        "id": "how",
        "summary": "How the pictures are made",
        "html": _HOW_HTML.strip(),
    },
    {
        "id": "shubnikov",
        "summary": "Shubnikov's black-and-white groups, and this census",
        "html": _SHUBNIKOV_HTML.strip(),
    },
    {
        "id": "beyond",
        "summary": "Beyond two colours: Belov, Indenbom, Niggli and after",
        "html": _BEYOND_HTML.strip(),
    },
    {
        "id": "reading",
        "summary": "Reading a card",
        "html": _READING_HTML.strip(),
    },
    {
        "id": "equivalence",
        "summary": "Which colourings count as the same",
        "html": _EQUIVALENCE_HTML.strip(),
    },
]


# --------------------------------------------------------- the colour headings

N_TITLES = {
    2: "Two colours &mdash; Shubnikov's black and white",
    3: "Three colours",
    4: "Four colours",
    6: "Six colours",
}

N_NOTES = {
    2: "307 classes, and the one slice with an outside check: a two-colouring is an index-2 subgroup, every index-2 subgroup is normal, and the magnetic-group tables have counted these since the 1950s.",
    3: "89 classes, and thin for a reason: ten of the seventeen wallpaper groups have no <i>cyclic</i> three-colouring in the plane &mdash; seven of the ten do have three-colourings, but ones that need the full S<sub>3</sub> to permute the colours, which this page does not count &mdash; so for every film over those ten the only cyclic three-colouring left is the one that counts periods.",
    4: "241 classes, of which 132 have <var>c</var><sub>t</sub> = 2 &mdash; one period swaps colour 0 with 2 and colour 1 with 3, so the coloured film comes back after two periods rather than four.",
    6: "353 classes, the largest slice and the least still: only 24 of them are invisible to the clock, against 237 of the 307 two-colourings.",
}

CLOCK_TITLES = {
    "ct0": "Invisible to the clock",
    "ctne": "Colour moves with the clock",
}

CLOCK_NOTES = {
    "ct0": "&sigma; of one film period is 0, so waiting changes no colour: the colouring is already a colouring of the still pattern, and the coloured film closes up in a single period &mdash; 324 of the 990.",
    "ctne": "&sigma; of one film period is <var>c</var><sub>t</sub> &ne; 0, so every period advances all the colours at once and the coloured film needs <var>m</var> = <var>n</var>/gcd(<var>c</var><sub>t</sub>,&nbsp;<var>n</var>) periods to return &mdash; 666 of the 990.",
}


# -------------------------------------------------------- the 17 family notes

FAMILY_NOTES = {
    "p1": "One film, <code>g1</code> (P1), and 11 colourings &mdash; the fewest of any family. There is nothing to colour but two slides and the clock, so &sigma; is just three numbers in &#8484;<sub><var>n</var></sub>; 4 of the 11 leave the clock alone. See <a href=\"../correspondence-p1.html\">p1 in the correspondence</a>.",
    "p2": "Three films &mdash; P2, P2<sub>1</sub> and C2 &mdash; carry 33 colourings, 8 of them already visible in a frozen frame. A half-turn cannot advance three colours by a cycle, so p2 has no cyclic three-colouring in the plane (its only three-colouring needs the full S<sub>3</sub> to permute the colours), and each film here has exactly one three-colouring: the one that merely counts periods. See <a href=\"../correspondence-p2.html\">p2 in the correspondence</a>.",
    "pm": "A single film, <code>g10</code> (Pm), carries 35 colourings &mdash; more than any other film on the page. Two parallel mirrors with a free direction running between them give &sigma; a great deal of room, and 16 of the 35 use six colours. See <a href=\"../correspondence-pm.html\">pm in the correspondence</a>.",
    "pg": "One film, <code>g11</code> (Pc), and 20 colourings, of which 13 need the clock to close up: glides are the only spatial generators &mdash; two of them, because pg is &times;&times; and needs a pair &mdash; and squaring one ties &sigma; on that glide to &sigma; on a translation. See <a href=\"../correspondence-pg.html\">pg in the correspondence</a>.",
    "cm": "Two films, Cm and Cc, and 38 colourings &mdash; 18 of them, nearly half, invisible to the clock. Cc is one of the three space groups where this census counts more two-colourings than the magnetic tables do, because a crystal need not say which of its axes is time. See <a href=\"../correspondence-cm.html\">cm in the correspondence</a>.",
    "pmm": "The largest family here: 6 films and 150 colourings, just over a seventh of the census. Its abelianisation is &#8484;<sub>2</sub>&#8308;, so pmm has 15 subgroups of index 2 &mdash; more than any other wallpaper group &mdash; and the films inherit them: 55 two-colourings here, 49 of which need no clock at all. Up to a change of coordinates those 49 are 5 of the 46 two-colour wallpaper types. See <a href=\"../correspondence-pmm.html\">pmm in the correspondence</a>.",
    "pmg": "Six films and 110 colourings (40 at two colours, 6 at three, 24 at four, 40 at six; 34 clock-invisible) &mdash; exactly the figures of cmm and of p4m, and the coincidence goes further: the three families' films match one for one in how many colourings each carries. See <a href=\"../correspondence-pmg.html\">pmg in the correspondence</a>.",
    "pgg": "Four films, 45 colourings, and the mark of a &#8484;<sub>4</sub> in the abelianisation: four colours (15 classes) outnumber two (13) and six (13). Two glides at right angles compose to a half-turn, and that is what &sigma; has to respect. See <a href=\"../correspondence-pgg.html\">pgg in the correspondence</a>.",
    "cmm": "Six films &mdash; Cmm2, Ccc2, Cmc2<sub>1</sub>, Imm2, Iba2, Ima2 &mdash; and 110 colourings, 34 of them invisible to the clock. The counts agree film for film with pmg and p4m. See <a href=\"../correspondence-cmm.html\">cmm in the correspondence</a>.",
    "p4": "Six films, from P4 through the screws P4<sub>1</sub>, P4<sub>2</sub>, P4<sub>3</sub> to I4 and I4<sub>1</sub>, and 66 colourings. The quarter turn shows: 24 use four colours, more than any other <var>n</var> here. p4 is also where the two equivalences argue most &mdash; six of the 14 disagreeing cells are in this family. See <a href=\"../correspondence-p4.html\">p4 in the correspondence</a>.",
    "p4m": "Six films and 110 colourings, matching pmg and cmm figure for figure. This is the family of the worked audit case: <code>g128</code> (P4mm) with all three named mirrors swapping colours needed the widest ring of waves any class on the page needed before its spurious extra symmetry broke. The hardest classes of seven other films tie there, and the builder had wider rings still in reserve. See <a href=\"../correspondence-p4m.html\">p4m in the correspondence</a>.",
    "p4g": "Six films and 82 colourings, with 28 at four colours &mdash; second only to pmm's 34, and one of only three families (with p4 and pgg) where four colours outnumber every other <var>n</var>. 30 of the 82 are invisible to the clock. See <a href=\"../correspondence-p4g.html\">p4g in the correspondence</a>.",
    "p3": "Four films &mdash; P3, P3<sub>1</sub>, P3<sub>2</sub> and R3 &mdash; and 32 colourings. A threefold centre cannot be swapped, so p3 has no two-colouring in the plane at all: all 4 of its two-colourings here are bought with the clock. Three and six colours carry the family, 24 of the 32. See <a href=\"../correspondence-p3.html\">p3 in the correspondence</a>.",
    "p3m1": "The smallest family after p1: two films, P3m1 and P3c1, and 13 colourings, of which only 2 are visible in a frozen frame. The abelianisation is a bare &#8484;<sub>2</sub>, so almost everything here is the clock's doing. See <a href=\"../correspondence-p3m1.html\">p3m1 in the correspondence</a>.",
    "p31m": "Four films &mdash; P31m, P31c, R3m, R3c &mdash; and 38 colourings. The abelianisation is &#8484;<sub>6</sub>, so unlike p3m1 this family takes three and six colours in the plane: 16 of the 38 use six, and <code>g232</code> (P31m) carries 9 of those by itself. See <a href=\"../correspondence-p31m.html\">p31m in the correspondence</a>.",
    "p6": "Six films, from P6 to the sixfold screws P6<sub>1</sub> and P6<sub>5</sub>, and 51 colourings. A &#8484;<sub>6</sub> abelianisation again: 20 use six colours, 9 of them on P6 alone. Four of the 14 cells where the two equivalences disagree are here. See <a href=\"../correspondence-p6.html\">p6 in the correspondence</a>.",
    "p6m": "Four films &mdash; P6mm, P6<sub>3</sub>cm, P6cc, P6<sub>3</sub>mc &mdash; and 46 colourings. The abelianisation is &#8484;<sub>2</sub>&sup2;, so the plane itself offers only two-colourings: 12 of the 16 two-colourings need no clock, while every three-, four- and six-colouring in the family is the clock's work. See <a href=\"../correspondence-p6m.html\">p6m in the correspondence</a>.",
}


# ---------------------------------------------------------------------- footer

FOOTER_HTML = """
<p><b>The two-colour comparison</b> is against H.&nbsp;T. Stokes and B.&nbsp;J. Campbell's ISO-MAG table of magnetic space groups (<a href="https://iso.byu.edu/">iso.byu.edu</a>), which is built on D.&nbsp;B. Litvin, "Magnetic Space Group Types", <i>Acta Cryst.</i> A57, 729 (2001). For the history, A.&nbsp;S. Wills, "A historical introduction to the symmetries of magnetic structures, Part&nbsp;1", <a href="https://arxiv.org/abs/1609.09666">arXiv:1609.09666</a>. The books behind the prose are Shubnikov's <i>Symmetry and Antisymmetry of Finite Figures</i> (1951) and Shubnikov and Koptsik's <i>Symmetry in Science and Art</i> (Nauka 1972; Plenum 1974).</p>
<p><b>The census</b> was recomputed from scratch from the film geometry for this page, then matched, class by class and in order, against the <code>cx_d2.json</code> bundle of the <a href="../reports/symmetry-meeting-notes-week-38/">week-38 symmetry meeting notes</a>, where the enumeration and the choice of equivalence are worked out in full. One correction: that bundle read the named generators of <code>g11</code> and <code>g131</code> through a pair which generates only an index-2 subgroup of the film group. The classes themselves are unaffected; the generator readings shown here are the corrected ones.</p>
<p><b>Cost.</b> No frame was rendered in advance and nothing was computed on a cluster: one Python script on a laptop writes the census, the browser draws every card from it, and no Modal compute was needed. Elsewhere on this site: the <a href="../catalog.html">275 film groups</a> and the <a href="../colour/">entangled colour symmetries</a>.</p>
""".strip()


# ------------------------------------------------------------------ self-check

_VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def _iter_html():
    """Yield (label, html) for every HTML-bearing constant."""
    yield "LEDE_HTML", LEDE_HTML
    for sec in SECTIONS:
        yield "SECTIONS[%s]" % sec["id"], sec["html"]
    for n, v in N_NOTES.items():
        yield "N_NOTES[%d]" % n, v
    for k, v in CLOCK_NOTES.items():
        yield "CLOCK_NOTES[%s]" % k, v
    for k, v in FAMILY_NOTES.items():
        yield "FAMILY_NOTES[%s]" % k, v
    yield "FOOTER_HTML", FOOTER_HTML


def _balance(label, html_text):
    """Return a list of problems with the nesting of html_text."""
    from html.parser import HTMLParser

    class Balance(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.stack = []
            self.problems = []

        def handle_starttag(self, tag, attrs):
            if tag not in _VOID:
                self.stack.append(tag)

        def handle_startendtag(self, tag, attrs):
            pass

        def handle_endtag(self, tag):
            if tag in _VOID:
                return
            if not self.stack:
                self.problems.append("stray </%s>" % tag)
            elif self.stack[-1] != tag:
                self.problems.append("</%s> closes <%s>" % (tag, self.stack[-1]))
                self.stack.pop()
            else:
                self.stack.pop()

    p = Balance()
    p.feed(html_text)
    p.close()
    if p.stack:
        p.problems.append("unclosed " + ", ".join("<%s>" % t for t in p.stack))
    return p.problems


def check():
    """Raise AssertionError if anything is malformed. Returns a list of notes."""
    import os
    import re

    notes = []
    for label, html_text in _iter_html():
        assert isinstance(html_text, str) and html_text.strip(), label
        problems = _balance(label, html_text)
        assert not problems, "%s: %s" % (label, "; ".join(problems))
        notes.append(label)

    assert len(DESCRIPTION) <= 160, "DESCRIPTION is %d chars" % len(DESCRIPTION)
    assert set(N_TITLES) == set(N_NOTES) == {2, 3, 4, 6}
    assert set(CLOCK_TITLES) == set(CLOCK_NOTES) == {"ct0", "ctne"}
    assert len(FAMILY_NOTES) == 17
    assert [s["id"] for s in SECTIONS] == [
        "how", "shubnikov", "beyond", "reading", "equivalence"]
    for sec in SECTIONS:
        assert set(sec) == {"id", "summary", "html"}, sec["id"]
        assert sec["summary"].strip()

    # the HTML is ASCII: entities only, so no stamping run can mangle it
    for label, text in _iter_html():
        assert text.isascii(), "%s is not ASCII" % label
    # the head matter goes through html.escape, so it must be plain text:
    # an entity there would be stamped as &amp;mdash;
    for label, text in (("TITLE", TITLE), ("SUBTITLE", SUBTITLE),
                        ("DESCRIPTION", DESCRIPTION)):
        assert "&" not in text and "<" not in text and ">" not in text, (
            "%s is stamped through html.escape and must be plain text" % label)
    # the <summary> of a section is stamped raw, so it must be valid markup
    for sec in SECTIONS:
        assert not _balance("SECTIONS[%s].summary" % sec["id"], sec["summary"])
        assert "&" not in sec["summary"] or "&amp;" in sec["summary"], sec["id"]

    blob = "\n".join(h for _, h in _iter_html())
    for name in PLACEHOLDERS:
        assert blob.count("{{%s}}" % name) == 1, name
    stray = set(re.findall(r"\{\{(\w+)\}\}", blob)) - set(PLACEHOLDERS)
    assert not stray, "undeclared placeholders: %s" % sorted(stray)

    # make_page cuts the placeholder's sentence when the number is missing, with
    # this regex.  It must match one whole tag-free sentence, and what is left
    # must still be balanced HTML.
    sentence = re.compile(r"\s*[^.<>]*\{\{TWO_COLOUR_TYPES\}\}[^.<>]*\.")
    for sec in SECTIONS:
        if "{{TWO_COLOUR_TYPES}}" not in sec["html"]:
            continue
        cut = sentence.findall(sec["html"])
        assert len(cut) == 1, "the placeholder sentence does not cut cleanly"
        assert "<" not in cut[0] and ">" not in cut[0], cut[0]
        rest = sentence.sub("", sec["html"])
        assert "{{" not in rest
        assert not _balance("cut", rest), "cutting the sentence unbalances the HTML"
        notes.append("placeholder sentence cuts to: %r" % cut[0].strip())

    # every relative link points at a real file under docs/
    here = os.path.dirname(os.path.abspath(__file__))
    docs_shub = os.path.dirname(here)
    for href in re.findall(r'href="(\.\./[^"#]*)', blob):
        target = os.path.normpath(os.path.join(docs_shub, href))
        if target.endswith("/") or os.path.isdir(target):
            target = os.path.join(target, "index.html")
        assert os.path.exists(target), "dead link: %s" % href

    return notes


def _words(html_text):
    import re
    text = re.sub(r"<[^>]+>", " ", html_text)
    text = re.sub(r"&[a-zA-Z#0-9]+;", "x", text)
    return len(text.split())


if __name__ == "__main__":
    done = check()
    print("prose.py: %d HTML strings, all balanced" % len(
        [d for d in done if not d.startswith("placeholder")]))
    print("DESCRIPTION %d chars" % len(DESCRIPTION))
    for sec in SECTIONS:
        print("  %-12s %4d words" % (sec["id"], _words(sec["html"])))
    print("  %-12s %4d words" % ("lede", _words(LEDE_HTML)))
    print("  %-12s %4d words" % ("footer", _words(FOOTER_HTML)))
    for note in done:
        if note.startswith("placeholder"):
            print(note)
