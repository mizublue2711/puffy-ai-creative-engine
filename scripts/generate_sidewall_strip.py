#!/usr/bin/env python3
"""Generate seamless 2048x1024 4-tier composite PBR source maps for sidewall_strip_v1.

Architectural Hierarchy (Vertical V, clamped 0..1 top to bottom; Horizontal U, 100% seamless):
- Tier 1 (Top 5%,   v: 0.00 - 0.05): Braided houndstooth cross-weave piping cord (#3E4249, R=0.90)
- Tier 2 (Next 25%, v: 0.05 - 0.30): Deep Navy Suede/Velvet vertical fluted panels (#1B2A4A, R=0.85)
- Tier 3 (Next 5%,  v: 0.30 - 0.35): Middle braided accent piping cord (#3E4249, R=0.90)
- Tier 4 (Bot 65%,  v: 0.35 - 1.00): Matte Charcoal Quilted Diamond Panels (#2B2F36, R=0.80, dual-seam valleys)
"""

import os
import numpy as np
from PIL import Image


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def tileable_noise(w: int, h: int, seed: int = 42, sigma_u: float = 2.0) -> np.ndarray:
    """Generate horizontally seamless micro-grain noise in [0, 1]."""
    rng = np.random.default_rng(seed)
    n = rng.normal(0.0, 1.0, (h, w)).astype(np.float32)
    # Simple 3-tap horizontal & vertical smoothing for organic fabric nap
    n_blur = (
        0.25 * n
        + 0.1875 * (np.roll(n, 1, axis=1) + np.roll(n, -1, axis=1))
        + 0.1875 * (np.roll(n, 1, axis=0) + np.roll(n, -1, axis=0))
    )
    return np.clip(0.5 + 0.15 * n_blur * sigma_u, 0.0, 1.0)


