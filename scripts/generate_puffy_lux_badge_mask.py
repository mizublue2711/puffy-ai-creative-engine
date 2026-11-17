#!/usr/bin/env python3
"""
Generate Puffy Lux Badge Mask from Master Royal Assets.
Follows CAVP-v1.0 (Centralized Asset Vault Pipeline & Protocol).
"""

from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
MASKS_DIR = REPO_ROOT / "assets" / "lego" / "badges" / "masks"
BADGES_DIR = REPO_ROOT / "assets" / "lego" / "badges"
WEBAPP_BADGES_DIR = REPO_ROOT / "webapp" / "public" / "assets" / "lego" / "badges"


def build_lux_text_mask(width: int = 2048, height: int = 2048, supersample: int = 4) -> np.ndarray:
    sw = width * supersample
    sh = height * supersample
    sx = sw / 1600.0
    sy = sh / 800.0

    canvas = np.zeros((sh, sw), dtype=np.uint8)

    # Letter L: SVG (618..674, 484..580), stem width 15, base bar 15
    poly_l = np.array([
        [618.0, 484.0], [633.0, 484.0], [633.0, 565.0],
        [674.0, 565.0], [674.0, 580.0], [618.0, 580.0],
    ], dtype=np.float64)
    poly_l[:, 0] *= sx
    poly_l[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_l).astype(np.int32)], 255)

    # Letter U: SVG (764..836, 484..580), stem thickness 15, R=36, r=21
    kappa = 0.5522847498307935

    def sample_bezier(p0, p1, p2, p3, n=40):
        t = np.linspace(0, 1, n)[:, None]
        return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

    c_out1 = sample_bezier(
        np.array([764.0, 544.0]), np.array([764.0, 544.0 + 36.0 * kappa]),
        np.array([800.0 - 36.0 * kappa, 580.0]), np.array([800.0, 580.0])
    )
    c_out2 = sample_bezier(
        np.array([800.0, 580.0]), np.array([800.0 + 36.0 * kappa, 580.0]),
        np.array([836.0, 544.0 + 36.0 * kappa]), np.array([836.0, 544.0])
    )
    c_in1 = sample_bezier(
        np.array([821.0, 544.0]), np.array([821.0, 544.0 + 21.0 * kappa]),
        np.array([800.0 + 21.0 * kappa, 565.0]), np.array([800.0, 565.0])
    )
    c_in2 = sample_bezier(
        np.array([800.0, 565.0]), np.array([800.0 - 21.0 * kappa, 565.0]),
        np.array([779.0, 544.0 + 21.0 * kappa]), np.array([779.0, 544.0])
    )

    poly_u = np.vstack([
        [[764.0, 484.0]], c_out1, c_out2[1:], [[836.0, 484.0]],
        [[821.0, 484.0]], c_in1, c_in2[1:], [[779.0, 484.0]]
    ])
    poly_u[:, 0] *= sx
    poly_u[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_u).astype(np.int32)], 255)

    # Letter X: SVG (914..982, 484..580), stroke width 15
    bar1 = np.array([[914.0, 484.0], [931.0, 484.0], [982.0, 580.0], [965.0, 580.0]], dtype=np.float64)
    bar1[:, 0] *= sx
    bar1[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(bar1).astype(np.int32)], 255)

    bar2 = np.array([[982.0, 484.0], [965.0, 484.0], [914.0, 580.0], [931.0, 580.0]], dtype=np.float64)
    bar2[:, 0] *= sx
    bar2[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(bar2).astype(np.int32)], 255)

    return cv2.resize(canvas, (width, height), interpolation=cv2.INTER_AREA)

