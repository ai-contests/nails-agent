"""Smoke test the white-minimal prompt with 3 different nail designs."""
from __future__ import annotations
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build

HAND = ROOT / "data/hand_models/hand_A_fair.jpg"
NAIL_DIR = Path("/Users/nev4rb14su/workspace/dataset/nails_agent/processed/nails_1024")
PICKS = ["nails_24144c1d3a.jpg", "nails_57aebb95df.jpg", "nails_85c5f2cafb.jpg"]
OUT_DIR = ROOT / "data/tryon_v2"


def main():
    print("uploading hand...")
    hand_name = cc.upload_image(HAND)

    results = []
    for nail_fn in PICKS:
        nail_path = NAIL_DIR / nail_fn
        print(f"\n[{nail_fn}] uploading...")
        nail_name = cc.upload_image(nail_path)
        wf = build(hand_name, nail_name, filename_prefix=f"white_{nail_path.stem}")
        t0 = time.time()
        pid = cc.submit(wf)
        print(f"  prompt_id={pid}")
        job = cc.poll(pid, interval=2.0, timeout=300)
        print(f"  status={job.get('status')} ({time.time()-t0:.1f}s)")
        if job.get("status") != "completed":
            print("  FAIL:", job.get("execution_error"))
            continue
        fn, sub, ty = cc.extract_outputs(job)[0]
        data = cc.download_view(fn, sub, ty)
        dst = OUT_DIR / f"white_{nail_path.stem}.png"
        dst.write_bytes(data)
        results.append((nail_path, dst))
        print(f"  saved → {dst.name}")

    # contact sheet: 3 rows, 2 cols (nail input | output)
    cell = 480
    label_h = 28
    W = cell * 2
    H = (cell + label_h) * len(results)
    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except Exception:
        font = ImageFont.load_default()
    for i, (np_, out) in enumerate(results):
        y = i * (cell + label_h)
        for col, (p, lbl) in enumerate([(np_, f"nail input  {np_.stem}"),
                                         (out, "white-minimal output")]):
            x = col * cell
            with Image.open(p) as im:
                im = im.convert("RGB")
                im.thumbnail((cell, cell), Image.LANCZOS)
                ox = x + (cell - im.width) // 2
                oy = y + (cell - im.height) // 2
                sheet.paste(im, (ox, oy))
            draw.text((x + 6, y + cell + 6), lbl, fill="black", font=font)
    out = OUT_DIR / "white_smoke_sheet.jpg"
    sheet.save(out, "JPEG", quality=92)
    print(f"\nsheet → {out}")


if __name__ == "__main__":
    main()
