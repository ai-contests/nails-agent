import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const isLocalFile = url.startsWith('/Users/') || url.includes('/nails-agent/');
  if ((url.startsWith('http') || url.startsWith('/')) && !isLocalFile) {
    return url;
  }
  return `/api/local-image?path=${encodeURIComponent(url)}`;
}

