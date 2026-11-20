import { defineConfig } from 'vite';

export default defineConfig({
  // Fixed port so scripts/audit.mjs and scripts/shots.mjs find the dev server.
  server: { port: 5180, strictPort: true },
  preview: { port: 5181 },
  build: { target: 'es2022', sourcemap: true },
});
