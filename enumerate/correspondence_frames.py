#!/usr/bin/env python3
"""One pattern per wallpaper group on the correspondence pages.

Each page correspondence-<hm>.html shows, as tabs, the forward clockwork groups
over one wallpaper group.  Every tab draws the same wallpaper group -- only the
clock phase of each operation, and so the colouring, changes -- but the
snapshot drew each tab in the setting of its own polar space group.  Basis,
origin and motif base point differed from tab to tab, so clicking along the
tabs moved, rotated, rescaled and sometimes mirrored the motifs, and the
generator marks travelled with them (p3: the R3 tab g227 used the rhombohedral
cell, a third of the area per motif, and a different base point).

This script draws every tab in the frame of its page's plain wallpaper tab,
the N = 1 row that every page has (g224 for p3).  For each row it writes a
display frame to docs/data/clockwork-coloring-frames.json:

  * render: the row's own operations in new coordinates, so that the same
    point of the plane carries the same motif, in the same orientation, on
    every tab.  The row keeps its own colour-fixing lattice -- a lattice
    translation must not change the clock phase -- only the coordinates
    change: q' = q + e, basis' = basis_ref . T^-1, v' = v + e - M e, where T
    takes the reference tab's lattice coordinates to this row's and e absorbs
    the difference of origins.  M, s and tau are untouched;
  * viewport_center: the reference tab's;
  * mirrored: whether that frame is a mirror image of the row's own setting,
    in which case an n_m screw axis is drawn as n_(n-m) (g99 on p4: its
    alpha is a 4_3 here, a 4_1 in its own setting and on the Scott-Gray pages);
  * frame_reference: the reference tab.  The static plate (rendered here) and
    the film (docs/js/correspondence-geometry.js) take their scale and motif
    size from it, so a tab with a larger colour cell is no longer zoomed out;
  * generators: each named generator matched again in the new coordinates.  It
    keeps its time shift and is marked at the same place on every tab; only
    the kind of mark (rotation or screw, mirror or time glide) changes.
    Labels are placed against the union of the page's plates, so they do not
    move either.

The correspondence JSON itself stays as it is: the reaction-diffusion search
(docs/scott-gray) pins its SHA-256 and works in each group's own setting.

A frame that is mirrored relative to a row's own setting is allowed only for an
achiral group; --check enforces this by requiring every rotation-only plate to
draw exactly the screw axes its clockwork symbol names (4_1 vs 4_3 and so on;
the chiral rows are the four enantiomorphic pairs P3_1/P3_2, P4_1/P4_3,
P6_1/P6_5, P6_2/P6_4).

The coordinate change uses the signed canonical-to-render conjugacies of the
generator that produced the snapshot, and the plate and overlay renderers come
from the same file, so rewriting needs a checkout of yaroslavvb/animated-groups
(scripts/generate_clockwork_coloring_correspondence.py) and Pillow; --check
needs neither.

Usage:
    python3 correspondence_frames.py --animated-groups ../../animated-groups
        write docs/data/clockwork-coloring-frames.json, re-render the plates
        under docs/output/clockwork-colorings and the generator overlays in
        enumerate/correspondence-source.html
    python3 correspondence_frames.py --check
        exit 1 unless the frames match the correspondence JSON and every page's
        tabs share one pattern and one set of marks
    then python3 split_correspondence.py to regenerate the served pages
"""

import argparse
import copy
import hashlib
import io
import json
import math
import pathlib
import re
import sys
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "data" / "clockwork-coloring-correspondence.json"
FRAMES = ROOT / "docs" / "data" / "clockwork-coloring-frames.json"
SOURCE = ROOT / "enumerate" / "correspondence-source.html"
PLATES = ROOT / "docs" / "output" / "clockwork-colorings"
PLATE_VERSION = "family-frame-v1"
FRAMES_SCHEMA = "clockwork-coloring-frames-v1"
PLATE_FIELDS = ("plate_source_index", "plate_lattice_shift", "plate_visualization")
TOLERANCE = 1e-6


