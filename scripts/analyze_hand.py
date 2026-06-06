import sys
import os
import json
import numpy as np
import cv2
import mediapipe as mp
from pathlib import Path

# MediaPipe options
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

MODEL_PATH = Path(__file__).resolve().parent.parent / "data" / "hand_landmarker.task"

def load_landmarker():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=VisionRunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.05,
        min_hand_presence_confidence=0.05
    )
    return HandLandmarker.create_from_options(options)

def calculate_distance(p1, p2):
    return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2 + (p1[2] - p2[2])**2)

def extract_traditional_cv_features(img):
    h, w, c = img.shape
    
    # Convert to YCrCb space for human skin detection
    img_ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    lower_skin = np.array([0, 133, 77], dtype=np.uint8)
    upper_skin = np.array([255, 173, 127], dtype=np.uint8)
    
    mask = cv2.inRange(img_ycrcb, lower_skin, upper_skin)
    
    # Morphological operations to filter noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.erode(mask, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=2)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
        
    max_contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(max_contour) < 5000:
        return None
        
    # Minimum area bounding box to find aspect ratio regardless of orientation
    rect = cv2.minAreaRect(max_contour)
    (cx, cy), (width, height), angle = rect
    
    major = max(width, height)
    minor = min(width, height)
    aspect_ratio = major / max(minor, 0.01)
    
    # Classify hand shape based on aspect ratio
    if aspect_ratio >= 1.55:
        hand_shape = "slender_long"
    elif aspect_ratio < 1.35:
        hand_shape = "short_wide"
    elif aspect_ratio >= 1.45:
        hand_shape = "narrow_palm"
    else:
        hand_shape = "square_palm"
        
    # Sample skin color inside the contour mask
    skin_pixels = img[mask > 0]
    if len(skin_pixels) > 0:
        avg_bgr = np.mean(skin_pixels, axis=0)
        avg_rgb = [int(avg_bgr[2]), int(avg_bgr[1]), int(avg_bgr[0])]
    else:
        # Fallback to center
        sample_window = img[max(0, h//2-10):min(h, h//2+11), max(0, w//2-10):min(w, w//2+11)]
        avg_bgr = np.mean(sample_window, axis=(0, 1))
        avg_rgb = [int(avg_bgr[2]), int(avg_bgr[1]), int(avg_bgr[0])]
        
    r, g, b = avg_rgb
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    
    if luma >= 210:
        skin_tone = "warm_fair" if r - b > 18 else "cool_fair"
    elif luma >= 170:
        skin_tone = "warm_yellow" if r - b > 25 else "natural"
    elif luma >= 110:
        skin_tone = "wheat"
    else:
        skin_tone = "deep"
        
    return {
        "handShape": hand_shape,
        "handShapeConfidence": 0.60,
        "skinTone": skin_tone,
        "skinToneConfidence": 0.70,
        "skinRgb": avg_rgb,
        "rawMetrics": {
            "method": "traditional_cv_contour_fallback",
            "aspect_ratio": float(aspect_ratio),
            "contour_area": float(cv2.contourArea(max_contour)),
            "sampled_luma": float(luma),
            "sampled_rgb": avg_rgb
        }
    }

def extract_features(image_path: str, landmarker):
    img = cv2.imread(image_path)
    if img is None:
        return {"error": f"Failed to read image: {image_path}"}

    h, w, c = img.shape
    mp_image = mp.Image.create_from_file(image_path)
    detection_result = landmarker.detect(mp_image)

    # Default fallbacks
    hand_shape = "unknown"
    skin_tone = "unknown"
    hand_shape_confidence = 0.0
    skin_tone_confidence = 0.0
    skin_rgb = [240, 210, 195] # Default natural skin
    raw_metrics = {}

    if detection_result.hand_landmarks:
        # We take the first detected hand
        landmarks = detection_result.hand_landmarks[0]
        
        # 3D points in normalized coordinates
        # 0: Wrist, 5: Index MCP, 9: Middle MCP, 12: Middle Tip, 17: Pinky MCP
        p0 = (landmarks[0].x, landmarks[0].y, landmarks[0].z)
        p5 = (landmarks[5].x, landmarks[5].y, landmarks[5].z)
        p9 = (landmarks[9].x, landmarks[9].y, landmarks[9].z)
        p12 = (landmarks[12].x, landmarks[12].y, landmarks[12].z)
        p17 = (landmarks[17].x, landmarks[17].y, landmarks[17].z)

        # Calculate distances
        palm_width = calculate_distance(p5, p17)
        palm_length = calculate_distance(p0, p9)
        finger_length = calculate_distance(p9, p12)

        finger_to_palm = finger_length / max(palm_length, 0.01)
        palm_aspect = palm_length / max(palm_width, 0.01)

        raw_metrics = {
            "palm_width": float(palm_width),
            "palm_length": float(palm_length),
            "finger_length": float(finger_length),
            "finger_to_palm_ratio": float(finger_to_palm),
            "palm_aspect_ratio": float(palm_aspect)
        }

        # Classify Hand Shape
        hand_shape_confidence = 0.95
        # Refined classifier rules
        if finger_to_palm >= 0.88 and palm_aspect >= 1.05:
            hand_shape = "slender_long"
        elif finger_to_palm < 0.80 and palm_aspect < 1.10:
            hand_shape = "short_wide"
        elif palm_aspect >= 1.20:
            hand_shape = "narrow_palm"
        else:
            hand_shape = "square_palm"

        # Locate Palm Center for skin tone sampling (average of Wrist, Index base, Middle base, Pinky base)
        cx_norm = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 4.0
        cy_norm = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 4.0

        cx = int(cx_norm * w)
        cy = int(cy_norm * h)

        # Ensure bounds
        cx = max(10, min(w - 10, cx))
        cy = max(10, min(h - 10, cy))

        # Sample a 15x15 window in OpenCV (BGR)
        sample_window = img[cy-7:cy+8, cx-7:cx+8]
        avg_bgr = np.mean(sample_window, axis=(0, 1))
        avg_rgb = [float(avg_bgr[2]), float(avg_bgr[1]), float(avg_bgr[0])] # Convert to RGB
        skin_rgb = [int(x) for x in avg_rgb]

        # Classify skin tone based on RGB brightness and balance
        r, g, b = avg_rgb
        luma = 0.299 * r + 0.587 * g + 0.114 * b # standard luminance
        skin_tone_confidence = 0.90

        # Refined skin tone rules
        if luma >= 210:
            # Fair skins: check red/blue balance for cool vs warm fair
            if r - b > 18:
                skin_tone = "warm_fair"
            else:
                skin_tone = "cool_fair"
        elif luma >= 170:
            # Check yellow tint
            if r - b > 25:
                skin_tone = "warm_yellow"
            else:
                skin_tone = "natural"
        elif luma >= 110:
            skin_tone = "wheat"
        else:
            skin_tone = "deep"

        raw_metrics["sampled_luma"] = float(luma)
        raw_metrics["sampled_rgb"] = [int(x) for x in avg_rgb]
    else:
        # Fallback to traditional CV contour analysis
        cv_result = extract_traditional_cv_features(img)
        if cv_result:
            hand_shape = cv_result["handShape"]
            hand_shape_confidence = cv_result["handShapeConfidence"]
            skin_tone = cv_result["skinTone"]
            skin_tone_confidence = cv_result["skinToneConfidence"]
            skin_rgb = cv_result["skinRgb"]
            raw_metrics = cv_result["rawMetrics"]
        else:
            # Final fallback to center of image for skin color sample
            cx, cy = w // 2, h // 2
            sample_window = img[max(0, cy-10):min(h, cy+11), max(0, cx-10):min(w, cx+11)]
            avg_bgr = np.mean(sample_window, axis=(0, 1))
            avg_rgb = [int(avg_bgr[2]), int(avg_bgr[1]), int(avg_bgr[0])]
            skin_rgb = avg_rgb
            
            # Simple fallback tone based on center colors
            r, g, b = avg_rgb
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            if luma >= 200:
                skin_tone = "natural"
            elif luma >= 120:
                skin_tone = "wheat"
            else:
                skin_tone = "deep"
                
            hand_shape = "slender_long" # Default standard hand shape
            hand_shape_confidence = 0.50
            skin_tone_confidence = 0.50
            raw_metrics["note"] = "No hand contour detected. Falling back to center color and default shape."
            raw_metrics["sampled_luma"] = float(luma)
            raw_metrics["sampled_rgb"] = avg_rgb

    return {
        "handShape": hand_shape,
        "handShapeConfidence": float(hand_shape_confidence),
        "skinTone": skin_tone,
        "skinToneConfidence": float(skin_tone_confidence),
        "skinRgb": skin_rgb,
        "rawMetrics": raw_metrics
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 analyze_hand.py <image_path>")
        sys.exit(1)
        
    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    try:
        with load_landmarker() as landmarker:
            result = extract_features(image_path, landmarker)
            print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
