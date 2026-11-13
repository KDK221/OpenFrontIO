"""Add real rivers to a scenario map's source image.

Rivers come from scripts/maps/realRivers.json, per map:

- naturalEarth: rivers from Natural Earth's 10m river centerlines, projected
  with the map's fitted projection. Stretches that already run within a few
  pixels of the map's own water are skipped, so existing rivers are not
  doubled, and each drawn stretch is joined at its lower end to the water
  it meets there.
- traced: rivers missing from Natural Earth, given as towns along their
  course. Each leg between towns is routed along the map's own valleys (a
  least-cost path over its heights and drainage), and the mouth is joined to
  the nearest water.

New water never covers a nation's spawn point, and a river that would
cut a piece of land off from the rest (so it could only be reached by
boat) is drawn without its join, or not at all.

usage: python3 scripts/maps/realRivers.py MAP RIVERS_GEOJSON
  MAP             samguk | sengoku | warringstates
  RIVERS_GEOJSON  ne_10m_rivers_lake_centerlines.geojson
"""

import heapq
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.graph import route_through_array

WATER = (0, 0, 106, 255)
NEAR_EXISTING = 7  # px: closer than this to existing water counts as drawn
JOIN_REACH = 30  # px: how far a river end may reach for the water it joins


def terms(lon, lat, deg):
    lon = np.asarray(lon, float) - 110
    lat = np.asarray(lat, float) - 35
    t = [np.ones_like(lon)]
    for d in range(1, deg + 1):
        for i in range(d + 1):
            t.append(lon ** (d - i) * lat**i)
    return np.stack(t, -1)


def project(proj, lon, lat):
    t = terms(lon, lat, proj["deg"])
    return t @ np.array(proj["x"]), t @ np.array(proj["y"])


def drainage_area(height, water, valid):
    """Upstream area of each pixel, by priority-flood from the water."""
    h, w = height.shape
    flat = height.ravel()
    ok = valid.ravel() & ~water.ravel()
    parent = np.full(h * w, -1, np.int64)
    seen = water.ravel() | ~valid.ravel()
    heap = []
    edge = ndimage.binary_dilation(water, np.ones((3, 3))) & valid & ~water
    for i in np.flatnonzero(edge.ravel()):
        heap.append((flat[i], int(i)))
        seen[i] = True
    heapq.heapify(heap)
    order = []
    steps = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
    while heap:
        hv, i = heapq.heappop(heap)
        order.append(i)
        y, x = divmod(i, w)
        for dy, dx in steps:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w:
                j = yy * w + xx
                if not seen[j] and ok[j]:
                    seen[j] = True
                    parent[j] = i
                    heapq.heappush(heap, (max(flat[j], hv), j))
    area = np.ones(h * w)
    for i in reversed(order):
        if parent[i] >= 0:
            area[parent[i]] += area[i]
    return area.reshape(h, w)


def nearest_water_path(cost, water, start, reach=JOIN_REACH):
    """Least-cost path from start to the closest water pixel within reach."""
    y, x = start
    h, w = water.shape
    y0, y1 = max(0, y - reach), min(h, y + reach + 1)
    x0, x1 = max(0, x - reach), min(w, x + reach + 1)
    sub = water[y0:y1, x0:x1]
    if not sub.any():
        return []
    d = ndimage.distance_transform_edt(~sub, return_indices=True)[1]
    ty, tx = d[0][y - y0, x - x0] + y0, d[1][y - y0, x - x0] + x0
    path, _ = route_through_array(cost, (y, x), (ty, tx), fully_connected=True, geometric=True)
    return path


