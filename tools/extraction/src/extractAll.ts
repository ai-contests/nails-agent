import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');
loadEnv({ path: join(PROJECT_ROOT, '.env') });

import { inferSegmentation } from './roboflowClient.ts';
import { buildCombinedMask, bboxFromPoints, readRGB } from './maskCrop.ts';
import { extractColor } from './colorExtractor.ts';
import { extractLength } from './lengthExtractor.ts';
import type { StyleManifestEntry } from './types.ts';

const DATA_DIR = join(PROJECT_ROOT, 'data');
const OUT_DIR = join(DATA_DIR, 'extraction');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');
const RAW_DIR = join(OUT_DIR, 'raw');

const EXTRACTOR_VERSION = 'roboflow_seg_v3+kmeans_v1+aspect_v1';
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID ?? 'fingernail-segmentation-yy1l7/3';
const ROBOFLOW_CONFIDENCE = Number(process.env.ROBOFLOW_CONFIDENCE ?? 0.5);

interface JobItem {
  style_id: string;
  source: 'enhanced' | 'candidate';
  image_path: string;
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

async function buildJobList(): Promise<JobItem[]> {
  const jobs: JobItem[] = [];

  // 50 enhanced → STYLE001..050（listed）
  for (let i = 1; i <= 50; i++) {
    const p = join(DATA_DIR, `enhanced_style_${String(i).padStart(2, '0')}.png`);
    if (!(await exists(p))) {
      console.warn(`[warn] missing enhanced ${p} — skip`);
      continue;
    }
    jobs.push({ style_id: styleId(i), source: 'enhanced', image_path: p });
  }

  // 50 Pinterest → STYLE051..100（candidate）
  const csvPath = join(DATA_DIR, 'nail_refs.csv');
  if (await exists(csvPath)) {
    const csv = await readFile(csvPath, 'utf8');
    const lines = csv.trim().split('\n').slice(1); // skip header
    let next = 51;
    for (const line of lines) {
      if (next > 100) break;
      // index, source_path, query — source_path 不含逗号；query 可能含但我们不用
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      if (firstComma < 0 || secondComma < 0) continue;
      const src = line.slice(firstComma + 1, secondComma).trim();
      if (!src) continue;
      if (!(await exists(src))) {
        console.warn(`[warn] candidate not found: ${src} — skip`);
        continue;
      }
      jobs.push({ style_id: styleId(next), source: 'candidate', image_path: src });
      next++;
    }
  } else {
    console.warn(`[warn] ${csvPath} missing — skipping candidate jobs`);
  }

  return jobs;
}

async function processOne(job: JobItem): Promise<StyleManifestEntry | null> {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) throw new Error('ROBOFLOW_API_KEY is not set in env');

  const seg = await inferSegmentation(job.image_path, {
    apiKey,
    modelId: ROBOFLOW_MODEL_ID,
    confidence: ROBOFLOW_CONFIDENCE,
  });

  // 持久化原始返回，方便后续调阈值不重打 API
  await writeFile(
    join(RAW_DIR, `${job.style_id}.roboflow.json`),
    JSON.stringify(seg, null, 2),
    'utf8',
  );

  const preds = (seg.predictions ?? []).filter(p => p.points && p.points.length >= 3);
  if (preds.length === 0) {
    console.warn(`[warn] ${job.style_id}: no usable predictions`);
    return null;
  }

  const { buf: rgb, width, height, channels } = await readRGB(job.image_path);
  const mask = await buildCombinedMask(job.image_path, preds, width, height);
  const color = extractColor(rgb, mask, width, height, channels);
  const bboxes = preds.map(p => bboxFromPoints(p.points));
  const length = extractLength(bboxes);

  if (!color) {
    console.warn(`[warn] ${job.style_id}: empty mask, skipping color`);
    return null;
  }

  return {
    style_id: job.style_id,
    source: job.source,
    image_path: job.image_path,
    image_width: width,
    image_height: height,
    nail_count: preds.length,
    bboxes,
    primary_color_family: color.primaryColorFamily,
    primary_color_name: color.primaryColorNameZh,
    primary_color_rgb: [color.primaryColorRgb.r, color.primaryColorRgb.g, color.primaryColorRgb.b],
    dominant_palette: color.dominantPalette.map(c => [c.r, c.g, c.b] as [number, number, number]),
    color_confidence: color.colorConfidence,
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
  try {
    return JSON.parse(text) as StyleManifestEntry[];
  } catch {
    return [];
  }
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
        console.log(`[ok ] ${job.style_id} (${job.source}) ${entry.primary_color_family}/${entry.length_tag} nails=${entry.nail_count} ${Date.now() - t0}ms`);
      } else {
        fail++;
      }
    } catch (e) {
      fail++;
      console.error(`[err] ${job.style_id}: ${(e as Error).message}`);
    }

    // 每 5 张做一次中间落盘，防止断网丢数据
    if ((ok + fail) % 5 === 0) {
      await writeFile(MANIFEST_PATH, JSON.stringify([...existing, ...newEntries], null, 2), 'utf8');
    }
  }

  const merged = [...existing, ...newEntries].sort((a, b) => a.style_id.localeCompare(b.style_id));
  await writeFile(MANIFEST_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`[done] ok=${ok} fail=${fail} total in manifest=${merged.length}`);
  console.log(`[done] manifest → ${MANIFEST_PATH}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
