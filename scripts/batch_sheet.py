"""Build a 100-image contact sheet of batch try-on outputs."""
from __future__ import annotations
import csv
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PAIRS = ROOT / "data/pairs.csv"
OUT_DIR = ROOT / "data/tryon_v2"


def main():
    rows = list(csv.DictReader(PAIRS.open()))
    cell = 240
    label_h = 22
    cols = 10
    rows_n = (len(rows) + cols - 1) // cols
    W = cell * cols
    H = (cell + label_h) * rows_n
    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
    except Exception:
        font = ImageFont.load_default()
    n_ok = 0
    for i, r in enumerate(rows):
        rr, cc_ = divmod(i, cols)
        x, y = cc_ * cell, rr * (cell + label_h)
        out = OUT_DIR / r["out_name"]
        if out.exists():
            with Image.open(out) as im:
                im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
                sheet.paste(im, (x + (cell - im.width) // 2,
                                 y + (cell - im.height) // 2))
            n_ok += 1
        else:
            draw.rectangle([x + 4, y + 4, x + cell - 4, y + cell - 4],
                           outline="red", width=2)
            draw.text((x + 10, y + cell // 2 - 8), "missing", fill="red", font=font)
        draw.text((x + 4, y + cell + 4), f"{i:03d} {r['hand_tag'][:14]} | {r['nail_source'][:3]}",
                  fill="black", font=font)
    dst = OUT_DIR / "batch_contact_sheet.jpg"
    sheet.save(dst, "JPEG", quality=82)
    print(f"sheet → {dst}  ({n_ok}/{len(rows)} present)")


if __name__ == "__main__":
    main()
