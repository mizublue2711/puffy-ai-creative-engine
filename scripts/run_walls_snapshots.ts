import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = path.join(ROOT_DIR, 'webapp');
const PUBLIC_DIR = path.join(WEBAPP_DIR, 'public');
const TEST_ARTIFACTS_DIR = path.join(ROOT_DIR, 'test_artifacts');
const ARTIFACT_DIR =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/1993bd2d-912e-4a65-854a-904e9e6b5f75';

const PORT = 8912;
const BUNDLE_PATH = path.join(WEBAPP_DIR, 'dist_walls_test_bundle.js');

async function main() {
  console.log('[WallsSnapshot] Bundling client test script with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/walls_snapshot_client.ts')} --bundle --outfile=${BUNDLE_PATH} --format=esm --target=es2022 --sourcemap=inline`,
    { cwd: WEBAPP_DIR, stdio: 'inherit' },
  );

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf-8');

  let serverResolve: (val: Record<string, unknown>) => void;
  const snapshotPromise = new Promise<Record<string, unknown>>((resolve) => {
    serverResolve = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vertical Timber Slat Wall Verification</title>
  <style>
    body { margin: 0; background: #EFEAE1; overflow: hidden; }
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
          const payload = JSON.parse(body) as Record<string, unknown>;
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

    const cleanUrl = (req.url ?? '').split('?')[0];
    const candidatePaths = [
      path.join(PUBLIC_DIR, cleanUrl),
      path.join(ROOT_DIR, cleanUrl),
    ];
    for (const staticPath of candidatePaths) {
      if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        const ext = path.extname(staticPath).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.jpg'
                ? 'image/jpeg'
                : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(staticPath).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[WallsSnapshot] Server listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  console.log('[WallsSnapshot] Launching Headless Chromium...');
  const chromeProcess = spawn(
    '/usr/bin/google-chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-proxy-server',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
      '--ignore-certificate-errors',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--window-size=1600,1000',
      '--enable-logging=stderr',
      '--v=0',
      `http://127.0.0.1:${PORT}/`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  chromeProcess.stderr?.on('data', (d) => {
    const line = String(d).trim();
    if (line.includes('CONSOLE:')) console.log('[Browser Console]', line);
  });

  try {
    const payload = await Promise.race([
      snapshotPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for WebGL wall snapshots')), 90000),
      ),
    ]);

    const snapshots = payload.snapshots as Record<string, string>;
    console.log('[WallsSnapshot] Received snapshots:', Object.keys(snapshots));

    fs.mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    for (const [filename, dataUrl] of Object.entries(snapshots)) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      const testArtifactPath = path.join(TEST_ARTIFACTS_DIR, filename);
      const brainArtifactPath = path.join(ARTIFACT_DIR, filename);
      const rootPath = path.join(ROOT_DIR, filename);
      const publicPath = path.join(PUBLIC_DIR, filename);

      fs.writeFileSync(testArtifactPath, buffer);
      fs.writeFileSync(brainArtifactPath, buffer);
      fs.writeFileSync(rootPath, buffer);
      fs.writeFileSync(publicPath, buffer);

      console.log(`[SAVED SNAPSHOT]: ${filename} (${buffer.length} bytes)`);
    }

    console.log('[WallsSnapshot] Wall materials verified:', payload.wallMaterials);
    console.log('[WallsSnapshot] Completed successfully.');
  } finally {
    chromeProcess.kill('SIGKILL');
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
