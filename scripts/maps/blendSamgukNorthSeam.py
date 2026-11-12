"""Blend the seam left at Samguk's old northern crop line.

Raising the frontier to row 110 (openSamgukNorth.py) refilled the band
between it and the previous crop line (rows ~143-158) with fresh noise, so the
terrain changed abruptly along a straight line and the rivers stopped dead at
it. This fills that band with the land just south of the old line, mirrored
upward (water left out, so no river is mirrored into a loop), then carries
every river that reached the old line on up to the frontier.
It also mends the older crop line (from before openSamgukNorth.py) where it
cut through the Changbai highlands: the mountain block there had a ruler-
straight top edge, and three river pieces (one from the north, one along the
block's top, and the sea-linked one flowing south) stopped short of each
other. They now meet at one confluence.
Numeric terrain data only; run before the Go generator.
"""
from pathlib import Path
import io
import math
import subprocess

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
p = root / "map-generator/assets/maps/samguk/image.png"
a = np.array(Image.open(p).convert("RGBA"))
h, w = a.shape[:2]
FRONTIER = 110


def is_water(px) -> bool:
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return b > r + 30 and b > g + 10


# The old crop line, per column, from the image before the frontier was raised.
old = subprocess.check_output(
    ["git", "show", "53088ce^:map-generator/assets/maps/samguk/image.png"],
    cwd=root,
)
o = np.array(Image.open(io.BytesIO(old)).convert("RGBA"))[:, :w]
seam = np.argmax(~(o[:, :, :3] == 0).all(axis=2), axis=0).astype(int)

# 1. Land: mirror the terrain below the old line upward, skipping water.
src_img = a.copy()
for x in range(w):
    s = seam[x]
    for y in range(FRONTIER, s):
        sy = min(h - 1, s + (s - 1 - y))
        px = src_img[sy, x]
        if is_water(px):
            # Nearest land in the same source row.
            for d in range(1, 30):
                for nx in (x - d, x + d):
                    if 0 <= nx < w and not is_water(src_img[sy, nx]):
                        px = src_img[sy, nx]
                        break
                else:
                    continue
                break
        a[y, x] = px

# 2. Rivers: every run of water on the old line goes on up to the frontier,
# keeping its width and heading, with a gentle meander.
runs = []
x = 0
while x < w:
    if is_water(src_img[seam[x], x]):
        start = x
        while x < w and is_water(src_img[seam[x], x]):
            x += 1
        runs.append((start, x - 1))
    x += 1

extended = 0
for start, end in runs:
    width = end - start + 1
    if width > 12:  # a sea or lake shore, not a river
        continue
    c = (start + end) / 2
    s = int(seam[int(round(c))])
    color = src_img[s, int(round(c))].copy()
    # Heading: where the river's centre was 12 rows further south.
    below = [
        xx
        for xx in range(max(0, start - 15), min(w, end + 16))
        if is_water(src_img[min(h - 1, s + 12), xx])
    ]
    c_below = sum(below) / len(below) if below else c
    slope = max(-0.6, min(0.6, (c - c_below) / 12))
    for y in range(s - 1, FRONTIER - 1, -1):
        t = s - y
        xc = c + slope * t + 2.0 * math.sin(t / 9.0)
        for xx in range(int(round(xc - width / 2)), int(round(xc + width / 2)) + 1):
            if 0 <= xx < w:
                a[y, xx] = color
    extended += 1

# 3. The older crop line through the highlands: roughen the mountain block's
# straight top edge. Each column's edge moves up or down by smooth noise:
# up copies the first highland row upward, down copies the land above it down.
orig = subprocess.check_output(
    ["git", "show", "8baa465^:map-generator/assets/maps/samguk/image.png"],
    cwd=root,
)
og = np.array(Image.open(io.BytesIO(orig)).convert("RGBA"))[:, :w]
old_edge = np.argmax(~(og[:, :, :3] == 0).all(axis=2), axis=0).astype(int)
before3 = a.copy()
for x in range(620, 790):
    e = old_edge[x]
    if not 300 <= e <= 345:
        continue
    shift = int(round(7 * math.sin(x / 9.0) + 4 * math.sin(x / 3.1 + 1.3)))
    # Never move a river, and never copy one: water stays where it is.
    if shift < 0:  # the highlands reach further north here
        src = before3[e + 2, x]
        for y in range(e + shift, e):
            if not is_water(before3[y, x]) and not is_water(src):
                a[y, x] = src
    else:  # the lowland reaches further south here
        src = before3[e - 3, x]
        for y in range(e, e + shift):
            if not is_water(before3[y, x]) and not is_water(src):
                a[y, x] = src

# 4. One confluence for the three river pieces that stopped short there.
river = np.array([0, 0, 106, 255], dtype=a.dtype)


def paint_river(points, width):
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2
        for k in range(steps + 1):
            t = k / steps
            cx = x0 + (x1 - x0) * t
            cy = y0 + (y1 - y0) * t
            r = width / 2
            for yy in range(int(cy - r), int(cy + r) + 1):
                for xx in range(int(cx - r), int(cx + r) + 1):
                    if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                        a[yy, xx] = river


# From the north (ends at 647,304) down to the confluence (646,354), where
# the sea-linked river starts (645,356); a slight bend so it isn't a ruler.
paint_river([(648, 302), (650, 318), (647, 334), (646, 346), (645, 357)], 4)
# The river along the block's top (west end 660,347) into the confluence.
paint_river([(662, 347), (655, 350), (647, 353)], 3)

Image.fromarray(a).save(p)
print(f"Blended the old crop line; carried {extended} rivers to the frontier")
