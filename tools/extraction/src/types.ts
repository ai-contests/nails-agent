export interface RoboflowPoint {
  x: number;
  y: number;
}

export interface RoboflowPrediction {
  points: RoboflowPoint[];
  confidence: number;
  class?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image?: { width: number; height: number };
}

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorClusterResult {
  primaryColorRgb: RGB;
  primaryColorFamily: string;
  primaryColorNameZh: string;
  dominantPalette: RGB[];
  colorConfidence: number;
}

export type LengthTag = 'short' | 'medium' | 'long' | 'unknown';

export interface LengthResult {
  lengthTag: LengthTag;
  lengthRatio: number;
  lengthConfidence: number;
}

export interface StyleManifestEntry {
  style_id: string;
  source: 'enhanced' | 'candidate';
  image_path: string;
  image_width: number;
  image_height: number;
  nail_count: number;
  bboxes: BBox[];
  primary_color_family: string;
  primary_color_name: string;
  primary_color_rgb: [number, number, number];
  dominant_palette: [number, number, number][];
  color_confidence: number;
  length_tag: LengthTag;
  length_ratio: number;
  length_confidence: number;
  extractor_version: string;
  extracted_at: string;
}