# --- geometry -------------------------------------------------------------------

def mat_mul(a, b):
    return [[a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
            [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]]


def mat_inv(a):
    det = a[0][0] * a[1][1] - a[0][1] * a[1][0]
    return [[a[1][1] / det, -a[0][1] / det], [-a[1][0] / det, a[0][0] / det]]


def apply(m, v):
    return [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]]


def det(m):
    return m[0][0] * m[1][1] - m[0][1] * m[1][0]


def basis_matrix(render):
    """Columns are the basis vectors: physical = B q."""
    b = render["basis"]
    return [[b[0][0], b[1][0]], [b[0][1], b[1][1]]]


def frac(value):
    return value - math.floor(value)


def motif_placements(render, centre, radius):
    """Every motif within `radius` of `centre`: (x, y, physical linear part).

    This is the orbit the plate and the film draw: operation (M, v) puts a copy
    at M*base + v + lattice, turned by B M B^-1.
    """
    basis = basis_matrix(render)
    inverse = mat_inv(basis)
    base = render["base"]
    corners = [apply(inverse, [centre[0] + sx * radius, centre[1] + sy * radius])
               for sx in (-1, 1) for sy in (-1, 1)]
    low = [min(c[k] for c in corners) for k in range(2)]
    high = [max(c[k] for c in corners) for k in range(2)]
    placements = []
    for op in render["ops"]:
        linear = mat_mul(mat_mul(basis, op["M"]), inverse)
        site = [op["M"][0][0] * base[0] + op["M"][0][1] * base[1] + op["v"][0],
                op["M"][1][0] * base[0] + op["M"][1][1] * base[1] + op["v"][1]]
        for i in range(int(math.floor(low[0] - site[0])) - 1, int(math.ceil(high[0] - site[0])) + 2):
            for j in range(int(math.floor(low[1] - site[1])) - 1, int(math.ceil(high[1] - site[1])) + 2):
                x, y = apply(basis, [site[0] + i, site[1] + j])
                if math.hypot(x - centre[0], y - centre[1]) <= radius:
                    placements.append((x, y, linear))
    return placements


def covered(inner, outer):
    """Every motif of `inner` appears in `outer` at the same place and turn."""
    cells = {}
    for p in outer:
        cells.setdefault((round(p[0] * 100), round(p[1] * 100)), []).append(p)
    for p in inner:
        key = (round(p[0] * 100), round(p[1] * 100))
        candidates = [q for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                      for q in cells.get((key[0] + dx, key[1] + dy), ())]
        if not any(abs(p[0] - q[0]) < 1e-6 and abs(p[1] - q[1]) < 1e-6
                   and all(abs(p[2][r][c] - q[2][r][c]) < 1e-6 for r in range(2) for c in range(2))
                   for q in candidates):
            return False
    return True


def same_motifs(render, reference):
    """Both renders put the same motifs in the reference's window (and a margin)."""
    centre = reference["viewport_center"]
    radius = 6.0 * math.sqrt(abs(det(basis_matrix(reference["render"]))))
    return (covered(motif_placements(reference["render"], centre, radius),
                    motif_placements(render, centre, radius + 0.01))
            and covered(motif_placements(render, centre, radius),
                        motif_placements(reference["render"], centre, radius + 0.01)))


def generator_motion(visualization):
    """Physical affine motion (matrix, vector) of a stored generator mark."""
    kind = visualization["kind"]
    if kind == "translation":
        return [[1.0, 0.0], [0.0, 1.0]], list(visualization["vector"])
    if kind == "rotation":
        angle = math.radians(visualization["angle_degrees"])
        m = [[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]]
        c = visualization["centre"]
        mc = apply(m, c)
        return m, [c[0] - mc[0], c[1] - mc[1]]
    ux, uy = visualization["axis_direction"]
    norm = math.hypot(ux, uy)
    ux, uy = ux / norm, uy / norm
    m = [[2 * ux * ux - 1, 2 * ux * uy], [2 * ux * uy, 2 * uy * uy - 1]]
    p = visualization["axis_point"]
    mp = apply(m, p)
    glide = visualization.get("glide_distance", 0.0)
    return m, [p[0] - mp[0] + glide * ux, p[1] - mp[1] + glide * uy]


