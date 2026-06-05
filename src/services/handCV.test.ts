import { afterEach, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { analyzeHandImage } from './handCV.ts';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

test('maps Python analyzer JSON into a hand profile result', async () => {
  process.env['HAND_ANALYZER_PYTHON'] = 'python3';
  process.env['HAND_ANALYZER_CLI'] = fileURLToPath(new URL('./fixtures/fake-hand-analyzer.py', import.meta.url));

  const result = await analyzeHandImage('/tmp/sample-hand.png');

  expect(result).toEqual({
    handShape: 'square_palm',
    handShapeConfidence: 0.84,
    skinTone: 'warm_yellow',
    skinToneConfidence: 0.76,
    skinRgb: [220, 180, 140],
    rawMetrics: {
      ok: true,
      imagePath: '/tmp/sample-hand.png',
      metrics: { image_path: '/tmp/sample-hand.png', palm_width_ratio: 0.96 },
      colorMetrics: { lab_l: 68.2, lab_b: 21.4 },
    },
  });
});
