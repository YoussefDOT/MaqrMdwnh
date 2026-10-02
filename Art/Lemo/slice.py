#!/usr/bin/env python3
"""
Rebuild Art/Lemo/Sheets/*.webp from the master spritesheets in this folder.

    python3 Art/Lemo/slice.py            # every sheet whose master is on disk
    python3 Art/Lemo/slice.py Throw      # only the named ones (the others keep their meta)

The masters are ~197 MB of 2048x2048 cells (gitignored). This bakes them down to
~2.4 MB of game-ready sheets, and bakes the lighting in while it's at it.

A master is either one big spritesheet of 2048x2048 cells (SHEETS) or a folder of
PNGs, one per frame, on a canvas of ANY size (SEQS). A sequence says where the
2048x2048 cell sits inside its own canvas (`off`), and everything after that is
done in cell space -- so its box, its shading and its anchor line up with the
other sheets exactly, however much wider the canvas was drawn.

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
import os, sys, json
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

# PNG sequences. `dir` holds the frames (directly, or in its one subfolder), sorted
# by name. `first`/`last` trim the export; `off` is where the 2048 cell's top-left
# sits on the sequence's canvas; `res` and `cols` override RES and COLS.
#
# Throw: drawn on a 2777x2528 canvas -- the 2048 cell widened by (365, 240) on every
# side (found by matching its first frame against Idle: it is Idle's frame 23, at
# exactly that offset, same scale). Frames 68-110 of the export are him standing in
# Idle's pose with one blink, so the clip ends at 67 and Idle carries on from there.
# 0.16 rather than 0.20: the box has to hold him backing up on one side and the
# throw on the other, and at 0.20 that is 34 MB decoded for a three-second clip.
# `root`: he TRAVELS inside this clip (backs up ~390 px, comes half-way back, springs
# home on the throw) while the game keeps his anchor still, so the bake also records
# how far his head is from where it started, per frame -- the game slides his contact
# shadow by it, or the shadow would sit alone on the floor while he backs away.
SEQS = [
    {"dir": "throw", "base": "Throw", "first": 0, "last": 67,
     "off": (365, 240), "res": 0.16, "cols": 8, "root": True},
]


def _box(bbs, lo, hi):
    """Union of per-frame boxes, padded, clamped to the canvas the frames live on."""
    u = None
    for bb in bbs:
        if bb:
            u = bb if u is None else (min(u[0], bb[0]), min(u[1], bb[1]),
                                      max(u[2], bb[2]), max(u[3], bb[3]))
    return (max(lo[0], u[0] - PAD), max(lo[1], u[1] - PAD),
            min(hi[0], u[2] + PAD), min(hi[1], u[3] + PAD))


class SheetSrc:
    """One master spritesheet of CELL x CELL frames."""
    def __init__(self, fname, base, n):
        self.base, self.n, self.res, self.cols = base, n, RES, COLS
        self.path = os.path.join(HERE, fname)
        self.im = None

    def exists(self):
        return os.path.isfile(self.path)

    def _cell(self, im, i):
        scols = im.size[0] // CELL
        c, r = i % scols, i // scols
        return (c * CELL, r * CELL)

    def measure(self):
        """Tight union box across every frame, above the alpha threshold."""
        im = Image.open(self.path)
        a = im.getchannel("A").point(lambda v: 255 if v > TH else 0)
        bbs = []
        for i in range(self.n):
            x, y = self._cell(im, i)
            bbs.append(a.crop((x, y, x + CELL, y + CELL)).getbbox())
        im.close()
        return _box(bbs, (0, 0), (CELL, CELL))

    def frame(self, i, box):
        """Frame i cropped to `box` (cell space), RGBA."""
        if self.im is None:
            self.im = Image.open(self.path).convert("RGBA")
        x, y = self._cell(self.im, i)
        return self.im.crop((x + box[0], y + box[1], x + box[2], y + box[3]))

    def close(self):
        if self.im is not None:
            self.im.close()
            self.im = None


class SeqSrc:
    """A folder of PNGs, one per frame, on a canvas of any size."""
    def __init__(self, spec):
        self.base = spec["base"]
        self.res, self.cols = spec.get("res", RES), spec.get("cols", COLS)
        self.ox, self.oy = spec["off"]
        self.want_root = bool(spec.get("root"))
        self.files = self._files(os.path.join(HERE, spec["dir"]))[spec["first"]:spec["last"] + 1]
        self.n = len(self.files)

    @staticmethod
    def _files(d):
        def pngs(p):
            # macOS leaves an AppleDouble "._name.png" beside every file on this drive.
            return sorted(os.path.join(p, f) for f in os.listdir(p)
                          if f.lower().endswith(".png") and not f.startswith("."))
        if not os.path.isdir(d):
            return []
        got = pngs(d)
        if got:
            return got
        subs = [os.path.join(d, x) for x in sorted(os.listdir(d))
                if os.path.isdir(os.path.join(d, x)) and not x.startswith(".")]
        return pngs(subs[0]) if subs else []

    def exists(self):
        return self.n > 0

    def measure(self):
        bbs, size = [], None
        for f in self.files:
            im = Image.open(f)
            size = im.size
            bb = im.getchannel("A").point(lambda v: 255 if v > TH else 0).getbbox()
            im.close()
            # canvas px -> cell px. Outside 0..CELL is fine (that is the widening).
            bbs.append(bb and (bb[0] - self.ox, bb[1] - self.oy, bb[2] - self.ox, bb[3] - self.oy))
        return _box(bbs, (-self.ox, -self.oy), (size[0] - self.ox, size[1] - self.oy))

    def frame(self, i, box):
        im = Image.open(self.files[i]).convert("RGBA")
        out = im.crop((box[0] + self.ox, box[1] + self.oy, box[2] + self.ox, box[3] + self.oy))
        im.close()
        return out

    def roots(self):
        """Per frame: the head's centre-x minus frame 0's, in source px. The head is
        the only yellow thing on him, so its alpha-weighted centroid is found by
        colour -- it holds through the motion-blurred frames, where a box would not."""
        K, xs = 8, []
        for f in self.files:
            im = Image.open(f).convert("RGBA")
            im = im.resize((im.size[0] // K, im.size[1] // K), Image.BOX)
            px, (w, h) = im.load(), im.size
            sx = sw = 0
            for y in range(h):
                for x in range(w):
                    r, g, b, a = px[x, y]
                    if a > 40 and r > 170 and g > 120 and b < 120:
                        sx += x * a
                        sw += a
            im.close()
            xs.append(sx / sw * K if sw else None)
        x0 = next(x for x in xs if x is not None)
        return [0 if x is None else round(x - x0) for x in xs]

    def close(self):
        pass


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
    meta_path = os.path.join(HERE, "Sheets", "meta.json")
    meta = json.load(open(meta_path)) if os.path.isfile(meta_path) else {}
    want = set(sys.argv[1:])
    srcs = [SheetSrc(*s) for s in SHEETS] + [SeqSrc(s) for s in SEQS]
    for src in srcs:
        base, n, cols = src.base, src.n, src.cols
        if want and base not in want:
            continue
        if not src.exists():
            # A master that isn't on this machine: its sheet and its meta stay as they are.
            print(f"{base:9s} master not found -- skipped")
            continue
        bx0, by0, bx1, by1 = box = src.measure()
        # Lit at the house resolution, THEN brought down to this sheet's own: the rim
        # is measured in sheet px, so lighting a smaller frame would fatten it.
        lw = round((bx1 - bx0) * RES / 2) * 2      # even dims keep the grid clean
        lh = round((by1 - by0) * RES / 2) * 2
        fw = round((bx1 - bx0) * src.res / 2) * 2
        fh = round((by1 - by0) * src.res / 2) * 2
        grad = shade_gradient(lw, lh, by0, by1)

        rows = (n + cols - 1) // cols
        out = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
        for i in range(n):
            cell = light(src.frame(i, box).resize((lw, lh), Image.LANCZOS), grad)
            if (fw, fh) != (lw, lh):
                cell = cell.resize((fw, fh), Image.LANCZOS)
            out.paste(cell, ((i % cols) * fw, (i // cols) * fh))
        src.close()

        dst = os.path.join(HERE, "Sheets", base + ".webp")
        # WebP q90, not PNG. The baked gradients need thousands of shades; a 255-colour
        # PNG palette shared across a whole sheet bands the head badly (measured: 1530
        # -> 54 unique colours), and lossless PNG is ~3.3x the bytes for no visible gain.
        out.save(dst, format="WEBP", quality=90, method=6)
        meta[base] = {"frames": n, "cols": cols, "fw": fw, "fh": fh, "box": [bx0, by0, bx1, by1]}
        if getattr(src, "want_root", False):
            meta[base]["root"] = src.roots()
        print(f"{base:9s} {n:2d}f  frame {fw}x{fh}  box {bx0},{by0},{bx1},{by1}  "
              f"{os.path.getsize(dst)//1024}KB  mem {n*fw*fh*4//1048576}MB")

    json.dump(meta, open(meta_path, "w"), indent=1)
    print("\nLEMO_ANIMS (game.js):")
    for k, v in meta.items():
        print(f"    {k+':':10s} {{ frames: {v['frames']}, cols: {v['cols']}, "
              f"fw: {v['fw']}, fh: {v['fh']}, box: {v['box']}, ... }},")
        if "root" in v:
            print(f"        root: {v['root']}")


if __name__ == "__main__":
    main()