def same_motion(left, right):
    (lm, lv), (rm, rv) = generator_motion(left), generator_motion(right)
    return (all(abs(lm[r][c] - rm[r][c]) < TOLERANCE for r in range(2) for c in range(2))
            and all(abs(lv[k] - rv[k]) < TOLERANCE for k in range(2)))


def matching_operations(render, visualization):
    """The render operations equal to a generator modulo the colour lattice."""
    basis = basis_matrix(render)
    inverse = mat_inv(basis)
    m, t = generator_motion(visualization)
    lattice_m = mat_mul(mat_mul(inverse, m), basis)
    lattice_v = apply(inverse, t)
    matches = []
    for op in render["ops"]:
        if any(abs(op["M"][r][c] - lattice_m[r][c]) > TOLERANCE for r in range(2) for c in range(2)):
            continue
        offset = [lattice_v[k] - op["v"][k] for k in range(2)]
        if all(abs(x - round(x)) < TOLERANCE for x in offset):
            matches.append(op)
    return matches


def screw_step(order, time_shift, angle_degrees):
    """Subscript m of the screw axis n_m drawn for a rotation mark."""
    step = Fraction(time_shift) * order
    if step.denominator != 1:
        raise ValueError("time shift %s does not fit a %d-fold rotation" % (time_shift, order))
    angle = angle_degrees % 360
    if abs(angle - 360 / order) < 1e-7:
        sense = 1
    elif abs(angle - (360 - 360 / order) % 360) < 1e-7:
        sense = -1
    else:
        raise ValueError("rotation angle %s is not elementary" % angle_degrees)
    return (sense * step.numerator) % order


SUBSCRIPTS = str.maketrans("₀₁₂₃₄₅₆", "0123456")


def symbol_screws(symbol):
    """Multiset of (n, m) cone points named by a rotation-only clockwork symbol."""
    tokens = re.findall(r"([2346])([₀₁₂₃₄₅₆]?)", symbol)
    return sorted((int(n), int(m.translate(SUBSCRIPTS) or 0)) for n, m in tokens)


def origin_shift(own, display):
    """e with v_display = v_own + e - M e (mod 1) for every operation, or None.

    The display frame may only move the origin (and re-embed the lattice);
    operations, their order and their clock phases must be the row's own.
    """
    if len(own["ops"]) != len(display["ops"]):
        return None
    for a, b in zip(own["ops"], display["ops"]):
        if a["M"] != b["M"] or a["s"] != b["s"] or abs(a["tau"] - b["tau"]) > TOLERANCE:
            return None
    for i in range(24):
        for j in range(24):
            e = (i / 24, j / 24)
            if all(abs(d - round(d)) < TOLERANCE for a, b in zip(own["ops"], display["ops"])
                   for d in (b["v"][k] - a["v"][k] - e[k] + a["M"][k][0] * e[0] + a["M"][k][1] * e[1]
                             for k in range(2))):
                return e
    return None


# --- frames file ----------------------------------------------------------------

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def display_payload(payload, frames):
    """The correspondence rows as the pages draw them: each in its page's frame."""
    display = copy.deepcopy(payload)
    for g in display["groups"]:
        frame = frames["frames"][g["id"]]
        g["render"] = frame["render"]
        g["viewport_center"] = frame["viewport_center"]
        g["frame_reference"] = frame["frame_reference"]
        for gen in g["chaim_presentation"]["generators"]:
            if gen["generator"] in frame["generators"]:
                gen.update(frame["generators"][gen["generator"]])
    return display


