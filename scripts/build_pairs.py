"""Build the 100-pair try-on manifest.

Hand pool: 14 (5 poses × 3 skins, minus two_hands_clasped/medium).
Designs: 50 existing enhanced_style_*.png + 50 Pinterest (from data/nail_refs.csv).
Distribution: round-robin → ~7 designs/hand, balanced across skin tones.

Output: data/pairs.csv with columns
  pair_id, hand_path, hand_tag, nail_path, nail_source, out_name
"""
from __future__ import annotations
import csv, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / "data/hand_models/pool"

# Explicit hand-pool list — drops two_hands_clasped/medium.
POSES = ["palm_down_top", "fist_thumb_up", "two_hands_clasped",
         "reaching_down", "fingers_cupped"]
SKINS = ["fair", "medium", "deep"]
EXCLUDE = {("two_hands_clasped", "medium")}


def find_hand(pose: str, skin: str) -> Path:
    cand = sorted(POOL.glob(f"hand_{pose}_{skin}_*.png"))
    if cand:
        return cand[0]
    raise FileNotFoundError(f"no hand image for {pose}/{skin}")


def main():
    hands: list[tuple[str, Path]] = []
    for p in POSES:
        for s in SKINS:
            if (p, s) in EXCLUDE:
                continue
            hands.append((f"{p}_{s}", find_hand(p, s)))
    assert len(hands) == 14, f"expected 14 hands, got {len(hands)}"

    enhanced = sorted((ROOT / "data/styles").glob("enhanced_style_*.png"))
    assert len(enhanced) == 50, f"expected 50 enhanced_style, got {len(enhanced)}"

    pinterest_csv = ROOT / "data/nail_refs.csv"
    # nail_refs.csv stores paths relative to NAILS_PINTEREST_ROOT
    pinterest_root = os.environ.get("NAILS_PINTEREST_ROOT", "")
    if not pinterest_root:
        raise SystemExit(
            "ERROR: set NAILS_PINTEREST_ROOT env var to resolve Pinterest paths in nail_refs.csv"
        )
    pinterest_root = Path(pinterest_root)
    pinterest = [
        pinterest_root / r["source_path"]
        for r in csv.DictReader(pinterest_csv.open())
    ]
    assert len(pinterest) == 50, f"expected 50 Pinterest, got {len(pinterest)}"

    nails = [(p, "enhanced") for p in enhanced] + [(p, "pinterest") for p in pinterest]
    # Interleave the two sources so each hand sees a mix.
    interleaved: list = []
    for i in range(50):
        interleaved.append(nails[i])           # enhanced[i]
        interleaved.append(nails[50 + i])      # pinterest[i]
    assert len(interleaved) == 100

    rows = []
    for i, (nail_path, src) in enumerate(interleaved):
        hand_tag, hand_path = hands[i % len(hands)]
        pid = f"canon_{i:03d}_{hand_tag}"
        rows.append({
            "pair_id": pid,
            "hand_path": str(hand_path.relative_to(ROOT)),
            "hand_tag": hand_tag,
            "nail_path": str(nail_path.relative_to(ROOT)) if nail_path.is_relative_to(ROOT) else str(nail_path),
            "nail_source": src,
            "out_name": f"{pid}.png",
        })

    out = ROOT / "data/pairs.csv"
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {out}  ({len(rows)} pairs across {len(hands)} hands)")
    # Distribution sanity
    from collections import Counter
    by_hand = Counter(r["hand_tag"] for r in rows)
    print("per-hand counts:")
    for k, v in sorted(by_hand.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
