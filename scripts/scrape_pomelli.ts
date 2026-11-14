import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Response } from 'playwright';
import {
  injectSessionCookies,
  normalizeCookies,
  saveStorageState,
  type RawExtensionCookie,
} from './lib/auth';

export type SupportedImageFormat = 'png' | 'webp' | 'jpeg';

export interface ParsedImageInfo {
  format: SupportedImageFormat;
  width: number;
  height: number;
  resolution: string;
  aspectRatio: string;
  byteLength: number;
}

export interface ProductTaxonomy {
  sku: string;
  name: string;
  category: string;
  categoryFolder: string;
  normalizedSlug: string;
  productTier: 'signature' | 'luxury' | 'ultra-luxury' | 'accessory';
  defaultTags: string[];
}

export interface ManifestAssetEntry {
  sku: string;
  name: string;
  category: string;
  local_path: string;
  source_url: string;
  downloaded_at: string;
  checksum: string;
  aspect_ratio: string;
  resolution: string;
  product_tier: string;
  dominant_hex_colors: string[];
  tags: string[];
}

export interface AssetManifest {
  schema_version: string;
  brand: string;
  source: string;
  updated_at: string;
  total_assets: number;
  assets: ManifestAssetEntry[];
}

interface DomAssetHint {
  src: string;
  alt: string;
  title: string;
  categoryHint: string;
  assetTypeHint: string;
  colors: string[];
}

interface CapturedNetworkAsset {
  url: string;
  contentType: string;
  buffer: Buffer;
  imageInfo: ParsedImageInfo;
  checksum: string;
}

const DEFAULT_DASHBOARD_URL = 'https://labs.google/pomelli';
const MANIFEST_PATH = 'assets/manifest.json';
const BRAND_TOKENS_PATH = 'config/brand_tokens.json';
const MIN_BUFFER_BYTES = Number(process.env.POMELLI_MIN_BYTES ?? 4096);
const MIN_DIMENSION_PX = Number(process.env.POMELLI_MIN_DIM ?? 256);

const NOISE_URL_PATTERNS: RegExp[] = [
  /\/analytics\b/i,
  /\/telemetry\b/i,
  /\/collect\b/i,
  /\/beacon\b/i,
  /\/pixel\b/i,
  /favicon/i,
  /avatar/i,
  /profile[_-]?photo/i,
  /\/icons?\//i,
  /sprite/i,
  /1x1/i,
  /spacer/i,
  /\.svg(\?|$)/i,
  /\.ico(\?|$)/i,
  /fonts\.gstatic\.com/i,
  /accounts\.google\.com/i,
  /www\.google-analytics\.com/i,
];

const PRODUCT_CATALOG_MAP: Array<{
  pattern: RegExp;
  taxonomy: ProductTaxonomy;
}> = [
  {
    pattern: /puffy[\s_-]*lux[\s_-]*hybrid|lux[\s_-]*hyb/i,
    taxonomy: {
      sku: 'PUFFY-LUX-HYB-001',
      name: 'Puffy Lux Hybrid',
      category: 'mattress',
      categoryFolder: 'mattresses',
      normalizedSlug: 'puffy-lux-hybrid',
      productTier: 'luxury',
      defaultTags: ['luxury', 'hybrid', 'cloud-foam', 'contour-shadow'],
    },
  },
  {
    pattern: /puffy[\s_-]*royal[\s_-]*hybrid|royal[\s_-]*hyb/i,
    taxonomy: {
      sku: 'PUFFY-ROY-HYB-001',
      name: 'Puffy Royal Hybrid',
      category: 'mattress',
      categoryFolder: 'mattresses',
      normalizedSlug: 'puffy-royal-hybrid',
      productTier: 'ultra-luxury',
      defaultTags: ['ultra-luxury', 'hybrid', 'zoned-support', 'cooling'],
    },
  },
  {
    pattern: /puffy[\s_-]*monarch[\s_-]*hybrid|monarch/i,
    taxonomy: {
      sku: 'PUFFY-MON-HYB-001',
      name: 'Puffy Monarch Hybrid',
      category: 'mattress',
      categoryFolder: 'mattresses',
      normalizedSlug: 'puffy-monarch-hybrid',
      productTier: 'ultra-luxury',
      defaultTags: ['ultra-luxury', 'hybrid', 'alpaca-wool', 'contour-shadow'],
    },
  },
  {
    pattern: /puffy[\s_-]*cloud[\s_-]*mattress|cloud[\s_-]*mattress/i,
    taxonomy: {
      sku: 'PUFFY-CLD-MAT-001',
      name: 'Puffy Cloud Mattress',
      category: 'mattress',
      categoryFolder: 'mattresses',
      normalizedSlug: 'puffy-cloud-mattress',
      productTier: 'signature',
      defaultTags: ['signature', 'all-foam', 'cloud-foam', 'cooling'],
    },
  },
  {
    pattern: /pillow|contour/i,
    taxonomy: {
      sku: 'PUFFY-ACC-PIL-001',
      name: 'Puffy Signature Pillow',
      category: 'pillow',
      categoryFolder: 'pillows',
      normalizedSlug: 'puffy-signature-pillow',
      productTier: 'accessory',
      defaultTags: ['accessory', 'pillow', 'memory-foam'],
    },
  },
  {
    pattern: /foundation|adjustable[\s_-]*base|bed[\s_-]*frame/i,
    taxonomy: {
      sku: 'PUFFY-FND-BAS-001',
      name: 'Puffy Adjustable Base',
      category: 'foundation',
      categoryFolder: 'foundations',
      normalizedSlug: 'puffy-adjustable-base',
      productTier: 'accessory',
      defaultTags: ['foundation', 'adjustable-base', 'ergonomic'],
    },
  },
];

function computeGcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatAspectRatio(width: number, height: number): string {
  const divisor = computeGcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * Validates image magic bytes, container integrity, and extracts exact width/height
 * without requiring native image decoding binaries.
 */
export function inspectImageBuffer(buffer: Buffer): ParsedImageInfo | null {
  if (!buffer || buffer.length < 24) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR at bytes 12..24, IEND trailer
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (isPng) {
    const ihdr = buffer.subarray(12, 16).toString('ascii');
    if (ihdr !== 'IHDR') {
      return null;
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const hasIend = buffer.includes(Buffer.from('IEND', 'ascii'));
    if (width <= 0 || height <= 0 || !hasIend) {
      return null;
    }
    return {
      format: 'png',
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: formatAspectRatio(width, height),
      byteLength: buffer.length,
    };
  }

  // WebP: RIFF <size> WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const riffSize = buffer.readUInt32LE(4);
    if (buffer.length < riffSize + 8) {
      return null;
    }
    const chunkType = buffer.subarray(12, 16).toString('ascii');
    let width = 0;
    let height = 0;

    if (chunkType === 'VP8 ' && buffer.length >= 30) {
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunkType === 'VP8L' && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    } else if (chunkType === 'VP8X' && buffer.length >= 30) {
      width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    }

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      format: 'webp',
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: formatAspectRatio(width, height),
      byteLength: buffer.length,
    };
  }

  // JPEG: FF D8 ... SOF0/SOF1/SOF2 ... FF D9
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    let width = 0;
    let height = 0;

    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) {
        break;
      }
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
        offset += 2;
        continue;
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
        break;
      }
      if (marker >= 0xc0 && marker <= 0xc3 && offset + 9 < buffer.length) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      offset += 2 + segmentLength;
    }

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      format: 'jpeg',
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: formatAspectRatio(width, height),
      byteLength: buffer.length,
    };
  }

  return null;
}

/**
 * Determines whether a network response URL + content-type represents a high-res
 * Stitch/Pomelli brand asset rather than UI chrome, icons, or analytics beacons.
 */
export function isCandidateAssetResponse(
  url: string,
  contentType: string,
): boolean {
  if (!url || NOISE_URL_PATTERNS.some((pattern) => pattern.test(url))) {
    return false;
  }

  const normalizedMime = contentType.toLowerCase().split(';')[0].trim();
  if (normalizedMime === 'image/svg+xml' || normalizedMime.includes('icon')) {
    return false;
  }

  const isSupportedImageMime =
    normalizedMime === 'image/png' ||
    normalizedMime === 'image/webp' ||
    normalizedMime === 'image/jpeg';

  const isStitchOrCdnUrl =
    url.includes('stitch') ||
    url.includes('googleusercontent.com') ||
    url.includes('ggpht.com') ||
    url.includes('storage.googleapis.com');

  return isSupportedImageMime || (isStitchOrCdnUrl && normalizedMime.startsWith('image/'));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'puffy-brand-asset';
}

