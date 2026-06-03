"""Build a labeled contact sheet from a folder of images for quick visual triage."""
from __future__ import annotations
import argparse, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--cell", type=int, default=320)
    ap.add_argument("--cols", type=int, default=6)
    args = ap.parse_args()

    files = sorted(p for p in args.src.iterdir() if p.suffix.lower() in EXTS)
    n = len(files)
    cols = args.cols
    rows = math.ceil(n / cols)
    cell = args.cell
    label_h = 24
    W = cols * cell
    H = rows * (cell + label_h)
    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except Exception:
        font = ImageFont.load_default()

    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x, y = c * cell, r * (cell + label_h)
        with Image.open(f) as im:
            im = im.convert("RGB")
            im.thumbnail((cell, cell), Image.LANCZOS)
            ox = x + (cell - im.width) // 2
            oy = y + (cell - im.height) // 2
            sheet.paste(im, (ox, oy))
        draw.rectangle([x, y + cell, x + cell, y + cell + label_h], fill="white")
        draw.text((x + 4, y + cell + 4), f"{i:02d}  {f.stem[:30]}", fill="black", font=font)

    sheet.save(args.out, "JPEG", quality=88)
    print(f"Wrote {args.out} — {n} images, {cols}x{rows}")

if __name__ == "__main__":
    main()
