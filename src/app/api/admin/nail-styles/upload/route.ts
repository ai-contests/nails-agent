export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/nail-styles/upload
 *
 * B 端上传一张美甲图片，走完整流程：
 *   1. 保存原图
 *   2. Roboflow 分割 → 颜色 + 长度特征提取
 *   3. ComfyCloud 图片增强（用随机标准手模 + 原图 → tryon 成品图）
 *   4. 写 nail_styles(status='candidate') + nail_visual_features
 *
 * Request: multipart/form-data  { file: File }
 * Response: { styleId, primaryColorFamily, lengthTag, imageUrl, enhancedImageUrl, extractorVersion }
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';
import { inferSegmentation } from '@/tools/extraction/src/roboflowClient';
import { buildMaskBundle, bboxFromPoints, readRGB } from '@/tools/extraction/src/maskCrop';
import { extractColorWithRing } from '@/tools/extraction/src/colorExtractor';
import { extractLength } from '@/tools/extraction/src/lengthExtractor';
import {
  uploadImage,
  submitPrompt,
  pollJob,
  downloadView,
  extractOutputs,
  buildTryonWorkflow,
} from '@/src/services/comfycloud';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'nail_uploads');
const ENHANCED_DIR = path.join(DATA_DIR, 'nail_enhanced');
const HAND_POOL_DIR = path.join(DATA_DIR, 'hand_models', 'pool');

const ROBOFLOW_MODEL_ID =
  process.env['ROBOFLOW_MODEL_ID'] ?? 'fingernail-segmentation-yy1l7/3';
const ROBOFLOW_CONFIDENCE = Number(process.env['ROBOFLOW_CONFIDENCE'] ?? 0.5);
const EXTRACTOR_VERSION = 'api_upload_v1';

