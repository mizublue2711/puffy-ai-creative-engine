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
const TEST_ARTIFACTS_DIR = path.join(ROOT_DIR, 'test_artifacts');
const BUNDLE_JS_PATH = path.join(WEBAPP_DIR, 'dist_configurator_test.js');
const BUNDLE_CSS_PATH = path.join(WEBAPP_DIR, 'dist_configurator_test.css');
const PORT = 8907;

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveStaticAsset(urlPath: string): string | null {
  const cleanUrl = urlPath.split('?')[0];
  const candidates = [
    path.join(WEBAPP_DIR, 'public', cleanUrl),
    path.join(ROOT_DIR, cleanUrl),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

async function main() {
  ensureDir(TEST_ARTIFACTS_DIR);

  console.log('[ConfiguratorTest] Bundling client test harness with esbuild...');
  execSync(
    `npx esbuild ${path.join(WEBAPP_DIR, 'src/test/configurator_states_snapshot_client.tsx')} --bundle --outfile=${BUNDLE_JS_PATH} --format=esm --target=es2022`,
    { cwd: WEBAPP_DIR, stdio: 'inherit' },
  );

  const bundleCode = fs.readFileSync(BUNDLE_JS_PATH, 'utf-8');
  const bundleCss = fs.existsSync(BUNDLE_CSS_PATH)
    ? fs.readFileSync(BUNDLE_CSS_PATH, 'utf-8')
    : '';

  const server = http.createServer((req, res) => {
    const reqUrl = req.url ?? '/';
    if (req.method === 'GET' && (reqUrl === '/' || reqUrl === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bedroom Configurator State Matrix Test</title>
  <link rel="stylesheet" href="/bundle.css">
</head>
<body style="margin:0;background:#EFEAE1;overflow:hidden;">
  <script type="module" src="/bundle.js"></script>
</body>
</html>`);
      return;
    }

    if (req.method === 'GET' && reqUrl === '/bundle.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundleCode);
      return;
    }

    if (req.method === 'GET' && reqUrl === '/bundle.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(bundleCss);
      return;
    }

    if (req.method === 'GET') {
      const assetPath = resolveStaticAsset(reqUrl);
      if (assetPath) {
        const ext = path.extname(assetPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });

  console.log('[ConfiguratorTest] Launching headless Chromium with SwiftShader WebGL...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-proxy-server',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[Browser Error]', msg.text());
      }
    });

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'commit', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.__CONFIGURATOR_TEST__?.ready), null, {
      timeout: 60000,
    });

    // Wait briefly for initial texture uploads
    await page.waitForTimeout(800);

    const saveDataUrlPng = (dataUrl: string, filename: string) => {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const outPath = path.join(TEST_ARTIFACTS_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`[SNAPSHOT GENERATED]: ${outPath}`);
    };

    // Pre-check registry keys
    const initialTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const requiredConfigurableIds = [
      'puffy-bed-runner',
      'puffy-pillow-pair',
      'staggered-pendant-cluster',
      'puffy-cloud-ceiling-light',
    ];
    for (const id of requiredConfigurableIds) {
      if (!initialTelemetry.configurableKeys.includes(id)) {
        throw new Error(`Missing required registry ID: ${id}`);
      }
    }
    console.log('[REGISTRY CHECK] PASS:', initialTelemetry.configurableKeys.join(', '));

    // STATE 01: PRISTINE MINIMALIST MATTRESS (RUNNER OFF, 0 PILLOWS)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': false,
          'puffy-pillow-pair': false,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 0,
        isDockExpanded: false,
      });
      api.setCamera([1.10, 1.15, 1.30], [0, 0.58, -0.30]);
    });
    await page.waitForTimeout(350);
    const bareTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const snap01 = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.captureWebGLDataURL());
    saveDataUrlPng(snap01, 'test_dock_01_bare_mattress_no_runner.png');

    // STATE 02: STANDARD BEDROOM STAGING (RUNNER ON, 2 PILLOWS)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': true,
          'puffy-pillow-pair': true,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 2,
        isDockExpanded: false,
      });
      api.setCamera([1.65, 1.25, 1.55], [0, 0.65, -0.20]);
    });
    await page.waitForTimeout(350);
    const standardTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const snap02 = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.captureWebGLDataURL());
    saveDataUrlPng(snap02, 'test_dock_02_standard_runner_2pillows.png');

    // STATE 03: LUXURY PENTHOUSE STAGING (RUNNER ON, 4 PILLOWS)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': true,
          'puffy-pillow-pair': true,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 4,
        isDockExpanded: false,
      });
      api.setCamera([0.95, 1.20, 1.40], [0, 0.70, -0.40]);
    });
    await page.waitForTimeout(350);
    const luxuryTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const snap03 = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.captureWebGLDataURL());
    saveDataUrlPng(snap03, 'test_dock_03_luxury_4pillows.png');

    // STATE 04: UI HUD OVERLAY ERGONOMICS (EXPANDED DOCK VIEWPORT)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': true,
          'puffy-pillow-pair': true,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 2,
        isDockExpanded: true,
        activeCategory: 'bedding',
      });
      api.setCamera([0.0, 1.35, 2.80], [0, 0.75, 0.0]);
      api.renderFrame();
    });
    await page.waitForTimeout(350);
    const snap04Path = path.join(TEST_ARTIFACTS_DIR, 'test_dock_04_ui_hud_expanded.png');
    await page.screenshot({ path: snap04Path });
    console.log(`[SNAPSHOT GENERATED]: ${snap04Path}`);

    // DEDICATED RUNNER TOGGLE SNAPSHOT A: Runner ON, Pillows 2 (Default configuration)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': true,
          'puffy-pillow-pair': true,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 2,
        isDockExpanded: true,
        activeCategory: 'bedding',
      });
      api.setCamera([0.0, 1.30, 2.50], [0, 0.65, 0.0]);
      api.renderFrame();
    });
    await page.waitForTimeout(350);
    const runnerOnTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const runnerOnPath = path.join(TEST_ARTIFACTS_DIR, 'test_dock_runner_ON_default.png');
    await page.screenshot({ path: runnerOnPath });
    console.log(`[SNAPSHOT GENERATED]: ${runnerOnPath}`);

    // DEDICATED RUNNER TOGGLE SNAPSHOT B: Runner OFF, Pillows 2 (Exact same camera)
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': false,
          'puffy-pillow-pair': true,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 2,
        isDockExpanded: true,
        activeCategory: 'bedding',
      });
      api.setCamera([0.0, 1.30, 2.50], [0, 0.65, 0.0]);
      api.renderFrame();
    });
    await page.waitForTimeout(350);
    const runnerOffTelemetry = await page.evaluate(() => window.__CONFIGURATOR_TEST__!.getTelemetry());
    const runnerOffPath = path.join(TEST_ARTIFACTS_DIR, 'test_dock_runner_OFF.png');
    await page.screenshot({ path: runnerOffPath });
    console.log(`[SNAPSHOT GENERATED]: ${runnerOffPath}`);
    console.log(
      'Runner Toggle Mesh Delta (ON -> OFF):',
      `${runnerOnTelemetry.meshCount} -> ${runnerOffTelemetry.meshCount}`,
    );

    // Re-verify unmount back to bare state for 0-leak audit
    await page.evaluate(() => {
      const api = window.__CONFIGURATOR_TEST__!;
      api.setStoreState({
        activeItems: {
          'puffy-bed-runner': false,
          'puffy-pillow-pair': false,
          'staggered-pendant-cluster': true,
          'puffy-cloud-ceiling-light': true,
          'zen-courtyard-sanctuary': true,
        },
        pillowCount: 0,
        isDockExpanded: false,
      });
      api.renderFrame();
    });
    await page.waitForTimeout(300);
    const reunmountedBareTelemetry = await page.evaluate(() =>
      window.__CONFIGURATOR_TEST__!.getTelemetry(),
    );

    console.log('=== CONFIGURATOR UNMOUNT AUDIT ===');
    console.log('Bare State Mesh Count:', bareTelemetry.meshCount);
    console.log('Standard State (Runner + 2 Pillows) Mesh Count:', standardTelemetry.meshCount);
    console.log('Luxury State (Runner + 4 Pillows) Mesh Count:', luxuryTelemetry.meshCount);
    console.log('Re-Unmounted Bare State Mesh Count:', reunmountedBareTelemetry.meshCount);
    console.log('VRAM Geometries (Bare -> Standard -> Luxury -> Re-Bare):', [
      bareTelemetry.geometries,
      standardTelemetry.geometries,
      luxuryTelemetry.geometries,
      reunmountedBareTelemetry.geometries,
    ].join(' -> '));
    console.log('VRAM Textures (Bare -> Standard -> Luxury -> Re-Bare):', [
      bareTelemetry.textures,
      standardTelemetry.textures,
      luxuryTelemetry.textures,
      reunmountedBareTelemetry.textures,
    ].join(' -> '));

    if (
      reunmountedBareTelemetry.meshCount !== bareTelemetry.meshCount ||
      standardTelemetry.meshCount <= bareTelemetry.meshCount ||
      luxuryTelemetry.meshCount <= standardTelemetry.meshCount
    ) {
      throw new Error('Mesh count audit failed: unmount/mount deltas did not match expected hierarchy');
    }
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(BUNDLE_JS_PATH)) fs.unlinkSync(BUNDLE_JS_PATH);
    if (fs.existsSync(BUNDLE_CSS_PATH)) fs.unlinkSync(BUNDLE_CSS_PATH);
  }
}

main().catch((err) => {
  console.error('[ConfiguratorTest] FAILED:', err);
  process.exit(1);
});
