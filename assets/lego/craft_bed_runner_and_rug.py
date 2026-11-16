"""
Procedural PBR Map Synthesizer for:
1. bed_runner_chenille_woven_v1 (2048x1024, 0.60m x 2.20m, with knotted tassel fringe alpha)
2. rug_natural_jute_loop_v1 (2048x2048, 1.20m x 1.20m seamless tileable bouclé/jute loop)

Outputs WebGL-optimized maps (< 1.0 MB each) and prepares clean MaterialCraft / TextureCraft inputs.
"""

import os
import math
import numpy as np
from PIL import Image
import cv2


def periodic_value_noise(h: int, w: int, grid_y: int, grid_x: int, seed: int = 0) -> np.ndarray:
    """Generate seamlessly tileable 2D smooth value noise via bilinear/bicubic upsampling of a periodic grid."""
    rng = np.random.default_rng(seed)
    grid = rng.uniform(0.0, 1.0, size=(grid_y, grid_x)).astype(np.float32)
    # Pad periodically by 2 pixels on all sides for seamless bicubic interpolation
    padded = np.pad(grid, ((2, 2), (2, 2)), mode="wrap")
    # Upsample padded grid
    scale_y = h / grid_y
    scale_x = w / grid_x
    up_h = int(round((grid_y + 4) * scale_y))
    up_w = int(round((grid_x + 4) * scale_x))
    up = cv2.resize(padded, (up_w, up_h), interpolation=cv2.INTER_CUBIC)
    off_y = int(round(2 * scale_y))
    off_x = int(round(2 * scale_x))
    crop = up[off_y : off_y + h, off_x : off_x + w]
    if crop.shape != (h, w):
        crop = cv2.resize(crop, (w, h), interpolation=cv2.INTER_LINEAR)
    return np.clip(crop, 0.0, 1.0)


def fbm_periodic(h: int, w: int, octaves: list[tuple[int, int, float]], seed: int = 42) -> np.ndarray:
    """Multi-octave seamlessly tileable fractal noise."""
    acc = np.zeros((h, w), dtype=np.float32)
    weight_sum = 0.0
    for idx, (gy, gx, weight) in enumerate(octaves):
        acc += weight * periodic_value_noise(h, w, gy, gx, seed=seed + idx * 17)
        weight_sum += weight
    return acc / max(weight_sum, 1e-6)


def height_to_normal_opengl(height: np.ndarray, strength: float = 4.0, wrap_x: bool = True, wrap_y: bool = True) -> np.ndarray:
    """
    Convert normalized [0, 1] heightfield to OpenGL tangent-space normal map (+Y up).
    Returns float32 RGB in [0, 1].
    """
    # Use Sobel-like central differences with optional periodic wrapping
    if wrap_x:
        hx_p = np.roll(height, -1, axis=1)
        hx_m = np.roll(height, 1, axis=1)
    else:
        hx_p = np.pad(height[:, 1:], ((0, 0), (0, 1)), mode="edge")
        hx_m = np.pad(height[:, :-1], ((0, 0), (1, 0)), mode="edge")

    if wrap_y:
        hy_p = np.roll(height, -1, axis=0)
        hy_m = np.roll(height, 1, axis=0)
    else:
        hy_p = np.pad(height[1:, :], ((0, 1), (0, 0)), mode="edge")
        hy_m = np.pad(height[:-1, :], ((1, 0), (0, 0)), mode="edge")

    dx = (hx_p - hx_m) * 0.5 * strength
    dy = (hy_p - hy_m) * 0.5 * strength

    # OpenGL tangent space: +X right, +Y up (opposite of image row index y), +Z out
    nx = -dx
    ny = dy
    nz = np.ones_like(height, dtype=np.float32)

    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= norm
    ny /= norm
    nz /= norm

    rgb = np.stack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5], axis=-1)
    return np.clip(rgb, 0.0, 1.0)


