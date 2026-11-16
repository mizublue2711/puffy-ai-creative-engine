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
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/4c9913bf-ec3d-4729-bdee-7501994ece36';
const PUBLIC_DIR = path.join(WEBAPP_DIR, 'public');

const PORT = 8903;
const BUNDLE_PATH = path.join(WEBAPP_DIR, 'dist_karesansui_test_bundle.js');

async function main() {
  console.log('[KaresansuiSmokeTest] Bundling client test script with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/karesansui_snapshot_client.ts')} --bundle --outfile=${BUNDLE_PATH} --format=esm --target=es2022 --sourcemap=inline`,
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
  <title>Karesansui Zen Courtyard Smoke Test</title>
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
      console.log(`[KaresansuiSmokeTest] Server listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  console.log('[KaresansuiSmokeTest] Launching Headless Chromium with SwiftShader WebGL...');
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

  chromeProcess.stderr?.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.includes('ERROR') || msg.includes('CONSOLE')) {
      console.error('[Chrome]', msg);
    }
  });

  const payload: any = await Promise.race([
    snapshotPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout waiting for snapshot payload (90s)')), 90000),
    ),
  ]);

  console.log(
    '[KaresansuiSmokeTest] Telemetry:',
    JSON.stringify(
      {
        zenGroupPresent: payload.zenGroupPresent,
        potCount: payload.potCount,
        meshCount: payload.meshCount,
        registeredSandBed: payload.registeredSandBed,
        registeredGardenRig: payload.registeredGardenRig,
        registeredMoonMirror: payload.registeredMoonMirror,
      },
      null,
      2,
    ),
  );

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const courtyardBuffer = Buffer.from(
    payload.courtyardDataURL.replace(/^data:image\/png;base64,/, ''),
    'base64',
  );
  const bedroomBuffer = Buffer.from(
    payload.bedroomDataURL.replace(/^data:image\/png;base64,/, ''),
    'base64',
  );

  const courtyardArtifactPath = path.join(ARTIFACT_DIR, 'test_05_karesansui_zen_courtyard.png');
  const bedroomArtifactPath = path.join(ARTIFACT_DIR, 'test_05_bedroom_to_courtyard.png');
  fs.writeFileSync(courtyardArtifactPath, courtyardBuffer);
  fs.writeFileSync(bedroomArtifactPath, bedroomBuffer);

  const courtyardPublicPath = path.join(PUBLIC_DIR, 'test_05_karesansui_zen_courtyard.png');
  fs.writeFileSync(courtyardPublicPath, courtyardBuffer);

  console.log(`[KaresansuiSmokeTest] Saved courtyard view: ${courtyardArtifactPath}`);
  console.log(`[KaresansuiSmokeTest] Saved bedroom view: ${bedroomArtifactPath}`);

  chromeProcess.kill('SIGTERM');
  server.close();
  if (fs.existsSync(BUNDLE_PATH)) {
    fs.unlinkSync(BUNDLE_PATH);
  }
}

main().catch((err) => {
  console.error('[KaresansuiSmokeTest] Error:', err);
  process.exit(1);
});
