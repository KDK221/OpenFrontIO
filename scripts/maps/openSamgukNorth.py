"""Open the numeric Samguk terrain mask for two northern scenario factions.

image.png is generator input data (black=void, blue=water, gray=height), not
an illustration. Only void inside the northern frontier is replaced; existing
land, coasts, and rivers stay byte-for-byte intact. Run before the Go generator.
"""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
p = root / 'map-generator/assets/maps/samguk/image.png'
a = np.array(Image.open(p).convert('RGBA'))
h, w = a.shape[:2]
y, x = np.mgrid[:h, :w]
# Leave an irregular northern edge; fill the formerly inaccessible continental
# region only. This is a gameplay frontier, not a historical territory claim.
border = np.interp(x, [0,110,200,320,470,650,760,890,1000,1088],
                   [145,142,150,154,160,160,150,150,146,148])
mask = (a[:,:,:3] == 0).all(axis=2) & (y >= border) & (y < 850) & (x < 1088)
rng = np.random.default_rng(698423)
height = np.full((h,w), 157.0)
for grid, weight in [((12,8),22), ((40,24),12), ((120,70),5)]:
    noise = rng.uniform(-1,1,grid).astype(np.float32)
    field = np.asarray(Image.fromarray(noise).resize((w,h), Image.Resampling.BICUBIC))
    height += weight * field
height += 10*np.exp(-((x-490)/100)**2)
height = height.clip(145,190).astype(np.uint8)
for c in range(3):
    a[:,:,c][mask] = height[mask]
a[:,:,3][mask] = 255
Image.fromarray(a).save(p)
print(f'Opened {mask.sum()} terrain cells')