def is_mirrored(own, display):
    """The display frame reverses the orientation of the row's own setting.

    Both renders use the row's own lattice coordinates, so the map between the
    two physical frames is B_display B_own^-1.
    """
    return det(basis_matrix(display)) * det(basis_matrix(own)) < 0


def frames_document(payload, display, source_sha):
    own_by_id = {g["id"]: g for g in payload["groups"]}
    return {
        "schema": FRAMES_SCHEMA,
        "source": "clockwork-coloring-correspondence.json",
        "source_sha256": source_sha,
        "description": (
            "Display frames for the correspondence pages. Every row is redrawn in the "
            "frame of its page's plain wallpaper row (frame_reference): same basis "
            "embedding, origin, motif base point, viewport and scale, so switching tabs "
            "changes only the colours and the kind of generator mark. The operations "
            "(M, s, tau) are the row's own; only coordinates change. Written by "
            "enumerate/correspondence_frames.py."
        ),
        "frames": {
            g["id"]: {
                "frame_reference": g["frame_reference"],
                "mirrored": is_mirrored(own_by_id[g["id"]]["render"], g["render"]),
                "viewport_center": g["viewport_center"],
                "render": g["render"],
                "generators": {
                    gen["generator"]: {field: gen[field] for field in PLATE_FIELDS}
                    for gen in g["chaim_presentation"]["generators"]
                    if "plate_visualization" in gen
                },
            }
            for g in display["groups"]
        },
    }


# --- consistency check ----------------------------------------------------------

def check(payload, display):
    """Problems with the display frames, as a list of messages."""
    problems = []
    own_by_id = {g["id"]: g for g in payload["groups"]}
    families = {}
    for g in display["groups"]:
        families.setdefault(g["parent"]["hm"], []).append(g)
    for hm, members in families.items():
        references = [g for g in members if g["clock_order"] == 1]
        if len(references) != 1:
            problems.append("%s: expected one plain wallpaper row, found %d" % (hm, len(references)))
            continue
        reference = references[0]
        reference_marks = {gen["generator"]: gen["plate_visualization"]
                           for gen in reference["chaim_presentation"]["generators"]
                           if "plate_visualization" in gen}
        for g in members:
            try:
                problems.extend(check_row(g, own_by_id[g["id"]], reference, reference_marks))
            except (ValueError, ZeroDivisionError, KeyError, TypeError) as error:
                problems.append("%s: cannot be checked (%s: %s)" % (g["id"], type(error).__name__, error))
    return problems


def check_row(g, own, reference, reference_marks):
    gid = g["id"]
    problems = []
    if g.get("frame_reference") != reference["id"]:
        problems.append("%s: frame_reference is %r, expected %r"
                        % (gid, g.get("frame_reference"), reference["id"]))
    if g is reference:
        # Every other row is compared with this one, so anchor it: the plain
        # row is drawn in its own setting, marks included.
        if g["render"] != own["render"] or g["viewport_center"] != own["viewport_center"]:
            problems.append("%s: the plain row's frame is not its own setting" % gid)
        own_marks = {gen["generator"]: gen["plate_visualization"]
                     for gen in own["chaim_presentation"]["generators"] if "plate_visualization" in gen}
        if set(own_marks) != set(reference_marks) or not all(
                same_motion(own_marks[name], reference_marks[name]) for name in own_marks):
            problems.append("%s: the plain row's marks are not its own" % gid)
    if origin_shift(own["render"], g["render"]) is None:
        problems.append("%s: display operations are not the row's own up to an origin shift" % gid)
    if any(abs(a - b) > TOLERANCE for a, b in zip(g["viewport_center"], reference["viewport_center"])):
        problems.append("%s: viewport centre differs from %s" % (gid, reference["id"]))
    if not same_motifs(g["render"], reference):
        problems.append("%s: motifs differ from %s" % (gid, reference["id"]))
    marks = {}
    for gen in g["chaim_presentation"]["generators"]:
        if "plate_visualization" not in gen:
            continue
        name = gen["generator"]
        marks[name] = gen["plate_visualization"]
        ops = matching_operations(g["render"], gen["plate_visualization"])
        if len(ops) != 1:
            problems.append("%s: generator %s matches %d operations" % (gid, name, len(ops)))
        elif Fraction(ops[0]["tau"]).limit_denominator(24) != Fraction(gen["time_shift"]):
            problems.append("%s: generator %s drawn with phase %s, stated %s"
                            % (gid, name, ops[0]["tau"], gen["time_shift"]))
    if set(marks) != set(reference_marks) or not all(
            same_motion(marks[name], reference_marks[name]) for name in marks):
        problems.append("%s: generator marks differ from %s" % (gid, reference["id"]))
    rotations = [gen for gen in g["chaim_presentation"]["generators"]
                 if gen.get("plate_visualization", {}).get("kind") == "rotation"]
    if rotations and not re.search(r"[*×]", g["symbol"]):
        drawn = sorted((gen["marker"]["order"],
                        screw_step(gen["marker"]["order"], gen["time_shift"],
                                   gen["plate_visualization"]["angle_degrees"]))
                       for gen in rotations)
        if drawn != symbol_screws(g["symbol"]):
            problems.append("%s: plate draws screws %s but the symbol %s names %s"
                            % (gid, drawn, g["symbol"], symbol_screws(g["symbol"])))
    return problems


