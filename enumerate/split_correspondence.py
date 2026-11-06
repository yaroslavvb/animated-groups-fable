#!/usr/bin/env python3
"""Split the clockwork/colouring correspondence into one page per wallpaper group.

The 68-row correspondence is a snapshot generated in the sibling repository
(animated-groups, scripts/generate_clockwork_coloring_correspondence.py) and
kept here as enumerate/correspondence-source.html, with the generator symbols
redrawn by correspondence_symbols.py.  One scroll of 68 entries was a "roll of
text"; this script cuts the snapshot into

    docs/correspondence.html            the index: introduction, symbol key,
                                        notation, and a visual table of
                                        contents with one card per wallpaper
                                        group (the MathWorld thumbnails of
                                        patterns.html)
    docs/correspondence-<hm>.html       one page per wallpaper group, in the
                                        order of the International Tables:
                                        p1, p2, pm, pg, cm, pmm, pmg, pgg,
                                        cmm, p4, p4m, p4g, p3, p3m1, p31m,
                                        p6, p6m

Every entry keeps its id, so a link that used to read
correspondence.html#g244 still works: the index redirects it to
correspondence-p6.html#g244.

An entry whose colouring Vladimir Bulatov has rendered in his catalog of
colour groups (the G/K[N] entry whose subgroup is the colouring's kernel)
also gets a "Vladimir catalog" line in its Identifications list, from
docs/data/vladimir-catalog-links.json, which vladimir_catalog_links.py
derives from his manifests together with a "rendered" flag for the current
snapshot of his catalog.  Entries he has not rendered yet get no line.  The
source snapshot stays untouched; the rows are added while the pages are
written.

Every entry also shows its clockwork orbifold symbol (docs/data/catalog.json,
the same symbol the catalogue prints) under its heading and in its tab; the
snapshot printed it only where the book signature needed disambiguating.

Every entry finally gets a "Visualizations" section under its Extra links: up
to four Showcase clips of that very group, a line to the family's section of
the Showcase, and a card for each explorer, full-screen viewer or tool that
draws the group, each with a true count or a short true description.  The
section is built by correspondence_visualizations.py from the shipped
manifests; one of those manifests, docs/data/designer-links.json, is written by
``node enumerate/designer_links.mjs`` (with ``--check`` to verify it is
current) and must be re-run whenever the designer's group menu changes.  The 17
family pages (not the index, which holds no entries) load
css/correspondence-visualizations.css and js/correspondence-visualizations.js,
which plays a clip while it is on screen and frees it again when it is not.

Order of operations after editing the source:
    python3 correspondence_frames.py --check  every tab of a page shares one
                                            pattern and one set of generator
                                            marks (see that script to rewrite)
    python3 correspondence_symbols.py       redraw the symbols in the source
    python3 vladimir_catalog_links.py       refresh the catalog links (needs a
                                            checkout of vbulatov2011/colorsym-catalog)
    python3 split_correspondence.py         write the 18 pages
    python3 split_correspondence.py --check exit 1 unless the pages are current
"""

import html as html_lib
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import correspondence_symbols  # noqa: E402
import correspondence_visualizations  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "enumerate" / "correspondence-source.html"
DOCS = ROOT / "docs"
INDEX = DOCS / "correspondence.html"
LINKS = DOCS / "data" / "vladimir-catalog-links.json"

SUBSCRIPTS = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
SUPERSCRIPTS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def text_of(fragment):
    """Plain text of an HTML fragment; sub/superscript digits become Unicode."""
    fragment = re.sub(r"<sub>(\d+)</sub>", lambda m: m.group(1).translate(SUBSCRIPTS), fragment)
    fragment = re.sub(r"<sup>(\d+)</sup>", lambda m: m.group(1).translate(SUPERSCRIPTS), fragment)
    return html_lib.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def attr(value):
    return html_lib.escape(value, quote=True)


