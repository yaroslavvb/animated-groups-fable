#!/usr/bin/env python3
"""The symbol guide: docs/correspondence-symbols.html.

The correspondence plates mark their generators with 21 crystallographic
symbols (a translation arrow, fourteen rotation and screw axes, a mirror and
four glide planes).  The "Diagram symbols" card lists them; this page shows
what each one does.  Every symbol gets a card with the operation written out
and a figure host that docs/js/correspondence-symbols.js fills with two linked
animated views: one period of a polar crystal with the axis up, and the same
scene seen down the axis, which is the colour plate.

Only polar groups occur in the correspondence, so no operation reverses the
axis and every symmetry is a plane isometry with a rise.  The page says so
and keeps to those 21 marks.  (His ask, Sat 21 Nov 2026: "create a separate
page which helps me understand each of those symbols. I only care about polar
crystal groups, so I don't have time reversal. For each symbol, give a visual
illustration of what it actually does as an interactive or animated diagram.
Give a link to that page from the card.")

Nothing here is a second source of truth:
  * the glyphs are cut from the visual index of the snapshot, which
    correspondence_symbols.py draws, and the path the figures lay on the floor
    comes from correspondence_symbols.symbol_path;
  * the "Drawn on" lists are read from the plate overlays of the 68 entries;
  * the page head and site header are the snapshot's.

split_correspondence.py writes the page together with the other 18 (and
checks it with --check); it also calls link_teaser() and link_index() so the
card and its visual index link here.
"""

import html as html_lib
import re

import correspondence_symbols

PAGE = "correspondence-symbols.html"
ASSET_VERSION = "symbol-guide-v1"

ORDER_WORD = {2: "half", 3: "third", 4: "quarter", 6: "sixth"}

C = "<i>c</i>"


def rise(num, den):
    """A rise as a multiple of the period: c/4, 2c/3."""
    if num == 0:
        return "0"
    from math import gcd
    g = gcd(num, den)
    num, den = num // g, den // g
    if den == 1:
        return C if num == 1 else "%d%s" % (num, C)
    return "%s%s/%d" % ("" if num == 1 else num, C, den)


def axis_name(n, m):
    if m == 0:
        return "%d-fold rotation axis" % n
    return "%d<sub>%d</sub> screw axis" % (n, m)


def axis_short(n, m):
    return "%d" % n if m == 0 else "%d<sub>%d</sub>" % (n, m)


