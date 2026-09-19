#!/usr/bin/env python3
"""Bring every page's site header up to the shape of §A.9 of the design note.

Two changes, applied to all 88 pages under `docs/` that carry a site header:

1. **"Showcase" becomes the first link under Catalogues** — it is a catalogue,
   and it is the page a reader most wants to reach from anywhere.
2. **The "Colour" group is renamed "Colourings" and gains "Monochrome"** as a
   fourth link, because the group is no longer only about colour and
   "Colourings" is the word the subject already uses.
3. **Every page carries the "Superseded" group** — 86 of the 88 did, and the
   two report pages, written before it existed, stopped a reader there from
   reaching the superseded crystal catalogue at all.

Run from the repository root:

    python3 docs/monochrome/tools/add-nav.py docs            # rewrite in place
    python3 docs/monochrome/tools/add-nav.py docs --check    # exit 1 if stale
    python3 docs/monochrome/tools/add-nav.py docs --verify   # also resolve hrefs

A direct descendant of `docs/colour/tools/add-colour-nav.py`, which already
proved the approach across all 82 files of the previous round.  The per-page
prefix (``, `../`, `../../`) is read off that page's own Catalogues links, so
pages at any depth get correct relative hrefs; both header formats are handled
(67 pages write one group per line with nested indentation, the two report
pages write the whole header one group per line); and the script is idempotent,
so it is safe to re-run after the 19 monochrome/showcase pages land already
carrying the finished shape.
"""
import re
import sys
from pathlib import Path

SHOWCASE = ("showcase/", "Showcase")
COLOURINGS = [
    ("colour/", "Entangled colourings"),
    ("colour/gyre/", "Gyre"),
    ("colour/trefoil/", "Trefoil"),
    ("monochrome/", "Monochrome"),
]
# The fifth group. 86 of the 88 pages carry it; the two report pages were
# written before it existed and carried four groups where every other page
# carries five.
SUPERSEDED = [("crystals-colored.html", "269 coloured crystals")]

# A navgroup's anchors contain no nested elements, so the first `</span>` after
# the label's own closer ends the group.  Verified across all 88 pages.
def group_re(label: str) -> re.Pattern:
    return re.compile(
        r'(?P<lead>[ \t]*)(?P<open><span class="navgroup">\s*'
        r'<span class="navgroup-label">' + label + r'</span>)'
        r'(?P<body>(?:(?!</span>).)*?)'
        r'(?P<close></span>)',
        re.DOTALL,
    )


CATALOGUES = group_re("Catalogues")
COLOUR = group_re("Colour")
COLOURINGS_RE = group_re("Colourings")
PREFIX = re.compile(r'href="([^"]*?)(?:scott-gray-groups|correspondence)\.html"')
ANCHOR = re.compile(r'<a\b[^>]*href="([^"]*)"[^>]*>')

# A page marks its own link; site-header.js turns `class="here"` into
# `aria-current="page"`.  The Colourings group is rebuilt rather than appended
# to, so every page that already marks one of its links — the three colour
# pages did, from the previous round — has to be named here or the marking
# would be dropped on the rewrite.
HERE = {
    "showcase/index.html": "showcase/",
    "colour/index.html": "colour/",
    "colour/gyre/index.html": "colour/gyre/",
    "colour/trefoil/index.html": "colour/trefoil/",
    "monochrome/index.html": "monochrome/",
}


def here_for(rel: str) -> str | None:
    if re.fullmatch(r"monochrome/[^/]+/index\.html", rel):
        return "monochrome/"
    return HERE.get(rel)


def anchor(prefix: str, href: str, text: str, here: str | None) -> str:
    mark = ' class="here"' if here == href else ""
    return f'<a href="{prefix}{href}"{mark}>{text}</a>'


def add_showcase(text: str, here: str | None) -> tuple[str, bool]:
    """Insert the Showcase anchor as the first child of the Catalogues body."""
    match = CATALOGUES.search(text)
    if match is None:
        raise ValueError("no Catalogues group")
    body = match.group("body")
    if f'{SHOWCASE[0]}"' in body or f'{SHOWCASE[0]}" ' in body:
        return text, False
    prefix_match = PREFIX.search(body)
    if prefix_match is None:
        raise ValueError("Catalogues group has no recognisable link to read a prefix from")
    prefix = prefix_match.group(1)
    if f'href="{prefix}{SHOWCASE[0]}"' in body:
        return text, False
    link = anchor(prefix, SHOWCASE[0], SHOWCASE[1], here)
    indent = match.group("lead") + "  "
    inserted = (f"\n{indent}{link}" if "\n" in body else link) + body
    start, end = match.start("body"), match.end("body")
    return text[:start] + inserted + text[end:], True


def rename_colour(text: str, here: str | None) -> tuple[str, bool]:
    """Rename the Colour group to Colourings and append the Monochrome link."""
    match = COLOUR.search(text)
    if match is None:
        return text, False
    body = match.group("body")
    prefix_match = re.search(r'href="([^"]*?)colour/"', body)
    if prefix_match is None:
        raise ValueError("Colour group has no recognisable link to read a prefix from")
    prefix = prefix_match.group(1)
    if here is None:
        # Never silently drop a marking this page already carried.
        worn = re.search(r'<a href="' + re.escape(prefix) + r'([^"]*)" class="here">', body)
        here = worn.group(1) if worn else None
    multiline = "\n" in body
    indent = match.group("lead") + "  "
    anchors = [anchor(prefix, href, name, here) for href, name in COLOURINGS]
    if multiline:
        new_body = "\n" + "".join(f"{indent}{a}\n" for a in anchors) + match.group("lead")
    else:
        new_body = "".join(anchors)
    rebuilt = (
        match.group("open").replace(
            '<span class="navgroup-label">Colour</span>',
            '<span class="navgroup-label">Colourings</span>',
        )
        + new_body
        + match.group("close")
    )
    return text[: match.start("open")] + rebuilt + text[match.end("close") :], True