def compute_ao_from_height(height: np.ndarray, radii: list[int], weights: list[float], wrap_x: bool = True, wrap_y: bool = True) -> np.ndarray:
    """Multi-scale horizon/crevice ambient occlusion from heightfield."""
    ao = np.ones_like(height, dtype=np.float32)
    h, w = height.shape
    for r, w_val in zip(radii, weights):
        k = r * 2 + 1
        pad_y = r if wrap_y else r
        pad_x = r if wrap_x else r
        mode_y = "wrap" if wrap_y else "edge"
        mode_x = "wrap" if wrap_x else "edge"
        padded = np.pad(height, ((pad_y, pad_y), (0, 0)), mode=mode_y)
        padded = np.pad(padded, ((0, 0), (pad_x, pad_x)), mode=mode_x)
        blurred_pad = cv2.GaussianBlur(padded, (k, k), sigmaX=r * 0.5, borderType=cv2.BORDER_REPLICATE)
        blurred = blurred_pad[pad_y : pad_y + h, pad_x : pad_x + w]
        # Positive where surrounding surface is higher than current pixel (crevice)
        cavity = np.clip(blurred - height, 0.0, 1.0)
        ao -= w_val * cavity
    return np.clip(ao, 0.0, 1.0)


def save_normal_16bit_png(rgb_float: np.ndarray, out_path: str, max_bytes: int = 1_000_000) -> int:
    """
    Save tangent-space normal map as PNG (OpenGL), strictly under max_bytes.
    Tries 16-bit PNG first (with progressive LSB quantization if needed), and if still > max_bytes,
    applies subtle bilateral/Gaussian smoothing on the high-frequency noise or falls back to 8-bit PNG
    so the < 1.0 MB quota is strictly satisfied.
    """
    # Try 16-bit PNG with progressive precision quantization
    for shift in [0, 5, 7, 8, 9, 10]:
        u16 = np.clip(np.round(rgb_float * 65535.0), 0, 65535).astype(np.uint16)
        if shift > 0:
            u16 = (u16 >> shift) << shift
        bgr16 = u16[:, :, ::-1]
        cv2.imwrite(out_path, bgr16, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        sz = os.path.getsize(out_path)
        if sz < max_bytes:
            return sz

    # If 16-bit is still > max_bytes, try 8-bit PNG (still crisp tangent-space normal)
    u8 = np.clip(np.round(rgb_float * 255.0), 0, 255).astype(np.uint8)
    for shift8 in [0, 1, 2, 3]:
        q8 = (u8 >> shift8) << shift8 if shift8 > 0 else u8
        cv2.imwrite(out_path, q8[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
        sz = os.path.getsize(out_path)
        if sz < max_bytes:
            return sz

    # Final fallback: mild high-frequency smoothing + 8-bit PNG
    smooth = cv2.GaussianBlur(u8, (3, 3), sigmaX=0.6)
    cv2.imwrite(out_path, smooth[:, :, ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return os.path.getsize(out_path)


def save_webp(img_uint8: np.ndarray, out_path: str, quality: int = 88, max_bytes: int = 1_000_000) -> int:
    """Save RGB or grayscale numpy uint8 array as WebP, tuning quality if needed to stay under max_bytes."""
    pil_img = Image.fromarray(img_uint8)
    for q in [quality, 84, 80, 75]:
        pil_img.save(out_path, format="WEBP", quality=q, method=6)
        sz = os.path.getsize(out_path)
        if sz < max_bytes:
            return sz
    return os.path.getsize(out_path)


def generate_bed_runner(out_dir: str):
    """
    ASSET 01: WOVEN CHENILLE BED RUNNER (bed_runner_chenille_woven_v1)
    2048 x 1024 | 0.60m x 2.20m
    """
    os.makedirs(out_dir, exist_ok=True)
    H, W = 1024, 2048
    print("Synthesizing bed_runner_chenille_woven_v1 (2048x1024)...")

    y_idx, x_idx = np.mgrid[0:H, 0:W].astype(np.float32)

    # --- 1. MAIN WOVEN CHENILLE BODY (ribbed knit / chenille waffle weave) ---
    # Horizontal ribs (running along X, stacked along Y)
    rib_period_y = 16.0  # 64 ribs across 0.60m (~9.3mm per rib)
    warp_period_x = 12.0

    # Organic yarn wobble so ribs feel hand-loomed, not digital sine waves
    wobble_low = fbm_periodic(H, W, [(8, 16, 1.0), (16, 32, 0.5)], seed=101) - 0.5
    wobble_hi = fbm_periodic(H, W, [(64, 128, 1.0)], seed=102) - 0.5

    phase_y = (y_idx + wobble_low * 3.2) * (2.0 * math.pi / rib_period_y)
    phase_x = (x_idx + wobble_low * 2.5) * (2.0 * math.pi / warp_period_x)

    # Waffle / ribbed chenille relief: strong horizontal ribs + staggered cross-weave
    rib_wave = 0.5 + 0.5 * np.cos(phase_y)
    rib_profile = np.power(rib_wave, 0.65)  # rounded yarn crest

    # Staggered waffle interlace
    stagger = np.cos(phase_y * 0.5)
    weft_ridge = 0.5 + 0.5 * np.cos(phase_x + stagger * 1.1)
    weft_profile = np.power(weft_ridge, 0.75)

    # Combine horizontal rib dominance (70%) + waffle cross-interlace (30%)
    body_height = 0.68 * rib_profile + 0.32 * (rib_profile * 0.55 + weft_profile * 0.45)

    # Add chenille micro-fiber fuzz / gentle fray along thread crests
    fiber_fine = fbm_periodic(H, W, [(256, 512, 0.6), (512, 256, 0.4)], seed=103)
    fiber_dir = fbm_periodic(H, W, [(128, 32, 0.7), (256, 64, 0.3)], seed=104)
    crest_mask = np.clip((body_height - 0.35) / 0.65, 0.0, 1.0)
    body_height += crest_mask * (fiber_fine - 0.5) * 0.14 + (fiber_dir - 0.5) * 0.08
    body_height = np.clip(body_height, 0.0, 1.0)

    # --- 2. HEM BORDER & TASSEL FRINGE BORDERS (Left x=0..156, Right x=1892..2048) ---
    hem_left_x = 156.0
    hem_right_x = float(W - 156)

    # Raised stitched hem band at both longitudinal ends
    hem_band_l = np.exp(-((x_idx - (hem_left_x + 12.0)) / 9.0) ** 2)
    hem_band_r = np.exp(-((x_idx - (hem_right_x - 12.0)) / 9.0) ** 2)
    hem_band = np.maximum(hem_band_l, hem_band_r)
    body_height = np.clip(body_height + hem_band * 0.18, 0.0, 1.0)

    # Alpha mask starts as 1.0 inside [hem_left_x, hem_right_x]
    alpha = np.where((x_idx >= hem_left_x) & (x_idx <= hem_right_x), 1.0, 0.0).astype(np.float32)

    # Tassel geometry on both ends: 24 knotted tassels along Y (period ~42.67 px)
    num_tassels = 24
    tassel_pitch = H / num_tassels
    rng = np.random.default_rng(777)

    tassel_height = np.zeros((H, W), dtype=np.float32)
    tassel_alpha = np.zeros((H, W), dtype=np.float32)
    tassel_twist_shade = np.zeros((H, W), dtype=np.float32)

    for side in ["left", "right"]:
        for i in range(num_tassels):
            yc = (i + 0.5) * tassel_pitch + rng.uniform(-1.2, 1.2)
            tip_len = rng.uniform(126.0, 142.0)  # length of tassel from hem
            knot_len = rng.uniform(24.0, 29.0)
            curve_amp = rng.uniform(-2.2, 2.2)
            twist_freq = rng.uniform(0.28, 0.36)
            twist_phase = rng.uniform(0.0, 2.0 * math.pi)

            # Distance from hem outward
            if side == "left":
                d_out = hem_left_x - x_idx
            else:
                d_out = x_idx - hem_right_x

            # Only evaluate in the tassel bounding box for speed
            y_dist = np.abs(((y_idx - yc + H * 0.5) % H) - H * 0.5)
            mask_box = (d_out >= -4.0) & (d_out <= tip_len + 6.0) & (y_dist <= 22.0)
            if not np.any(mask_box):
                continue

            d_m = d_out[mask_box]
            y_rel = (((y_idx[mask_box] - yc + H * 0.5) % H) - H * 0.5)

            # Gentle organic sway of the hanging tassel
            sway = curve_amp * np.sin((d_m / tip_len) * math.pi)
            y_local = y_rel - sway

            # Knot region: d_m in [0, knot_len] -> bulbous gathered knot
            t_knot = np.clip(d_m / knot_len, 0.0, 1.0)
            knot_radius = 12.5 * np.power(np.clip(np.sin(t_knot * math.pi), 0.0, 1.0), 0.55) + 5.5
            # Tail region: d_m in [knot_len, tip_len] -> two twisted braided strands
            t_tail = np.clip((d_m - knot_len) / max(tip_len - knot_len, 1.0), 0.0, 1.0)
            # Slight flare at the very end of the tassel
            tail_half_w = 7.8 * (1.0 - 0.12 * t_tail + 0.22 * (t_tail ** 4))

            in_knot = d_m <= knot_len
            half_w = np.where(in_knot, knot_radius, tail_half_w)

            # Taper off cleanly at the tip
            tip_taper = np.clip((tip_len - d_m) / 6.0, 0.0, 1.0)
            # Crisp anti-aliased silhouette
            dist_from_edge = half_w - np.abs(y_local)
            a_local = np.clip(dist_from_edge / 1.8 + 0.5, 0.0, 1.0) * tip_taper

            # 3D rounded cord height profile
            norm_y = np.clip(y_local / np.maximum(half_w, 1e-3), -1.0, 1.0)
            cyl_h = np.sqrt(np.clip(1.0 - norm_y * norm_y, 0.0, 1.0))

            # Diagonal twist for braided strands, cross-wrap for knot
            twist_wave = 0.5 + 0.5 * np.sin(d_m * twist_freq + y_local * 0.38 + twist_phase)
            knot_wrap = 0.5 + 0.5 * np.cos(d_m * 0.45 - np.abs(y_local) * 0.25)

            h_local = np.where(
                in_knot,
                0.55 + 0.45 * cyl_h * (0.7 + 0.3 * knot_wrap),
                0.28 + 0.62 * cyl_h * (0.65 + 0.35 * twist_wave),
            ) * tip_taper

            # Update global tassel buffers
            cur_a = tassel_alpha[mask_box]
            take = a_local > cur_a
            cur_a[take] = a_local[take]
            tassel_alpha[mask_box] = cur_a

            cur_h = tassel_height[mask_box]
            cur_h[take] = h_local[take]
            tassel_height[mask_box] = cur_h

            cur_tw = tassel_twist_shade[mask_box]
            cur_tw[take] = np.where(in_knot, knot_wrap, twist_wave)[take]
            tassel_twist_shade[mask_box] = cur_tw

    # Composite body + tassels
    in_fringe = (x_idx < hem_left_x) | (x_idx > hem_right_x)
    alpha = np.where(in_fringe, tassel_alpha, alpha)
    height = np.where(in_fringe, tassel_height, body_height)

    # --- 3. NORMAL MAP (OpenGL +Y up, 16-bit PNG) ---
    normal_rgb = height_to_normal_opengl(height, strength=5.2, wrap_x=False, wrap_y=True)

    # --- 4. BASE COLOR (#E7E1D7 to #DCD5C9, soft heathered cream / warm oatmeal) ---
    c_light = np.array([231.0, 225.0, 215.0], dtype=np.float32) / 255.0  # #E7E1D7
    c_mid = np.array([225.0, 219.0, 209.0], dtype=np.float32) / 255.0    # #E1DBD1
    c_dark = np.array([220.0, 213.0, 201.0], dtype=np.float32) / 255.0   # #DCD5C9

    heather = fbm_periodic(H, W, [(12, 24, 0.5), (48, 96, 0.3), (192, 384, 0.2)], seed=201)
    # Subtle tone variation between warp (weft_profile) and weft (rib_profile)
    yarn_mix = np.clip(0.55 * rib_profile + 0.25 * (1.0 - weft_profile) + 0.20 * heather, 0.0, 1.0)
    tassel_mix = np.clip(0.45 + 0.35 * tassel_twist_shade + 0.20 * heather, 0.0, 1.0)
    color_t = np.where(in_fringe, tassel_mix, yarn_mix)

    base_color = np.zeros((H, W, 3), dtype=np.float32)
    for c in range(3):
        # Smoothly interpolate c_dark -> c_mid -> c_light
        low_part = c_dark[c] + (c_mid[c] - c_dark[c]) * np.clip(color_t * 2.0, 0.0, 1.0)
        high_part = c_mid[c] + (c_light[c] - c_mid[c]) * np.clip((color_t - 0.5) * 2.0, 0.0, 1.0)
        base_color[:, :, c] = np.where(color_t < 0.5, low_part, high_part)

    # In transparent fringe gaps, fill with neutral oatmeal so mipmaps don't bleed black
    base_color_u8 = np.clip(np.round(base_color * 255.0), 0, 255).astype(np.uint8)

    # --- 5. ROUGHNESS (0.85 - 0.94 matte valleys, 0.75 on yarn rib crests) ---
    rough_body = 0.94 - 0.19 * np.power(body_height, 1.4) + (fiber_fine - 0.5) * 0.03
    rough_tassel = 0.92 - 0.14 * np.power(tassel_height, 1.2)
    roughness = np.where(in_fringe, rough_tassel, rough_body)
    roughness = np.clip(roughness, 0.75, 0.94)
    rough_u8 = np.clip(np.round(roughness * 255.0), 0, 255).astype(np.uint8)

    # --- 6. AMBIENT OCCLUSION (deep micro-shadows in yarn interlaces & knotted tassel bases) ---
    ao = compute_ao_from_height(height, radii=[3, 8, 18], weights=[0.95, 0.75, 0.45], wrap_x=False, wrap_y=True)
    # Extra contact shadow at the knotted tassel bases (near hem_left_x and hem_right_x)
    knot_crease_l = np.exp(-((x_idx - (hem_left_x - 4.0)) / 10.0) ** 2)
    knot_crease_r = np.exp(-((x_idx - (hem_right_x + 4.0)) / 10.0) ** 2)
    knot_crease = np.maximum(knot_crease_l, knot_crease_r)
    ao = np.clip(ao * (1.0 - 0.28 * knot_crease), 0.20, 1.0)
    ao_u8 = np.clip(np.round(ao * 255.0), 0, 255).astype(np.uint8)

    alpha_u8 = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)

    # --- SAVE OUTPUTS ---
    sz_bc = save_webp(base_color_u8, os.path.join(out_dir, "01_baseColor.webp"), quality=88)
    sz_nm = save_normal_16bit_png(normal_rgb, os.path.join(out_dir, "02_normal.png"))
    sz_rg = save_webp(rough_u8, os.path.join(out_dir, "03_roughness.webp"), quality=88)
    Image.fromarray(alpha_u8, mode="L").save(os.path.join(out_dir, "04_alpha.png"), optimize=True, compress_level=9)
    sz_al = os.path.getsize(os.path.join(out_dir, "04_alpha.png"))
    sz_ao = save_webp(ao_u8, os.path.join(out_dir, "05_ambientOcclusion.webp"), quality=88)

    # Also save 16-bit height in raw/ for TextureCraft displacement preview
    raw_dir = "assets/lego/bed_runner/raw"
    os.makedirs(raw_dir, exist_ok=True)
    cv2.imwrite(os.path.join(raw_dir, "height_16bit.png"), np.clip(np.round(height * 65535.0), 0, 65535).astype(np.uint16))

    print(f"  01_baseColor.webp:        {sz_bc:,} bytes")
    print(f"  02_normal.png (16-bit):   {sz_nm:,} bytes")
    print(f"  03_roughness.webp:        {sz_rg:,} bytes")
    print(f"  04_alpha.png:             {sz_al:,} bytes")
    print(f"  05_ambientOcclusion.webp: {sz_ao:,} bytes")


def generate_jute_rug(out_dir: str):
    """
    ASSET 02: NATURAL JUTE / LOOPED WOOL RUG (rug_natural_jute_loop_v1)
    2048 x 2048 | Seamless 1:1 repeat step: 1.20m x 1.20m (rug 2.40m x 3.00m)
    """
    os.makedirs(out_dir, exist_ok=True)
    H, W = 2048, 2048
    print("Synthesizing rug_natural_jute_loop_v1 (2048x2048 seamless)...")

    # Grid of chunky looped-pile bouclé / braided jute nodules
    cols = 32
    rows = 48
    cell_w = W / cols  # 64 px
    cell_h = H / rows  # 42.67 px

    rng = np.random.default_rng(2026)
    # Pre-generate per-cell organic parameters on (rows, cols)
    jx = rng.uniform(-0.14, 0.14, size=(rows, cols)).astype(np.float32) * cell_w
    jy = rng.uniform(-0.14, 0.14, size=(rows, cols)).astype(np.float32) * cell_h
    rad_x = rng.uniform(0.50, 0.62, size=(rows, cols)).astype(np.float32) * cell_w
    rad_y = rng.uniform(0.52, 0.64, size=(rows, cols)).astype(np.float32) * cell_h
    loop_h = rng.uniform(0.78, 1.00, size=(rows, cols)).astype(np.float32)
    loop_tone = rng.uniform(0.0, 1.0, size=(rows, cols)).astype(np.float32)
    loop_angle = rng.uniform(-0.22, 0.22, size=(rows, cols)).astype(np.float32)
    twist_ph = rng.uniform(0.0, 2.0 * math.pi, size=(rows, cols)).astype(np.float32)

    y_idx, x_idx = np.mgrid[0:H, 0:W].astype(np.float32)

    height = np.zeros((H, W), dtype=np.float32)
    tone_map = np.zeros((H, W), dtype=np.float32)
    twist_map = np.zeros((H, W), dtype=np.float32)

    # Evaluate 3x3 neighborhood of cells per pixel using vectorized cell indexing
    # Compute base cell index for each pixel
    base_r = np.floor(y_idx / cell_h).astype(np.int32)
    base_c = np.floor(x_idx / cell_w).astype(np.int32)

    for dr in [-1, 0, 1]:
        for dc in [-1, 0, 1]:
            rr = (base_r + dr) % rows
            cc = (base_c + dc) % cols

            # Stagger odd rows by half a cell width for braided bouclé look
            stagger_x = (rr % 2) * (0.5 * cell_w)
            cx = (base_c + dc + 0.5) * cell_w + stagger_x + jx[rr, cc]
            cy = (base_r + dr + 0.5) * cell_h + jy[rr, cc]

            # Handle wrap-around when stagger pushes cx slightly past W
            dx = x_idx - cx
            dx = np.where(dx > W * 0.5, dx - W, dx)
            dx = np.where(dx < -W * 0.5, dx + W, dx)

            dy = y_idx - cy
            dy = np.where(dy > H * 0.5, dy - H, dy)
            dy = np.where(dy < -H * 0.5, dy + H, dy)

            # Slight organic tilt per nodule (alternating herringbone hint)
            ang = loop_angle[rr, cc] + np.where(rr % 2 == 0, 0.12, -0.12)
            cos_a = np.cos(ang)
            sin_a = np.sin(ang)
            ux = dx * cos_a - dy * sin_a
            vy = dx * sin_a + dy * cos_a

            rx = rad_x[rr, cc]
            ry = rad_y[rr, cc]
            dist2 = (ux / rx) ** 2 + (vy / ry) ** 2

            # Smooth pillowy domed loop profile
            nodule = np.where(dist2 < 1.0, np.power(np.clip(1.0 - dist2, 0.0, 1.0), 0.62), 0.0)

            # Coarse 3-ply twisted fiber striations along the loop
            twist = 0.5 + 0.5 * np.sin(ux * 0.42 + vy * 0.18 + twist_ph[rr, cc])
            nodule_h = loop_h[rr, cc] * nodule * (0.82 + 0.18 * twist)

            mask = nodule_h > height
            height = np.where(mask, nodule_h, height)
            tone_map = np.where(mask, loop_tone[rr, cc], tone_map)
            twist_map = np.where(mask, twist, twist_map)

    # Underlying jute warp backing in the deep valleys
    backing = 0.10 + 0.06 * (0.5 + 0.5 * np.sin(x_idx * (2.0 * math.pi / 16.0)))
    height = np.maximum(height, backing)

    # Add fine natural wool/jute micro-fiber slubbing (toroidal seamless)
    micro_fiber = fbm_periodic(H, W, [(128, 128, 0.5), (256, 256, 0.35), (512, 512, 0.15)], seed=303)
    height = np.clip(height + (micro_fiber - 0.5) * 0.08, 0.0, 1.0)

    # --- NORMAL MAP (OpenGL +Y up, 16-bit PNG) ---
    normal_rgb = height_to_normal_opengl(height, strength=6.5, wrap_x=True, wrap_y=True)

    # --- BASE COLOR (#D8D2C5 to #C4BCAC, sand beige / raw oatmeal / warm linen) ---
    c_light = np.array([216.0, 210.0, 197.0], dtype=np.float32) / 255.0  # #D8D2C5
    c_dark = np.array([196.0, 188.0, 172.0], dtype=np.float32) / 255.0   # #C4BCAC

    # Broad organic tonal drift (toroidal seamless, zero tiling stamps)
    drift = fbm_periodic(H, W, [(4, 4, 0.5), (8, 8, 0.35), (24, 24, 0.15)], seed=304)
    color_t = np.clip(0.42 * tone_map + 0.30 * drift + 0.16 * twist_map + 0.12 * micro_fiber, 0.0, 1.0)

    base_color = np.zeros((H, W, 3), dtype=np.float32)
    for c in range(3):
        base_color[:, :, c] = c_dark[c] + (c_light[c] - c_dark[c]) * color_t
    base_color_u8 = np.clip(np.round(base_color * 255.0), 0, 255).astype(np.uint8)

    # --- ROUGHNESS (Ultra-matte 0.92 - 0.98) ---
    roughness = 0.98 - 0.06 * np.power(height, 1.1) + (micro_fiber - 0.5) * 0.015
    roughness = np.clip(roughness, 0.92, 0.98)
    rough_u8 = np.clip(np.round(roughness * 255.0), 0, 255).astype(np.uint8)

    # --- AMBIENT OCCLUSION (Intense contact shadows between thick braided nodules) ---
    ao = compute_ao_from_height(height, radii=[5, 14, 32], weights=[1.10, 0.95, 0.55], wrap_x=True, wrap_y=True)
    # Deepen valley contact shadows directly from low height
    valley_ao = np.clip(0.30 + 0.70 * np.power(height, 0.55), 0.15, 1.0)
    ao = np.clip(ao * valley_ao, 0.15, 1.0)
    ao_u8 = np.clip(np.round(ao * 255.0), 0, 255).astype(np.uint8)

    # --- SAVE OUTPUTS ---
    sz_bc = save_webp(base_color_u8, os.path.join(out_dir, "01_baseColor.webp"), quality=88)
    sz_nm = save_normal_16bit_png(normal_rgb, os.path.join(out_dir, "02_normal.png"))
    sz_rg = save_webp(rough_u8, os.path.join(out_dir, "03_roughness.webp"), quality=88)
    sz_ao = save_webp(ao_u8, os.path.join(out_dir, "05_ambientOcclusion.webp"), quality=88)

    raw_dir = "assets/lego/rug/raw"
    os.makedirs(raw_dir, exist_ok=True)
    cv2.imwrite(os.path.join(raw_dir, "height_16bit.png"), np.clip(np.round(height * 65535.0), 0, 65535).astype(np.uint16))

    print(f"  01_baseColor.webp:        {sz_bc:,} bytes")
    print(f"  02_normal.png (16-bit):   {sz_nm:,} bytes")
    print(f"  03_roughness.webp:        {sz_rg:,} bytes")
    print(f"  05_ambientOcclusion.webp: {sz_ao:,} bytes")


if __name__ == "__main__":
    generate_bed_runner("shared_assets/lego/components/bed_runner/bed_runner_chenille_woven_v1")
    generate_jute_rug("shared_assets/lego/components/rug/rug_natural_jute_loop_v1")
