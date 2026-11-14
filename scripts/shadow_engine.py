"""
Puffy AI Creative Engine - Adaptive Bed Shadow Engine & Grid Normalizer
Zero-Drift Asset Processing Pipeline for Puffy Mattresses & Bed Frames.

Automatically detects product geometry from the bottom 5% alpha slice:
  - Multi-Leg / Adjustable Base (leg_count >= 2):
      Multi-leg contact occlusion + elliptical underbed ambient shadow.
  - Flat Mattress / Floor-Hugging Frame (leg_count < 2):
      Linear flat slab ground shadow + tight 15% bottom contact occlusion.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Tuple, Union

import numpy as np
from PIL import Image, ImageFilter

# Ensure sibling module import works whether invoked from repo root or scripts/
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from grid_normalizer import normalize_to_grid, resolve_canvas_size  # noqa: E402

CanvasSize = Union[int, Tuple[int, int]]


def _blur_with_padding(layer: Image.Image, blur_radius: float) -> Tuple[Image.Image, int]:
    """Pad an RGBA layer with transparent margin before GaussianBlur to avoid edge clipping."""
    pad = max(4, int(np.ceil(blur_radius * 3)))
    padded = Image.new("RGBA", (layer.width + pad * 2, layer.height + pad * 2), (0, 0, 0, 0))
    padded.paste(layer, (pad, pad))
    return padded.filter(ImageFilter.GaussianBlur(radius=blur_radius)), pad


def _alpha_composite_at(canvas: Image.Image, layer: Image.Image, x: int, y: int) -> None:
    """Safely alpha-composite `layer` onto `canvas` at `(x, y)`, clipping only at canvas bounds."""
    cw, ch = canvas.size
    lw, lh = layer.size

    src_x0 = max(0, -x)
    src_y0 = max(0, -y)
    src_x1 = min(lw, cw - x)
    src_y1 = min(lh, ch - y)
    if src_x1 <= src_x0 or src_y1 <= src_y0:
        return

    dest_x = max(0, x)
    dest_y = max(0, y)
    patch = (
        layer
        if (src_x0 == 0 and src_y0 == 0 and src_x1 == lw and src_y1 == lh)
        else layer.crop((src_x0, src_y0, src_x1, src_y1))
    )
    canvas.alpha_composite(patch, dest=(dest_x, dest_y))


def _detect_legs(alpha: np.ndarray, target_h: int) -> int:
    """Count disconnected opaque leg clusters in the bottom 5% of the silhouette."""
    bottom_slice = alpha[int(target_h * 0.95) :, :]
    horizontal_density = (bottom_slice > 50).sum(axis=0) > 0
    padded = np.pad(horizontal_density.astype(np.int8), (1, 0), constant_values=0)
    return int(np.sum(np.diff(padded) == 1))


def _build_bottom_contact_alpha(
    alpha: np.ndarray, target_h: int, start_ratio: float = 0.85, power: float = 1.8
) -> np.ndarray:
    """Extract bottom-only alpha with a power ramp to prevent 360-degree halos."""
    cutoff = int(target_h * start_ratio)
    span = max(1, target_h - cutoff)
    ramp = (np.linspace(0.0, 1.0, span, endpoint=False, dtype=np.float32) ** power)[:, None]
    out = np.zeros_like(alpha)
    out[cutoff:target_h, :] = alpha[cutoff:target_h, :] * ramp
    return out


def _build_underbed_ambient(underbed_w: int, underbed_h: int) -> Tuple[Image.Image, int]:
    """Vectorized elliptical underbed ambient shadow with padded GaussianBlur."""
    xs = (np.arange(underbed_w, dtype=np.float32) - underbed_w / 2.0) / max(1.0, underbed_w / 2.0)
    ys = (np.arange(underbed_h, dtype=np.float32) - underbed_h / 2.0) / max(1.0, underbed_h / 2.0)
    val = np.maximum(0.0, 1.0 - (ys[:, None] ** 2 + xs[None, :] ** 2))
    ub_mask = Image.fromarray(np.clip(val * 85.0, 0, 255).astype(np.uint8))

    ub_raw = Image.new("RGBA", (underbed_w, underbed_h), (15, 18, 25, 255))
    ub_raw.putalpha(ub_mask)
    return _blur_with_padding(ub_raw, blur_radius=16)


def _build_linear_flat_map(shadow_w: int, shadow_h: int, target_w: int, overhang: int) -> np.ndarray:
    """Vectorized linear flat slab shadow map with quadratic side overhang taper."""
    y_norm = np.arange(shadow_h, dtype=np.float32) / max(1, shadow_h)
    v_factor = (1.0 - y_norm) ** 2.2

    xs = np.arange(shadow_w, dtype=np.float32)
    oh = max(1.0, float(overhang))
    h_factor = np.where(
        (xs >= overhang) & (xs <= overhang + target_w),
        1.0,
        np.where(
            xs < overhang,
            (xs / oh) ** 2.0,
            np.maximum(0.0, (shadow_w - xs) / oh) ** 2.0,
        ),
    )
    return v_factor[:, None] * h_factor[None, :]


def export_puffy_adaptive_shadow(
    input_png_path: str,
    output_png_path: str,
    canvas_size: CanvasSize = (1024, 1024),
    trim_transparent: bool = True,
) -> dict:
    """
    Export a 100% transparent PNG with adaptive studio shadows:
      - Multi-leg / Adjustable base: multi-leg contact occlusion + underbed ambient ellipse
      - Flat mattress / floor frame: linear flat slab ground shadow + bottom contact occlusion
    """
    started = time.perf_counter()
    canvas_w, canvas_h = resolve_canvas_size(canvas_size)

    # 1. Fit Grid 75% + 16% Safe Bottom Margin BEFORE shadowing
    with Image.open(input_png_path) as src:
        product_resized, (pos_x, pos_y) = normalize_to_grid(
            src,
            canvas_size=(canvas_w, canvas_h),
            grid_ratio=0.75,
            bottom_margin_ratio=0.16,
            trim_transparent=trim_transparent,
        )

    target_w, target_h = product_resized.size
    bottom_y = pos_y + target_h
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    # 2. Scan bottom 5% alpha to distinguish legged frames from flat mattresses
    alpha = np.array(product_resized.split()[-1], dtype=np.float32)
    leg_count = _detect_legs(alpha, target_h)
    has_legs = leg_count >= 2

    if has_legs:
        # === SCENARIO A: MULTI-LEG / ADJUSTABLE BASE ===
        leg_alpha = _build_bottom_contact_alpha(alpha, target_h, start_ratio=0.85, power=1.2)
        occ_mask = Image.fromarray((leg_alpha * 0.95).astype(np.uint8))
        occ_raw = Image.new("RGBA", (target_w, target_h), (5, 5, 8, 255))
        occ_raw.putalpha(occ_mask)
        occ_layer, occ_pad = _blur_with_padding(occ_raw, blur_radius=2)

        underbed_w = max(1, int(target_w * 0.92))
        underbed_h = max(1, int(canvas_h * 0.12))
        underbed, ub_pad = _build_underbed_ambient(underbed_w, underbed_h)

        ub_x = pos_x + (target_w - underbed_w) // 2
        ub_y = bottom_y - int(underbed_h * 0.85)

        _alpha_composite_at(canvas, underbed, ub_x - ub_pad, ub_y - ub_pad)
        _alpha_composite_at(canvas, occ_layer, pos_x - occ_pad, pos_y + 1 - occ_pad)
        _alpha_composite_at(canvas, product_resized, pos_x, pos_y)
    else:
        # === SCENARIO B: FLAT MATTRESS / FLOOR-HUGGING FRAME ===
        contact_alpha = _build_bottom_contact_alpha(alpha, target_h, start_ratio=0.85, power=1.8)
        occ_mask = Image.fromarray((contact_alpha * 0.95).astype(np.uint8))
        occ_raw = Image.new("RGBA", (target_w, target_h), (8, 10, 15, 255))
        occ_raw.putalpha(occ_mask)
        occ_layer, occ_pad = _blur_with_padding(occ_raw, blur_radius=1.8)

        overhang = max(1, int(target_w * 0.04))
        shadow_w = target_w + overhang * 2
        shadow_h = max(1, int(canvas_h * 0.16))
        ground_map = _build_linear_flat_map(shadow_w, shadow_h, target_w, overhang)

        ground_mask = Image.fromarray(np.clip(ground_map * 115.0, 0, 255).astype(np.uint8))
        ground_raw = Image.new("RGBA", (shadow_w, shadow_h), (12, 14, 20, 255))
        ground_raw.putalpha(ground_mask)
        ground_shadow, ground_pad = _blur_with_padding(ground_raw, blur_radius=20)

        _alpha_composite_at(
            canvas, ground_shadow, pos_x - overhang - ground_pad, bottom_y - 4 - ground_pad
        )
        _alpha_composite_at(canvas, occ_layer, pos_x - occ_pad, pos_y + 1 - occ_pad)
        _alpha_composite_at(canvas, product_resized, pos_x, pos_y)

    # 3. Export optimized transparent PNG
    out_dir = os.path.dirname(os.path.abspath(output_png_path))
    os.makedirs(out_dir, exist_ok=True)
    canvas.save(output_png_path, "PNG", optimize=True)

    mode_label = "multi_leg" if has_legs else "flat_slab"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    print(f"Generated ({mode_label}, legs={leg_count}): {output_png_path} ({elapsed_ms} ms)")

    return {
        "input": input_png_path,
        "output": output_png_path,
        "resolution": f"{canvas_w}x{canvas_h}",
        "mode": mode_label,
        "leg_count": leg_count,
        "elapsed_ms": elapsed_ms,
    }


# Backward-compatible aliases for existing pipeline/CLI callers
export_puffy_realistic_ground_shadow = export_puffy_adaptive_shadow
export_puffy_grounded_transparent = export_puffy_adaptive_shadow
export_puffy_transparent_with_shadow = export_puffy_adaptive_shadow
apply_puffy_studio_ground_shadow = export_puffy_adaptive_shadow
apply_puffy_contour_shadow = export_puffy_adaptive_shadow
apply_puffy_contour_shadow_fixed = export_puffy_adaptive_shadow


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Apply Puffy Adaptive Bed Shadow Engine to a transparent cutout."
    )
    parser.add_argument(
        "--input",
        default="assets/raw_mattress/sample_cutout.png",
        help="Input cutout image path.",
    )
    parser.add_argument(
        "--output",
        default="assets/catalog/mattresses/puffy-cloud/processed_hero.png",
        help="Output shadowed PNG path.",
    )
    parser.add_argument(
        "--canvas-size",
        type=int,
        default=1024,
        help="Square output canvas size in pixels (default: 1024).",
    )
    args = parser.parse_args()

    if os.path.exists(args.input):
        export_puffy_adaptive_shadow(args.input, args.output, canvas_size=args.canvas_size)
    else:
        print(f"Input not found: {args.input}", file=sys.stderr)
        sys.exit(1)
