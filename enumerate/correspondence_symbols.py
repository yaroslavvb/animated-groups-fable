#!/usr/bin/env python3
"""Crystallographic generator symbols for docs/correspondence.html.

The correspondence page marks every rotation and screw axis of the 68 polar
groups on its colour plates, in the legend strip under each plate, in the
"Diagram symbols" teaser and in the visual index.  All of those glyphs come
from the geometry below, which follows the graphical symbols of
*International Tables for Crystallography*, Vol. A (Table 2.1.2.6 of the
2016 edition; the same set is reproduced as Fig. 12 of Dauter & Jaskolski,
J. Appl. Cryst. 43 (2010) 1150, which the page cites):

  2      filled lens, pointed, standing upright
  3      filled equilateral triangle, apex up, centroid on the axis
  4      filled square standing on a vertex (a diamond, as in the cited figure)
  6      filled regular hexagon, vertex up
  n_m    the same core with straight tails that prolong the polygon edges
         past their vertices, arranged as a pinwheel.  For m < n/2 the tail at
         a vertex prolongs the edge that *arrives* there when the outline is
         walked counter-clockwise on the page; for m > n/2 the mirror image
         (clockwise walk).  The self-enantiomorphic screws 2_1, 4_2 and 6_3 use
         the clockwise walk and carry tails only at the top and bottom
         vertices; 6_2 and 6_4 carry three tails (top, lower-left,
         lower-right); 4_1, 4_3, 6_1, 6_5 and 3_1, 3_2 carry a tail at every
         vertex.  The 2_1 tails continue the lens arcs.

Each symbol is emitted as ONE filled outline (core and tails as subpaths of a
single path, all wound the same way), so it scales as a shape and anti-aliases
like type; the plate overlay adds a halo with `paint-order: stroke fill`.

Usage:
    python3 correspondence_symbols.py            rewrite enumerate/correspondence-source.html
    python3 correspondence_symbols.py --check    exit 1 unless the source is current
    python3 correspondence_symbols.py --svg      print a sample sheet (SVG) to stdout
    then python3 split_correspondence.py         to regenerate the served pages
"""

import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# The monolithic 68-row snapshot; split_correspondence.py cuts it into the
# served index and the 17 per-wallpaper-group pages under docs/.
PAGE = ROOT / "enumerate" / "correspondence-source.html"

# --- geometry -----------------------------------------------------------------
# All lengths in plate units (the overlay viewBox is 720 x 420).  R is the
# module of the set: the lens half-height.  The other cores are sized so the
# four symbols carry the same visual weight, as in the Tables.
R = 12.0
LENS_HALF_WIDTH = 0.42 * R        # the Tables' lens is slender
TRIANGLE_CIRCUMRADIUS = 1.27 * R  # height 1.5 * circumradius ~ 0.95 lens height
DIAMOND_HALF_DIAGONAL = 0.90 * R
HEXAGON_CIRCUMRADIUS = 1.00 * R
TAIL_WIDTH = 2.1
TAIL_LENGTH = {2: 0.62 * R, 3: 0.82 * R, 4: 0.68 * R, 6: 0.62 * R}
TAIL_INSET = 2.0                  # the bar starts this far inside the core
LENS_TAIL_SWEEP = math.radians(32)

# Scale of the symbol in each context (plate glyphs are drawn at 1).
ICON_SCALE = 0.88     # visual index and teaser: viewBox 68 x 32, origin (34, 16)
LEGEND_SCALE = 0.80   # legend strip under a plate: viewBox 32 x 32, origin (16, 16)


def _fmt(value):
    text = f"{value:.2f}"
    text = text.rstrip("0").rstrip(".") if "." in text else text
    return "0" if text in ("-0", "") else text


def _signed_area(points):
    total = 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        total += x0 * y1 - x1 * y0
    return total / 2


def _wind(points):
    """Return the polygon wound counter-clockwise as seen on the page.

    Screen coordinates have y pointing down, so a visually counter-clockwise
    outline has a NEGATIVE shoelace area.  Every subpath is wound this way and
    the lens arcs below are written to match, so the nonzero fill rule unions
    the core with its tails.
    """
    return points if _signed_area(points) < 0 else list(reversed(points))


def _polygon_d(points):
    return "M" + " L".join(f"{_fmt(x)},{_fmt(y)}" for x, y in _wind(points)) + " Z"


