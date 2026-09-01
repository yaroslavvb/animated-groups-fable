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

Order of operations after editing the source:
    python3 correspondence_symbols.py       redraw the symbols in the source
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


class Family:
    def __init__(self, section):
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
        self.tabs_html = cut(section, '<div class="clockwork-tabs"', "div")
        self.entries = re.findall(
            r'<section class="correspondence-entry" id="(g\d+)"[^>]*data-clock-order="(\d+)"',
            section)
        self.tabs = []
        for tab in re.finditer(
                r'<a class="clockwork-tab" id="tab-(g\d+)"[^>]*>(.*?)</a>', section, re.S):
            signature = re.search(r'<span class="tab-signature">(.*?)</span>', tab.group(2), re.S)
            meta = re.search(r'<span class="tab-meta">(.*?)</span>', tab.group(2), re.S)
            self.tabs.append((tab.group(1), signature.group(1), meta.group(1)))
        if len(self.tabs) != len(self.entries):
            raise ValueError("%s: %d tabs for %d entries" % (self.hm, len(self.tabs), len(self.entries)))
        # The thumbnail is the one-colour plate: the plain wallpaper pattern.
        plain = [gid for gid, order in self.entries if order == "1"] or [self.entries[0][0]]
        entry = cut(section, '<section class="correspondence-entry" id="%s"' % plain[0], "section")
        self.thumb = re.search(r'<img src="(output/clockwork-colorings/[^"]+)"', entry).group(1)

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
        atlas = cut(source, '<div class="correspondence-atlas"', "div")
        self.families = []
        i = 0
        while True:
            try:
                start, end = balanced(atlas, '<section class="wallpaper-family"', "section", i)
            except ValueError:
                break
            self.families.append(Family(atlas[start:end]))
            i = end
        if len(self.families) != 17:
            raise ValueError("expected 17 wallpaper families, found %d" % len(self.families))
        self.tail = source[source.index('<section class="provenance"'):]
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
        cards.append(
            '        <a class="family-card" href="%s" aria-label="%s">\n'
            '          <img src="%s" width="720" height="420" loading="lazy" decoding="async" alt="">\n'
            '          <span class="family-card-caption"><strong class="family-card-orbifold">%s</strong>'
            '<span class="family-card-hm">%s</span></span>\n'
            '          <span class="family-card-count" aria-hidden="true" title="%s">%d</span>\n'
            '          <span class="family-card-groups" aria-hidden="true">%s</span>\n'
            '        </a>' % (
                family.page, attr(label), family.thumb, family.orbifold_html, family.hm,
                attr(family.count_text), family.count, family.space_groups_html))
    total = sum(family.count for family in parts.families)
    head = parts.head.replace("</head>", redirect_script(parts) + "</head>", 1)
    body = (
        '<main class="correspondence-page">\n'
        '    <section class="directory" aria-labelledby="page-title">\n'
        '      %s\n'
        '      %s\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s\n\n'
        '    <section class="family-directory" id="correspondences" aria-labelledby="family-directory-title">\n'
        '      <h2 id="family-directory-title">The 17 wallpaper groups</h2>\n'
        '      <p class="family-directory-note">One page per wallpaper group, in the order of the '
        '<em>International Tables</em>. Each card shows the group\'s own pattern; the badge counts the '
        'forward clockwork groups over it, %d in all, and the small line names their polar space groups.</p>\n'
        '      <nav class="family-grid" aria-label="Wallpaper groups">\n'
        '%s\n'
        '      </nav>\n'
        '    </section>\n\n'
        '    %s' % (parts.h1, parts.note, parts.teaser, parts.notation, parts.dialog, total,
                    "\n".join(cards), parts.tail))
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
    body = (
        '<main class="correspondence-page correspondence-family-page">\n'
        '    <section class="directory family-page-header" aria-labelledby="page-title">\n'
        '      <p class="family-breadcrumb"><a href="correspondence.html">Clockwork/colouring correspondence</a>'
        ' <span aria-hidden="true">·</span> wallpaper group %d of 17</p>\n'
        '      %s\n'
        '      <p class="family-summary">%s</p>\n'
        '%s\n'
        '      %s\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s\n\n'
        '    <div class="correspondence-atlas" id="correspondences">\n'
        '    <section class="wallpaper-family" id="wallpaper-%s" aria-labelledby="page-title" data-wallpaper-family>\n'
        '      %s\n'
        '    </section>\n'
        '    </div>\n\n'
        '    <section class="family-notes" aria-label="Notation">\n'
        '      %s\n'
        '    </section>\n\n'
        '    %s' % (index + 1, h1, family.summary, "\n".join(pager), parts.note, parts.teaser,
                    parts.dialog, family.hm, family.tabs_html, parts.notation, parts.tail))
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
