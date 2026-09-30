#!/usr/bin/env python3
"""The "Visualizations" section of every correspondence entry.

Each of the 68 correspondence entries names a forward clockwork group, and
nearly everything else on this site is a picture of one: the reaction-diffusion
catalogue draws its orbits in ember, the black-and-white explorer draws the
two-colour pictures they carry, the colour explorers draw the three-colour
ones, the designer builds billiards inside it, the pattern catalogue draws the
colouring with its generators, and the Showcase plays all of it as short loops.
Without this section an entry said none of that.  This module writes, for every entry, a
section that comes after "Extra links" and holds

    up to four Showcase clips of this very group (poster now, video while it
    is on screen — docs/js/correspondence-visualizations.js), with a line to
    the family's section of the Showcase, and

    a card per explorer, viewer or tool that has something to show for this
    group, each with a true count or a short true description.

Everything here is derived from the shipped data, never hand-listed, so a new
orbit or a new rendering changes the counts on the next regeneration.

The clips
---------
docs/showcase/data/showcase.json is the Showcase's own manifest: one row per
carded loop, with its kind (``ember`` a field in ember, ``colour`` three
colours, ``mono`` black and white), its group, its poster and preview files,
its href into the explorer that made it, whether it is ``featured``, which
look-alike cluster it belongs to (``look``/``alike``), and, for a folded
card, the row it hides behind (``alikeOf``).

Four cards have to stand for a group that may own four hundred rows, so the
choice is the one the Showcase itself would defend: featured first, then the
cards the Showcase shows by default, then the folded ones; inside each pool
the kinds take turns (colour, black and white, field) and each kind offers its
coolest first — highest score in its own atlas, then the biggest look-alike
cluster, then the most siblings, then manifest order.  A card is skipped when
its poster, its look-alike cluster, or (for the wave kinds) its (kind, group,
equation, name) wave is already taken, so the four are four different
pictures and not one picture four times; on the first pass a card is also
skipped when its field or its unfeatured (kind, name) is taken, and the pass
is repeated without those two guards only if fewer than four have been found.
When a group's visible rows span two kinds or more, no kind may take more than
three of the four, so a group with both wave pictures and colour pictures
always shows both.  The rule was settled by looking at contact sheets of the
chosen posters for all 68 groups (that is how the wave and name guards were
found); 66 groups get four cards, g233 three and g138 two, because that is
all the distinct pictures they have.

A row's ``href`` is relative to docs/showcase/, so the leading ``../`` comes
off to make it relative to docs/ — it opens the explorer with that exact
picture selected.  A row whose name was generated (``<Equation> <slug> on
gNNN``) shows its equation instead, since the slug means nothing to a reader.

Two of an entry's four cards are often one wave read two ways, and then their
(title, meta) come out word for word the same — "Standing wave / Gray–Scott"
under both the black-and-white reading and the field it reads.  The badge
already separates them, so the badge word is appended to the caption of every
card in such a tie; a tie inside one kind, where the badge would only repeat,
takes the reading instead.  No entry has two cards with the same caption.

The links
---------
Every card is only written when it has something behind it:

``scott-gray/<hm>/#gNNN``          the reaction-diffusion explorer, all 68.
    The count is the number of orbits in docs/scott-gray/data/wallpaper-atlas.json
    filed under the group — the same number the explorer's own group chip
    prints.  The p4 page is ``scott-gray/`` itself; there is no scott-gray/p4/.

``monochrome/<hm>/#gNNN``          the black-and-white explorer, all 68.
    The count is the number of distinct *fields* the explorer offers for the
    group on that family's page, i.e. the fields of docs/monochrome/data/
    monochrome-atlas.json whose record lists the family and the group —
    exactly the "all" pass of monochrome/mono-app.mjs groupFields().  The hash
    carries the group and nothing else; adding ``tier=`` would cut the list.

``colour/gyre/#gNNN``              the three-colour gyre explorer, 20 groups.
``colour/trefoil/#gNNN?v=1&sub=all`` the trefoil explorer, 4 groups.
    The count is the number of docs/colour/data/colour-atlas.json entries of
    that kind whose source names the group.  ``sub=all`` opens the trefoil
    page with its pairs chip off, so the page shows exactly that many.

the standalone full-screen viewers
    Eight pages under docs/scott-gray/ draw one saved field with no controls.
    A viewer claims the groups of the catalogued orbit its field.f32 bytes
    are.  Six of the eight fields are orbits of docs/scott-gray/data/
    wallpaper-atlas.json (g225/g247 for the three p6 viewers, g6/g96 for the
    two Plume pages, g11/g96 for Weave Monochrome); Crosslet's field is the
    colour atlas entry ``colour:gyre:a767fbcc68c0``, whose group is g225; and
    Ember's field is the first frame of the g134 Ginzburg–Landau orbit
    ``equation:ginzburg-landau:g134:3ba87ed68bc2e4d1``, which the page then
    turns analytically rather than replaying saved frames.

    Plume Monochrome claims one group more, because it draws a *reading* of
    its field rather than the field: the sign of U(x, t) − U(−x, t), which on
    this orbit is bit-for-bit the monochrome atlas's half-period reading
    ``mono:half-period:731aa45654d4:T2`` (its README proves the two rules
    coincide here), and that reading's ``picGroup`` is g139 — the group of the
    black-and-white picture itself, not of the wave.  Weave Monochrome draws a
    reading too (``mono:half-period:459f00246aed:T2``), but its ``picGroup``
    is null, so it claims only its field's groups.

    The table below records the sha256 of every viewer's field and the module
    refuses to build if one has changed — a re-cut viewer must not keep a
    stale group claim.

``designer.html#<hash>``           the 3D spacetime designer, 51 groups.
    docs/data/designer-links.json, written by enumerate/designer_links.mjs
    with the designer's own encoder: an empty box in this group with one ring
    and one seed.  The 17 product/trivial-clock groups are not in its menu.

``patterns.html#group-<id>``       the pattern catalogue, all 68.
    The catalogue group whose ``hm`` is this entry's plane group and whose
    ``chaim_type`` is this entry's ``tos_notation``, restricted to the normal
    cyclic colourings of the entry's clock order — exactly one per entry (p4
    has two catalogue groups with signature ³4³4³2, and only one of them is
    cyclic).  Four pairs of entries are the two time directions of one
    colouring and share a target.

``scott-gray/lab.html#gNNN`` /
``scott-gray/p6/lab.html#gNNN``    the search laboratories.
    Only for the groups listed in docs/scott-gray/groups.json and
    docs/scott-gray/p6/groups.json, the two families whose solver ships.

Usage:
    python3 enumerate/correspondence_visualizations.py --json
        the per-group clips and links, for verifiers.

split_correspondence.py imports ``load()`` and ``section_html()`` and puts the
section into every entry as it writes the 17 family pages.
"""