export function resolveProductTaxonomy(hintText: string): ProductTaxonomy {
  const cleaned = hintText.trim();
  for (const entry of PRODUCT_CATALOG_MAP) {
    if (entry.pattern.test(cleaned)) {
      return entry.taxonomy;
    }
  }

  const normalizedSlug = slugify(cleaned || 'puffy-brand-asset');
  const skuToken = normalizedSlug
    .replace(/^puffy-/, '')
    .split('-')
    .slice(0, 3)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join('-');

  return {
    sku: `PUFFY-${skuToken || 'GEN'}-001`,
    name: cleaned || 'Puffy Brand Asset',
    category: 'mattress',
    categoryFolder: 'mattresses',
    normalizedSlug,
    productTier: 'signature',
    defaultTags: ['puffy', 'pomelli', 'brand-asset'],
  };
}

export function detectAssetType(hintText: string, url: string): string {
  const combined = `${hintText} ${url}`.toLowerCase();
  if (/cross[-_\s]?section|layer|cutaway|diagram/.test(combined)) {
    return 'cross-section';
  }
  if (/lifestyle|bedroom|room|scene|sanctuary/.test(combined)) {
    return 'lifestyle';
  }
  if (/detail|stitch|quilting|texture|zoom/.test(combined)) {
    return 'detail';
  }
  return 'hero';
}

export function buildCatalogAssetPath(params: {
  categoryFolder: string;
  normalizedSlug: string;
  assetType: string;
  resolution: string;
  checksum: string;
  format: SupportedImageFormat;
}): string {
  const shortHash = params.checksum.slice(0, 6);
  const ext = params.format === 'jpeg' ? 'jpg' : params.format;
  return path.posix.join(
    'assets',
    'catalog',
    params.categoryFolder,
    params.normalizedSlug,
    `${params.assetType}_${params.resolution}_${shortHash}.${ext}`,
  );
}

