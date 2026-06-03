"""Rebuild the pool contact sheet (after deletions / rerolls)."""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / "data/hand_models/pool"
REROLLS_DIR = POOL

# Logical pool: 5 poses (side_elegant dropped) × 3 skins = 15
POSES = ["palm_down_top", "fist_thumb_up", "two_hands_clasped",
         "reaching_down", "fingers_cupped"]
SKINS = ["fair", "medium", "deep"]


def find_for(pose: str, skin: str) -> Path | None:
    cand = sorted(POOL.glob(f"hand_{pose}_{skin}_*.png"))
    if cand:
        return cand[0]
    # fall back to a reroll for this pose/skin if no original exists
    cand = sorted(POOL.glob(f"reroll_{pose}_{skin}_*.png"))
    return cand[0] if cand else None


def main():
    cell = 360
    label_h = 26
    cols = len(SKINS)
    rows = len(POSES)
    W = cell * cols
    H = (cell + label_h) * rows + 32
    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = title = ImageFont.load_default()
    for c, s in enumerate(SKINS):
        draw.text((c * cell + 8, 4), s, fill="black", font=title)
    for r, p in enumerate(POSES):
        y0 = 32 + r * (cell + label_h)
        for c, s in enumerate(SKINS):
            x = c * cell
            path = find_for(p, s)
            if path:
                with Image.open(path) as im:
                    im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
                    sheet.paste(im, (x + (cell - im.width) // 2,
                                     y0 + (cell - im.height) // 2))
                lbl = f"{p}/{s}"
            else:
                draw.rectangle([x + 4, y0 + 4, x + cell - 4, y0 + cell - 4],
                               outline="red", width=2)
                lbl = f"MISSING {p}/{s}"
            draw.text((x + 6, y0 + cell + 4), lbl, fill="black", font=font)
    out = POOL / "pool_sheet.jpg"
    sheet.save(out, "JPEG", quality=90)
    print(f"sheet → {out}")


if __name__ == "__main__":
    main()
