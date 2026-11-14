#!/usr/bin/env node
/**
 * [MODULE 4] Puffy® Banner Engine
 *
 * Reads a banner task payload (or CLI campaign overrides) and config/brand_tokens.json,
 * then renders arbitrary viewport sizes across 3 responsive aspect-ratio archetypes:
 *   - Landscape (W/H > 1.2): 2-column layout (Text left, Visual right)
 *   - Square / 4:5 (0.8 <= W/H <= 1.2): Stacked layout (Visual hero center-top, Text/CTA center-bottom)
 *   - Vertical / 9:16 (W/H < 0.8): Story layout (Header top, Visual mid, CTA/Accolades pinned bottom)
 *
 * Supports two rendering modes:
 *   1. Cutout Mode (`mode: "cutout"`, default):
 *      - Zero Product Drift: unaltered mattress cutout composited via HTML5 <canvas>
 *      - Multi-layered elliptical radial gradient contact shadow (or shadow_engine.py)
 *   2. Lifestyle Scene Mode (`mode: "lifestyle"`):
 *      - Full-bleed opaque lifestyle photography (`object-fit: cover`), bypassing shadow engine
 *      - Responsive dark navy gradient scrim (`linear-gradient`) behind typography
 *      - Dynamic typography using `clamp()` and calculated `rem`
 *      - High-contrast white PT Serif headline, warm gold/teal eyebrow & discount, Ocean Teal CTA
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
const DEFAULT_HERO_ASSET_PATH = path.join(__dirname, "assets/test_mattress_on_bed_shadowed.png");
const DEFAULT_OUT_DIR = path.join(__dirname, "out");

const DEFAULT_TOKENS = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
const BRAND_PALETTE = DEFAULT_TOKENS.colors.primary;

/**
 * Classifies an arbitrary viewport into one of 3 core responsive archetypes.
 *
 * @param {number} width
 * @param {number} height
 * @returns {"landscape" | "square" | "vertical"}
 */
export function classifyAspectRatio(width, height) {
  const ratio = width / height;
  if (ratio > 1.2) return "landscape";
  if (ratio >= 0.8) return "square";
  return "vertical";
}

/**
 * Parses a `<width>x<height>` string into a viewport object.
 *
 * @param {string} sizeStr
 * @returns {{ width: number, height: number }}
 */
function parseSizeToken(sizeStr) {
  const match = String(sizeStr).trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!match) {
    throw new Error(`Invalid --size value "${sizeStr}". Expected <width>x<height> (e.g. 1080x1350).`);
  }
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (width < 1 || height < 1) {
    throw new Error(`Invalid --size dimensions "${sizeStr}": width and height must be positive integers.`);
  }
  return { width, height };
}

function hexToRgb(hex) {
  const clean = String(hex).trim().replace(/^#/, "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders a multi-layered elliptical radial gradient contact shadow beneath the mattress cutout
 * to eliminate floating-mattress artifacts.
 *
 * Layers:
 *  1. Outer blurred ambient falloff (wider, softer elliptical radial gradient fading to transparent)
 *  2. Mid soft contact transition
 *  3. Inner crisp dark occlusion (tight ellipse right under the mattress base)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number }} mattressBounds
 * @param {object} [palette=BRAND_PALETTE]
 */