def balanced(source, open_prefix, tag, from_idx=0):
    """(start, end) of the element whose opening tag begins with `open_prefix`,
    honouring nested elements of the same tag."""
    start = source.index(open_prefix, from_idx)
    open_re = re.compile(r"<%s\b" % tag)
    close = "</%s>" % tag
    depth = 0
    i = start
    while True:
        opening = open_re.search(source, i)
        closing = source.find(close, i)
        if closing == -1:
            raise ValueError("unbalanced <%s> after %d" % (tag, start))
        if opening and opening.start() < closing:
            depth += 1
            i = opening.end()
        else:
            depth -= 1
            i = closing + len(close)
            if depth == 0:
                return start, i


def cut(source, open_prefix, tag, from_idx=0):
    start, end = balanced(source, open_prefix, tag, from_idx)
    return source[start:end]


def load_links():
    """Vladimir Bulatov's colour-group catalog page for each of the 68 records,
    as written by vladimir_catalog_links.py: (meta, {record id: link})."""
    data = json.loads(LINKS.read_text(encoding="utf-8"))
    return data["meta"], data["links"]


def vladimir_row(link):
    """The "Vladimir catalog" line of an entry's Identifications list."""
    notes = []
    variants = link["entries"]
    if len(variants) > 1:
        notes.append(
            '<span class="vladimir-catalog-note" title="%s">%d subgroups up to conjugacy '
            'in his manifest share this page</span>' % (attr(", ".join(variants)), len(variants)))
    return (
        '<li class="other-names-row vladimir-catalog-row">'
        '<span class="other-name-category">Vladimir catalog</span>'
        '<span class="vladimir-catalog-list">'
        '<a class="vladimir-catalog-link" href="%s" target="_blank" rel="noopener" '
        'title="Vladimir Bulatov\u2019s catalog of colour groups of the wallpaper groups, entry %s">%s</a>'
        '%s</span></li>' % (
            attr(link["url"]), attr(link["entry"]), html_lib.escape(link["entry"]), "".join(notes)))


def add_vladimir_rows(fragment, gids, links):
    """Append the Vladimir catalog row to the Identifications list of each
    entry whose page exists in the current snapshot of his catalog."""
    for gid in gids:
        if gid not in links:
            raise ValueError("%s has no Vladimir catalog link; run vladimir_catalog_links.py" % gid)
        if not links[gid]["rendered"]:
            continue
        start = fragment.index('aria-labelledby="%s-other-names-title"' % gid)
        end = fragment.index("</ul>", start)
        if 'vladimir-catalog-row' in fragment[start:end]:
            continue
        line_start = fragment.rfind("\n", 0, end) + 1
        row = "                  %s\n" % vladimir_row(links[gid])
        fragment = fragment[:line_start] + row + fragment[line_start:]
    return fragment


def add_vladimir_provenance(tail, meta):
    """Link the catalog itself and the link map from the Data section."""
    if "vladimir-catalog-links.json" in tail:
        return tail
    anchor = "68-record crystal-example map</a>"
    if anchor not in tail:
        raise ValueError("provenance paragraph changed; cannot place the Vladimir catalog links")
    addition = (
        ' · <a href="%s">Vladimir Bulatov\u2019s catalog of colour groups</a>'
        ' · <a href="data/vladimir-catalog-links.json">68-record catalog link map</a>' % attr(meta["base_url"]))
    return tail.replace(anchor, anchor + addition, 1)


CATALOG = DOCS / "data" / "catalog.json"


def load_clockwork_symbols():
    """The clockwork orbifold symbol of every catalogue group, as text and as
    HTML: {id: (text, html)}.  Stars are shown as the page shows every
    orbifold star, with the same glyph and class as the book signatures."""
    star = '<span class="orbifold-star">∗</span>'
    symbols = {}
    for group in json.loads(CATALOG.read_text(encoding="utf-8"))["groups"]:
        symbols[group["id"]] = (group["symbol"].replace("*", "∗"),
                                group["symbolHtml"].replace("*", star))
    return symbols


