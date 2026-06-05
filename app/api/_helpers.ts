import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
