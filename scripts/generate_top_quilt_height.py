#!/usr/bin/env python3
"""Generate seamless 2048x2048 composite height & mask maps for top_quilt_cloud_diamond_v1.

CNC INDUSTRIAL LOGIC + 1/4 QUARTER CORNER ASTROIDS (0.4m x 0.4m -> 51.2 px/cm):
1. CENTER CLOUD: Exact vector cloud (`raster_cloud_cloud_mask.png`) embossed at +3.0mm
   with a cleanly trimmed 1.5cm (76.8 px) offset margin.
2. 4 QUARTER CORNER ASTROIDS:
   - Toroidally centered at (0.0, 0.0) so each tile corner holds strictly 1/4 of a
     concave astroid star diamond (`(|du|/R)^(2/3) + (|dv|/R)^(2/3) <= 1`).
   - Gentle recessed valley (-2.0mm depth) with soft pillowed stitch transition into
     the small diamond grid.
   - When tiled with RepeatWrapping, the 4 quarters merge into 1 complete concave astroid.
3. BASE DIAMOND GRID:
   - Clean 60°/120° repeating rhombus quilt grid (Nx=7, Ny=12 -> ~3.3-3.5cm cells, +1.5mm).
"""

import os
import numpy as np
from PIL import Image


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def edt_1d(f: np.ndarray) -> np.ndarray:
    """Exact 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher)."""
    n = f.shape[0]
    v = np.zeros(n, dtype=np.int32)
    z = np.zeros(n + 1, dtype=np.float32)
    k = 0
    v[0] = 0
    z[0] = -1e20
    z[1] = 1e20
    for q in range(1, n):
        while True:
            r = v[k]
            s = ((f[q] + q * q) - (f[r] + r * r)) / (2.0 * (q - r))
            if s <= z[k]:
                k -= 1
            else:
                break
        k += 1
        v[k] = q
        z[k] = s
        z[k + 1] = 1e20

    d = np.empty(n, dtype=np.float32)
    k = 0
    for q in range(n):
        while z[k + 1] < q:
            k += 1
        r = v[k]
        d[q] = (q - r) * (q - r) + f[r]
    return d


def euclidean_distance_2d(binary_mask: np.ndarray) -> np.ndarray:
    """Exact 2D Euclidean distance (in pixels) to True pixels in binary_mask."""
    inf = 1e12
    g = np.where(binary_mask, 0.0, inf).astype(np.float32)
    h, w = g.shape
    for y in range(h):
        g[y, :] = edt_1d(g[y, :])
    for x in range(w):
        g[:, x] = edt_1d(g[:, x])
    return np.sqrt(g)


