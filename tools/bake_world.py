#!/usr/bin/env python3
"""Bake the world art: 16 full-canvas PNG layers (~12.5 MB) -> a handful of small files.

WHY. The world used to ship as 16 separate 2210x3160 PNGs that every phone had to
download (~12.5 MB), decode one by one (each decodes to 27.9 MB whatever its file
size), composite into cache canvases, rasterise into collision masks and then run
~17 morphology passes over 1.7M-pixel masks — all on the login path. On a slow link
the 3.6 MB background alone outlasted the fetch timeout, which is the "black world
that never fixes itself"; on a weak phone the decode + mask work was seconds of
main-thread time behind the boot screen.

None of that depends on anything but the art itself, so it is done ONCE, here:
  Baked_Ground.webp   every ground-floor layer composited, in paint order (lossy q92,
                      visually identical: PSNR ~39 dB, max error only on hard edges)
  Baked_Second.webp   the mezzanine's three layers, cropped to their painted bbox —
                      the old full-canvas cache was 82% transparent and was still
                      blended over the whole screen every frame
  Baked_Lights1.png   the laptop-glow sheets, cropped to the union of their painted
  Baked_Lights2.png   pixels and every lightBox in LAPTOP_DEFS
  Baked_Overlay2.webp the two day overlays at 1/3 size (soft gradients — the runtime
  Baked_Overlay.webp  shrank them to this anyway, after decoding the full thing)
  Baked_Masks.bin     the collision masks, ALREADY morphed, run-length encoded
  baked.json          where each piece goes + the source hashes (skip if unchanged)

The meeting room (two small WebPs) and the extra table's glow are left as they are.

The mask maths mirrors what game.js used to do in the browser (_rasterMask +
_dilate/_erode), so collision is unchanged: a 2x box downscale of the layer's alpha,
thresholded per layer, OR-ed per group, then 4-neighbour morphology where a
dilation treats off-image as empty and an erosion treats it as solid.

Run by the pre-commit hook; run it by hand with `python3 tools/bake_world.py`
(add --force to rebake even if nothing changed). Needs Pillow only.
"""
import hashlib, json, os, re, struct, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WS = os.path.join(ROOT, 'Art', 'Workspace')
GAME_JS = os.path.join(ROOT, 'game.js')

IMG_W, IMG_H = 2210, 3160
MASK_DIV = 2
MW, MH = IMG_W // MASK_DIV, IMG_H // MASK_DIV

# Paint order, bottom -> top. (file, paste-at or None for full canvas). Must match
# the WORLD_LAYERS order in game.js (the legacy fallback still loads that list).
GROUND = [
    ('Workspace_0014_Background.png', None),
    ('Workspace_0013_Walls.png', None),
    ('Workspace_0013b_Trophy_Shelf.png', (168, 3030)),       # TROPHY_SHELF_BOX
    ('Workspace_0012_Fireplace.png', None),
    ('Workspace_0011_Books_Sofas.png', None),
    ('Workspace_0010_Books_Library.png', None),
    ('Workspace_0009_Sofa.png', None),
    ('Workspace_0008_Laptops_Table.png', None),
    ('Extension_Extra_Work_Table.webp', (1528, 1330)),       # EXT_TABLE_BOX
    ('Workspace_0007_Stairs.png', None),
    ('Workspace_0006_Games_Table.png', None),
]
SECOND = [
    'Workspace_0005_Second_Floor_Background.png',
    'Workspace_0004_Second_Floor_Laptops_Table.png',
    'Workspace_0003_Second_Floor_Papers_Table.png',
]
LIGHTS = {1: 'Workspace_0008_Laptops_Table_Laptop_Lights.png',
          2: 'Workspace_0004_Second_Floor_Laptops_Table_Laptop_Lights.png'}
OVERLAY2 = 'Workspace_0002_(Normal)Day-Overlay-2.png'
OVERLAY = 'Workspace_0001_(Overlay)Day-Overlay.png'
OVERLAY_DIV = 3

