import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'bun:sqlite'],
};

// Check if we are in next build phase
const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('build');

if (isBuild) {
  const mockPath = path.resolve(__dirname, 'src/lib/mocks/bun-sqlite.js');
  nextConfig.turbopack = {
    resolveAlias: {
      'bun:sqlite': mockPath,
    },
  };
  nextConfig.webpack = (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['bun:sqlite'] = mockPath;
    }
    return config;
  };
}

export default withNextIntl(nextConfig);