def _bar(vertex, direction, length, width=TAIL_WIDTH, inset=TAIL_INSET):
    """A straight tail prolonging a core edge past `vertex`.

    The bar's outer side is the edge line itself, so the outline runs straight
    from the edge into the tail with no step, and the bar's inner side hangs
    on the core's side of that line: the part behind the vertex lies inside
    the core (the cores are centred on the origin), which welds the tail to
    the core at every scale instead of touching it at a point.
    """
    dx, dy = direction
    norm = math.hypot(dx, dy)
    dx, dy = dx / norm, dy / norm
    nx, ny = -dy, dx
    vx, vy = vertex
    if nx * vx + ny * vy > 0:          # normal must point towards the origin
        nx, ny = -nx, -ny
    x0, y0 = vx - dx * inset, vy - dy * inset
    x1, y1 = vx + dx * length, vy + dy * length
    return [
        (x0, y0),
        (x1, y1),
        (x1 + nx * width, y1 + ny * width),
        (x0 + nx * width, y0 + ny * width),
    ]


def _core_vertices(n):
    """Core polygon vertices, listed counter-clockwise as seen on the page."""
    s60 = math.sin(math.radians(60))
    if n == 3:
        rho = TRIANGLE_CIRCUMRADIUS
        return [(0, -rho), (-rho * s60, rho / 2), (rho * s60, rho / 2)]
    if n == 4:
        rho = DIAMOND_HALF_DIAGONAL
        return [(0, -rho), (-rho, 0), (0, rho), (rho, 0)]
    if n == 6:
        rho = HEXAGON_CIRCUMRADIUS
        return [
            (0, -rho), (-rho * s60, -rho / 2), (-rho * s60, rho / 2),
            (0, rho), (rho * s60, rho / 2), (rho * s60, -rho / 2),
        ]
    raise ValueError(n)


def _tail_vertices(n, m):
    """Which vertices (indices into _core_vertices) carry a tail."""
    if m == 0:
        return []
    if n == 3:
        return [0, 1, 2]
    if n == 4:
        return [0, 2] if m == 2 else [0, 1, 2, 3]
    if n == 6:
        if m == 3:
            return [0, 3]
        if m in (2, 4):
            return [0, 2, 4]
        return [0, 1, 2, 3, 4, 5]
    raise ValueError((n, m))


def _walk(n, m):
    """'ccw' or 'cw': which walk of the outline the tails prolong."""
    return "ccw" if 2 * m < n else "cw"


def _lens_subpaths(with_tails):
    h = LENS_HALF_WIDTH
    r = (R * R + h * h) / (2 * h)          # arc radius through both tips
    # Top tip -> bottom tip along the left arc, back along the right arc:
    # both arcs run counter-clockwise on the page (sweep flag 0).
    parts = [
        f"M0,{_fmt(-R)} A{_fmt(r)},{_fmt(r)} 0 0 0 0,{_fmt(R)}"
        f" A{_fmt(r)},{_fmt(r)} 0 0 0 0,{_fmt(-R)} Z"
    ]
    if with_tails:
        # 2_1: the clockwise walk climbs the left arc into the top tip, so the
        # top tail continues that arc past the tip (curling to the right); the
        # bottom tail is its point reflection.
        # As with the straight tails, the band's outer side is the arc itself
        # and its body hangs inside the circle, where the lens is.
        cx = r - h                          # centre of the left arc
        alpha = math.atan2(R, cx)           # tip angle above the arc centre
        theta_tip = -math.pi + alpha
        theta0 = theta_tip - TAIL_INSET / r
        theta1 = theta_tip + LENS_TAIL_SWEEP
        steps = 7
        outer = [
            (cx + r * math.cos(theta0 + (theta1 - theta0) * i / steps),
             r * math.sin(theta0 + (theta1 - theta0) * i / steps))
            for i in range(steps + 1)
        ]
        inner = [
            (cx + (r - TAIL_WIDTH) * math.cos(theta1 - (theta1 - theta0) * i / steps),
             (r - TAIL_WIDTH) * math.sin(theta1 - (theta1 - theta0) * i / steps))
            for i in range(steps + 1)
        ]
        tail = outer + inner
        parts.append(_polygon_d(tail))
        parts.append(_polygon_d([(-x, -y) for x, y in tail]))
    return parts


def symbol_subpaths(n, m):
    if n == 2:
        return _lens_subpaths(with_tails=(m == 1))
    verts = _core_vertices(n)
    parts = [_polygon_d(verts)]
    walk = _walk(n, m)
    count = len(verts)
    for i in _tail_vertices(n, m):
        v = verts[i]
        prev = verts[(i - 1) % count] if walk == "ccw" else verts[(i + 1) % count]
        direction = (v[0] - prev[0], v[1] - prev[1])
        parts.append(_polygon_d(_bar(v, direction, TAIL_LENGTH[n])))
    return parts


