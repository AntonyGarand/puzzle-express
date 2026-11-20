// Renders the app icons (PWA + Apple touch) from the logo geometry, using your installed Chrome.
// Usage: node scripts/icons.mjs   → writes PNGs into public/icons/
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const out = 'public/icons';
mkdirSync(out, { recursive: true });
const logo = readFileSync('public/favicon.svg', 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const BG = '#fff6e5'; // --bg (light)

// `scale` = share of the canvas the logo covers. Maskable icons keep the logo inside the 80% safe zone.
const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.72, bg: BG, radius: 0.22 },
  { file: 'icon-512.png', size: 512, scale: 0.72, bg: BG, radius: 0.22 },
  { file: 'maskable-512.png', size: 512, scale: 0.56, bg: BG, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.66, bg: BG, radius: 0 },
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
for (const i of icons) {
  await page.setViewportSize({ width: i.size, height: i.size });
  const inner = Math.round(i.size * i.scale);
  await page.setContent(
    `<body style="margin:0;background:transparent">
      <div style="width:${i.size}px;height:${i.size}px;background:${i.bg};border-radius:${i.radius * i.size}px;display:grid;place-items:center">
        <div style="width:${inner}px;height:${inner}px">${logo}</div>
      </div></body>`,
  );
  await page.screenshot({ path: join(out, i.file), omitBackground: true });
}
await browser.close();
console.log('icons written to', out);
