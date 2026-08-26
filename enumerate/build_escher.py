"""Assemble docs/data/escher.json: M.C. Escher's regular divisions of the
plane, filed by wallpaper group and colour group.

Sources, and what each actually supplies:

  * the gallery index at mcescher.com/gallery/symmetry/ — the list of works
    and their image URLs (metadata only; no artwork is copied into the site,
    and the page links out to the official gallery);
  * EscherMath (Saint Louis University) — the only freely reachable source
    with per-drawing WALLPAPER groups: 37 of the 137 drawings, computed
    ignoring colour;
  * David Bailey's essays on the 137 periodic drawings (read via the Internet
    Archive; the live domain is no longer his) — motif, year and colour count;
  * a handful of published COLOUR-group determinations (MacGillavry via
    Schattschneider, Plachinda, Schattschneider's Bridges 2008 paper).

The colour axis is deliberately sparse.  The complete classification —
including colour groups — is Schattschneider, *Visions of Symmetry*,
Concordance Tables 1-3, pp. 328-334, which is not freely readable; nothing
here is guessed to fill that gap.  A drawing whose colour group is not
stated by a source is emitted with colour_group = null and lands in the
"colour group open" bucket of the page.

Run:  python3 build_escher.py
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")
SCRATCH = ("/private/tmp/claude-501/-Users-yaroslavvb-Library-CloudStorage-"
           "Dropbox-git0-animated-groups-fable/"
           "0de62653-6135-48b8-b02c-542eaff9effe/scratchpad")

GALLERY = "https://mcescher.com/gallery/symmetry/"

# Colour groups that a source states explicitly as a pair (Gamma, H) or as a
# symbol that determines one.  Each maps onto a catalogue-D class id; the
# mapping is unique for every case below (checked against docs/data/
# colored.json: pgg k=2 has one class with H of type pg, p6 k=3 one with
# H = 2222, p6 k=2 one with H = 333).
COLOUR_GROUPS = {
    124: {
        "hm": "pgg",
        "colour_group": "c2-pgg-2",
        "stated": "p2′g′g (Shubnikov black–white symbol): "
                  "colour-blind group pgg, colour-preserving subgroup pg of index 2",
        "source": "MacGillavry's symbol as reproduced in the crystallographic "
                  "literature on Escher's drawing 124",
        "confidence": "medium",
    },
    25: {
        "hm": "p6",
        "colour_group": "c3-p6-1",
        "stated": "Belov pair p6|p2: colour-blind group p6, colour-preserving "
                  "subgroup p2 of index 3",
        "source": "P. Plachinda, on the colour symmetry of drawing 25 (Reptiles)",
        "confidence": "medium",
    },
    55: {
        "hm": "p6",
        "colour_group": "c3-p6-1",
        "stated": "632 with colour-preserving kernel 2222 (p6 > p2, index 3)",
        "source": "A. P. Goucher, “Analysing Escher”",
        "confidence": "low",
    },
    57: {
        "hm": "p6",
        "colour_group": "c2-p6-1",
        "stated": "colour-blind p6, colour-preserving subgroup p3 of index 2: "
                  "60° and 180° rotations interchange the two colours, "
                  "120° rotations and translations preserve them",
        "source": "Schattschneider, Bridges 2008",
        "confidence": "medium",
    },
    45: {
        "hm": "p4g",
        "colour_group": "c1-p4g-1",
        "stated": "a two-motif “Heaven and Hell” tiling in which each motif "
                  "carries one colour, so every symmetry preserves colour: the "
                  "colour group is trivial, H = Γ = p4g",
        "source": "Schattschneider, Bridges 2008",
        "confidence": "medium",
    },
}

# Colour behaviour described in words by a source, with no symbol given and
# not enough stated to pin the class without inference.  Shown as a note on
# the card; the drawing still sits in the "colour group open" bucket.
COLOUR_NOTES = {
    18: "Every symmetry preserves colour (a two-motif tiling with translation "
        "symmetry only) — Schattschneider, Bridges 2008.",
    34: "Perfectly coloured counterchange: all glide reflections interchange "
        "the colours, all translations preserve them — Schattschneider, "
        "Bridges 2008.",
    41: "Half-turns and horizontal glide reflections interchange the colours; "
        "vertical glide reflections and translations preserve them "
        "— Schattschneider, Bridges 2008.",
    58: "Half-turns and horizontal glide reflections interchange the colours; "
        "vertical glide reflections and translations preserve them "
        "— Schattschneider, Bridges 2008.",
    125: "Interpretation-dependent: as congruent tiles a plain counterchange, "
         "but with the interior detail a perfectly coloured two-motif tiling "
         "— Schattschneider, Bridges 2008.",
    126: "Perfectly coloured counterchange: some vertical glide reflections "
         "interchange the colours and others preserve them; horizontal "
         "translations interchange, vertical translations preserve "
         "— Schattschneider, Bridges 2008.",
    130: "The same colour symmetries as drawing 126 — Schattschneider, "
         "Bridges 2008.",
}

ESCHERMATH = "EscherMath (Saint Louis University)"
BAILEY = "David Bailey, essays on the 137 periodic drawings (Internet Archive)"


def short_sources(srcs):
    """Compress the long source strings of the research pass to short credits."""
    out = []
    for s in srcs or []:
        if "EscherMath" in s:
            out.append(ESCHERMATH)
        elif "Bailey" in s:
            out.append("Bailey")
        elif "mcescher" in s.lower() or "Escher Foundation" in s:
            out.append("mcescher.com")
        elif "MacGillavry" in s:
            out.append("MacGillavry")
        elif "Paleis" in s:
            out.append("Escher in Het Paleis")
    seen, res = set(), []
    for s in out:
        if s not in seen:
            seen.add(s)
            res.append(s)
    return res


def main():
    with open(os.path.join(SCRATCH, "escher-gallery.json")) as f:
        gallery = json.load(f)
    with open(os.path.join(SCRATCH, "escher-symmetry.json")) as f:
        symmetry = {r["n"]: r for r in json.load(f)}

    drawings = []
    seen_n = set()
    for item in gallery:
        n = item.get("n")
        # the gallery bundles a few works into one image and repeats no. 34;
        # key the catalogue on the work, not the file
        if n is not None and n in seen_n:
            continue
        if n is not None:
            seen_n.add(n)
        sym = symmetry.get(n, {}) if n is not None else {}
        cg = COLOUR_GROUPS.get(n)
        # A colour-group citation names the colour-blind group Gamma, which is
        # the wallpaper group; use it where EscherMath has no entry, and check
        # it where both speak.
        hm, hm_source, hm_check = sym.get("hm"), None, None
        if hm:
            hm_source = ESCHERMATH
        if cg and cg.get("hm"):
            if hm and hm != cg["hm"]:
                hm_check = ("sources disagree: %s gives %s, the colour-group "
                            "citation gives %s" % (ESCHERMATH, hm, cg["hm"]))
            elif hm:
                hm_check = "confirmed independently by the colour-group citation"
            else:
                hm, hm_source = cg["hm"], "the colour-group citation (its colour-blind group)"
        rec = {
            "n": n,
            "title": (sym.get("motif") or "").strip() or None,
            "year": sym.get("year"),
            "colours": sym.get("colours"),
            "hm": hm,
            "hm_source": hm_source,
            "hm_check": hm_check,
            "colour_group": cg["colour_group"] if cg else None,
            "colour_group_note": (cg["stated"] if cg
                                  else COLOUR_NOTES.get(n)),
            "confidence": (cg["confidence"] if cg
                           else ("high" if sym.get("hm") else "low")),
            "page_url": GALLERY,
            "image_url": item.get("image_url"),
            "sources": ([cg["source"]] if cg else []) + short_sources(sym.get("sources")),
        }
        if sym.get("conflict"):
            rec["conflict"] = sym["conflict"]
        drawings.append(rec)

    drawings.sort(key=lambda d: (d["n"] is None, d["n"] or 0))

    n_hm = sum(1 for d in drawings if d["hm"])
    n_cg = sum(1 for d in drawings if d["colour_group"])
    by_hm = {}
    for d in drawings:
        if d["hm"]:
            by_hm[d["hm"]] = by_hm.get(d["hm"], 0) + 1

    coverage = (
        "Coverage is the honest limit of this page. Of the %d works listed in "
        "the gallery, %d have a wallpaper group in a freely readable source "
        "(EscherMath's, computed ignoring colour), and only %d have a colour "
        "group stated anywhere I could reach. The complete classification, "
        "colour groups included, is Schattschneider's Concordance in "
        "Visions of Symmetry, Tables 1–3, pp. 328–334, which is not "
        "freely readable; nothing here is guessed to fill that gap, so the "
        "remaining drawings sit in the “not documented” buckets rather "
        "than under an invented group."
        % (len(drawings), n_hm, n_cg))

    meta = {
        "title": "Escher",
        "count": len(drawings),
        "with_wallpaper_group": n_hm,
        "with_colour_group": n_cg,
        "by_wallpaper_group": by_hm,
        "coverage_note": coverage,
        "rights": "Escher's works are in copyright. The M.C. Escher Company "
                  "B.V. reserves all rights and requires written permission "
                  "for reproduction; no artwork is reproduced on this page — "
                  "every entry links to the official gallery instead.",
        "sources": [
            "mcescher.com/gallery/symmetry/ — the list of works",
            ESCHERMATH + " — wallpaper groups (37 drawings)",
            BAILEY + " — motif, year, colour count",
            "Schattschneider, Bridges 2008 — verbal colour symmetries",
            "Schattschneider, Visions of Symmetry (1990), Concordance "
            "Tables 1–3, pp. 328–334 — the complete table, not "
            "consulted (not freely readable)",
        ],
    }

    path = os.path.join(DOCS, "data", "escher.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "drawings": drawings}, f,
                  ensure_ascii=False, indent=1)
    print("wrote %s" % path)
    print("  works: %d | with wallpaper group: %d | with colour group: %d"
          % (len(drawings), n_hm, n_cg))
    print("  by group:", dict(sorted(by_hm.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
