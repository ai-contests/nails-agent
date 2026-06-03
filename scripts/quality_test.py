"""Run 6 try-on samples to validate quality before committing to the 100-batch.

Setup:
  - 3 canonical hands (data/hand_models/candidates/hand_canon_{fair,medium,deep}.png)
  - 6 diverse nail designs (3 from existing enhanced_style, 3 from Pinterest pool)
  - 6 pairs total, distributed 2-per-hand for skin-tone diversity
  - Output sheet: [hand input | nail design | output] x 6 rows, plus 2 cocomo
    reference panels at the top so user can eyeball aesthetic alignment.
"""
from __future__ import annotations
import sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build

HANDS = {
    "fair":   ROOT / "data/hand_models/candidates/hand_canon_fair.png",
    "medium": ROOT / "data/hand_models/candidates/hand_canon_medium.png",
    "deep":   ROOT / "data/hand_models/candidates/hand_canon_deep.png",
}

# Diverse nail design references: mix of existing enhanced_style and Pinterest.
PIN = Path("/Users/nev4rb14su/workspace/dataset/nails_agent/processed/nails_1024")
PAIRS = [
    ("fair",   ROOT / "data/enhanced_style_01.png",  "cream/marble salon"),
    ("fair",   PIN / "nails_24144c1d3a.jpg",         "cherry blossom pink"),
    ("medium", ROOT / "data/enhanced_style_19.png",  "gold glitter"),
    ("medium", PIN / "nails_57aebb95df.jpg",         "Spirited Away / anime"),
    ("deep",   ROOT / "data/enhanced_style_35.png",  "blue almond"),
    ("deep",   PIN / "nails_85c5f2cafb.jpg",         "plum blossom ink"),
]

COCOMO_REF = [Path("/tmp/cocomo/p1.webp"), Path("/tmp/cocomo/p8.webp")]
OUT_DIR = ROOT / "data/tryon_v2"


def run(hand_path: Path, nail_path: Path, prefix: str):
    h = cc.upload_image(hand_path)
    n = cc.upload_image(nail_path)
    wf = build(h, n, filename_prefix=prefix)
    pid = cc.submit(wf)
    job = cc.poll(pid, interval=2.0, timeout=300)
    if job.get("status") != "completed":
        return None, str(job.get("execution_error"))[:200]
    fn, sub, ty = cc.extract_outputs(job)[0]
    data = cc.download_view(fn, sub, ty)
    dst = OUT_DIR / f"{prefix}.png"
    dst.write_bytes(data)
    return dst, "ok"


def main():
    print(f"running {len(PAIRS)} try-on pairs in parallel (3 workers)...")
    t0 = time.time()
    results = []  # list of (skin, nail_path, nail_label, output_path)
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {}
        for i, (skin, nail, lbl) in enumerate(PAIRS):
            prefix = f"qtest_{i:02d}_{skin}"
            futs[ex.submit(run, HANDS[skin], nail, prefix)] = (i, skin, nail, lbl)
        for fut in as_completed(futs):
            i, skin, nail, lbl = futs[fut]
            dst, msg = fut.result()
            print(f"  [{i}] {skin}/{lbl}  {msg}")
            results.append((i, skin, nail, lbl, dst))
    results.sort(key=lambda r: r[0])
    print(f"total {time.time()-t0:.1f}s")

    # Build sheet: top row = 2 cocomo references; below = 6 rows of [hand | nail | output]
    cell = 360
    label_h = 28
    cols = 3
    ref_h = cell + label_h
    body_h = (cell + label_h) * len(results)
    W = cell * cols
    H = ref_h + body_h + 32  # +32 for title

    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = title_font = ImageFont.load_default()

    # Title + cocomo references (top)
    draw.text((8, 4), "Cocomo aesthetic references (for comparison)", fill="black", font=title_font)
    for ci, p in enumerate(COCOMO_REF[:2]):
        x = ci * cell
        y = 32
        if p.exists():
            with Image.open(p) as im:
                im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
                sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        draw.text((x + 6, y + cell + 4), f"cocomo ref {ci+1}", fill="black", font=font)
    # column 3 of top row: blank with header for body section
    draw.text((2 * cell + 8, 32 + cell // 2), "↓ try-on results below",
              fill="dimgray", font=title_font)

    # Body rows
    y0 = 32 + ref_h
    for ri, (_, skin, nail_path, nail_label, out_path) in enumerate(results):
        y = y0 + ri * (cell + label_h)
        panels = [
            (HANDS[skin], f"hand_canon_{skin}"),
            (nail_path,   f"nail ref: {nail_label}"),
            (out_path,    "→ try-on output"),
        ]
        for col, (p, lbl) in enumerate(panels):
            x = col * cell
            if p and p.exists():
                with Image.open(p) as im:
                    im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
                    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
            else:
                draw.rectangle([x + 4, y + 4, x + cell - 4, y + cell - 4],
                               outline="red", width=2)
                draw.text((x + 10, y + cell // 2), "FAIL", fill="red", font=title_font)
            draw.text((x + 6, y + cell + 4), lbl, fill="black", font=font)

    out = OUT_DIR / "quality_test_sheet.jpg"
    sheet.save(out, "JPEG", quality=90)
    print(f"\nsheet → {out}")


if __name__ == "__main__":
    main()