def generate_puffy_lux_badge_mask() -> dict[str, Path]:
    print("=" * 70)
    print("STEP 1: CREATING PUFFY LUX BADGE MASK FROM MASTER ROYAL ASSETS")
    print("=" * 70)

    border_path = MASKS_DIR / "mask_merrowed_border.png"
    puff_path = MASKS_DIR / "mask_puff_clouds.png"
    royal_path = MASKS_DIR / "mask_royal_text.png"

    for p in (border_path, puff_path, royal_path):
        if not p.is_file():
            raise FileNotFoundError(f"Missing master mask component: {p}")
        print(f"  [Found Base Asset] {p.name} ({p.stat().st_size:,} bytes)")

    img_border = Image.open(border_path).convert("L")
    img_puff = Image.open(puff_path).convert("L")
    img_royal = Image.open(royal_path).convert("L")

    arr_border = np.array(img_border)
    arr_puff = np.array(img_puff)
    arr_royal = np.array(img_royal)

    dim = arr_border.shape
    if dim != (2048, 2048) or arr_puff.shape != dim:
        raise ValueError(f"Unexpected mask dimensions: {dim}")
    print(f"  [Verified Dimensions] Canvas size: {dim[1]}x{dim[0]} px")

    print("  [Rendering Subbrand] Synthesizing bold geometric uppercase 'LUX'...")
    arr_lux_text = build_lux_text_mask(width=dim[1], height=dim[0], supersample=4)

    nz_lux = np.argwhere(arr_lux_text > 10)
    lux_y_min, lux_y_max = nz_lux[:, 0].min(), nz_lux[:, 0].max()
    lux_x_min, lux_x_max = nz_lux[:, 1].min(), nz_lux[:, 1].max()
    lux_center_x = (lux_x_min + lux_x_max) / 2.0
    print(
        f"  [LUX Metrics] Y: [{lux_y_min}, {lux_y_max}] (h={lux_y_max - lux_y_min + 1} px), "
        f"X: [{lux_x_min}, {lux_x_max}] (w={lux_x_max - lux_x_min + 1} px), "
        f"Center X: {lux_center_x:.1f} px"
    )

    # Composite Lux Badge RGBA:
    # Alpha: mask_patch_base (clean antialiased rounded rectangle cutout, transparent outside)
    base_path = MASKS_DIR / "mask_patch_base.png"
    arr_base = np.array(Image.open(base_path).convert("L")) if base_path.is_file() else (arr_border > 0).astype(np.uint8) * 255

    # Alpha channel: patch base rounded rectangle
    alpha_channel = arr_base.copy()

    # Twill fabric backing inside patch (#14161B)
    twill_path = MASKS_DIR / "twill_weave_height.png"
    twill_grain = np.array(Image.open(twill_path).convert("L")).astype(float) / 255.0 if twill_path.is_file() else np.zeros(dim)

    # Base fabric RGB: dark obsidian twill with subtle micro-weave
    fabric_base_r = np.clip(18.0 + twill_grain * 8.0, 0, 255)
    fabric_base_g = np.clip(20.0 + twill_grain * 8.0, 0, 255)
    fabric_base_b = np.clip(25.0 + twill_grain * 9.0, 0, 255)

    rgba = np.zeros((dim[0], dim[1], 4), dtype=np.uint8)
    inside_patch = (alpha_channel > 5)
    rgba[inside_patch, 0] = fabric_base_r[inside_patch].astype(np.uint8)
    rgba[inside_patch, 1] = fabric_base_g[inside_patch].astype(np.uint8)
    rgba[inside_patch, 2] = fabric_base_b[inside_patch].astype(np.uint8)
    rgba[:, :, 3] = alpha_channel

    # Blend Merrowed Overlock Border (Silver-slate thread #D2D8E2)
    border_norm = (arr_border.astype(float) / 255.0)[:, :, None]
    border_rgb = np.array([210.0, 216.0, 226.0], dtype=float)
    rgba[:, :, :3] = np.clip(rgba[:, :, :3].astype(float) * (1.0 - border_norm) + border_rgb * border_norm, 0, 255).astype(np.uint8)

    # Blend Puffy wordmark & cloud (Pure Satin White #F8FAFC)
    puff_norm = (arr_puff.astype(float) / 255.0)[:, :, None]
    puff_rgb = np.array([248.0, 250.0, 252.0], dtype=float)
    rgba[:, :, :3] = np.clip(rgba[:, :, :3].astype(float) * (1.0 - puff_norm) + puff_rgb * puff_norm, 0, 255).astype(np.uint8)

    # Blend LUX bold uppercase subbrand (Pure Satin White #FFFFFF)
    lux_norm = (arr_lux_text.astype(float) / 255.0)[:, :, None]
    lux_rgb = np.array([255.0, 255.0, 255.0], dtype=float)
    rgba[:, :, :3] = np.clip(rgba[:, :, :3].astype(float) * (1.0 - lux_norm) + lux_rgb * lux_norm, 0, 255).astype(np.uint8)

    # Re-enforce alpha: outside patch is 0
    rgba[~inside_patch, :] = 0

    lux_badge_rgba = Image.fromarray(rgba, mode="RGBA")


    out_lux_mask = MASKS_DIR / "puffy_lux_badge_mask.png"
    out_webapp_mask = WEBAPP_BADGES_DIR / "puffy_lux_badge_mask.png"
    out_lux_text = MASKS_DIR / "mask_lux_text.png"
    out_royal_mask = MASKS_DIR / "puffy_royal_badge_mask.png"

    lux_text_rgb = Image.fromarray(np.stack([arr_lux_text] * 3, axis=-1), mode="RGB")
    arr_royal_badge = np.maximum(arr_border, np.maximum(arr_puff, arr_royal))
    royal_badge_rgb = Image.fromarray(np.stack([arr_royal_badge] * 3, axis=-1), mode="RGB")

    lux_badge_rgba.save(out_lux_mask, format="PNG", optimize=True)
    lux_badge_rgba.save(out_webapp_mask, format="PNG", optimize=True)
    lux_text_rgb.save(out_lux_text, format="PNG", optimize=True)
    royal_badge_rgb.save(out_royal_mask, format="PNG", optimize=True)


    # Create master Lux SVG
    lux_master_svg_path = BADGES_DIR / "puffy_lux_badge_master.svg"
    royal_master_svg_path = BADGES_DIR / "puffy_royal_badge_master.svg"
    if royal_master_svg_path.is_file():
        royal_svg_content = royal_master_svg_path.read_text(encoding="utf-8")
        lux_group = """  <!-- Layer 4: Lower Tier - "LUX" Subbrand (Centered at x: 800, baseline y: 580, ~85px tracking) -->
  <g id="layer-lux-subbrand" filter="url(#embroideryRelief)">
    <!-- Letter L (x: 618..674) -->
    <path id="lux-letter-l" fill="url(#metallicGoldThread)" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 618 484 H 633 V 565 H 674 V 580 H 618 Z" />
    <path fill="url(#goldVerticalSheen)"
      d="M 618 484 H 633 V 565 H 674 V 580 H 618 Z" />

    <!-- Letter U (x: 764..836) -->
    <path id="lux-letter-u" fill="url(#metallicGoldThread)" fill-rule="evenodd" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 764 484 H 779 V 544 C 779 555.6 788.4 565 800 565 C 811.6 565 821 555.6 821 544 V 484 H 836 V 544 C 836 563.9 819.9 580 800 580 C 780.1 580 764 563.9 764 544 Z" />
    <path fill="url(#goldVerticalSheen)" fill-rule="evenodd"
      d="M 764 484 H 779 V 544 C 779 555.6 788.4 565 800 565 C 811.6 565 821 555.6 821 544 V 484 H 836 V 544 C 836 563.9 819.9 580 800 580 C 780.1 580 764 563.9 764 544 Z" />

    <!-- Letter X (x: 914..982) -->
    <path id="lux-letter-x" fill="url(#metallicGoldThread)" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 914 484 H 931 L 948 516 L 965 484 H 982 L 956.5 532 L 982 580 H 965 L 948 548 L 931 580 H 914 L 939.5 532 Z" />
    <path fill="url(#goldVerticalSheen)"
      d="M 914 484 H 931 L 948 516 L 965 484 H 982 L 956.5 532 L 982 580 H 965 L 948 548 L 931 580 H 914 L 939.5 532 Z" />
  </g>
</svg>"""
        lux_svg_content = re.sub(
            r'  <!-- Layer 4: Lower Tier - "ROYAL" Subbrand.*?<\/svg>',
            lux_group,
            royal_svg_content,
            flags=re.DOTALL,
        )
        lux_master_svg_path.write_text(lux_svg_content, encoding="utf-8")
        print(f"  [Master Vector] Created {lux_master_svg_path.relative_to(REPO_ROOT)}")

    for path in (out_lux_mask, out_webapp_mask):
        if not path.is_file():
            raise FileNotFoundError(f"Failed to generate target: {path}")
        im = Image.open(path)
        print(f"  [Verified Output] {path.relative_to(REPO_ROOT)} ({path.stat().st_size:,} bytes, {im.size}, mode={im.mode})")

    print("=" * 70)
    print("SUCCESS: PUFFY LUX BADGE MASK GENERATION COMPLETE")
    print("=" * 70)

    return {
        "primary_mask": out_lux_mask,
        "webapp_mirror": out_webapp_mask,
        "lux_text_mask": out_lux_text,
        "royal_mask": out_royal_mask,
        "master_svg": lux_master_svg_path,
    }


if __name__ == "__main__":
    generate_puffy_lux_badge_mask()