def _scale_d(d, scale):
    """Scale every number in a path string (arc flags are integers 0/1 and stay)."""
    def repl(match):
        text = match.group(0)
        if match.group("flag") is not None:
            return text
        return _fmt(float(text) * scale)
    # Arc commands: "A rx,ry rot large sweep x,y" -- the three middle fields are
    # unscaled.  They are the only places a bare integer flag appears.
    pattern = re.compile(r"(?P<flag>(?<=\s)[01](?=\s[01]\s)|(?<=\s[01]\s)[01](?=\s))|-?\d+(?:\.\d+)?")
    out = []
    for part in d.split(" A"):
        if not out:
            out.append(pattern.sub(repl, part))
            continue
        fields = part.split(" ", 4)      # rx,ry rot large sweep rest
        radii = ",".join(_fmt(float(v) * scale) for v in fields[0].split(","))
        rest = pattern.sub(repl, fields[4]) if len(fields) > 4 else ""
        out.append(f"{radii} {fields[1]} {fields[2]} {fields[3]} {rest}")
    return " A".join(out)


def symbol_path(n, m, scale=1.0):
    d = " ".join(symbol_subpaths(n, m))
    return d if scale == 1.0 else _scale_d(d, scale)


# --- page rewriting -----------------------------------------------------------
ICON_RE = re.compile(
    r'(<svg [^>]*data-(?:legend-icon|rotation-symbol)="rotation-(\d)-(\d)"[^>]*>)'
    r'(?:<g class="generator-symbol-body" transform="(translate\([^"]+\))">'
    r'(?:(?!</svg>)[\s\S])*?</g>'
    r'|<path class="generator-symbol-core" transform="(translate\([^"]+\))" d="[^"]*"/>)'
)

PLATE_RE = re.compile(
    r'(<g class="plate-generator plate-generator--rotation[^"]*"[^>]*'
    r'data-generator-symbol="rotation-(\d)-(\d)"[^>]*>)'
    r'(?:<g transform="(translate\([^"]+\))"><g class="plate-generator-glyph-halo">'
    r'(?:(?!<g class="plate-generator )[\s\S])*?</g></g><g class="plate-generator-glyph">'
    r'(?:(?!<g class="plate-generator )[\s\S])*?</g></g></g>'
    r'|<path class="plate-generator-glyph generator-symbol-core" transform="(translate\([^"]+\))" d="[^"]*"/>)'
)


# The axial-glide half arrow (not a Tables symbol: it names which of the two
# glides along the dashed line is the generator).  The shaft is kept from the
# page, drawn solid over the dashes; the old stroked barb becomes a filled
# half arrowhead on the same side, which still reads at plate size.
NUM = r"([-\d.]+)"
GLIDE_ARROW_RE = re.compile(
    r'<path class="plate-generator-glide-arrow-halo" '
    rf'd="M{NUM},{NUM} L{NUM},{NUM}(?: M[-\d.]+,[-\d.]+ L{NUM},{NUM})?"></path>'
    r'<path class="plate-generator-glide-arrow" d="[^"]*"></path>'
    rf'(?:<path class="plate-generator-glide-head" d="M[-\d.]+,[-\d.]+ L[-\d.]+,[-\d.]+ L{NUM},{NUM} Z"></path>)?'
)
ICON_GLIDE_RE = re.compile(
    r'<path class="diagram-symbol-glide-arrow" '
    rf'd="M{NUM},{NUM} L{NUM},{NUM}(?: M[-\d.]+,[-\d.]+ L{NUM},{NUM})?"></path>'
    rf'(?:<path class="diagram-symbol-glide-head" d="M[-\d.]+,[-\d.]+ L[-\d.]+,[-\d.]+ L{NUM},{NUM} Z"></path>)?'
)
PLATE_HEAD_LENGTH = 15.0
PLATE_HEAD_WIDTH = 9.0


def _half_head(x0, y0, x1, y1, side_point, length, width):
    """Filled half arrowhead at the tip (x1, y1) of the shaft from (x0, y0),
    on the side of `side_point`; returns the path's three points."""
    ux, uy = x1 - x0, y1 - y0
    norm = math.hypot(ux, uy)
    ux, uy = ux / norm, uy / norm
    nx, ny = -uy, ux
    sx, sy = side_point
    side = 1 if (sx - x1) * nx + (sy - y1) * ny >= 0 else -1
    bx, by = x1 - ux * length, y1 - uy * length
    return (x1, y1), (bx, by), (bx + nx * width * side, by + ny * width * side)


