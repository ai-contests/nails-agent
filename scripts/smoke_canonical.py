"""Validate: can the model take nail design from existing enhanced_style image
while keeping hand from canonical hand_0?"""
from __future__ import annotations
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build

HAND = ROOT / "data/hand_models/hand_0.jpg"
# enhanced_style_03 has a distinctive black + pink-checkered + brown design
# on a hand surrounded by rose petals — a strong test that the model can
# ignore the rose-petal scene and just transfer the nail design.
NAIL_REF = ROOT / "data/enhanced_style_03.png"
OUT_DIR = ROOT / "data/tryon_v2"


def main():
    print("uploading hand_0 (canonical)...")
    hand_name = cc.upload_image(HAND)
    print("uploading enhanced_style_03 (nail design ref)...")
    nail_name = cc.upload_image(NAIL_REF)

    wf = build(hand_name, nail_name, filename_prefix="canon_03")
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
    dst = OUT_DIR / "canon_03.png"
    dst.write_bytes(data)
    print(f"saved → {dst.name}")

    # 3-panel side-by-side
    cell = 480
    label_h = 28
    panels = [(HAND, "hand_0 canonical"),
              (NAIL_REF, "nail design ref (enhanced_style_03)"),
              (dst, "output — should be hand_0 wearing 03's design")]
    sheet = Image.new("RGB", (cell * 3, cell + label_h), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
    except Exception:
        font = ImageFont.load_default()
    for col, (p, lbl) in enumerate(panels):
        x = col * cell
        with Image.open(p) as im:
            im = im.convert("RGB")
            im.thumbnail((cell, cell), Image.LANCZOS)
            ox = x + (cell - im.width) // 2
            oy = (cell - im.height) // 2
            sheet.paste(im, (ox, oy))
        draw.text((x + 6, cell + 4), lbl, fill="black", font=font)
    out = OUT_DIR / "canon_03_compare.jpg"
    sheet.save(out, "JPEG", quality=92)
    print(f"sheet → {out}")


if __name__ == "__main__":
    main()
