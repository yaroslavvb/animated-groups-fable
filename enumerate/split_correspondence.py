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
                                        group (thumbnail = that group's
                                        one-colour plate)
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

Order of operations after editing the source:
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


class Family:
    def __init__(self, section, links):
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
        self.tabs_html = add_vladimir_rows(
            cut(section, '<div class="clockwork-tabs"', "div"),
            [gid for gid, _order in self.entries], links)
        self.tabs = []
        for tab in re.finditer(
                r'<a class="clockwork-tab" id="tab-(g\d+)"[^>]*>(.*?)</a>', section, re.S):
            signature = re.search(r'<span class="tab-signature">(.*?)</span>', tab.group(2), re.S)
            meta = re.search(r'<span class="tab-meta">(.*?)</span>', tab.group(2), re.S)
            self.tabs.append((tab.group(1), signature.group(1), meta.group(1)))
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
        return " · ".join(meta for _gid, _sig, meta in self.tabs)

    @property
    def space_groups_text(self):
        return ", ".join(text_of(meta) for _gid, _sig, meta in self.tabs)


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
        atlas = cut(source, '<div class="correspondence-atlas"', "div")
        self.families = []
        i = 0
        while True:
            try:
                start, end = balanced(atlas, '<section class="wallpaper-family"', "section", i)
            except ValueError:
                break
            self.families.append(Family(atlas[start:end], self.links))
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


def index_page(parts):
    cards = []
    for family in parts.families:
        label = "%s, %s: %s (%s)" % (
            family.orbifold_text, family.hm, family.count_text, family.space_groups_text)
        # The same MathWorld wallpaper thumbnails as patterns.html.
        cards.append(
            '        <a class="family-card" href="%s" aria-label="%s">\n'
            '          <img src="img/mathworld/%s.webp" width="320" height="240" loading="lazy" decoding="async" alt="">\n'
            '          <span class="family-card-caption"><strong class="family-card-orbifold">%s</strong>'
            '<span class="family-card-hm">%s</span></span>\n'
            '          <span class="family-card-count" aria-hidden="true" title="%s">%d</span>\n'
            '          <span class="family-card-groups" aria-hidden="true">%s</span>\n'
            '        </a>' % (
                family.page, attr(label), family.hm, family.orbifold_html, family.hm,
                attr(family.count_text), family.count, family.space_groups_html))
    total = sum(family.count for family in parts.families)
    head = parts.head.replace("</head>", redirect_script(parts) + "</head>", 1)
    # The index opens on the wallpaper groups; the symbol key (with its visual
    # index, which the script keeps next to its teaser) and the notation note
    # follow them as reference material, as on the group pages.
    body = (
        '<main class="correspondence-page">\n'
        '    <section class="directory" aria-labelledby="page-title">\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    <section class="family-directory" id="correspondences" aria-labelledby="family-directory-title">\n'
        '      <h2 id="family-directory-title">The 17 wallpaper groups</h2>\n'
        '      <p class="family-directory-note">One page per wallpaper group, in the order of the '
        '<em>International Tables</em>. The badge counts the forward clockwork groups over the group, '
        '%d in all, and the small line names their polar space groups.</p>\n'
        '      <nav class="family-grid" aria-label="Wallpaper groups">\n'
        '%s\n'
        '      </nav>\n'
        '    </section>\n\n'
        '    <section class="family-notes" aria-label="Diagram symbols and notation">\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s\n\n'
        '    %s' % (parts.h1, parts.note, total, "\n".join(cards), parts.teaser, parts.notation,
                    parts.dialog, parts.tail))
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
    head = head_for(parts, title, description)
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
