"""Generate the canonical hand-model pool: 6 poses x 3 skin tones = 18 images.

Runs in parallel (4 workers) and outputs a contact sheet so you can pick
which combos are worth keeping for the 100-image try-on batch.
"""
from __future__ import annotations
import sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
import random
from workflow import build_canonical_hand, HAND_POSES, BACKDROPS

POSES = list(HAND_POSES.keys())
SKINS = [
    ("fair",   "fair / light East-Asian"),
    ("medium", "medium warm beige"),
    ("deep",   "deep rich brown"),
]
BG_KEYS = list(BACKDROPS.keys())  # offwhite, softblue, softpink, softbeige
OUT_DIR = ROOT / "data/hand_models/pool"
OUT_DIR.mkdir(parents=True, exist_ok=True)

_rng = random.Random(7)


def pick_bg(pose: str, skin: str) -> str:
    """Deterministic per (pose, skin) backdrop assignment so re-runs are stable."""
    h = hash((pose, skin, 7)) & 0xffffffff
    return BG_KEYS[h % len(BG_KEYS)]


def run_one(pose: str, skin_tag: str, skin_desc: str) -> tuple[str, str, Path | None, str]:
    bg = pick_bg(pose, skin_tag)
    dst = OUT_DIR / f"hand_{pose}_{skin_tag}_{bg}.png"
    if dst.exists():
        return pose, skin_tag, dst, f"skip ({bg})"
    try:
        wf = build_canonical_hand(skin_desc, pose, bg_key=bg,
                                  filename_prefix=f"hp_{pose}_{skin_tag}_{bg}")
        pid = cc.submit(wf)
        job = cc.poll(pid, interval=2.0, timeout=300)
        if job.get("status") != "completed":
            return pose, skin_tag, None, f"FAIL {job.get('execution_error')}"
        fn, sub, ty = cc.extract_outputs(job)[0]
        dst.write_bytes(cc.download_view(fn, sub, ty))
        return pose, skin_tag, dst, "ok"
    except Exception as e:
        return pose, skin_tag, None, f"EXC {type(e).__name__}: {e}"


def main():
    tasks = [(p, t, d) for p in POSES for (t, d) in SKINS]
    print(f"running {len(tasks)} t2i jobs (4 workers)...")
    t0 = time.time()
    results: dict[tuple[str, str], Path] = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(run_one, p, t, d): (p, t) for (p, t, d) in tasks}
        done = 0
        for fut in as_completed(futs):
            pose, skin, path, msg = fut.result()
            done += 1
            print(f"  [{done}/{len(tasks)}] {pose}/{skin}  {msg}")
            if path:
                results[(pose, skin)] = path
    print(f"total {time.time()-t0:.1f}s — {len(results)}/{len(tasks)} ok")

    # contact sheet: rows = poses, cols = skins
    cell = 360
    label_h = 26
    cols = len(SKINS)
    rows = len(POSES)
    W = cell * cols
    H = (cell + label_h) * rows + 30
    sheet = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font = title_font = ImageFont.load_default()
    for c, (skin, _) in enumerate(SKINS):
        draw.text((c * cell + 8, 4), skin, fill="black", font=title_font)
    for r, pose in enumerate(POSES):
        y0 = 30 + r * (cell + label_h)
        for c, (skin, _) in enumerate(SKINS):
            x = c * cell
            p = results.get((pose, skin))
            if p:
                with Image.open(p) as im:
                    im = im.convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
                    sheet.paste(im, (x + (cell - im.width) // 2, y0 + (cell - im.height) // 2))
            draw.text((x + 6, y0 + cell + 4), f"{pose}/{skin}", fill="black", font=font)
    out = OUT_DIR / "pool_sheet.jpg"
    sheet.save(out, "JPEG", quality=90)
    print(f"sheet → {out}")


if __name__ == "__main__":
    main()