export function renderContactShadow(ctx, mattressBounds, palette = BRAND_PALETTE) {
  if (!ctx || !mattressBounds || mattressBounds.width <= 0 || mattressBounds.height <= 0) {
    return;
  }

  const { x, y, width, height } = mattressBounds;
  const centerX = x + width / 2;
  const baseY = y + height - Math.max(2, height * 0.035);

  const navy = palette.navy_ink.rgb;
  const onyx = palette.onyx_black.rgb;
  const toRgba = (rgb, alpha) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

  const layers = [
    {
      // Layer 1: Outer blurred ambient falloff
      offsetY: Math.max(4, height * 0.025),
      rx: width * 0.56,
      ry: Math.max(14, height * 0.145),
      stops: [
        [0, toRgba(navy, 0.24)],
        [0.42, toRgba(navy, 0.13)],
        [0.76, toRgba(navy, 0.04)],
        [1, toRgba(navy, 0)],
      ],
    },
    {
      // Layer 2: Mid soft contact shadow
      offsetY: Math.max(1, height * 0.008),
      rx: width * 0.46,
      ry: Math.max(8, height * 0.075),
      stops: [
        [0, toRgba(onyx, 0.36)],
        [0.52, toRgba(navy, 0.2)],
        [0.85, toRgba(navy, 0.05)],
        [1, toRgba(navy, 0)],
      ],
    },
    {
      // Layer 3: Inner crisp dark occlusion tight under the mattress base
      offsetY: -Math.max(1, height * 0.006),
      rx: width * 0.38,
      ry: Math.max(4, height * 0.036),
      stops: [
        [0, toRgba(onyx, 0.54)],
        [0.55, toRgba(navy, 0.32)],
        [0.88, toRgba(navy, 0.08)],
        [1, toRgba(navy, 0)],
      ],
    },
  ];

  for (const layer of layers) {
    ctx.save();
    ctx.translate(centerX, baseY + layer.offsetY);
    ctx.scale(layer.rx, layer.ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [offset, color] of layer.stops) {
      grad.addColorStop(offset, color);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function parseArgs(argv) {
  const args = {
    task: DEFAULT_TASK_PATH,
    hasExplicitTask: false,
    out: DEFAULT_OUT_DIR,
    outPrefix: null,
    cutout: null,
    preShadowed: false,
    mode: null,
    scene: null,
    sizes: [],
    campaignId: null,
    title: null,
    subhead: null,
    discount: null,
    eyebrow: null,
    ctaText: null,
    badgeText: null,
    ctaColor: null,
    ctaTextColor: null,
    brandColors: {},
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--task" && next) {
      args.task = path.resolve(argv[++i]);
      args.hasExplicitTask = true;
    } else if (flag === "--out" && next) {
      args.out = path.resolve(argv[++i]);
    } else if (flag === "--out-prefix" && next) {
      args.outPrefix = argv[++i];
    } else if (flag === "--cutout" && next) {
      args.cutout = path.resolve(argv[++i]);
    } else if (flag === "--pre-shadowed") {
      args.preShadowed = true;
    } else if (flag === "--mode" && next) {
      const m = argv[++i].toLowerCase();
      if (m !== "lifestyle" && m !== "cutout") {
        throw new Error(`Invalid --mode "${m}". Expected "lifestyle" or "cutout".`);
      }
      args.mode = m;
    } else if ((flag === "--scene" || flag === "--image" || flag === "--bg") && next) {
      args.scene = argv[++i];
    } else if (flag === "--size" && next) {
      const raw = argv[++i];
      for (const token of raw.split(",")) {
        if (token.trim()) args.sizes.push(parseSizeToken(token));
      }
    } else if (flag === "--campaign-id" && next) {
      args.campaignId = argv[++i];
    } else if ((flag === "--title" || flag === "--headline") && next) {
      args.title = argv[++i];
    } else if ((flag === "--subhead" || flag === "--subheadline") && next) {
      args.subhead = argv[++i];
    } else if (flag === "--discount" && next) {
      args.discount = argv[++i];
    } else if (flag === "--eyebrow" && next) {
      args.eyebrow = argv[++i];
    } else if ((flag === "--cta" || flag === "--cta-text") && next) {
      args.ctaText = argv[++i];
    } else if ((flag === "--badge" || flag === "--badge-text") && next) {
      args.badgeText = argv[++i];
    } else if (flag === "--cta-color" && next) {
      args.ctaColor = argv[++i];
    } else if (flag === "--cta-text-color" && next) {
      args.ctaTextColor = argv[++i];
    } else if ((flag === "--brand-color" || flag === "--accent-color") && next) {
      args.brandColors.accent = argv[++i];
    } else if (flag === "--navy-color" && next) {
      args.brandColors.navy_ink = argv[++i];
    } else if (flag === "--scrim-color" && next) {
      args.brandColors.scrim = argv[++i];
    } else if (flag === "--colors" && next) {
      const parsed = JSON.parse(argv[++i]);
      Object.assign(args.brandColors, parsed);
    }
  }
  return args;
}

function applyTaskOverrides(baseTask, args) {
  const task = structuredClone(baseTask);

  if (args.campaignId) task.campaign_id = args.campaignId;
  if (args.title) task.headline = args.title;
  else if (task.title && !task.headline) task.headline = task.title;

  if (args.subhead) task.subheadline = args.subhead;
  else if (task.subhead && !task.subheadline) task.subheadline = task.subhead;

  if (args.discount !== null) task.discount = args.discount;
  if (args.eyebrow !== null) task.eyebrow = args.eyebrow;
  if (args.badgeText) task.badge_text = args.badgeText;

  task.cta = task.cta || {
    label: "Shop Puffy",
    url: "https://puffy.com",
    bg_color: "#067A57",
    text_color: "#FFFFFF",
  };
  if (args.ctaText) task.cta.label = args.ctaText;
  else if (task.cta_text) task.cta.label = task.cta_text;

  if (args.ctaColor) task.cta.bg_color = args.ctaColor;
  if (args.ctaTextColor) task.cta.text_color = args.ctaTextColor;

  if (args.scene) {
    task.scene_path = args.scene;
    task.environment_bg_path = args.scene;
  } else if (task.scene_path && !task.environment_bg_path) {
    task.environment_bg_path = task.scene_path;
  }

  if (args.sizes.length > 0) {
    task.viewports = args.sizes;
  }

  const mergedBrandColors = {
    ...(task.brand_colors || {}),
    ...args.brandColors,
  };
  if (Object.keys(mergedBrandColors).length > 0) {
    task.brand_colors = mergedBrandColors;
  }

  // Determine render mode
  if (args.mode) {
    task.mode = args.mode;
  } else if (!task.mode) {
    task.mode = args.scene && !args.cutout ? "lifestyle" : "cutout";
  }

  return task;
}

function buildEffectiveTokens(baseTokens, task) {
  const tokens = structuredClone(baseTokens);
  const overrides = task.brand_colors || {};

  const colorMap = {
    navy_ink: overrides.navy_ink || overrides.navy || overrides.primary,
    ocean_teal: overrides.ocean_teal || overrides.teal || task.cta?.bg_color,
    pure_white: overrides.pure_white || overrides.white,
    warm_linen: overrides.warm_linen || overrides.linen,
    onyx_black: overrides.onyx_black || overrides.onyx,
  };

  for (const [key, hex] of Object.entries(colorMap)) {
    if (hex && tokens.colors.primary[key]) {
      tokens.colors.primary[key] = {
        ...tokens.colors.primary[key],
        hex,
        rgb: hexToRgb(hex),
      };
    }
  }

  tokens.lifestyle = {
    eyebrowColor: overrides.accent || overrides.eyebrow || "#F4C96B",
    eyebrowSecondaryColor: overrides.teal_light || "#4FD1A5",
    scrimHex: overrides.scrim || tokens.colors.primary.navy_ink.hex,
    scrimRgb: hexToRgb(overrides.scrim || tokens.colors.primary.navy_ink.hex),
    headlineColor: overrides.headline || tokens.colors.primary.pure_white.hex,
    subheadColor: overrides.subhead || "rgba(255, 255, 255, 0.92)",
  };

  return tokens;
}

function validateAgainstSchema(task, schema, hasOverrides) {
  const errors = [];
  if (typeof task !== "object" || task === null || Array.isArray(task)) {
    throw new Error("Banner task must be a JSON object.");
  }

  const isLifestyle = task.mode === "lifestyle";
  for (const reqKey of schema.required) {
    if (isLifestyle && reqKey === "mattress_cutout_path") continue;
    if (!(reqKey in task)) {
      errors.push(`Missing required property: ${reqKey}`);
    }
  }

  if (!isLifestyle && !hasOverrides) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    allowedKeys.add("mode");
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
  }

  if (!task.cta || typeof task.cta !== "object") {
    errors.push("cta must be an object.");
  } else if (!isLifestyle && !hasOverrides) {
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

function resolveFilePath(inputPath) {
  const candidate = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT_DIR, inputPath);
  if (!fs.existsSync(candidate)) {
    throw new Error(`Required asset not found: ${inputPath}`);
  }
  return fs.realpathSync(candidate);
}

/**
 * Builds responsive HTML/CSS output for Lifestyle Scene Mode (`mode: "lifestyle"`).
 * Renders full-bleed photography with `object-fit: cover`, dark navy gradient scrim,
 * `clamp()` / calculated `rem` typography, and adaptive 3-archetype layout.
 */
function buildLifestyleBannerHtml(task, tokens, viewport, assets) {
  const { width, height } = viewport;
  const archetype = classifyAspectRatio(width, height);
  const minDim = Math.min(width, height);

  // Calculated root rem proportional to viewport dimensions
  const baseRemPx = Number(Math.max(7.5, Math.min(20, minDim / 56)).toFixed(2));
  const clearSpacePx = width < 450 || height < 350 ? Math.max(14, Math.round(minDim * 0.055)) : Math.max(30, tokens.logo_geometry.minimum_clear_space_px);
  const minLogoW = width < 450 ? Math.max(56, Math.round(width * 0.22)) : Math.max(80, tokens.logo_geometry.minimum_size.width_px);

  const colors = tokens.colors.primary;
  const ls = tokens.lifestyle;
  const scrimRgb = ls.scrimRgb;
  const rgba = (rgb, a) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;

  const eyebrowText = task.eyebrow || "DOMESTIC SANCTUARY · CLOUD COMFORT";
  const discountText = task.discount || "";
  const accoladesText = `${tokens.value_propositions.sleep_trial} · ${tokens.value_propositions.warranty}`;

  const logoSrc = assets.whiteLogoUri || assets.logoUri;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, initial-scale=1.0" />
<title>${escapeHtml(task.campaign_id)} — ${width}x${height} (${archetype})</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&family=PT+Serif:wght@400;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --pad: ${clearSpacePx}px;
    --navy-hex: ${colors.navy_ink.hex};
    --teal-hex: ${task.cta.bg_color || colors.ocean_teal.hex};
    --cta-text-hex: ${task.cta.text_color || colors.pure_white.hex};
    --headline-hex: ${ls.headlineColor};
    --subhead-color: ${ls.subheadColor};
    --eyebrow-hex: ${ls.eyebrowColor};
    --eyebrow-alt-hex: ${ls.eyebrowSecondaryColor};
    --font-serif: ${tokens.typography.primary.font_family};
    --font-sans: ${tokens.typography.secondary.font_family};
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    font-size: ${baseRemPx}px;
  }

  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: var(--navy-hex);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }

  .banner {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: var(--pad);
  }

  .scene-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    z-index: 0;
  }

  .scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  /* Archetype 1: Landscape (W/H > 1.2) — 2-column layout: Text left, Visual right */
  .banner[data-archetype="landscape"] .scrim {
    background: linear-gradient(
      90deg,
      rgba(18, 21, 34, 0.94) 0%,
      ${rgba(scrimRgb, 0.86)} 44%,
      ${rgba(scrimRgb, 0.42)} 66%,
      ${rgba(scrimRgb, 0.04)} 88%,
      ${rgba(scrimRgb, 0)} 100%
    );
  }

  /* Archetype 2: Square / 4:5 (0.8 <= W/H <= 1.2) — Stacked: Visual hero center-top, Text/CTA center-bottom */
  .banner[data-archetype="square"] .scrim {
    background:
      linear-gradient(180deg, rgba(18, 21, 34, 0.65) 0%, ${rgba(scrimRgb, 0.16)} 18%, ${rgba(scrimRgb, 0)} 32%),
      linear-gradient(0deg, rgba(18, 21, 34, 0.95) 0%, ${rgba(scrimRgb, 0.88)} 34%, ${rgba(scrimRgb, 0.48)} 54%, ${rgba(scrimRgb, 0)} 74%);
  }

  /* Archetype 3: Vertical / 9:16 (W/H < 0.8) — Story: Header top, Visual mid, CTA/Accolades pinned bottom */
  .banner[data-archetype="vertical"] .scrim {
    background:
      linear-gradient(180deg, rgba(18, 21, 34, 0.92) 0%, ${rgba(scrimRgb, 0.78)} 26%, ${rgba(scrimRgb, 0.18)} 44%, ${rgba(scrimRgb, 0)} 56%),
      linear-gradient(0deg, rgba(18, 21, 34, 0.95) 0%, ${rgba(scrimRgb, 0.80)} 18%, ${rgba(scrimRgb, 0)} 34%);
  }

  .header {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
  }

  .logo {
    width: clamp(${minLogoW}px, 8.5rem, 176px);
    height: auto;
    display: block;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35));
  }

  .trust-pill {
    display: inline-flex;
    align-items: center;
    gap: clamp(6px, 0.55rem, 12px);
    padding: clamp(4px, 0.42rem, 10px) clamp(10px, 0.95rem, 18px);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    color: var(--navy-hex);
    font-weight: 700;
    font-size: clamp(9px, 0.88rem, 18px);
    line-height: 1.1;
    box-shadow: 0 6px 20px rgba(15, 18, 30, 0.25);
    border: 1px solid rgba(43, 47, 68, 0.12);
    white-space: nowrap;
  }

  .trust-pill img {
    width: clamp(16px, 1.75rem, 34px);
    height: clamp(16px, 1.75rem, 34px);
    object-fit: contain;
    display: block;
  }

  .content {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Landscape layout positioning */
  .banner[data-archetype="landscape"] .content {
    justify-content: center;
    align-items: flex-start;
    max-width: 54%;
    text-align: left;
  }

  /* Square / 4:5 stacked positioning */
  .banner[data-archetype="square"] .content {
    justify-content: flex-end;
    align-items: center;
    text-align: center;
    padding-bottom: clamp(4px, 0.5rem, 14px);
  }

  /* Vertical / 9:16 story positioning */
  .banner[data-archetype="vertical"] .content {
    justify-content: space-between;
    align-items: center;
    text-align: center;
    padding-top: clamp(16px, 2.2rem, 48px);
    padding-bottom: clamp(16px, 2.5rem, 64px);
  }

  .copy-group {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 0.75rem, 16px);
  }

  .banner[data-archetype="landscape"] .copy-group {
    align-items: flex-start;
  }

  .banner[data-archetype="square"] .copy-group,
  .banner[data-archetype="vertical"] .copy-group {
    align-items: center;
    max-width: 92%;
  }

  .eyebrow-row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: clamp(6px, 0.6rem, 12px);
  }

  .banner[data-archetype="square"] .eyebrow-row,
  .banner[data-archetype="vertical"] .eyebrow-row {
    justify-content: center;
  }

  .eyebrow {
    font-size: clamp(9px, 0.92rem, 18px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--eyebrow-hex);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  }

  .discount-badge {
    display: inline-block;
    padding: clamp(2px, 0.22rem, 5px) clamp(8px, 0.65rem, 14px);
    border-radius: 4px;
    background: rgba(244, 201, 107, 0.18);
    border: 1px solid var(--eyebrow-hex);
    color: var(--eyebrow-hex);
    font-size: clamp(9px, 0.85rem, 16px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .headline {
    font-family: var(--font-serif);
    font-weight: 700;
    color: var(--headline-hex);
    line-height: 1.12;
    letter-spacing: -0.01em;
    text-shadow: 0 3px 18px rgba(10, 12, 22, 0.5);
  }

  .banner[data-archetype="landscape"] .headline {
    font-size: clamp(18px, 3.35rem, 58px);
  }

  .banner[data-archetype="square"] .headline {
    font-size: clamp(18px, 2.95rem, 56px);
  }

  .banner[data-archetype="vertical"] .headline {
    font-size: clamp(24px, 3.65rem, 72px);
  }

  .subheadline {
    font-family: var(--font-sans);
    font-weight: 400;
    color: var(--subhead-color);
    line-height: 1.42;
    text-shadow: 0 1px 10px rgba(10, 12, 22, 0.45);
  }

  .banner[data-archetype="landscape"] .subheadline {
    font-size: clamp(11px, 1.32rem, 21px);
    max-width: 96%;
  }

  .banner[data-archetype="square"] .subheadline {
    font-size: clamp(11px, 1.18rem, 21px);
    max-width: 86%;
  }

  .banner[data-archetype="vertical"] .subheadline {
    font-size: clamp(13px, 1.45rem, 28px);
    max-width: 90%;
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 0.85rem, 18px);
    margin-top: clamp(10px, 1.2rem, 26px);
  }

  .banner[data-archetype="landscape"] .action-group {
    align-items: flex-start;
  }

  .banner[data-archetype="square"] .action-group,
  .banner[data-archetype="vertical"] .action-group {
    align-items: center;
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--teal-hex);
    color: var(--cta-text-hex);
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: clamp(12px, 1.25rem, 26px);
    padding: clamp(7px, 0.72rem, 18px) clamp(16px, 2.1rem, 48px);
    border-radius: 8px;
    text-decoration: none;
    letter-spacing: 0.02em;
    box-shadow: 0 10px 28px rgba(6, 122, 87, 0.42);
    white-space: nowrap;
  }

  .banner[data-archetype="vertical"] .cta-btn {
    font-size: clamp(14px, 1.55rem, 30px);
    padding: clamp(10px, 1rem, 22px) clamp(28px, 3.2rem, 64px);
  }

  .accolades {
    font-size: clamp(9px, 0.88rem, 20px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.84);
    letter-spacing: 0.02em;
    text-shadow: 0 1px 8px rgba(10, 12, 22, 0.5);
  }

  /* Compact ultra-small viewport tuning (e.g. 300x250) */
  ${width <= 360 || height <= 320 ? `
  .trust-pill { display: none; }
  .subheadline { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .accolades { display: none; }
  ` : ""}
