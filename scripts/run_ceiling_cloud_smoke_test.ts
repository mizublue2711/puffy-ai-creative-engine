import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = path.join(ROOT_DIR, 'webapp');

const ARTIFACT_DIR = '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/d6c8f02e-66d9-4735-8962-d443dec6c99f';
const PUBLIC_DIR = path.join(WEBAPP_DIR, 'public');

const PORT = 8901;
const BUNDLE_PATH = path.join(WEBAPP_DIR, 'dist_cloud_test_bundle.js');

async function main() {
  console.log('[CloudSmokeTest] Bundling client test script with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/ceiling_cloud_snapshot_client.ts')} --bundle --outfile=${BUNDLE_PATH} --format=esm --target=es2022 --sourcemap=inline`,
    { cwd: WEBAPP_DIR, stdio: 'inherit' },
  );

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf-8');

  let serverResolve: (val: unknown) => void;
  const snapshotPromise = new Promise((resolve) => {
    serverResolve = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Puffy Cloud Ceiling Light Smoke Test</title>
  <style>
    body { margin: 0; background: #000; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
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

    if (req.method === 'POST' && req.url === '/save-snapshot') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          serverResolve(payload);
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
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[CloudSmokeTest] Server listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  console.log('[CloudSmokeTest] Launching Headless Chromium with SwiftShader WebGL...');
  const chromeProcess = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--window-size=1920,1080',
      `http://127.0.0.1:${PORT}/`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const payload: any = await Promise.race([
    snapshotPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for snapshot payload (30s)')), 30000)),
  ]);

  console.log('[CloudSmokeTest] Telemetry:', JSON.stringify({
    registered: payload.registered,
    registryId: payload.registryId,
    polyCount: payload.polyCount,
    worldPos: payload.worldPos,
    bounds: payload.bounds,
  }, null, 2));

  const base64Data = payload.dataURL.replace(/^data:image\/png;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const artifactImagePath = path.join(ARTIFACT_DIR, 'ceiling_cloud_smoke_test.png');
  fs.writeFileSync(artifactImagePath, imageBuffer);
  console.log(`[CloudSmokeTest] Saved artifact image: ${artifactImagePath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const publicImagePath = path.join(PUBLIC_DIR, 'ceiling_cloud_smoke_test.png');
  fs.writeFileSync(publicImagePath, imageBuffer);
  console.log(`[CloudSmokeTest] Saved public image: ${publicImagePath}`);

  chromeProcess.kill('SIGTERM');
  server.close();
  if (fs.existsSync(BUNDLE_PATH)) {
    fs.unlinkSync(BUNDLE_PATH);
  }
}

main().catch((err) => {
  console.error('[CloudSmokeTest] Error:', err);
  process.exit(1);
});