def add_clockwork_symbols(fragment, gids, symbols):
    """Give every entry its clockwork symbol, under the heading and in the tab.

    The snapshot prints the symbol only where the book signature needs
    disambiguating (3₁3₁3₁ against 3₂3₂3₂ and the like); the catalogue has one
    for every group, so every entry now carries it, and the eight original
    labels lose their "project-specific" wording."""
    fragment = fragment.replace("Project-specific clockwork symbol", "Clockwork symbol")
    fragment = fragment.replace("project-specific clockwork symbol", "clockwork symbol")
    for gid in gids:
        if gid not in symbols:
            raise ValueError("%s is not in docs/data/catalog.json" % gid)
        text, html = symbols[gid]
        # The heading, after the signature (and any evidence note).
        title = fragment.index('id="%s-title"' % gid)
        header_end = fragment.index("</header>", title)
        if "clockwork-disambiguator--heading" not in fragment[title:header_end]:
            span = ('<span class="clockwork-disambiguator clockwork-disambiguator--heading" '
                    'aria-label="Clockwork symbol %s">%s</span>\n          ' % (attr(text), html))
            fragment = fragment[:header_end] + span + fragment[header_end:]
        # The tab, between the signature and the Hermann-Mauguin name.
        tab_start = fragment.index('<a class="clockwork-tab" id="tab-%s"' % gid)
        tab_end = fragment.index("</a>", tab_start)
        tab = fragment[tab_start:tab_end]
        if "clockwork-disambiguator--tab" not in tab:
            tab = re.sub(r'(aria-label="[^"]*colour action %s)"' % gid,
                         r'\1; clockwork symbol %s"' % attr(text).replace("\\", "\\\\"), tab, count=1)
            # The signature nests <span class="orbifold-star">, so find its
            # balanced end rather than the first closing tag.
            _start, signature_end = balanced(tab, '<span class="tab-signature">', "span")
            tab = (tab[:signature_end]
                   + '<span class="clockwork-disambiguator clockwork-disambiguator--tab" '
                     'aria-label="Clockwork symbol %s">%s</span>' % (attr(text), html)
                   + tab[signature_end:])
            fragment = fragment[:tab_start] + tab + fragment[tab_end:]
    return fragment


VISUALIZATIONS_ASSETS = (
    '  <link rel="stylesheet" href="css/correspondence-visualizations.css?v=visualizations-v1">\n'
    '  <script type="module" src="js/correspondence-visualizations.js?v=visualizations-v1"></script>\n'
)


def add_visualizations(fragment, gids, visualizations):
    """Put the Visualizations section after each entry's Extra links.

    It is the last block of the .entry-copy column, so it follows the closing
    tag of details.extra-links; correspondence_visualizations.py renders it at
    that element's own indentation."""
    for gid in gids:
        if gid not in visualizations:
            raise ValueError("%s has no visualizations; the correspondence data is stale" % gid)
        if 'data-visualizations="%s"' % gid in fragment:
            continue
        opening = '<details class="extra-links" data-extra-links="%s">' % gid
        start, end = balanced(fragment, opening, "details")
        indent = start - (fragment.rfind("\n", 0, start) + 1)
        section = correspondence_visualizations.section_html(gid, visualizations[gid], indent)
        fragment = fragment[:end] + "\n\n" + section + fragment[end:]
    return fragment


