"""P01-QA-006: per-glyph contrast of the dial title against black, from titleink.json frames.
Ink = 95th-percentile luminance inside each glyph box (box clipped below any band-row text it enters)."""
import json, sys
from PIL import Image
d = sys.argv[1]; res = json.load(open(f"{d}/titleink.json"))
lum = lambda v: (v / 255) / 12.92 if v / 255 <= 0.03928 else (((v / 255) + 0.055) / 1.055) ** 2.4
for x in res:
    if "glyphs" not in x: continue
    im = Image.open(f"{d}/{x['file']}").convert("L")
    cut = max([bt["b"] for bt in x["bandText"] if any(g["l"] < bt["r"] and bt["l"] < g["r"] and g["t"] < bt["b"] for g in x["glyphs"])] + [0])
    worst = []
    for g in x["glyphs"]:
        t = max(g["t"], int(cut) + 1)
        px = sorted(im.crop((g["l"], t, g["r"], g["b"])).getdata())
        if not px: continue
        ink = px[int(len(px) * 0.95)]
        worst.append((round((lum(ink) + 0.05) / 0.05, 1), g["ch"]))
    worst.sort()
    textHit = any(g["l"] < bt["r"] and bt["l"] < g["r"] and g["t"] < bt["b"] - 1 and bt["t"] < g["b"] for g in x["glyphs"] for bt in x["bandText"])
    boxHit = any(g["l"] < b["r"] and b["l"] < g["r"] and g["t"] < b["b"] - 1 and b["t"] < g["b"] for g in x["glyphs"] for b in x["bands"])
    print(x["vp"], x["q"], "worst glyphs", worst[:3], "glyph-in-band-box", boxHit, "glyph-on-band-text", textHit)
