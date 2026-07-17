#!/usr/bin/env python3
"""
Rebuild Art/Lemo/Sheets/*.webp from the master spritesheets in this folder.

    python3 Art/Lemo/slice.py

The masters are ~197 MB of 2048x2048 cells (gitignored). This bakes them down to
~2.4 MB of game-ready sheets, and bakes the lighting in while it's at it.

Why each step exists
--------------------
* PER-ANIMATION CROP. Every sheet gets its own tight alpha box rather than one
  shared box. Play needs the arms-out width; Idle doesn't, and padding Idle out
  to Play's width would waste a third of the decoded pixels at runtime. The boxes
  are all measured in the SAME source-cell space, so the frames still line up.

* ALPHA THRESHOLD. The masters carry a stray alpha<=40 dot at the far right of
  every cell. Measuring the boxes above that threshold drops it; measuring at
  alpha>0 would pad every frame with ~35% dead width.

* LIT FROM DIRECTLY ABOVE. The rim sits on top-facing edges only. Lemo mirrors
  horizontally when he walks left, and a top rim survives that mirror unchanged --
  a top-LEFT rim would flip to top-right and read as the light teleporting.

* BAKED, NOT LIVE. Doing rim + shading per frame on canvas means an offscreen
  pass every frame. Baking is free at runtime and consistent across frames.

The numbers printed at the end (frame size + box) are mirrored by LEMO_ANIMS in
game.js. Re-run this and you must update those.
"""
import os, json
from PIL import Image, ImageChops, ImageFilter

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))

CELL = 2048          # master cell size
TH   = 48            # alpha threshold for box measurement (drops the stray dot)
PAD  = 4             # source px of breathing room around each box
COLS = 4             # output sheet columns
RES  = 0.20          # source-cell px -> sheet px

# Lemo's body extent in source-cell px, used to anchor the shading gradient so it
# lands identically across animations with different crop boxes.
BODY_TOP, BODY_FEET = 370, 1767

SHADE_DROP = 0.12    # brightness at the feet = 1.0 - this (top stays 1.0)
RIM_SHIFT  = 3       # px (sheet space) the alpha is pushed down to carve the top edge
RIM_BLUR   = 1.0
RIM_GAIN   = 0.45    # higher reads as a white sticker outline, not a rim
RIM_COLOR  = (255, 248, 235)   # soft warm white

SHEETS = [("Sleeping.png", "Sleeping", 40), ("Wake Up.png", "WakeUp", 27),
          ("Idle.png", "Idle", 24), ("Walk.png", "Walk", 60), ("Play.png", "Play", 52)]


def measure(path, n):
    """Tight union box across every frame, above the alpha threshold."""
    im = Image.open(path)
    scols = im.size[0] // CELL
    a = im.getchannel("A").point(lambda v: 255 if v > TH else 0)
    u = None
    for i in range(n):
        c, r = i % scols, i // scols
        bb = a.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL)).getbbox()
        if bb:
            u = bb if u is None else (min(u[0], bb[0]), min(u[1], bb[1]),
                                      max(u[2], bb[2]), max(u[3], bb[3]))
    im.close()
    return (max(0, u[0] - PAD), max(0, u[1] - PAD),
            min(CELL, u[2] + PAD), min(CELL, u[3] + PAD))


def shade_gradient(fw, fh, by0, by1):
    """Vertical multiply ramp, keyed to source-cell y so every animation matches."""
    g = Image.new("L", (fw, fh))
    px = g.load()
    for y in range(fh):
        cell_y = by0 + (y + 0.5) * (by1 - by0) / fh
        t = min(1.0, max(0.0, (cell_y - BODY_TOP) / (BODY_FEET - BODY_TOP)))
        v = round((1.0 - SHADE_DROP * t) * 255)
        for x in range(fw):
            px[x, y] = v
    return g


def light(frame, grad):
    """Shade the body, then add a top-edge rim highlight."""
    a = frame.getchannel("A")
    rgb = ImageChops.multiply(frame.convert("RGB"), Image.merge("RGB", (grad, grad, grad)))

    # Top edge = alpha minus alpha-pushed-down. Built by paste, not offset(),
    # because offset() wraps the bottom rows back onto the top.
    down = Image.new("L", frame.size, 0)
    down.paste(a, (0, RIM_SHIFT))
    rim = ImageChops.subtract(a, down).filter(ImageFilter.GaussianBlur(RIM_BLUR))
    rim = ImageChops.multiply(rim, a)                       # confine inside the sprite
    rim = rim.point(lambda v: min(255, int(v * RIM_GAIN)))
    rim_rgb = Image.merge("RGB", [rim.point(lambda v, c=c: v * c // 255) for c in RIM_COLOR])

    out = ImageChops.add(rgb, rim_rgb)
    out.putalpha(a)
    return out


def main():
    os.makedirs(os.path.join(HERE, "Sheets"), exist_ok=True)
    meta = {}
    for fname, base, n in SHEETS:
        path = os.path.join(HERE, fname)
        bx0, by0, bx1, by1 = measure(path, n)
        fw = round((bx1 - bx0) * RES / 2) * 2      # even dims keep the grid clean
        fh = round((by1 - by0) * RES / 2) * 2
        grad = shade_gradient(fw, fh, by0, by1)

        im = Image.open(path).convert("RGBA")
        scols = im.size[0] // CELL
        rows = (n + COLS - 1) // COLS
        out = Image.new("RGBA", (COLS * fw, rows * fh), (0, 0, 0, 0))
        for i in range(n):
            c, r = i % scols, i // scols
            cell = im.crop((c * CELL + bx0, r * CELL + by0,
                            c * CELL + bx1, r * CELL + by1)).resize((fw, fh), Image.LANCZOS)
            out.paste(light(cell, grad), ((i % COLS) * fw, (i // COLS) * fh))
        im.close()

        dst = os.path.join(HERE, "Sheets", base + ".webp")
        # WebP q90, not PNG. The baked gradients need thousands of shades; a 255-colour
        # PNG palette shared across a whole sheet bands the head badly (measured: 1530
        # -> 54 unique colours), and lossless PNG is ~3.3x the bytes for no visible gain.
        out.save(dst, format="WEBP", quality=90, method=6)
        meta[base] = {"frames": n, "cols": COLS, "fw": fw, "fh": fh, "box": [bx0, by0, bx1, by1]}
        print(f"{base:9s} {n:2d}f  frame {fw}x{fh}  box {bx0},{by0},{bx1},{by1}  "
              f"{os.path.getsize(dst)//1024}KB  mem {n*fw*fh*4//1048576}MB")

    json.dump(meta, open(os.path.join(HERE, "Sheets", "meta.json"), "w"), indent=1)
    print("\nLEMO_ANIMS (game.js):")
    for k, v in meta.items():
        print(f"    {k+':':10s} {{ frames: {v['frames']}, cols: {v['cols']}, "
              f"fw: {v['fw']}, fh: {v['fh']}, box: {v['box']}, ... }},")


if __name__ == "__main__":
    main()