# --- rewriting (needs animated-groups and Pillow) -----------------------------------

def load_generator(checkout):
    scripts = pathlib.Path(checkout).resolve() / "scripts"
    if not (scripts / "generate_clockwork_coloring_correspondence.py").exists():
        sys.exit("no generate_clockwork_coloring_correspondence.py under %s; "
                 "pass --animated-groups <checkout of yaroslavvb/animated-groups>" % scripts)
    sys.path.insert(0, str(scripts))
    import generate_clockwork_coloring_correspondence as generator
    return generator


def rational(value):
    exact = Fraction(value).limit_denominator(48)
    if abs(float(exact) - value) > 1e-9:
        raise ValueError("%r is not a small rational" % value)
    return exact


def reframed_render(g, reference, linear_ref, offset_ref, linear, offset):
    """This row's render in the reference frame, given canonical -> lattice maps.

    Canonical x -> this row's lattice q = L x + d, and -> the reference's
    q_ref = L_ref x + d_ref.  T = L L_ref^-1 is a rational matrix.
    """
    t = [[rational(x) for x in row] for row in mat_mul(linear, mat_inv(linear_ref))]
    t_float = [[float(x) for x in row] for row in t]
    d_ref = [rational(x) for x in offset_ref]
    d = [rational(x) for x in offset]
    e = [t[0][0] * d_ref[0] + t[0][1] * d_ref[1] - d[0],
         t[1][0] * d_ref[0] + t[1][1] * d_ref[1] - d[1]]
    new_basis = mat_mul(basis_matrix(reference["render"]), mat_inv(t_float))
    ops = []
    for op in g["render"]["ops"]:
        m = op["M"]
        v = [rational(x) for x in op["v"]]
        shifted = [v[k] + e[k] - (m[k][0] * e[0] + m[k][1] * e[1]) for k in range(2)]
        ops.append({"M": m, "v": [float(x - math.floor(x)) for x in shifted],
                    "s": op["s"], "tau": op["tau"]})
    render = {
        "basis": [[new_basis[0][0], new_basis[1][0]], [new_basis[0][1], new_basis[1][1]]],
        "ops": ops,
        "base": [round(frac(x), 12) for x in apply(t_float, reference["render"]["base"])],
    }
    return render, (linear, tuple(float(d[k] + e[k]) for k in range(2)))


