// Bakes the procedural models into motion-vector sheets under public/assets/mv.
// Usage: node tools/bake.mjs [model ...]   (needs a Chrome with --remote-debugging-port=9222,
//        or set BAKE_LAUNCH=1 to launch a local Chromium through Playwright)
// Previews: BAKE_OUT=<dir> writes there instead of public/assets/mv, BAKE_CELL=512 bakes smaller cells.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.BAKE_OUT ? path.resolve(process.env.BAKE_OUT) : path.join(root, 'public', 'assets', 'mv');
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(4100, '127.0.0.1', r));

const browser = process.env.BAKE_LAUNCH
  ? await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
  : await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0] || (await browser.newContext());
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[bake]')) console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto('http://127.0.0.1:4100/tools/baker/index.html');
await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 60000 });
if (process.env.BAKE_DEBUG) await page.evaluate((d) => { window.bakeDebug = d; }, Number(process.env.BAKE_DEBUG));

const all = ['playstation', 'switch', 'xbox', 'logo', 'handheld', 'cartridge', 'joystick', 'crt', 'headset'];
const names = process.argv.slice(2).length ? process.argv.slice(2) : all;
const manifestPath = path.join(outDir, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

for (const name of names) {
  const t0 = Date.now();
  const res = await page.evaluate(([n, c]) => window.bakeModel(n, c), [name, Number(process.env.BAKE_CELL) || 1024]);
  for (const [pass, url] of Object.entries(res.passes)) {
    const ext = url.startsWith('data:image/png') ? 'png' : 'jpg';
    fs.writeFileSync(path.join(outDir, `${name}_${pass}.${ext}`), Buffer.from(url.split(',')[1], 'base64'));
  }
  manifest[name] = { ...res.meta, v: Date.now().toString(36) };
  console.log(`baked ${name} in ${Date.now() - t0}ms`, res.meta);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
await page.close();
if (process.env.BAKE_LAUNCH) await browser.close();
server.close();
process.exit(0);