</style>
</head>
<body data-mode="lifestyle" data-archetype="${archetype}">
  <main class="banner" data-archetype="${archetype}">
    <img class="scene-bg" src="${assets.envUri}" alt="${escapeHtml(task.campaign_id)}" />
    <div class="scrim"></div>

    <header class="header">
      <img class="logo" src="${logoSrc}" alt="Puffy" />
      <div class="trust-pill">
        <img src="${assets.badgeUri}" alt="" />
        <span>${escapeHtml(task.badge_text)}</span>
      </div>
    </header>

    <section class="content">
      <div class="copy-group">
        <div class="eyebrow-row">
          <span class="eyebrow">${escapeHtml(eyebrowText)}</span>
          ${discountText ? `<span class="discount-badge">${escapeHtml(discountText)}</span>` : ""}
        </div>
        <h1 class="headline">${escapeHtml(task.headline)}</h1>
        <p class="subheadline">${escapeHtml(task.subheadline)}</p>
        ${archetype !== "vertical" ? `
        <div class="action-group">
          <a class="cta-btn" href="${escapeHtml(task.cta.url || "#")}">${escapeHtml(task.cta.label)}</a>
          <div class="accolades">${escapeHtml(accoladesText)}</div>
        </div>` : ""}
      </div>

      ${archetype === "vertical" ? `
      <div class="action-group">
        <a class="cta-btn" href="${escapeHtml(task.cta.url || "#")}">${escapeHtml(task.cta.label)}</a>
        <div class="accolades">${escapeHtml(accoladesText)}</div>
      </div>` : ""}
    </section>
  </main>
