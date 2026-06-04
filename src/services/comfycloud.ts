import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env['COMFYCLOUD_BASE'] || 'https://cloud.comfy.org/api';
const KEY = process.env['COMFYCLOUD_API_KEY'] || '';

const PROMPT_WITH_HAND = 
  'IMAGE 1 is the canonical hand model. Reproduce IMAGE 1 EXACTLY: same ' +
  'hand(s), same skin tone, same finger pose and composition, same lighting, ' +
  'same soft white editorial backdrop. Do NOT change the hand, do NOT add a ' +
  'second hand if image 1 has one, do NOT remove a hand if image 1 has two.\n\n' +
  'IMAGE 2 is a NAIL-DESIGN REFERENCE ONLY. Completely IGNORE the hand, ' +
  'fingers, background, and composition of image 2. Extract ONLY the nail ' +
  'polish design — its colors, pattern, finish (gloss/matte/chrome), and ' +
  'embellishments (rhinestones, glitter, foil, 3D charms) — and paint that ' +
  'design onto every fingernail of the hand from IMAGE 1.\n\n' +
  'Wrap the design naturally around each nail\'s 3D curvature with realistic ' +
  'specular highlights and soft cuticle shadows. The result should look like ' +
  'IMAGE 1\'s hand model wearing the nail design from IMAGE 2. ' +
  'Photorealistic catalog quality.';

const MODEL_NB2 = 'Nano Banana 2 (Gemini 3.1 Flash Image)';

export interface ComfyJobOutputImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

export interface ComfyJobResult {
  status: string;
  outputs?: Record<string, { images?: ComfyJobOutputImage[] }>;
  error_message?: string;
}

export async function uploadImage(filePath: string): Promise<string> {
  if (!KEY) {
    console.warn('COMFYCLOUD_API_KEY is not set. Mocking image upload.');
    return path.basename(filePath);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const formData = new FormData();
  formData.append('image', new Blob([fileBuffer]), fileName);

  const response = await fetch(`${BASE}/upload/image`, {
    method: 'POST',
    headers: {
      'X-API-Key': KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload image failed: ${response.status} - ${errText}`);
  }

  const data = await response.json() as { name: string };
  return data.name;
}

export async function submitPrompt(workflow: Record<string, unknown>): Promise<string> {
  if (!KEY) {
    console.warn('COMFYCLOUD_API_KEY is not set. Mocking job submit.');
    return 'mock_prompt_id_' + Date.now();
  }

  const response = await fetch(`${BASE}/prompt`, {
    method: 'POST',
    headers: {
      'X-API-Key': KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: workflow,
      extra_data: { api_key_comfy_org: KEY },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Submit prompt failed: ${response.status} - ${errText}`);
  }

  const data = await response.json() as { prompt_id: string };
  return data.prompt_id;
}

export async function pollJob(
  promptId: string,
  intervalMs = 3000,
  timeoutMs = 600000
): Promise<ComfyJobResult> {
  if (!KEY) {
    console.warn('COMFYCLOUD_API_KEY is not set. Mocking job poll success.');
    return {
      status: 'completed',
      outputs: {
        '5': {
          images: [{ filename: 'mock_output.png', subfolder: '', type: 'output' }]
        }
      }
    };
  }

  const deadline = Date.now() + timeoutMs;
  let backoff = 1000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/jobs/${promptId}`, {
        headers: {
          'X-API-Key': KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Poll request error: ${response.status}`);
      }

      const data = await response.json() as ComfyJobResult;
      backoff = 1000; // Reset backoff on success

      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        return data;
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.warn(`Poll transient error: ${err.message || String(e)}. Retrying in ${backoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, 30000);
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Job ${promptId} timed out after ${timeoutMs / 1000}s`);
}

export async function downloadView(
  filename: string,
  subfolder = '',
  type = 'output'
): Promise<Buffer> {
  if (!KEY) {
    console.warn('COMFYCLOUD_API_KEY is not set. Returning empty buffer for view.');
    return Buffer.alloc(0);
  }

  const queryParams = new URLSearchParams({ filename, subfolder, type });
  const response = await fetch(`${BASE}/view?${queryParams.toString()}`, {
    headers: {
      'X-API-Key': KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Download view failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function buildTryonWorkflow(
  handName: string,
  nailName: string,
  seed = 42,
  resolution = '1K',
  filenamePrefix = 'tryon'
): Record<string, unknown> {
  return {
    '1': { class_type: 'LoadImage', inputs: { image: handName } },
    '2': { class_type: 'LoadImage', inputs: { image: nailName } },
    '3': {
      class_type: 'ImageBatch',
      inputs: { image1: ['1', 0], image2: ['2', 0] },
    },
    '4': {
      class_type: 'GeminiImage2Node',
      inputs: {
        prompt: PROMPT_WITH_HAND,
        model: MODEL_NB2,
        seed: seed,
        aspect_ratio: '1:1',
        resolution: resolution,
        response_modalities: 'IMAGE',
        images: ['3', 0],
      },
    },
    '5': {
      class_type: 'SaveImage',
      inputs: { images: ['4', 0], filename_prefix: filenamePrefix },
    },
  };
}

export function extractOutputs(job: ComfyJobResult): { filename: string; subfolder: string; type: string }[] {
  const out: { filename: string; subfolder: string; type: string }[] = [];
  const outputs = job.outputs || {};
  for (const nodeId of Object.keys(outputs)) {
    const nodeOut = outputs[nodeId] || {};
    const images = nodeOut.images || [];
    for (const img of images) {
      out.push({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output',
      });
    }
  }
  return out;
}

