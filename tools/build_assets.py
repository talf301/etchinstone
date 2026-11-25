"""Build the web images from the print-and-play asset folder.

Usage:
  uv run --no-project --with pillow --with numpy python -I tools/build_assets.py \
      "<Dragons of Etchinstone Assets dir>" <extracted pdf pages dir> public/img

The pages dir holds the page images of "Northvale - Flip on Short Edge.pdf"
(`pdfimages -png -f 1 -l 6 <pdf> <dir>/pg`). Northvale faces are cut from those
300 dpi pages and identified by comparing them with the small named images.
"""

import os
import re
import sys

import numpy as np
from PIL import Image

A, PAGES, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
Q = 82
BASE = [
    ("Water", "Destruction"), ("Water", "Sword of Light"),
    ("Water", "Brute Force"), ("Water", "Frostfire Wall"),
    ("Lightning", "Rain of Blood"), ("Lightning", "Fleet Footed"),
    ("Lightning", "Adapt"), ("Lightning", "River Swiftness"),
    ("Fire", "Burning Bridges"), ("Fire", "Motivated Flight"),
    ("Fire", "Adapt"), ("Fire", "Frostfire Wall"),
    ("Shadow", "Rain of Blood"), ("Shadow", "Fleet Footed"),
    ("Shadow", "Determined March"), ("Shadow", "River Swiftness"),
]


def save(im, path, w=None, q=Q):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if w and im.size[0] != w:
        im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
    im.save(path, "WEBP", quality=q, method=6)


def landscape(im):
    return im.rotate(90, expand=True) if im.size[0] < im.size[1] else im


# Base mage cards.
for i, (el, name) in enumerate(BASE):
    for lv in range(1, 5):
        im = Image.open(f"{A}/Base Game/Mage Cards/{el} - {name} - Level {lv}.png")
        save(im.convert("RGB"), f"{OUT}/m/b{i}-{lv}.webp", 660)

# Base encounters (small originals; keep them lossless-ish).
for r in range(1, 5):
    for n in range(1, 5):
        for kind, k in (("Enemy", "e"), ("Journey", "j")):
            im = Image.open(f"{A}/Base Game/Encounters/Region {r} - {kind} {n}.png")
            save(im.convert("RGB"), f"{OUT}/e/b{r}{k}{n}.webp", q=92)

# Base dragons: painted art from the reference images, card from the rulebook.
for name in ("Grimroch", "Vuurhast", "Helsang"):
    im = Image.open(f"{A}/Base Game/Boss References/{name}.jpg").convert("RGB")
    save(im.crop((600, 95, 1280, 470)), f"{OUT}/d/{name.lower()}.webp", q=80)
im = Image.open(f"{A}/Base Game/Rulebook Card Illustrations/Rodving - Dragon Card.png")
save(im.convert("RGB").crop((190, 322, 318, 520)), f"{OUT}/d/rodving.webp", 384, q=88)

# App artwork.
save(Image.open(f"{A}/App Artwork/vale.webp").convert("RGB"), f"{OUT}/vale.webp", q=80)
land = Image.open(f"{A}/App Artwork/Landscape - Original.png").convert("RGB")
save(land, f"{OUT}/landscape.webp", 1024, q=78)
for s in (192, 512):
    Image.open(f"{A}/App Artwork/icon-{s}.png").save(f"{OUT}/../icon-{s}.png")
Image.open(f"{A}/App Artwork/icon-512.png").resize((180, 180), Image.LANCZOS).save(
    f"{OUT}/../icon-180.png"
)

# Northvale: named low-resolution references.
refs = {}
N = f"{A}/Northvale"
for f in os.listdir(f"{N}/Mage Cards"):
    if f.endswith(".webp"):
        refs["m/n-" + f[:-5]] = f"{N}/Mage Cards/{f}"
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
for f in os.listdir(f"{N}/Map Boss and Reference Cards"):
    if f.endswith(".png"):
        key = slug(re.sub(r"^\d - ", "", f[:-4]))
        kind = "ref" if key.startswith("reference") else "r"
        refs[f"{kind}/n-{key}"] = f"{N}/Map Boss and Reference Cards/{f}"


def sig(im):
    return np.asarray(im.convert("RGB").resize((48, 32), Image.BILINEAR)).astype(float)


ref_sig = {k: sig(landscape(Image.open(p))) for k, p in refs.items()}

cells = []
for p in sorted(os.listdir(PAGES)):
    im = Image.open(f"{PAGES}/{p}")
    if im.mode == "L" or im.size != (2550, 3300):
        continue
    im = im.convert("RGB")
    for row in range(4):
        for col in range(4):
            x0 = 150 + col * 562.5
            c = im.crop((round(x0), row * 825, round(x0 + 562.5), (row + 1) * 825))
            if np.asarray(c.convert("L")).mean() > 250:
                continue
            cells.append(c)

used = {}
for c in cells:
    best = None
    for rot in (90, 270):
        r = c.rotate(rot, expand=True)
        s = sig(r)
        for k, rs in ref_sig.items():
            d = float(((s - rs) ** 2).mean())
            if best is None or d < best[0]:
                best = (d, k, r)
    d, k, r = best
    if k in used and used[k][0] <= d:
        continue
    used[k] = (d, r)

missing = sorted(set(refs) - set(used))
print("matched", len(used), "of", len(refs), "worst", max(v[0] for v in used.values()))
if missing:
    print("MISSING", missing)
for k, (d, r) in used.items():
    save(r, f"{OUT}/{k}.webp", 660 if k.startswith("m/") else 825, q=84)

# Northvale encounter crops from the region cards (825 x 562 landscape).
regions = ["severed-seaboard", "whispering-fields", "forgotten-foothills", "northvale"]
for i, name in enumerate(regions, 1):
    r = used[f"r/n-{name}"][1]
    w = r.size[0]
    left, right = 0.121 * w, 0.880 * w
    cw = (right - left) / 4
    for n in range(4):
        box_e = (round(left + n * cw), round(0.315 * r.size[1]), round(left + (n + 1) * cw), round(0.672 * r.size[1]))
        box_j = (round(left + n * cw), round(0.672 * r.size[1]), round(left + (n + 1) * cw), round(0.965 * r.size[1]))
        save(r.crop(box_e), f"{OUT}/e/n{i}e{n + 1}.webp", q=88)
        save(r.crop(box_j), f"{OUT}/e/n{i}j{n + 1}.webp", q=88)
# Northvale boss art window.
for name in ("merinus", "blight-rider", "the-waykeeper", "aqualis"):
    r = used[f"r/n-{name}"][1]
    w, h = r.size
    save(r.crop((round(0.165 * w), round(0.41 * h), round(0.835 * w), round(0.79 * h))), f"{OUT}/d/{name}.webp", q=88)
