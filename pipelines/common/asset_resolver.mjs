/**
 * Puffy® Canonical Asset Resolver
 *
 * Queries assets/catalog_manifest.json by canonical taxonomy attributes
 * (category, product_slug, intent, variant, resolution, format, id, file_path)
 * with mtime-based caching and descriptive failure errors.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "../..");
const DEFAULT_MANIFEST_PATH = path.join(
  DEFAULT_ROOT_DIR,
  "assets/catalog_manifest.json"
);

const FILTER_KEYS = [
  "id",
  "path",
  "file_path",
  "category",
  "product_slug",
  "intent",
  "variant",
  "resolution",
  "format",
];

let cachedManifest = null;
let cachedManifestPath = null;
let cachedMtimeMs = -1;

export function clearManifestCache() {
  cachedManifest = null;
  cachedManifestPath = null;
  cachedMtimeMs = -1;
}

export function loadCatalogManifest(options = {}) {
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : DEFAULT_MANIFEST_PATH;

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Catalog manifest not found at '${manifestPath}'. Run 'node scripts/index_catalog.mjs' first.`
    );
  }

  const stat = fs.statSync(manifestPath);
  if (
    !options.fresh &&
    cachedManifest &&
    cachedManifestPath === manifestPath &&
    cachedMtimeMs === stat.mtimeMs
  ) {
    return cachedManifest;
  }

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error(
      `Invalid catalog manifest at '${manifestPath}': expected object with an 'items' array.`
    );
  }

  cachedManifest = parsed;
  cachedManifestPath = manifestPath;
  cachedMtimeMs = stat.mtimeMs;
  return parsed;
}

function matchesQuery(item, query) {
  for (const key of FILTER_KEYS) {
    if (query[key] !== undefined && query[key] !== null) {
      if (item[key] !== query[key]) {
        return false;
      }
    }
  }
  return true;
}

export function listAssets(query = {}, options = {}) {
  if (query !== null && typeof query !== "object") {
    throw new Error("listAssets(query) requires an object query parameter.");
  }
  const manifest = loadCatalogManifest(options);
  const filters = query ?? {};
  return manifest.items.filter((item) => matchesQuery(item, filters));
}

export function getAsset(query, options = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new Error(
      "getAsset({ category, product_slug, intent, variant, resolution }) requires a query object."
    );
  }

  const activeFilters = Object.fromEntries(
    FILTER_KEYS.filter(
      (key) => query[key] !== undefined && query[key] !== null
    ).map((key) => [key, query[key]])
  );

  if (Object.keys(activeFilters).length === 0) {
    throw new Error(
      "getAsset(...) requires at least one taxonomy filter (e.g. category, product_slug, intent, variant, resolution, file_path, or id)."
    );
  }

  const matches = listAssets(activeFilters, options);
  if (matches.length === 0) {
    throw new Error(
      `No catalog asset found matching query ${JSON.stringify(activeFilters)} in assets/catalog_manifest.json.`
    );
  }

  return matches[0];
}
