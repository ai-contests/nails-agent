import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const imagePath = req.nextUrl.searchParams.get('path');

  if (!imagePath) {
    return new Response('Missing path', { status: 400 });
  }

  // Basic security check: ensure it's reading from the workspace data directory
  if (!imagePath.includes('/data/')) {
    return new Response('Invalid path', { status: 403 });
  }

  try {
    const fileBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving local image:', error);
    return new Response('Image not found', { status: 404 });
  }
}
