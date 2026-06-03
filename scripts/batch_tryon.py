"""Batch try-on runner.

Reads data/pairs.csv, runs each pair through ComfyCloud + Nano Banana 2,
writes outputs to data/tryon_v2/, logs to data/tryon_v2/log.csv.

Optimizations:
  - Hand model files are uploaded ONCE up-front (since the same hand
    is reused ~7 times). Result names cached.
  - Nail refs are uploaded per-job (each is unique).
  - Resumable: skips pairs whose output already exists.
  - Parallel: ThreadPoolExecutor with --workers (default 6).
  - Robust: comfycloud Session has 502/503 retry; poll loop also retries.
"""
from __future__ import annotations
import argparse, csv, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfycloud as cc
from workflow import build

OUT_DIR = ROOT / "data/tryon_v2"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = OUT_DIR / "log.csv"


def _resolve(p: str) -> Path:
    """Resolve a path from pairs.csv — may be relative to ROOT or absolute."""
    pp = Path(p)
    if pp.is_absolute():
        return pp
    return ROOT / pp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=Path, default=ROOT / "data/pairs.csv")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    rows = list(csv.DictReader(args.pairs.open()))
    print(f"loaded {len(rows)} pairs")

    # Find pending work
    todo = [r for r in rows if not (OUT_DIR / r["out_name"]).exists()]
    print(f"pending: {len(todo)} / {len(rows)} (workers={args.workers})")
    if not todo:
        print("nothing to do.")
        return

    # Pre-upload the unique hand model images (14 of them).
    unique_hands = sorted({r["hand_path"] for r in todo})
    print(f"pre-uploading {len(unique_hands)} hand model image(s)...")
    hand_name_cache: dict[str, str] = {}
    for hp in unique_hands:
        hand_name_cache[hp] = cc.upload_image(_resolve(hp))
    print("  done.")

    log_exists = LOG_PATH.exists()
    log_lock = Lock()
    log_f = LOG_PATH.open("a", newline="")
    log_w = csv.writer(log_f)
    if not log_exists:
        log_w.writerow(["pair_id", "ok", "msg", "elapsed_s"])

    def run(row: dict) -> tuple[str, bool, str, float]:
        pid = row["pair_id"]
        ts = time.time()
        try:
            hand_name = hand_name_cache[row["hand_path"]]
            nail_name = cc.upload_image(_resolve(row["nail_path"]))
            wf = build(hand_name, nail_name, filename_prefix=pid)
            prompt_id = cc.submit(wf)
            job = cc.poll(prompt_id, interval=2.0, timeout=300)
            if job.get("status") != "completed":
                return pid, False, f"job_{job.get('status')}: {str(job.get('execution_error'))[:200]}", round(time.time()-ts, 2)
            outs = cc.extract_outputs(job)
            if not outs:
                return pid, False, "no_outputs", round(time.time()-ts, 2)
            fn, sub, ty = outs[0]
            data = cc.download_view(fn, sub, ty)
            (OUT_DIR / row["out_name"]).write_bytes(data)
            return pid, True, "ok", round(time.time()-ts, 2)
        except Exception as e:
            return pid, False, f"{type(e).__name__}: {str(e)[:200]}", round(time.time()-ts, 2)

    t0 = time.time()
    done = 0
    ok = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(run, r) for r in todo]
        for fut in as_completed(futs):
            pid, success, msg, dt = fut.result()
            done += 1
            ok += int(success)
            print(f"[{done}/{len(todo)}] {pid}  {'OK' if success else 'FAIL'}  {dt}s  {msg if not success else ''}")
            with log_lock:
                log_w.writerow([pid, success, msg, dt])
                log_f.flush()
    log_f.close()
    print(f"\ntotal: {done} done, {ok} ok, {done-ok} fail  in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
