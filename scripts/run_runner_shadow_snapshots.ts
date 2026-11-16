import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = path.join(ROOT_DIR, 'webapp');
const ARTIFACT_DIR = '/Users/macbookpro/.gemini/antigravity/brain/1a4cb1c0-2ae5-44e7-b194-22463b2dbd15';
const BUNDLE_PATH = path.join(WEBAPP_DIR, 'dist_runner_shadow_test.js');
const PORT = 8905;

async function main() {
  console.log('[SnapshotRunner] Bundling client test script with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/runner_shadow_snapshot_client.ts')} --bundle --outfile=${BUNDLE_PATH} --format=esm --target=es2022`,
    { cwd: WEBAPP_DIR, stdio: 'inherit' },
  );

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf-8');

  let resolvePayload: (val: Record<string, unknown>) => void;
  const payloadPromise = new Promise<Record<string, unknown>>((resolve) => {
    resolvePayload = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Runner & Shadow Snapshots</title></head>
<body style="margin:0;background:#000;overflow:hidden;">
  <script type="module" src="/bundle.js"></script>
</body>
</html>`);
      return;
    }

    if (req.method === 'GET' && req.url === '/bundle.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundleCode);
      return;
    }

    if (req.method === 'POST' && req.url === '/save-snapshots') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          resolvePayload(parsed);
        } catch {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });

  console.log('[SnapshotRunner] Launching Playwright Chromium with SwiftShader WebGL...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[Browser Error]', msg.text());
    });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });

    const payload = await Promise.race([
      payloadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for WebGL snapshots')), 30000),
      ),
    ]);

    const savePng = (dataUrl: string, filename: string) => {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const outPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`[SnapshotRunner] Saved ${outPath}`);
    };

    savePng(String(payload.snapshotA), 'snapshot_a_runner_zoom.png');
    savePng(String(payload.snapshotB), 'test_06_diagonal_bed_shadows.png');

    console.log('[SnapshotRunner] Telemetry:', JSON.stringify({
      throwBounds: payload.throwBounds,
      registryKeys: payload.registryKeys,
      runnerTransform: (payload.runnerRegistry as { defaultTransform?: unknown })?.defaultTransform,
    }, null, 2));
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(BUNDLE_PATH)) {
      fs.unlinkSync(BUNDLE_PATH);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