def main() -> None:
    size = 2048
    px_per_cm = size / 40.0  # 51.2 px/cm (5.12 px/mm)
    out_dir = os.path.join("assets", "lego", "top_quilt", "masks")
    os.makedirs(out_dir, exist_ok=True)

    # 1. Load exact vector cloud mask (center)
    cloud_path = os.path.join(out_dir, "raster_cloud_cloud_mask.png")
    cloud_img = Image.open(cloud_path).convert("L").resize((size, size), Image.Resampling.LANCZOS)
    cloud_alpha = np.asarray(cloud_img, dtype=np.float32) / 255.0
    cloud_bin = cloud_alpha > 0.5

    dist_out_px = euclidean_distance_2d(cloud_bin)
    dist_in_px = euclidean_distance_2d(~cloud_bin)

    # 2. Perfect Industrial 60°/120° Diamond Grid (Nx=7, Ny=12 -> 60.5°/119.5°, ~3.3-3.5cm)
    u_1d = np.arange(size, dtype=np.float32) / float(size)
    v_1d = np.arange(size, dtype=np.float32) / float(size)
    u, v = np.meshgrid(u_1d, v_1d)

    nx, ny = 7.0, 12.0
    a = (u * nx + v * ny) % 1.0
    b = (u * nx - v * ny) % 1.0

    # Smooth spherical / cosine dome curve (+3.5mm peak, -3.0mm steep seam crevice)
    r_cell = np.clip(np.sqrt((a - 0.5) ** 2 + (b - 0.5) ** 2) / 0.5, 0.0, 1.0)
    cos_dome = np.power(np.clip(np.cos(r_cell * (np.pi * 0.5)), 0.0, 1.0), 0.72)

    # Narrow, steep seam groove plunging to -3.0mm for pronounced self-shadowing
    da = np.minimum(a, 1.0 - a)
    db = np.minimum(b, 1.0 - b)
    d_seam = np.minimum(da, db)
    seam_mask = smoothstep(0.0, 0.036, d_seam)
    seam_groove = np.exp(-(d_seam ** 2) / (2.0 * 0.018 ** 2))
    stitch_pulse = 0.5 + 0.5 * np.cos(2.0 * np.pi * (a + b) * 7.0)

    # Total displacement range: -3.0mm crevice -> +3.5mm spherical pillow peak
    h_grid_mm = -1.20 + 4.70 * cos_dome * (0.25 + 0.75 * seam_mask) - 1.80 * seam_groove * (0.75 + 0.25 * stitch_pulse)

    # 3. 1/4 Quarter Corner Astroids (toroidal center at (0.0, 0.0))
    du_k = ((u + 0.5) % 1.0) - 0.5
    dv_k = ((v + 0.5) % 1.0) - 0.5

    # Concave astroid curve: (|du|/R)^(2/3) + (|dv|/R)^(2/3) = 1
    R_ast = 0.165  # ~6.6cm semi-axis from corner -> 13.2cm full merged astroid
    r_ast = np.power(np.abs(du_k) / R_ast + 1e-6, 0.6667) + np.power(np.abs(dv_k) / R_ast + 1e-6, 0.6667)

    # Mask: 1 outside astroid, 0 inside astroid
    ast_outside = smoothstep(0.96, 1.04, r_ast)
    ast_inside = 1.0 - ast_outside

    # Soft pillowed stitch transition along the concave astroid arc (r_ast ~ 1.0)
    ast_stitch_crease = np.exp(-((r_ast - 1.0) ** 2) / (2.0 * 0.032 ** 2))

    # Gentle recessed valley (-3.0mm depth) with C1-smooth radial profile at tile edges
    r_radial = np.sqrt(du_k * du_k + dv_k * dv_k) / (R_ast * 0.72)
    bowl_smooth = 0.5 * (1.0 + np.cos(np.pi * np.clip(r_radial, 0.0, 1.0)))
    h_astroid_mm = -3.00 * bowl_smooth * ast_inside - 0.65 * ast_stitch_crease

    # 4. Clean Vector Cutout around center cloud (1.5cm = 76.8 px offset margin)
    yy, xx = np.mgrid[0:size, 0:size]
    hollow_interior = (((xx - 1000.0) / 145.0) ** 2 + ((yy - 1035.0) / 90.0) ** 2) < 1.0
    margin_px = 1.5 * px_per_cm  # 76.8 px
    cloud_grid_keep = smoothstep(margin_px - 3.0, margin_px + 3.0, dist_out_px) * (~hollow_interior).astype(np.float32)

    # Combine grid trims: keep diamond grid only outside cloud margin AND outside corner astroids
    grid_keep = cloud_grid_keep * ast_outside

    # Vector cloud embossed at +3.8mm
    max_in = max(float(np.max(dist_in_px)), 1.0)
    bevel_norm = np.clip(dist_in_px / (0.38 * max_in), 0.0, 1.0)
    cloud_dome = np.power(np.sin(bevel_norm * (np.pi * 0.5)), 0.55)
    h_cloud_mm = 3.80 * cloud_dome * cloud_alpha

    # Composite height in mm: [-3.0mm crevice/astroid ... 0.0mm base ... +3.5mm diamonds ... +3.8mm cloud]
    h_composite_mm = h_grid_mm * grid_keep + h_astroid_mm * (1.0 - ast_outside)
    h_composite_mm = h_composite_mm * (1.0 - cloud_alpha) + h_cloud_mm * cloud_alpha

    # 5. Micro-ribbed horizontal fabric grain (100% periodic)
    rib_horiz = 0.032 * np.sin(2.0 * np.pi * v * 280.0)
    rib_cross = 0.014 * np.sin(2.0 * np.pi * u * 340.0)
    h_composite_mm = h_composite_mm + rib_horiz + rib_cross

    # Normalize [-3.20mm, +3.85mm] -> [0.0, 1.0]
    h_norm = np.clip((h_composite_mm + 3.20) / 7.05, 0.0, 1.0)

    left_right_diff = float(np.max(np.abs(h_norm[:, 0] - h_norm[:, -1])))
    top_bottom_diff = float(np.max(np.abs(h_norm[0, :] - h_norm[-1, :])))
    print(f"Edge continuity check -> L/R max delta: {left_right_diff:.6f}, T/B max delta: {top_bottom_diff:.6f}")

    height_u8 = (h_norm * 255.0 + 0.5).astype(np.uint8)
    Image.fromarray(height_u8, mode="L").save(os.path.join(out_dir, "composite_height_2048.png"))

    tiled = np.tile(height_u8[::2, ::2], (2, 2))
    Image.fromarray(tiled, mode="L").save(os.path.join(out_dir, "height_2x2_tile_check.png"))
    print("Generated 1/4 quarter corner astroid + vector cloud height map in", out_dir)


if __name__ == "__main__":
    main()