class Family:
    def __init__(self, section, links, symbols, visualizations):
        self.section = section
        self.hm = re.search(r'id="wallpaper-([^"]+)"', section).group(1)
        # The signature nests <span class="orbifold-star">, so cut it balanced.
        orbifold = cut(section, '<span class="family-orbifold">', "span")
        self.orbifold_html = orbifold[len('<span class="family-orbifold">'):-len("</span>")]
        self.orbifold_text = text_of(self.orbifold_html)
        self.count_text = text_of(re.search(
            r'<span class="family-count">(.*?)</span>', section, re.S).group(1))
        self.summary = re.search(
            r'<p class="family-summary">(.*?)</p>', section, re.S).group(1).strip()
        self.entries = re.findall(
            r'<section class="correspondence-entry" id="(g\d+)"[^>]*data-clock-order="(\d+)"',
            section)
        gids = [gid for gid, _order in self.entries]
        self.tabs_html = add_visualizations(
            add_clockwork_symbols(
                add_vladimir_rows(cut(section, '<div class="clockwork-tabs"', "div"), gids, links),
                gids, symbols),
            gids, visualizations)
        self.tabs = []
        for tab in re.finditer(
                r'<a class="clockwork-tab" id="tab-(g\d+)"[^>]*>(.*?)</a>', section, re.S):
            sig_span = cut(tab.group(2), '<span class="tab-signature">', "span")
            sig_html = sig_span[len('<span class="tab-signature">'):-len("</span>")]
            meta = re.search(r'<span class="tab-meta">(.*?)</span>', tab.group(2), re.S)
            self.tabs.append((tab.group(1), sig_html, meta.group(1)))
        if len(self.tabs) != len(self.entries):
            raise ValueError("%s: %d tabs for %d entries" % (self.hm, len(self.tabs), len(self.entries)))

    @property
    def page(self):
        return "correspondence-%s.html" % self.hm

    @property
    def count(self):
        return len(self.entries)

    @property
    def space_groups_html(self):
        return " · ".join(
            '<span class="family-card-group-item" data-group-id="%s">%s</span>' % (gid, meta)
            for gid, _sig, meta in self.tabs
        )

    @property
    def space_groups_text(self):
        return ", ".join(text_of(meta) for _gid, _sig, meta in self.tabs)

    @property
    def chaim_signatures_html(self):
        return " · ".join(
            '<span class="family-card-group-item" data-group-id="%s">%s</span>' % (gid, sig)
            for gid, sig, _meta in self.tabs
        )

    @property
    def chaim_signatures_text(self):
        return ", ".join(text_of(sig) for _gid, sig, _meta in self.tabs)


class Parts:
    def __init__(self, source):
        main_start = source.index('<main class="correspondence-page">')
        self.head = source[:main_start]
        directory = cut(source, '<section class="directory"', "section")
        self.h1 = cut(directory, "<h1", "h1")
        self.note = cut(directory, '<p class="directory-viewer-note"', "p")
        self.teaser = cut(directory, '<aside class="diagram-symbol-teaser"', "aside")
        self.notation = cut(directory, '<aside class="notation-caveat"', "aside")
        self.dialog = cut(source, '<section class="diagram-symbol-dialog"', "section")
        self.links_meta, self.links = load_links()
        self.symbols = load_clockwork_symbols()
        self.visualizations = correspondence_visualizations.load()
        atlas = cut(source, '<div class="correspondence-atlas"', "div")
        self.families = []
        i = 0
        while True:
            try:
                start, end = balanced(atlas, '<section class="wallpaper-family"', "section", i)
            except ValueError:
                break
            self.families.append(
                Family(atlas[start:end], self.links, self.symbols, self.visualizations))
            i = end
        if len(self.families) != 17:
            raise ValueError("expected 17 wallpaper families, found %d" % len(self.families))
        self.tail = add_vladimir_provenance(
            source[source.index('<section class="provenance"'):], self.links_meta)
        self.title = re.search(r"<title>(.*?)</title>", self.head).group(1)


def head_for(parts, title, description):
    head = parts.head.replace("<title>%s</title>" % parts.title, "<title>%s</title>" % attr(title), 1)
    head = re.sub(r'<meta name="description" content="[^"]*">',
                  '<meta name="description" content="%s">' % attr(description), head, count=1)
    return head


