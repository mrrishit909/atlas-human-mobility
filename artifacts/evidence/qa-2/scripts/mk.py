S = "/private/tmp/claude-501/-Users-rishitmathurrishit-data-frontier/2345476d-71fe-4b13-9b7d-12d3e947ff61/scratchpad"
P = "/Users/rishitmathurrishit/data-frontier/projects/01-atlas-human-mobility"
src = open(P + "/site/tests/evidence-harness.mjs").read()
reps = [
    ('import ffmpegPath from "ffmpeg-static";', f'const ffmpegPath = "{S}/ff/node_modules/ffmpeg-static/ffmpeg";'),
    ('import { chromium } from "@playwright/test";', f'import {{ chromium }} from "{P}/site/node_modules/@playwright/test/index.mjs";'),
    ('const ROOT = join(HERE, "..", "..");\nconst ARTIFACTS = join(ROOT, "artifacts", "evidence");',
     f'const PROJ = "{P}";\nconst ARTIFACTS = join(PROJ, "artifacts", "evidence", "qa-2");\nconst REC = join(PROJ, "artifacts", "evidence", "recordings", "qa-2");'),
    ('ensureDir(join(ARTIFACTS, "recordings"));', 'ensureDir(REC);'),
    ('join(ARTIFACTS, "recordings", `tmp-${width}`)', 'join(REC, `tmp-${width}`)'),
    ('join(ARTIFACTS, "recordings", `${width}.webm`)', 'join(REC, `${width}.webm`)'),
    ('const framesGlob = join(ARTIFACTS, "contact-sheets", `${width}-frame-%03d.png`);\n  execFileSync(ffmpegPath, ["-y", "-i", input, "-vf", "fps=1,scale=-2:240", framesGlob], { stdio: "inherit" });',
     'ensureDir(join(REC, "frames")); const framesGlob = join(REC, "frames", `${width}-frame-%03d.png`);\n  execFileSync(ffmpegPath, ["-y", "-i", input, "-vf", "fps=1", framesGlob], { stdio: "inherit" });'),
    ('readdirSync(join(ARTIFACTS, "contact-sheets")).filter', 'readdirSync(join(REC, "frames")).filter'),
    ('"-i", join(ARTIFACTS, "contact-sheets", `${width}-frame-*.png`),\n    "-filter_complex", `tile=',
     '"-i", join(REC, "frames", `${width}-frame-*.png`),\n    "-filter_complex", `scale=-2:240,tile='),
    ('readFileSync(join(HERE, "evidence.config.json")', f'readFileSync(join("{P}/site/tests", "evidence.config.json")'),
]
for a, b in reps:
    assert src.count(a) >= 1, a
    src = src.replace(a, b)
open(S + "/qa3/evidence-harness.mjs", "w").write(src)
