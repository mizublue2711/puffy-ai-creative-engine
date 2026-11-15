"""
2D Python Banner Automation Compositor for Puffy Embroidered Badge (CAVP-v1.0)
Consumes only `06_beauty_render_4k.png` (4096x2048 PNG-32 RGBA) from the Centralized Asset Vault.
Uses Pillow `Image.Resampling.LANCZOS` for scaling/rotation and applies a soft contact shadow layer
on fabric without degrading background grain.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageFilter

DEFAULT_BEAUTY_RENDER = (
    Path(__file__).resolve().parent.parent
    / "shared_assets"
    / "lego"
    / "components"
    / "badge_royal_embroidered_v1"
    / "06_beauty_render_4k.png"
)


def composite_badge_on_fabric(
    fabric_image: Image.Image,
    badge_beauty_path: Path | str = DEFAULT_BEAUTY_RENDER,
    target_width: int = 360,
    position: Tuple[int, int] = (0, 0),
    rotation_deg: float = 0.0,
    shadow_offset: Tuple[int, int] = (0, 4),
    shadow_blur_radius: float = 4.5,
    shadow_opacity: float = 0.42,
) -> Image.Image:
    """
    Composite `06_beauty_render_4k.png` onto a fabric backdrop without grain degradation.

    Args:
        fabric_image: Target banner or mattress fabric image (converted to RGBA non-destructively).
        badge_beauty_path: Path to `06_beauty_render_4k.png`.
        target_width: Target badge width in pixels (height preserves native 2:1 aspect ratio).
        position: Top-left (x, y) anchor on `fabric_image`.
        rotation_deg: Optional counter-clockwise rotation in degrees.
        shadow_offset: (dx, dy) pixel offset for the soft contact shadow.
        shadow_blur_radius: GaussianBlur radius for the contact shadow.
        shadow_opacity: Peak opacity (0..1) of the contact shadow layer.
    """
    base = fabric_image.convert("RGBA")
    badge = Image.open(badge_beauty_path).convert("RGBA")

    aspect = badge.height / badge.width
    target_height = max(1, round(target_width * aspect))
    badge_scaled = badge.resize((target_width, target_height), Image.Resampling.LANCZOS)

    if abs(rotation_deg) > 1e-3:
        badge_scaled = badge_scaled.rotate(
            rotation_deg,
            resample=Image.Resampling.LANCZOS,
            expand=True,
        )

    # Synthesize soft contact shadow exclusively from badge alpha (preserves fabric grain)
    alpha = badge_scaled.getchannel("A")
    pad = max(4, int(shadow_blur_radius * 3))
    shadow_alpha = Image.new(
        "L", (badge_scaled.width + pad * 2, badge_scaled.height + pad * 2), 0
    )
    scaled_alpha = alpha.point(lambda a: int(a * shadow_opacity))
    shadow_alpha.paste(scaled_alpha, (pad, pad))
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(radius=shadow_blur_radius))

    shadow_layer = Image.new("RGBA", shadow_alpha.size, (8, 10, 14, 255))
    shadow_layer.putalpha(shadow_alpha)

    sx = position[0] - pad + shadow_offset[0]
    sy = position[1] - pad + shadow_offset[1]
    base.alpha_composite(shadow_layer, dest=(max(0, sx), max(0, sy)))
    base.alpha_composite(badge_scaled, dest=position)
    return base


def main() -> None:
    parser = argparse.ArgumentParser(description="Composite 4K badge beauty render onto banner")
    parser.add_argument("--fabric", required=True, help="Input fabric/banner image path")
    parser.add_argument("--out", required=True, help="Output composited PNG path")
    parser.add_argument("--badge", default=str(DEFAULT_BEAUTY_RENDER), help="Path to 06_beauty_render_4k.png")
    parser.add_argument("--width", type=int, default=360, help="Target badge width in px")
    parser.add_argument("--x", type=int, default=100, help="X position")
    parser.add_argument("--y", type=int, default=100, help="Y position")
    parser.add_argument("--rotate", type=float, default=0.0, help="Rotation in degrees")
    args = parser.parse_args()

    fabric = Image.open(args.fabric)
    out_img = composite_badge_on_fabric(
        fabric,
        badge_beauty_path=args.badge,
        target_width=args.width,
        position=(args.x, args.y),
        rotation_deg=args.rotate,
    )
    out_img.save(args.out, "PNG")


if __name__ == "__main__":
    main()
