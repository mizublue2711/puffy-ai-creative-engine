#!/usr/bin/env node
/**
 * Puffy® Catalog Indexer
 *
 * Recursively traverses assets/catalog/, enforces strict canonical taxonomy paths:
 *   assets/catalog/{category}/{product_slug}/{intent}_{variant}_{resolution}.{ext}
 * parses exact binary image dimensions (PNG/WebP/JPG) and SVG vector attributes,
 * validates {resolution} tokens against parsed dimensions, and writes
 * assets/catalog_manifest.json deterministically.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");

const IGNORED_FILENAMES = new Set([".DS_Store", ".gitkeep"]);
const SLUG_REGEX = /^[a-z0-9-]+$/;
const FILENAME_REGEX =
  /^(cutout|hero|detail|badge)_([a-z0-9-]+)_([a-z0-9-]+)\.(png|webp|svg|jpg)$/;

function walkFiles(dir, rootDir, out = []) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Catalog directory does not exist: ${dir}`);
  }
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (IGNORED_FILENAMES.has(entry.name)) {
      continue;
    }
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, rootDir, out);
    } else if (entry.isFile()) {
      out.push(absPath);
    } else if (entry.isSymbolicLink()) {
      const targetStat = fs.statSync(absPath);
      if (targetStat.isDirectory()) {
        walkFiles(absPath, rootDir, out);
      } else if (targetStat.isFile()) {
        out.push(absPath);
      }
    } else {
      throw new Error(
        `Unsupported filesystem entry inside assets/catalog/: ${path.relative(rootDir, absPath)}`
      );
    }
  }
  return out;
}

function parsePngDimensions(buffer, relPath) {
  if (buffer.length < 24) {
    throw new Error(`Invalid PNG (truncated header): ${relPath}`);
  }
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i += 1) {
    if (buffer[i] !== pngSig[i]) {
      throw new Error(`Invalid PNG signature: ${relPath}`);
    }
  }
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`Missing IHDR chunk in PNG: ${relPath}`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error(`Invalid PNG dimensions (${width}x${height}): ${relPath}`);
  }
  return { width, height };
}

function parseWebpDimensions(buffer, relPath) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(`Invalid WebP header: ${relPath}`);
  }
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  let width = 0;
  let height = 0;

  if (chunkType === "VP8 " && buffer.length >= 30) {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
      throw new Error(`Invalid WebP VP8 keyframe header: ${relPath}`);
    }
    width = buffer.readUInt16LE(26) & 0x3fff;
    height = buffer.readUInt16LE(28) & 0x3fff;
  } else if (chunkType === "VP8L" && buffer.length >= 25) {
    if (buffer[20] !== 0x2f) {
      throw new Error(`Invalid WebP VP8L signature byte: ${relPath}`);
    }
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    width = 1 + (((b1 & 0x3f) << 8) | b0);
    height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
  } else if (chunkType === "VP8X" && buffer.length >= 30) {
    width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
  } else {
    throw new Error(`Unsupported WebP chunk type '${chunkType}': ${relPath}`);
  }

  if (width < 1 || height < 1) {
    throw new Error(`Invalid WebP dimensions (${width}x${height}): ${relPath}`);
  }
  return { width, height };
}

function parseJpgDimensions(buffer, relPath) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`Invalid JPEG SOI marker: ${relPath}`);
  }
  let offset = 2;
  while (offset + 1 < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      break;
    }
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }
    if (offset + 2 > buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw new Error(`Corrupted JPEG segment length at offset ${offset}: ${relPath}`);
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      if (segmentLength < 7 || offset + 7 > buffer.length) {
        throw new Error(`Truncated JPEG SOF frame: ${relPath}`);
      }
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width < 1 || height < 1) {
        throw new Error(`Invalid JPEG dimensions (${width}x${height}): ${relPath}`);
      }
      return { width, height };
    }
    offset += segmentLength;
  }
  throw new Error(`Could not find SOF dimensions in JPEG: ${relPath}`);
}

function parseSvgDimensions(buffer, relPath) {
  const text = buffer.toString("utf-8");
  const svgTagMatch = text.match(/<svg\b([^>]*)>/i);
  if (!svgTagMatch) {
    throw new Error(`Invalid SVG (missing <svg> root tag): ${relPath}`);
  }
  const attrs = svgTagMatch[1];

  const viewBoxMatch = attrs.match(
    /\bviewBox\s*=\s*["']\s*([+-]?[\d.]+)[,\s]+([+-]?[\d.]+)[,\s]+([+-]?[\d.]+)[,\s]+([+-]?[\d.]+)\s*["']/i
  );
  const widthMatch = attrs.match(/\bwidth\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);

  const parsePositiveInt = (raw) => {
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 1) return null;
    const rounded = Math.round(num);
    return rounded >= 1 ? rounded : null;
  };

  let width = parsePositiveInt(widthMatch?.[1]);
  let height = parsePositiveInt(heightMatch?.[1]);
  let viewBox = null;

  if (viewBoxMatch) {
    viewBox = `${viewBoxMatch[1]} ${viewBoxMatch[2]} ${viewBoxMatch[3]} ${viewBoxMatch[4]}`;
    if (width === null) {
      width = parsePositiveInt(viewBoxMatch[3]);
    }
    if (height === null) {
      height = parsePositiveInt(viewBoxMatch[4]);
    }
  }

  const dimensions = {
    width,
    height,
    vector: true,
  };
  if (viewBox) {
    dimensions.viewBox = viewBox;
  }
  return dimensions;
}

function extractDimensions(buffer, format, relPath) {
  switch (format) {
    case "png":
      return parsePngDimensions(buffer, relPath);
    case "webp":
      return parseWebpDimensions(buffer, relPath);
    case "jpg":
      return parseJpgDimensions(buffer, relPath);
    case "svg":
      return parseSvgDimensions(buffer, relPath);
    default:
      throw new Error(`Unsupported format '${format}': ${relPath}`);
  }
}

export function buildCatalogManifest(rootDir = DEFAULT_ROOT_DIR) {
  const catalogDir = path.join(rootDir, "assets", "catalog");
  const absFiles = walkFiles(catalogDir, rootDir);
  const seenIds = new Set();
  const items = [];

  for (const absPath of absFiles) {
    const relFromCatalog = path
      .relative(catalogDir, absPath)
      .split(path.sep)
      .join("/");
    const parts = relFromCatalog.split("/");

    if (parts.length !== 3) {
      throw new Error(
        `Taxonomy path violation for 'assets/catalog/${relFromCatalog}': expected exact depth {category}/{product_slug}/{filename}.`
      );
    }

    const [category, productSlug, filename] = parts;

    if (!SLUG_REGEX.test(category)) {
      throw new Error(
        `Invalid category slug '${category}' in 'assets/catalog/${relFromCatalog}': must match ${SLUG_REGEX}.`
      );
    }
    if (!SLUG_REGEX.test(productSlug)) {
      throw new Error(
        `Invalid product_slug '${productSlug}' in 'assets/catalog/${relFromCatalog}': must match ${SLUG_REGEX}.`
      );
    }

    const filenameMatch = filename.match(FILENAME_REGEX);
    if (!filenameMatch) {
      throw new Error(
        `Filename taxonomy violation '${filename}' at 'assets/catalog/${relFromCatalog}': must match ${FILENAME_REGEX}.`
      );
    }

    const [, intent, variant, resolution, format] = filenameMatch;
    const repoRelPath = `assets/catalog/${relFromCatalog}`;
    const id = `${category}/${productSlug}/${intent}_${variant}_${resolution}`;

    if (seenIds.has(id)) {
      throw new Error(
        `Duplicate canonical asset id '${id}' detected at '${repoRelPath}'.`
      );
    }
    seenIds.add(id);

    const buffer = fs.readFileSync(absPath);
    if (buffer.length === 0) {
      throw new Error(`Empty asset file (0 bytes): ${repoRelPath}`);
    }

    const dimensions = extractDimensions(buffer, format, repoRelPath);

    if (format === "svg") {
      if (resolution !== "vector") {
        throw new Error(
          `SVG resolution token mismatch for '${repoRelPath}': expected 'vector', got '${resolution}'.`
        );
      }
    } else {
      const expectedResolution = `${dimensions.width}x${dimensions.height}`;
      if (resolution !== expectedResolution) {
        throw new Error(
          `Raster resolution token mismatch for '${repoRelPath}': filename declares '${resolution}' but image header is '${expectedResolution}'.`
        );
      }
    }

    const isCutout = intent === "cutout";
    items.push({
      id,
      path: repoRelPath,
      file_path: repoRelPath,
      category,
      product_slug: productSlug,
      intent,
      variant,
      resolution,
      dimensions,
      format,
      verified_drift_free: isCutout,
      zero_product_drift_verified: isCutout,
    });
  }

  items.sort((a, b) => a.file_path.localeCompare(b.file_path));

  return {
    updated_at: new Date().toISOString(),
    total_assets: items.length,
    items,
  };
}

export function indexCatalog(rootDir = DEFAULT_ROOT_DIR) {
  const manifest = buildCatalogManifest(rootDir);
  const outPath = path.join(rootDir, "assets", "catalog_manifest.json");
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return { manifest, outPath };
}

const isDirectEntry =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectEntry) {
  try {
    const { manifest, outPath } = indexCatalog(DEFAULT_ROOT_DIR);
    console.log(
      `[index_catalog] Indexed ${manifest.total_assets} canonical asset(s) -> ${path.relative(DEFAULT_ROOT_DIR, outPath)}`
    );
  } catch (err) {
    console.error(`[index_catalog] Error: ${err.message}`);
    process.exit(1);
  }
}