import collections
import hashlib
import html as html_lib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

CAP = 4
KIND_ORDER = ("colour", "mono", "ember")
WAVE_KINDS = ("ember", "mono")
BADGE = {"ember": "field", "colour": "three-colour", "mono": "black & white"}
#: the Showcase names its auto-generated cards "<Equation> <slug> on gNNN"
GENERATED_NAME = re.compile(r"^(.+) [a-z]+-[a-z0-9]+ on g\d+$")
#: …and tells two readings of one colouring apart by a field hash, which is
#: for the Showcase's grid and means nothing under a single card, whether it
#: trails a reading ("Half period · field 0dee43b6") or is the whole of one
FIELD_SUFFIX = re.compile(r"(?: · )?field [0-9a-f]+$")

#: (directory under docs/, viewer name, one-line true description, sha256 of
#:  its field.f32, the groups it claims — the groups of the catalogued orbit
#:  those bytes are, plus for Plume Monochrome the picGroup of the reading it
#:  draws; see the module docstring for where each one comes from)
VIEWERS = (
    # Crosslet's field is the colour atlas entry colour:gyre:a767fbcc68c0
    # (g225); the description is the page's own title.
    ("scott-gray/crosslet/", "Crosslet", "plus-shaped pieces, turned and recoloured",
     "a767fbcc68c06cba12987745386ff07a2980e94406ecde19db5de7f5a6784db1", ("g225",)),
    ("scott-gray/gyre/", "Gyre", "three colours, turn and wait",
     "8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c", ("g225", "g247")),
    ("scott-gray/triskele/", "Triskele", "three colours, the turn alone",
     "8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c", ("g225", "g247")),
    ("scott-gray/trefoil/", "Trefoil", "S₃ colours, half entangled",
     "8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c", ("g225", "g247")),
    ("scott-gray/plume/", "Plume", "the rotating wave, endless",
     "731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483", ("g6", "g96")),
    # g6/g96 are the groups of the field (Plume's orbit); g139 is the picGroup
    # of the half-period reading this page draws, so its target text differs
    # there — see VIEWER_TARGET.
    ("scott-gray/plume-monochrome/", "Plume Monochrome", "the same wave in black and white",
     "731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483", ("g6", "g96", "g139")),
    ("scott-gray/weave-monochrome/", "Weave Monochrome", "the woven twill",
     "459f00246aed541414bbe7d3d092ca2e66e4b3e417ccb5d3d8efaa37abbe78d7", ("g11", "g96")),
    # Ember's field is the first frame of equation:ginzburg-landau:g134:
    # 3ba87ed68bc2e4d1; the page turns it analytically instead of replaying.
    ("scott-gray/ember/", "Ember", "the spiral lattice, turned analytically",
     "30bfb1de97a806f743ff77061a7bd11844d289ac8853c2f3de12be70b13d77ce", ("g134",)),
)

