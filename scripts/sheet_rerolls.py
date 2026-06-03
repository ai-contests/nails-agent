"""Build a small sheet to pick the best of 3 reroll candidates."""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / "data/hand_models/pool"
files = sorted(POOL.glob("reroll_two_hands_clasped_medium_*.png"))
cell = 460
label_h = 28
sheet = Image.new("RGB", (cell * len(files), cell + label_h), "white")
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
except Exception:
    font = ImageFont.load_default()
for c, p in enumerate(files):
    x = c * cell
    with Image.open(p) as im:
        im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
        sheet.paste(im, (x + (cell - im.width) // 2, (cell - im.height) // 2))
    draw.text((x + 6, cell + 4), p.stem, fill="black", font=font)
out = POOL / "reroll_sheet.jpg"
sheet.save(out, "JPEG", quality=92)
print(f"sheet → {out}")