def axis_formula(n, m):
    lift = "" if m == 0 else " + %s" % rise(m, n)
    return "(<i>r</i>, <i>θ</i>, <i>z</i>) ↦ (<i>r</i>, <i>θ</i> + %d°, <i>z</i>%s)" % (360 // n, lift)


def plane_formula(slide, lift):
    along = "<i>y</i> + <i>b</i>/2" if slide else "<i>y</i>"
    up = "<i>z</i>" if not lift else "<i>z</i> + %s" % lift
    return "(<i>x</i>, <i>y</i>, <i>z</i>) ↦ (−<i>x</i>, %s, %s)" % (along, up)


# --- the 21 cards -------------------------------------------------------------
# id: the data-legend-symbol of the visual index.  crystal / plate / mark are
# the three things a card says; `more` is an optional closing remark.
TRANSLATION = [
    {
        "id": "translation",
        "name": "Translation",
        "short": "translation",
        "formula": "(<i>p</i>, <i>z</i>) ↦ (<i>p</i> + <i>t</i>, <i>z</i>)",
        "crystal": "A shift by a lattice vector that lies across the axis. Nothing rises: every tile "
                   "slides onto its neighbour at the same height.",
        "plate": "The pattern repeats along the arrow, colour for colour.",
        "mark": "An open arrow from one lattice point to the next. Its letter (<i>X</i>, <i>Y</i> or "
                "<i>α</i>) names the translation in the entry’s generator table.",
        "more": "A lattice vector with a vertical part, such as the body-centring vector of an <i>I</i> "
                "lattice, shifts the picture and steps the colour as well. The plates give it no mark "
                "of its own.",
    },
]

AXES = {
    (2, 0): {
        "crystal": "A half-turn about the axis and no rise. Twice is the identity, so the copies come "
                   "in pairs at one height.",
        "plate": "A 2-fold centre: the half-turn about the mark keeps every colour.",
        "mark": "A lens, the shape with two corners. No tails, so no rise.",
    },
    (2, 1): {
        "crystal": "A half-turn with a rise of half a period. Twice is the lattice translation %s. "
                   "The copies zigzag up the axis, and no point stays where it was." % C,
        "plate": "A 2-fold centre whose half-turn swaps the two colours. Where a plate has more "
                 "colours, it steps the cycle half-way round.",
        "mark": "The lens with two hooked tails, one for each height. A 2<sub>1</sub> axis is its own "
                "mirror image, so the sense of the hooks tells nothing.",
    },
    (3, 0): {
        "crystal": "A third-turn about the axis and no rise: three copies at one height.",
        "plate": "A 3-fold centre: the third-turn about the mark keeps every colour.",
        "mark": "A triangle. No tails, so no rise.",
    },
    (3, 1): {
        "crystal": "A third-turn counter-clockwise, seen from above, with a rise of %s. Three steps "
                   "make one full turn and one period: a right-handed spiral stair." % rise(1, 3),
        "plate": "A 3-fold centre: the counter-clockwise third-turn sends each colour to the next in "
                 "a cycle of three.",
        "mark": "The triangle with three tails, one for each height. They point counter-clockwise, "
                "the way the stair climbs.",
    },
    (3, 2): {
        "crystal": "A third-turn counter-clockwise with a rise of %s. Turn clockwise instead and the "
                   "rise is %s: the left-handed stair, the mirror image of 3<sub>1</sub>."
                   % (rise(2, 3), rise(1, 3)),
        "plate": "A 3-fold centre: the clockwise third-turn sends each colour to the next in a cycle "
                 "of three.",
        "mark": "The mirrored triangle: its three tails point clockwise.",
    },
    (4, 0): {
        "crystal": "A quarter-turn about the axis and no rise: four copies at one height. Twice is a "
                   "half-turn.",
        "plate": "A 4-fold centre: the quarter-turn about the mark keeps every colour.",
        "mark": "A diamond, which is a square stood on its corner. No tails, so no rise.",
    },
    (4, 1): {
        "crystal": "A quarter-turn counter-clockwise with a rise of %s: a right-handed spiral stair "
                   "of four steps. Twice is a 2<sub>1</sub> screw." % rise(1, 4),
        "plate": "A 4-fold centre: the counter-clockwise quarter-turn sends each colour to the next "
                 "in a cycle of four.",
        "mark": "The diamond with four tails, one for each height, pointing counter-clockwise.",
    },
    (4, 2): {
        "crystal": "A quarter-turn with a rise of half a period, the same in either sense. Twice is a "
                   "plain half-turn (a rise of %s is no rise), so opposite tiles are level: two "
                   "heights, two tiles at each." % C,
        "plate": "A 4-fold centre whose quarter-turn swaps the two colours and whose half-turn keeps "
                 "them.",
        "mark": "The diamond with two tails, one for each height. Like 2<sub>1</sub> it is its own "
                "mirror image.",
    },
    (4, 3): {
        "crystal": "A quarter-turn counter-clockwise with a rise of %s. Turn clockwise instead and "
                   "the rise is %s: the left-handed stair, the mirror image of 4<sub>1</sub>. Twice "
                   "is again a 2<sub>1</sub> screw." % (rise(3, 4), rise(1, 4)),
        "plate": "A 4-fold centre: the clockwise quarter-turn sends each colour to the next in a "
                 "cycle of four.",
        "mark": "The mirrored diamond: its four tails point clockwise.",
    },
    (6, 0): {
        "crystal": "A sixth-turn about the axis and no rise: six copies at one height. Twice is a "
                   "third-turn, three times a half-turn.",
        "plate": "A 6-fold centre: the sixth-turn about the mark keeps every colour.",
        "mark": "A hexagon. No tails, so no rise.",
    },
    (6, 1): {
        "crystal": "A sixth-turn counter-clockwise with a rise of %s: a right-handed spiral stair of "
                   "six steps. Twice is a 3<sub>1</sub> screw, three times a 2<sub>1</sub> screw."
                   % rise(1, 6),
        "plate": "A 6-fold centre: the counter-clockwise sixth-turn sends each colour to the next in "
                 "a cycle of six.",
        "mark": "The hexagon with six tails, one for each height, pointing counter-clockwise.",
    },
    (6, 2): {
        "crystal": "A sixth-turn counter-clockwise with a rise of %s. Three times is a plain "
                   "half-turn, so opposite tiles are level: three heights, two tiles at each, on a "
                   "right-handed double stair. Twice is a 3<sub>2</sub> screw." % rise(2, 6),
        "plate": "A 6-fold centre: the counter-clockwise sixth-turn sends each colour to the next in "
                 "a cycle of three.",
        "mark": "The hexagon with three tails, one for each height, pointing counter-clockwise.",
    },
    (6, 3): {
        "crystal": "A sixth-turn with a rise of half a period, the same in either sense. Twice is a "
                   "plain third-turn, so there are two heights with three tiles at each. Three times "
                   "is a 2<sub>1</sub> screw.",
        "plate": "A 6-fold centre whose sixth-turn swaps the two colours and whose third-turn keeps "
                 "them.",
        "mark": "The hexagon with two tails, one for each height. It is its own mirror image.",
    },
    (6, 4): {
        "crystal": "A sixth-turn counter-clockwise with a rise of %s. Turn clockwise instead and the "
                   "rise is %s: the mirror image of 6<sub>2</sub>, a left-handed double stair. Twice "
                   "is a 3<sub>1</sub> screw, three times a plain half-turn."
                   % (rise(4, 6), rise(2, 6)),
        "plate": "A 6-fold centre: the clockwise sixth-turn sends each colour to the next in a cycle "
                 "of three.",
        "mark": "The mirrored hexagon with three tails: they point clockwise.",
    },
    (6, 5): {
        "crystal": "A sixth-turn counter-clockwise with a rise of %s. Turn clockwise instead and the "
                   "rise is %s: the mirror image of 6<sub>1</sub>, a left-handed stair of six steps. "
                   "Twice is a 3<sub>2</sub> screw, three times a 2<sub>1</sub> screw."
                   % (rise(5, 6), rise(1, 6)),
        "plate": "A 6-fold centre: the clockwise sixth-turn sends each colour to the next in a cycle "
                 "of six.",
        "mark": "The mirrored hexagon with six tails: they point clockwise.",
    },
}

PLANES = [
    {
        "id": "plane-m",
        "name": "Mirror plane <i>m</i>",
        "short": "<i>m</i>",
        "formula": plane_formula(False, ""),
        "crystal": "A reflection in a plane that contains the axis, and nothing more. Points of the "
                   "plane stay where they are.",
        "plate": "A mirror line: the two sides are mirror images in the same colours.",
        "mark": "A solid line: the plane seen edge-on, with no shift to show.",
    },
    {
        "id": "plane-axial",
        "name": "Glide plane <i>a</i> or <i>b</i>",
        "short": "<i>a</i>, <i>b</i>",
        "formula": plane_formula(True, ""),
        "crystal": "The reflection, then a shift of half a repeat along the plane’s line. No rise. "
                   "Twice is the translation <i>b</i>. The bare mirror image is not part of the "
                   "crystal: the dashed outline in the figure marks the place it would have.",
        "plate": "A glide line: copies alternate from side to side like footprints, in one colour.",
        "mark": "A dashed line: the shift lies in the picture. The half arrow, which the plates add "
                "to the Tables’ symbol, shows which way the entry’s generator steps.",
    },
    {
        "id": "plane-c",
        "name": "Glide plane <i>c</i>",
        "short": "<i>c</i>",
        "formula": plane_formula(False, rise(1, 2)),
        "crystal": "The reflection, then a rise of half a period. Nothing moves along the line. Twice "
                   "is the lattice translation %s." % C,
        "plate": "It looks like a mirror line, but the two sides differ by half a period: a mirror "
                 "that swaps the two colours.",
        "mark": "A dotted line: the shift points along the axis, out of the picture.",
    },
    {
        "id": "plane-n",
        "name": "Diagonal glide plane <i>n</i>",
        "short": "<i>n</i>",
        "formula": plane_formula(True, rise(1, 2)),
        "crystal": "The reflection, then half a repeat along the line and half a period up: one "
                   "diagonal step inside the plane. Twice is the lattice translation "
                   "<i>b</i> + %s." % C,
        "plate": "A glide line that also swaps the two colours at every step.",
        "mark": "Dashes and dots together: a shift in the picture and one along the axis. On a plate "
                "a half arrow shows which way the generator steps.",
    },
    {
        "id": "plane-d",
        "name": "Diamond glide plane <i>d</i>",
        "short": "<i>d</i>",
        "formula": plane_formula(True, rise(1, 4)),
        "crystal": "The reflection, then half a repeat along the line and a quarter of a period up. "
                   "Twice is <i>b</i> + %s, a centring vector, so only centred lattices have such "
                   "planes. Four times is the lattice translation 2<i>b</i> + %s."
                   % (rise(1, 2), C),
        "plate": "A glide line along which the colours run through a cycle of four.",
        "mark": "Dashes and dots with arrowheads. The arrows point along the line in the direction "
                "that goes with the rise; taken the other way the same glide descends by %s. "
                "Measured in the conventional centred cell both parts are a quarter of an edge."
                % rise(1, 4),
    },
]


def axis_cards():
    cards = []
    for (n, m), text in AXES.items():
        card = dict(text)
        card.update({
            "id": "rotation-%d-%d" % (n, m),
            "name": axis_name(n, m),
            "short": axis_short(n, m),
            "formula": axis_formula(n, m),
            "glyph_path": correspondence_symbols.symbol_path(n, m),
            "order": n,
        })
        cards.append(card)
    return cards


def all_cards():
    return TRANSLATION + axis_cards() + PLANES


def plain(fragment):
    """Text of an HTML fragment for an attribute: 4<sub>1</sub> -> 4₁."""
    subscripts = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
    fragment = re.sub(r"<sub>(\d+)</sub>", lambda mm: mm.group(1).translate(subscripts), fragment)
    return html_lib.unescape(re.sub(r"<[^>]+>", "", fragment))


# --- what the snapshot provides ----------------------------------------------
def icons(dialog):
    """{symbol id: its <svg> from the visual index}."""
    found = {}
    for match in re.finditer(
            r'<li class="diagram-symbol-item" data-legend-symbol="([^"]+)">'
            r'<span class="diagram-symbol-image">(<svg.*?</svg>)</span>', dialog, re.S):
        found[match.group(1)] = match.group(2)
    return found


def usage(families):
    """{symbol id: [(Hermann-Mauguin name, link)]}: the entries whose plate
    carries the symbol, in the order of the correspondence."""
    drawn = {}
    for family in families:
        names = {gid: meta for gid, _sig, meta in family.tabs}
        for match in re.finditer(
                r'<svg class="plate-generator-overlay" data-generator-overlay="(g\d+)"[^>]*>(.*?)</svg>',
                family.section, re.S):
            gid, overlay = match.groups()
            for symbol in dict.fromkeys(re.findall(r'data-generator-symbol="([^"]+)"', overlay)):
                drawn.setdefault(symbol, []).append((names[gid], "%s#%s" % (family.page, gid)))
    return drawn


# --- links into the guide from the 18 correspondence pages --------------------
def link_teaser(teaser):
    """The "Diagram symbols" card gains a link to the guide beside its button."""
    button = re.search(r'<button class="diagram-symbol-open".*?</button>', teaser, re.S)
    if not button or "diagram-symbol-guide" in teaser:
        raise ValueError("the Diagram symbols card changed; cannot place the guide link")
    actions = (
        '<div class="diagram-symbol-actions">%s'
        '<a class="diagram-symbol-guide" href="%s">See each symbol in action '
        '<span aria-hidden="true">→</span></a></div>' % (button.group(0), PAGE))
    return teaser[:button.start()] + actions + teaser[button.end():]


def link_index(dialog):
    """Every name in the visual index opens that symbol's card in the guide."""
    def linked(match):
        return '%s<strong><a href="%s#%s">%s</a></strong>' % (
            match.group(1), PAGE, match.group(2), match.group(3))

    dialog, count = re.subn(
        r'(<li class="diagram-symbol-item" data-legend-symbol="([^"]+)">.*?)<strong>(.*?)</strong>',
        linked, dialog, flags=re.S)
    if count != len(all_cards()):
        raise ValueError("visual index lists %d symbols, the guide has %d" % (count, len(all_cards())))
    intro = '<p class="diagram-symbol-dialog-intro">'
    if intro not in dialog:
        raise ValueError("visual index intro changed; cannot place the guide note")
    note = ('<p class="diagram-symbol-guide-note">Each name opens an animated figure of what the '
            'symbol does, in the <a href="%s">symbol guide</a>.</p>' % PAGE)
    start = dialog.index(intro)
    end = dialog.index("</p>", start) + len("</p>")
    return dialog[:end] + note + dialog[end:]


# --- the page -----------------------------------------------------------------
def key_mark(card, icon):
    return ('<a class="symbol-key-mark" href="#%s" aria-label="%s">%s<span>%s</span></a>' % (
        card["id"], html_lib.escape(plain(card["name"]), quote=True), icon, card["short"]))


def key_table(cards, icon_of):
    by_id = {card["id"]: card for card in cards}

    def marks(ids):
        return "".join(key_mark(by_id[i], icon_of[i]) for i in ids)

    turns = []
    screws = []
    for n in (2, 3, 4, 6):
        turns.append("rotation-%d-0" % n)
        screws.append('<span class="symbol-key-run">%s</span>' % marks(
            ["rotation-%d-%d" % (n, m) for m in range(1, n)]))
    rows = [
        ("a shift", marks(["translation"]),
         '<span class="symbol-key-none">a centring vector: no mark of its own</span>'),
        ("a turn by 360°/<i>n</i>", marks(turns), "".join(screws)),
        ("a reflection", marks(["plane-m"]), marks(["plane-c"])),
        ("a reflection and a half-repeat shift", marks(["plane-axial"]), marks(["plane-n", "plane-d"])),
    ]
    body = "\n".join(
        '          <tr><th scope="row">%s</th><td>%s</td><td>%s</td></tr>' % row for row in rows)
    return (
        '      <table class="symbol-key">\n'
        '        <thead><tr><th scope="col">In the picture</th>'
        '<th scope="col">No rise</th><th scope="col">With a rise</th></tr></thead>\n'
        '        <tbody>\n%s\n        </tbody>\n'
        '      </table>' % body)


def drawn_on(places):
    if not places:
        return ""
    links = ", ".join('<a href="%s">%s</a>' % (href, name) for name, href in places)
    count = "%d plate%s" % (len(places), "" if len(places) == 1 else "s")
    if len(places) > 8:
        return ('<dt>Drawn on</dt><dd><details class="symbol-places"><summary>%s</summary>'
                '<p>%s</p></details></dd>' % (count, links))
    return "<dt>Drawn on</dt><dd>%s</dd>" % links


def card_html(card, icon, places):
    more = '\n            <p class="symbol-card-more">%s</p>' % card["more"] if card.get("more") else ""
    glyph_path = ' data-glyph-path="%s"' % card["glyph_path"] if card.get("glyph_path") else ""
    return (
        '      <article class="symbol-card" id="%(id)s">\n'
        '        <header class="symbol-card-head">\n'
        '          <span class="symbol-card-glyph" aria-hidden="true">%(icon)s</span>\n'
        '          <div class="symbol-card-title">\n'
        '            <h3>%(name)s</h3>\n'
        '            <p class="symbol-card-formula">%(formula)s</p>\n'
        '          </div>\n'
        '          <a class="symbol-card-up" href="#marks">All marks <span aria-hidden="true">↑</span></a>\n'
        '        </header>\n'
        '        <div class="symbol-card-body">\n'
        '          <div class="symbol-card-text">\n'
        '            <dl>\n'
        '              <dt>In the crystal</dt><dd>%(crystal)s</dd>\n'
        '              <dt>On the plate</dt><dd>%(plate)s</dd>\n'
        '              <dt>The mark</dt><dd>%(mark)s</dd>\n'
        '              %(places)s\n'
        '            </dl>%(more)s\n'
        '          </div>\n'
        '          <div class="symbol-figure" data-symbol-figure data-symbol="%(id)s" '
        'data-symbol-name="%(label)s"%(glyph_path)s>\n'
        '            <p class="symbol-figure-fallback">The animated figure needs JavaScript.</p>\n'
        '          </div>\n'
        '        </div>\n'
        '      </article>' % {
            "id": card["id"], "icon": icon, "name": card["name"], "formula": card["formula"],
            "crystal": card["crystal"], "plate": card["plate"], "mark": card["mark"],
            "places": drawn_on(places), "more": more, "glyph_path": glyph_path,
            "label": html_lib.escape("the " + plain(card["name"]).replace("Translation", "translation"),
                                     quote=True),
        })


def page(parts, head_for):
    """The guide, built from the split script's Parts (head, visual index,
    families); `head_for` is split_correspondence.head_for."""
    cards = all_cards()
    icon_of = icons(parts.dialog)
    missing = [card["id"] for card in cards if card["id"] not in icon_of]
    if missing or len(icon_of) != len(cards):
        raise ValueError("the guide and the visual index disagree on the symbols: %s" % (
            missing or sorted(set(icon_of) - {card["id"] for card in cards})))
    drawn = usage(parts.families)
    unknown = sorted(set(drawn) - set(icon_of))
    if unknown:
        raise ValueError("plates carry symbols the guide does not explain: %s" % unknown)

    head = head_for(
        parts,
        "Diagram symbols — Animation/colouring correspondence — Spacetime Groups",
        "What each of the 21 crystallographic symbols on the correspondence plates does to a "
        "polar crystal: an animated figure of every translation, rotation axis, screw axis, "
        "mirror and glide plane, in the crystal and on its colour plate.")
    skip = '<a class="skip-link" href="#correspondences">Skip to correspondences</a>'
    if skip not in head:
        raise ValueError("the skip link changed; cannot retarget it")
    head = head.replace(skip, '<a class="skip-link" href="#marks">Skip to the symbols</a>', 1)
    head = head.replace(
        "</head>",
        '  <link rel="stylesheet" href="css/correspondence-symbols.css?v=%s">\n'
        '  <script type="module" src="js/correspondence-symbols.js?v=%s"></script>\n'
        "</head>" % (ASSET_VERSION, ASSET_VERSION), 1)

    def section(cards_in):
        return "\n\n".join(card_html(card, icon_of[card["id"]], drawn.get(card["id"], []))
                           for card in cards_in)

    axes = [card for card in cards if card["id"].startswith("rotation-")]
    axis_groups = []
    for n in (2, 3, 4, 6):
        group = [card for card in axes if card["order"] == n]
        axis_groups.append(
            '      <h3 class="symbol-group-title" id="order-%d">%s-turns: %s</h3>\n\n%s' % (
                n, ORDER_WORD[n].capitalize(),
                ", ".join(card["short"] for card in group), section(group)))

    sources = re.search(r'<p class="diagram-symbol-sources">(.*?)</p>', parts.dialog, re.S)
    if not sources:
        raise ValueError("the visual index lost its sources line")

    body = (
        '<main class="correspondence-page symbol-guide">\n'
        '    <section class="directory symbol-guide-intro" aria-labelledby="page-title">\n'
        '      <p class="family-breadcrumb"><a href="correspondence.html">Animation/colouring correspondence</a>'
        ' <span aria-hidden="true">·</span> diagram symbols</p>\n'
        '      <h1 id="page-title">What each diagram symbol does</h1>\n'
        '      <p>A polar crystal has one direction, the polar axis %(c)s, that no symmetry of the crystal '
        'reverses. Stand the axis upright. Every symmetry is then an isometry of the horizontal plane '
        '(a shift, a turn, a reflection or a glide reflection) together with a rise along the axis:</p>\n'
        '      <p class="symbol-guide-law"><span class="symbol-guide-law-map">(<i>p</i>, <i>z</i>) ↦ '
        '(<i>g</i>·<i>p</i>, <i>z</i> + <i>h</i>)</span>'
        '<span class="symbol-guide-law-where"><i>g</i> an isometry of the plane, <i>h</i> a height counted '
        'modulo the period %(c)s</span></p>\n'
        '      <p>A colour plate is the crystal seen from above, looking down the axis. It shows <i>g</i> '
        'as it is. The rise <i>h</i> is carried by the colours, one colour for each height that occurs, so '
        '<i>N</i> colours cut the period into <i>N</i> equal steps. (In an entry’s animation the same '
        'height is the phase of the loop.) Each mark on a plate stands for one pair (<i>g</i>, <i>h</i>): '
        'its shape says what happens in the picture, its decoration how far up.</p>\n'
        '      <p>Nothing turns the axis over (in the animation, nothing runs time backwards), so the '
        'marks for operations that would (inversion centres, rotoinversion axes, mirrors and two-fold axes '
        'lying across %(c)s) never occur on these plates. The 21 marks below are all that do.</p>\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="marks" aria-labelledby="marks-title">\n'
        '      <h2 id="marks-title">The 21 marks</h2>\n'
        '      <p class="symbol-guide-note">Rows say what the operation does in the picture, columns '
        'whether it also rises. Select a mark to see it act.</p>\n'
        '%(key)s\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="figures" aria-labelledby="figures-title">\n'
        '      <h2 id="figures-title">Reading a figure</h2>\n'
        '      <ul class="symbol-guide-list">\n'
        '        <li><strong>Tiles</strong> are the copies of one motif. Their colour is their height, '
        'as on the plates.</li>\n'
        '        <li><strong>In the crystal</strong>: one period, with the axis up. The floor is height 0 '
        'and the dashed frame is height %(c)s, where everything repeats: the paler tiles up there are the '
        'bottom ones again. A stem drops from each tile to its footprint on the floor, and the mark lies on '
        'the floor where the plate has it.</li>\n'
        '        <li><strong>On the plate</strong>: the same tiles seen from above, each with its height '
        'written beside it as a fraction of %(c)s.</li>\n'
        '        <li><strong>The dark-outlined tile</strong> is carried by the operation from one copy to '
        'the next, again and again. Pause it, step it once, or look straight down the axis to watch the '
        'crystal turn into its plate.</li>\n'
        '        <li><strong>Move every tile</strong> applies the operation to the whole crystal at once. It '
        'lands on itself, which is what makes the operation a symmetry.</li>\n'
        '        <li><strong>Drag</strong> the crystal to turn it. Drag the ringed tile on the plate to '
        'move the motif: every copy follows.</li>\n'
        '      </ul>\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="translations" aria-labelledby="translations-title">\n'
        '      <h2 id="translations-title">Translation</h2>\n\n'
        '%(translation)s\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="axes" aria-labelledby="axes-title">\n'
        '      <h2 id="axes-title">Rotation and screw axes</h2>\n'
        '      <p>A turn by 360°/<i>n</i> about a line parallel to the axis, together with a rise of '
        '<i>m</i>/<i>n</i> of the period. Seen from above the line is a point, and the core of the mark '
        'gives <i>n</i>: a lens, a triangle, a diamond or a hexagon for 2, 3, 4 or 6. With no rise it is a '
        'rotation axis <i>n</i>. With a rise it is a screw axis <i>n</i><sub><i>m</i></sub>, named for its '
        'counter-clockwise turn, which rises <i>m</i>%(c)s/<i>n</i>.</p>\n'
        '      <p>The clockwise turn about the same axis rises (<i>n</i> − <i>m</i>)%(c)s/<i>n</i>: one '
        'turn after the other leaves the picture where it was and lifts it by exactly one period. A '
        'generator table may quote either turn. A screw’s figure starts with the turn that rises less, '
        'and the two buttons under it switch between them.</p>\n'
        '      <p>A rotation axis keeps its own points fixed. A screw axis keeps nothing fixed: drag the '
        'motif onto the axis and its copies still stand at different heights.</p>\n\n'
        '%(axes)s\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="planes" aria-labelledby="planes-title">\n'
        '      <h2 id="planes-title">Mirror and glide planes</h2>\n'
        '      <p>A reflection in a plane that contains the axis, followed by a shift inside the plane. '
        'Seen from above the plane is a line, and the way the line is drawn says where the shift points. '
        'In the formulas <i>x</i> is the distance from the plane, <i>y</i> runs along its line, and '
        '<i>b</i> is the repeat of the picture along that line, colours ignored.</p>\n'
        '      <p>A mirror keeps its own points fixed. A glide plane keeps nothing fixed, and the bare '
        'mirror image of a tile is not in the crystal.</p>\n\n'
        '%(planes)s\n'
        '    </section>\n\n'
        '    <section class="symbol-guide-section" id="at-a-glance" aria-labelledby="glance-title">\n'
        '      <h2 id="glance-title">Reading a mark at a glance</h2>\n'
        '      <ul class="symbol-guide-list">\n'
        '        <li><strong>Core.</strong> Lens, triangle, diamond, hexagon: a turn of order 2, 3, 4, 6. '
        'A line: a plane seen edge-on. An open arrow: a translation.</li>\n'
        '        <li><strong>Tails.</strong> None: no rise. Otherwise count them: the copies around the '
        'mark stand at that many heights, so the turn steps a cycle of that many colours.</li>\n'
        '        <li><strong>Sense.</strong> Tails pointing counter-clockwise: the stair climbs '
        'counter-clockwise, a right-handed screw (3<sub>1</sub>, 4<sub>1</sub>, 6<sub>1</sub>, '
        '6<sub>2</sub>). Pointing clockwise: left-handed (3<sub>2</sub>, 4<sub>3</sub>, 6<sub>4</sub>, '
        '6<sub>5</sub>). With two tails (2<sub>1</sub>, 4<sub>2</sub>, 6<sub>3</sub>) there is no '
        'handedness.</li>\n'
        '        <li><strong>Line.</strong> Solid: a reflection only. Dashed: half a repeat along the line. '
        'Dotted: half a period along the axis. Dashes and dots: both. With arrowheads: half a repeat along '
        'the line and a quarter of a period up.</li>\n'
        '        <li><strong>Fixed points.</strong> Only rotation axes and mirrors have them. Screw axes, '
        'glide planes and translations move every point.</li>\n'
        '        <li><strong>Colour.</strong> An operation that rises <i>h</i> moves a cycle of <i>N</i> '
        'colours on by <i>N</i><i>h</i>/%(c)s places.</li>\n'
        '      </ul>\n'
        '      <p class="symbol-guide-sources">%(sources)s · <a href="correspondence.html">Back to the '
        'correspondence</a></p>\n'
        '    </section>\n'
        '  </main>\n'
        '</body>\n'
        '</html>\n' % {
            "c": C,
            "key": key_table(cards, icon_of),
            "translation": section(TRANSLATION),
            "axes": "\n\n".join(axis_groups),
            "planes": section(PLANES),
            "sources": sources.group(1).strip().rstrip("."),
        })
    return head + body