#: where a viewer's card needs different words on a particular entry, because
#: the group it is filed under there is the group of something else.  Plume
#: Monochrome is filed under g6/g96 for its field and under g139 for the
#: black-and-white picture it draws, and the card must say which.
VIEWER_TARGET = {
    ("Plume Monochrome", "g139"): "its black-and-white picture has this group",
}

#: which viewer leads on which entry: the group's own reading first.  g225 is
#: the group of every one of those coloured pictures, g247 the film group of
#: the field the three p6 viewers share (Triskele is the plainest of them);
#: g6/g96 own the Plume field and g139 only the black-and-white picture.
VIEWER_ORDER = {
    "g225": ("Crosslet", "Gyre", "Triskele", "Trefoil"),
    "g247": ("Triskele", "Gyre", "Trefoil"),
    "g6": ("Plume", "Plume Monochrome"),
    "g96": ("Plume", "Plume Monochrome", "Weave Monochrome"),
    "g139": ("Plume Monochrome",),
    "g11": ("Weave Monochrome",),
    "g134": ("Ember",),
}


def attr(value):
    return html_lib.escape(value, quote=True)


def _read_json(relative):
    """One of the shipped manifests, or a SystemExit that names it.

    Every count on the page is read out of one of these files, so a missing or
    half-written manifest must stop the build with the file's name rather than
    fall over inside json."""
    path = DOCS / relative
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except (IOError, OSError) as error:
        raise SystemExit("cannot read docs/%s: %s%s" % (
            relative, error.strerror or error, _written_by(relative)))
    except ValueError as error:      # json.JSONDecodeError on 3.5+
        raise SystemExit("docs/%s is not readable JSON: %s%s" % (
            relative, error, _written_by(relative)))


#: the generator to re-run when one of these manifests is missing or broken;
#: the atlases and the correspondence snapshot are shipped data with no
#: generator in this repository, so they are not listed
WRITTEN_BY = {
    "data/designer-links.json": "node enumerate/designer_links.mjs",
    "data/patterns.json": "python3 enumerate/enumerate_patterns_k.py",
    "showcase/data/showcase.json": "python3 docs/showcase/tools/make-manifest.py",
}


def _written_by(relative):
    script = WRITTEN_BY.get(relative)
    return "\n  it is written by %s" % script if script else ""


# ---------------------------------------------------------------- the clips --


#: the atlas each Showcase kind is scored and fielded from
ATLAS_OF = {
    "mono": "monochrome/data/monochrome-atlas.json",
    "colour": "colour/data/colour-atlas.json",
    "ember": "scott-gray/data/wallpaper-atlas.json",
}


