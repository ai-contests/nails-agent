import { router } from './routes';
import path from 'path';
import fs from 'fs';

const PORT = process.env['PORT'] || 3000;

console.log(`[Server] Starting Nails-Agent backend on port ${PORT}...`);

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Serve static files under /data/ (e.g. style images, tryon results, hand uploads)
    if (url.pathname.startsWith('/data/')) {
      const filePath = path.join(process.cwd(), url.pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return new Response(Bun.file(filePath));
      } else {
        return new Response(JSON.stringify({ error: 'File Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Delegate other requests to the router
    return router.handle(req);
  },
});