<script>
  window.addEventListener("load", () => {
    document.body.dataset.rendered = "true";
  });
</script>
</body>
</html>`;
}

function buildBannerHtml(task, tokens, viewport, assets) {
  if (task.mode === "lifestyle") {
    return buildLifestyleBannerHtml(task, tokens, viewport, assets);
  }

  const { width, height } = viewport;
  const archetype = classifyAspectRatio(width, height);
  const layoutMode = archetype === "vertical" ? "mobile" : archetype === "square" ? "square" : "desktop";

  const colors = tokens.colors.primary;
  const clearSpace = Math.max(30, tokens.logo_geometry.minimum_clear_space_px);
  const minLogoWidth = Math.max(80, tokens.logo_geometry.minimum_size.width_px);

  const renderConfig = {
    width,
    height,
    layoutMode,
    archetype,
    shadowEngineApplied: Boolean(assets.shadowEngineApplied),
    clearSpace,
    minLogoWidth,
    colors,
    typography: tokens.typography,
    valuePropositions: tokens.value_propositions,
    task: {
      campaign_id: task.campaign_id,
      headline: task.headline,
      subheadline: task.subheadline,
      badge_text: task.badge_text,
      discount: task.discount || "",
      eyebrow: task.eyebrow || "DOMESTIC SANCTUARY · ZERO PRODUCT DRIFT",
      cta: task.cta,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, initial-scale=1.0" />
<title>${escapeHtml(task.campaign_id)} — ${width}x${height}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700&family=PT+Serif:wght@400;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: ${colors.warm_linen.hex};
  }
  canvas {
    display: block;
    width: ${width}px;
    height: ${height}px;
  }
  .preload-assets {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
</style>
</head>
<body data-mode="cutout" data-archetype="${archetype}">
  <canvas id="banner-canvas" width="${width}" height="${height}"></canvas>
  <div class="preload-assets">
    <img id="img-env" src="${assets.envUri}" alt="" />
    <img id="img-cutout" src="${assets.cutoutUri}" alt="" />
    <img id="img-logo" src="${assets.logoUri}" alt="" />
    <img id="img-badge" src="${assets.badgeUri}" alt="" />
  </div>
<script>
  const CONFIG = ${JSON.stringify(renderConfig)};
  const BRAND_PALETTE = CONFIG.colors;

  ${renderContactShadow.toString()}

  function rgba(rgb, alpha) {
    return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
  }

  function drawAmbientBackground(ctx, W, H) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#FFFFFF");
    bgGrad.addColorStop(0.55, "#FAF9F7");
    bgGrad.addColorStop(1, "#F5F3EF");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(/\\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawTextBlock(ctx, lines, x, startY, lineHeight, align) {
    ctx.textAlign = align || "left";
    ctx.textBaseline = "top";
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });
    return startY + lines.length * lineHeight;
  }

  function drawTrustBadgePill(ctx, badgeImg, badgeText, rightX, topY, scale) {
    const padX = Math.round(16 * scale);
    const padY = Math.round(8 * scale);
    const iconSize = Math.round(34 * scale);
    const gap = Math.round(10 * scale);
    const fontSize = Math.round(16 * scale);

    ctx.font = "700 " + fontSize + "px " + CONFIG.typography.secondary.font_family;
    const textW = ctx.measureText(badgeText).width;
    const pillW = padX + iconSize + gap + textW + padX;
    const pillH = Math.max(iconSize + padY * 2, Math.round(50 * scale));
    const pillX = rightX - pillW;
    const pillY = topY;

    ctx.save();
    ctx.shadowColor = rgba(BRAND_PALETTE.navy_ink.rgb, 0.12);
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = rgba(BRAND_PALETTE.pure_white.rgb, 0.94);
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.strokeStyle = rgba(BRAND_PALETTE.navy_ink.rgb, 0.14);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.drawImage(badgeImg, pillX + padX, pillY + (pillH - iconSize) / 2, iconSize, iconSize);

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 " + fontSize + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, pillX + padX + iconSize + gap, pillY + pillH / 2 + 1);

    return { x: pillX, y: pillY, width: pillW, height: pillH };
  }

  function drawCtaButton(ctx, label, centerX, topY, fontSize, padX, padY, centered) {
    ctx.font = "700 " + fontSize + "px " + CONFIG.typography.secondary.font_family;
    const textW = ctx.measureText(label).width;
    const btnW = Math.round(textW + padX * 2);
    const btnH = Math.round(fontSize + padY * 2);
    const btnX = centered ? Math.round(centerX - btnW / 2) : centerX;

    ctx.save();
    ctx.shadowColor = rgba(BRAND_PALETTE.ocean_teal.rgb, 0.3);
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, btnX, topY, btnW, btnH, 8);
    ctx.fillStyle = CONFIG.task.cta.bg_color;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = CONFIG.task.cta.text_color;
    ctx.font = "700 " + fontSize + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, btnX + btnW / 2, topY + btnH / 2 + 1);

    return { x: btnX, y: topY, width: btnW, height: btnH };
  }

  function renderDesktop(ctx, imgs) {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const s = Math.min(W / 1440, H / 900);
    const pad = Math.max(W < 500 ? 16 : CONFIG.clearSpace + 12, Math.round(44 * s));

    drawAmbientBackground(ctx, W, H);

    const logoW = Math.max(W < 500 ? 60 : CONFIG.minLogoWidth, Math.round(148 * s));
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, Math.round(pad * 0.85), logoW, logoH);

    if (W >= 480) {
      drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, Math.round(pad * 0.75), Math.max(0.65, s));
    }

    const targetVisibleW = Math.round(W * 0.54);
    const mattressW = CONFIG.shadowEngineApplied
      ? Math.round(targetVisibleW / 0.75)
      : targetVisibleW;
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = CONFIG.shadowEngineApplied
      ? Math.round(W - pad - mattressW * 0.875)
      : Math.round(W - pad - mattressW);
    const mattressY = CONFIG.shadowEngineApplied
      ? Math.round(H * 0.74 - mattressH * 0.85)
      : Math.round(H * 0.55 - mattressH / 2);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    if (!CONFIG.shadowEngineApplied) {
      renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    }
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    const colX = pad;
    const colMaxW = Math.round(W * 0.42) - pad;
    let cursorY = Math.round(H * 0.21);

    const eyebrowSize = Math.max(10, Math.round(15 * s));
    const eyebrowText = CONFIG.task.discount ? CONFIG.task.eyebrow + " · " + CONFIG.task.discount : CONFIG.task.eyebrow;
    ctx.fillStyle = BRAND_PALETTE.ocean_teal.hex;
    ctx.font = "700 " + eyebrowSize + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(eyebrowText, colX, cursorY);
    cursorY += Math.round(34 * s);

    const headSize = Math.max(18, Math.round(54 * s));
    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 " + headSize + "px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, colMaxW);
    cursorY = drawTextBlock(ctx, headlineLines, colX, cursorY, Math.round(headSize * 1.15), "left");
    cursorY += Math.round(20 * s);

    const subSize = Math.max(12, Math.round(21 * s));
    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 " + subSize + "px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, colMaxW);
    cursorY = drawTextBlock(ctx, subLines, colX, cursorY, Math.round(subSize * 1.45), "left");
    cursorY += Math.round(28 * s);

    const ctaSize = Math.max(12, Math.round(20 * s));
    const btn = drawCtaButton(ctx, CONFIG.task.cta.label, colX, cursorY, ctaSize, Math.round(32 * s), Math.round(14 * s), false);
    cursorY = btn.y + btn.height + Math.round(18 * s);

    if (W >= 480) {
      ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
      ctx.font = "600 " + Math.max(11, Math.round(15 * s)) + "px " + CONFIG.typography.secondary.font_family;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        CONFIG.valuePropositions.sleep_trial + " · " + CONFIG.valuePropositions.warranty,
        colX,
        cursorY
      );
    }
  }

  function renderSquare(ctx, imgs) {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const s = Math.min(W / 1080, H / 1080);
    const pad = Math.max(W < 450 ? 16 : CONFIG.clearSpace + 10, Math.round(40 * s));

    drawAmbientBackground(ctx, W, H);

    const logoW = Math.max(W < 450 ? 58 : CONFIG.minLogoWidth, Math.round(136 * s));
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, Math.round(pad * 0.9), logoW, logoH);

    if (W >= 450) {
      drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, Math.round(pad * 0.8), Math.max(0.6, s));
    }

    const targetVisibleW = Math.round(W * 0.66);
    const mattressW = CONFIG.shadowEngineApplied
      ? Math.round(targetVisibleW / 0.75)
      : targetVisibleW;
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = Math.round((W - mattressW) / 2);
    const mattressY = CONFIG.shadowEngineApplied
      ? Math.round(H * 0.56 - mattressH * 0.85)
      : Math.round(H * 0.30);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    if (!CONFIG.shadowEngineApplied) {
      renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    }
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    const maxTextW = W - pad * 2;
    let cursorY = CONFIG.shadowEngineApplied
      ? Math.round(mattressY + mattressH * 0.85 + Math.round(24 * s))
      : mattressY + mattressH + Math.round(64 * s);

    const eyebrowSize = Math.max(9, Math.round(15 * s));
    const eyebrowText = CONFIG.task.discount ? CONFIG.task.eyebrow + " · " + CONFIG.task.discount : CONFIG.task.eyebrow;
    ctx.fillStyle = BRAND_PALETTE.ocean_teal.hex;
    ctx.font = "700 " + eyebrowSize + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(eyebrowText, W / 2, cursorY);
    cursorY += Math.round(28 * s);

    const headSize = Math.max(16, Math.round(50 * s));
    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 " + headSize + "px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, maxTextW);
    cursorY = drawTextBlock(ctx, headlineLines, W / 2, cursorY, Math.round(headSize * 1.15), "center");
    cursorY += Math.round(16 * s);

    const subSize = Math.max(11, Math.round(20 * s));
    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 " + subSize + "px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, maxTextW - Math.round(40 * s)).slice(0, 2);
    cursorY = drawTextBlock(ctx, subLines, W / 2, cursorY, Math.round(subSize * 1.42), "center");
    cursorY += Math.round(24 * s);

    const ctaSize = Math.max(12, Math.round(22 * s));
    drawCtaButton(ctx, CONFIG.task.cta.label, W / 2, cursorY, ctaSize, Math.round(38 * s), Math.round(15 * s), true);
  }

  function renderMobile(ctx, imgs) {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const s = Math.min(W / 1080, H / 1920);
    const pad = Math.max(CONFIG.clearSpace + 18, Math.round(48 * s));

    drawAmbientBackground(ctx, W, H);

    const logoW = Math.max(CONFIG.minLogoWidth, Math.round(160 * s));
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, CONFIG.clearSpace + 14, logoW, logoH);

    drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, CONFIG.clearSpace + 10, 1.25 * s);

    const maxTextW = W - pad * 2;
    let cursorY = Math.round(H * 0.10);

    const eyebrowText = CONFIG.task.discount ? CONFIG.task.eyebrow + " · " + CONFIG.task.discount : CONFIG.task.eyebrow;
    ctx.fillStyle = BRAND_PALETTE.ocean_teal.hex;
    ctx.font = "700 " + Math.round(22 * s) + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(eyebrowText, pad, cursorY);
    cursorY += Math.round(46 * s);

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 " + Math.round(72 * s) + "px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, maxTextW);
    cursorY = drawTextBlock(ctx, headlineLines, pad, cursorY, Math.round(84 * s), "left");
    cursorY += Math.round(28 * s);

    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 " + Math.round(30 * s) + "px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, maxTextW);
    drawTextBlock(ctx, subLines, pad, cursorY, Math.round(44 * s), "left");

    const targetVisibleW = Math.round(W * 0.75);
    const mattressW = CONFIG.shadowEngineApplied
      ? Math.round(targetVisibleW / 0.75)
      : targetVisibleW;
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = Math.round((W - mattressW) / 2);
    const mattressY = CONFIG.shadowEngineApplied
      ? Math.round(H * 0.66 - mattressH * 0.85)
      : Math.round(H * 0.56 - mattressH / 2);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    if (!CONFIG.shadowEngineApplied) {
      renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    }
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    const ctaY = H - Math.round(290 * s);
    const btn = drawCtaButton(ctx, CONFIG.task.cta.label, W / 2, ctaY, Math.round(30 * s), Math.round(56 * s), Math.round(22 * s), true);

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "600 " + Math.round(24 * s) + "px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      CONFIG.valuePropositions.sleep_trial + " · " + CONFIG.valuePropositions.warranty,
      W / 2,
      btn.y + btn.height + Math.round(32 * s)
    );
  }

  function renderCanvas() {
    const canvas = document.getElementById("banner-canvas");
    const ctx = canvas.getContext("2d");
    const imgs = {
      env: document.getElementById("img-env"),
      cutout: document.getElementById("img-cutout"),
      logo: document.getElementById("img-logo"),
      badge: document.getElementById("img-badge"),
    };

    if (CONFIG.layoutMode === "desktop") {
      renderDesktop(ctx, imgs);
    } else if (CONFIG.layoutMode === "square") {
      renderSquare(ctx, imgs);
    } else {
      renderMobile(ctx, imgs);
    }
    document.body.dataset.rendered = "true";
  }

  window.addEventListener("load", renderCanvas);
</script>
</body>
</html>`;
}