def _showcase_pools(rows, entries, orbits, colour_entries):
    """Score and field of every carded row, by row id.

    Only the rows that carry a group can ever be one of an entry's clips; the
    Showcase's ``viewer`` rows have no ``groupId`` and no atlas record, and are
    skipped here as they are skipped in the selection.  For the rest, an atlas
    record that has gone, or a kind this module has never heard of, would
    silently unrank the row and quietly change which four clips an entry
    shows; both stop the build instead."""
    index = {row["id"]: position for position, row in enumerate(rows)}
    field = {}
    score = {}
    for row in rows:
        if not row["groupId"]:
            continue
        rid = row["id"].split("@")[0]
        if row["kind"] not in ATLAS_OF:
            raise SystemExit(
                "showcase row %s has kind %r, which enumerate/"
                "correspondence_visualizations.py\ndoes not know how to score; "
                "add it to KIND_ORDER, BADGE and ATLAS_OF." % (
                    row["id"], row["kind"]))
        if row["kind"] == "mono":
            record = entries.get(rid)
            if record is None:
                raise SystemExit(_no_record(row, rid))
            field[row["id"]] = record["field"]
            score[row["id"]] = (record.get("metrics") or {}).get("score")
        elif row["kind"] == "colour":
            record = colour_entries.get(row["id"])
            if record is None:
                raise SystemExit(_no_record(row, row["id"]))
            field[row["id"]] = record["source"]["fieldSha256"][:12]
            score[row["id"]] = (record.get("metrics") or {}).get("score")
        elif row["kind"] == "ember":
            record = orbits.get(row["id"])
            if record is None:
                raise SystemExit(_no_record(row, row["id"]))
            field[row["id"]] = record["fieldSha256"][:12]
            diagnostics = record["diagnostics"]
            spread = diagnostics["maximum"] - diagnostics["minimum"]
            score[row["id"]] = (min(diagnostics["spatialRms"], diagnostics["temporalRms"]) / spread
                                if spread > 0 else None)
    return index, field, score


def _no_record(row, rid):
    return ("showcase row %s (kind %s) has no record %s in docs/%s\n"
            "The Showcase manifest and that atlas are out of step: rebuild both "
            "(python3 docs/showcase/tools/make-manifest.py) before this section."
            % (row["id"], row["kind"], rid, ATLAS_OF[row["kind"]]))


def _cool(row, index, score):
    """Sort key: the coolest picture of its kind first.

    A missing score sorts last (the atlases score every entry that has one; a
    row without is not evidence of coolness either way)."""
    value = score.get(row["id"])
    return (-(value if value is not None else -9e9),
            -(row.get("alike") or 0),
            -len(row.get("siblings") or []),
            index[row["id"]])


def _round_robin(pool, index, score):
    """The kinds take turns, each offering its coolest first."""
    ranked = dict((kind, sorted([row for row in pool if row["kind"] == kind],
                                key=lambda row: _cool(row, index, score)))
                  for kind in KIND_ORDER)
    ordered = []
    depth = 0
    while True:
        step = [ranked[kind][depth] for kind in KIND_ORDER if len(ranked[kind]) > depth]
        if not step:
            return ordered
        ordered.extend(step)
        depth += 1


def _select(rows_of_group, index, field, score):
    """Up to CAP different pictures of one group, in the order described above."""
    visible = [row for row in rows_of_group if not row.get("alikeOf")]
    featured_pool = _round_robin([row for row in visible if row["featured"]], index, score)
    visible_pool = _round_robin([row for row in visible if not row["featured"]], index, score)
    folded_pool = _round_robin([row for row in rows_of_group if row.get("alikeOf")], index, score)
    per_kind_cap = CAP - 1 if len(set(row["kind"] for row in visible)) >= 2 else CAP

    chosen = []
    posters = set()
    looks = set()
    fields = set()
    waves = set()
    names = set()
    per_kind = collections.Counter()

    def wave_of(row):
        return (row["kind"], row["groupId"], row["equation"], row["name"])

    def take(pool, strict):
        for row in pool:
            if len(chosen) >= CAP:
                return
            if row["poster"] in posters:
                continue
            if row.get("look") and row["look"] in looks:
                continue
            if per_kind[row["kind"]] >= per_kind_cap:
                continue
            if row["kind"] in WAVE_KINDS and wave_of(row) in waves:
                continue
            if strict and field.get(row["id"]) in fields:
                continue
            if strict and not row["featured"] and (row["kind"], row["name"]) in names:
                continue
            chosen.append(row)
            posters.add(row["poster"])
            if row.get("look"):
                looks.add(row["look"])
            fields.add(field.get(row["id"]))
            per_kind[row["kind"]] += 1
            if row["kind"] in WAVE_KINDS:
                waves.add(wave_of(row))
            names.add((row["kind"], row["name"]))

    take(featured_pool, False)
    take(visible_pool, True)
    take(folded_pool, True)
    take(visible_pool, False)
    take(folded_pool, False)
    return chosen