def redirect_script(parts):
    """Old deep links into the single page land on the right group page."""
    entry_to_hm = {gid: family.hm for family in parts.families for gid, _order in family.entries}
    families = [family.hm for family in parts.families]
    return (
        "  <script>\n"
        "    // The correspondence used to be one page; #g244 and #wallpaper-p6 now\n"
        "    // live on correspondence-p6.html.\n"
        "    (() => {\n"
        "      const entries = %s;\n"
        "      const families = %s;\n"
        "      const hash = decodeURIComponent(location.hash.slice(1));\n"
        "      if (entries[hash]) location.replace(`correspondence-${entries[hash]}.html#${hash}`);\n"
        "      else if (hash.startsWith(\"wallpaper-\") && families.includes(hash.slice(10))) "
        "location.replace(`correspondence-${hash.slice(10)}.html`);\n"
        "    })();\n"
        "  </script>\n"
    ) % (json.dumps(entry_to_hm, ensure_ascii=False, separators=(",", ":")),
         json.dumps(families, separators=(",", ":")))


INDEX_ASSETS = (
    '  <script src="js/polar-inclusions.js?v=hasse-chaim-v1" defer></script>\n'
)


def filter_bar_html(include_hasse_mode=False):
    mode_field = (
        '        <label class="correspondence-filter-field">\n'
        '          <span class="correspondence-filter-label">Hasse diagram view</span>\n'
        '          <select data-filter-hasse-mode>\n'
        '            <option value="highlight">All 68 groups (highlight matches)</option>\n'
        '            <option value="induced">Matching only (induced sub-poset)</option>\n'
        '          </select>\n'
        '        </label>\n'
    ) if include_hasse_mode else ""
    return (
        '      <div class="correspondence-filters" data-correspondence-filters role="region" '
        'aria-label="Filter the 68 clockwork groups">\n'
        '        <div class="correspondence-filter-controls">\n'
        '          <label class="correspondence-filter-field">\n'
        '            <span class="correspondence-filter-label">Number of colors</span>\n'
        '            <select data-filter-colors>\n'
        '              <option value="all">All colors (68)</option>\n'
        '              <option value="1">1 color — static / monochrome (17)</option>\n'
        '              <option value="2">2 colors (36)</option>\n'
        '              <option value="3">3 colors (6)</option>\n'
        '              <option value="4">4 colors (6)</option>\n'
        '              <option value="6">6 colors (3)</option>\n'
        '            </select>\n'
        '          </label>\n'
        '          <label class="correspondence-filter-field">\n'
        '            <span class="correspondence-filter-label">Still-frame symmetry</span>\n'
        '            <select data-filter-rolling>\n'
        '              <option value="all">All 68 animations</option>\n'
        '              <option value="rolling-only">Frames lack projected symmetry — rolling only (K ≠ Γ, 45)</option>\n'
        '              <option value="pure-rolling">Frames have only translations — no point symmetry (K = ◦, 8)</option>\n'
        '              <option value="any-rolling">Any rolling / time-shifted symmetry (N &gt; 1, 51)</option>\n'
        '              <option value="frame-keeps">Frames already have projected symmetry type (K ≅ Γ, 23)</option>\n'
        '              <option value="static">Full symmetry in every still frame (N = 1, 17)</option>\n'
        '            </select>\n'
        '          </label>\n'
        '%s'
        '          <button class="correspondence-filter-reset" type="button" data-filter-reset hidden>'
        'Reset filters</button>\n'
        '        </div>\n'
        '        <p class="correspondence-filter-status" data-filter-status role="status" aria-live="polite">'
        'Showing all 68 groups across 17 projected orbifold groups · 123 immediate generator inclusions.</p>\n'
        '      </div>'
    ) % mode_field


