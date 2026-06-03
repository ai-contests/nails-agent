"""Re-roll a single hand model candidate with a different seed."""
from __future__ import annotations
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build_canonical_hand
from gen_hand_pool import pick_bg, SKINS

# What to re-roll: two_hands_clasped on medium-skin.
POSE = "two_hands_clasped"
SKIN_TAG = "medium"
SEEDS_TO_TRY = [101, 202, 303]  # try multiple, keep best — user can pick
OUT_DIR = ROOT / "data/hand_models/pool"


def main():
    skin_desc = dict(SKINS)[SKIN_TAG]
    bg = pick_bg(POSE, SKIN_TAG)
    print(f"target: {POSE}/{SKIN_TAG} on {bg} backdrop")
    for s in SEEDS_TO_TRY:
        wf = build_canonical_hand(skin_desc, POSE, bg_key=bg, seed=s,
                                  filename_prefix=f"hp_reroll_{POSE}_{SKIN_TAG}_seed{s}")
        t0 = time.time()
        pid = cc.submit(wf)
        job = cc.poll(pid, interval=2.0, timeout=300)
        print(f"  seed={s}  status={job.get('status')} ({time.time()-t0:.1f}s)")
        if job.get("status") != "completed":
            print("  FAIL:", job.get("execution_error"))
            continue
        fn, sub, ty = cc.extract_outputs(job)[0]
        data = cc.download_view(fn, sub, ty)
        dst = OUT_DIR / f"reroll_{POSE}_{SKIN_TAG}_{bg}_seed{s}.png"
        dst.write_bytes(data)
        print(f"  → {dst.name}")


if __name__ == "__main__":
    main()
