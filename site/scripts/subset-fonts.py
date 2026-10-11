"""Subset the self-hosted fonts to the glyphs this site renders (D-007 / D-016).

Newsreader: keep the opsz axis (display optics at 96px, text optics at 22px), pin wght to 400
(every serif on the site is regular). JetBrains Mono: pin wght to 400. Both: Basic Latin plus the
handful of symbols found by scanning src/ and the published data. OFL 1.1, no Reserved Font Name,
so modified (subset) copies keep the original family names.

Run: uv run --with fonttools --with brotli python scripts/subset-fonts.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
NM = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "assets" / "fonts"
UNICODES = list(range(0x20, 0x7F)) + [0xA0, 0xB7, 0x2019, 0x2020, 0x2026, 0x2192, 0x2265, 0x2713, 0x2715]

def build(src: Path, dst: Path, pin: dict) -> None:
    font = TTFont(src)
    font = instantiateVariableFont(font, pin)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "tnum", "lnum", "pnum", "case"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    font.flavor = "woff2"
    font.save(dst)
    print(f"{dst.name}: {src.stat().st_size} -> {dst.stat().st_size} bytes")

OUT.mkdir(parents=True, exist_ok=True)
build(NM / "newsreader/files/newsreader-latin-opsz-normal.woff2", OUT / "newsreader-opsz-400-site.woff2", {"wght": 400})
build(NM / "jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", OUT / "jetbrains-mono-400-site.woff2", {"wght": 400})
