#!/usr/bin/env python3
"""Insert the "Colour" nav group after "Catalogues" in every page of docs/.

Run from the repository root:

    python3 add-colour-nav.py docs            # rewrite in place
    python3 add-colour-nav.py docs --check    # exit 1 if any page is missing it

Idempotent: a page that already carries the group is left untouched.
The prefix (``, `../`, `../../`) is read off each page's own Catalogues links,
so pages at any depth get correct relative hrefs, and the two report pages,
whose Catalogues group is both shorter and written on one line, get the
one-line form of the new group with their own indentation.
"""
import re
import sys
from pathlib import Path

LINKS = [
    ("colour/", "Entangled colourings"),
    ("colour/gyre/", "Gyre"),
    ("colour/trefoil/", "Trefoil"),
]

# The Catalogues group: its anchors contain no nested elements, so the first
# `</span>` after the label's own `</span>` closes the group.
GROUP = re.compile(
    r'(?P<lead>[ \t]*)(?P<open><span class="navgroup">\s*'
    r'<span class="navgroup-label">Catalogues</span>)'
    r'(?P<body>(?:(?!</span>).)*?)'
    r'(?P<close></span>)',
    re.DOTALL,
)
PREFIX = re.compile(r'href="([^"]*?)(?:scott-gray-groups|correspondence)\.html"')


def build(prefix: str, multiline: bool, indent: str, here: str | None) -> str:
    def anchor(href: str, text: str) -> str:
        mark = ' class="here"' if here is not None and href == here else ""
        return f'<a href="{prefix}{href}"{mark}>{text}</a>'

    anchors = [anchor(href, text) for href, text in LINKS]
    if not multiline:
        return (
            '<span class="navgroup"><span class="navgroup-label">Colour</span>'
            + "".join(anchors)
            + "</span>"
        )
    inner = indent + "  "
    return (
        '<span class="navgroup">\n'
        + f'{inner}<span class="navgroup-label">Colour</span>\n'
        + "".join(f"{inner}{a}\n" for a in anchors)
        + f"{indent}</span>"
    )


def rewrite(text: str, here: str | None) -> tuple[str, bool]:
    if 'navgroup-label">Colour<' in text:
        return text, False
    match = GROUP.search(text)
    if not match:
        return text, False
    prefix_match = PREFIX.search(match.group("body"))
    if prefix_match is None:
        raise SystemExit("Catalogues group has no recognisable link to read a prefix from")
    prefix = prefix_match.group(1)
    multiline = "\n" in match.group("body")
    indent = match.group("lead")
    group = build(prefix, multiline, indent, here)
    end = match.end()
    separator = "\n" + indent if multiline or "\n" in text[match.start() - 1 : match.start()] else ""
    if not multiline:
        # The report pages put one group per line.
        separator = "\n" + indent
    return text[:end] + separator + group + text[end:], True


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "docs")
    check = "--check" in sys.argv
    pages = sorted(p for p in root.rglob("*.html") if '<header class="site">' in p.read_text())
    missing, changed = [], []
    for page in pages:
        text = page.read_text()
        # A colour page marks its own link as the current one.
        rel = page.relative_to(root).as_posix()
        here = {
            "colour/index.html": "colour/",
            "colour/gyre/index.html": "colour/gyre/",
            "colour/trefoil/index.html": "colour/trefoil/",
        }.get(rel)
        out, did = rewrite(text, here)
        if not did:
            if 'navgroup-label">Colour<' not in text:
                missing.append(rel)
            continue
        if check:
            missing.append(rel)
            continue
        page.write_text(out)
        changed.append(rel)
    if check:
        for name in missing:
            print("missing Colour nav:", name)
        print(f"{len(pages) - len(missing)}/{len(pages)} pages carry the Colour group")
        return 1 if missing else 0
    print(f"rewrote {len(changed)} of {len(pages)} pages")
    for name in missing:
        print("could not rewrite:", name)
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
