"""End-to-end smoke test: 1 hand + 1 nail → 1 try-on via ComfyCloud + Nano Banana 2."""
from __future__ import annotations
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build

HAND = ROOT / "data/hand_models/hand_A_fair.jpg"
NAIL = Path("/Users/nev4rb14su/workspace/dataset/nails_agent/processed/nails_1024/nails_24144c1d3a.jpg")
OUT_DIR = ROOT / "data/tryon_v2"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    print(f"hand: {HAND.name}  ({HAND.stat().st_size//1024} KB)")
    print(f"nail: {NAIL.name}  ({NAIL.stat().st_size//1024} KB)")
    assert HAND.exists() and NAIL.exists()

    print("uploading hand...")
    hand_name = cc.upload_image(HAND)
    print(f"  → {hand_name}")
    print("uploading nail...")
    nail_name = cc.upload_image(NAIL)
    print(f"  → {nail_name}")

    wf = build(hand_name, nail_name, filename_prefix="smoke_g3pro")
    print("submitting workflow...")
    pid = cc.submit(wf)
    print(f"  prompt_id={pid}")

    print("polling...")
    t0 = time.time()
    job = cc.poll(pid, interval=2.0, timeout=300)
    print(f"  status={job.get('status')} ({time.time()-t0:.1f}s)")
    if job.get("status") != "completed":
        print("FAIL:", job.get("execution_error"))
        raise SystemExit(1)

    outs = cc.extract_outputs(job)
    print(f"  {len(outs)} output file(s)")
    for fn, sub, ty in outs:
        data = cc.download_view(fn, sub, ty)
        dst = OUT_DIR / f"smoke_{fn}"
        dst.write_bytes(data)
        print(f"  saved → {dst}")


if __name__ == "__main__":
    main()
