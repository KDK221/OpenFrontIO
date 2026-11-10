"""Restore the original map width and a straight northern frontier.
Numeric terrain data only: preserve existing terrain south of row 165.
Run this before the Go map generator.
"""
from pathlib import Path
import json
import runpy
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
folder = root / "map-generator/assets/maps/samguk"
a = np.array(Image.open(folder / "image.png").convert("RGBA"))[:, :1088].copy()
Image.fromarray(a).save(folder / "image.png")
runpy.run_path(str(root / "scripts/maps/openSamgukNorth.py"))
out = np.array(Image.open(folder / "image.png").convert("RGBA"))
out[:110] = [0, 0, 0, 255]
# Preserve the complete peninsula and all existing coastal terrain.
out[165:] = a[165:]
Image.fromarray(out).save(folder / "image.png")
info = json.loads((folder / "info.json").read_text())
info.pop("layers", None)
(folder / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n")
for p in [folder / "island-labels.png", root / "resources/maps/samguk/island-labels.webp", root / "resources/maps/samguk/island-labels.4x.webp"]:
    p.unlink(missing_ok=True)
print("Restored 1088px width; straight frontier at y=110; island labels removed.")
