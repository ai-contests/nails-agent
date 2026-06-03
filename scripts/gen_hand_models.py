"""Generate 3 canonical hand models (fair / medium / deep) via Nano Banana 2 text-to-image."""
from __future__ import annotations
import sys, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build_canonical_hand

OUT_DIR = ROOT / "data/hand_models/candidates"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SKINS = [
    ("fair",   "fair / light East-Asian"),
    ("medium", "medium warm beige"),
    ("deep",   "deep rich brown"),
]


def main():
    saved = []
    for tag, descriptor in SKINS:
        wf = build_canonical_hand(descriptor, filename_prefix=f"hand_canon_{tag}")
        t0 = time.time()
        pid = cc.submit(wf)
        print(f"[{tag}] prompt_id={pid}")
        job = cc.poll(pid, interval=2.0, timeout=300)
        print(f"[{tag}] status={job.get('status')} ({time.time()-t0:.1f}s)")
        if job.get("status") != "completed":
            print(f"[{tag}] FAIL:", job.get("execution_error"))
            continue
        fn, sub, ty = cc.extract_outputs(job)[0]
        data = cc.download_view(fn, sub, ty)
        dst = OUT_DIR / f"hand_canon_{tag}.png"
        dst.write_bytes(data)
        saved.append((tag, dst))
        print(f"[{tag}] saved → {dst}")

    # contact sheet
    cell = 512
    label_h = 28
    sheet = Image.new("RGB", (cell * len(saved), cell + label_h), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = ImageFont.load_default()
    for col, (tag, p) in enumerate(saved):
        x = col * cell
        with Image.open(p) as im:
            im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
            sheet.paste(im, (x + (cell - im.width) // 2, (cell - im.height) // 2))
        draw.text((x + 6, cell + 4), f"candidate: {tag}", fill="black", font=font)
    out = OUT_DIR / "candidates_sheet.jpg"
    sheet.save(out, "JPEG", quality=92)
    print(f"\nsheet → {out}")


if __name__ == "__main__":
    main()
