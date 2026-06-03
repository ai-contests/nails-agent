"""Build the Nano Banana 2 two-image try-on workflow graph."""
from __future__ import annotations

SALON_SCENE = (
    "Minimalist high-end beauty catalog photo. One feminine hand, fingers "
    "elegantly relaxed, against a SEAMLESS PURE WHITE backdrop (no texture, "
    "no marble, no fabric, no flowers, no props). Soft even studio softbox "
    "lighting, very subtle shadow under the hand. Clean, airy, premium "
    "e-commerce aesthetic — like a Cocomo / OPI / Essie product shot. "
    "Sharp focus on the nails. Square crop. NO jewelry, NO bottles, "
    "NO text, NO background clutter."
)

PROMPT_WITH_HAND = (
    "IMAGE 1 is the canonical hand model. Reproduce IMAGE 1 EXACTLY: same "
    "hand(s), same skin tone, same finger pose and composition, same lighting, "
    "same soft white editorial backdrop. Do NOT change the hand, do NOT add a "
    "second hand if image 1 has one, do NOT remove a hand if image 1 has two.\n\n"
    "IMAGE 2 is a NAIL-DESIGN REFERENCE ONLY. Completely IGNORE the hand, "
    "fingers, background, and composition of image 2. Extract ONLY the nail "
    "polish design — its colors, pattern, finish (gloss/matte/chrome), and "
    "embellishments (rhinestones, glitter, foil, 3D charms) — and paint that "
    "design onto every fingernail of the hand from IMAGE 1.\n\n"
    "Wrap the design naturally around each nail's 3D curvature with realistic "
    "specular highlights and soft cuticle shadows. The result should look like "
    "IMAGE 1's hand model wearing the nail design from IMAGE 2. "
    "Photorealistic catalog quality."
)

PROMPT_NAIL_ONLY = (
    "Recreate this nail design on a hand model in this exact scene: "
    + SALON_SCENE +
    " Paint the fingernails in the EXACT design, colors, pattern, finish, "
    "and embellishments of the reference image, wrapped naturally around each "
    "nail's 3D curvature with realistic specular highlights and soft cuticle shadows. "
    "Choose a fair-to-medium skin tone, neat short-to-medium natural nail length."
)


MODEL_NB2 = "Nano Banana 2 (Gemini 3.1 Flash Image)"
MODEL_G3PRO = "gemini-3-pro-image-preview"


def build(hand_name: str, nail_name: str, *, seed: int = 42,
          resolution: str = "1K", filename_prefix: str = "tryon",
          model: str = MODEL_NB2) -> dict:
    """Path A: two-image input (hand as skin-tone anchor + nail as design)."""
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": hand_name}},
        "2": {"class_type": "LoadImage", "inputs": {"image": nail_name}},
        "3": {"class_type": "ImageBatch",
              "inputs": {"image1": ["1", 0], "image2": ["2", 0]}},
        "4": {
            "class_type": "GeminiImage2Node",
            "inputs": {
                "prompt": PROMPT_WITH_HAND,
                "model": model,
                "seed": seed,
                "aspect_ratio": "1:1",
                "resolution": resolution,
                "response_modalities": "IMAGE",
                "images": ["3", 0],
            },
        },
        "5": {"class_type": "SaveImage",
              "inputs": {"images": ["4", 0], "filename_prefix": filename_prefix}},
    }


PROMPT_BG_WASH = (
    "Keep the hand, fingers, skin tone, nail shape, nail color, nail design, "
    "pattern, embellishments, and lighting on the nails ALL EXACTLY identical "
    "to the input. Only replace the background with a SEAMLESS PURE WHITE "
    "backdrop (no texture, no shadows on the background, no props, no "
    "flowers, no fabric, no bottles, no rings/jewelry on the hand if any). "
    "The hand should appear to float on white as a clean e-commerce "
    "product shot. Add a very subtle soft shadow directly under the hand. "
    "Do NOT change the nail design or hand pose in any way."
)


CANONICAL_HAND_COMMON = (
    "{bg}. Soft even studio softbox lighting, very subtle natural shadow. "
    "Natural short clean unpolished nails (no polish), neat cuticles, "
    "well-groomed. {skin} skin tone. Sharp focus on the nails. Square crop. "
    "Premium nail-care e-commerce catalog aesthetic, K-beauty / Cocomo / "
    "Slllight / OPI catalog style — pastel product photography, soft and airy, "
    "feminine. NO jewelry, NO product boxes, NO text, NO watermark."
)

