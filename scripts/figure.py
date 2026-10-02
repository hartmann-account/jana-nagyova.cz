"""Cut-out and depth map for the 3D film set figure.

Removes the background (rembg, BiRefNet portrait model) and estimates a relative
depth map (Depth Anything V2 small, ONNX). Writes <name>-1280.webp / <name>-768.webp
(RGBA) and <name>-depth.png, used by src/scene.js.

Setup: python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" onnxruntime pillow numpy scipy huggingface_hub
"""
import sys, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
from rembg import remove, new_session
from huggingface_hub import hf_hub_download
from scipy import ndimage

# usage: python scripts/figure.py <source photo> <output dir> [name] [--fade]
args = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC, OUT = args[0], args[1]
NAME = args[2] if len(args) > 2 else 'jana-02'
FADE = '--fade' in sys.argv  # soft bottom edge; off when the portrait sits on the frame edge
CROP = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--crop-bottom=')), 0)  # px to cut off below
src = Image.open(SRC).convert('RGB')
if CROP: src = src.crop((0, 0, src.width, src.height - CROP))
W, H = src.size
print('src', src.size)

# 1) background removal (BiRefNet portrait model, MIT licence)
sess = new_session('birefnet-portrait')
cut = remove(src, session=sess, only_mask=True)       # L mask
mask = np.asarray(cut, dtype=np.float32) / 255.0
print('mask coverage', round(float((mask > 0.5).mean()), 3))

# 2) depth (Depth Anything V2 small, Apache-2.0, ONNX)
p = hf_hub_download('onnx-community/depth-anything-v2-small', 'onnx/model.onnx')
so = ort.InferenceSession(p, providers=['CPUExecutionProvider'])
inp = so.get_inputs()[0].name
th = 518; tw = int(round(W * th / H / 14)) * 14
x = np.asarray(src.resize((tw, th), Image.BICUBIC), dtype=np.float32) / 255.0
x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
x = x.transpose(2, 0, 1)[None].astype(np.float32)
d = so.run(None, {inp: x})[0][0]
d = np.asarray(Image.fromarray(d.astype(np.float32)).resize((W, H), Image.BICUBIC))
print('depth range', float(d.min()), float(d.max()))

# normalise inside the person, fill the background with the nearest edge value
m = mask > 0.5
lo, hi = np.percentile(d[m], 2), np.percentile(d[m], 99.5)
dn = np.clip((d - lo) / (hi - lo), 0, 1)
_, (iy, ix) = ndimage.distance_transform_edt(~m, return_indices=True)
dn = dn[iy, ix]
# gentle compression so the relief stays plausible from a moving camera
dn = dn ** 0.85
dn = ndimage.gaussian_filter(dn, sigma=W / 400)

# bottom fade: the photo ends at the thighs
yy = np.linspace(0, 1, H)[:, None]
fade = np.clip((1.0 - yy) / 0.07, 0, 1) if FADE else np.ones_like(yy)
alpha = np.clip(mask * fade, 0, 1)

rgba = np.dstack([np.asarray(src), (alpha * 255).astype(np.uint8)])
img = Image.fromarray(rgba, 'RGBA')
bbox = img.getbbox()
img = img.crop(bbox)
dimg = Image.fromarray((dn * 255).astype(np.uint8), 'L').crop(bbox)
print('bbox', bbox, img.size)
for h in (1280, 768):
    w = round(img.width * h / img.height)
    img.resize((w, h), Image.LANCZOS).save(f'{OUT}/{NAME}-{h}.webp', 'WEBP', quality=86, method=6, exact=False)
dh = 640; dw = round(dimg.width * dh / dimg.height)
dimg.resize((dw, dh), Image.LANCZOS).save(f'{OUT}/{NAME}-depth.png', optimize=True)
print('done')
