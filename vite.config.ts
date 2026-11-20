import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Short commit + build date, shown in Settings so you can tell which version is running. */
function buildVersion() {
  let sha = 'dev';
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* not a git checkout */
  }
  return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  // Fixed port so scripts/audit.mjs and scripts/shots.mjs find the dev server.
  server: { port: 5180, strictPort: true },
  preview: { port: 5181 },
  build: { target: 'es2022', sourcemap: true },
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
  plugins: [
    // Installable app that works fully offline: every built file (JS, CSS, fonts, both dictionaries,
    // icons) is precached by a Workbox service worker. A new version downloads in the background and
    // src/core/update.ts shows a "new version" banner; reloading activates it.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'puzzle express',
        short_name: 'puzzles',
        description: 'An endless feed of procedurally generated puzzles. Works offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fff6e5',
        theme_color: '#fff6e5',
        categories: ['games', 'education', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // The dictionaries are lazy chunks of a few hundred KB; precache them too so word games work offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Hash routing: every navigation is the app shell.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
