#!/usr/bin/env node
/**
 * [MODULE 4] Puffy® Banner Engine
 *
 * Reads a banner task payload validated against config/schemas/banner_task.schema.json
 * and config/brand_tokens.json, then renders Desktop (1440x900), PDP Square (1080x1080),
 * and Mobile (1080x1920) PNG outputs using headless Chromium.
 *
 * Enforces:
 * - Zero Product Drift: unaltered mattress cutout composited over environment plate
 * - Brand Token Authority: Navy Ink (#2B2F44), Pure White (#FFFFFF), Warm Linen (#E5E3DF),
 *   Ocean Teal (#067A57), Onyx Black (#333333), PT Serif headlines, Mukta body/badges
 * - Logo Geometry: >= 30px clear space on all sides, >= 80px minimum width
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getAsset } from "../common/asset_resolver.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

const SCHEMA_PATH = path.join(ROOT_DIR, "config/schemas/banner_task.schema.json");
const TOKENS_PATH = path.join(ROOT_DIR, "config/brand_tokens.json");
const DEFAULT_TASK_PATH = path.join(__dirname, "sample_task.json");
const DEFAULT_OUT_DIR = path.join(__dirname, "out");

function parseArgs(argv) {
  const args = { task: DEFAULT_TASK_PATH, out: DEFAULT_OUT_DIR };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--task" && argv[i + 1]) {
      args.task = path.resolve(argv[++i]);
    } else if (argv[i] === "--out" && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    }
  }
  return args;
}

function validateAgainstSchema(task, schema) {
  const errors = [];
  if (typeof task !== "object" || task === null || Array.isArray(task)) {
    throw new Error("Banner task must be a JSON object.");
  }

  for (const reqKey of schema.required) {
    if (!(reqKey in task)) {
      errors.push(`Missing required property: ${reqKey}`);
    }
  }

  const allowedKeys = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(task)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unexpected property (additionalProperties=false): ${key}`);
    }
  }

  const cutoutPattern = new RegExp(schema.properties.mattress_cutout_path.pattern);
  if (typeof task.mattress_cutout_path !== "string" || !cutoutPattern.test(task.mattress_cutout_path)) {
    errors.push(`Invalid mattress_cutout_path: must match ${schema.properties.mattress_cutout_path.pattern}`);
  }

  const envPattern = new RegExp(schema.properties.environment_bg_path.pattern);
  if (typeof task.environment_bg_path !== "string" || !envPattern.test(task.environment_bg_path)) {
    errors.push(`Invalid environment_bg_path: must match ${schema.properties.environment_bg_path.pattern}`);
  }

  if (!task.cta || typeof task.cta !== "object") {
    errors.push("cta must be an object.");
  } else {
    if (task.cta.bg_color !== schema.properties.cta.properties.bg_color.const) {
      errors.push(`cta.bg_color must be ${schema.properties.cta.properties.bg_color.const}`);
    }
    if (task.cta.text_color !== schema.properties.cta.properties.text_color.const) {
      errors.push(`cta.text_color must be ${schema.properties.cta.properties.text_color.const}`);
    }
  }

  if (!Array.isArray(task.viewports) || task.viewports.length < 1) {
    errors.push("viewports must be a non-empty array.");
  } else {
    task.viewports.forEach((vp, idx) => {
      if (!Number.isInteger(vp.width) || vp.width < 1 || !Number.isInteger(vp.height) || vp.height < 1) {
        errors.push(`viewports[${idx}] must have positive integer width and height.`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Banner task schema validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}

function toDataUri(absPath, mimeType) {
  const buf = fs.readFileSync(absPath);
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

function resolveMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function buildBannerHtml(task, tokens, viewport, assets) {
  const { width, height } = viewport;
  const isSquare = width === height;
  const isMobile = height > width;
  const layoutMode = isMobile ? "mobile" : isSquare ? "square" : "desktop";

  const colors = tokens.colors.primary;
  const clearSpace = Math.max(30, tokens.logo_geometry.minimum_clear_space_px);
  const minLogoWidth = Math.max(80, tokens.logo_geometry.minimum_size.width_px);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, initial-scale=1.0" />
<title>${task.campaign_id} — ${width}x${height}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&family=PT+Serif:wght@400;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    font-family: ${tokens.typography.secondary.font_family};
    color: ${colors.navy_ink.hex};
    background: ${colors.warm_linen.hex};
  }
  .canvas {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    background-image: url('${assets.envUri}');
    background-size: cover;
    background-position: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: ${
      layoutMode === "desktop"
        ? "linear-gradient(90deg, rgba(229,227,223,0.92) 0%, rgba(229,227,223,0.78) 46%, rgba(229,227,223,0.12) 100%)"
        : "linear-gradient(180deg, rgba(229,227,223,0.94) 0%, rgba(229,227,223,0.82) 48%, rgba(229,227,223,0.22) 100%)"
    };
    pointer-events: none;
  }
  .header {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${clearSpace}px ${clearSpace + 12}px;
  }
  .logo-wrap {
    padding: ${clearSpace}px;
    margin: -${clearSpace}px;
    display: inline-flex;
    align-items: center;
  }
  .logo {
    width: ${layoutMode === "mobile" ? 132 : Math.max(120, minLogoWidth)}px;
    height: auto;
    display: block;
  }
  .trust-pill {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(43, 47, 68, 0.14);
    border-radius: 999px;
    padding: 8px 18px 8px 10px;
    box-shadow: 0 8px 24px rgba(43, 47, 68, 0.08);
  }
  .trust-pill img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .trust-pill span {
    font-family: ${tokens.typography.secondary.font_family};
    font-weight: 700;
    font-size: ${layoutMode === "mobile" ? 22 : 16}px;
    color: ${colors.navy_ink.hex};
    letter-spacing: 0.02em;
  }
  .main {
    position: relative;
    z-index: 2;
    flex: 1;
    display: grid;
    grid-template-columns: ${layoutMode === "desktop" ? "1.05fr 1fr" : "1fr"};
    grid-template-rows: ${layoutMode === "desktop" ? "1fr" : "auto 1fr"};
    align-items: center;
    padding: ${layoutMode === "desktop" ? "0 64px 56px" : layoutMode === "square" ? "12px 56px 40px" : "24px 64px 72px"};
    gap: ${layoutMode === "desktop" ? "32px" : "24px"};
  }
  .copy-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${layoutMode === "mobile" ? "28px" : "20px"};
    max-width: ${layoutMode === "desktop" ? "620px" : "100%"};
  }
  .eyebrow {
    font-family: ${tokens.typography.secondary.font_family};
    font-size: ${layoutMode === "mobile" ? 24 : 15}px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: ${colors.ocean_teal.hex};
  }
  h1 {
    font-family: ${tokens.typography.primary.font_family};
    font-weight: 700;
    font-size: ${layoutMode === "desktop" ? 64 : layoutMode === "square" ? 56 : 74}px;
    line-height: 1.08;
    color: ${colors.navy_ink.hex};
  }
  .subheadline {
    font-family: ${tokens.typography.secondary.font_family};
    font-size: ${layoutMode === "desktop" ? 22 : layoutMode === "square" ? 22 : 30}px;
    line-height: 1.45;
    color: ${colors.onyx_black.hex};
  }
  .cta-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 8px;
  }
  .cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${task.cta.bg_color};
    color: ${task.cta.text_color};
    font-family: ${tokens.typography.secondary.font_family};
    font-weight: 700;
    font-size: ${layoutMode === "mobile" ? 28 : 20}px;
    padding: ${layoutMode === "mobile" ? "22px 44px" : "16px 34px"};
    border-radius: 10px;
    text-decoration: none;
    box-shadow: 0 12px 28px rgba(6, 122, 87, 0.28);
  }
  .value-props {
    font-size: ${layoutMode === "mobile" ? 22 : 15}px;
    color: ${colors.navy_ink.hex};
    font-weight: 600;
  }
  .product-col {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .mattress-cutout {
    width: ${layoutMode === "desktop" ? "100%" : layoutMode === "square" ? "86%" : "96%"};
    max-height: ${layoutMode === "desktop" ? "640px" : layoutMode === "square" ? "440px" : "760px"};
    object-fit: contain;
    filter: drop-shadow(0 28px 42px rgba(43, 47, 68, 0.22));
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="scrim"></div>
    <header class="header">
      <div class="logo-wrap">
        <img class="logo" src="${assets.logoUri}" alt="Puffy" />
      </div>
      <div class="trust-pill">
        <img src="${assets.badgeUri}" alt="Award Badge" />
        <span>${task.badge_text}</span>
      </div>
    </header>
    <main class="main">
      <section class="copy-col">
        <div class="eyebrow">Domestic Sanctuary · Zero Product Drift</div>
        <h1>${task.headline}</h1>
        <p class="subheadline">${task.subheadline}</p>
        <div class="cta-row">
          <a class="cta-btn" href="${task.cta.url}">${task.cta.label}</a>
          <span class="value-props">${tokens.value_propositions.sleep_trial} · ${tokens.value_propositions.warranty}</span>
        </div>
      </section>
      <section class="product-col">
        <img class="mattress-cutout" src="${assets.cutoutUri}" alt="Puffy Mattress Cutout" />
      </section>
    </main>
  </div>
</body>
</html>`;
}

function findChromeBinary() {
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

function resolveCatalogRelPath(relPath) {
  const abs = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Required asset not found: ${relPath}`);
  }
  const realAbs = fs.realpathSync(abs);
  return path.relative(ROOT_DIR, realAbs).split(path.sep).join("/");
}

function main() {
  const args = parseArgs(process.argv);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  const task = JSON.parse(fs.readFileSync(args.task, "utf-8"));

  validateAgainstSchema(task, schema);
  console.log(`[BannerEngine] Schema validated: ${task.campaign_id}`);

  const cutoutRel = resolveCatalogRelPath(task.mattress_cutout_path);
  const envRel = resolveCatalogRelPath(task.environment_bg_path);

  const cutoutAsset = getAsset({ intent: "cutout", file_path: cutoutRel });
  if (!cutoutAsset.zero_product_drift_verified) {
    throw new Error(
      `Cutout asset '${cutoutAsset.id}' failed Zero Product Drift verification.`
    );
  }
  const envAsset = getAsset({ intent: "hero", file_path: envRel });
  const badgeAsset = getAsset({
    category: "trust-badges",
    product_slug: "awards",
    intent: "badge",
    variant: "ad-best-cooling-2026",
    resolution: "vector",
  });

  const cutoutAbs = path.join(ROOT_DIR, cutoutAsset.file_path);
  const envAbs = path.join(ROOT_DIR, envAsset.file_path);
  const logoAbs = path.join(ROOT_DIR, "assets/logos/Puffy_Logo_0.svg");
  const badgeAbs = path.join(ROOT_DIR, badgeAsset.file_path);

  for (const requiredFile of [cutoutAbs, envAbs, logoAbs, badgeAbs]) {
    if (!fs.existsSync(requiredFile)) {
      throw new Error(`Required asset not found: ${path.relative(ROOT_DIR, requiredFile)}`);
    }
  }
  console.log(
    `[BannerEngine] Resolved catalog assets: cutout=${cutoutAsset.id}, hero=${envAsset.id}, badge=${badgeAsset.id}`
  );

  const assets = {
    cutoutUri: toDataUri(cutoutAbs, resolveMime(cutoutAbs)),
    envUri: toDataUri(envAbs, resolveMime(envAbs)),
    logoUri: toDataUri(logoAbs, resolveMime(logoAbs)),
    badgeUri: toDataUri(badgeAbs, resolveMime(badgeAbs)),
  };

  fs.mkdirSync(args.out, { recursive: true });
  const chromeBin = findChromeBinary();

  for (const viewport of task.viewports) {
    const html = buildBannerHtml(task, tokens, viewport, assets);
    const stem = `${task.campaign_id}_${viewport.width}x${viewport.height}`;
    const htmlPath = path.join(args.out, `${stem}.html`);
    const pngPath = path.join(args.out, `${stem}.png`);

    fs.writeFileSync(htmlPath, html, "utf-8");

    if (chromeBin) {
      execFileSync(
        chromeBin,
        [
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          "--hide-scrollbars",
          `--window-size=${viewport.width},${viewport.height}`,
          `--screenshot=${pngPath}`,
          `file://${htmlPath}`,
        ],
        { stdio: "pipe" }
      );
      const sizeKb = (fs.statSync(pngPath).size / 1024).toFixed(1);
      console.log(`[BannerEngine] Rendered ${path.relative(ROOT_DIR, pngPath)} (${sizeKb} KB)`);
    } else {
      console.log(`[BannerEngine] Rendered HTML fallback ${path.relative(ROOT_DIR, htmlPath)} (Chrome not found)`);
    }
  }
}

main();