def index_page(parts):
    cards = []
    for family in parts.families:
        label = "%s: %s (%s)" % (
            family.orbifold_text, family.count_text, family.chaim_signatures_text)
        # The same MathWorld wallpaper thumbnails as patterns.html.
        cards.append(
            '        <a class="family-card" href="%s" data-family-hm="%s" data-total-count="%d" aria-label="%s">\n'
            '          <img src="img/mathworld/%s.webp" width="320" height="240" loading="lazy" decoding="async" alt="">\n'
            '          <span class="family-card-caption"><strong class="family-card-orbifold">%s</strong></span>\n'
            '          <span class="family-card-count" aria-hidden="true" title="%s">%d</span>\n'
            '          <span class="family-card-groups" aria-hidden="true">%s</span>\n'
            '        </a>' % (
                family.page, family.hm, family.count, attr(label), family.hm,
                family.orbifold_html,
                attr(family.count_text), family.count, family.chaim_signatures_html))
    total = sum(family.count for family in parts.families)
    head = parts.head.replace("</head>", redirect_script(parts) + INDEX_ASSETS + "</head>", 1)
    # The index opens on the wallpaper groups and the Hasse diagram; the symbol
    # key (with its visual index, which the script keeps next to its teaser) and
    # the notation note follow them as reference material, as on the group pages.
    body = (
        '<main class="correspondence-page">\n'
        '    <section class="directory" aria-labelledby="page-title">\n'
        '      %s\n'
        '      %s\n'
        '      <p class="directory-viewer-note"><a href="#correspondences">Grouped by projected group (17)</a>'
        ' · <a href="#hasse-diagram">Hasse diagram by inclusion (68)</a>'
        ' · <a href="polar-inclusions.html">Standalone inclusion diagram →</a></p>\n'
        '    </section>\n\n'
        '    <section class="family-directory" id="correspondences" aria-labelledby="family-directory-title">\n'
        '      <h2 id="family-directory-title">Grouped by projected group</h2>\n'
        '      <p class="family-directory-note">One page per projected orbifold group: forget the clock and keep '
        'every spatial operation. The badge counts the forward clockwork groups projecting to that orbifold group, '
        '%d in all, and the small line names their Chaim orbifold signatures.</p>\n'
        '%s\n'
        '      <nav class="family-grid" aria-label="Projected orbifold groups">\n'
        '%s\n'
        '      </nav>\n'
        '    </section>\n\n'
        '    <section class="hasse-directory" id="hasse-diagram" aria-labelledby="hasse-diagram-title">\n'
        '      <h2 id="hasse-diagram-title">Hasse diagram</h2>\n'
        '      <p class="family-directory-note">The 68 forward clockwork groups grouped by generator inclusion on a '
        'shared translation lattice <code>T = ⟨t₁, t₂⟩</code>, marked exclusively in Conway/Chaim orbifold notation '
        '(with the concise generator tuple below each signature). Start with pure translations '
        '(<strong>◦</strong>, <code>⟨T⟩</code>) at the top and follow an edge downward to add a point-group or '
        'colour-permuting symmetry generator. Hover or focus any node to inspect its generators and see which '
        'symmetry generator is added on each step down; click a node to open its colouring, clockwork film, and '
        '3D crystal.</p>\n'
        '%s\n'
        '      <div class="hasse-legend">\n'
        '        <span><i class="hasse-dot hasse-dot--low" aria-hidden="true"></i>Fewer symmetries</span>\n'
        '        <span><i class="hasse-dot hasse-dot--high" aria-hidden="true"></i>More symmetries</span>\n'
        '        <span><i class="hasse-dot hasse-dot--rolling" aria-hidden="true"></i>Rolling-only symmetry (K ≠ Γ)</span>\n'
        '        <span><i class="hasse-dot hasse-dot--parent" aria-hidden="true"></i>↑ Subgroup above</span>\n'
        '        <span><i class="hasse-dot hasse-dot--child" aria-hidden="true"></i>↓ Supergroup below (+generator)</span>\n'
        '        <small class="hasse-scroll-hint">On a narrow screen, scroll the diagram sideways.</small>\n'
        '      </div>\n'
        '      <div class="hasse-diagram-wrap diagram" role="region" '
        'aria-label="Scrollable Hasse inclusion diagram of the 68 clockwork groups" tabindex="0">'
        '<svg id="graph" aria-label="Hasse diagram of 68 clockwork groups marked in Chaim orbifold notation"></svg>'
        '</div>\n'
        '      <div class="hasse-inspector" data-hasse-inspector aria-live="polite"></div>\n'
        '      <p id="status" class="hasse-status" role="status" aria-live="polite">Loading Hasse diagram…</p>\n'
        '      <details class="hasse-details"><summary>How the orbifold generator inclusions and still-frame selector work</summary>'
        '<p>All 68 groups are placed on the shared base translation lattice <code>T = ⟨t₁, t₂⟩</code> with origin '
        '<code>(0, 0)</code> so that every one of the <strong>123 immediate covering edges</strong> adds a single '
        'symmetry generator going downward: rotations <code>R₂</code> (180°), <code>R₃</code> (120°), '
        '<code>R₄</code> (90°), <code>R₆</code> (60°); mirrors <code>∗ₓ</code> (horizontal), <code>∗_d</code> '
        '(diagonal), <code>∗_d′</code> (anti-diagonal); glides <code>×ᵧ</code> (vertical) and <code>×ₓ′</code> '
        '(offset horizontal); or centred sublattice translations <code>t(0,½)</code>, <code>t(½,½)</code>, '
        '<code>t(⅔,⅓)</code>. A superscript <code>^(+1/N)</code> indicates that the generator also advances the '
        'cyclic colour/clock phase by <code>1/N</code> of a period.</p>'
        '<p>Among the 17 monochrome orbifold groups, fixing a single origin and unit lattice realises <strong>27</strong> '
        'direct generator inclusions simultaneously; the remaining 4 abstract same-lattice index-2 pairs '
        '(<code>22∗ ⊂ ∗2222</code>, <code>×× ⊂ 22×</code>, <code>4∗2 ⊂ ∗442</code>, and the second diagonal mirror '
        'into <code>∗333</code>) require shifting the origin by a quarter-period or rotating the mirror axis, '
        'because in a fixed coordinate group two distinct index-2 subgroups on the same lattice generate a unique '
        'order-4 supergroup (<code>⟨R₂, ∗ₓ⟩ = ∗2222</code> and <code>⟨R₄, ∗_d⟩ = ∗442</code>).</p>'
        '<p>In a single frozen frame (τ = 0), only the colour-fixing subgroup <i>K</i> = ker χ is visible; when the '
        'animation is rolling, forgetting the clock projects the group to the spatial orbifold group Γ. In '
        '<strong>45</strong> of the 68 groups (<i>K</i> ≇ Γ), the projected orbifold symmetry is absent from '
        'individual frames and only appears when the animation rolls — including <strong>8</strong> pure translation '
        'groups (<i>K</i> = ◦) whose frozen frames have no point or mirror symmetry at all. In another '
        '<strong>6</strong> centred groups, each frame still has a copy of Γ on a coarser sublattice, while the '
        'remaining <strong>17</strong> one-colour groups have their full symmetry in every frame.</p></details>\n'
        '    </section>\n\n'
        '    <section class="family-notes" aria-label="Diagram symbols and notation">\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s\n\n'
        '    %s' % (
            parts.h1,
            parts.note,
            total,
            filter_bar_html(include_hasse_mode=False),
            "\n".join(cards),
            filter_bar_html(include_hasse_mode=True),
            parts.teaser,
            parts.notation,
            parts.dialog,
            parts.tail,
        ))
    return head + body