def _fmt_head(points):
    (ax, ay), (bx, by), (cx, cy) = points
    return f"M{ax:.2f},{ay:.2f} L{bx:.2f},{by:.2f} L{cx:.2f},{cy:.2f} Z"


def _glide_arrow(match):
    x0, y0, x1, y1 = (float(match.group(i)) for i in range(1, 5))
    side_point = (float(match.group(5) or match.group(7)), float(match.group(6) or match.group(8)))
    head = _half_head(x0, y0, x1, y1, side_point, PLATE_HEAD_LENGTH, PLATE_HEAD_WIDTH)
    shaft = f"M{x0:.2f},{y0:.2f} L{x1:.2f},{y1:.2f}"
    return (f'<path class="plate-generator-glide-arrow-halo" d="{shaft}"></path>'
            f'<path class="plate-generator-glide-arrow" d="{shaft}"></path>'
            f'<path class="plate-generator-glide-head" d="{_fmt_head(head)}"></path>')


def _icon_glide_arrow(match):
    x0, y0, x1, y1 = (float(match.group(i)) for i in range(1, 5))
    side_point = (float(match.group(5) or match.group(7)), float(match.group(6) or match.group(8)))
    length = min(11.0, 0.45 * math.hypot(x1 - x0, y1 - y0))
    head = _half_head(x0, y0, x1, y1, side_point, length, 0.6 * length)
    shaft = f"M{_fmt(x0)},{_fmt(y0)} L{_fmt(x1)},{_fmt(y1)}"
    return (f'<path class="diagram-symbol-glide-arrow" d="{shaft}"></path>'
            f'<path class="diagram-symbol-glide-head" d="{_fmt_head(head)}"></path>')


def _icon_scale(translate):
    return LEGEND_SCALE if translate.replace(" ", "") == "translate(1616)" else ICON_SCALE


def rewrite(html):
    counts = {"icons": 0, "plates": 0, "glide arrows": 0}

    def icon(match):
        counts["icons"] += 1
        n, m = int(match.group(2)), int(match.group(3))
        translate = match.group(4) or match.group(5)
        d = symbol_path(n, m, _icon_scale(translate))
        return (f'{match.group(1)}<path class="generator-symbol-core" '
                f'transform="{translate}" d="{d}"/>')

    def plate(match):
        counts["plates"] += 1
        n, m = int(match.group(2)), int(match.group(3))
        translate = match.group(4) or match.group(5)
        d = symbol_path(n, m)
        return (f'{match.group(1)}<path class="plate-generator-glyph generator-symbol-core" '
                f'transform="{translate}" d="{d}"/>')

    def glide(match):
        counts["glide arrows"] += 1
        return _glide_arrow(match)

    def icon_glide(match):
        counts["glide arrows"] += 1
        return _icon_glide_arrow(match)

    html = ICON_RE.sub(icon, html)
    html = PLATE_RE.sub(plate, html)
    html = GLIDE_ARROW_RE.sub(glide, html)
    html = ICON_GLIDE_RE.sub(icon_glide, html)
    return html, counts


def sample_sheet():
    """An SVG sheet of every symbol, for eyeballing the geometry."""
    cells = [(2, 0), (2, 1), (3, 0), (3, 1), (3, 2), (4, 0), (4, 1), (4, 2), (4, 3),
             (6, 0), (6, 1), (6, 2), (6, 3), (6, 4), (6, 5)]
    step = 60
    width = step * len(cells) + 20
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 100" '
             f'width="{width * 3}" height="300" style="background:#fff">']
    for i, (n, m) in enumerate(cells):
        x = 40 + i * step
        parts.append(f'<path transform="translate({x} 40)" fill="#74213f" d="{symbol_path(n, m)}"/>')
        parts.append(f'<text x="{x}" y="85" font-family="sans-serif" font-size="12" '
                     f'text-anchor="middle">{n}<tspan font-size="8" dy="3">{m if m else ""}</tspan></text>')
    parts.append("</svg>")
    return "\n".join(parts)


def main(argv):
    if "--svg" in argv:
        print(sample_sheet())
        return 0
    html = PAGE.read_text(encoding="utf-8")
    new_html, counts = rewrite(html)
    if "--check" in argv:
        if new_html != html:
            print("docs/correspondence.html is out of date; run correspondence_symbols.py")
            return 1
        print(f"up to date: {counts['icons']} icons, {counts['plates']} plate glyphs, "
              f"{counts['glide arrows']} glide arrows")
        return 0
    PAGE.write_text(new_html, encoding="utf-8")
    print(f"rewrote {counts['icons']} icons, {counts['plates']} plate glyphs and "
          f"{counts['glide arrows']} glide arrows ({len(html)} -> {len(new_html)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
