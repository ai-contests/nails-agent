export interface StyleLike {
  style_id: string;
}

export function mergeRankedStyles<T extends StyleLike>(
  primary: T[],
  fallback: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const style of [...primary, ...fallback]) {
    if (seen.has(style.style_id)) continue;
    seen.add(style.style_id);
    merged.push(style);
    if (merged.length >= limit) break;
  }

  return merged;
}
