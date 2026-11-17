#!/usr/bin/env python3
"""
Generate Standard Tangent-Space Normal Maps for Puffy Lux & Cloud Badges.
Follows CAVP-v1.0 (Centralized Asset Vault Pipeline & Protocol).
"""

from __future__ import annotations

from pathlib import Path
import cv2
import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
MASKS_DIR = REPO_ROOT / "assets" / "lego" / "badges" / "masks"
WEBAPP_DIR = REPO_ROOT / "webapp" / "public" / "assets" / "lego" / "badges"


def build_embroidery_heightfield(
    text_mask: np.ndarray,
    border_mask: np.ndarray,
    puff_mask: np.ndarray,
    base_mask: np.ndarray,
    twill_grain: np.ndarray | None = None,
) -> np.ndarray:
    h, w = base_mask.shape
    heightfield = np.zeros((h, w), dtype=np.float64)

    # 1. Patch Base Plateau: rounded rectangle raised above mattress fabric
    base_bin = (base_mask > 20).astype(np.uint8) * 255
    base_dist = cv2.distanceTransform(base_bin, cv2.DIST_L2, 5)
    base_bevel = np.clip(base_dist / 12.0, 0.0, 1.0)
    base_plateau = np.sin(base_bevel * (np.pi / 2.0)) * 0.18
    heightfield = np.maximum(heightfield, base_plateau)

    # 2. Subtle twill weave grain on patch backing
    if twill_grain is not None:
        twill_relief = (twill_grain.astype(np.float64) / 255.0 - 0.5) * 0.02
        heightfield[base_bin > 0] += twill_relief[base_bin > 0]

    # 3. Merrowed Overlock Stitched Border: cylindrical raised bead
    border_bin = (border_mask > 20).astype(np.uint8) * 255
    border_dist = cv2.distanceTransform(border_bin, cv2.DIST_L2, 5)
    border_bevel = np.clip(border_dist / 14.0, 0.0, 1.0)
    border_ridge = 0.18 + np.sin(border_bevel * (np.pi / 2.0)) * 0.62
    heightfield = np.maximum(heightfield, border_ridge * (border_mask.astype(float) / 255.0))

    # 4. Upper Cursive "Puffy" + Cloud Emblem: domed satin stitch
    puff_bin = (puff_mask > 20).astype(np.uint8) * 255
    puff_dist = cv2.distanceTransform(puff_bin, cv2.DIST_L2, 5)
    puff_bevel = np.clip(puff_dist / 14.0, 0.0, 1.0)
    puff_dome = 0.18 + np.sin(puff_bevel * (np.pi / 2.0)) * 0.72
    heightfield = np.maximum(heightfield, puff_dome * (puff_mask.astype(float) / 255.0))

    # 5. Bold Subbrand Text ("LUX" / "CLOUD"): domed satin stitch
    text_bin = (text_mask > 20).astype(np.uint8) * 255
    text_dist = cv2.distanceTransform(text_bin, cv2.DIST_L2, 5)
    text_bevel = np.clip(text_dist / 14.0, 0.0, 1.0)
    text_dome = 0.18 + np.sin(text_bevel * (np.pi / 2.0)) * 0.76
    heightfield = np.maximum(heightfield, text_dome * (text_mask.astype(float) / 255.0))

    heightfield = cv2.GaussianBlur(heightfield, (3, 3), 0.8)
    return np.clip(heightfield, 0.0, 1.0)


def heightfield_to_normal_map(height: np.ndarray, strength: float = 0.18) -> np.ndarray:
    dh_dx = cv2.Sobel(height, cv2.CV_64F, 1, 0, ksize=5) * strength
    dh_dy = cv2.Sobel(height, cv2.CV_64F, 0, 1, ksize=5) * strength

    nx = -dh_dx
    ny = dh_dy
    nz = np.ones_like(nx)

    length = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx /= length
    ny /= length
    nz /= length

    r = np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    g = np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    b = np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)

    return np.stack([r, g, b], axis=-1)


def generate_badge_normal_maps() -> None:
    print("=" * 70)
    print("STEP 5: GENERATING TANGENT-SPACE NORMAL MAPS FOR LUX & CLOUD BADGES")
    print("=" * 70)

    WEBAPP_DIR.mkdir(parents=True, exist_ok=True)
    MASKS_DIR.mkdir(parents=True, exist_ok=True)

    base_mask = np.array(Image.open(MASKS_DIR / "mask_patch_base.png").convert("L"))
    border_mask = np.array(Image.open(MASKS_DIR / "mask_merrowed_border.png").convert("L"))
    puff_mask = np.array(Image.open(MASKS_DIR / "mask_puff_clouds.png").convert("L"))
    twill_grain = np.array(Image.open(MASKS_DIR / "twill_weave_height.png").convert("L"))

    # 1. LUX BADGE NORMAL MAP
    print("  [Processing LUX] Building embossed heightfield and normal map...")
    lux_text_mask = np.array(Image.open(MASKS_DIR / "mask_lux_text.png").convert("L"))
    lux_height = build_embroidery_heightfield(
        lux_text_mask, border_mask, puff_mask, base_mask, twill_grain
    )
    lux_normal = heightfield_to_normal_map(lux_height, strength=0.18)

    lux_out_webapp = WEBAPP_DIR / "puffy_lux_badge_normal.png"
    lux_out_masks = MASKS_DIR / "puffy_lux_badge_normal.png"
    Image.fromarray(lux_normal, mode="RGB").save(lux_out_webapp, format="PNG", optimize=True)
    Image.fromarray(lux_normal, mode="RGB").save(lux_out_masks, format="PNG", optimize=True)
    print(f"  [Created] {lux_out_webapp.relative_to(REPO_ROOT)} ({lux_out_webapp.stat().st_size:,} bytes)")

    # 2. CLOUD BADGE NORMAL MAP
    print("  [Processing CLOUD] Building embossed heightfield and normal map...")
    cloud_text_mask = np.array(Image.open(MASKS_DIR / "mask_cloud_text.png").convert("L"))
    cloud_height = build_embroidery_heightfield(
        cloud_text_mask, border_mask, puff_mask, base_mask, twill_grain
    )
    cloud_normal = heightfield_to_normal_map(cloud_height, strength=0.18)

    cloud_out_webapp = WEBAPP_DIR / "puffy_cloud_badge_normal.png"
    cloud_out_masks = MASKS_DIR / "puffy_cloud_badge_normal.png"
    Image.fromarray(cloud_normal, mode="RGB").save(cloud_out_webapp, format="PNG", optimize=True)
    Image.fromarray(cloud_normal, mode="RGB").save(cloud_out_masks, format="PNG", optimize=True)
    print(f"  [Created] {cloud_out_webapp.relative_to(REPO_ROOT)} ({cloud_out_webapp.stat().st_size:,} bytes)")

    # Verification checks
    for p in (lux_out_webapp, cloud_out_webapp):
        im = Image.open(p)
        arr = np.array(im)
        print(f"  [Verified] {p.name}: size={im.size}, mode={im.mode}, "
              f"R=[{arr[:,:,0].min()}, {arr[:,:,0].max()}], "
              f"G=[{arr[:,:,1].min()}, {arr[:,:,1].max()}], "
              f"B=[{arr[:,:,2].min()}, {arr[:,:,2].max()}]")

    print("=" * 70)
    print("SUCCESS: LUX & CLOUD NORMAL MAPS GENERATED SUCCESSFULLY")
    print("=" * 70)


if __name__ == "__main__":
    generate_badge_normal_maps()
