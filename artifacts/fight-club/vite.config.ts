import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { sharePages } from './share-pages';
import { parsePublicBaseUrl } from './src/lib/public-base-url';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

// Local development only: the root `pnpm dev` script sets API_PORT so the picker
// can call the API same-origin. Unset when /api is routed by something else.
const apiPort = process.env.API_PORT;

if (apiPort !== undefined && (Number.isNaN(Number(apiPort)) || Number(apiPort) <= 0)) {
  throw new Error(`Invalid API_PORT value: "${apiPort}"`);
}

// Optional absolute origin for og:image, og:url and canonical. Throws (fails the build) if invalid.
const publicOrigin = parsePublicBaseUrl(process.env.PUBLIC_BASE_URL);

export default defineConfig({
  base: basePath,
  plugins: [
    sharePages(publicOrigin),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    ...(apiPort
      ? { proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false } } }
      : {}),
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
