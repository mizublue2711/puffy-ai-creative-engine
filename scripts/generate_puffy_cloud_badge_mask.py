#!/usr/bin/env python3
"""
Generate Puffy Cloud Badge Mask from Master Royal Assets.
Follows CAVP-v1.0 (Centralized Asset Vault Pipeline & Protocol).

1. Reads Royal master mask components from assets/lego/badges/masks/:
   - mask_merrowed_border.png (outer rounded-rectangle stitched frame)
   - mask_puff_clouds.png (upper cursive "Puffy" + cloud graphic)
   - mask_royal_text.png (bottom text word "ROYAL")
2. Synthesizes authentic bold geometric uppercase "CLOUD" wordmark:
   - Replaces bottom text word "ROYAL" while keeping outer frame and upper Puffy+cloud 100% intact.
   - Exact 2048x2048 canvas, perfectly centered at X=1024.
   - Matching stroke weight (15 SVG units = 19.2 px), cap-height (96 SVG units = 245.8 px), baseline (580 SVG units = 1484.8 px), and ~85px tracking.
3. Saves resulting mask to:
   - assets/lego/badges/masks/puffy_cloud_badge_mask.png
   - webapp/public/assets/lego/badges/puffy_cloud_badge_mask.png
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
MASKS_DIR = REPO_ROOT / "assets" / "lego" / "badges" / "masks"
BADGES_DIR = REPO_ROOT / "assets" / "lego" / "badges"
WEBAPP_BADGES_DIR = REPO_ROOT / "webapp" / "public" / "assets" / "lego" / "badges"


def build_cloud_text_mask(width: int = 2048, height: int = 2048, supersample: int = 4) -> np.ndarray:
    sw = width * supersample
    sh = height * supersample
    sx = sw / 1600.0
    sy = sh / 800.0

    canvas = np.zeros((sh, sw), dtype=np.uint8)
    kappa = 0.5522847498307935

    def sample_bezier(p0, p1, p2, p3, n=30):
        t = np.linspace(0, 1, n)[:, None]
        return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

    # Letter C: SVG [458, 530], center 496, y in [482, 582]
    c_out1 = sample_bezier(np.array([529.3, 508.0]), np.array([522.0, 482.0]), np.array([511.0, 482.0]), np.array([496.0, 482.0]))
    c_out2 = sample_bezier(np.array([496.0, 482.0]), np.array([496.0 - 38*kappa, 482.0]), np.array([458.0, 532.0 - 50*kappa]), np.array([458.0, 532.0]))
    c_out3 = sample_bezier(np.array([458.0, 532.0]), np.array([458.0, 532.0 + 50*kappa]), np.array([496.0 - 38*kappa, 582.0]), np.array([496.0, 582.0]))
    c_out4 = sample_bezier(np.array([496.0, 582.0]), np.array([511.0, 582.0]), np.array([522.0, 582.0]), np.array([529.3, 556.0]))

    c_in1 = sample_bezier(np.array([512.7, 556.0]), np.array([507.0, 567.0]), np.array([502.0, 567.0]), np.array([496.0, 567.0]))
    c_in2 = sample_bezier(np.array([496.0, 567.0]), np.array([496.0 - 23*kappa, 567.0]), np.array([473.0, 532.0 + 35*kappa]), np.array([473.0, 532.0]))
    c_in3 = sample_bezier(np.array([473.0, 532.0]), np.array([473.0, 532.0 - 35*kappa]), np.array([496.0 - 23*kappa, 497.0]), np.array([496.0, 497.0]))
    c_in4 = sample_bezier(np.array([496.0, 497.0]), np.array([502.0, 497.0]), np.array([507.0, 497.0]), np.array([512.7, 508.0]))

    poly_c = np.vstack([c_out1, c_out2[1:], c_out3[1:], c_out4[1:], c_in1, c_in2[1:], c_in3[1:], c_in4[1:]])
    poly_c[:, 0] *= sx
    poly_c[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_c).astype(np.int32)], 255)

    # Letter L: SVG [614, 670], [484, 580]
    poly_l = np.array([
        [614.0, 484.0], [629.0, 484.0], [629.0, 565.0],
        [670.0, 565.0], [670.0, 580.0], [614.0, 580.0]
    ], dtype=np.float64)
    poly_l[:, 0] *= sx
    poly_l[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_l).astype(np.int32)], 255)

    # Letter O: center (793, 532), Rx=38, Ry=50, rx=23, ry=35
    cv2.ellipse(canvas, (int(round(793.0*sx)), int(round(532.0*sy))), (int(round(38.0*sx)), int(round(50.0*sy))), 0, 0, 360, 255, -1)
    cv2.ellipse(canvas, (int(round(793.0*sx)), int(round(532.0*sy))), (int(round(23.0*sx)), int(round(35.0*sy))), 0, 0, 360, 0, -1)

    # Letter U: SVG [916, 988], center 952
    u_out1 = sample_bezier(np.array([916.0, 544.0]), np.array([916.0, 544.0 + 36.0 * kappa]), np.array([952.0 - 36.0 * kappa, 580.0]), np.array([952.0, 580.0]))
    u_out2 = sample_bezier(np.array([952.0, 580.0]), np.array([952.0 + 36.0 * kappa, 580.0]), np.array([988.0, 544.0 + 36.0 * kappa]), np.array([988.0, 544.0]))
    u_in1 = sample_bezier(np.array([973.0, 544.0]), np.array([973.0, 544.0 + 21.0 * kappa]), np.array([952.0 + 21.0 * kappa, 565.0]), np.array([952.0, 565.0]))
    u_in2 = sample_bezier(np.array([952.0, 565.0]), np.array([952.0 - 21.0 * kappa, 565.0]), np.array([931.0, 544.0 + 21.0 * kappa]), np.array([931.0, 544.0]))
    poly_u = np.vstack([[[916.0, 484.0]], u_out1, u_out2[1:], [[988.0, 484.0]], [[973.0, 484.0]], u_in1, u_in2[1:], [[931.0, 484.0]]])
    poly_u[:, 0] *= sx
    poly_u[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_u).astype(np.int32)], 255)

    # Letter D: SVG [1072, 1142]
    d_out1 = sample_bezier(np.array([1104.0, 484.0]), np.array([1104.0 + 38.0*kappa, 484.0]), np.array([1142.0, 532.0 - 48.0*kappa]), np.array([1142.0, 532.0]))
    d_out2 = sample_bezier(np.array([1142.0, 532.0]), np.array([1142.0, 532.0 + 48.0*kappa]), np.array([1104.0 + 38.0*kappa, 580.0]), np.array([1104.0, 580.0]))
    poly_d_outer = np.vstack([[[1072.0, 484.0]], d_out1, d_out2[1:], [[1072.0, 580.0]]])
    poly_d_outer[:, 0] *= sx
    poly_d_outer[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_d_outer).astype(np.int32)], 255)

    d_in1 = sample_bezier(np.array([1104.0, 499.0]), np.array([1104.0 + 23.0*kappa, 499.0]), np.array([1127.0, 532.0 - 33.0*kappa]), np.array([1127.0, 532.0]))
    d_in2 = sample_bezier(np.array([1127.0, 532.0]), np.array([1127.0, 532.0 + 33.0*kappa]), np.array([1104.0 + 23.0*kappa, 565.0]), np.array([1104.0, 565.0]))
    poly_d_inner = np.vstack([[[1087.0, 499.0]], d_in1, d_in2[1:], [[1087.0, 565.0]]])
    poly_d_inner[:, 0] *= sx
    poly_d_inner[:, 1] *= sy
    cv2.fillPoly(canvas, [np.round(poly_d_inner).astype(np.int32)], 0)

    return cv2.resize(canvas, (width, height), interpolation=cv2.INTER_AREA)


def generate_puffy_cloud_badge_mask() -> dict[str, Path]:
    print("=" * 70)
    print("STEP 3: CREATING PUFFY CLOUD BADGE MASK FROM MASTER ROYAL ASSETS")
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

    print("  [Rendering Subbrand] Synthesizing bold geometric uppercase 'CLOUD'...")
    arr_cloud_text = build_cloud_text_mask(width=dim[1], height=dim[0], supersample=4)

    nz_cloud = np.argwhere(arr_cloud_text > 10)
    cloud_y_min, cloud_y_max = nz_cloud[:, 0].min(), nz_cloud[:, 0].max()
    cloud_x_min, cloud_x_max = nz_cloud[:, 1].min(), nz_cloud[:, 1].max()
    cloud_center_x = (cloud_x_min + cloud_x_max) / 2.0
    print(
        f"  [CLOUD Metrics] Y: [{cloud_y_min}, {cloud_y_max}] (h={cloud_y_max - cloud_y_min + 1} px), "
        f"X: [{cloud_x_min}, {cloud_x_max}] (w={cloud_x_max - cloud_x_min + 1} px), "
        f"Center X: {cloud_center_x:.1f} px"
    )

    # Composite Cloud Badge RGBA matching Lux / Royal protocol:
    base_path = MASKS_DIR / "mask_patch_base.png"
    arr_base = np.array(Image.open(base_path).convert("L")) if base_path.is_file() else (arr_border > 0).astype(np.uint8) * 255

    alpha_channel = arr_base.copy()

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

    # Blend CLOUD bold uppercase subbrand (Pure Satin White #FFFFFF)
    cloud_norm = (arr_cloud_text.astype(float) / 255.0)[:, :, None]
    cloud_rgb = np.array([255.0, 255.0, 255.0], dtype=float)
    rgba[:, :, :3] = np.clip(rgba[:, :, :3].astype(float) * (1.0 - cloud_norm) + cloud_rgb * cloud_norm, 0, 255).astype(np.uint8)

    rgba[~inside_patch, :] = 0

    cloud_badge_rgba = Image.fromarray(rgba, mode="RGBA")
    cloud_text_rgb = Image.fromarray(np.stack([arr_cloud_text] * 3, axis=-1), mode="RGB")


    MASKS_DIR.mkdir(parents=True, exist_ok=True)
    WEBAPP_BADGES_DIR.mkdir(parents=True, exist_ok=True)

    out_cloud_mask = MASKS_DIR / "puffy_cloud_badge_mask.png"
    out_webapp_mask = WEBAPP_BADGES_DIR / "puffy_cloud_badge_mask.png"
    out_cloud_text = MASKS_DIR / "mask_cloud_text.png"

    cloud_badge_rgba.save(out_cloud_mask, format="PNG", optimize=True)
    cloud_badge_rgba.save(out_webapp_mask, format="PNG", optimize=True)
    cloud_text_rgb.save(out_cloud_text, format="PNG", optimize=True)

    # Create master Cloud SVG
    cloud_master_svg_path = BADGES_DIR / "puffy_cloud_badge_master.svg"
    royal_master_svg_path = BADGES_DIR / "puffy_royal_badge_master.svg"
    if royal_master_svg_path.is_file():
        royal_svg_content = royal_master_svg_path.read_text(encoding="utf-8")
        cloud_group = """  <!-- Layer 4: Lower Tier - "CLOUD" Subbrand (Centered at x: 800, baseline y: 580, ~85px tracking) -->
  <g id="layer-cloud-subbrand" filter="url(#embroideryRelief)">
    <!-- Letter C (x: 458..530) -->
    <path id="cloud-letter-c" fill="url(#metallicGoldThread)" fill-rule="evenodd" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 529.3 508 C 522 491 511 482 496 482 C 474 482 458 502 458 532 C 458 562 474 582 496 582 C 511 582 522 573 529.3 556 H 512.7 C 507 563 502 567 496 567 C 482 567 473 553 473 532 C 473 511 482 497 496 497 C 502 497 507 501 512.7 508 Z" />
    <path fill="url(#goldVerticalSheen)" fill-rule="evenodd"
      d="M 529.3 508 C 522 491 511 482 496 482 C 474 482 458 502 458 532 C 458 562 474 582 496 582 C 511 582 522 573 529.3 556 H 512.7 C 507 563 502 567 496 567 C 482 567 473 553 473 532 C 473 511 482 497 496 497 C 502 497 507 501 512.7 508 Z" />

    <!-- Letter L (x: 614..670) -->
    <path id="cloud-letter-l" fill="url(#metallicGoldThread)" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 614 484 H 629 V 565 H 670 V 580 H 614 Z" />
    <path fill="url(#goldVerticalSheen)"
      d="M 614 484 H 629 V 565 H 670 V 580 H 614 Z" />

    <!-- Letter O (x: 755..831) -->
    <path id="cloud-letter-o" fill="url(#metallicGoldThread)" fill-rule="evenodd" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5"
      d="M 793 482 C 815 482 831 502 831 532 C 831 562 815 582 793 582 C 771 582 755 562 755 532 C 755 502 771 482 793 482 Z M 793 497 C 779 497 770 511 770 532 C 770 553 779 567 793 567 C 807 567 816 553 816 532 C 816 511 807 497 793 497 Z" />
    <path fill="url(#goldVerticalSheen)" fill-rule="evenodd"
      d="M 793 482 C 815 482 831 502 831 532 C 831 562 815 582 793 582 C 771 582 755 562 755 532 C 755 502 771 482 793 482 Z M 793 497 C 779 497 770 511 770 532 C 770 553 779 567 793 567 C 807 567 816 553 816 532 C 816 511 807 497 793 497 Z" />

    <!-- Letter U (x: 916..988) -->
    <path id="cloud-letter-u" fill="url(#metallicGoldThread)" fill-rule="evenodd" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 916 484 H 931 V 544 C 931 555.6 940.4 565 952 565 C 963.6 565 973 555.6 973 544 V 484 H 988 V 544 C 988 563.9 971.9 580 952 580 C 932.1 580 916 563.9 916 544 Z" />
    <path fill="url(#goldVerticalSheen)" fill-rule="evenodd"
      d="M 916 484 H 931 V 544 C 931 555.6 940.4 565 952 565 C 963.6 565 973 555.6 973 544 V 484 H 988 V 544 C 988 563.9 971.9 580 952 580 C 932.1 580 916 563.9 916 544 Z" />

    <!-- Letter D (x: 1072..1142) -->
    <path id="cloud-letter-d" fill="url(#metallicGoldThread)" fill-rule="evenodd" stroke="#FEF08A" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"
      d="M 1072 484 H 1104 C 1126 484 1142 502 1142 532 C 1142 562 1126 580 1104 580 H 1072 Z M 1087 499 V 565 H 1104 C 1118 565 1127 553 1127 532 C 1127 511 1118 499 1104 499 Z" />
    <path fill="url(#goldVerticalSheen)" fill-rule="evenodd"
      d="M 1072 484 H 1104 C 1126 484 1142 502 1142 532 C 1142 562 1126 580 1104 580 H 1072 Z M 1087 499 V 565 H 1104 C 1118 565 1127 553 1127 532 C 1127 511 1118 499 1104 499 Z" />
  </g>
</svg>"""
        cloud_svg_content = re.sub(
            r'  <!-- Layer 4: Lower Tier - "ROYAL" Subbrand.*?<\/svg>',
            cloud_group,
            royal_svg_content,
            flags=re.DOTALL,
        )
        cloud_master_svg_path.write_text(cloud_svg_content, encoding="utf-8")
        print(f"  [Master Vector] Created {cloud_master_svg_path.relative_to(REPO_ROOT)}")

    for path in (out_cloud_mask, out_webapp_mask):
        if not path.is_file():
            raise FileNotFoundError(f"Failed to generate target: {path}")
        im = Image.open(path)
        print(f"  [Verified Output] {path.relative_to(REPO_ROOT)} ({path.stat().st_size:,} bytes, {im.size}, mode={im.mode})")

    print("=" * 70)
    print("SUCCESS: PUFFY CLOUD BADGE MASK GENERATION COMPLETE")
    print("=" * 70)

    return {
        "primary_mask": out_cloud_mask,
        "webapp_mirror": out_webapp_mask,
        "cloud_text_mask": out_cloud_text,
        "master_svg": cloud_master_svg_path,
    }


if __name__ == "__main__":
    generate_puffy_cloud_badge_mask()
