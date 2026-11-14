"""
Puffy AI Creative Engine - 75% Grid Normalizer
Standardizes transparent product cutouts onto a canonical canvas with
Zero Product Drift (aspect-ratio-preserving LANCZOS resampling).
"""

from __future__ import annotations

import argparse
import os
from typing import Tuple, Union

from PIL import Image

CanvasSize = Union[int, Tuple[int, int]]


def resolve_canvas_size(canvas_size: CanvasSize) -> Tuple[int, int]:
    """Normalize an integer or (width, height) tuple into (width, height)."""
    if isinstance(canvas_size, int):
        if canvas_size <= 0:
            raise ValueError(f"canvas_size must be positive, got {canvas_size}")
        return (canvas_size, canvas_size)
    if (
        isinstance(canvas_size, (tuple, list))
        and len(canvas_size) == 2
        and all(isinstance(v, int) and v > 0 for v in canvas_size)
    ):
        return (int(canvas_size[0]), int(canvas_size[1]))
    raise ValueError(f"Invalid canvas_size: {canvas_size!r}")


def trim_alpha_bounds(image: Image.Image) -> Image.Image:
    """Crop transparent outer padding using the alpha channel bounding box."""
    rgba = image.convert("RGBA")
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def normalize_to_grid(
    product: Image.Image,
    canvas_size: CanvasSize = (1024, 1024),
    grid_ratio: float = 0.75,
    bottom_margin_ratio: float = 0.15,
    trim_transparent: bool = True,
) -> Tuple[Image.Image, Tuple[int, int]]:
    """
    Fit a product cutout into the 75% grid bounding box and compute its anchor.

    Args:
        product: Source PIL Image (converted to RGBA without mutating caller's image).
        canvas_size: Target canvas dimensions as int or (width, height).
        grid_ratio: Maximum fraction of canvas width/height occupied by product (default 0.75).
        bottom_margin_ratio: Safe bottom margin fraction for shadow falloff (default 0.15).
        trim_transparent: Whether to crop empty alpha borders before scaling.

    Returns:
        (resized_product, (pos_x, pos_y)) ready for compositing on canvas_size.
    """
    canvas_w, canvas_h = resolve_canvas_size(canvas_size)
    working = trim_alpha_bounds(product) if trim_transparent else product.convert("RGBA")

    max_w = max(1, int(canvas_w * grid_ratio))
    max_h = max(1, int(canvas_h * grid_ratio))
    working.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

    pos_x = (canvas_w - working.width) // 2
    pos_y = canvas_h - working.height - int(canvas_h * bottom_margin_ratio)
    return working, (pos_x, pos_y)


def normalize_file(
    input_png_path: str,
    output_png_path: str,
    canvas_size: CanvasSize = (1024, 1024),
    grid_ratio: float = 0.75,
    bottom_margin_ratio: float = 0.15,
    trim_transparent: bool = True,
    background_color: Tuple[int, int, int, int] = (0, 0, 0, 0),
) -> dict:
    """Load a cutout PNG, normalize it to the 75% grid, and save the result."""
    canvas_w, canvas_h = resolve_canvas_size(canvas_size)
    with Image.open(input_png_path) as src:
        product, (pos_x, pos_y) = normalize_to_grid(
            src,
            canvas_size=(canvas_w, canvas_h),
            grid_ratio=grid_ratio,
            bottom_margin_ratio=bottom_margin_ratio,
            trim_transparent=trim_transparent,
        )

    canvas = Image.new("RGBA", (canvas_w, canvas_h), background_color)
    canvas.paste(product, (pos_x, pos_y), product)

    out_dir = os.path.dirname(os.path.abspath(output_png_path))
    os.makedirs(out_dir, exist_ok=True)
    canvas.save(output_png_path, "PNG")

    return {
        "input": input_png_path,
        "output": output_png_path,
        "canvas_size": f"{canvas_w}x{canvas_h}",
        "product_size": f"{product.width}x{product.height}",
        "position": [pos_x, pos_y],
    }


def _parse_canvas_arg(raw: str) -> Tuple[int, int]:
    if "x" in raw.lower():
        parts = raw.lower().split("x", 1)
        return (int(parts[0]), int(parts[1]))
    size = int(raw)
    return (size, size)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize product PNGs onto the canonical 75%% Puffy grid."
    )
    parser.add_argument("input", help="Path to source transparent PNG")
    parser.add_argument("output", help="Path to normalized output PNG")
    parser.add_argument(
        "--canvas-size",
        default="1024",
        help="Canvas size as N or WxH (default: 1024)",
    )
    parser.add_argument(
        "--no-trim",
        action="store_true",
        help="Disable transparent outer border trimming",
    )
    args = parser.parse_args()

    result = normalize_file(
        args.input,
        args.output,
        canvas_size=_parse_canvas_arg(args.canvas_size),
        trim_transparent=not args.no_trim,
    )
    print(f"Normalized {result['input']} -> {result['output']} ({result['canvas_size']})")


if __name__ == "__main__":
    main()
