"""P01-QA-005: build quantized contact sheets from geom frames and copy cited frames (quantized) into qa-4/.
Usage: python3 pack.py <probe dir> <qa-4 dir> <cited frame names...>"""
import sys, os, glob
from PIL import Image, ImageDraw
src, dst, cited = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(f"{dst}/contact-sheets", exist_ok=True); os.makedirs(f"{dst}/probe", exist_ok=True)
q = lambda im: im.convert("RGB").quantize(colors=128, method=Image.Quantize.FASTOCTREE)
variants = sorted({os.path.basename(f).split("-")[1] + ("-classic" if "-classic-" in f else "") for f in glob.glob(f"{src}/tags-*.png")})
for v in variants:
    fs = sorted(glob.glob(f"{src}/tags-{v}-*.png"))
    fs = [f for f in fs if (("-classic-" in f) == v.endswith("classic"))]
    if not fs: continue
    ims = [Image.open(f) for f in fs]
    cols, tw = 6, 1600 // 6
    th = int(tw * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 14)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (f, im) in enumerate(zip(fs, ims)):
        x, y = (i % cols) * tw, (i // cols) * (th + 14)
        sheet.paste(im.convert("RGB").resize((tw, th)), (x, y + 14))
        d.text((x + 2, y + 1), os.path.basename(f)[5:-4], fill="black")
    q(sheet).save(f"{dst}/contact-sheets/sheet-{v}.png", optimize=True)
for c in cited:
    p = f"{src}/{c}"
    if os.path.exists(p): q(Image.open(p)).save(f"{dst}/probe/{c}", optimize=True)
    else: print("missing", c)
