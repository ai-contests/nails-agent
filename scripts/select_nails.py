"""Auto-select 50 distinct nail-design refs from the Pinterest pool.

Usage:
  export NAILS_PINTEREST_ROOT=/path/to/pinterest/Search
  python3 scripts/select_nails.py

Or:
  python3 scripts/select_nails.py --root /path/to/pinterest/Search

Strategy:
  - Pool: all images under raw/nails/pinterest/Search/*/  (140 total: 60 jp + 80 kr)
  - Reject too-small or unreadable images.
  - Deduplicate by perceptual hash (8x8 dhash, hamming<=4 = dup).
  - Sample to a target of 50 with balanced query coverage.

Writes the chosen filenames to data/nail_refs.csv with columns:
  index,source_path,query
"""
from __future__ import annotations
import argparse, csv, hashlib, os, random
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def dhash(path: Path, size: int = 8) -> int | None:
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("L").resize(
                (size + 1, size), Image.LANCZOS)
        bits = 0
        px = im.load()
        for y in range(size):
            for x in range(size):
                bits = (bits << 1) | (1 if px[x, y] > px[x + 1, y] else 0)
        return bits
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def main():
    ap = argparse.ArgumentParser()
    default_root = os.environ.get("NAILS_PINTEREST_ROOT", "")
    ap.add_argument("--root", type=Path,
                    default=Path(default_root) if default_root else None,
                    help="Pinterest raw image directory (or set NAILS_PINTEREST_ROOT env var)")
    ap.add_argument("--out", type=Path,
                    default=Path("data/nail_refs.csv"))
    ap.add_argument("--target", type=int, default=50)
    ap.add_argument("--min-side", type=int, default=512)
    ap.add_argument("--dup-threshold", type=int, default=4)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    if args.root is None:
        ap.error("--root is required (or set NAILS_PINTEREST_ROOT env var)")

    rng = random.Random(args.seed)
    queries = sorted([d.name for d in args.root.iterdir() if d.is_dir()])
    pool: list[tuple[Path, str, int]] = []
    rejected = {"small": 0, "bad": 0}
    for q in queries:
        for p in sorted((args.root / q).iterdir()):
            if p.suffix.lower() not in EXTS:
                continue
            try:
                with Image.open(p) as im:
                    w, h = im.size
                if min(w, h) < args.min_side:
                    rejected["small"] += 1
                    continue
            except (UnidentifiedImageError, OSError):
                rejected["bad"] += 1
                continue
            h = dhash(p)
            if h is None:
                rejected["bad"] += 1
                continue
            pool.append((p, q, h))
    print(f"pool after size filter: {len(pool)}  rejected={rejected}")

    # dedupe within pool
    deduped: list[tuple[Path, str, int]] = []
    for item in pool:
        if all(hamming(item[2], k[2]) > args.dup_threshold for k in deduped):
            deduped.append(item)
    print(f"after dedupe (hamming>{args.dup_threshold}): {len(deduped)}")

    # balanced sample across queries
    by_q: dict[str, list] = {}
    for it in deduped:
        by_q.setdefault(it[1], []).append(it)
    for q in by_q:
        rng.shuffle(by_q[q])

    picks: list = []
    while len(picks) < args.target and any(by_q.values()):
        for q in queries:
            if by_q.get(q):
                picks.append(by_q[q].pop())
                if len(picks) >= args.target:
                    break
    print(f"selected: {len(picks)}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["index", "source_path", "query"])
        for i, (p, q, _) in enumerate(picks):
            # Store path relative to --root so the CSV is machine-independent
            rel = p.relative_to(args.root)
            w.writerow([i, str(rel), q])
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