def reframe(payload, generator):
    """Return the rows redrawn in their families' frames, and notes."""
    display = copy.deepcopy(payload)
    table = generator.CANONICAL_TO_RENDER_CONJUGACY_BY_ID
    conjugacy = dict(table)
    references = {g["parent"]["hm"]: g for g in display["groups"] if g["clock_order"] == 1}
    notes = []
    # The plain rows first: each is its own reference and does not move.
    for g in sorted(display["groups"], key=lambda row: row["clock_order"] != 1):
        reference = references[g["parent"]["hm"]]
        linear_ref, offset_ref = conjugacy[reference["id"]]
        render, own = reframed_render(g, reference, linear_ref, offset_ref, *conjugacy[g["id"]])
        if not same_motifs(render, reference):
            # The generator's conjugacy for g131 sends the canonical *442 onto
            # an index-2 subgroup (its P, Q, R bound two fundamental triangles).
            # Its operations are the reference's, so the reference's map fits.
            render, own = reframed_render(g, reference, linear_ref, offset_ref,
                                          linear_ref, offset_ref)
            if not same_motifs(render, reference):
                raise ValueError("%s: no frame puts its motifs on %s's" % (g["id"], reference["id"]))
            notes.append("%s uses %s's canonical map" % (g["id"], reference["id"]))
        g["render"] = render
        g["viewport_center"] = list(reference["viewport_center"])
        g["frame_reference"] = reference["id"]
        # The upstream matcher reads the row's map from its own table.
        table[g["id"]] = own
        try:
            aligned = {row["generator"]: row for row in generator._canonical_generator_alignment(
                g["id"], g["parent"]["hm"], g["render"])}
        finally:
            table[g["id"]] = conjugacy[g["id"]]
        reference_marks = {gen["generator"]: gen["plate_visualization"]
                           for gen in reference["chaim_presentation"]["generators"]
                           if "plate_visualization" in gen}
        for gen in g["chaim_presentation"]["generators"]:
            if "plate_visualization" not in gen:
                continue
            row = aligned[gen["generator"]]
            if generator.fraction_label(row["phase"]) != gen["time_shift"]:
                raise ValueError("%s %s: phase %s after reframing, stated %s"
                                 % (g["id"], gen["generator"], row["phase"], gen["time_shift"]))
            mark = row["visualization"]
            shared = reference_marks.get(gen["generator"])
            # Store the reference's record of an identical motion, so the
            # overlays agree to the last digit (an axis direction is only
            # defined up to sign).
            if shared is not None and same_motion(mark, shared):
                mark = dict(shared)
            gen["plate_source_index"] = row["source_index"]
            gen["plate_lattice_shift"] = list(row["lattice_shift"])
            gen["plate_visualization"] = mark
    return display, notes


def install_family_rendering(generator, display):
    """Size every plate by its frame reference and place labels on shared ink.

    The upstream renderer sizes a plate from its own basis and places labels
    against its own plate; either would let a tab differ from its page.
    """
    from PIL import ImageChops

    original_site_geometry = generator._site_geometry
    original_mask = generator._plate_motif_occupancy_mask
    by_id = {g["id"]: g for g in display["groups"]}
    reference_of = {id(g["render"]): by_id[g["frame_reference"]]["render"] for g in display["groups"]}

    def site_geometry(spec, width, height, viewport_center=(0, 0)):
        # Every render reaching the plate code is one of the display rows'.
        reference = reference_of[id(spec)]
        reference_b1, _b2, radius, _ranges = original_site_geometry(
            reference, width, height, viewport_center)
        cell = math.hypot(*reference_b1) / math.hypot(*reference["basis"][0])
        basis = spec["basis"]
        b1 = [basis[0][0] * cell, -basis[0][1] * cell]
        b2 = [basis[1][0] * cell, -basis[1][1] * cell]
        inverse = mat_inv([[b1[0], b2[0]], [b1[1], b2[1]]])
        origin_x = width / 2 - cell * float(viewport_center[0])
        origin_y = height / 2 + cell * float(viewport_center[1])
        firsts, seconds = [], []
        for px, py in ((0, 0), (width, 0), (0, height), (width, height)):
            first, second = apply(inverse, [px - origin_x, py - origin_y])
            firsts.append(first)
            seconds.append(second)
        pad = 2
        ranges = (range(math.floor(min(firsts) - pad), math.ceil(max(firsts) + pad) + 1),
                  range(math.floor(min(seconds) - pad), math.ceil(max(seconds) + pad) + 1))
        return b1, b2, radius, ranges

    generator._site_geometry = site_geometry

    masks = {}

    def family_mask(record):
        reference_id = record["frame_reference"]
        if reference_id not in masks:
            union = None
            for g in display["groups"]:
                if g["frame_reference"] == reference_id:
                    mask = original_mask(g)
                    union = mask if union is None else ImageChops.lighter(union, mask)
            masks[reference_id] = union
        return masks[reference_id]

    generator._plate_motif_occupancy_mask = family_mask


