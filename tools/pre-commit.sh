#!/bin/bash
# Auto-increment build number in index.html before each commit.
# Format in HTML: Build 136 · Updated 7/28 1:40 PM  (M/D, no leading zeros)

FILE="index.html"

# Regenerate Hats/hats.json from the PNGs on disk. The site is statically hosted, so
# a directory can't be listed in production — this manifest is how the hat picker
# discovers files. (On localhost the game parses the dev server's directory index
# instead, so a newly dropped hat appears there without committing.)
if [ -d "Hats" ]; then
    python3 - <<'PY_HATS'
import json, os
d = 'Hats'
files = sorted(f for f in os.listdir(d)
               if f.lower().endswith(('.png', '.webp')) and not f.startswith('.'))
open(os.path.join(d, 'hats.json'), 'w', encoding='utf-8').write(
    json.dumps(files, ensure_ascii=False, indent=2) + '\n')
print('pre-commit: hats.json → %d hat(s)' % len(files))
PY_HATS
    git add Hats/hats.json 2>/dev/null
fi

# Stickers: the 512² masters in Stickers/ are shrunk to 256² in Stickers/sm/ (a whole
# set at 512² decodes to ~150 MB — see invariant 25) and listed in Stickers/stickers.json,
# which is how the chat's sticker picker discovers them. Only new/changed masters are
# re-encoded; an sm/ file whose master was deleted is removed. Names are written NFC:
# macOS hands them out decomposed, but git (precomposeunicode) commits them composed.
if [ -d "Stickers" ]; then
    python3 - <<'PY_STK'
import json, os, unicodedata
d, o = 'Stickers', 'Stickers/sm'
os.makedirs(o, exist_ok=True)
fs = sorted(f for f in os.listdir(d)
            if f.lower().endswith('.webp') and not f.startswith('.'))
try:
    from PIL import Image
except Exception:
    Image = None
    print('pre-commit: PIL missing — Stickers/sm not refreshed')
if Image:
    for f in fs:
        src, dst = os.path.join(d, f), os.path.join(o, f)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        Image.open(src).convert('RGBA').resize((256, 256), Image.LANCZOS) \
            .save(dst, 'WEBP', quality=88, method=6)
    keep = set(fs)
    for f in os.listdir(o):
        if f.lower().endswith('.webp') and not f.startswith('.') and f not in keep:
            os.remove(os.path.join(o, f))
open(os.path.join(d, 'stickers.json'), 'w', encoding='utf-8').write(
    json.dumps([unicodedata.normalize('NFC', os.path.splitext(f)[0]) for f in fs], ensure_ascii=False, indent=2) + '\n')
print('pre-commit: stickers.json → %d sticker(s)' % len(fs))
PY_STK
    git add -A Stickers/sm Stickers/stickers.json 2>/dev/null
fi

# Bake the world (tools/bake_world.py): the 16 full-canvas layers → a ground WebP,
# a cropped mezzanine WebP, cropped glow sheets, shrunk overlays and the finished
# collision masks (~1 MB instead of ~12.5 MB). It skips itself when no source layer
# (or the script, or LAPTOP_DEFS' lightBoxes) changed. MUST run before the
# manifest below, so the baked files get their content hashes.
if [ -f "tools/bake_world.py" ]; then
    python3 tools/bake_world.py || echo "pre-commit: bake_world FAILED — the baked world is stale"
    git add Art/Workspace/Baked_* Art/Workspace/baked.json 2>/dev/null
fi

# Regenerate Art/Workspace/manifest.json — a content hash per world-art layer.
# game.js loads each layer as `<file>?h=<hash>`, and the service worker treats a
# hashed URL as immutable (pure cache-first, no revalidation), so a returning
# visitor downloads ZERO bytes of art. Editing a layer changes its hash, which
# changes its URL, which is a cache miss — so only the changed file re-downloads.
if [ -d "Art/Workspace" ]; then
    python3 - <<'PY_WS'
import json, os, hashlib
d = 'Art/Workspace'
out = {}
for f in sorted(os.listdir(d)):
    if not f.lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.bin')) or f.startswith('.'):
        continue
    out[f] = hashlib.sha1(open(os.path.join(d, f), 'rb').read()).hexdigest()[:10]
open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8').write(
    json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print('pre-commit: Workspace manifest → %d layer(s)' % len(out))
PY_WS
    git add Art/Workspace/manifest.json 2>/dev/null
fi

CURRENT=$(grep -oE 'Build [0-9]+' "$FILE" | head -1 | grep -oE '[0-9]+')
if [ -z "$CURRENT" ]; then
    echo "pre-commit: build number not found in $FILE — skipping"
    exit 0
fi

NEW=$((CURRENT + 1))
# %-m/%-d strips the leading zeros → "7/28", not "07/28".
DATE=$(date +"%-m/%-d")
TIME=$(date +"%l:%M %p" | xargs)
STAMP="$DATE $TIME"

# Replace "Build N · Updated [M/D ]HH:MM AM/PM" with new values (macOS BSD sed).
# The date part is optional in the pattern so a file still carrying the old
# date-less format is upgraded in place instead of being silently skipped.
sed -i '' "s|Build $CURRENT · Updated \([0-9][0-9]*/[0-9][0-9]* \)\{0,1\}[0-9][0-9]*:[0-9][0-9]* [AP]M|Build $NEW · Updated $STAMP|" "$FILE"

git add "$FILE"

echo "pre-commit: build $CURRENT → $NEW (Updated $STAMP)"
