"""Give Samguk's generated northern band real terrain heights.

The land north of the original map data (rows >= 110 that were void in the
source image) was generated with made-up heights. This script replaces its
gray height values with real elevation, sampled from a global equirectangular
heightmap and projected with the map's Mercator fit (moved by the same offset
as the northern rivers, so Baekdusan sits on Cheonji). Elevations are turned
into gray values by quantile-matching the real elevation under the original
map land to that land's gray values, so the new band uses the same height
scale as the rest of the map, with the old band's fine texture kept on top. Water, void and original land are untouched,
and the new heights fade into the old ones over a few pixels at the seam.

usage: python3 scripts/maps/realSamgukNorthTerrain.py ORIG_IMAGE HEIGHTMAP
  ORIG_IMAGE  the source image before the northern band was generated
              (git show 8baa465^:map-generator/assets/maps/samguk/image.png)
  HEIGHTMAP   a whole-globe equirectangular grayscale heightmap, e.g.
              images/HeightMap20k.png from github.com/DerMattinger/MinecraftEarthMap
              (NASA Visible Earth topography and bathymetry, 21504 x 10752)
"""

import math
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

IMAGE = "map-generator/assets/maps/samguk/image.png"
FRONTIER = 110
AX, BX = 173.01000785, -21505.08165375
AY, BY = -9411.15415533, 7902.15769746
OFFSET = (2, 50)  # same as realSamgukNorthRivers.py
SEAM = 30  # pixels over which new heights fade in
GRAY_MIN, GRAY_MAX = 140, 235  # 140 is the generator's lowest plain
DETAIL = 1.5


def lonlat(x, y):
    lon = (x - OFFSET[0] - BX) / AX
    m = (y - OFFSET[1] - BY) / AY
    lat = np.degrees(2 * np.arctan(np.exp(m)) - math.pi / 2)
    return lon, lat


def main(orig_path, dem_path):
    Image.MAX_IMAGE_PIXELS = None
    a = np.array(Image.open(IMAGE).convert("RGBA"))
    h, w = a.shape[:2]
    orig = np.array(Image.open(orig_path).convert("RGBA"))[:, :w]
    gray = a[:, :, 0].astype(float)
    r, g, b = (a[:, :, i].astype(int) for i in range(3))
    water = (b > r + 30) & (b > g + 10)
    void = a[:, :, :3].sum(axis=2) == 0
    land = ~water & ~void
    origvoid = (orig[:, :, :3] == 0).all(axis=2)
    gen = origvoid & land
    gen[:FRONTIER] = False
    orig_land = land & ~origvoid

    dem_img = Image.open(dem_path)
    dw, dh = dem_img.size
    ys, xs = np.mgrid[0:h, 0:w]
    lon, lat = lonlat(xs + 0.5, ys + 0.5)
    fx = (lon + 180) * dw / 360 - 0.5
    fy = (90 - lat) * dh / 180 - 0.5
    x0, x1 = int(fx.min()) - 8, int(fx.max()) + 9
    y0, y1 = int(fy.min()) - 8, int(fy.max()) + 9
    dem = np.array(dem_img.crop((x0, y0, x1, y1))).astype(float)
    # The heightmap is 8-bit data stored as 16-bit, so lowlands come in
    # terraces; smooth them out.
    dem = ndimage.gaussian_filter(dem, 2)
    elev = ndimage.map_coordinates(dem, [fy - y0, fx - x0], order=1, mode="nearest")

    # Quantile-match real elevation to the gray scale of the original land.
    q = np.linspace(0, 100, 401)
    src = np.percentile(elev[orig_land], q)
    dst = np.percentile(gray[orig_land], q)
    src, idx = np.unique(src, return_index=True)
    dst = dst[idx]
    new = np.interp(elev, src, dst)
    # Land lower than any original land (the Liao plain) keeps sloping down
    # instead of flattening at the lowest gray.
    k = min(20, len(src) - 1)
    slope = (dst[k] - dst[0]) / max(src[k] - src[0], 1e-6)
    new = np.where(elev < src[0], dst[0] + (elev - src[0]) * slope, new)
    # The heightmap is about 3 pixels per sample here, smoother than the
    # original land, so keep the old band's fine texture on top of it.
    # Blur over land only, so rivers and the frontier leave no halo.
    lf = land.astype(float)
    smooth = ndimage.gaussian_filter(gray * lf, 3) / np.maximum(
        ndimage.gaussian_filter(lf, 3), 1e-6
    )
    detail = np.where(land, gray - smooth, 0)
    new = np.clip(new + DETAIL * detail, GRAY_MIN, GRAY_MAX)

    # Fade in from the original land.
    dist = ndimage.distance_transform_edt(~orig_land)
    t = np.clip(dist / SEAM, 0, 1)
    out = gray * (1 - t) + new * t
    v = np.round(out[gen]).astype(np.uint8)
    for c in range(3):
        a[:, :, c][gen] = v
    print("repainted px:", int(gen.sum()))
    Image.fromarray(a).save(IMAGE)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
