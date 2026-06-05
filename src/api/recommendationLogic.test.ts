import { expect, test } from 'bun:test';
import { mergeRankedStyles } from './recommendationLogic.ts';

test('merges behavior-ranked styles with global fallback without duplicates', () => {
  const merged = mergeRankedStyles(
    [{ style_id: 'STYLE003' }, { style_id: 'STYLE001' }],
    [{ style_id: 'STYLE001' }, { style_id: 'STYLE002' }, { style_id: 'STYLE004' }],
    3,
  );

  expect(merged.map(style => style.style_id)).toEqual(['STYLE003', 'STYLE001', 'STYLE002']);
});
