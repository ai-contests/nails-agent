#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


DEFAULT_ANALYZER_ROOT = "/Users/zhouxing/code/meituan/demo_v1"


def _unknown_payload(error: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": error,
        "hand_shape": "unknown",
        "hand_shape_confidence": 0.0,
        "skin_tone": "unknown",
        "skin_confidence": 0.0,
        "median_rgb": [0, 0, 0],
        "metrics": {},
        "color_metrics": {},
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps(_unknown_payload("missing image path"), ensure_ascii=False))
        return 2

    analyzer_root = Path(os.environ.get("HAND_ANALYZER_ROOT", DEFAULT_ANALYZER_ROOT)).resolve()
    if str(analyzer_root) not in sys.path:
        sys.path.insert(0, str(analyzer_root))

    try:
        from src.hand_analysis import analyze_hand_image
    except Exception as exc:
        print(json.dumps(_unknown_payload(f"failed to import hand analyzer: {exc}"), ensure_ascii=False))
        return 1

    try:
        result = analyze_hand_image(sys.argv[1])
        payload = {
            "ok": bool(result.get("ok")),
            "error": result.get("error"),
            "hand_shape": result.get("hand_shape", "unknown"),
            "hand_shape_confidence": result.get("hand_shape_confidence", 0.0),
            "skin_tone": result.get("skin_tone", "unknown"),
            "skin_confidence": result.get("skin_confidence", 0.0),
            "median_rgb": result.get("median_rgb", [0, 0, 0]),
            "metrics": result.get("metrics", {}),
            "color_metrics": result.get("color_metrics", {}),
        }
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps(_unknown_payload(f"failed to analyze image: {exc}"), ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