def _clip(row, captions):
    """One clip card's data: where it goes, what it shows, what it is called."""
    href = row["href"]
    if href.startswith("../"):
        href = href[3:]
    name = row["name"]
    generated = GENERATED_NAME.match(name)
    title = row["equation"] if generated else name
    reading = FIELD_SUFFIX.sub("", row.get("reading") or "")
    if title == row["equation"]:
        meta = reading or BADGE[row["kind"]]
    else:
        meta = row["equation"] or reading or BADGE[row["kind"]]
    # A generated name is no more use on hover than on the card: its slug is
    # an atlas key and its "on gNNN" names the entry the reader is already in.
    tooltip = " · ".join(part for part in (
        None if generated else name, reading, row["equation"], row["dims"], row["params"]) if part)
    if row["kind"] == "mono":
        caption = captions.get(row["id"].split("@")[0])
        if caption:
            tooltip += " — " + caption
    return {
        "id": row["id"],
        "kind": row["kind"],
        "href": href,
        "preview": "showcase/" + row["preview"],
        "poster": "showcase/" + row["poster"],
        "badge": BADGE[row["kind"]],
        "title": title,
        "meta": meta,
        "reading": reading,
        "tooltip": tooltip,
    }


def _extended(meta, extra):
    """``meta`` with ``extra`` added once, as another " · " part."""
    if not extra:
        return meta
    if not meta:
        return extra
    if meta == extra or meta.endswith(" · " + extra) or (" · " + extra + " · ") in meta:
        return meta
    return meta + " · " + extra


def _disambiguate(clips):
    """Make (title, meta) unique inside one entry.

    Two of an entry's four cards are often one wave read two ways — a
    black-and-white reading and the field it reads both print "Standing wave /
    Gray–Scott", which reads as the same card twice.  The badge already tells
    them apart on screen, so the badge word goes into the caption as well; two
    cards of the *same* kind need their reading instead, since the badge would
    repeat."""
    def by_caption(cards):
        buckets = collections.OrderedDict()
        for card in cards:
            buckets.setdefault((card["title"], card["meta"]), []).append(card)
        return buckets

    for colliding in list(by_caption(clips).values()):
        if len(colliding) < 2:
            continue
        base = dict((id(card), card["meta"]) for card in colliding)
        for card in colliding:
            card["meta"] = _extended(base[id(card)], card["badge"])
        for again in by_caption(colliding).values():
            if len(again) < 2:
                continue
            for card in again:
                card["meta"] = _extended(base[id(card)], card["reading"])
    return clips


# ---------------------------------------------------------------- the links --


def _viewer_links():
    """The standalone viewers each group has, checked against their bytes."""
    by_group = collections.defaultdict(list)
    for path, name, target, digest, groups in VIEWERS:
        field = DOCS / path / "field.f32"
        current = hashlib.sha256(field.read_bytes()).hexdigest()
        if current != digest:
            raise SystemExit(
                "docs/%sfield.f32 is no longer the field this module vouches for\n"
                "  recorded sha256 %s\n"
                "  current  sha256 %s\n"
                "The viewer's group claim (%s) was derived from these bytes — from the\n"
                "catalogued orbit they are, or are a frame of, and for a monochrome\n"
                "viewer from the reading it draws of them.  Re-derive the groups, then\n"
                "update VIEWERS in enumerate/correspondence_visualizations.py." % (
                    path, digest, current, ", ".join(groups)))
        for gid in groups:
            by_group[gid].append({"name": name, "target": target, "href": path})
    for gid, viewers in by_group.items():
        order = VIEWER_ORDER.get(gid)
        if order is None or sorted(order) != sorted(viewer["name"] for viewer in viewers):
            raise SystemExit("VIEWER_ORDER does not list the viewers of %s" % gid)
        viewers.sort(key=lambda viewer: order.index(viewer["name"]))
    return by_group


