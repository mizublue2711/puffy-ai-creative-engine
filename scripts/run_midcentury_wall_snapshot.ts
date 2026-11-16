import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = path.join(ROOT_DIR, 'webapp');

const ARTIFACT_DIR =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/b47a6cea-5f62-45fb-8dc4-bcc90b8e8199';
const PUBLIC_DIR = path.join(WEBAPP_DIR, 'public');

const PORT = 8906;
const BUNDLE_PATH = path.join(WEBAPP_DIR, 'dist_midcentury_wall_test_bundle.js');

async function main() {
  console.log('[MidCenturyWallSnapshot] Bundling client test script with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/midcentury_vertical_wall_snapshot_client.ts')} --bundle --outfile=${BUNDLE_PATH} --format=esm --target=es2022 --sourcemap=inline`,
    { cwd: WEBAPP_DIR, stdio: 'inherit' },
  );

  const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf-8');

  let serverResolve: (val: Record<string, unknown>) => void;
  const snapshotPromise = new Promise<Record<string, unknown>>((resolve) => {
    serverResolve = resolve;
  });

  const server = http.createServer((req, res) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mid-Century Vertical Timber Wall Verification</title>
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
          const payload = JSON.parse(body) as Record<string, unknown>;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          resolvePayload(payload);
        } catch {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    const cleanUrl = (req.url ?? '').split('?')[0];
    const staticPath = path.join(PUBLIC_DIR, cleanUrl);
    if (req.method === 'GET' && staticPath.startsWith(PUBLIC_DIR) && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
      const ext = path.extname(staticPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(staticPath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  function resolvePayload(val: Record<string, unknown>) {
    serverResolve(val);
  }

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[MidCenturyWallSnapshot] Server listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  console.log('[MidCenturyWallSnapshot] Launching Headless Chromium with SwiftShader WebGL...');
  const chromeProcess = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
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
    if (line) console.error('[Chrome]', line);
  });

  try {
    const payload = await Promise.race([
      snapshotPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for WebGL snapshot')), 90000),
      ),
    ]);

    const base64 = String(payload.snapshot).replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const artifactOut = path.join(ARTIFACT_DIR, 'test_07_midcentury_vertical_wall.png');
    const publicOut = path.join(PUBLIC_DIR, 'test_07_midcentury_vertical_wall.png');

    fs.writeFileSync(artifactOut, buffer);
    fs.writeFileSync(publicOut, buffer);

    console.log(`[MidCenturyWallSnapshot] Saved ${artifactOut}`);
    console.log(`[MidCenturyWallSnapshot] Saved ${publicOut}`);
    console.log(
      '[MidCenturyWallSnapshot] Registry Telemetry:',
      JSON.stringify(
        {
          registryKeys: payload.registryKeys,
          headboardWallRegistry: payload.headboardWallRegistry,
          accentWallRegistry: payload.accentWallRegistry,
        },
        null,
        2,
      ),
    );
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
