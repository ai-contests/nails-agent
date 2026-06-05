export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';
import { analyzeHandImage } from '@/src/services/handCV';

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file');
  const clientId = formData.get('clientId');

  if (!file || !(file instanceof File)) {
    return json({ error: 'No file uploaded' }, 400);
  }

  // Optional client-side fallback values (used only if server-side analysis fails)
  const fallbackHandShape = (formData.get('handShape') as string | null) ?? 'unknown';
  const fallbackSkinTone = (formData.get('skinTone') as string | null) ?? 'unknown';
  const fallbackHandShapeConf = parseFloat((formData.get('handShapeConfidence') as string | null) ?? '0');
  const fallbackSkinToneConf = parseFloat((formData.get('skinToneConfidence') as string | null) ?? '0');
  const fallbackSkinRgb = (formData.get('skinRgb') as string | null) ?? '[255,220,185]';

  // Save image first so we can pass the path to the Python analyzer
  const handImageId = generateId('IMG');
  const buffer = await file.arrayBuffer();
  const fileName = `${handImageId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const uploadDir = path.join(process.cwd(), 'data', 'hand_uploads');
  await mkdir(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, fileName);
  await writeFile(localPath, Buffer.from(buffer));
  const imageUrl = `/data/hand_uploads/${fileName}`;

  // Server-side hand analysis via Python MediaPipe
  // Falls back to client-provided values (or 'unknown') if Python env is not configured
  const analysis = await analyzeHandImage(localPath);
  const analysisOk = analysis.handShape !== 'unknown';

  const handShape = analysisOk ? analysis.handShape : fallbackHandShape;
  const skinTone = analysisOk ? analysis.skinTone : fallbackSkinTone;
  const handShapeConfidence = analysisOk ? analysis.handShapeConfidence : fallbackHandShapeConf;
  const skinToneConfidence = analysisOk ? analysis.skinToneConfidence : fallbackSkinToneConf;
  const skinRgbRaw = analysisOk
    ? JSON.stringify(analysis.skinRgb)
    : fallbackSkinRgb;
  const rawMetricsRaw = JSON.stringify(analysis.rawMetrics);

  const { db } = openDb();
  const sessionId = generateId('SES');
  const now = new Date().toISOString();

  await db.insert(schema.userSessions).values({
    session_id: sessionId,
    client_id: typeof clientId === 'string' ? clientId : null,
    status: 'active',
    current_hand_image_id: handImageId,
    created_at: now,
  });

  await db.insert(schema.userHandImages).values({
    hand_image_id: handImageId,
    session_id: sessionId,
    image_url: imageUrl,
    created_at: now,
  });

  await db.insert(schema.userHandProfiles).values({
    hand_profile_id: generateId('HPF'),
    session_id: sessionId,
    hand_image_id: handImageId,
    hand_shape: handShape,
    hand_shape_confidence: handShapeConfidence,
    skin_tone: skinTone,
    skin_tone_confidence: skinToneConfidence,
    skin_rgb: skinRgbRaw,
    raw_metrics: rawMetricsRaw,
    created_at: now,
  });

  return json({
    sessionId,
    handImageId,
    imageUrl,
    handShape,
    skinTone,
    handShapeConfidence,
    skinToneConfidence,
    skinRgb: analysis.skinRgb,
    analysisSource: analysisOk ? 'server' : 'client_fallback',
  });
}