def _pattern_targets(records, patterns):
    """The pattern catalogue's id for each entry's colouring."""
    targets = {}
    for record in records:
        matches = [group for group in patterns
                   if group["hm"] == record["parent"]["hm"]
                   and group["chaim_type"] == record["tos_notation"]
                   and group["k"] == record["clock_order"]
                   and group["normal"] and group["cyclic"]]
        if len(matches) != 1:
            raise SystemExit("%s matches %d groups of docs/data/patterns.json" % (
                record["id"], len(matches)))
        targets[record["id"]] = matches[0]["id"]
    return targets


def _plural(count, noun):
    return "%d %s%s" % (count, noun, "" if count == 1 else "s")


# --------------------------------------------------------------- the module --


def load():
    """{group id: {"family", "clips", "links"}} for all 68 entries."""
    records = _read_json("data/clockwork-coloring-correspondence.json")["groups"]
    family = dict((record["id"], record["parent"]["hm"]) for record in records)

    rows = _read_json("showcase/data/showcase.json")["rows"]
    mono_atlas = _read_json("monochrome/data/monochrome-atlas.json")
    mono_entries = dict((entry["id"], entry) for entry in mono_atlas["entries"])
    mono_fields = mono_atlas["fields"]
    colour_entries = dict((entry["id"], entry) for entry in
                          _read_json("colour/data/colour-atlas.json")["entries"])
    orbits = dict((orbit["id"], orbit) for orbit in
                  _read_json("scott-gray/data/wallpaper-atlas.json")["orbits"])
    captions = _read_json("monochrome/tools/featured.json")
    patterns = _read_json("data/patterns.json")["groups"]
    designer = _read_json("data/designer-links.json")["links"]

    index, field, score = _showcase_pools(rows, mono_entries, orbits, colour_entries)
    by_group = collections.defaultdict(list)
    for row in rows:
        if row["groupId"]:
            by_group[row["groupId"]].append(row)

    # the reaction-diffusion explorer's group chip
    orbit_counts = collections.Counter(orbit["groupId"] for orbit in orbits.values())
    # the black-and-white explorer's picture list, mono-app.mjs groupFields(id, 'all')
    mono_counts = collections.defaultdict(set)
    for entry in mono_atlas["entries"]:
        record = mono_fields[entry["field"]]
        for hm in record.get("families", ()):
            for gid in record.get("groupIds", ()):
                mono_counts[(hm, gid)].add(entry["field"])
    # the two three-colour explorers
    colour_counts = collections.defaultdict(collections.Counter)
    for entry in colour_entries.values():
        source = entry["source"]
        for gid in source.get("groupIds") or [source["groupId"]]:
            colour_counts[entry["kind"]][gid] += 1

    viewers = _viewer_links()
    pattern_targets = _pattern_targets(records, patterns)
    labs = [("scott-gray/groups.json", "scott-gray/lab.html#%s", "442 p4 laboratory"),
            ("scott-gray/p6/groups.json", "scott-gray/p6/lab.html#%s", "632 p6 laboratory")]
    lab_groups = []
    for path, href, name in labs:
        lab_groups.append((set(group["id"] for group in _read_json(path)), href, name))

    data = collections.OrderedDict()
    for record in records:
        gid = record["id"]
        hm = family[gid]
        links = []
        page = "scott-gray/" if hm == "p4" else "scott-gray/%s/" % hm
        links.append({"name": "Reaction–diffusion explorer", "href": "%s#%s" % (page, gid),
                      "target": _plural(orbit_counts[gid], "pattern"), "scope": "this group"})
        links.append({"name": "Black-and-white explorer", "href": "monochrome/%s/#%s" % (hm, gid),
                      "target": _plural(len(mono_counts[(hm, gid)]), "picture"),
                      "scope": "this group"})
        gyre = colour_counts["gyre"][gid]
        if gyre:
            links.append({"name": "Gyre explorer (three colours)",
                          "href": "colour/gyre/#%s" % gid,
                          "target": _plural(gyre, "pattern"), "scope": "this group"})
        trefoil = colour_counts["trefoil"][gid]
        if trefoil:
            links.append({"name": "Trefoil explorer (three colours)",
                          "href": "colour/trefoil/#%s?v=1&sub=all" % gid,
                          "target": _plural(trefoil, "pattern"), "scope": "this group"})
        for viewer in viewers.get(gid, ()):
            links.append({"name": viewer["name"], "href": viewer["href"],
                          "target": VIEWER_TARGET.get((viewer["name"], gid), viewer["target"]),
                          "scope": "full-screen viewer"})
        if gid in designer:
            links.append({"name": "3D spacetime designer",
                          "href": "designer.html#%s" % designer[gid],
                          "target": "build a billiard in this group", "scope": "this group"})
        links.append({"name": "Pattern catalogue",
                      "href": "patterns.html#group-%s" % pattern_targets[gid],
                      "target": "this colouring, drawn with its generators",
                      "scope": "colour group"})
        for members, href, name in lab_groups:
            if gid in members:
                links.append({"name": name, "href": href % gid,
                              "target": "re-run the solver", "scope": "research tool"})

        clips = _disambiguate([_clip(row, captions)
                               for row in _select(by_group.get(gid, []), index, field, score)])
        data[gid] = {"family": hm, "clips": clips, "links": links}
    return data


