import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');
loadEnv({ path: join(PROJECT_ROOT, '.env') });

import { inferSegmentation } from './roboflowClient.ts';
import { buildMaskBundle, bboxFromPoints, readRGB } from './maskCrop.ts';
import { extractColorWithRing } from './colorExtractor.ts';
import { extractLength } from './lengthExtractor.ts';
import type { StyleManifestEntry } from './types.ts';

const DATA_DIR = join(PROJECT_ROOT, 'data');
const TRYON_DIR = join(DATA_DIR, 'tryon_v2');
const PAIRS_CSV = join(DATA_DIR, 'pairs.csv');
const NAIL_REFS_CSV = join(DATA_DIR, 'nail_refs.csv');
const OUT_DIR = join(DATA_DIR, 'extraction');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');
const RAW_DIR = join(OUT_DIR, 'raw');

const EXTRACTOR_VERSION = 'roboflow_seg_v3+v6_skinref_DT_erode+pca_axis_v2+sec_color';
const ROBOFLOW_MODEL_ID = process.env['ROBOFLOW_MODEL_ID'] ?? 'fingernail-segmentation-yy1l7/3';
const ROBOFLOW_CONFIDENCE = Number(process.env['ROBOFLOW_CONFIDENCE'] ?? 0.5);

interface JobItem {
  style_id: string;
  source: 'enhanced' | 'candidate';
  pair_id: string;
  tryon_image_path: string;       // 实际跑提取的图（tryon 成品）
  original_nail_path: string;     // 原 catalog 款式图（参考用）
}