def write_plates(generator, display):
    """Re-render the plates; keep a file whose pixels already agree."""
    from PIL import Image, ImageChops
    written = []
    for g in display["groups"]:
        image = generator._render_plate_image(g).convert("RGB")
        path = PLATES / ("%s.webp" % g["id"])
        if path.exists():
            with Image.open(path) as existing:
                difference = ImageChops.difference(image, existing.convert("RGB")).convert("L")
            # Pillow versions differ by a few antialiased edge pixels; a moved
            # pattern changes tens of thousands.
            if sum(difference.point(lambda value: 255 if value > 8 else 0).histogram()[255:]) < 300:
                continue
        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", lossless=True, method=6)
        path.write_bytes(buffer.getvalue())
        written.append(g["id"])
    return written


LABEL_RE = re.compile(
    r'<text class="plate-generator-label" x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)</text>')
TRANSLATED_LABEL_RE = re.compile(
    r'(<g transform="translate\(([-\d.]+) ([-\d.]+)\)">(?:(?!<g transform=).)*?)'
    r'<text class="plate-generator-label" x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)</text>(</g>)',
    re.S)
# Glides whose axis is drawn as a line with a direction: axial (a, b) and
# diagonal (n).  The d-glide already carries its pair of quarter arrows.
GLIDE_RE = re.compile(
    r'(<g class="plate-generator [^"]*" [^>]*data-plane-symbol="(?:axial|n)">'
    r'<line class="plate-generator-axis-halo"[^>]*></line>'
    r'<line class="plate-generator-axis plate-generator-axis--plane-(?:axial|n)" '
    r'x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"></line>)')
GLIDE_SHAFT = 34.0


def local_overlay(svg):
    """Apply this repository's edits to a generator overlay.

    Labels paint last, in one group with absolute coordinates (c3e5a57); an
    axial or n glide carries a schematic half arrow at the middle of its axis
    (6e5c80e); correspondence_symbols.py redraws the symbols (e8516be).
    """
    import correspondence_symbols

    labels = []
    for m in TRANSLATED_LABEL_RE.finditer(svg):
        labels.append((m.start(7), float(m.group(2)) + float(m.group(4)),
                       float(m.group(3)) + float(m.group(5)), m.group(6), m.group(7)))
    translated = {label[0] for label in labels}
    for m in LABEL_RE.finditer(svg):
        if m.start(4) not in translated:
            labels.append((m.start(4), float(m.group(1)), float(m.group(2)), m.group(3), m.group(4)))
    labels.sort()
    body = TRANSLATED_LABEL_RE.sub(lambda m: m.group(1) + m.group(8), svg)
    body = LABEL_RE.sub("", body)

    def glide_arrow(m):
        x1, y1, x2, y2 = (float(m.group(k)) for k in range(2, 6))
        length = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        if uy > 1e-9 or (abs(uy) <= 1e-9 and ux < 0):
            ux, uy = -ux, -uy          # point up the page, or right if level
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        tail = (mx - ux * GLIDE_SHAFT / 2, my - uy * GLIDE_SHAFT / 2)
        tip = (mx + ux * GLIDE_SHAFT / 2, my + uy * GLIDE_SHAFT / 2)
        barb = (tip[0] - 9 * ux - 5.94 * uy, tip[1] - 9 * uy + 5.94 * ux)
        d = "M%.2f,%.2f L%.2f,%.2f M%.2f,%.2f L%.2f,%.2f" % (tail + tip + tip + barb)
        return (m.group(1) + '<path class="plate-generator-glide-arrow-halo" d="%s"></path>'
                '<path class="plate-generator-glide-arrow" d="%s"></path>' % (d, d))

    body = GLIDE_RE.sub(glide_arrow, body)
    if labels:
        group = "".join(
            '<text class="plate-generator-label" x="%.2f" y="%.2f"%s>%s</text>' % (x, y, attrs, text)
            for _, x, y, attrs, text in labels)
        body = body[:-len("</svg>")] + '<g class="plate-generator-labels">%s</g></svg>' % group
    body, _counts = correspondence_symbols.rewrite(body)
    return body


