import { readFile } from 'node:fs/promises';
import type { RoboflowResponse } from './types.ts';

const DETECT_URL = 'https://detect.roboflow.com';

export interface RoboflowConfig {
  apiKey: string;
  modelId: string;
  confidence?: number;
}

// Roboflow hosted detect API:
// POST https://detect.roboflow.com/{model_id}?api_key=KEY&confidence=N
// body: base64-encoded image as form-urlencoded
export async function inferSegmentation(
  imagePath: string,
  cfg: RoboflowConfig,
): Promise<RoboflowResponse> {
  const imgBuf = await readFile(imagePath);
  const b64 = imgBuf.toString('base64');

  const url = new URL(`${DETECT_URL}/${cfg.modelId}`);
  url.searchParams.set('api_key', cfg.apiKey);
  if (cfg.confidence !== undefined) {
    url.searchParams.set('confidence', String(Math.round(cfg.confidence * 100)));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: b64,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Roboflow ${res.status} for ${imagePath}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as RoboflowResponse;
  if (!json.predictions) {
    throw new Error(`Roboflow returned no .predictions for ${imagePath}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}
