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
const BUNDLE_JS_PATH = path.join(WEBAPP_DIR, 'dist_env_palette_test.js');
const BUNDLE_CSS_PATH = path.join(WEBAPP_DIR, 'dist_env_palette_test.css');
const PORT = 8910;

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

  console.log('[EnvPaletteTest] Bundling client test harness with esbuild...');
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
  <title>Environment-Driven Runner Palette Verification</title>
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

  console.log('[EnvPaletteTest] Launching headless Chromium...');
  const isLinux = process.platform === 'linux';
  const browser = await chromium.launch({
    headless: true,
    executablePath: isLinux && fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: isLinux
      ? [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-proxy-server',
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
        ]
      : ['--no-sandbox', '--disable-dev-shm-usage'],
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
    await page.waitForTimeout(1500);

    // Keep bed fixed as Kyoto + Cloud across all environment switches
    const environments: Array<{
      envId: 'zen-sanctuary' | 'mid-century' | 'modern-sanctuary';
      filename?: string;
    }> = [
      { envId: 'zen-sanctuary', filename: 'test_env_palette_zen_kyoto.png' },
      { envId: 'mid-century', filename: 'test_env_palette_midcentury_kyoto.png' },
      { envId: 'modern-sanctuary', filename: 'test_env_palette_modern_kyoto.png' },
    ];

    for (const item of environments) {
      await page.evaluate((envId) => {
        const api = window.__CONFIGURATOR_TEST__!;
        api.setStoreState({
          activeEnvironment: envId,
          activeMattress: 'cloud',
          activeBedFrame: 'kyoto',
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
        api.setCamera([2.25, 1.25, 2.25], [0, 0.48, -0.05]);
        api.renderFrame();
      }, item.envId);
      await page.waitForTimeout(450);

      console.log(`[ENV ${item.envId}] Rendered Kyoto + Cloud with environment-bound runner`);
      if (item.filename) {
        const outPath = path.join(TEST_ARTIFACTS_DIR, item.filename);
        await page.screenshot({ path: outPath });
        console.log(`[SNAPSHOT GENERATED]: ${outPath}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(BUNDLE_JS_PATH)) fs.unlinkSync(BUNDLE_JS_PATH);
    if (fs.existsSync(BUNDLE_CSS_PATH)) fs.unlinkSync(BUNDLE_CSS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
