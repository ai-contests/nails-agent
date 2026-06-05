#!/usr/bin/env python3
import json
import sys


def main() -> None:
    image_path = sys.argv[1] if len(sys.argv) > 1 else ""
    print(json.dumps({
        "ok": True,
        "hand_shape": "square_palm",
        "hand_shape_confidence": 0.84,
        "skin_tone": "warm_yellow",
        "skin_confidence": 0.76,
        "median_rgb": [220, 180, 140],
        "metrics": {"image_path": image_path, "palm_width_ratio": 0.96},
        "color_metrics": {"lab_l": 68.2, "lab_b": 21.4},
    }))


if __name__ == "__main__":
    main()
