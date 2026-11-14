#!/usr/bin/env node
/**
 * [MODULE 4] Puffy® Banner Engine
 *
 * Reads a banner task payload validated against config/schemas/banner_task.schema.json
 * and config/brand_tokens.json, then renders Desktop (1440x900), Social Square (1080x1080),
 * and Mobile Story (1080x1920) PNG outputs via an HTML5 <canvas> compositing pipeline
 * in headless Chromium.
 *
 * Enforces:
 * - Zero Product Drift: unaltered mattress cutout composited over environment plate
 * - Multi-layered elliptical radial gradient contact shadow beneath the mattress cutout
 * - Brand Token Authority: all colors & typography read dynamically from config/brand_tokens.json
 * - Logo Geometry: >= minimum_clear_space_px (30px) clear space on all sides, >= minimum_size.width_px (80px)
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

const SCHEMA_PATH = path.join(ROOT_DIR, "config/schemas/banner_task.schema.json");
const TOKENS_PATH = path.join(ROOT_DIR, "config/brand_tokens.json");
const DEFAULT_TASK_PATH = path.join(__dirname, "sample_task.json");
const DEFAULT_OUT_DIR = path.join(__dirname, "out");

const DEFAULT_TOKENS = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
const BRAND_PALETTE = DEFAULT_TOKENS.colors.primary;

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

  const renderConfig = {
    width,
    height,
    layoutMode,
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
      cta: task.cta,
    },
  };

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
<body>
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

  function drawCoverImage(ctx, img, x, y, w, h) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = w / h;
    let drawW = w;
    let drawH = h;
    let offsetX = x;
    let offsetY = y;
    if (imgRatio > boxRatio) {
      drawW = h * imgRatio;
      offsetX = x - (drawW - w) / 2;
    } else {
      drawH = w / imgRatio;
      offsetY = y - (drawH - h) / 2;
    }
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
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
    drawRoundedRect(ctx, btnX, topY, btnW, btnH, 10);
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
    const pad = Math.max(44, CONFIG.clearSpace + 12);

    // 1. Environment plate background
    drawCoverImage(ctx, imgs.env, 0, 0, W, H);

    // Warm Linen directional scrim for left 40% text legibility
    const scrim = ctx.createLinearGradient(0, 0, W, 0);
    scrim.addColorStop(0, rgba(BRAND_PALETTE.warm_linen.rgb, 0.95));
    scrim.addColorStop(0.38, rgba(BRAND_PALETTE.warm_linen.rgb, 0.88));
    scrim.addColorStop(0.54, rgba(BRAND_PALETTE.warm_linen.rgb, 0.25));
    scrim.addColorStop(1, rgba(BRAND_PALETTE.warm_linen.rgb, 0.06));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // 2. Logo (top-left) & editorial award badge (top-right) with >= 30px clear space
    const logoW = Math.max(CONFIG.minLogoWidth, 148);
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, CONFIG.clearSpace + 8, logoW, logoH);

    drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, CONFIG.clearSpace + 4, 1);

    // 3. Right 60% Hero Plate + Mattress with Contact Shadow
    const rightZoneX = Math.round(W * 0.40);
    const rightZoneW = W - rightZoneX;
    const mattressW = Math.round(rightZoneW * 0.80);
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = Math.round(rightZoneX + (rightZoneW - mattressW) / 2);
    const mattressY = Math.round(H * 0.56 - mattressH / 2);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    // 4. Left 40% Text / CTA column
    const colX = pad;
    const colMaxW = Math.round(W * 0.40) - pad - 16;
    let cursorY = 175;

    ctx.fillStyle = BRAND_PALETTE.ocean_teal.hex;
    ctx.font = "700 15px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("DOMESTIC SANCTUARY · ZERO PRODUCT DRIFT", colX, cursorY);
    cursorY += 34;

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 56px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, colMaxW);
    cursorY = drawTextBlock(ctx, headlineLines, colX, cursorY, 64, "left");
    cursorY += 22;

    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 21px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, colMaxW);
    cursorY = drawTextBlock(ctx, subLines, colX, cursorY, 31, "left");
    cursorY += 34;

    const btn = drawCtaButton(ctx, CONFIG.task.cta.label, colX, cursorY, 20, 34, 15, false);
    cursorY = btn.y + btn.height + 20;

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "600 15px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      CONFIG.valuePropositions.sleep_trial + " · " + CONFIG.valuePropositions.warranty,
      colX,
      cursorY
    );
  }

  function renderSquare(ctx, imgs) {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const pad = Math.max(40, CONFIG.clearSpace + 10);

    // 1. Environment plate background
    drawCoverImage(ctx, imgs.env, 0, 0, W, H);

    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, rgba(BRAND_PALETTE.warm_linen.rgb, 0.90));
    scrim.addColorStop(0.28, rgba(BRAND_PALETTE.warm_linen.rgb, 0.48));
    scrim.addColorStop(0.62, rgba(BRAND_PALETTE.warm_linen.rgb, 0.62));
    scrim.addColorStop(1, rgba(BRAND_PALETTE.warm_linen.rgb, 0.95));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // 2. Top trust badge & logo (>= 30px clear space)
    const logoW = Math.max(CONFIG.minLogoWidth, 136);
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, CONFIG.clearSpace + 8, logoW, logoH);

    drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, CONFIG.clearSpace + 4, 1);

    // 3. Centered mattress (65% canvas width) with contact shadow
    const mattressW = Math.round(W * 0.65);
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = Math.round((W - mattressW) / 2);
    const mattressY = Math.round(H * 0.34);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    // 4. Bottom Headline & CTA
    const maxTextW = W - pad * 2;
    let cursorY = mattressY + mattressH + 74;

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 52px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, maxTextW);
    cursorY = drawTextBlock(ctx, headlineLines, W / 2, cursorY, 60, "center");
    cursorY += 16;

    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 21px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, maxTextW - 60).slice(0, 2);
    cursorY = drawTextBlock(ctx, subLines, W / 2, cursorY, 30, "center");
    cursorY += 28;

    drawCtaButton(ctx, CONFIG.task.cta.label, W / 2, cursorY, 22, 40, 16, true);
  }

  function renderMobile(ctx, imgs) {
    const W = CONFIG.width;
    const H = CONFIG.height;
    const pad = Math.max(48, CONFIG.clearSpace + 18);

    // 1. Environment plate background
    drawCoverImage(ctx, imgs.env, 0, 0, W, H);

    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, rgba(BRAND_PALETTE.warm_linen.rgb, 0.95));
    scrim.addColorStop(0.42, rgba(BRAND_PALETTE.warm_linen.rgb, 0.80));
    scrim.addColorStop(0.68, rgba(BRAND_PALETTE.warm_linen.rgb, 0.45));
    scrim.addColorStop(1, rgba(BRAND_PALETTE.warm_linen.rgb, 0.95));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // 2. Top Logo & Editorial Badge (>= 30px clear space)
    const logoW = Math.max(CONFIG.minLogoWidth, 160);
    const logoH = Math.round(logoW * (imgs.logo.naturalHeight / imgs.logo.naturalWidth));
    ctx.drawImage(imgs.logo, pad, CONFIG.clearSpace + 14, logoW, logoH);

    drawTrustBadgePill(ctx, imgs.badge, CONFIG.task.badge_text, W - pad, CONFIG.clearSpace + 10, 1.25);

    // 3. Top Headline & Subheadline
    const maxTextW = W - pad * 2;
    let cursorY = 190;

    ctx.fillStyle = BRAND_PALETTE.ocean_teal.hex;
    ctx.font = "700 22px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("DOMESTIC SANCTUARY · ZERO PRODUCT DRIFT", pad, cursorY);
    cursorY += 46;

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "700 72px " + CONFIG.typography.primary.font_family;
    const headlineLines = wrapLines(ctx, CONFIG.task.headline, maxTextW);
    cursorY = drawTextBlock(ctx, headlineLines, pad, cursorY, 84, "left");
    cursorY += 28;

    ctx.fillStyle = BRAND_PALETTE.onyx_black.hex;
    ctx.font = "400 30px " + CONFIG.typography.secondary.font_family;
    const subLines = wrapLines(ctx, CONFIG.task.subheadline, maxTextW);
    drawTextBlock(ctx, subLines, pad, cursorY, 44, "left");

    // 4. Middle Mattress with Contact Shadow
    const mattressW = Math.round(W * 0.86);
    const mattressH = Math.round(mattressW * (imgs.cutout.naturalHeight / imgs.cutout.naturalWidth));
    const mattressX = Math.round((W - mattressW) / 2);
    const mattressY = Math.round(H * 0.56 - mattressH / 2);
    const mattressBounds = { x: mattressX, y: mattressY, width: mattressW, height: mattressH };

    renderContactShadow(ctx, mattressBounds, BRAND_PALETTE);
    ctx.drawImage(imgs.cutout, mattressBounds.x, mattressBounds.y, mattressBounds.width, mattressBounds.height);

    // 5. Bottom CTA & Warranty
    const ctaY = H - 290;
    const btn = drawCtaButton(ctx, CONFIG.task.cta.label, W / 2, ctaY, 30, 56, 22, true);

    ctx.fillStyle = BRAND_PALETTE.navy_ink.hex;
    ctx.font = "600 24px " + CONFIG.typography.secondary.font_family;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      CONFIG.valuePropositions.sleep_trial + " · " + CONFIG.valuePropositions.warranty,
      W / 2,
      btn.y + btn.height + 32
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
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  const task = JSON.parse(fs.readFileSync(args.task, "utf-8"));

  validateAgainstSchema(task, schema);
  console.log(`[BannerEngine] Schema validated: ${task.campaign_id}`);

  const cutoutAbs = path.join(ROOT_DIR, task.mattress_cutout_path);
  const envAbs = path.join(ROOT_DIR, task.environment_bg_path);
  const logoAbs = path.join(ROOT_DIR, "assets/logos/Puffy_Logo_0.svg");
  const badgeAbs = path.join(ROOT_DIR, "assets/badges/ad_best_cooling_2026.svg");

  for (const requiredFile of [cutoutAbs, envAbs, logoAbs, badgeAbs]) {
    if (!fs.existsSync(requiredFile)) {
      throw new Error(`Required asset not found: ${path.relative(ROOT_DIR, requiredFile)}`);
    }
  }

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

const isMain =
  Boolean(process.argv[1]) && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(__filename);
if (isMain) {
  main();
}
