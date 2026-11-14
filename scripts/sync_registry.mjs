#!/usr/bin/env node
/**
 * [PHASE 3] Puffy® Unified Asset Registry & SHA-256 Deduplication
 *
 * Recursively scans `assets/catalog/`, enforces canonical taxonomy and filename
 * contracts, computes SHA-256 hashes, fails fast on physical duplicates in
 * `assets/catalog/`, tracks pipeline usage across banner_engine and remotion,
 * preserves existing drift/n8n flags on upsert, removes stale entries, and
 * emits deterministic `assets/asset_registry.json`.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");

const REGISTRY_VERSION = "1.0.0";
const IGNORED_FILENAMES = new Set([".DS_Store", ".gitkeep"]);
const INTENTS = ["cutout", "hero", "detail", "badge"];
const SEGMENT_REGEX = /^[a-z0-9\-]+$/;
const FILENAME_REGEX = /^(cutout|hero|detail|badge)_([a-z0-9\-]+)_([a-z0-9\-]+)\.(png|webp|svg|jpg)$/;
const FILE_PATH_REGEX =
  /^assets\/catalog\/[a-z0-9\-]+\/[a-z0-9\-]+\/(cutout|hero|detail|badge)_[a-z0-9\-]+_[a-z0-9\-]+\.(png|webp|svg|jpg)$/;

const MOCK_ASSET_STEMS = new Set([
  "cutout_angle45_1200x720",
  "cutout_studio_720x246",
  "hero_nordic-bedroom_1920x1080",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "out", ".remotion", ".vite"]);
const TEXT_EXTENSIONS = new Set([".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".css", ".md"]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function toRepoRelative(rootDir, absPath) {
  return toPosix(path.relative(rootDir, absPath));
}

function readJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

function computeSha256(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function walkFiles(dirPath, filterFn) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    if (IGNORED_FILENAMES.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...walkFiles(fullPath, filterFn));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (!filterFn || filterFn(fullPath, entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function parseCatalogAssetPath(absPath, catalogDir, rootDir) {
  const relFromCatalog = toPosix(path.relative(catalogDir, absPath));
  const relFromRoot = toRepoRelative(rootDir, absPath);
  const parts = relFromCatalog.split("/");

  if (parts.length !== 3) {
    throw new Error(
      `Invalid catalog depth for "${relFromRoot}": expected "assets/catalog/{category}/{product_slug}/{filename}".`
    );
  }

  const [category, productSlug, filename] = parts;
  if (!SEGMENT_REGEX.test(category)) {
    throw new Error(`Invalid category "${category}" in "${relFromRoot}": must match ${SEGMENT_REGEX}`);
  }
  if (!SEGMENT_REGEX.test(productSlug)) {
    throw new Error(`Invalid product_slug "${productSlug}" in "${relFromRoot}": must match ${SEGMENT_REGEX}`);
  }

  const fnMatch = FILENAME_REGEX.exec(filename);
  if (!fnMatch) {
    throw new Error(
      `Invalid filename "${filename}" in "${relFromRoot}": must match ${FILENAME_REGEX}`
    );
  }
  if (!FILE_PATH_REGEX.test(relFromRoot)) {
    throw new Error(
      `Invalid canonical file_path "${relFromRoot}": must match ${FILE_PATH_REGEX}`
    );
  }

  const [, intent, variant, resolution, format] = fnMatch;
  const stem = `${intent}_${variant}_${resolution}`;
  const id = `${category}/${productSlug}/${stem}`;

  return {
    id,
    file_path: relFromRoot,
    absPath,
    category,
    product_slug: productSlug,
    intent,
    variant,
    resolution,
    format,
    stem,
  };
}

function loadOriginLookups(rootDir) {
  const stitchByPath = new Map();
  const stitchBySha = new Map();
  const manifest = readJsonIfExists(path.join(rootDir, "assets/manifest.json"));
  if (manifest && Array.isArray(manifest.assets)) {
    for (const item of manifest.assets) {
      if (item.local_path) stitchByPath.set(toPosix(item.local_path), item);
      if (item.checksum) stitchBySha.set(String(item.checksum).toLowerCase(), item);
    }
  }

  const pomelliByPath = new Map();
  const pomelliBySha = new Map();
  const pomelliMapping = readJsonIfExists(path.join(rootDir, "assets/raw_mattress/pomelli_mapping.json"));
  const pomelliList =
    pomelliMapping?.mapped_assets ??
    pomelliMapping?.assets ??
    pomelliMapping?.items ??
    [];
  if (Array.isArray(pomelliList)) {
    for (const item of pomelliList) {
      const targetPath = item.canonical_catalog_path ?? item.file_path ?? item.local_path;
      if (targetPath) pomelliByPath.set(toPosix(targetPath), item);
      if (item.sha256) pomelliBySha.set(String(item.sha256).toLowerCase(), item);
    }
  }

  const catalogManifestByPath = new Map();
  const catalogManifestById = new Map();
  const catalogManifest = readJsonIfExists(path.join(rootDir, "assets/catalog_manifest.json"));
  if (catalogManifest && Array.isArray(catalogManifest.items)) {
    for (const item of catalogManifest.items) {
      if (item.file_path) catalogManifestByPath.set(toPosix(item.file_path), item);
      if (item.path) catalogManifestByPath.set(toPosix(item.path), item);
      if (item.id) catalogManifestById.set(item.id, item);
    }
  }

  const verifiedCutoutPaths = new Map();
  const cutoutMeta = readJsonIfExists(path.join(rootDir, "assets/cutouts/mock_mattress.metadata.json"));
  if (cutoutMeta && typeof cutoutMeta.zero_product_drift_verified === "boolean" && cutoutMeta.cutout_path) {
    const rawTarget = path.resolve(rootDir, cutoutMeta.cutout_path);
    verifiedCutoutPaths.set(toPosix(cutoutMeta.cutout_path), cutoutMeta.zero_product_drift_verified);
    if (fs.existsSync(rawTarget)) {
      try {
        const realRel = toRepoRelative(rootDir, fs.realpathSync(rawTarget));
        verifiedCutoutPaths.set(realRel, cutoutMeta.zero_product_drift_verified);
      } catch {
        // Ignore realpath failure on dangling symlink
      }
    }
  }

  return {
    stitchByPath,
    stitchBySha,
    pomelliByPath,
    pomelliBySha,
    catalogManifestByPath,
    catalogManifestById,
    verifiedCutoutPaths,
  };
}

function determineSourceOrigin(parsed, sha256, lookups) {
  if (MOCK_ASSET_STEMS.has(parsed.stem)) {
    return "mock_asset_generator";
  }
  if (parsed.category === "trust-badges") {
    return "brand_trust_badges";
  }
  if (lookups.stitchByPath.has(parsed.file_path) || lookups.stitchBySha.has(sha256)) {
    return "stitch_catalog_seed";
  }
  if (lookups.pomelliByPath.has(parsed.file_path) || lookups.pomelliBySha.has(sha256)) {
    return "pomelli_catalog_export";
  }
  return "manual_catalog_asset";
}

function extractStaticAssetReferences(filePaths, rootDir) {
  const rawTexts = [];
  const resolvedAssetPaths = new Set();
  const resolverQueries = [];

  const assetLiteralRegex = /assets\/[A-Za-z0-9_.\-\/]+\.(?:png|webp|svg|jpg|jpeg)/g;
  const getAssetCallRegex = /getAsset\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  const propLiteralRegex = /\b(category|product_slug|intent|variant|resolution|id|file_path|path)\s*:\s*["']([^"']+)["']/g;

  for (const absPath of filePaths) {
    if (!fs.existsSync(absPath)) continue;
    const text = fs.readFileSync(absPath, "utf8");
    rawTexts.push(text);

    for (const match of text.matchAll(assetLiteralRegex)) {
      const candidateRel = match[0];
      resolvedAssetPaths.add(candidateRel);
      const candidateAbs = path.join(rootDir, candidateRel);
      if (fs.existsSync(candidateAbs)) {
        try {
          resolvedAssetPaths.add(toRepoRelative(rootDir, fs.realpathSync(candidateAbs)));
        } catch {
          // Ignore symlink resolution error
        }
      }
    }

    for (const callMatch of text.matchAll(getAssetCallRegex)) {
      const body = callMatch[1];
      const query = {};
      for (const propMatch of body.matchAll(propLiteralRegex)) {
        query[propMatch[1]] = propMatch[2];
      }
      if (Object.keys(query).length > 0) {
        resolverQueries.push(query);
      }
    }
  }

  return { rawTexts, resolvedAssetPaths, resolverQueries };
}

function isAssetReferenced(asset, refs) {
  if (refs.resolvedAssetPaths.has(asset.file_path)) {
    return true;
  }

  for (const text of refs.rawTexts) {
    if (text.includes(asset.file_path) || text.includes(asset.id)) {
      return true;
    }
  }

  for (const query of refs.resolverQueries) {
    // Require a specific identifier (variant, id, file_path, or path) so dynamic queries
    // like getAsset({ intent: "cutout", variant: dynamicVar }) do not false-match all cutouts.
    const hasSpecificSelector = Boolean(query.variant || query.id || query.file_path || query.path);
    if (!hasSpecificSelector) continue;

    let matchesAll = true;
    for (const [key, val] of Object.entries(query)) {
      const targetVal = key === "path" ? asset.file_path : asset[key];
      if (targetVal !== val) {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll) return true;
  }

  return false;
}

function buildTags(parsed, sha256, sourceOrigin, lookups) {
  const tagSet = new Set([parsed.category, parsed.product_slug, parsed.intent, parsed.variant]);

  if (sourceOrigin === "brand_trust_badges") {
    tagSet.add("trust-badge");
    tagSet.add("award");
  } else if (sourceOrigin === "mock_asset_generator") {
    tagSet.add("mock-asset");
    tagSet.add(parsed.intent === "cutout" ? "zero-product-drift" : "environment");
  } else if (sourceOrigin === "pomelli_catalog_export") {
    tagSet.add("pomelli");
    tagSet.add("catalog");
  } else if (sourceOrigin === "stitch_catalog_seed") {
    tagSet.add("stitch-seed");
  }

  const stitchEntry =
    lookups.stitchByPath.get(parsed.file_path) ?? lookups.stitchBySha.get(sha256);
  if (stitchEntry && Array.isArray(stitchEntry.tags)) {
    for (const tag of stitchEntry.tags) {
      if (typeof tag === "string" && tag.trim().length > 0) {
        tagSet.add(tag.trim());
      }
    }
  }

  const pomelliEntry =
    lookups.pomelliByPath.get(parsed.file_path) ?? lookups.pomelliBySha.get(sha256);
  if (pomelliEntry && Array.isArray(pomelliEntry.tags)) {
    for (const tag of pomelliEntry.tags) {
      if (typeof tag === "string" && tag.trim().length > 0) {
        tagSet.add(tag.trim());
      }
    }
  }

  return Array.from(tagSet);
}

function resolveInitialZeroProductDriftVerified(parsed, lookups) {
  if (lookups.verifiedCutoutPaths.has(parsed.file_path)) {
    return lookups.verifiedCutoutPaths.get(parsed.file_path);
  }
  const cmItem =
    lookups.catalogManifestByPath.get(parsed.file_path) ??
    lookups.catalogManifestById.get(parsed.id);
  if (cmItem && typeof cmItem.zero_product_drift_verified === "boolean") {
    return cmItem.zero_product_drift_verified;
  }
  return false;
}

function validateAgainstRegistrySchema(doc, schema) {
  const errors = [];
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error("Registry output must be a JSON object.");
  }

  const topAllowed = new Set(Object.keys(schema.properties));
  for (const req of schema.required) {
    if (!(req in doc)) errors.push(`Missing top-level required key: ${req}`);
  }
  for (const key of Object.keys(doc)) {
    if (!topAllowed.has(key)) errors.push(`Unexpected top-level key: ${key}`);
  }

  const statsSchema = schema.properties.stats;
  for (const req of statsSchema.required) {
    if (!Number.isInteger(doc.stats?.[req]) || doc.stats[req] < 0) {
      errors.push(`Invalid stats.${req}: must be non-negative integer.`);
    }
  }

  const patternEntries = Object.entries(schema.properties.registry.patternProperties);
  const [keyPatternStr, entrySchema] = patternEntries[0];
  const keyPattern = new RegExp(keyPatternStr);
  const filePathPattern = new RegExp(entrySchema.properties.file_path.pattern);
  const shaPattern = new RegExp(entrySchema.properties.sha256.pattern);
  const intentSet = new Set(entrySchema.properties.intent.enum);
  const formatSet = new Set(entrySchema.properties.format.enum);
  const entryAllowed = new Set(Object.keys(entrySchema.properties));
  const statusAllowed = new Set(Object.keys(entrySchema.properties.pipeline_status.properties));

  for (const [assetId, entry] of Object.entries(doc.registry)) {
    if (!keyPattern.test(assetId)) {
      errors.push(`Invalid registry key "${assetId}": does not match ${keyPatternStr}`);
    }
    for (const req of entrySchema.required) {
      if (!(req in entry)) errors.push(`Entry "${assetId}" missing required field "${req}"`);
    }
    for (const key of Object.keys(entry)) {
      if (!entryAllowed.has(key)) errors.push(`Entry "${assetId}" has unexpected field "${key}"`);
    }
    if (!filePathPattern.test(entry.file_path)) {
      errors.push(`Entry "${assetId}" invalid file_path: ${entry.file_path}`);
    }
    if (!shaPattern.test(entry.sha256)) {
      errors.push(`Entry "${assetId}" invalid sha256: ${entry.sha256}`);
    }
    if (!intentSet.has(entry.intent)) {
      errors.push(`Entry "${assetId}" invalid intent: ${entry.intent}`);
    }
    if (!formatSet.has(entry.format)) {
      errors.push(`Entry "${assetId}" invalid format: ${entry.format}`);
    }
    for (const sKey of entrySchema.properties.pipeline_status.required) {
      if (typeof entry.pipeline_status?.[sKey] !== "boolean") {
        errors.push(`Entry "${assetId}" pipeline_status.${sKey} must be boolean`);
      }
    }
    for (const sKey of Object.keys(entry.pipeline_status ?? {})) {
      if (!statusAllowed.has(sKey)) {
        errors.push(`Entry "${assetId}" unexpected pipeline_status key "${sKey}"`);
      }
    }
    if (!Array.isArray(entry.tags) || entry.tags.some((t) => typeof t !== "string" || t.length === 0)) {
      errors.push(`Entry "${assetId}" tags must be an array of non-empty strings`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Asset registry schema self-check failed:\n  - ${errors.join("\n  - ")}`);
  }
}

function printSummaryTable(stats, totalAssets, staleRemovedCount, bannerCount, remotionCount, registryRelPath) {
  console.log("\n=== Puffy® Unified Asset Registry Sync Summary ===");
  console.log("+------------+-------+");
  console.log("| Intent     | Count |");
  console.log("+------------+-------+");
  for (const intent of INTENTS) {
    const label = intent.padEnd(10, " ");
    const val = String(stats[intent]).padStart(5, " ");
    console.log(`| ${label} | ${val} |`);
  }
  console.log("+------------+-------+");
  console.log(`| Total      | ${String(totalAssets).padStart(5, " ")} |`);
  console.log("+------------+-------+");
  console.log(`Active in Banner Engine : ${bannerCount}`);
  console.log(`Active in Remotion      : ${remotionCount}`);
  console.log(`Stale Entries Pruned    : ${staleRemovedCount}`);
  console.log(`Registry Output         : ${registryRelPath}\n`);
}

export function syncRegistry({ rootDir = DEFAULT_ROOT_DIR, quiet = false } = {}) {
  const catalogDir = path.join(rootDir, "assets/catalog");
  const registryPath = path.join(rootDir, "assets/asset_registry.json");
  const schemaPath = path.join(rootDir, "config/schemas/asset_registry.schema.json");

  if (!fs.existsSync(catalogDir)) {
    throw new Error(`Catalog directory not found: ${catalogDir}`);
  }

  const existingDoc = readJsonIfExists(registryPath);
  const existingRegistry =
    existingDoc && typeof existingDoc.registry === "object" && existingDoc.registry !== null
      ? existingDoc.registry
      : {};

  // Build SHA-256 lookup from existing registry for cross-sync duplicate warnings
  const existingShaToPaths = new Map();
  for (const entry of Object.values(existingRegistry)) {
    if (entry?.sha256 && entry?.file_path) {
      const sha = String(entry.sha256).toLowerCase();
      if (!existingShaToPaths.has(sha)) existingShaToPaths.set(sha, new Set());
      existingShaToPaths.get(sha).add(toPosix(entry.file_path));
    }
  }

  const catalogFiles = walkFiles(catalogDir);
  const scanShaToPath = new Map();
  const physicalDuplicates = [];
  const scannedItems = [];
  const seenIds = new Set();

  for (const absPath of catalogFiles) {
    const parsed = parseCatalogAssetPath(absPath, catalogDir, rootDir);
    if (seenIds.has(parsed.id)) {
      throw new Error(
        `Duplicate canonical asset ID "${parsed.id}" detected at "${parsed.file_path}".`
      );
    }
    seenIds.add(parsed.id);

    const sha256 = computeSha256(absPath);

    // Check against current scan in assets/catalog/
    if (scanShaToPath.has(sha256)) {
      const firstPath = scanShaToPath.get(sha256);
      console.error(
        `[DUPLICATE WARNING] Physical duplicate SHA-256 (${sha256}) in assets/catalog/: "${firstPath}" and "${parsed.file_path}"`
      );
      physicalDuplicates.push({ sha256, pathA: firstPath, pathB: parsed.file_path });
    } else {
      scanShaToPath.set(sha256, parsed.file_path);
    }

    // Check against previously recorded assets/asset_registry.json
    if (existingShaToPaths.has(sha256)) {
      for (const prevPath of existingShaToPaths.get(sha256)) {
        if (prevPath !== parsed.file_path) {
          console.warn(
            `[DUPLICATE WARNING] SHA-256 (${sha256}) previously recorded at "${prevPath}" now found at "${parsed.file_path}"`
          );
          const prevAbs = path.join(rootDir, prevPath);
          if (fs.existsSync(prevAbs) && prevPath.startsWith("assets/catalog/")) {
            physicalDuplicates.push({ sha256, pathA: prevPath, pathB: parsed.file_path });
          }
        }
      }
    }

    scannedItems.push({ parsed, sha256 });
  }

  if (physicalDuplicates.length > 0) {
    throw new Error(
      `Aborting registry sync: ${physicalDuplicates.length} physical SHA-256 duplicate(s) detected in assets/catalog/.`
    );
  }

  const lookups = loadOriginLookups(rootDir);

  const bannerRefs = extractStaticAssetReferences(
    [
      path.join(rootDir, "pipelines/banner_engine/sample_task.json"),
      path.join(rootDir, "pipelines/banner_engine/render.mjs"),
    ],
    rootDir
  );

  const remotionFiles = walkFiles(path.join(rootDir, "pipelines/remotion"), (absPath) =>
    TEXT_EXTENSIONS.has(path.extname(absPath).toLowerCase())
  );
  const remotionRefs = extractStaticAssetReferences(remotionFiles, rootDir);

  const unsortedEntries = [];
  const stats = { cutout: 0, hero: 0, detail: 0, badge: 0 };
  let bannerCount = 0;
  let remotionCount = 0;

  for (const { parsed, sha256 } of scannedItems) {
    const sourceOrigin = determineSourceOrigin(parsed, sha256, lookups);
    const prevEntry = existingRegistry[parsed.id];
    const hasPrevN8n = typeof prevEntry?.pipeline_status?.n8n_background_removed === "boolean";
    const hasPrevDrift = typeof prevEntry?.pipeline_status?.zero_product_drift_verified === "boolean";

    const usedInBannerEngine = isAssetReferenced(parsed, bannerRefs);
    const usedInRemotion = isAssetReferenced(parsed, remotionRefs);

    if (usedInBannerEngine) bannerCount += 1;
    if (usedInRemotion) remotionCount += 1;
    stats[parsed.intent] += 1;

    const entry = {
      id: parsed.id,
      file_path: parsed.file_path,
      sha256,
      category: parsed.category,
      product_slug: parsed.product_slug,
      intent: parsed.intent,
      variant: parsed.variant,
      resolution: parsed.resolution,
      format: parsed.format,
      source_origin: sourceOrigin,
      pipeline_status: {
        n8n_background_removed: hasPrevN8n
          ? prevEntry.pipeline_status.n8n_background_removed
          : false,
        zero_product_drift_verified: hasPrevDrift
          ? prevEntry.pipeline_status.zero_product_drift_verified
          : resolveInitialZeroProductDriftVerified(parsed, lookups),
        used_in_banner_engine: usedInBannerEngine,
        used_in_remotion: usedInRemotion,
      },
      tags: buildTags(parsed, sha256, sourceOrigin, lookups),
    };

    unsortedEntries.push([parsed.id, entry]);
  }

  unsortedEntries.sort(([idA], [idB]) => (idA < idB ? -1 : idA > idB ? 1 : 0));
  const sortedRegistry = Object.fromEntries(unsortedEntries);

  const staleIds = Object.keys(existingRegistry).filter((id) => !(id in sortedRegistry));
  const output = {
    version: REGISTRY_VERSION,
    last_synced_at: new Date().toISOString(),
    total_assets: unsortedEntries.length,
    stats,
    registry: sortedRegistry,
  };

  const schema = readJsonIfExists(schemaPath);
  if (schema) {
    validateAgainstRegistrySchema(output, schema);
  }

  fs.writeFileSync(registryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  if (!quiet) {
    printSummaryTable(
      stats,
      output.total_assets,
      staleIds.length,
      bannerCount,
      remotionCount,
      toRepoRelative(rootDir, registryPath)
    );
  }

  return output;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  try {
    syncRegistry();
  } catch (err) {
    console.error(`[sync_registry] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