export function loadDefaultBrandColors(cwd = process.cwd()): string[] {
  const fallback = ['#2B2F44', '#FFFFFF', '#E5E3DF', '#067A57', '#333333'];
  const tokensPath = path.resolve(cwd, BRAND_TOKENS_PATH);
  if (!fs.existsSync(tokensPath)) {
    return fallback;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf8')) as {
      colors?: { primary?: Record<string, { hex?: string }> };
    };
    const primary = raw.colors?.primary;
    if (!primary) {
      return fallback;
    }
    const hexes = Object.values(primary)
      .map((token) => token.hex)
      .filter((hex): hex is string => Boolean(hex && /^#[0-9A-Fa-f]{6}$/.test(hex)));
    return hexes.length > 0 ? hexes : fallback;
  } catch {
    return fallback;
  }
}

export function loadManifest(cwd = process.cwd()): AssetManifest {
  const manifestAbsPath = path.resolve(cwd, MANIFEST_PATH);
  if (!fs.existsSync(manifestAbsPath)) {
    return {
      schema_version: '1.0.0',
      brand: 'Puffy®',
      source: 'Google Pomelli',
      updated_at: new Date().toISOString(),
      total_assets: 0,
      assets: [],
    };
  }

  const parsed = JSON.parse(fs.readFileSync(manifestAbsPath, 'utf8')) as
    | AssetManifest
    | ManifestAssetEntry[];

  if (Array.isArray(parsed)) {
    return {
      schema_version: '1.0.0',
      brand: 'Puffy®',
      source: 'Google Pomelli',
      updated_at: new Date().toISOString(),
      total_assets: parsed.length,
      assets: parsed,
    };
  }

  return {
    schema_version: parsed.schema_version || '1.0.0',
    brand: parsed.brand || 'Puffy®',
    source: parsed.source || 'Google Pomelli',
    updated_at: parsed.updated_at || new Date().toISOString(),
    total_assets: parsed.assets?.length ?? 0,
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
  };
}

export function saveManifest(manifest: AssetManifest, cwd = process.cwd()): void {
  const manifestAbsPath = path.resolve(cwd, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(manifestAbsPath), { recursive: true });
  const payload: AssetManifest = {
    ...manifest,
    total_assets: manifest.assets.length,
  };
  fs.writeFileSync(manifestAbsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function collectDomAssetHints(page: import('playwright').Page): Promise<DomAssetHint[]> {
  return page.evaluate(() => {
    const hexRegex = /#[0-9A-Fa-f]{6}\b/g;
    const imgs = Array.from(document.querySelectorAll('img'));

    return imgs.map((img) => {
      const container =
        img.closest('[data-sku], [data-testid], article, section, [role="listitem"], div') ||
        img.parentElement;
      const heading = container?.querySelector('h1, h2, h3, h4, [data-product-name], [data-sku]');
      const containerText = (container?.textContent || '').trim();
      const hexMatches = containerText.match(hexRegex) || [];

      return {
        src: img.currentSrc || img.src || '',
        alt: img.alt || '',
        title:
          container?.getAttribute('data-product-name') ||
          container?.getAttribute('data-sku') ||
          heading?.textContent?.trim() ||
          img.alt ||
          '',
        categoryHint: container?.getAttribute('data-category') || '',
        assetTypeHint: container?.getAttribute('data-asset-type') || '',
        colors: Array.from(new Set(hexMatches.map((h) => h.toUpperCase()))),
      };
    });
  });
}

function matchDomHint(url: string, hints: DomAssetHint[]): DomAssetHint | undefined {
  const exact = hints.find((h) => h.src && (h.src === url || url.includes(h.src) || h.src.includes(url)));
  if (exact) {
    return exact;
  }
  const urlBase = url.split('?')[0].split('/').pop() || '';
  if (!urlBase) {
    return undefined;
  }
  return hints.find((h) => h.src.includes(urlBase));
}

async function tryProcessResponse(
  response: Response,
  capturedByChecksum: Map<string, CapturedNetworkAsset>,
): Promise<void> {
  const url = response.url();
  const status = response.status();
  if (status < 200 || status >= 300) {
    return;
  }

  const contentType = response.headers()['content-type'] || '';
  if (!isCandidateAssetResponse(url, contentType)) {
    return;
  }

  let buffer: Buffer;
  try {
    buffer = await response.body();
  } catch {
    return;
  }

  if (buffer.length < MIN_BUFFER_BYTES) {
    return;
  }

  const imageInfo = inspectImageBuffer(buffer);
  if (!imageInfo) {
    return;
  }

  if (imageInfo.width < MIN_DIMENSION_PX || imageInfo.height < MIN_DIMENSION_PX) {
    return;
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  if (!capturedByChecksum.has(checksum)) {
    capturedByChecksum.set(checksum, {
      url,
      contentType,
      buffer,
      imageInfo,
      checksum,
    });
  }
}

/**
 * Self-test mode validates cookie normalization, binary PNG inspection,
 * taxonomy resolution, path generation, and manifest idempotency without remote auth.
 */
function runDrySelfTest(): void {
  const sampleRawCookies: RawExtensionCookie[] = [
    {
      name: '__Secure-1PSID',
      value: 'dummy-token',
      domain: '.google.com',
      path: '/',
      expirationDate: 1893456000,
      httpOnly: true,
      secure: true,
      sameSite: 'no_restriction',
    },
    {
      name: 'SID',
      value: 'dummy-sid',
      domain: '.google.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'unspecified',
    },
  ];
  const normalized = normalizeCookies(sampleRawCookies);
  if (normalized[0].sameSite !== 'None' || normalized[1].sameSite !== 'None') {
    throw new Error('Cookie sameSite normalization check failed.');
  }

  // Minimal valid 1024x1024 PNG header + IEND for parser self-test
  const pngBuffer = Buffer.alloc(37);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngBuffer, 0);
  pngBuffer.writeUInt32BE(13, 8);
  pngBuffer.write('IHDR', 12, 'ascii');
  pngBuffer.writeUInt32BE(1024, 16);
  pngBuffer.writeUInt32BE(1024, 20);
  pngBuffer.write('IEND', 29, 'ascii');

  const parsed = inspectImageBuffer(pngBuffer);
  if (!parsed || parsed.resolution !== '1024x1024' || parsed.aspectRatio !== '1:1') {
    throw new Error('PNG header/bounding box inspection failed.');
  }

  const taxonomy = resolveProductTaxonomy('Puffy Lux Hybrid');
  const checksum = crypto.createHash('sha256').update(pngBuffer).digest('hex');
  const assetPath = buildCatalogAssetPath({
    categoryFolder: taxonomy.categoryFolder,
    normalizedSlug: taxonomy.normalizedSlug,
    assetType: 'hero',
    resolution: parsed.resolution,
    checksum,
    format: parsed.format,
  });

  if (
    !assetPath.startsWith('assets/catalog/mattresses/puffy-lux-hybrid/hero_1024x1024_') ||
    !assetPath.endsWith('.png')
  ) {
    throw new Error(`Unexpected asset path generated: ${assetPath}`);
  }

  console.log('[scrape_pomelli] Dry self-test passed:');
  console.log(`  - Normalized cookies: ${normalized.length}`);
  console.log(`  - Inspected image: ${parsed.format} ${parsed.resolution} (${parsed.aspectRatio})`);
  console.log(`  - Sample taxonomy: ${taxonomy.sku} -> ${assetPath}`);
}

export async function runScrape(cwd = process.cwd()): Promise<{
  discovered: number;
  added: number;
  skippedDuplicates: number;
}> {
  const dashboardUrl = process.env.POMELLI_DASHBOARD_URL || DEFAULT_DASHBOARD_URL;
  const headless = process.env.HEADLESS !== 'false';
  const defaultBrandColors = loadDefaultBrandColors(cwd);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await injectSessionCookies(context, { cwd });

  const page = await context.newPage();
  const capturedByChecksum = new Map<string, CapturedNetworkAsset>();
  const pendingHandlers: Array<Promise<void>> = [];

  page.on('response', (response) => {
    const task = tryProcessResponse(response, capturedByChecksum);
    pendingHandlers.push(task);
  });

  try {
    console.log(`[scrape_pomelli] Navigating to ${dashboardUrl}...`);
    await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      console.warn('[scrape_pomelli] networkidle timeout reached; continuing with captured assets.');
    });

    // Scroll to trigger lazy-loaded high-res Stitch/Pomelli CDN images.
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight / 2);
      await new Promise((r) => setTimeout(r, 600));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 800));
    });

    await Promise.allSettled(pendingHandlers);
    const domHints = await collectDomAssetHints(page);

    // Persist refreshed session cookies locally (git-ignored)
    await saveStorageState(context, path.resolve(cwd, 'auth_cookies.json'));

    const manifest = loadManifest(cwd);
    const existingChecksums = new Set(manifest.assets.map((entry) => entry.checksum));

    let added = 0;
    let skippedDuplicates = 0;

    for (const captured of capturedByChecksum.values()) {
      const hint = matchDomHint(captured.url, domHints);
      const taxonomy = resolveProductTaxonomy(hint?.title || hint?.alt || captured.url);
      const assetType = detectAssetType(
        `${hint?.assetTypeHint || ''} ${hint?.alt || ''} ${hint?.title || ''}`,
        captured.url,
      );
      const localPath = buildCatalogAssetPath({
        categoryFolder: taxonomy.categoryFolder,
        normalizedSlug: taxonomy.normalizedSlug,
        assetType,
        resolution: captured.imageInfo.resolution,
        checksum: captured.checksum,
        format: captured.imageInfo.format,
      });
      const absTarget = path.resolve(cwd, localPath);

      if (existingChecksums.has(captured.checksum) && fs.existsSync(absTarget)) {
        skippedDuplicates += 1;
        continue;
      }

      fs.mkdirSync(path.dirname(absTarget), { recursive: true });
      fs.writeFileSync(absTarget, captured.buffer);

      if (!existingChecksums.has(captured.checksum)) {
        const entry: ManifestAssetEntry = {
          sku: taxonomy.sku,
          name: taxonomy.name,
          category: taxonomy.category,
          local_path: localPath,
          source_url: captured.url,
          downloaded_at: new Date().toISOString(),
          checksum: captured.checksum,
          aspect_ratio: captured.imageInfo.aspectRatio,
          resolution: captured.imageInfo.resolution,
          product_tier: taxonomy.productTier,
          dominant_hex_colors:
            hint && hint.colors.length > 0 ? hint.colors : defaultBrandColors,
          tags: Array.from(new Set([...taxonomy.defaultTags, assetType])),
        };
        manifest.assets.push(entry);
        existingChecksums.add(captured.checksum);
        added += 1;
      }
    }

    if (added > 0) {
      manifest.updated_at = new Date().toISOString();
      saveManifest(manifest, cwd);
    }

    console.log(
      `[scrape_pomelli] Complete: discovered=${capturedByChecksum.size}, added=${added}, skipped=${skippedDuplicates}`,
    );

    return {
      discovered: capturedByChecksum.size,
      added,
      skippedDuplicates,
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has('--dry-run') || args.has('--self-test')) {
    runDrySelfTest();
    return;
  }
  await runScrape();
}

const isDirectEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith(path.normalize('scripts/scrape_pomelli.ts'));

if (isDirectEntry) {
  main().catch((err) => {
    console.error('[scrape_pomelli] Fatal error:', err);
    process.exit(1);
  });
}