def overlay_pattern(group_id):
    return re.compile(r'<svg class="plate-generator-overlay" data-generator-overlay="%s" .*?</svg>'
                      % re.escape(group_id), re.S)


def write_overlays(generator, display):
    html = SOURCE.read_text(encoding="utf-8")
    changed = []
    for g in display["groups"]:
        pattern = overlay_pattern(g["id"])
        if len(pattern.findall(html)) != 1:
            raise ValueError("expected one overlay for %s in the source" % g["id"])
        new = local_overlay(generator._plate_generator_overlay_html(g))
        if pattern.search(html).group(0) != new:
            html = pattern.sub(lambda _m: new, html)
            changed.append(g["id"])
    html = re.sub(r'(output/clockwork-colorings/g\d+\.webp)\?v=[\w-]+', r'\1?v=' + PLATE_VERSION, html)
    SOURCE.write_text(html, encoding="utf-8")
    return changed


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--animated-groups", metavar="PATH",
                        help="checkout of yaroslavvb/animated-groups (for rewriting)")
    args = parser.parse_args(argv)
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    source_sha = sha256(DATA)
    if args.check:
        frames = json.loads(FRAMES.read_text(encoding="utf-8"))
        problems = []
        if frames.get("schema") != FRAMES_SCHEMA:
            problems.append("frames schema is %r, expected %r" % (frames.get("schema"), FRAMES_SCHEMA))
        if frames.get("source_sha256") != source_sha:
            problems.append("frames were written for another correspondence JSON; rerun the rewrite")
        missing = sorted({g["id"] for g in payload["groups"]} - set(frames.get("frames", {})))
        if missing:
            problems.append("no frame for %s" % " ".join(missing))
        if not problems:
            problems = check(payload, display_payload(payload, frames))
            for g in payload["groups"]:
                frame = frames["frames"][g["id"]]
                if frame.get("mirrored") != is_mirrored(g["render"], frame["render"]):
                    problems.append("%s: mirrored flag is %r" % (g["id"], frame.get("mirrored")))
        for problem in problems:
            print(problem)
        if problems:
            return 1
        families = len({g["parent"]["hm"] for g in payload["groups"]})
        print("consistent: %d rows over %d wallpaper groups share their page's pattern and marks"
              % (len(payload["groups"]), families))
        return 0
    if not args.animated_groups:
        parser.error("rewriting needs --animated-groups PATH (or pass --check)")
    generator = load_generator(args.animated_groups)
    display, notes = reframe(payload, generator)
    for note in notes:
        print(note)
    problems = check(payload, display)
    if problems:
        for problem in problems:
            print(problem)
        return 1
    FRAMES.write_text(json.dumps(frames_document(payload, display, source_sha), ensure_ascii=False, indent=2)
                      + "\n", encoding="utf-8")
    install_family_rendering(generator, display)
    plates = write_plates(generator, display)
    overlays = write_overlays(generator, display)
    print("wrote %s; %d plates (%s) and %d overlays (%s)"
          % (FRAMES.relative_to(ROOT), len(plates), " ".join(plates) or "none",
             len(overlays), " ".join(overlays) or "none"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