def main(name, rivers_path):
    cfg = json.load(open("scripts/maps/realRivers.json"))[name]
    proj = cfg["projection"]
    image_path = f"map-generator/assets/maps/{name}/image.png"
    info = json.load(open(f"map-generator/assets/maps/{name}/info.json"))
    a = np.array(Image.open(image_path).convert("RGBA"))
    h, w = a.shape[:2]
    water = (a[:, :, 2] == 106) | (a[:, :, 3] < 20)
    void = (a[:, :, :3].sum(axis=2) == 0) & (a[:, :, 3] >= 20)
    land = ~water & ~void
    height = np.where(land, a[:, :, 2], 140).astype(float)

    lines = []  # polylines in pixel space, drawn at the end

    # Natural Earth rivers.
    near = ndimage.binary_dilation(water, iterations=NEAR_EXISTING)
    wanted = set(cfg["naturalEarth"])
    for f in json.load(open(rivers_path))["features"]:
        if f["properties"].get("name_en") not in wanted:
            continue
        geom = f["geometry"]
        parts = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        for part in parts:
            p = np.array(part)
            x, y = project(proj, p[:, 0], p[:, 1])
            # Densify so every step is under a pixel.
            seg = np.hypot(np.diff(x), np.diff(y))
            n = np.maximum(1, np.ceil(seg)).astype(int)
            xs = np.concatenate([np.linspace(x[i], x[i + 1], n[i], endpoint=False) for i in range(len(seg))] + [x[-1:]])
            ys = np.concatenate([np.linspace(y[i], y[i + 1], n[i], endpoint=False) for i in range(len(seg))] + [y[-1:]])
            xi, yi = np.round(xs).astype(int), np.round(ys).astype(int)
            inside = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
            keep = np.zeros(len(xi), bool)
            keep[inside] = land[yi[inside], xi[inside]] & ~near[yi[inside], xi[inside]]
            # Split into runs of kept points.
            run = []
            for k in range(len(xi)):
                if keep[k]:
                    run.append((xs[k], ys[k]))
                elif run:
                    lines.append(("ne", run))
                    run = []
            if run:
                lines.append(("ne", run))

    # Traced rivers.
    cost = None
    if cfg["traced"]:
        smooth = ndimage.gaussian_filter(height, 2)
        area = drainage_area(smooth, water, ~void)
        valley = 1 - np.clip(np.log1p(area) / math.log1p(20000), 0, 1)
        cost = 1 + 0.08 * (smooth - 140) + 8 * valley
        cost[water] = 1
        cost[void] = 1e9
        for river, towns in cfg["traced"].items():
            x, y = project(proj, [t[0] for t in towns], [t[1] for t in towns])
            pts = [(int(round(yy)), int(round(xx))) for xx, yy in zip(x, y)]
            pts = [(min(max(py, 0), h - 1), min(max(px, 0), w - 1)) for py, px in pts]
            path = [pts[0]]
            for p0, p1 in zip(pts, pts[1:]):
                leg, _ = route_through_array(cost, p0, p1, fully_connected=True, geometric=True)
                path.extend(leg[1:])
            # Stop where the river first reaches water; else run on to it.
            for k, (py, px) in enumerate(path):
                if water[py, px]:
                    path = path[: k + 1]
                    break
            else:
                path.extend(nearest_water_path(cost, water, path[-1])[1:])
            lines.append(("traced", [(px, py) for py, px in path]))
            print(f"{river}: {len(path)} px")

    # Join Natural Earth stretches to the water they end next to.
    if cost is None:
        cost = 1 + 0.08 * (height - 140)
        cost[water] = 1
        cost[void] = 1e9
    # Each river as (body, join): join is the path to the water it meets.
    rivers = []
    for kind, pts in lines:
        if kind == "traced":
            rivers.append((pts, []))
            continue
        if len(pts) < 4:
            continue
        # Join only the downstream (lower) end, so a stretch never links
        # two waters by itself.
        hs = [height[int(round(y)), int(round(x))] for x, y in (pts[0], pts[-1])]
        if hs[0] < hs[1]:
            pts = pts[::-1]
        ex_i, ey_i = int(round(pts[-1][0])), int(round(pts[-1][1]))
        tail = nearest_water_path(cost, water, (ey_i, ex_i), cfg.get("joinReach", JOIN_REACH))
        rivers.append((pts, [(px, py) for py, px in tail]))

    protect = np.zeros((h, w), bool)
    for nation in info["nations"]:
        cx, cy = nation["coordinates"]
        protect[max(0, cy - 3) : cy + 4, max(0, cx - 3) : cx + 4] = True
    protect[: cfg["minRow"]] = True

    def stroke(pts):
        img = Image.new("L", (w, h), 0)
        if len(pts) >= 2:
            ImageDraw.Draw(img).line(pts, fill=255, width=cfg["width"], joint="curve")
        return (np.array(img) > 0) & land & ~protect

    # Land pieces big enough to matter; a river may not add to them.
    big = 100
    st = np.ones((3, 3))

    def pieces(mask):
        lab, n = ndimage.label(mask, st)
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        return int((sizes > big).sum())

    painted = np.zeros((h, w), bool)
    count = pieces(land)
    for body, tail in rivers:
        for pts in (body + tail, body):
            m = stroke(pts)
            if pieces(land & ~(painted | m)) <= count:
                painted |= m
                break
        else:
            x, y = body[len(body) // 2]
            print(f"  skipped a river near ({x:.0f}, {y:.0f}): it would cut land off")
    # Slivers of land newly walled in between rivers become water too.
    lab0, _ = ndimage.label(land, st)
    size0 = ndimage.sum(land, lab0, range(lab0.max() + 1))
    lab1, n1 = ndimage.label(land & ~painted, st)
    size1 = ndimage.sum(land, lab1, range(n1 + 1))
    sliver = (lab1 > 0) & (size1[lab1] <= big) & (size0[lab0] > big)
    painted |= sliver
    a[painted] = WATER
    print(f"{name}: {int(painted.sum())} river px, {int(sliver.sum())} px of slivers filled")
    Image.fromarray(a).save(image_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
