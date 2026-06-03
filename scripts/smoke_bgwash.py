"""Test the background-wash prompt on enhanced_style_03 (rose petal bg)."""
from __future__ import annotations
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build_bg_wash

SRC = ROOT / "data/enhanced_style_03.png"
OUT_DIR = ROOT / "data/tryon_v2"


def main():
    print(f"input: {SRC.name}")
    name = cc.upload_image(SRC)
    wf = build_bg_wash(name, filename_prefix="bgwash_03")
    t0 = time.time()
    pid = cc.submit(wf)
    print(f"  prompt_id={pid}")
    job = cc.poll(pid, interval=2.0, timeout=300)
    print(f"  status={job.get('status')} ({time.time()-t0:.1f}s)")
    if job.get("status") != "completed":
        print("FAIL:", job.get("execution_error"))
        raise SystemExit(1)
    fn, sub, ty = cc.extract_outputs(job)[0]
    data = cc.download_view(fn, sub, ty)
    dst = OUT_DIR / "bgwash_03.png"
    dst.write_bytes(data)
    print(f"saved → {dst.name}")

    # side-by-side
    cell = 512
    label_h = 28
    sheet = Image.new("RGB", (cell * 2, cell + label_h), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = ImageFont.load_default()
    for col, (p, lbl) in enumerate([(SRC, "input (enhanced_style_03)"),
                                     (dst, "bg-wash output")]):
        x = col * cell
        with Image.open(p) as im:
            im = im.convert("RGB")
            im.thumbnail((cell, cell), Image.LANCZOS)
            ox = x + (cell - im.width) // 2
            oy = (cell - im.height) // 2
            sheet.paste(im, (ox, oy))
        draw.text((x + 6, cell + 4), lbl, fill="black", font=font)
    out = OUT_DIR / "bgwash_03_compare.jpg"
    sheet.save(out, "JPEG", quality=92)
    print(f"compare sheet → {out}")


if __name__ == "__main__":
    main()
