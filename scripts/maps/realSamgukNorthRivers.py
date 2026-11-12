"""Redraw the rivers of Samguk's northern band from real geography.

The northern band (rows >= 110) mixes original map data with land that
blendSamgukNorthSeam.py generated, and the rivers there were drawn by hand
and wander from their real courses. This script removes that water and draws
real rivers from Natural Earth's 10m river centerlines, projected with the
map's Mercator fit:

- Erdao and Di'er Songhua (upper Songhua) shifted by the same offset as the
  map's Yalu, so the basin sits where the map's Korea expects it, with the
  Erdao rising at Cheonji.
- The Tumen's northern bend, from where the map's Tumen leaves the border
  stretch to where its lower course reaches the coast, with the real shape
  warped onto those two points and squeezed below the northern frontier.
- Cheonji (Heaven Lake) on Baekdusan, where the Yalu, Tumen and Songhua rise.

usage: python3 scripts/maps/realSamgukNorthRivers.py ORIG_IMAGE RIVERS_GEOJSON
  ORIG_IMAGE      the source image before the northern band was generated
                  (git show 8baa465^:map-generator/assets/maps/samguk/image.png)
  RIVERS_GEOJSON  ne_10m_rivers_lake_centerlines.geojson
"""

import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

IMAGE = "map-generator/assets/maps/samguk/image.png"
FRONTIER = 110  # first passable row
WATER = (0, 0, 106, 255)
WIDTH = 3
# Mercator fit of the map, from 24 city positions.
AX, BX = 173.01000785, -21505.08165375
AY, BY = -9411.15415533, 7902.15769746
# The map's Yalu sits this far from the projected real Yalu.
OFFSET = (2, 50)
# Stretches whose water is replaced: (x0, y0, x1, y1), image pixels.
REDRAW_BOXES = [
    (440, FRONTIER, 700, 330),  # upper Songhua basin west of Baekdusan
    (895, FRONTIER, 1088, 237),  # the Tumen's northern bend
]
# Map points the real Tumen bend is pinned to: where the map's Tumen leaves
# the border stretch, and where its lower course heads for the coast.
TUMEN_FROM = (907, 240)
TUMEN_TO = (1046, 238)
TUMEN_TOP = FRONTIER + 6  # the bend's northernmost row
# Cheonji on Baekdusan (lon, lat).
CHEONJI = (128.06, 42.005)


def proj(lon, lat):
    m = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return AX * lon + BX, AY * m + BY


def shifted(p):
    x, y = proj(*p)
    return x + OFFSET[0], y + OFFSET[1]


def nearest(pts, q):
    return min(range(len(pts)), key=lambda i: math.dist(pts[i], q))


def warp_tumen(line):
    """Real Tumen points between the two pins, warped onto them."""
    pts = [proj(*p) for p in line]
    # Pin to the real points closest to the pins' unshifted positions.
    i = nearest(pts, (TUMEN_FROM[0] - 9, TUMEN_FROM[1] - 42))
    j = nearest(pts, (TUMEN_TO[0] + 34, TUMEN_TO[1] - 64))
    if i > j:
        i, j = j, i
        pts = pts[::-1]
        i, j = len(pts) - 1 - j, len(pts) - 1 - i
    seg = pts[i : j + 1]
    d0 = (TUMEN_FROM[0] - seg[0][0], TUMEN_FROM[1] - seg[0][1])
    d1 = (TUMEN_TO[0] - seg[-1][0], TUMEN_TO[1] - seg[-1][1])
    cum = [0.0]
    for p, q in zip(seg, seg[1:]):
        cum.append(cum[-1] + math.dist(p, q))
    out = []
    for p, c in zip(seg, cum):
        t = c / cum[-1]
        out.append((p[0] + d0[0] + (d1[0] - d0[0]) * t, p[1] + d0[1] + (d1[1] - d0[1]) * t))
    # Squeeze the bend below the frontier: map [top, knee] onto [TUMEN_TOP, knee].
    top = min(y for _, y in out)
    knee = min(TUMEN_FROM[1], TUMEN_TO[1]) - 20
    if top < TUMEN_TOP:
        out = [
            (x, TUMEN_TOP + (y - top) * (knee - TUMEN_TOP) / (knee - top) if y < knee else y)
            for x, y in out
        ]
    return out


def lines_of(feature):
    geom = feature["geometry"]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return [geom["coordinates"]]


def main(orig_path, rivers_path):
    a = np.array(Image.open(IMAGE).convert("RGBA"))
    h, w = a.shape[:2]
    orig = np.array(Image.open(orig_path).convert("RGBA"))[:, :w]
    void = a[:, :, :3].sum(axis=2) == 0
    redraw = (orig[:, :, :3] == 0).all(axis=2) & ~void
    for x0, y0, x1, y1 in REDRAW_BOXES:
        redraw[y0:y1, x0:x1] = True
    redraw[:FRONTIER] = False

    r, g, b = (a[:, :, i].astype(int) for i in range(3))
    water = (b > r + 30) & (b > g + 10)
    # Sea and lakes: water too wide to be a river, and the rim around it.
    wide = ndimage.binary_opening(water, iterations=3)
    labels, n = ndimage.label(wide)
    sizes = ndimage.sum(wide, labels, range(1, n + 1))
    wide = np.isin(labels, 1 + np.flatnonzero(sizes >= 150))
    sea = ndimage.binary_dilation(wide, iterations=3) & water
    # Old river water plus its bluish anti-aliased rim.
    old = ndimage.binary_dilation(water & ~sea, iterations=1) & redraw & ~sea & ~void
    keep = ~water & ~old & ~void
    _, (iy, ix) = ndimage.distance_transform_edt(~keep, return_indices=True)
    a[old] = a[iy[old], ix[old]]
    print("removed river px:", int(old.sum()))

    river = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(river)
    cx, cy = shifted(CHEONJI)
    for f in json.load(open(rivers_path))["features"]:
        name = f["properties"].get("name_en")
        for line in lines_of(f):
            if name == "Tumen":
                if not any(
                    math.dist(proj(*p), (TUMEN_FROM[0] - 9, TUMEN_FROM[1] - 42)) < 30
                    for p in line
                ):
                    continue
                d.line(warp_tumen(line), fill=255, width=WIDTH, joint="curve")
            elif name in ("Erdao", "Di’er Songhua"):
                pts = [shifted(p) for p in line]
                if name == "Erdao":
                    # Natural Earth stops short of the crater; run it up to Cheonji.
                    src = pts[0] if pts[0][1] > pts[-1][1] else pts[-1]
                    d.line([src, (cx, cy)], fill=255, width=WIDTH)
                d.line(pts, fill=255, width=WIDTH, joint="curve")
    d.ellipse([cx - 4, cy - 3, cx + 4, cy + 3], fill=255)
    mask = np.array(river) > 0
    lake = np.zeros_like(mask)
    lake[int(cy) - 4 : int(cy) + 5, int(cx) - 5 : int(cx) + 6] = True
    # New rivers may run a little past the redrawn stretch to meet the old ones.
    reach = ndimage.binary_dilation(redraw, iterations=8)
    paint = mask & (reach | lake) & ~void & ~sea
    paint[:FRONTIER] = False
    a[paint] = WATER
    print("river px:", int(paint.sum()), "cheonji at", round(cx), round(cy))
    Image.fromarray(a).save(IMAGE)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
