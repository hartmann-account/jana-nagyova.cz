// Renders the site in headless Chromium and saves screenshots.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:8787';
const outDir = process.argv[3] || 'screenshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const views = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const problems = [];
for (const v of views) {
  for (const [lang, path] of [['cs', '/'], ['de', '/de/']]) {
    const ctx = await browser.newContext(v);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${v.name}/${lang} console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`${v.name}/${lang} pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`${v.name}/${lang} requestfailed: ${r.url()}`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${v.name}/${lang} HTTP ${r.status()}: ${r.url()}`); });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const noWebgl = await page.evaluate(() => document.documentElement.classList.contains('no-webgl'));
    if (noWebgl) problems.push(`${v.name}/${lang}: WebGL fallback active`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${v.name}/${lang}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${outDir}/${v.name}-${lang}-hero.png` });
    for (const id of ['about', 'highlights', 'filmography', 'gallery', 'contact']) {
      await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: 'instant' }), id);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${outDir}/${v.name}-${lang}-${id}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no problems detected');