interface Args {
  only?: 'enhanced' | 'candidate';
  max?: number;
  resume: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { resume: true };
  for (const a of argv.slice(2)) {
    if (a === '--no-resume') args.resume = false;
    else if (a.startsWith('--only=')) {
      const v = a.slice('--only='.length);
      if (v === 'enhanced' || v === 'candidate') args.only = v;
      else throw new Error(`--only must be enhanced|candidate, got ${v}`);
    } else if (a.startsWith('--max=')) {
      args.max = Number(a.slice('--max='.length));
    } else {
      throw new Error(`unknown arg: ${a}`);
    }
  }
  return args;
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function styleId(n: number): string {
  return `STYLE${String(n).padStart(3, '0')}`;
}

// 简易 CSV 解析（pairs.csv / nail_refs.csv 都没有引号转义）
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const header = lines[0]!.split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h.trim()] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// 从 enhanced_style_NN.png 文件名解析 NN
function enhancedIndex(nailPath: string): number | null {
  const m = basename(nailPath).match(/enhanced_style_(\d{2})\.png/);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

async function buildJobList(): Promise<JobItem[]> {
  if (!existsSync(PAIRS_CSV)) {
    throw new Error(`missing ${PAIRS_CSV}`);
  }
  if (!existsSync(NAIL_REFS_CSV)) {
    throw new Error(`missing ${NAIL_REFS_CSV}`);
  }

  // 1. nail_refs.csv 建立 source_path → index 字典（候选 Pinterest 映射用）
  const refs = parseCsv(await readFile(NAIL_REFS_CSV, 'utf8'));
  const pinterestIndex = new Map<string, number>();
  for (const r of refs) {
    const sp = r['source_path'];
    const idx = Number(r['index']);
    if (sp && Number.isFinite(idx)) pinterestIndex.set(sp, idx);
  }

  // 2. pairs.csv 遍历，建立 jobs
  const pairs = parseCsv(await readFile(PAIRS_CSV, 'utf8'));
  const jobs: JobItem[] = [];

  for (const p of pairs) {
    const outName = p['out_name'];
    const nailSource = p['nail_source'];
    const nailPath = p['nail_path'];
    const pairId = p['pair_id'] ?? '';
    if (!outName || !nailSource || !nailPath) continue;

    const tryonPath = join(TRYON_DIR, outName);
    if (!(await exists(tryonPath))) {
      console.warn(`[warn] tryon missing: ${outName} — skip`);
      continue;
    }

    let style_id: string;
    if (nailSource === 'enhanced') {
      const nn = enhancedIndex(nailPath);
      if (nn === null) { console.warn(`[warn] cannot parse enhanced index from ${nailPath}`); continue; }
      style_id = styleId(nn);  // STYLE001..050
    } else if (nailSource === 'pinterest') {
      const idx = pinterestIndex.get(nailPath);
      if (idx === undefined) { console.warn(`[warn] pinterest path not in nail_refs.csv: ${nailPath}`); continue; }
      style_id = styleId(51 + idx);  // STYLE051..100
    } else {
      console.warn(`[warn] unknown nail_source: ${nailSource}`);
      continue;
    }

    jobs.push({
      style_id,
      source: nailSource === 'enhanced' ? 'enhanced' : 'candidate',
      pair_id: pairId,
      tryon_image_path: tryonPath,
      original_nail_path: nailPath,
    });
  }

  // 按 style_id 排序，方便观察
  jobs.sort((a, b) => a.style_id.localeCompare(b.style_id));
  return jobs;
}

async function processOne(job: JobItem): Promise<StyleManifestEntry | null> {
  const apiKey = process.env['ROBOFLOW_API_KEY'];
  if (!apiKey) throw new Error('ROBOFLOW_API_KEY is not set in env');

  const seg = await inferSegmentation(job.tryon_image_path, {
    apiKey,
    modelId: ROBOFLOW_MODEL_ID,
    confidence: ROBOFLOW_CONFIDENCE,
  });

  await writeFile(
    join(RAW_DIR, `${job.style_id}.roboflow.json`),
    JSON.stringify(seg, null, 2),
    'utf8',
  );

  const preds = (seg.predictions ?? []).filter(p => p.points && p.points.length >= 3);
  if (preds.length === 0) {
    console.warn(`[warn] ${job.style_id}: no usable predictions on tryon image`);
    return null;
  }

  const { buf: rgb, width, height, channels } = await readRGB(job.tryon_image_path);
  const { innerMask, outerRing } = await buildMaskBundle(job.tryon_image_path, preds, width, height);
  const color = extractColorWithRing(rgb, innerMask, outerRing, width, height, channels);
  const bboxes = preds.map(p => bboxFromPoints(p.points));
  const polygons = preds.map(p => p.points);
  const length = extractLength(bboxes, polygons);

  if (!color) {
    console.warn(`[warn] ${job.style_id}: empty mask, skipping color`);
    return null;
  }

  return {
    style_id: job.style_id,
    source: job.source,
    image_path: job.tryon_image_path,   // 主图 = tryon 成品图
    image_width: width,
    image_height: height,
    nail_count: preds.length,
    bboxes,
    primary_color_family: color.primaryColorFamily,
    primary_color_name: color.primaryColorNameZh,
    primary_color_rgb: [color.primaryColorRgb.r, color.primaryColorRgb.g, color.primaryColorRgb.b],
    dominant_palette: color.dominantPalette.map(c => [c.r, c.g, c.b] as [number, number, number]),
    color_confidence: color.colorConfidence,
    secondary_color_family: color.secondaryColorFamily,
    secondary_color_name: color.secondaryColorNameZh,
    secondary_color_rgb: color.secondaryColorRgb,
    secondary_color_confidence: color.secondaryColorConfidence,
    length_tag: length.lengthTag,
    length_ratio: length.lengthRatio,
    length_confidence: length.lengthConfidence,
    extractor_version: EXTRACTOR_VERSION,
    extracted_at: new Date().toISOString(),
  };
}

async function loadExistingManifest(): Promise<StyleManifestEntry[]> {
  if (!(await exists(MANIFEST_PATH))) return [];
  const text = await readFile(MANIFEST_PATH, 'utf8');
  try { return JSON.parse(text) as StyleManifestEntry[]; }
  catch { return []; }
}

async function main() {
  const args = parseArgs(process.argv);
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });

  const existing = args.resume ? await loadExistingManifest() : [];
  const doneIds = new Set(existing.map(e => e.style_id));

  const allJobs = await buildJobList();
  let jobs = args.only ? allJobs.filter(j => j.source === args.only) : allJobs;
  if (args.resume) jobs = jobs.filter(j => !doneIds.has(j.style_id));
  if (args.max !== undefined) jobs = jobs.slice(0, args.max);

  console.log(`[info] data source = tryon_v2/canon_*.png (via pairs.csv)`);
  console.log(`[info] ${jobs.length} jobs to process (resume=${args.resume}, already done=${existing.length})`);

  const newEntries: StyleManifestEntry[] = [];
  let ok = 0, fail = 0;
  for (const job of jobs) {
    const t0 = Date.now();
    try {
      const entry = await processOne(job);
      if (entry) {
        newEntries.push(entry);
        ok++;
        console.log(`[ok ] ${job.style_id} (${job.source}) ${entry.primary_color_family}/${entry.length_tag} conf=${entry.color_confidence} nails=${entry.nail_count} ${Date.now() - t0}ms`);
      } else { fail++; }
    } catch (e) {
      fail++;
      console.error(`[err] ${job.style_id}: ${(e as Error).message}`);
    }
    if ((ok + fail) % 5 === 0) {
      await writeFile(MANIFEST_PATH, JSON.stringify([...existing, ...newEntries], null, 2), 'utf8');
    }
  }

  const merged = [...existing, ...newEntries].sort((a, b) => a.style_id.localeCompare(b.style_id));
  await writeFile(MANIFEST_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`[done] ok=${ok} fail=${fail} total in manifest=${merged.length}`);
  console.log(`[done] manifest → ${MANIFEST_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
