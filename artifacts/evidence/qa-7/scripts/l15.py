"""P01-QA-006 L15: under reduced motion every scene's figure (canvas/svg box recorded by probe5 rm) paints
a non-trivial number of non-background pixels. Usage: python3 l15.py <results.json> <probe dir>"""
import json, sys
from PIL import Image
r = json.load(open(sys.argv[1])); d = sys.argv[2]
for v in r["rm"]:
    out = []
    for row in v["rows"]:
        im = Image.open(f"{d}/{row['file']}").convert("L")
        best = 0
        for f in row["figs"]:
            if f["r"] - f["l"] < 4 or f["b"] - f["t"] < 4: continue
            crop = im.crop((f["l"], f["t"], f["r"], f["b"])).resize((200, 200))
            best = max(best, sum(1 for p in crop.getdata() if p > 40))
        out.append(f"{row['id']}:{best}")
    print(v["vp"], " ".join(out))