# Pastel backdrop variants (matching Cocomo / Slllight product pages —
# never harsh pure-white; always a soft tinted backdrop with gentle gradient).
BACKDROPS: dict[str, str] = {
    "offwhite": (
        "Soft off-white / cream paper backdrop with the faintest warm gradient "
        "from upper-left to lower-right, like a high-end beauty editorial set"
    ),
    "softblue": (
        "Soft pastel ice-blue solid backdrop with a very gentle vertical "
        "gradient (slightly lighter at top), Cocomo / Slllight style"
    ),
    "softpink": (
        "Soft pastel powder-pink backdrop with a very gentle gradient, K-beauty "
        "catalog feel"
    ),
    "softbeige": (
        "Soft warm beige / nude backdrop with a very gentle gradient, "
        "minimal and clean"
    ),
}

# 6 distinct cocomo-inspired hand poses. Each describes the pose so the model
# can generate a fresh hand with maximum nail visibility in that composition.
HAND_POSES: dict[str, str] = {
    "palm_down_top": (
        "A single feminine hand viewed from directly above, palm facing down "
        "against the backdrop, fingers gently and naturally spread apart so "
        "all five fingernails face the camera and are fully visible. "
        "Top-down camera angle. "
    ),
    "fist_thumb_up": (
        "A single feminine hand in a softly closed loose fist, viewed from "
        "the back of the hand (knuckles facing the camera, thumb tucked at "
        "the side pointing up). All five fingernails sit on top of the curled "
        "knuckles and are fully visible from the front-3/4 angle. "
    ),
    "two_hands_clasped": (
        "Two feminine hands gently clasped together, fingers interlaced or "
        "softly resting against each other, raised vertically in front of the "
        "camera so all ten fingernails face the lens. Front view, both palms "
        "facing inward to each other. "
    ),
    "reaching_down": (
        "A single feminine hand entering from the top of the frame, hanging "
        "down softly with fingers relaxed and slightly spread, palm facing "
        "the camera so all five fingernails are clearly visible. Wrist and "
        "forearm fade out at the top edge. "
    ),
    "fingers_cupped": (
        "A single feminine hand cupping gently as if holding a tiny invisible "
        "ball, palm facing the camera and fingers curling inward in a "
        "graceful arc so all five fingernails are visible in a front-3/4 "
        "view. "
    ),
    "side_elegant": (
        "A single feminine hand in profile / side view, fingers gracefully "
        "extended outward to one side with a slight downward curve, showing "
        "the elegant nail length and almond-shape curvature of every "
        "fingernail. The side of the hand and thumb are visible. "
    ),
}


def build_canonical_hand(skin: str, pose_key: str, bg_key: str = "offwhite", *,
                         seed: int = 42,
                         filename_prefix: str = "hand_canon",
                         model: str = MODEL_NB2) -> dict:
    """Text-to-image: generate a canonical hand model with pose + skin + backdrop."""
    pose_desc = HAND_POSES[pose_key]
    prompt = pose_desc + CANONICAL_HAND_COMMON.format(
        skin=skin, bg=BACKDROPS[bg_key])
    return {
        "4": {
            "class_type": "GeminiImage2Node",
            "inputs": {
                "prompt": prompt,
                "model": model,
                "seed": seed,
                "aspect_ratio": "1:1",
                "resolution": "1K",
                "response_modalities": "IMAGE",
            },
        },
        "5": {"class_type": "SaveImage",
              "inputs": {"images": ["4", 0], "filename_prefix": filename_prefix}},
    }


def build_bg_wash(image_name: str, *, seed: int = 42,
                  resolution: str = "1K", filename_prefix: str = "bgwash",
                  model: str = MODEL_NB2) -> dict:
    """Single-image edit: replace background with seamless white, preserve nails."""
    return {
        "2": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "4": {
            "class_type": "GeminiImage2Node",
            "inputs": {
                "prompt": PROMPT_BG_WASH,
                "model": model,
                "seed": seed,
                "aspect_ratio": "auto",
                "resolution": resolution,
                "response_modalities": "IMAGE",
                "images": ["2", 0],
            },
        },
        "5": {"class_type": "SaveImage",
              "inputs": {"images": ["4", 0], "filename_prefix": filename_prefix}},
    }


def build_nail_only(nail_name: str, *, seed: int = 42,
                    resolution: str = "1K", filename_prefix: str = "tryon",
                    model: str = MODEL_NB2) -> dict:
    """Path B: single nail-design image, salon scene fully described in text."""
    return {
        "2": {"class_type": "LoadImage", "inputs": {"image": nail_name}},
        "4": {
            "class_type": "GeminiImage2Node",
            "inputs": {
                "prompt": PROMPT_NAIL_ONLY,
                "model": model,
                "seed": seed,
                "aspect_ratio": "1:1",
                "resolution": resolution,
                "response_modalities": "IMAGE",
                "images": ["2", 0],
            },
        },
        "5": {"class_type": "SaveImage",
              "inputs": {"images": ["4", 0], "filename_prefix": filename_prefix}},
    }


