"""Run Path A (hand+nail) and Path B (nail-only), assemble a 2x2 comparison sheet."""
from __future__ import annotations
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build, build_nail_only

HAND = ROOT / "data/hand_models/hand_A_fair.jpg"
NAIL = Path("/Users/nev4rb14su/workspace/dataset/nails_agent/processed/nails_1024/nails_24144c1d3a.jpg")
OUT_DIR = ROOT / "data/tryon_v2"


def run(workflow, label):
    t0 = time.time()
    pid = cc.submit(workflow)
    print(f"  [{label}] prompt_id={pid}")
    job = cc.poll(pid, interval=2.0, timeout=300)
    print(f"  [{label}] status={job.get('status')} ({time.time()-t0:.1f}s)")
    if job.get("status") != "completed":
        print(f"  [{label}] FAIL:", job.get("execution_error"))
        return None
    outs = cc.extract_outputs(job)
    fn, sub, ty = outs[0]
    data = cc.download_view(fn, sub, ty)
    dst = OUT_DIR / f"compare_{label}_{fn}"
    dst.write_bytes(data)
    return dst


def main():
    print("uploading inputs...")
    hand_name = cc.upload_image(HAND)
    nail_name = cc.upload_image(NAIL)

    print("running Path A (hand+nail input, strong salon prompt)...")
    a = run(build(hand_name, nail_name, filename_prefix="pathA"), "A")
    print("running Path B (nail-only input, salon scene in text)...")
    b = run(build_nail_only(nail_name, filename_prefix="pathB"), "B")
    if not (a and b):
        raise SystemExit(1)

    # 2x2 comparison: [hand input, nail input] / [path A, path B]
    cell = 512
    label_h = 32
    panels = [
        (HAND, "Hand input (hand_A_fair)"),
        (NAIL, "Nail design input"),
        (a, "Path A: hand+nail multi-ref"),
        (b, "Path B: nail-only + salon prompt"),
    ]
    sheet = Image.new("RGB", (cell * 2, (cell + label_h) * 2), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = ImageFont.load_default()
    for i, (path, label) in enumerate(panels):
        r, c = divmod(i, 2)
        x, y = c * cell, r * (cell + label_h)
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((cell, cell), Image.LANCZOS)
            ox = x + (cell - im.width) // 2
            oy = y + (cell - im.height) // 2
            sheet.paste(im, (ox, oy))
        draw.rectangle([x, y + cell, x + cell, y + cell + label_h], fill="white")
        draw.text((x + 6, y + cell + 6), label, fill="black", font=font)

    out = OUT_DIR / "compare_sheet.jpg"
    sheet.save(out, "JPEG", quality=92)
    print(f"\ncomparison sheet → {out}")


if __name__ == "__main__":
    main()
