import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file');
  const clientId = formData.get('clientId');

  if (!file || !(file instanceof File)) {
    return json({ error: 'No file uploaded' }, 400);
  }

  // MediaPipe-computed attributes forwarded from the client
  const handShape = (formData.get('handShape') as string | null) ?? 'unknown';
  const skinTone = (formData.get('skinTone') as string | null) ?? 'unknown';
  const handShapeConfidence = parseFloat((formData.get('handShapeConfidence') as string | null) ?? '0');
  const skinToneConfidence = parseFloat((formData.get('skinToneConfidence') as string | null) ?? '0');
  const skinRgbRaw = (formData.get('skinRgb') as string | null) ?? '[255,220,185]';
  const rawMetricsRaw = (formData.get('rawMetrics') as string | null) ?? '{}';

  const { db } = openDb();
  const sessionId = generateId('SES');
  const handImageId = generateId('IMG');
  const now = new Date().toISOString();

  await db.insert(schema.userSessions).values({
    session_id: sessionId,
    client_id: typeof clientId === 'string' ? clientId : null,
    status: 'active',
    current_hand_image_id: handImageId,
    created_at: now,
  });

  const buffer = await file.arrayBuffer();
  const fileName = `${handImageId}_${file.name}`;
  const uploadDir = path.join(process.cwd(), 'data', 'hand_uploads');
  await mkdir(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, fileName);
  await writeFile(localPath, Buffer.from(buffer));
  const imageUrl = `/data/hand_uploads/${fileName}`;

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
  });
}
