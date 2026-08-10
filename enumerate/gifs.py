"""Render looping GIFs of film groups, mirroring docs/js/renderer.js.

Usage: gifs.py <catalog.json> <group-id> <out.gif> [--size 480] [--frames 48]
Specs use the same format as the web renderer: basis (cartesian), ops list
(M lattice-coords, v lattice-coords, s, tau), base point, cell size.
"""

import json
import math
import sys

from PIL import Image, ImageDraw

SS = 4  # supersampling factor

BODY = (59, 110, 165)
BEAK = (224, 145, 60)
ORBIT = (135, 135, 155)
TAIL = (192, 57, 43)
BG = (250, 249, 246)


def bezier(p0, p1, p2, p3, steps=16):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def motif_paths(r):
    """Body polygon + beak triangle in motif-local coordinates (radius r)."""
    body = []
    body += bezier((-0.15 * r, -0.5 * r), (0.65 * r, -0.55 * r),
                   (0.55 * r, 0.28 * r), (0.05 * r, 0.42 * r))
    body += bezier((0.05 * r, 0.42 * r), (-0.28 * r, 0.5 * r),
                   (-0.42 * r, 0.12 * r), (-0.15 * r, -0.5 * r))
    beak = [(-0.15 * r, -0.5 * r), (0.1 * r, -0.85 * r), (0.22 * r, -0.45 * r)]
    return body, beak


def draw_motif(draw, cx, cy, T, theta, r):
    """T = 2x2 pixel transform matrix applied to motif-local coords."""
    def xf(p):
        x, y = p
        return (cx + T[0][0] * x + T[0][1] * y, cy + T[1][0] * x + T[1][1] * y)

    body, beak = motif_paths(r)
    draw.polygon([xf(p) for p in body], fill=BODY)
    draw.polygon([xf(p) for p in beak], fill=BEAK)

    orbit_r = 0.68 * r
    ang = -2 * math.pi * theta
    # orbit ring (thin polygon path)
    ring = [xf((orbit_r * math.cos(2 * math.pi * i / 48),
                orbit_r * math.sin(2 * math.pi * i / 48))) for i in range(49)]
    draw.line(ring, fill=ORBIT, width=max(1, int(0.04 * r * 0)) or 1)
    # trailing tail arc
    tail = [xf((orbit_r * math.cos(ang + a), orbit_r * math.sin(ang + a)))
            for a in [0.12 + k * (0.73 / 12) for k in range(13)]]
    draw.line(tail, fill=TAIL, width=max(2, int(0.09 * r)))
    # satellite
    sx, sy = xf((orbit_r * math.cos(ang), orbit_r * math.sin(ang)))
    sr = 0.13 * r * _scale_of(T)
    draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=TAIL)


def _scale_of(T):
    return math.sqrt(abs(T[0][0] * T[1][1] - T[0][1] * T[1][0]))


def render_frame(spec, t, size, cell):
    W = size * SS
    img = Image.new("RGB", (W, W), BG)
    draw = ImageDraw.Draw(img)
    B = spec["basis"]
    s = cell * SS
    b1 = (B[0][0] * s, -B[0][1] * s)
    b2 = (B[1][0] * s, -B[1][1] * s)
    l1 = math.hypot(*b1)
    l2 = math.hypot(*b2)
    r = 0.30 * min(l1, l2) * spec.get("motifScale", 1)
    base = spec.get("base", [0.31, 0.17])
    cx0, cy0 = W / 2, W / 2

    # lattice window
    det = b1[0] * b2[1] - b2[0] * b1[1]
    inv = ((b2[1] / det, -b2[0] / det), (-b1[1] / det, b1[0] / det))
    m1s, m2s = [], []
    for px, py in [(-W / 2, -W / 2), (W / 2, -W / 2), (-W / 2, W / 2), (W / 2, W / 2)]:
        m1s.append(inv[0][0] * px + inv[0][1] * py)
        m2s.append(inv[1][0] * px + inv[1][1] * py)
    pad = 1.6
    m1r = range(math.floor(min(m1s) - pad), math.ceil(max(m1s) + pad) + 1)
    m2r = range(math.floor(min(m2s) - pad), math.ceil(max(m2s) + pad) + 1)

    Bpix = ((b1[0], b2[0]), (b1[1], b2[1]))
    Binv = inv
    for op in spec["ops"]:
        M = op["M"]
        # pixel transform of M: Bpix * M * Bpix^{-1}
        MB = ((Bpix[0][0] * M[0][0] + Bpix[0][1] * M[1][0],
               Bpix[0][0] * M[0][1] + Bpix[0][1] * M[1][1]),
              (Bpix[1][0] * M[0][0] + Bpix[1][1] * M[1][0],
               Bpix[1][0] * M[0][1] + Bpix[1][1] * M[1][1]))
        T = ((MB[0][0] * Binv[0][0] + MB[0][1] * Binv[1][0],
              MB[0][0] * Binv[0][1] + MB[0][1] * Binv[1][1]),
             (MB[1][0] * Binv[0][0] + MB[1][1] * Binv[1][0],
              MB[1][0] * Binv[0][1] + MB[1][1] * Binv[1][1]))
        theta = op["s"] * (t - op["tau"])
        for m1 in m1r:
            for m2 in m2r:
                lx = M[0][0] * base[0] + M[0][1] * base[1] + op["v"][0] + m1
                ly = M[1][0] * base[0] + M[1][1] * base[1] + op["v"][1] + m2
                px = lx * b1[0] + ly * b2[0]
                py = lx * b1[1] + ly * b2[1]
                if abs(px) > W / 2 + 3 * r or abs(py) > W / 2 + 3 * r:
                    continue
                draw_motif(draw, cx0 + px, cy0 + py, T, theta, r)
    return img.resize((size, size), Image.LANCZOS)


def render_gif(spec, out_path, size=480, frames=48, cell=110, seconds=4.0):
    imgs = [render_frame(spec, i / frames, size, cell) for i in range(frames)]
    imgs[0].save(out_path, save_all=True, append_images=imgs[1:],
                 duration=int(1000 * seconds / frames), loop=0, optimize=True)
    return out_path


if __name__ == "__main__":
    catalog_path, gid, out = sys.argv[1], sys.argv[2], sys.argv[3]
    size = 480
    with open(catalog_path) as f:
        catalog = json.load(f)
    entry = next(e for e in catalog["groups"] if e["id"] == gid)
    render_gif(entry["render"], out, size=size)
    print("wrote", out)
