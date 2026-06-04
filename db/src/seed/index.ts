import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDb } from '../client.ts';
import { EXTRACTION_MANIFEST } from '../paths.ts';
import {
  nailStyles,
  nailVisualFeatures,
  recommendationSnapshots,
  recommendationItems,
} from '../schema/index.ts';

interface ManifestEntry {
  style_id: string;
  source: 'enhanced' | 'candidate';
  image_path: string;
  image_width: number;
  image_height: number;
  nail_count: number;
  bboxes: { x1: number; y1: number; x2: number; y2: number }[];
  primary_color_family: string;
  primary_color_name: string;
  primary_color_rgb: [number, number, number];
  dominant_palette: [number, number, number][];
  color_confidence: number;
  secondary_color_family: string | null;
  secondary_color_name: string | null;
  secondary_color_rgb: [number, number, number] | null;
  secondary_color_confidence: number | null;
  length_tag: 'short' | 'medium' | 'long' | 'unknown';
  length_ratio: number;
  length_confidence: number;
  extractor_version: string;
  extracted_at: string;
}

function shortId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function main() {
  let manifest: ManifestEntry[];
  try {
    manifest = JSON.parse(readFileSync(EXTRACTION_MANIFEST, 'utf8')) as ManifestEntry[];
  } catch (e) {
    console.error(`[seed] missing or invalid manifest at ${EXTRACTION_MANIFEST}`);
    console.error(`[seed] run 'cd tools/extraction && npm run extract' first`);
    process.exit(1);
  }

  console.log(`[seed] loaded ${manifest.length} entries from manifest`);

  const { sqlite, db } = openDb();
  const now = nowIso();

  // 1. nail_styles + nail_visual_features —— 100 styles
  const styleRows: (typeof nailStyles.$inferInsert)[] = [];
  const featureRows: (typeof nailVisualFeatures.$inferInsert)[] = [];

  for (const m of manifest) {
    const visualFeatureId = shortId('FEAT');
    const status = m.source === 'enhanced' ? 'listed' : 'candidate';
    const isListed = status === 'listed';

    styleRows.push({
      style_id: m.style_id,
      source_type: isListed ? 'internal_seed' : null,
      status,
      // listed 用本地 enhanced PNG 路径；candidate 用原 Pinterest 图（暂作 image_url）
      image_url: m.image_path,
      enhanced_image_url: isListed ? m.image_path : null,
      color_tags: JSON.stringify([m.primary_color_name]),
      length_tags: JSON.stringify([m.length_tag]),
      visual_feature_id: visualFeatureId,
      is_available_for_tryon: isListed,
      listed_at: isListed ? now : null,
      created_at: now,
      updated_at: now,
    });

    featureRows.push({
      visual_feature_id: visualFeatureId,
      style_id: m.style_id,
      primary_color_family: m.primary_color_family,
      primary_color_name: m.primary_color_name,
      primary_color_rgb: JSON.stringify(m.primary_color_rgb),
      dominant_palette: JSON.stringify(m.dominant_palette),
      color_confidence: m.color_confidence,
      secondary_color_family: m.secondary_color_family,
      secondary_color_name: m.secondary_color_name,
      secondary_color_rgb: m.secondary_color_rgb ? JSON.stringify(m.secondary_color_rgb) : null,
      secondary_color_confidence: m.secondary_color_confidence,
      nail_crop_url: null,
      length_tag: m.length_tag,
      length_ratio: m.length_ratio,
      length_confidence: m.length_confidence,
      extractor_version: m.extractor_version,
      raw_features: JSON.stringify({
        nail_count: m.nail_count,
        bboxes: m.bboxes,
        image_width: m.image_width,
        image_height: m.image_height,
      }),
      created_at: now,
    });
  }

  sqlite.exec('BEGIN');
  try {
    db.insert(nailStyles).values(styleRows).run();
    db.insert(nailVisualFeatures).values(featureRows).run();

    // 2. 初始 global_main 推荐快照（active），仅含 listed
    const snapshotId = shortId('SNAP');
    db.insert(recommendationSnapshots).values({
      snapshot_id: snapshotId,
      snapshot_type: 'global_main',
      session_id: null,
      generated_by: 'system',
      agent_run_id: null,
      status: 'active',
      activated_at: now,
      expires_at: null,
      created_at: now,
    }).run();

    const listedIds = manifest.filter(m => m.source === 'enhanced').map(m => m.style_id);
    const shuffled = shuffle(listedIds);
    const itemRows = shuffled.map((sid, idx) => ({
      item_id: shortId('RITEM'),
      snapshot_id: snapshotId,
      style_id: sid,
      rank_no: idx + 1,
      score: 1.0 - idx * 0.001,
      reason: 'seed: random initial ranking',
      score_detail: JSON.stringify({ source: 'seed_random' }),
    }));
    if (itemRows.length > 0) db.insert(recommendationItems).values(itemRows).run();

    sqlite.exec('COMMIT');
    console.log(`[seed] inserted ${styleRows.length} nail_styles + ${featureRows.length} features + 1 active global_main snapshot with ${itemRows.length} items`);
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  } finally {
    sqlite.close();
  }
}

main();
