import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';

function mobileMediaDevProxyPlugin() {
  return {
    name: 'mobile-media-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.includes('mobile-media')) return next();

        try {
          const parsed = new URL(rawUrl, 'http://localhost');
          const target = parsed.searchParams.get('u');
          if (!target || !/^https:\/\/(video|pbs|ton)\.twimg\.com\//i.test(target)) {
            res.statusCode = 400;
            res.end('Invalid media URL');
            return;
          }

          const headers = {
            Referer: 'https://x.com/',
            Origin: 'https://x.com',
            Accept: '*/*',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          };
          if (req.headers.range) headers.Range = req.headers.range;

          const upstream = await fetch(target, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers,
            redirect: 'follow',
          });

          res.statusCode = upstream.status;
          const pass = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
          for (const key of pass) {
            const value = upstream.headers.get(key);
            if (value) res.setHeader(key, value);
          }
          if (!res.getHeader('content-type') && /\.mp4/i.test(target)) {
            res.setHeader('Content-Type', 'video/mp4');
          }
          if (!res.getHeader('accept-ranges')) {
            res.setHeader('Accept-Ranges', 'bytes');
          }

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          if (upstream.body) {
            const { Readable } = await import('node:stream');
            Readable.fromWeb(upstream.body).pipe(res);
            return;
          }

          res.end();
        } catch (error) {
          res.statusCode = 502;
          res.end(error instanceof Error ? error.message : 'proxy error');
        }
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    mobileMediaDevProxyPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'BookmView Watch',
        short_name: 'BookmView',
        description: 'Watch-only library from your local BookmView database. No data leaves your device.',
        theme_color: '#0f0f12',
        background_color: '#0f0f12',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