/** Pick a random hand from the pool for enhancement. */
async function randomHandModelPath(): Promise<string | null> {
  if (!existsSync(HAND_POOL_DIR)) return null;
  const files = (await readdir(HAND_POOL_DIR)).filter(f => f.endsWith('.png'));
  if (files.length === 0) return null;
  const pick = files[Math.floor(Math.random() * files.length)]!;
  return path.join(HAND_POOL_DIR, pick);
}

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return json({ error: 'No file uploaded. Send multipart/form-data with field "file".' }, 400);
  }
  if (!file.type.startsWith('image/')) {
    return json({ error: 'File must be an image.' }, 400);
  }

  const apiKey = process.env['ROBOFLOW_API_KEY'];
  if (!apiKey) return json({ error: 'ROBOFLOW_API_KEY is not set on server.' }, 500);

  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(ENHANCED_DIR, { recursive: true });

  const styleId = generateId('STYLE_UP');
  const ext = file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') ? '.jpg' : '.png';
  const origFileName = `${styleId}_orig${ext}`;
  const origFilePath = path.join(UPLOADS_DIR, origFileName);

  // ── 1. Save original image ──────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(origFilePath, buffer);
  const imageUrl = `/data/nail_uploads/${origFileName}`;

  // ── 2. Roboflow segmentation → feature extraction ───────────────────────
  let primaryColorFamily = 'unknown';
  let primaryColorName = '未知';
  let primaryColorRgb: [number, number, number] = [128, 128, 128];
  let dominantPalette: [number, number, number][] = [];
  let colorConfidence = 0;
  let secondaryColorFamily: string | null = null;
  let secondaryColorName: string | null = null;
  let secondaryColorRgb: [number, number, number] | null = null;
  let secondaryColorConfidence: number | null = null;
  let lengthTag: 'short' | 'medium' | 'long' | 'unknown' = 'unknown';
  let lengthRatio = 0;
  let lengthConfidence = 0;
  let nailCount = 0;

  try {
    const seg = await inferSegmentation(origFilePath, {
      apiKey,
      modelId: ROBOFLOW_MODEL_ID,
      confidence: ROBOFLOW_CONFIDENCE,
    });

    const preds = (seg.predictions ?? []).filter(
      p => p.points && p.points.length >= 3,
    );

    if (preds.length > 0) {
      nailCount = preds.length;
      const { buf: rgb, width, height, channels } = await readRGB(origFilePath);
      const { innerMask, outerRing } = await buildMaskBundle(origFilePath, preds, width, height);
      const color = extractColorWithRing(rgb, innerMask, outerRing, width, height, channels);

      if (color) {
        primaryColorFamily = color.primaryColorFamily;
        primaryColorName = color.primaryColorNameZh;
        primaryColorRgb = [color.primaryColorRgb.r, color.primaryColorRgb.g, color.primaryColorRgb.b];
        dominantPalette = color.dominantPalette.map(c => [c.r, c.g, c.b] as [number, number, number]);
        colorConfidence = color.colorConfidence;
        secondaryColorFamily = color.secondaryColorFamily;
        secondaryColorName = color.secondaryColorNameZh;
        secondaryColorRgb = color.secondaryColorRgb;
        secondaryColorConfidence = color.secondaryColorConfidence;
      }

      const bboxes = preds.map(p => bboxFromPoints(p.points));
      const polygons = preds.map(p => p.points);
      const length = extractLength(bboxes, polygons);
      lengthTag = length.lengthTag;
      lengthRatio = length.lengthRatio;
      lengthConfidence = length.lengthConfidence;
    }
  } catch (err) {
    console.warn('[upload] Extraction failed, continuing with defaults:', err);
  }

  // ── 3. ComfyCloud enhancement ────────────────────────────────────────────
  let enhancedImageUrl: string | null = null;

  try {
    const handModelPath = await randomHandModelPath();

    // Upload both images to ComfyCloud
    const [nailRemoteName, handRemoteName] = await Promise.all([
      uploadImage(origFilePath),
      handModelPath ? uploadImage(handModelPath) : Promise.resolve(null),
    ]);

    if (handRemoteName && nailRemoteName) {
      const workflow = buildTryonWorkflow(
        handRemoteName,
        nailRemoteName,
        Math.floor(Math.random() * 100000),
        '1K',
        `enhanced_${styleId}`,
      );

      const promptId = await submitPrompt(workflow);
      const jobResult = await pollJob(promptId, 3000, 300000); // 5 min timeout

      if (jobResult.status === 'completed') {
        const outputs = extractOutputs(jobResult);
        if (outputs.length > 0) {
          const firstOutput = outputs[0]!;
          const enhancedBuffer = await downloadView(
            firstOutput.filename,
            firstOutput.subfolder,
            firstOutput.type,
          );
          const enhancedFileName = `${styleId}_enhanced.png`;
          const enhancedFilePath = path.join(ENHANCED_DIR, enhancedFileName);
          await writeFile(enhancedFilePath, enhancedBuffer);
          enhancedImageUrl = `/data/nail_enhanced/${enhancedFileName}`;
        }
      } else {
        console.warn(`[upload] ComfyCloud job ${promptId} ended with status: ${jobResult.status}`);
      }
    }
  } catch (err) {
    console.warn('[upload] ComfyCloud enhancement failed, candidate will use original image:', err);
  }

  // ── 4. Write to DB ───────────────────────────────────────────────────────
  const { db } = openDb();
  const now = new Date().toISOString();
  const visualFeatureId = generateId('VF');

  await db.insert(schema.nailStyles).values({
    style_id: styleId,
    source_type: 'b_end_upload',
    status: 'candidate',
    image_url: imageUrl,
    enhanced_image_url: enhancedImageUrl,
    color_tags: JSON.stringify(
      [primaryColorFamily, secondaryColorFamily].filter(Boolean),
    ),
    length_tags: JSON.stringify(lengthTag !== 'unknown' ? [lengthTag] : []),
    visual_feature_id: visualFeatureId,
    is_available_for_tryon: true,
    created_at: now,
    updated_at: now,
  });

  await db.insert(schema.nailVisualFeatures).values({
    visual_feature_id: visualFeatureId,
    style_id: styleId,
    primary_color_family: primaryColorFamily,
    primary_color_name: primaryColorName,
    primary_color_rgb: JSON.stringify(primaryColorRgb),
    dominant_palette: JSON.stringify(dominantPalette),
    color_confidence: colorConfidence,
    secondary_color_family: secondaryColorFamily,
    secondary_color_name: secondaryColorName,
    secondary_color_rgb: secondaryColorRgb ? JSON.stringify(secondaryColorRgb) : null,
    secondary_color_confidence: secondaryColorConfidence,
    length_tag: lengthTag,
    length_ratio: lengthRatio,
    length_confidence: lengthConfidence,
    extractor_version: EXTRACTOR_VERSION,
    raw_features: JSON.stringify({ nailCount }),
    created_at: now,
  });

  return json({
    styleId,
    status: 'candidate',
    imageUrl,
    enhancedImageUrl,
    extraction: {
      primaryColorFamily,
      primaryColorName,
      primaryColorRgb,
      secondaryColorFamily,
      secondaryColorName,
      colorConfidence: Math.round(colorConfidence * 100) / 100,
      lengthTag,
      lengthRatio: Math.round(lengthRatio * 100) / 100,
      lengthConfidence: Math.round(lengthConfidence * 100) / 100,
      nailCount,
    },
    enhancement: {
      status: enhancedImageUrl ? 'completed' : 'skipped',
      enhancedImageUrl,
    },
    extractorVersion: EXTRACTOR_VERSION,
  });
}
