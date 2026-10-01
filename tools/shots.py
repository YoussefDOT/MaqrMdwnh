#!/usr/bin/env python3
"""tools/shots.py — PNG screenshots (from tools/shots.mjs) → the WebPs نشرة الأخبار loads.

    python3 tools/shots.py [<png dir>] [<release>]

Each picture is capped at 1000 px wide and saved as WebP q84 under Art/News/<release>/.
The PNGs are scratch files — they never enter the repo.
"""
import os
import sys
import tempfile
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'maqr-shots')
rel = sys.argv[2] if len(sys.argv) > 2 else '1.5'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'Art', 'News', rel)
os.makedirs(out, exist_ok=True)

n = 0
for name in sorted(os.listdir(src)):
    if not name.endswith('.png'):
        continue
    im = Image.open(os.path.join(src, name)).convert('RGB')
    if im.width > 1000:
        im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
    dst = os.path.join(out, name[:-4] + '.webp')
    im.save(dst, 'WEBP', quality=84, method=6)
    n += 1
    print(f'{name} → {os.path.relpath(dst, root)}  {im.width}×{im.height}  {os.path.getsize(dst) // 1024} KB')
print(f'{n} picture(s)')
