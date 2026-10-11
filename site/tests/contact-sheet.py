"""Contact sheets for an evidence folder: python3 tests/contact-sheet.py ../artifacts/evidence/stage-b1"""
import os, sys
from PIL import Image, ImageDraw
root = sys.argv[1]
for vp, cols, scale in [("390x844", 6, 0.5), ("768x1024", 6, 0.4), ("1440x900", 4, 0.3)]:
    d = os.path.join(root, vp)
    if not os.path.isdir(d): continue
    files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    ims = [Image.open(os.path.join(d, f)) for f in files]
    w, h = int(ims[0].width * scale), int(ims[0].height * scale)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + 6), rows * (h + 22)), (40, 40, 40))
    dr = ImageDraw.Draw(sheet)
    for i, (f, im) in enumerate(zip(files, ims)):
        x, y = (i % cols) * (w + 6), (i // cols) * (h + 22)
        sheet.paste(im.convert("RGB").resize((w, h)), (x, y + 18)); dr.text((x + 2, y + 3), f, fill=(255, 255, 0))
    sheet.save(os.path.join(root, f"sheet-{vp}.png"))
    print(vp, len(files))
