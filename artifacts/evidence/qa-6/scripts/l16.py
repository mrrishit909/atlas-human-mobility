"""P01-QA-006 L16: pixel-sampled contrast behind every chip/caption/label/ticket/body line in the `tags` frames.
Text colour = computed CSS colour; background = median colour of the element's box in the screenshot
(text covers a minority of the box). Also reports a pixel-only estimate: contrast between the 3rd and 97th
luminance percentiles inside the box. Usage: python3 l16.py <results.json> <probe dir>"""
import json, re, sys
from PIL import Image
r = json.load(open(sys.argv[1])); d = sys.argv[2]
def lum(c):
    def ch(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
cr = lambda a, b: (max(a, b) + 0.05) / (min(a, b) + 0.05)
bad, n = [], 0
for row in r["tags"]:
    im = Image.open(f"{d}/{row['file']}").convert("RGB")
    for b in row.get("l16", []):
        m = re.findall(r"[\d.]+", b["color"]); fg = tuple(float(x) for x in m[:3]); a = float(m[3]) if len(m) > 3 else 1
        box = im.crop((b["l"], b["t"], b["r"], b["b"]))
        px = sorted(box.getdata(), key=lum)
        if not px: continue
        n += 1
        med = px[len(px) // 2]
        if a < 1: fg = tuple(a * f + (1 - a) * m_ for f, m_ in zip(fg, med))
        c1 = cr(lum(fg), lum(med))
        lo, hi = lum(px[int(len(px) * 0.03)]), lum(px[int(len(px) * 0.97)])
        c2 = cr(hi, lo)
        if c1 < 4.5: bad.append((round(c1, 2), round(c2, 2), row["vp"], row["id"], row["p"], b["cls"], b["text"], row["file"]))
print(f"{n} boxes sampled, {len(bad)} below 4.5:1 (css colour vs median background)")
for x in sorted(bad)[:60]: print(x)