function findChromeBinary() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

function applyShadowEngine(inputAbs) {
  const shadowScript = path.join(ROOT_DIR, "scripts/shadow_engine.py");
  const cacheDir = path.join(__dirname, "assets", "shadowed");
  fs.mkdirSync(cacheDir, { recursive: true });
  const baseName = path.basename(inputAbs, path.extname(inputAbs));
  const outputAbs = path.join(cacheDir, `${baseName}_shadowed.png`);

  execFileSync("python3", [shadowScript, "--input", inputAbs, "--output", outputAbs], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
  return outputAbs;
}

function resolveCatalogRelPath(relPath) {
  const abs = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Required asset not found: ${relPath}`);
  }
  const realAbs = fs.realpathSync(abs);
  return path.relative(ROOT_DIR, realAbs).split(path.sep).join("/");
}

async function renderViewports(task, tokens, assets, outDir, outPrefix) {
  let chromium = null;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    chromium = null;
  }

  const results = [];
  const prefix = outPrefix || task.campaign_id;

  if (chromium) {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      for (const viewport of task.viewports) {
        const archetype = classifyAspectRatio(viewport.width, viewport.height);
        const html = buildBannerHtml(task, tokens, viewport, assets);
        const stem = `${prefix}_${viewport.width}x${viewport.height}`;
        const htmlPath = path.join(outDir, `${stem}.html`);
        const pngPath = path.join(outDir, `${stem}.png`);

        fs.writeFileSync(htmlPath, html, "utf-8");
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.rendered === "true");
        await page.screenshot({ path: pngPath });

        const sizeKb = (fs.statSync(pngPath).size / 1024).toFixed(1);
        console.log(
          `[BannerEngine] Rendered ${path.relative(ROOT_DIR, pngPath)} (${sizeKb} KB) [mode=${task.mode}, archetype=${archetype}]`
        );
        results.push({ viewport, archetype, htmlPath, pngPath, sizeKb });
      }
    } finally {
      await browser.close();
    }
    return results;
  }

  const chromeBin = findChromeBinary();
  for (const viewport of task.viewports) {
    const archetype = classifyAspectRatio(viewport.width, viewport.height);
    const html = buildBannerHtml(task, tokens, viewport, assets);
    const stem = `${prefix}_${viewport.width}x${viewport.height}`;
    const htmlPath = path.join(outDir, `${stem}.html`);
    const pngPath = path.join(outDir, `${stem}.png`);

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
      console.log(
        `[BannerEngine] Rendered ${path.relative(ROOT_DIR, pngPath)} (${sizeKb} KB) [mode=${task.mode}, archetype=${archetype}]`
      );
      results.push({ viewport, archetype, htmlPath, pngPath, sizeKb });
    } else {
      console.log(
        `[BannerEngine] Rendered HTML fallback ${path.relative(ROOT_DIR, htmlPath)} (Chrome not found) [mode=${task.mode}, archetype=${archetype}]`
      );
      results.push({ viewport, archetype, htmlPath, pngPath: null, sizeKb: null });
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const baseTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  const baseTask = JSON.parse(fs.readFileSync(args.task, "utf-8"));

  const task = applyTaskOverrides(baseTask, args);
  const tokens = buildEffectiveTokens(baseTokens, task);

  const hasOverrides = Boolean(
    args.sizes.length > 0 ||
      args.mode ||
      args.scene ||
      args.title ||
      args.subhead ||
      args.discount !== null ||
      args.eyebrow !== null ||
      args.ctaText ||
      args.ctaColor ||
      args.ctaTextColor ||
      Object.keys(args.brandColors).length > 0
  );

  validateAgainstSchema(task, schema, hasOverrides);
  console.log(`[BannerEngine] Validated task: ${task.campaign_id} (mode=${task.mode})`);

  const badgeAsset = getAsset({
    category: "trust-badges",
    product_slug: "awards",
    intent: "badge",
    variant: "ad-best-cooling-2026",
    resolution: "vector",
  });

  const logoAbs = path.join(ROOT_DIR, "assets/logos/Puffy_Logo_0.svg");
  const whiteLogoAbs = path.join(ROOT_DIR, "assets/logos/Puffy_Logo_3.svg");
  const badgeAbs = path.join(ROOT_DIR, badgeAsset.file_path);

  let envAbs;
  if (task.mode === "lifestyle") {
    const sceneInput = task.scene_path || task.environment_bg_path;
    envAbs = resolveFilePath(sceneInput);
    for (const requiredFile of [envAbs, whiteLogoAbs, badgeAbs]) {
      if (!fs.existsSync(requiredFile)) {
        throw new Error(`Required asset not found: ${path.relative(ROOT_DIR, requiredFile)}`);
      }
    }
    console.log(
      `[BannerEngine] Lifestyle scene mode: scene=${path.relative(ROOT_DIR, envAbs)}, badge=${badgeAsset.id} (shadow engine bypassed)`
    );

    const assets = {
      envUri: toDataUri(envAbs, resolveMime(envAbs)),
      logoUri: toDataUri(logoAbs, resolveMime(logoAbs)),
      whiteLogoUri: toDataUri(whiteLogoAbs, resolveMime(whiteLogoAbs)),
      badgeUri: toDataUri(badgeAbs, resolveMime(badgeAbs)),
      shadowEngineApplied: false,
    };

    fs.mkdirSync(args.out, { recursive: true });
    await renderViewports(task, tokens, assets, args.out, args.outPrefix);
    return;
  }

  // Cutout Mode (Zero Product Drift + Shadow Engine)
  let rawCutoutAbs;
  let cutoutLabel;
  let isPreShadowed = args.preShadowed;
  if (args.cutout) {
    if (!fs.existsSync(args.cutout)) {
      throw new Error(`Cutout file not found: ${args.cutout}`);
    }
    rawCutoutAbs = args.cutout;
    cutoutLabel = path.relative(ROOT_DIR, rawCutoutAbs);
  } else {
    rawCutoutAbs = DEFAULT_HERO_ASSET_PATH;
    cutoutLabel = path.relative(ROOT_DIR, rawCutoutAbs);
    isPreShadowed = true;
  }

  const envRel = resolveCatalogRelPath(task.environment_bg_path);
  const envAsset = getAsset({ intent: "hero", file_path: envRel });
  envAbs = path.join(ROOT_DIR, envAsset.file_path);

  for (const requiredFile of [rawCutoutAbs, envAbs, logoAbs, badgeAbs]) {
    if (!fs.existsSync(requiredFile)) {
      throw new Error(`Required asset not found: ${path.relative(ROOT_DIR, requiredFile)}`);
    }
  }
  console.log(
    `[BannerEngine] Resolved catalog assets: cutout=${cutoutLabel}, hero=${envAsset.id}, badge=${badgeAsset.id}`
  );

  const cutoutAbs = isPreShadowed ? rawCutoutAbs : applyShadowEngine(rawCutoutAbs);

  const assets = {
    cutoutUri: toDataUri(cutoutAbs, resolveMime(cutoutAbs)),
    envUri: toDataUri(envAbs, resolveMime(envAbs)),
    logoUri: toDataUri(logoAbs, resolveMime(logoAbs)),
    whiteLogoUri: toDataUri(whiteLogoAbs, resolveMime(whiteLogoAbs)),
    badgeUri: toDataUri(badgeAbs, resolveMime(badgeAbs)),
    shadowEngineApplied: true,
  };

  fs.mkdirSync(args.out, { recursive: true });
  await renderViewports(task, tokens, assets, args.out, args.outPrefix);
}

const isMain =
  Boolean(process.argv[1]) && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(__filename);
if (isMain) {
  main().catch((err) => {
    console.error(`[BannerEngine] Fatal: ${err.message}`);
    process.exit(1);
  });
}
