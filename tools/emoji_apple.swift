// The Mac half of tools/bake_emoji.mjs — run by it, not by hand.
//
//   swift tools/emoji_apple.swift list
//       → JSON on stdout: every emoji the system keyboard offers, in ITS order,
//         grouped by ITS categories: [{ "id": "People", "e": ["😀", …] }, …]
//   swift tools/emoji_apple.swift render <list.json> <outDir> <px>
//       → one <px>×<px> PNG per emoji in the JSON array, named by its key
//         (code points in hex, FE0F dropped, joined by "-"). An emoji the font has
//         no single glyph for is skipped and printed as "skip <emoji>".
//
// The list comes from the keyboard's own framework (EmojiFoundation, loaded by
// name — it has no public header), so the picker is in the order members already
// know from their phones. The «Recents» category is the Mac owner's own history
// and is deliberately left out.

import Foundation
import CoreText
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func keyOf(_ s: String) -> String {
    return s.unicodeScalars.filter { $0.value != 0xFE0F }
        .map { String($0.value, radix: 16) }.joined(separator: "-")
}

let args = CommandLine.arguments
guard args.count >= 2 else { FileHandle.standardError.write("usage: list | render\n".data(using: .utf8)!); exit(2) }

if args[1] == "list" {
    _ = dlopen("/System/Library/PrivateFrameworks/EmojiFoundation.framework/EmojiFoundation", RTLD_NOW)
    guard let cls = NSClassFromString("EMFEmojiCategory") as? NSObject.Type,
          let ids = cls.perform(NSSelectorFromString("categoryIdentifierList"))?.takeUnretainedValue() as? [String]
    else { FileHandle.standardError.write("EmojiFoundation: no category list\n".data(using: .utf8)!); exit(1) }
    var out: [[String: Any]] = []
    for id in ids where !id.hasSuffix("Recents") {
        guard let cat = cls.perform(NSSelectorFromString("categoryWithIdentifier:"), with: id)?.takeUnretainedValue() as? NSObject,
              let toks = cat.perform(NSSelectorFromString("emojiTokensForLocaleData:"), with: nil)?.takeUnretainedValue() as? [NSObject]
        else { continue }
        let list = toks.compactMap { $0.value(forKey: "string") as? String }
        out.append(["id": id.replacingOccurrences(of: "EMFEmojiCategory", with: ""), "e": list])
    }
    let data = try! JSONSerialization.data(withJSONObject: out, options: [])
    FileHandle.standardOutput.write(data)
    exit(0)
}

if args[1] == "render", args.count >= 5 {
    let list = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[2]))) as! [String]
    let outDir = URL(fileURLWithPath: args[3], isDirectory: true)
    let px = Int(args[4]) ?? 72
    try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
    // An Apple emoji glyph is exactly one em square, its bottom edge 1/8 em under the
    // baseline — so at font size = px the glyph fills the px×px canvas.
    let font = CTFontCreateWithName("AppleColorEmoji" as CFString, CGFloat(px), nil)
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    var done = 0
    for s in list {
        let a = NSAttributedString(string: s, attributes: [kCTFontAttributeName as NSAttributedString.Key: font])
        let line = CTLineCreateWithAttributedString(a)
        let runs = CTLineGetGlyphRuns(line) as! [CTRun]
        var glyphs = 0
        var apple = true
        for r in runs {
            glyphs += CTRunGetGlyphCount(r)
            let rf = (CTRunGetAttributes(r) as NSDictionary)[kCTFontAttributeName] as! CTFont
            if (CTFontCopyPostScriptName(rf) as String) != "AppleColorEmoji" { apple = false }
        }
        guard glyphs == 1, apple else { print("skip \(s)"); continue }
        guard let ctx = CGContext(data: nil, width: px, height: px, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
        let b = CTLineGetImageBounds(line, ctx)
        // A full emoji is the whole square; anything smaller (a lone regional
        // indicator letter) is not something the picker or a message should show.
        guard b.width > CGFloat(px) * 0.98 else { print("skip \(s)"); continue }
        ctx.textPosition = CGPoint(x: 0, y: CGFloat(px) / 8)
        CTLineDraw(line, ctx)
        guard let img = ctx.makeImage() else { continue }
        let url = outDir.appendingPathComponent(keyOf(s) + ".png")
        guard let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { continue }
        CGImageDestinationAddImage(dst, img, nil)
        CGImageDestinationFinalize(dst)
        done += 1
    }
    print("rendered \(done)")
    exit(0)
}
exit(2)
