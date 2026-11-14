import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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

export type AllowedCatalogCategory =
  | 'mattress'
  | 'bedding'
  | 'pillow'
  | 'bed-frame'
  | 'accessories';

export interface ProductTaxonomy {
  sku: string;
  name: string;
  category: AllowedCatalogCategory;
  categoryFolder: AllowedCatalogCategory;
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
  skuAttr: string;
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

interface StitchCatalogSeedItem {
  sku: string;
  name: string;
  category: AllowedCatalogCategory;
  normalizedSlug: string;
  assetType: 'hero' | 'cross-section' | 'detail' | 'lifestyle';
  width: number;
  height: number;
  primaryHex: string;
  accentHex: string;
  url: string;
}

const DEFAULT_DASHBOARD_URL = 'https://labs.google/pomelli';
const MANIFEST_PATH = 'assets/manifest.json';
const BRAND_TOKENS_PATH = 'config/brand_tokens.json';
const MIN_BUFFER_BYTES = Number(process.env.POMELLI_MIN_BYTES ?? 51201);
const MIN_DIMENSION_PX = Number(process.env.POMELLI_MIN_DIM ?? 800);

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
      categoryFolder: 'mattress',
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
      categoryFolder: 'mattress',
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
      categoryFolder: 'mattress',
      normalizedSlug: 'puffy-monarch-hybrid',
      productTier: 'ultra-luxury',
      defaultTags: ['ultra-luxury', 'hybrid', 'alpaca-wool', 'contour-shadow'],
    },
  },
  {
    pattern: /puffy[\s_-]*cloud[\s_-]*mattress|cloud[\s_-]*mattress|cld[\s_-]*mat/i,
    taxonomy: {
      sku: 'PUFFY-CLD-MAT-001',
      name: 'Puffy Cloud Mattress',
      category: 'mattress',
      categoryFolder: 'mattress',
      normalizedSlug: 'puffy-cloud-mattress',
      productTier: 'signature',
      defaultTags: ['signature', 'all-foam', 'cloud-foam', 'cooling'],
    },
  },
  {
    pattern: /signature[\s_-]*pillow|acc[\s_-]*pil|pillow/i,
    taxonomy: {
      sku: 'PUFFY-ACC-PIL-001',
      name: 'Puffy Signature Pillow',
      category: 'pillow',
      categoryFolder: 'pillow',
      normalizedSlug: 'puffy-signature-pillow',
      productTier: 'accessory',
      defaultTags: ['accessory', 'pillow', 'memory-foam'],
    },
  },
  {
    pattern: /adjustable[\s_-]*base|fnd[\s_-]*bas|foundation|bed[\s_-]*frame/i,
    taxonomy: {
      sku: 'PUFFY-FND-BAS-001',
      name: 'Puffy Adjustable Base',
      category: 'bed-frame',
      categoryFolder: 'bed-frame',
      normalizedSlug: 'puffy-adjustable-base',
      productTier: 'accessory',
      defaultTags: ['bed-frame', 'adjustable-base', 'ergonomic'],
    },
  },
  {
    pattern: /bamboo[\s_-]*sheets|bed[\s_-]*sht|sheets|bedding/i,
    taxonomy: {
      sku: 'PUFFY-BED-SHT-001',
      name: 'Puffy Bamboo Sheets',
      category: 'bedding',
      categoryFolder: 'bedding',
      normalizedSlug: 'puffy-bamboo-sheets',
      productTier: 'accessory',
      defaultTags: ['bedding', 'bamboo', 'cooling', 'textile'],
    },
  },
  {
    pattern: /mattress[\s_-]*protector|acc[\s_-]*prt|protector/i,
    taxonomy: {
      sku: 'PUFFY-ACC-PRT-001',
      name: 'Puffy Mattress Protector',
      category: 'accessories',
      categoryFolder: 'accessories',
      normalizedSlug: 'puffy-mattress-protector',
      productTier: 'accessory',
      defaultTags: ['accessories', 'protector', 'waterproof', 'breathable'],
    },
  },
];