ANY_GROUP = re.compile(
    r'(?P<lead>[ \t]*)<span class="navgroup(?: [^"]*)?">\s*'
    r'<span class="navgroup-label">(?P<label>[^<]*)</span>'
    r'(?P<body>(?:(?!</span>).)*?)</span>',
    re.DOTALL,
)


def add_superseded(text: str) -> tuple[str, bool]:
    """Give a page the fifth group, after the last one it already has.

    Two of the 88 pages — the reports — were written with four groups, so a
    reader who reached one of them lost the way back to the superseded crystal
    catalogue that every other page offers.  The group is appended in whichever
    of the two header shapes the page is already written in, read off its own
    last group rather than assumed.
    """
    if 'navgroup-superseded' in text:
        return text, False
    groups = list(ANY_GROUP.finditer(text))
    if not groups:
        return text, False
    last = groups[-1]
    prefix_match = PREFIX.search(text)
    if prefix_match is None:
        raise ValueError("no link to read a prefix from")
    prefix = prefix_match.group(1)
    lead = last.group("lead")
    multiline = "\n" in last.group("body")
    anchors = [anchor(prefix, href, name, None) for href, name in SUPERSEDED]
    if multiline:
        inner = ("\n" + "".join(f"{lead}  {a}\n" for a in anchors) + lead)
    else:
        inner = "".join(anchors)
    block = (f'\n{lead}<span class="navgroup navgroup-superseded">'
             f'<span class="navgroup-label">Superseded</span>{inner}</span>')
    if multiline:
        block = (f'\n{lead}<span class="navgroup navgroup-superseded">\n'
                 f'{lead}  <span class="navgroup-label">Superseded</span>'
                 f'{inner}</span>')
    return text[: last.end()] + block + text[last.end():], True


def missing(text: str) -> list[str]:
    """What this page still lacks, in the words `--check` prints."""
    gaps = []
    cat = CATALOGUES.search(text)
    if cat is None:
        return ["no Catalogues group"]
    hrefs = ANCHOR.findall(cat.group("body"))
    if not hrefs or not hrefs[0].endswith(SHOWCASE[0]):
        gaps.append("Showcase is not the first Catalogues link")
    col = COLOURINGS_RE.search(text)
    if col is None:
        gaps.append('the Colour group is not renamed "Colourings"')
    else:
        names = ANCHOR.findall(col.group("body"))
        if len(names) != len(COLOURINGS) or not any(h.endswith("monochrome/") for h in names):
            gaps.append("the Colourings group does not hold all four links")
    if COLOUR.search(text):
        gaps.append('an old "Colour" group is still present')
    if "navgroup-superseded" not in text:
        gaps.append("no Superseded group")
    if text.count('class="here"') > 1:
        gaps.append(f'{text.count(chr(34) + "here" + chr(34))} links marked "here"')
    return gaps


def unresolved(page: Path, root: Path, text: str) -> list[str]:
    """Every nav href that does not name a file or directory on disk."""
    nav = re.search(r"<nav\b.*?</nav>", text, re.DOTALL)
    if nav is None:
        return ["no <nav>"]
    bad = []
    for href in ANCHOR.findall(nav.group(0)):
        if href.startswith(("http:", "https:", "#", "mailto:")):
            continue
        target = (page.parent / href.split("#")[0]).resolve()
        if target.is_dir():
            target = target / "index.html"
        if not target.exists():
            bad.append(href)
    return bad


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = Path(args[0] if args else "docs")
    check = "--check" in sys.argv
    verify = "--verify" in sys.argv

    pages = sorted(p for p in root.rglob("*.html") if '<header class="site">' in p.read_text())
    stale, changed, broken = [], [], []
    for page in pages:
        text = page.read_text()
        rel = page.relative_to(root).as_posix()
        here = here_for(rel)
        out = text
        try:
            out, did_showcase = add_showcase(out, here)
            out, did_colour = rename_colour(out, here)
            out, did_superseded = add_superseded(out)
        except ValueError as exc:
            stale.append((rel, [str(exc)]))
            continue
        gaps = missing(out)
        if gaps:
            stale.append((rel, gaps))
            continue
        if out != text:
            if check:
                stale.append((rel, missing(text) or ["formatting differs from a fresh stamp"]))
                continue
            page.write_text(out)
            changed.append(rel)
        if verify:
            bad = unresolved(page, root, out)
            if bad:
                broken.append((rel, bad))

    for rel, gaps in stale:
        print(f"{rel}: {'; '.join(gaps)}")
    for rel, bad in broken:
        print(f"{rel}: nav hrefs do not resolve: {', '.join(bad)}")

    if check:
        print(f"{len(pages) - len(stale)}/{len(pages)} pages carry the finished nav")
    else:
        print(f"rewrote {len(changed)} of {len(pages)} pages; "
              f"{len(pages) - len(changed) - len(stale)} already current")
    return 1 if stale or broken else 0


if __name__ == "__main__":
    raise SystemExit(main())
