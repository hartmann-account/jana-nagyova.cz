"""Paper-theatre figure from a portrait photo.

Removes the background (rembg, BiRefNet portrait model) and builds the outline of a
cardboard cut-out: the person's mask grown by a white card border, traced and
simplified to a polygon. Writes
  <name>-1280.webp / <name>-768.webp   photo with alpha (person only)
  <name>-card.json                     card outline, coordinates 0..1, y up
used by src/scene.js.

Setup: python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" onnxruntime pillow numpy scipy scikit-image
Usage: python scripts/figure.py <source photo> <output dir> <name> [--crop-bottom=PX]
"""
import json
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage
from skimage import measure

args = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC, OUT, NAME = args[0], args[1], args[2]
CROP = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--crop-bottom=')), 0)

src = Image.open(SRC).convert('RGB')
if CROP:
    src = src.crop((0, 0, src.width, src.height - CROP))
W, H = src.size

mask = np.asarray(remove(src, session=new_session('birefnet-portrait'), only_mask=True), dtype=np.float32) / 255.0
solid = mask > 0.5
# drop small specks, keep the person
lab, n = ndimage.label(solid)
if n > 1:
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    solid = lab == (1 + int(np.argmax(sizes)))
    mask = mask * ndimage.binary_dilation(solid, iterations=3)

# card: the silhouette grown by a border and rounded off, like scissors would cut it
border = max(4, round(H * 0.011))
card = ndimage.binary_dilation(solid, structure=np.ones((3, 3)), iterations=border)
card = ndimage.gaussian_filter(card.astype(np.float32), sigma=border * 0.6) > 0.5
card = ndimage.binary_fill_holes(card)

ys, xs = np.nonzero(card)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
rgba = np.dstack([np.asarray(src), (np.clip(mask, 0, 1) * 255).astype(np.uint8)])[y0:y1, x0:x1]
card = card[y0:y1, x0:x1]
h, w = card.shape

# outline polygon in 0..1 with y up; traced on a padded copy so edges at the frame close
pad = np.pad(card, 2)
contour = max(measure.find_contours(pad.astype(np.float32), 0.5), key=len) - 2
poly = measure.approximate_polygon(contour, tolerance=h * 0.0016)
pts = [[round(float(c) / w, 5), round(1 - float(r) / h, 5)] for r, c in poly]
if len(pts) > 1 and pts[0] == pts[-1]:
    pts.pop()

img = Image.fromarray(rgba, 'RGBA')
for th in (1280, 768):
    tw = round(w * th / h)
    img.resize((tw, th), Image.LANCZOS).save(f'{OUT}/{NAME}-{th}.webp', 'WEBP', quality=86, method=6, exact=False)
with open(f'{OUT}/{NAME}-card.json', 'w') as f:
    json.dump({'aspect': round(w / h, 5), 'outline': pts}, f, separators=(',', ':'))
print(NAME, 'size', (w, h), 'outline points', len(pts))