# Collision groups: layer -> alpha threshold (MASK_THRESHOLD in game.js).
MASKS = {
    'walls':  [('Workspace_0013_Walls.png', 130)],
    'furn':   [('Workspace_0011_Books_Sofas.png', 130), ('Workspace_0010_Books_Library.png', 130),
               ('Workspace_0009_Sofa.png', 130), ('Workspace_0006_Games_Table.png', 130)],
    'fire':   [('Workspace_0012_Fireplace.png', 205)],
    'stairs': [('Workspace_0007_Stairs.png', 40)],
    'desks':  [('Workspace_0004_Second_Floor_Laptops_Table.png', 130),
               ('Workspace_0003_Second_Floor_Papers_Table.png', 130)],
}
# What ships: group -> (op, passes). game.js ORs these together at load.
MORPH = {'walls': ('dilate', 3), 'furn': ('erode', 3), 'fire': (None, 0),
         'stairs': ('dilate', 8), 'desks': ('erode', 3)}


def load(name):
    return Image.open(os.path.join(WS, name)).convert('RGBA')


def sources():
    names = [f for f, _ in GROUND] + SECOND + list(LIGHTS.values()) + [OVERLAY2, OVERLAY]
    return sorted(set(names))


def source_hashes():
    out = {}
    for n in sources():
        out[n] = hashlib.sha1(open(os.path.join(WS, n), 'rb').read()).hexdigest()[:10]
    out['__script'] = hashlib.sha1(open(os.path.abspath(__file__), 'rb').read()).hexdigest()[:10]
    # The glow crops depend on LAPTOP_DEFS' lightBoxes.
    out['__lightboxes'] = hashlib.sha1(json.dumps(lightboxes()).encode()).hexdigest()[:10]
    return out


def lightboxes():
    """Union of LAPTOP_DEFS lightBoxes per floor (laptops with their own `sheet` skipped)."""
    src = open(GAME_JS, encoding='utf-8').read()
    m = re.search(r'const LAPTOP_DEFS = \[(.*?)\n\];', src, re.S)
    boxes = {1: None, 2: None}
    if not m:
        return boxes
    for line in m.group(1).splitlines():
        if 'lightBox' not in line or 'sheet:' in line:
            continue
        fl = re.search(r'floor:\s*(\d)', line)
        lb = re.search(r'lightBox:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]', line)
        if not fl or not lb:
            continue
        f = int(fl.group(1)); b = [int(v) for v in lb.groups()]
        cur = boxes.get(f)
        boxes[f] = b if cur is None else [min(cur[0], b[0]), min(cur[1], b[1]), max(cur[2], b[2]), max(cur[3], b[3])]
    return boxes


def union(a, b):
    if a is None: return b
    if b is None: return a
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


# ── masks: rows as Python ints (bit x = pixel x) ─────────────────────────────────


def alpha_rows(img, thr):
    a = img.getchannel('A').resize((MW, MH), Image.BOX)
    a = a.point(lambda v: 255 if v >= thr else 0)
    data = a.tobytes()
    rows = []
    for y in range(MH):
        s = data[y * MW:(y + 1) * MW].replace(b'\xff', b'1').replace(b'\x00', b'0')
        rows.append(int(s[::-1], 2))
    return rows


FULL = (1 << MW) - 1


def dilate(rows):
    out = []
    for y in range(MH):
        r = rows[y]
        v = r | ((r << 1) & FULL) | (r >> 1)
        if y > 0: v |= rows[y - 1]
        if y < MH - 1: v |= rows[y + 1]
        out.append(v)
    return out


def erode(rows):
    out = []
    top = 1 << (MW - 1)
    for y in range(MH):
        r = rows[y]
        v = r & (((r << 1) & FULL) | 1) & ((r >> 1) | top)
        v &= rows[y - 1] if y > 0 else FULL
        v &= rows[y + 1] if y < MH - 1 else FULL
        out.append(v)
    return out


def rle(rows):
    bits = ''.join(format(r, '0%db' % MW)[::-1] for r in rows)
    out = bytearray()
    val, pos, n = '0', 0, len(bits)
    while pos < n:
        nxt = bits.find('1' if val == '0' else '0', pos)
        if nxt < 0: nxt = n
        run = nxt - pos
        while True:                     # LEB128
            b = run & 0x7F; run >>= 7
            out.append(b | (0x80 if run else 0))
            if not run: break
        pos = nxt
        val = '1' if val == '0' else '0'
    return bytes(out)


