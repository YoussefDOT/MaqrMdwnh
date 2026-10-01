// Bakes the emoji set the site draws on devices that don't have Apple's emoji:
//
//   Emoji/<key>.webp   one 72×72 image per emoji (key = code points in hex, FE0F
//                      dropped, joined by "-" — the same rule as _emoKey in game.js)
//   Emoji/emoji.json   { v, px, cats: [{ id, n, e: [emoji…] }], more: "key key …" }
//                      `cats` is what the picker shows, in the system keyboard's order;
//                      `more` lists the skin-tone variants that also have an image.
//                      `v` is a hash of every image — it becomes `?h=` on each URL,
//                      which the service worker treats as immutable (cache-first).
//
// Run it by hand on a Mac, after a macOS update that adds emoji:
//
//     node tools/bake_emoji.mjs
//
// It is NOT in the pre-commit hook: it needs macOS (the emoji font and the keyboard's
// own list — tools/emoji_apple.swift), Swift, and Python with PIL. The output is
// committed like any other art. Needs Node 20+ (the `v` regex flag).

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Emoji');
const SWIFT = join(ROOT, 'tools', 'emoji_apple.swift');
const PX = 72;
const QUALITY = 84;

const CAT_NAMES = {
    People: 'الوجوه والأشخاص',
    Nature: 'الحيوانات والطبيعة',
    FoodAndDrink: 'الطعام والشراب',
    Activity: 'الأنشطة',
    TravelAndPlaces: 'السفر والأماكن',
    Objects: 'الأشياء',
    Symbols: 'الرموز',
    Flags: 'الأعلام',
};

const keyOf = (s) => [...s].map(c => c.codePointAt(0)).filter(c => c !== 0xfe0f).map(c => c.toString(16)).join('-');

console.log('emoji: reading the keyboard list…');
const cats = JSON.parse(execFileSync('swift', [SWIFT, 'list'], { maxBuffer: 64 << 20 }).toString('utf8'))
    .filter(c => CAT_NAMES[c.id]);

// Skin tones: a tone goes right after each modifier base (replacing the FE0F that
// may follow it). One person → 5 variants; two people → all 25 pairs. Only what
// Unicode recommends (RGI_Emoji) is kept, then the font has the last word.
const TONES = [0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff].map(c => String.fromCodePoint(c));
const RGI = /^\p{RGI_Emoji}$/v;
const BASE = /^\p{Emoji_Modifier_Base}$/u;
const TONE = /[\u{1f3fb}-\u{1f3ff}]/u;
function variants(e) {
    if (TONE.test(e)) return [];
    const cps = [...e];
    const at = cps.map((c, i) => (BASE.test(c) ? i : -1)).filter(i => i >= 0);
    if (!at.length) return [];
    const build = (tones) => {
        let out = '';
        for (let i = 0; i < cps.length; i++) {
            const k = at.indexOf(i);
            if (k < 0) { out += cps[i]; continue; }
            out += cps[i] + tones[k];
            if (cps[i + 1] === '️') i++;
        }
        return out;
    };
    const res = [];
    if (at.length === 2) {
        for (const a of TONES) for (const b of TONES) res.push(build([a, b]));
    } else {
        for (const t of TONES) res.push(build(at.map(() => t)));
    }
    return res.filter(v => RGI.test(v));
}

const base = [];
const seen = new Set();
for (const c of cats) {
    c.e = c.e.filter(e => { const k = keyOf(e); if (seen.has(k)) return false; seen.add(k); return true; });
    base.push(...c.e);
}
const extra = [];
for (const e of base) for (const v of variants(e)) {
    const k = keyOf(v);
    if (!seen.has(k)) { seen.add(k); extra.push(v); }
}
console.log(`emoji: ${base.length} in the picker + ${extra.length} skin-tone variants`);

const tmp = mkdtempSync(join(tmpdir(), 'maqr-emoji-'));
const listFile = join(tmp, 'list.json');
const pngDir = join(tmp, 'png');
writeFileSync(listFile, JSON.stringify([...base, ...extra]));
console.log('emoji: rendering…');
const log = execFileSync('swift', [SWIFT, 'render', listFile, pngDir, String(PX)], { maxBuffer: 64 << 20 }).toString('utf8');
const skipped = new Set(log.split('\n').filter(l => l.startsWith('skip ')).map(l => keyOf(l.slice(5))));
if (skipped.size) console.log(`emoji: ${skipped.size} not in the font — left out`);

// PNG → WebP, and the hash of the whole set.
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.webp')) rmSync(join(OUT, f));
const py = `
import hashlib, os, sys
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
h = hashlib.sha1()
n = 0
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    out = os.path.join(dst, f[:-4] + '.webp')
    Image.open(os.path.join(src, f)).convert('RGBA').save(out, 'WEBP', quality=q, method=6)
    h.update(f.encode()); h.update(open(out, 'rb').read())
    n += 1
print(h.hexdigest()[:10], n)
`;
const [hash, count] = execFileSync('python3', ['-c', py, pngDir, OUT, String(QUALITY)]).toString('utf8').trim().split(' ');

const manifest = {
    v: hash,
    px: PX,
    cats: cats.map(c => ({ id: c.id, n: CAT_NAMES[c.id], e: c.e.filter(e => !skipped.has(keyOf(e))) })),
    more: extra.map(keyOf).filter(k => !skipped.has(k)).join(' '),
};
writeFileSync(join(OUT, 'emoji.json'), JSON.stringify(manifest) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`emoji: ${count} images → Emoji/ (v ${hash})`);
