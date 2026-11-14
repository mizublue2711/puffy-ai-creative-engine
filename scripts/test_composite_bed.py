"""
Puffy AI Creative Engine - Composite Mattress-on-Bed-Frame Assembly Test.

Composites a clean mattress cutout onto a multi-leg bed frame cutout with
Zero Gap at the mattress-frame seam, then applies `apply_puffy_contour_shadow`
to verify `multi_leg` shadow grounding on the assembled product.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from shadow_engine import apply_puffy_contour_shadow  # noqa: E402


def _trim_rgba(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def build_mattress_on_bed_composite(
    bed_frame_path: str,
    mattress_path: str,
    output_path: str,
    canvas_size: int = 1024,
) -> dict:
    """Assemble mattress onto bed frame and run multi-leg shadow engine."""
    frame_img = _trim_rgba(Image.open(bed_frame_path))
    mattress_img = _trim_rgba(Image.open(mattress_path))

    # Scale mattress horizontally (~105-107% width stretch) to match bed frame perspective width
    base_mattress_w = int(frame_img.width * 0.965)
    target_mattress_w = int(frame_img.width * 1.015)
    target_mattress_h = int(
        base_mattress_w * (mattress_img.height / mattress_img.width)
    )
    mattress_resized = mattress_img.resize(
        (target_mattress_w, target_mattress_h), Image.Resampling.LANCZOS
    )

    # Align both left and right edges seamlessly over the bed frame outer borders
    seam_y = int(frame_img.height * 0.51)
    mattress_y = seam_y - target_mattress_h

    pad_x = max(0, (target_mattress_w - frame_img.width) // 2 + 10)
    pad_top = max(0, -mattress_y) + 20
    composite = Image.new(
        "RGBA",
        (frame_img.width + pad_x * 2, frame_img.height + pad_top),
        (0, 0, 0, 0),
    )

    frame_paste_x = pad_x
    frame_paste_y = pad_top
    mattress_paste_x = pad_x + (frame_img.width - target_mattress_w) // 2 + 2
    mattress_paste_y = pad_top + mattress_y

    # Subtle contact seam shadow under mattress onto platform deck
    seam_shadow_alpha = mattress_resized.split()[-1].point(lambda a: int(a * 0.28))
    seam_shadow = Image.new("RGBA", mattress_resized.size, (10, 12, 18, 255))
    seam_shadow.putalpha(seam_shadow_alpha)
    seam_shadow = seam_shadow.filter(ImageFilter.GaussianBlur(radius=6))

    composite.alpha_composite(frame_img, (frame_paste_x, frame_paste_y))
    composite.alpha_composite(seam_shadow, (mattress_paste_x, mattress_paste_y + 6))
    composite.alpha_composite(mattress_resized, (mattress_paste_x, mattress_paste_y))

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        composite.save(tmp_path, "PNG")
        metrics = apply_puffy_contour_shadow(
            tmp_path,
            output_path,
            canvas_size=canvas_size,
            trim_transparent=True,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return metrics


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    bed_frame_path = (
        repo_root
        / "assets/catalog/bed-frames/puffy-dusk-bed-frame/cutout_angle45_1920x1238.png"
    )
    mattress_path = (
        repo_root
        / "assets/catalog/mattresses/puffy-lux-hybrid/cutout_angle45_1200x720.png"
    )
    output_path = (
        repo_root
        / "pipelines/banner_engine/assets/test_mattress_on_bed_shadowed.png"
    )

    metrics = build_mattress_on_bed_composite(
        str(bed_frame_path),
        str(mattress_path),
        str(output_path),
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
