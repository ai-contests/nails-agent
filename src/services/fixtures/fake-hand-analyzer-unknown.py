#!/usr/bin/env python3
import json
import sys


def main() -> None:
    print(json.dumps({
        "ok": True,
        "hand_shape": "unknown",
        "hand_shape_confidence": 0.0,
        "skin_tone": "natural",
        "skin_confidence": 0.8,
        "median_rgb": [220, 180, 140],
        "metrics": {},
        "color_metrics": {},
    }))


if __name__ == "__main__":
    main()