def bake():
    meta = {'v': 1}

    g = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
    for name, at in GROUND:
        im = load(name)
        if at:
            layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
            layer.paste(im, at)
            im = layer
        g = Image.alpha_composite(g, im)
    g.convert('RGB').save(os.path.join(WS, 'Baked_Ground.webp'), 'WEBP', quality=92, method=6)
    meta['ground'] = {'f': 'Baked_Ground.webp', 'w': IMG_W, 'h': IMG_H}

    s = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
    for name in SECOND:
        s = Image.alpha_composite(s, load(name))
    bb = list(s.getchannel('A').getbbox())
    s.crop(bb).save(os.path.join(WS, 'Baked_Second.webp'), 'WEBP', quality=92, method=6, alpha_quality=100)
    meta['second'] = {'f': 'Baked_Second.webp', 'box': bb}

    lb = lightboxes()
    for fl, name in LIGHTS.items():
        im = load(name)
        box = union(list(im.getchannel('A').getbbox() or [0, 0, 1, 1]), lb.get(fl))
        box = [max(0, box[0] - 4), max(0, box[1] - 4), min(IMG_W, box[2] + 4), min(IMG_H, box[3] + 4)]
        out = 'Baked_Lights%d.png' % fl
        im.crop(box).save(os.path.join(WS, out), 'PNG', optimize=True)
        meta['lights%d' % fl] = {'f': out, 'box': box}

    for key, name, out in (('overlay2', OVERLAY2, 'Baked_Overlay2.webp'), ('overlay', OVERLAY, 'Baked_Overlay.webp')):
        im = load(name)
        w, h = im.size
        small = im.resize((max(1, round(w / OVERLAY_DIV)), max(1, round(h / OVERLAY_DIV))), Image.LANCZOS)
        small.save(os.path.join(WS, out), 'WEBP', quality=90, method=6, alpha_quality=100)
        meta[key] = {'f': out, 'srcW': w, 'srcH': h}

    blob = bytearray(b'MQM1') + struct.pack('<HHB', MW, MH, len(MASKS))
    for gname, layers in MASKS.items():
        acc = [0] * MH
        for name, thr in layers:
            rows = alpha_rows(load(name), thr)
            acc = [a | b for a, b in zip(acc, rows)]
        op, n = MORPH[gname]
        for _ in range(n):
            acc = dilate(acc) if op == 'dilate' else erode(acc)
        data = rle(acc)
        nm = gname.encode()
        blob += struct.pack('<B', len(nm)) + nm + struct.pack('<I', len(data)) + data
    open(os.path.join(WS, 'Baked_Masks.bin'), 'wb').write(bytes(blob))
    meta['masks'] = {'f': 'Baked_Masks.bin', 'w': MW, 'h': MH}

    # Byte sizes, so the boot bar can show real download progress before any
    # response has told us its length.
    for v in meta.values():
        if isinstance(v, dict) and 'f' in v:
            v['bytes'] = os.path.getsize(os.path.join(WS, v['f']))
    meta['sources'] = source_hashes()
    open(os.path.join(WS, 'baked.json'), 'w', encoding='utf-8').write(json.dumps(meta, indent=2) + '\n')
    return meta


def main():
    force = '--force' in sys.argv
    cur = None
    try:
        cur = json.load(open(os.path.join(WS, 'baked.json'), encoding='utf-8'))
    except Exception:
        pass
    if not force and cur and cur.get('sources') == source_hashes():
        print('bake_world: up to date')
        return
    meta = bake()
    total = sum(os.path.getsize(os.path.join(WS, v['f'])) for k, v in meta.items() if isinstance(v, dict) and 'f' in v)
    print('bake_world: baked %d files, %.0f KB' % (sum(1 for v in meta.values() if isinstance(v, dict) and 'f' in v), total / 1024))


if __name__ == '__main__':
    main()
