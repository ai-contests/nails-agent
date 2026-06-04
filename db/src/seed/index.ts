import { readFileSync, readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { openDb } from '../client';
import { EXTRACTION_MANIFEST, PROJECT_ROOT } from '../paths';
import {
  nailStyles,
  nailVisualFeatures,
  recommendationSnapshots,
  recommendationItems,
  userSessions,
  userHandImages,
  userHandProfiles,
  behaviorEvents,
  sessionFavorites,
  styleHeatSnapshots,
  tagHeatSnapshots,
} from '../schema/index';

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

/** Generate a random ISO timestamp within the past N days */
function randomPastIso(withinDays = 3): string {
  const ms = Date.now() - Math.floor(Math.random() * withinDays * 24 * 3600 * 1000);
  return new Date(ms).toISOString();
}

function prefersStyle(handShape: string, colorFamily: string, colorName: string, lengthTag: string): boolean {
  if (handShape === 'slender_long') {
    const colorOk = colorFamily === 'nude' || colorFamily === 'pink' || colorName.includes('裸粉') || colorName.includes('粉');
    const lengthOk = lengthTag === 'medium' || lengthTag === 'long';
    return colorOk && lengthOk;
  }
  if (handShape === 'short_wide') {
    const colorOk = ['black', 'red', 'caramel', 'green'].includes(colorFamily) || /黑|红|焦糖|橄榄/.test(colorName);
    const lengthOk = lengthTag === 'short';
    return colorOk && lengthOk;
  }
  return false;
}

function getWeightedSample(
  availableIds: string[],
  styleFeaturesMap: Map<string, { colorFamily: string, colorName: string, lengthTag: string }>,
  handShape: string,
  count: number
): string[] {
  const scored = availableIds.map(sid => {
    const feat = styleFeaturesMap.get(sid);
    let weight = 1.0;
    if (feat && prefersStyle(handShape, feat.colorFamily, feat.colorName, feat.lengthTag)) {
      weight = 5.0; // 5x probability
    }
    return { id: sid, weight, rand: Math.random() * weight };
  });
  scored.sort((a, b) => b.rand - a.rand);
  return scored.slice(0, count).map(x => x.id);
}

function main() {
  let manifest: ManifestEntry[];
  try {
    manifest = JSON.parse(readFileSync(EXTRACTION_MANIFEST, 'utf8')) as ManifestEntry[];
  } catch {
    console.error(`[seed] missing or invalid manifest at ${EXTRACTION_MANIFEST}`);
    console.error(`[seed] run 'cd tools/extraction && npm run extract' first`);
    process.exit(1);
  }

  console.log(`[seed] loaded ${manifest.length} entries from manifest`);

  const { sqlite, db } = openDb();
  const now = nowIso();

  /* ──────────────────────────────────────────────
     1. nail_styles + nail_visual_features
  ────────────────────────────────────────────── */
  const styleRows: (typeof nailStyles.$inferInsert)[] = [];
  const featureRows: (typeof nailVisualFeatures.$inferInsert)[] = [];
  const styleFeaturesMap = new Map<string, { colorFamily: string, colorName: string, lengthTag: string }>();

  // Ensure exactly 50 listed styles
  let listedCount = 0;
  const targetListedCount = 50;

  for (const m of manifest) {
    const visualFeatureId = shortId('FEAT');
    
    let status: 'listed' | 'candidate' = 'candidate';
    if (m.source === 'enhanced') {
      status = 'listed';
      listedCount++;
    } else if (listedCount < targetListedCount) {
      status = 'listed';
      listedCount++;
    }

    const isListed = status === 'listed';

    // color_tags must be English, up to 2 colors (primary + secondary)
    const colorTagsList = [m.primary_color_family];
    if (m.secondary_color_family) {
      colorTagsList.push(m.secondary_color_family);
    }

    styleRows.push({
      style_id: m.style_id,
      source_type: isListed ? 'internal_seed' : null,
      status,
      image_url: m.image_path,
      enhanced_image_url: isListed ? m.image_path : null,
      color_tags: JSON.stringify(colorTagsList),
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

    styleFeaturesMap.set(m.style_id, {
      colorFamily: m.primary_color_family,
      colorName: m.primary_color_name,
      lengthTag: m.length_tag,
    });
  }

  console.log(`[seed] configured exactly ${listedCount} listed styles and ${manifest.length - listedCount} candidate styles`);

  /* ──────────────────────────────────────────────
     2. 初始 global_main 推荐快照
  ────────────────────────────────────────────── */
  const snapshotId = shortId('SNAP');
  const listedIds = styleRows.filter(s => s.status === 'listed').map(s => s.style_id);
  const shuffledIds = shuffle(listedIds);
  const itemRows = shuffledIds.map((sid, idx) => ({
    item_id: shortId('RITEM'),
    snapshot_id: snapshotId,
    style_id: sid,
    rank_no: idx + 1,
    score: 1.0 - idx * 0.001,
    reason: 'seed: random initial ranking',
    score_detail: JSON.stringify({ source: 'seed_random' }),
  }));

  /* ──────────────────────────────────────────────
     3. 50 Mock Sessions + Hand Images/Profiles & Events
  ────────────────────────────────────────────── */
  const MOCK_SESSION_COUNT = 50;

  const sessionRows: (typeof userSessions.$inferInsert)[] = [];
  const handImageRows: (typeof userHandImages.$inferInsert)[] = [];
  const handProfileRows: (typeof userHandProfiles.$inferInsert)[] = [];
  const eventRows: (typeof behaviorEvents.$inferInsert)[] = [];
  const favoriteRows: (typeof sessionFavorites.$inferInsert)[] = [];

  // Load and copy hand files from dataset
  const datasetHandDir = '/Users/nev4rb14su/workspace/dataset/nails_agent/processed/hands_832x1216';
  const uploadDir = join(PROJECT_ROOT, 'data', 'hand_uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  let datasetHands = readdirSync(datasetHandDir).filter(f => /\.(jpe?g|png)$/i.test(f));
  if (datasetHands.length === 0) {
    console.error(`[seed] error: no hand files found in ${datasetHandDir}`);
    process.exit(1);
  }

  // Duplicate list if there are fewer than 50 files
  while (datasetHands.length < MOCK_SESSION_COUNT) {
    datasetHands = datasetHands.concat(datasetHands);
  }
  datasetHands = datasetHands.slice(0, MOCK_SESSION_COUNT);

  // Track style behavior stats for heat snapshots
  const styleStats = new Map<string, { views: number; clicks: number; tryons: number; favorites: number }>();
  listedIds.forEach(sid => styleStats.set(sid, { views: 0, clicks: 0, tryons: 0, favorites: 0 }));

  for (let i = 0; i < MOCK_SESSION_COUNT; i++) {
    const sessionId = shortId('SES');
    const sessionCreatedAt = randomPastIso(3);
    const handImageId = shortId('IMG');

    // Copy file
    const handFileName = datasetHands[i]!;
    const localTargetName = `${handImageId}_${handFileName}`;
    const localTargetPath = join(uploadDir, localTargetName);
    copyFileSync(join(datasetHandDir, handFileName), localTargetPath);
    const relativeUrl = `/data/hand_uploads/${localTargetName}`;

    // Create session
    sessionRows.push({
      session_id: sessionId,
      client_id: null,
      status: 'completed',
      current_hand_image_id: handImageId,
      created_at: sessionCreatedAt,
    });

    // Create hand image upload
    handImageRows.push({
      hand_image_id: handImageId,
      session_id: sessionId,
      image_url: relativeUrl,
      created_at: sessionCreatedAt,
    });

    // Run python analyzer on the copied hand image to extract real hand shape and skin tone
    let handShape: 'slender_long' | 'short_wide' | 'square_palm' | 'narrow_palm' | 'unknown' = 'unknown';
    let handShapeConfidence = 0.0;
    let skinTone: 'cool_fair' | 'warm_fair' | 'natural' | 'warm_yellow' | 'wheat' | 'deep' | 'unknown' = 'unknown';
    let skinToneConfidence = 0.0;
    let skinRgb = [240, 210, 195];
    let rawMetrics: Record<string, unknown> = { note: 'Fallback default values' };

    try {
      const scriptPath = join(PROJECT_ROOT, 'scripts', 'analyze_hand.py');
      const stdout = execSync(`python3 "${scriptPath}" "${localTargetPath}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(stdout.trim());
      if (parsed && !parsed.error) {
        handShape = parsed.handShape;
        handShapeConfidence = parsed.handShapeConfidence;
        skinTone = parsed.skinTone;
        skinToneConfidence = parsed.skinToneConfidence;
        skinRgb = parsed.skinRgb;
        rawMetrics = parsed.rawMetrics || {};
      } else {
        console.warn(`[seed] Python analysis returned error for ${localTargetPath}: ${parsed?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`[seed] Failed to run python analysis for ${localTargetPath}, falling back to index modulo:`, err);
      const shapes: ('slender_long' | 'short_wide' | 'square_palm' | 'narrow_palm')[] = ['slender_long', 'short_wide', 'square_palm', 'narrow_palm'];
      const tones: ('cool_fair' | 'warm_fair' | 'natural' | 'warm_yellow' | 'wheat' | 'deep')[] = ['cool_fair', 'warm_fair', 'natural', 'warm_yellow', 'wheat', 'deep'];
      handShape = shapes[i % shapes.length] || 'unknown';
      skinTone = tones[i % tones.length] || 'unknown';
      handShapeConfidence = 0.92;
      skinToneConfidence = 0.88;
    }

    handProfileRows.push({
      hand_profile_id: shortId('HPF'),
      session_id: sessionId,
      hand_image_id: handImageId,
      hand_shape: handShape,
      hand_shape_confidence: handShapeConfidence,
      skin_tone: skinTone,
      skin_tone_confidence: skinToneConfidence,
      skin_rgb: JSON.stringify(skinRgb),
      raw_metrics: JSON.stringify(rawMetrics),
      created_at: sessionCreatedAt,
    });

    // Sample style interactions based on preferences (no style_view generated as it is not active user behavior)
    const clickCount = 1 + Math.floor(Math.random() * 5); // 1 to 5 clicks
    const clickedIds = getWeightedSample(listedIds, styleFeaturesMap, handShape, clickCount);

    for (const sid of clickedIds) {
      // style_click must be generated on 'main' page or 'similar_hand_popup' (NOT 'detail')
      const sourcePage = Math.random() < 0.8 ? 'main' : 'similar_hand_popup';
      eventRows.push({
        event_id: shortId('EV'),
        session_id: sessionId,
        style_id: sid,
        event_type: 'style_click',
        source_page: sourcePage,
        created_at: sessionCreatedAt,
      });
      styleStats.get(sid)!.clicks++;
      
      // Implicitly count views as clicks + some extra for aggregate metrics
      styleStats.get(sid)!.views += 1 + Math.floor(Math.random() * 4);
    }

    // Try-on simulation (triggered on detail page, only tryon_start is generated as active user interaction)
    if (Math.random() < 0.4 && clickedIds.length > 0) {
      const tryonStyle = clickedIds[Math.floor(Math.random() * clickedIds.length)]!;
      eventRows.push({
        event_id: shortId('EV'),
        session_id: sessionId,
        style_id: tryonStyle,
        event_type: 'tryon_start',
        source_page: 'detail',
        created_at: sessionCreatedAt,
      });
      styleStats.get(tryonStyle)!.tryons++;
    }

    // Favorite simulation (favorite_add must only happen on 'detail' page)
    if (Math.random() < 0.3 && clickedIds.length > 0) {
      const favStyle = clickedIds[Math.floor(Math.random() * clickedIds.length)]!;
      eventRows.push({
        event_id: shortId('EV'),
        session_id: sessionId,
        style_id: favStyle,
        event_type: 'favorite_add',
        source_page: 'detail',
        created_at: sessionCreatedAt,
      });
      favoriteRows.push({
        session_id: sessionId,
        style_id: favStyle,
        is_active: true,
        created_at: sessionCreatedAt,
        updated_at: sessionCreatedAt,
      });
      styleStats.get(favStyle)!.favorites++;
    }
  }

  /* ──────────────────────────────────────────────
     4. style_heat_snapshots
  ────────────────────────────────────────────── */
  const styleSnapshotRows: (typeof styleHeatSnapshots.$inferInsert)[] = [];
  const windowStart = randomPastIso(3);
  const windowEnd = now;

  for (const sid of listedIds) {
    const stats = styleStats.get(sid) || { views: 0, clicks: 0, tryons: 0, favorites: 0 };
    const heatScore = stats.clicks * 1.0 + stats.tryons * 2.0 + stats.favorites * 3.0;
    const growthScore = heatScore;
    const clickDiv = Math.max(stats.clicks, 1);
    const conversionScore = (stats.tryons / clickDiv) * 0.6 + (stats.favorites / clickDiv) * 0.4;

    styleSnapshotRows.push({
      heat_snapshot_id: shortId('SH'),
      agent_run_id: null,
      style_id: sid,
      window_start: windowStart,
      window_end: windowEnd,
      view_count: stats.views,
      click_count: stats.clicks,
      tryon_count: stats.tryons,
      favorite_count: stats.favorites,
      heat_score: heatScore,
      growth_score: growthScore,
      conversion_score: conversionScore,
      created_at: now,
    });
  }

  /* ──────────────────────────────────────────────
     5. tag_heat_snapshots
  ────────────────────────────────────────────── */
  const tagSnapshotRows: (typeof tagHeatSnapshots.$inferInsert)[] = [];
  const tagStats = new Map<string, { type: string; value: string; styleIds: Set<string>; views: number; clicks: number; tryons: number; favorites: number }>();

  for (const sid of listedIds) {
    const feat = styleFeaturesMap.get(sid);
    if (!feat) continue;
    const stats = styleStats.get(sid) || { views: 0, clicks: 0, tryons: 0, favorites: 0 };

    // Process up to 2 color tags (primary + secondary) plus length tag
    const colorTagsList = [feat.colorFamily];
    // In styleFeaturesMap we stored colorFamily. Let's also look up if there is a secondary color family in our source row.
    const sourceManifestRow = manifest.find(m => m.style_id === sid);
    if (sourceManifestRow && sourceManifestRow.secondary_color_family) {
      colorTagsList.push(sourceManifestRow.secondary_color_family);
    }

    const tagsToProcess = [
      { type: 'length', val: feat.lengthTag },
    ];
    for (const cFam of colorTagsList) {
      tagsToProcess.push({ type: 'color', val: cFam });
    }

    for (const t of tagsToProcess) {
      const key = `${t.type}:${t.val}`;
      if (!tagStats.has(key)) {
        tagStats.set(key, {
          type: t.type,
          value: t.val,
          styleIds: new Set(),
          views: 0,
          clicks: 0,
          tryons: 0,
          favorites: 0,
        });
      }
      const tStat = tagStats.get(key)!;
      tStat.styleIds.add(sid);
      tStat.views += stats.views;
      tStat.clicks += stats.clicks;
      tStat.tryons += stats.tryons;
      tStat.favorites += stats.favorites;
    }
  }

  for (const tStat of tagStats.values()) {
    const heatScore = tStat.clicks * 1.0 + tStat.tryons * 2.0 + tStat.favorites * 3.0;
    const growthScore = heatScore;
    const clickDiv = Math.max(tStat.clicks, 1);
    const conversionScore = (tStat.tryons / clickDiv) * 0.6 + (tStat.favorites / clickDiv) * 0.4;

    tagSnapshotRows.push({
      tag_snapshot_id: shortId('TH'),
      agent_run_id: null,
      tag_type: tStat.type,
      tag_value: tStat.value,
      window_start: windowStart,
      window_end: windowEnd,
      style_count: tStat.styleIds.size,
      view_count: tStat.views,
      click_count: tStat.clicks,
      tryon_count: tStat.tryons,
      favorite_count: tStat.favorites,
      heat_score: heatScore,
      growth_score: growthScore,
      conversion_score: conversionScore,
      created_at: now,
    });
  }

  /* ──────────────────────────────────────────────
     6. Commit all in a single transaction
  ────────────────────────────────────────────── */
  sqlite.exec('BEGIN');
  try {
    db.insert(nailStyles).values(styleRows).run();
    db.insert(nailVisualFeatures).values(featureRows).run();

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

    if (itemRows.length > 0) db.insert(recommendationItems).values(itemRows).run();

    if (sessionRows.length > 0) db.insert(userSessions).values(sessionRows).run();
    if (handImageRows.length > 0) db.insert(userHandImages).values(handImageRows).run();
    if (handProfileRows.length > 0) db.insert(userHandProfiles).values(handProfileRows).run();
    if (eventRows.length > 0) db.insert(behaviorEvents).values(eventRows).run();
    if (favoriteRows.length > 0) db.insert(sessionFavorites).values(favoriteRows).run();
    if (styleSnapshotRows.length > 0) db.insert(styleHeatSnapshots).values(styleSnapshotRows).run();
    if (tagSnapshotRows.length > 0) db.insert(tagHeatSnapshots).values(tagSnapshotRows).run();

    sqlite.exec('COMMIT');
    console.log(`[seed] inserted:`);
    console.log(`  - ${styleRows.length} nail_styles`);
    console.log(`  - ${featureRows.length} visual features`);
    console.log(`  - 1 active global_main snapshot with ${itemRows.length} items`);
    console.log(`  - ${sessionRows.length} mock sessions`);
    console.log(`  - ${handImageRows.length} hand images`);
    console.log(`  - ${handProfileRows.length} hand profiles`);
    console.log(`  - ${eventRows.length} behavior events`);
    console.log(`  - ${favoriteRows.length} favorites`);
    console.log(`  - ${styleSnapshotRows.length} style heat snapshots`);
    console.log(`  - ${tagSnapshotRows.length} tag heat snapshots`);
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  } finally {
    sqlite.close();
  }
}

main();
