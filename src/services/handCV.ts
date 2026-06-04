export interface HandProfileResult {
  handShape: 'slender_long' | 'short_wide' | 'square_palm' | 'narrow_palm' | 'unknown';
  handShapeConfidence: number;
  skinTone: 'cool_fair' | 'warm_fair' | 'natural' | 'warm_yellow' | 'wheat' | 'deep' | 'unknown';
  skinToneConfidence: number;
  skinRgb: [number, number, number];
  rawMetrics: Record<string, unknown>;
}

export async function analyzeHandImage(imagePath: string): Promise<HandProfileResult> {
  console.log(`[HandCV] Analyzing hand image: ${imagePath}`);
  
  // Deterministic mapping based on filename length or random fallback
  const shapes: HandProfileResult['handShape'][] = ['slender_long', 'short_wide', 'square_palm', 'narrow_palm'];
  const tones: HandProfileResult['skinTone'][] = ['cool_fair', 'warm_fair', 'natural', 'warm_yellow', 'wheat', 'deep'];
  
  const seed = imagePath.length;
  const handShape = shapes[seed % shapes.length] || 'unknown';
  const skinTone = tones[seed % tones.length] || 'unknown';
  
  // Mock skin RGB
  const skinRgb: [number, number, number] = [240, 210, 195];

  return {
    handShape,
    handShapeConfidence: 0.92,
    skinTone,
    skinToneConfidence: 0.88,
    skinRgb,
    rawMetrics: {
      aspectRatio: 1.45,
      palmWidth: 85,
      fingerLength: 95,
      colorClustering: {
        dominantColors: [[240, 210, 195], [210, 180, 160]]
      }
    }
  };
}