def family_page(parts, index):
    family = parts.families[index]
    previous = parts.families[index - 1] if index > 0 else None
    following = parts.families[index + 1] if index + 1 < len(parts.families) else None
    title = "%s %s — Clockwork/colouring correspondence — Spacetime Groups" % (
        family.orbifold_text, family.hm)
    description = (
        "Wallpaper group %s (%s): %s over it, each with its cyclic colouring, "
        "clockwork film and polar space group (%s)." % (
            family.hm, family.orbifold_text, family.count_text, family.space_groups_text))
    # Only the family pages carry entries, so only they load the Visualizations
    # stylesheet and the clip player.
    head = head_for(parts, title, description).replace(
        "</head>", VISUALIZATIONS_ASSETS + "</head>", 1)
    pager = ['      <nav class="family-pager" aria-label="Neighbouring wallpaper groups">']
    if previous:
        pager.append('        <a class="family-pager-link family-pager-prev" href="%s" rel="prev">'
                     '<span aria-hidden="true">←</span> %s %s</a>' % (
                         previous.page, previous.orbifold_html, previous.hm))
    pager.append('        <a class="family-pager-link family-pager-index" href="correspondence.html">'
                 'All 17 wallpaper groups</a>')
    if following:
        pager.append('        <a class="family-pager-link family-pager-next" href="%s" rel="next">'
                     '%s %s <span aria-hidden="true">→</span></a>' % (
                         following.page, following.orbifold_html, following.hm))
    pager.append("      </nav>")
    h1 = ('<h1 id="page-title"><span class="family-orbifold">%s</span> '
          '<span class="family-hm">%s</span> '
          '<span class="family-count">%s</span></h1>' % (
              family.orbifold_html, family.hm, family.count_text))
    # The page opens on the entries.  The symbol key (with its visual index,
    # which the script moves to follow the teaser) and the notation note are
    # reference material and come after them.
    body = (
        '<main class="correspondence-page correspondence-family-page">\n'
        '    <section class="directory family-page-header" aria-labelledby="page-title">\n'
        '      <p class="family-breadcrumb"><a href="correspondence.html">Clockwork/colouring correspondence</a>'
        ' <span aria-hidden="true">·</span> wallpaper group %d of 17</p>\n'
        '      %s\n'
        '      <p class="family-summary">%s</p>\n'
        '%s\n'
        '    </section>\n\n'
        '    <div class="correspondence-atlas" id="correspondences">\n'
        '    <section class="wallpaper-family" id="wallpaper-%s" aria-labelledby="page-title" data-wallpaper-family>\n'
        '      %s\n'
        '    </section>\n'
        '    </div>\n\n'
        '    <section class="family-notes" aria-label="Diagram symbols and notation">\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s\n\n'
        '    %s' % (index + 1, h1, family.summary, "\n".join(pager), family.hm, family.tabs_html,
                    parts.teaser, parts.notation, parts.dialog, parts.tail))
    return head + body


def build():
    source = SOURCE.read_text(encoding="utf-8")
    current, _counts = correspondence_symbols.rewrite(source)
    if current != source:
        raise SystemExit("enumerate/correspondence-source.html has stale symbols; "
                         "run correspondence_symbols.py first")
    parts = Parts(source)
    pages = {INDEX: index_page(parts)}
    for index, family in enumerate(parts.families):
        pages[DOCS / family.page] = family_page(parts, index)
    return pages


def main(argv):
    pages = build()
    if "--check" in argv:
        stale = [path.name for path, text in pages.items()
                 if not path.exists() or path.read_text(encoding="utf-8") != text]
        if stale:
            print("out of date: " + ", ".join(stale))
            return 1
        print("up to date: %d pages" % len(pages))
        return 0
    for path, text in pages.items():
        path.write_text(text, encoding="utf-8")
    print("wrote %d pages (%s)" % (len(pages), ", ".join(path.name for path in pages)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