def build_piping_tier(
    u: np.ndarray,
    t_v: np.ndarray,
    micro: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Braided houndstooth cross-weave piping cord (t_v in [0, 1])."""
    # Cylindrical cord profile across band height, tucking deeply at top & bottom seams
    cord_arc = np.clip(np.sin(np.pi * np.clip(t_v, 0.0, 1.0)), 0.0, 1.0) ** 0.55

    # Diagonal interlocking cross-weave (24 repeats in U -> 100% seamless)
    nu = 24.0
    nv = 2.0
    a = (u * nu + t_v * nv) % 1.0
    b = (u * nu - t_v * nv) % 1.0

    # Raised woven diamond cells
    da = np.abs(a - 0.5) * 2.0
    db = np.abs(b - 0.5) * 2.0
    cell_r = np.sqrt(da * da + db * db) / np.sqrt(2.0)
    braid_dome = np.clip(np.cos(np.clip(cell_r * 1.15, 0.0, 1.0) * (np.pi * 0.5)), 0.0, 1.0) ** 0.75

    # Cross-weave alternating strand highlight
    strand_a = np.cos(a * 2.0 * np.pi) * 0.5 + 0.5
    strand_b = np.cos(b * 2.0 * np.pi) * 0.5 + 0.5
    weave_relief = 0.55 * braid_dome + 0.45 * np.maximum(strand_a, strand_b)

    # Height in [0, 1]: deep tuck at seams, high thread displacement on cord
    height = cord_arc * (0.30 + 0.70 * weave_relief) + 0.03 * (micro - 0.5)

    # Delit albedo: Neutral Heather Grey / Braided Silver-Charcoal (#4B515D = 75, 81, 93)
    base_rgb = np.array([75.0, 81.0, 93.0], dtype=np.float32)
    strand_tint = 0.84 + 0.28 * weave_relief + 0.04 * (micro - 0.5)
    albedo = np.clip(base_rgb[None, None, :] * strand_tint[..., None], 22.0, 130.0)

    # Roughness: 0.90 matte braided cord, 0.94 in crevices
    roughness = np.clip(0.94 - 0.05 * weave_relief + 0.02 * (micro - 0.5), 0.85, 0.96)

    # Deep dark AO in braid crevices & top/bottom tuck seams
    seam_ao = smoothstep(0.0, 0.14, t_v) * smoothstep(1.0, 0.86, t_v)
    crevice_ao = 0.25 + 0.75 * (weave_relief ** 1.3)
    ao = np.clip(seam_ao * crevice_ao, 0.12, 1.0)

    return height, albedo, roughness, ao


def build_navy_flutes_tier(
    u: np.ndarray,
    t_v: np.ndarray,
    micro: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Deep Midnight Navy Suede/Velvet vertical fluted panels (#162238, R=0.85)."""
    # 4 vertical flutes per tile (100% seamless in U; ~5.4cm wide x ~9.8cm tall at repeat.x=10)
    n_flutes = 4.0
    fu = (u * n_flutes) % 1.0
    du = np.minimum(fu, 1.0 - fu)  # distance to flute seam in [0, 0.5]

    # Soft vertical cushion bulge with crisp recessed stitch channel
    pillow_u = smoothstep(0.015, 0.11, du)
    pillow_dome = (np.clip(np.sin(np.pi * np.clip((du - 0.015) / 0.485, 0.0, 1.0)), 0.0, 1.0) ** 0.30) * pillow_u

    # Thin vertical stitch groove
    groove = np.exp(-(du ** 2) / (2.0 * 0.014 ** 2))

    # Soft top/bottom tuck bevel where velvet meets piping
    tuck_v = smoothstep(0.0, 0.05, t_v) * smoothstep(1.0, 0.95, t_v)

    height = tuck_v * (0.28 + 0.68 * pillow_dome - 0.25 * groove) + 0.035 * (micro - 0.5)

    # Delit albedo (#18243B = 24, 36, 59) + subtle suede nap variation
    base_rgb = np.array([24.0, 36.0, 59.0], dtype=np.float32)
    nap = 0.94 + 0.12 * micro
    albedo = np.clip(base_rgb[None, None, :] * nap[..., None], 16.0, 95.0)

    # Roughness: 0.85 suede, 0.92 in stitch grooves
    roughness = np.clip(0.85 + 0.07 * groove + 0.03 * (micro - 0.5), 0.80, 0.94)

    # Deep dark AO in vertical stitch grooves & top/bottom piping seams
    seam_ao_v = smoothstep(0.0, 0.08, t_v) * smoothstep(1.0, 0.92, t_v)
    groove_ao = 1.0 - 0.82 * groove
    ao = np.clip((0.30 + 0.70 * seam_ao_v) * groove_ao, 0.14, 1.0)

    return height, albedo, roughness, ao


def build_charcoal_diamonds_tier(
    u: np.ndarray,
    t_v: np.ndarray,
    micro: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Matte Charcoal Quilted Diamond Panels (#2B2F36, R=0.80, +3.0mm bevel, dual-seam valleys)."""
    # Nx=4 integer for 100% seamless U; Ny=4.5 for equilateral ~5.3cm x 5.25cm diamonds at repeat.x=10
    nx = 4.0
    ny = 4.5
    a = (u * nx + t_v * ny) % 1.0
    b = (u * nx - t_v * ny) % 1.0

    da = np.minimum(a, 1.0 - a)
    db = np.minimum(b, 1.0 - b)
    d_seam = np.minimum(da, db)

    # Beveled diamond cushion (+3.0mm peak)
    bevel = smoothstep(0.042, 0.16, d_seam)
    # Soft pillow dome inside each diamond
    r_cell = np.clip(np.sqrt((a - 0.5) ** 2 + (b - 0.5) ** 2) / 0.5, 0.0, 1.0)
    dome = np.clip(np.cos(r_cell * (np.pi * 0.5)), 0.0, 1.0) ** 0.50
    cushion = bevel * (0.75 + 0.25 * dome)

    # Deep recessed dual-seam stitch valleys:
    # Two parallel stitch grooves at d_seam ~ 0.036 flanking a narrow raised central ridge at d_seam ~ 0.0
    dual_groove = np.exp(-((d_seam - 0.036) ** 2) / (2.0 * 0.009 ** 2))
    center_ridge = np.exp(-(d_seam ** 2) / (2.0 * 0.012 ** 2)) * 0.24
    stitch_pulse = 0.88 + 0.12 * np.cos(2.0 * np.pi * (a + b) * 14.0)

    # Top tuck under middle piping
    top_tuck = smoothstep(0.0, 0.025, t_v)
    bot_tuck = smoothstep(1.0, 0.985, t_v)

    height = (
        (0.32 + 0.65 * cushion + center_ridge - 0.30 * dual_groove * stitch_pulse)
        * (0.45 + 0.55 * top_tuck * bot_tuck)
        + 0.042 * (micro - 0.5)
    )

    # Delit albedo: Matte Charcoal Grey (#2E323A = 46, 50, 58, strictly in #2B2F36-#32363E)
    base_rgb = np.array([46.0, 50.0, 58.0], dtype=np.float32)
    weave_grain = 0.95 + 0.10 * micro
    albedo = np.clip(base_rgb[None, None, :] * weave_grain[..., None], 22.0, 80.0)

    # Roughness: 0.80 on diamond cushions, 0.90 in dual-seam valleys
    roughness = np.clip(0.80 + 0.10 * dual_groove + 0.025 * (micro - 0.5), 0.76, 0.92)

    # Deep dark AO in dual-seam stitch valleys & top piping tuck
    valley_ao = 1.0 - 0.85 * dual_groove - 0.35 * (1.0 - bevel) * (1.0 - center_ridge * 2.5)
    tuck_ao = 0.35 + 0.65 * top_tuck
    ao = np.clip(valley_ao * tuck_ao, 0.12, 1.0)

    return height, albedo, roughness, ao


def main() -> None:
    w, h = 2048, 1024
    out_dir = os.path.join("assets", "lego", "sidewall", "masks")
    os.makedirs(out_dir, exist_ok=True)

    u_1d = np.arange(w, dtype=np.float32) / float(w)
    v_1d = np.arange(h, dtype=np.float32) / float(h)
    u, v = np.meshgrid(u_1d, v_1d)

    micro = tileable_noise(w, h, seed=2026, sigma_u=1.8)

    # 5-Tier boundaries (with 3 full braided piping cords: Top, Middle, Bottom)
    t1_end = 0.05  # Cord 1: Top Edge (5%)
    t2_end = 0.30  # Navy Velvet Fluted Band (25%)
    t3_end = 0.35  # Cord 2: Middle Accent Cord (5%)
    t4_end = 0.95  # Charcoal Quilted Diamond Panels (60%)
    # 0.95 - 1.00: Cord 3: Bottom Edge (5%)

    height = np.zeros((h, w), dtype=np.float32)
    albedo = np.zeros((h, w, 3), dtype=np.float32)
    roughness = np.zeros((h, w), dtype=np.float32)
    ao = np.ones((h, w), dtype=np.float32)

    # Tier 1 (Cord 1): Top 5%
    m1 = v < t1_end
    tv1 = np.clip(v / t1_end, 0.0, 1.0)
    h1, a1, r1, ao1 = build_piping_tier(u, tv1, micro)

    # Tier 2: Navy Velvet Flutes (Next 25%)
    m2 = (v >= t1_end) & (v < t2_end)
    tv2 = np.clip((v - t1_end) / (t2_end - t1_end), 0.0, 1.0)
    h2, a2, r2, ao2 = build_navy_flutes_tier(u, tv2, micro)

    # Tier 3 (Cord 2): Middle 5%
    m3 = (v >= t2_end) & (v < t3_end)
    tv3 = np.clip((v - t2_end) / (t3_end - t2_end), 0.0, 1.0)
    h3, a3, r3, ao3 = build_piping_tier(u, tv3, micro)

    # Tier 4: Charcoal Quilted Diamonds (60%)
    m4 = (v >= t3_end) & (v < t4_end)
    tv4 = np.clip((v - t3_end) / (t4_end - t3_end), 0.0, 1.0)
    h4, a4, r4, ao4 = build_charcoal_diamonds_tier(u, tv4, micro)

    # Tier 5 (Cord 3): Bottom 5%
    m5 = v >= t4_end
    tv5 = np.clip((v - t4_end) / (1.0 - t4_end), 0.0, 1.0)
    h5, a5, r5, ao5 = build_piping_tier(u, tv5, micro)

    for mask, h_t, a_t, r_t, ao_t in [
        (m1, h1, a1, r1, ao1),
        (m2, h2, a2, r2, ao2),
        (m3, h3, a3, r3, ao3),
        (m4, h4, a4, r4, ao4),
        (m5, h5, a5, r5, ao5),
    ]:
        height[mask] = h_t[mask]
        albedo[mask] = a_t[mask]
        roughness[mask] = r_t[mask]
        ao[mask] = ao_t[mask]

    # Normalize height to [0, 1] and save 16-bit PNG for MaterialCraft/TextureCraft
    h_norm = np.clip(height, 0.0, 1.0)
    h_u16 = (h_norm * 65535.0).astype(np.uint16)
    Image.fromarray(h_u16).save(os.path.join(out_dir, "sidewall_height_2048x1024.png"))

    # Compute 100% horizontally seamless OpenGL (+Y up) tangent-space Normal map
    # Central difference with periodic wrap in U (axis=1) and clamped edge in V (axis=0)
    dx = (np.roll(h_norm, -1, axis=1) - np.roll(h_norm, 1, axis=1)) * 0.5
    h_pad_v = np.pad(h_norm, ((1, 1), (0, 0)), mode="edge")
    dy = (h_pad_v[2:, :] - h_pad_v[:-2, :]) * 0.5
    # Physical scale: 0.125m width / 2048 px vs 0.35m height / 1024 px
    # Strength tuned for crisp 3D relief with normalScale (2.0, 2.0) in Three.js
    strength_u = 8.0
    strength_v = 8.0
    nx_map = -dx * strength_u
    ny_map = dy * strength_v  # OpenGL +Y up (downward image dy > 0 means surface faces -Y, wait: top-to-bottom y increases downward, so dh/dy > 0 means height increases downward -> normal tilts -Y -> ny = +dy!)
    nz_map = np.ones_like(h_norm)
    inv_len = 1.0 / np.sqrt(nx_map * nx_map + ny_map * ny_map + nz_map * nz_map + 1e-8)
    n_rgb = np.dstack([
        (nx_map * inv_len * 0.5 + 0.5) * 255.0,
        (ny_map * inv_len * 0.5 + 0.5) * 255.0,
        (nz_map * inv_len * 0.5 + 0.5) * 255.0,
        np.full((h, w), 255.0, dtype=np.float32),
    ]).clip(0.0, 255.0).astype(np.uint8)
    Image.fromarray(n_rgb).save(os.path.join(out_dir, "sidewall_normal_2048x1024.png"))

    # Save sRGB BaseColor (RGBA, opaque)
    rgba = np.dstack([albedo.astype(np.uint8), np.full((h, w), 255, dtype=np.uint8)])
    Image.fromarray(rgba).save(os.path.join(out_dir, "sidewall_basecolor_2048x1024.png"))

    # Save Linear Roughness & AO (16-bit grayscale)
    r_u16 = (np.clip(roughness, 0.0, 1.0) * 65535.0).astype(np.uint16)
    Image.fromarray(r_u16).save(os.path.join(out_dir, "sidewall_roughness_2048x1024.png"))

    ao_u16 = (np.clip(ao, 0.0, 1.0) * 65535.0).astype(np.uint16)
    Image.fromarray(ao_u16).save(os.path.join(out_dir, "sidewall_ao_2048x1024.png"))

    # Save sRGB SheenColorMap so ONLY the Navy Velvet band gets blue/cyan rim scatter,
    # while Piping (#5C626E) and Charcoal Diamonds (#383C44) stay strictly neutral grey!
    sheen_rgb = np.zeros((h, w, 3), dtype=np.uint8)
    sheen_rgb[m1 | m3 | m5] = np.array([92, 98, 110], dtype=np.uint8)   # #5C626E neutral grey piping
    sheen_rgb[m2] = np.array([90, 127, 168], dtype=np.uint8)            # #5A7FA8 navy/cyan velvet sheen
    sheen_rgb[m4] = np.array([56, 60, 68], dtype=np.uint8)              # #383C44 neutral matte charcoal
    Image.fromarray(sheen_rgb).save(os.path.join(out_dir, "sidewall_sheencolor_2048x1024.png"))

    print("Generated 2048x1024 sidewall source maps in", out_dir)


if __name__ == "__main__":
    main()