def section_html(gid, entry, indent):
    """The entry's Visualizations section, indented to sit inside .entry-copy."""
    pad = " " * indent
    lines = [
        '%s<section class="entry-visualizations" aria-labelledby="%s-visualizations-title" '
        'data-visualizations="%s">' % (pad, attr(gid), attr(gid)),
        '%s  <h4 id="%s-visualizations-title">Visualizations</h4>' % (pad, attr(gid)),
    ]
    if entry["clips"]:
        lines.append('%s  <ul class="viz-clips" aria-label="Animations of %s from the Showcase">'
                     % (pad, attr(gid)))
        for clip in entry["clips"]:
            lines.append(
                '%s    <li><a class="viz-clip" data-kind="%s" href="%s" title="%s">'
                '<span class="viz-clip-art" data-preview="%s">'
                '<img src="%s" width="176" height="176" alt="" loading="lazy" decoding="async">'
                '<span class="viz-clip-badge">%s</span></span>'
                '<span class="viz-clip-name">%s</span>'
                '<span class="viz-clip-meta">%s</span></a></li>' % (
                    pad, attr(clip["kind"]), attr(clip["href"]), attr(clip["tooltip"]),
                    attr(clip["preview"]), attr(clip["poster"]),
                    html_lib.escape(clip["badge"]), html_lib.escape(clip["title"]),
                    html_lib.escape(clip["meta"])))
        lines.append("%s  </ul>" % pad)
        lines.append('%s  <p class="viz-more"><a href="showcase/#%s">More %s animations in the '
                     'Showcase</a></p>' % (pad, attr(entry["family"]),
                                           html_lib.escape(entry["family"])))
    lines.append('%s  <ul class="viz-links" aria-label="Visualizations of %s elsewhere on the site">'
                 % (pad, attr(gid)))
    for link in entry["links"]:
        lines.append(
            '%s    <li><a class="viz-link" href="%s">'
            '<span class="viz-link-name">%s</span>'
            '<span class="viz-link-target">%s</span>'
            '<span class="viz-link-scope">%s</span></a></li>' % (
                pad, attr(link["href"]), html_lib.escape(link["name"]),
                html_lib.escape(link["target"]), html_lib.escape(link["scope"])))
    lines.append("%s  </ul>" % pad)
    lines.append("%s</section>" % pad)
    return "\n".join(lines)


def main(argv):
    data = load()
    if "--json" in argv:
        json.dump(data, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
        return 0
    clips = sum(len(entry["clips"]) for entry in data.values())
    links = sum(len(entry["links"]) for entry in data.values())
    print("%d entries, %d clips, %d links" % (len(data), clips, links))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