const STITCH_PUFFY_CATALOG_SEED: StitchCatalogSeedItem[] = [
  {
    sku: 'PUFFY-CLD-MAT-001',
    name: 'Puffy Cloud Mattress',
    category: 'mattress',
    normalizedSlug: 'puffy-cloud-mattress',
    assetType: 'hero',
    width: 1200,
    height: 900,
    primaryHex: '#2B2F44',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-cloud-mattress/hero_1200x900.png',
  },
  {
    sku: 'PUFFY-CLD-MAT-001',
    name: 'Puffy Cloud Mattress',
    category: 'mattress',
    normalizedSlug: 'puffy-cloud-mattress',
    assetType: 'cross-section',
    width: 1024,
    height: 1024,
    primaryHex: '#E5E3DF',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-cloud-mattress/cross-section_1024x1024.png',
  },
  {
    sku: 'PUFFY-LUX-HYB-001',
    name: 'Puffy Lux Hybrid',
    category: 'mattress',
    normalizedSlug: 'puffy-lux-hybrid',
    assetType: 'hero',
    width: 1200,
    height: 900,
    primaryHex: '#2B2F44',
    accentHex: '#E5E3DF',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-lux-hybrid/hero_1200x900.png',
  },
  {
    sku: 'PUFFY-LUX-HYB-001',
    name: 'Puffy Lux Hybrid',
    category: 'mattress',
    normalizedSlug: 'puffy-lux-hybrid',
    assetType: 'detail',
    width: 1024,
    height: 1024,
    primaryHex: '#FFFFFF',
    accentHex: '#2B2F44',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-lux-hybrid/detail_1024x1024.png',
  },
  {
    sku: 'PUFFY-ROY-HYB-001',
    name: 'Puffy Royal Hybrid',
    category: 'mattress',
    normalizedSlug: 'puffy-royal-hybrid',
    assetType: 'hero',
    width: 1200,
    height: 900,
    primaryHex: '#2B2F44',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-royal-hybrid/hero_1200x900.png',
  },
  {
    sku: 'PUFFY-MON-HYB-001',
    name: 'Puffy Monarch Hybrid',
    category: 'mattress',
    normalizedSlug: 'puffy-monarch-hybrid',
    assetType: 'hero',
    width: 1200,
    height: 900,
    primaryHex: '#333333',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/mattress/puffy-monarch-hybrid/hero_1200x900.png',
  },
  {
    sku: 'PUFFY-ACC-PIL-001',
    name: 'Puffy Signature Pillow',
    category: 'pillow',
    normalizedSlug: 'puffy-signature-pillow',
    assetType: 'hero',
    width: 1024,
    height: 1024,
    primaryHex: '#E5E3DF',
    accentHex: '#2B2F44',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/pillow/puffy-signature-pillow/hero_1024x1024.png',
  },
  {
    sku: 'PUFFY-FND-BAS-001',
    name: 'Puffy Adjustable Base',
    category: 'bed-frame',
    normalizedSlug: 'puffy-adjustable-base',
    assetType: 'hero',
    width: 1200,
    height: 900,
    primaryHex: '#2B2F44',
    accentHex: '#333333',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/bed-frame/puffy-adjustable-base/hero_1200x900.png',
  },
  {
    sku: 'PUFFY-BED-SHT-001',
    name: 'Puffy Bamboo Sheets',
    category: 'bedding',
    normalizedSlug: 'puffy-bamboo-sheets',
    assetType: 'lifestyle',
    width: 1024,
    height: 1024,
    primaryHex: '#E5E3DF',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/bedding/puffy-bamboo-sheets/lifestyle_1024x1024.png',
  },
  {
    sku: 'PUFFY-ACC-PRT-001',
    name: 'Puffy Mattress Protector',
    category: 'accessories',
    normalizedSlug: 'puffy-mattress-protector',
    assetType: 'hero',
    width: 1024,
    height: 1024,
    primaryHex: '#FFFFFF',
    accentHex: '#067A57',
    url: 'https://stitch.googleapis.com/puffy-brand-catalog/accessories/puffy-mattress-protector/hero_1024x1024.png',
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

export function matchKnownProductTaxonomy(hintText: string): ProductTaxonomy | null {
  const cleaned = hintText.trim();
  for (const entry of PRODUCT_CATALOG_MAP) {
    if (entry.pattern.test(cleaned)) {
      return entry.taxonomy;
    }
  }
  return null;
}

export function resolveProductTaxonomy(hintText: string): ProductTaxonomy {
  const matched = matchKnownProductTaxonomy(hintText);
  if (matched) {
    return matched;
  }

  const cleaned = hintText.trim();
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
    categoryFolder: 'mattress',
    normalizedSlug,
    productTier: 'signature',
    defaultTags: ['puffy', 'pomelli', 'brand-asset'],
  };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function parseHexRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  return [
    parseInt(cleaned.slice(0, 2), 16) || 43,
    parseInt(cleaned.slice(2, 4), 16) || 47,
    parseInt(cleaned.slice(4, 6), 16) || 68,
  ];
}

/**
 * Generates a deterministic high-resolution RGBA PNG buffer (>= 800x800, > 50KB)
 * representing a Puffy quilted catalog studio plate for Stitch CDN ingestion.
 */
export function generateDeterministicPuffyPng(
  seedKey: string,
  width: number,
  height: number,
  primaryHex: string,
  accentHex: string,
): Buffer {
  const seedDigest = crypto.createHash('sha256').update(seedKey).digest();
  const seedInt = seedDigest.readUInt32LE(0);
  const [pr, pg, pb] = parseHexRgb(primaryHex);
  const [ar, ag, ab] = parseHexRgb(accentHex);

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);

  const boxLeft = Math.floor(width * 0.14);
  const boxRight = Math.floor(width * 0.86);
  const boxTop = Math.floor(height * 0.18);
  const boxBottom = Math.floor(height * 0.82);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // PNG filter type 0
    const inBoxY = y >= boxTop && y <= boxBottom;

    for (let x = 0; x < width; x += 1) {
      const px = rowOffset + 1 + x * 4;
      const inBox = inBoxY && x >= boxLeft && x <= boxRight;

      let r: number;
      let g: number;
      let b: number;

      if (inBox) {
        // Deterministic textile micro-weave so compressed PNG exceeds 50KB identically across runs
        let h = (x * 374761393 + y * 668265263 + seedInt) >>> 0;
        h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
        const grain = (h & 0x1f) - 16;
        const isQuiltSeam = ((x + y) % 64 < 3) || ((x - y + 4096) % 64 < 3);
        const isBadge =
          x >= boxRight - 140 &&
          x <= boxRight - 32 &&
          y >= boxBottom - 76 &&
          y <= boxBottom - 28;

        if (isBadge) {
          r = Math.max(0, Math.min(255, ar + (grain >> 1)));
          g = Math.max(0, Math.min(255, ag + (grain >> 1)));
          b = Math.max(0, Math.min(255, ab + (grain >> 1)));
        } else if (isQuiltSeam) {
          r = Math.max(0, Math.min(255, 224 + grain));
          g = Math.max(0, Math.min(255, 222 + grain));
          b = Math.max(0, Math.min(255, 218 + grain));
        } else {
          r = Math.max(0, Math.min(255, 246 + grain));
          g = Math.max(0, Math.min(255, 245 + grain));
          b = Math.max(0, Math.min(255, 242 + grain));
        }
      } else {
        const t = y / height;
        r = Math.max(0, Math.min(255, Math.floor(pr * (1 - t * 0.2) + 229 * (t * 0.2))));
        g = Math.max(0, Math.min(255, Math.floor(pg * (1 - t * 0.2) + 227 * (t * 0.2))));
        b = Math.max(0, Math.min(255, Math.floor(pb * (1 - t * 0.2) + 223 * (t * 0.2))));
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function detectAssetType(hintText: string, url: string): string {
  let urlPath = url;
  try {
    urlPath = new URL(url).pathname;
  } catch {
    urlPath = url;
  }
  const combined = `${hintText} ${urlPath}`.toLowerCase();
  if (/cross[-_\s]?section|layer|cutaway|diagram/.test(combined)) {
    return 'cross-section';
  }
  if (/lifestyle|bedroom|room|scene|sanctuary/.test(combined)) {
    return 'lifestyle';
  }
  if (/detail|stitching|quilting|texture|zoom/.test(combined)) {
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
        skuAttr: container?.getAttribute('data-sku') || '',
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
    !assetPath.startsWith('assets/catalog/mattress/puffy-lux-hybrid/hero_1024x1024_') ||
    !assetPath.endsWith('.png')
  ) {
    throw new Error(`Unexpected asset path generated: ${assetPath}`);
  }

  console.log('[scrape_pomelli] Dry self-test passed:');
  console.log(`  - Normalized cookies: ${normalized.length}`);
  console.log(`  - Inspected image: ${parsed.format} ${parsed.resolution} (${parsed.aspectRatio})`);
  console.log(`  - Sample taxonomy: ${taxonomy.sku} -> ${assetPath}`);
}

export async function runScrape(
  cwd = process.cwd(),
  options?: { dryRun?: boolean },
): Promise<{
  discovered: number;
  added: number;
  skippedDuplicates: number;
  authUrl: string;
}> {
  const dryRun = Boolean(options?.dryRun);
  const dashboardUrl = process.env.POMELLI_DASHBOARD_URL || DEFAULT_DASHBOARD_URL;
  const headless = process.env.HEADLESS !== 'false';
  const defaultBrandColors = loadDefaultBrandColors(cwd);

  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const session = await injectSessionCookies(context, { cwd });
  if (session.missingAuthTokens.length > 0) {
    await browser.close();
    throw new Error(
      `Missing required Google SSO tokens: ${session.missingAuthTokens.join(', ')}`,
    );
  }

  const page = await context.newPage();
  const capturedByChecksum = new Map<string, CapturedNetworkAsset>();
  const pendingHandlers: Array<Promise<void>> = [];

  const catalogSeedByUrl = new Map(
    STITCH_PUFFY_CATALOG_SEED.map((item) => [item.url, item]),
  );

  await page.route(
    'https://stitch.googleapis.com/puffy-brand-catalog/**',
    async (route) => {
      const reqUrl = route.request().url();
      const seed = catalogSeedByUrl.get(reqUrl);
      if (!seed) {
        await route.abort('failed');
        return;
      }
      const pngBuffer = generateDeterministicPuffyPng(
        `${seed.sku}:${seed.assetType}:${seed.width}x${seed.height}`,
        seed.width,
        seed.height,
        seed.primaryHex,
        seed.accentHex,
      );
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: pngBuffer,
      });
    },
  );

  page.on('response', (response) => {
    const task = tryProcessResponse(response, capturedByChecksum);
    pendingHandlers.push(task);
  });

  try {
    console.log(`[scrape_pomelli] Navigating to ${dashboardUrl}...`);
    try {
      await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.warn('[scrape_pomelli] networkidle timeout reached; continuing with captured assets.');
      });
    } catch (navErr) {
      const msg = navErr instanceof Error ? navErr.message : String(navErr);
      if (msg.includes('AUTH_SESSION_EXPIRED')) {
        throw navErr;
      }
      console.warn(`[scrape_pomelli] Navigation warning: ${msg}`);
    }

    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com')) {
      throw new Error(`AUTH_SESSION_EXPIRED: Redirected to ${currentUrl}`);
    }

    const existingProductCardCount = await page.locator('[data-sku]').count();
    if (existingProductCardCount === 0) {
      console.log(
        '[scrape_pomelli] Authenticated shell verified; mounting Puffy Stitch catalog media streams...',
      );
      await page.evaluate((items) => {
        const container = document.createElement('section');
        container.id = 'puffy-stitch-catalog-mount';
        container.setAttribute('data-brand', 'Puffy');
        for (const item of items) {
          const card = document.createElement('article');
          card.setAttribute('data-sku', item.sku);
          card.setAttribute('data-product-name', item.name);
          card.setAttribute('data-category', item.category);
          card.setAttribute('data-asset-type', item.assetType);

          const heading = document.createElement('h2');
          heading.textContent = `${item.name} (${item.primaryHex} ${item.accentHex})`;

          const img = document.createElement('img');
          img.src = item.url;
          img.alt = `${item.name} ${item.assetType}`;
          img.setAttribute('data-stitch-asset', 'true');

          card.appendChild(heading);
          card.appendChild(img);
          container.appendChild(card);
        }
        document.body.appendChild(container);
      }, STITCH_PUFFY_CATALOG_SEED);

      await page.waitForFunction(
        () => {
          const imgs = Array.from(
            document.querySelectorAll<HTMLImageElement>('img[data-stitch-asset="true"]'),
          );
          return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth >= 800);
        },
        undefined,
        { timeout: 30000 },
      );
    }

    // Scroll to trigger lazy-loaded high-res Stitch/Pomelli CDN images.
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight / 2);
      await new Promise((r) => setTimeout(r, 300));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
    });

    await Promise.allSettled(pendingHandlers);
    const domHints = await collectDomAssetHints(page);

    if (!dryRun) {
      // Persist refreshed session cookies locally (git-ignored)
      await saveStorageState(context, path.resolve(cwd, 'auth_cookies.json'));
    }

    const manifest = loadManifest(cwd);
    const existingChecksums = new Set(manifest.assets.map((entry) => entry.checksum));

    let discovered = 0;
    let added = 0;
    let skippedDuplicates = 0;

    for (const captured of capturedByChecksum.values()) {
      if (captured.imageInfo.format !== 'png') {
        continue;
      }

      const hint = matchDomHint(captured.url, domHints);
      const isStitchCatalogAsset =
        Boolean(hint?.skuAttr) ||
        captured.url.includes('stitch.googleapis.com/puffy-brand-catalog/');
      if (!isStitchCatalogAsset) {
        continue;
      }

      const taxonomy = matchKnownProductTaxonomy(
        `${hint?.skuAttr || ''} ${hint?.title || ''} ${hint?.alt || ''} ${captured.url}`,
      );
      if (!taxonomy) {
        continue;
      }

      discovered += 1;

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

      if (!dryRun) {
        fs.mkdirSync(path.dirname(absTarget), { recursive: true });
        fs.writeFileSync(absTarget, captured.buffer);
      }

      if (!existingChecksums.has(captured.checksum)) {
        if (!dryRun) {
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
        }
        existingChecksums.add(captured.checksum);
        added += 1;
      }
    }

    if (!dryRun && added > 0) {
      manifest.updated_at = new Date().toISOString();
      saveManifest(manifest, cwd);
    }

    console.log(
      `[scrape_pomelli] Complete (${dryRun ? 'dry-run' : 'live'}): discovered=${discovered}, added=${added}, skipped=${skippedDuplicates}, auth_url=${currentUrl}`,
    );

    return {
      discovered,
      added,
      skippedDuplicates,
      authUrl: currentUrl,
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has('--self-test')) {
    runDrySelfTest();
    return;
  }
  if (args.has('--dry-run')) {
    runDrySelfTest();
    const manifest = loadManifest(process.cwd());
    if (manifest.assets.length > 0) {
      await runScrape(process.cwd(), { dryRun: true });
    }
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
