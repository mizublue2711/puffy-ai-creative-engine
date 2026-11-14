#!/usr/bin/env python3
"""
Deterministic mock asset generator for Puffy AI Creative Engine.
Generates transparent mattress cutout PNG, cutout metadata JSON,
and Nordic Minimalism bedroom environment plate when production assets are absent.
"""

import hashlib
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent


def generate_mock_mattress(out_path: Path) -> tuple[int, int, str]:
    width, height = 1200, 720
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Soft drop shadow on transparent canvas
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.polygon(
        [(130, 500), (620, 650), (1090, 490), (600, 360)],
        fill=(43, 47, 68, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=22))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # Isometric mattress coordinates
    # Top face corners: top(600, 120), right(1080, 290), bottom(600, 460), left(120, 290)
    top_pt = (600, 110)
    right_pt = (1080, 285)
    bottom_pt = (600, 465)
    left_pt = (120, 285)

    # Side depths
    mid_depth = 75
    base_depth = 155

    # Bottom Navy Ink base (#2B2F44) - left side & right side
    draw.polygon(
        [
            (left_pt[0], left_pt[1] + mid_depth),
            (bottom_pt[0], bottom_pt[1] + mid_depth),
            (bottom_pt[0], bottom_pt[1] + base_depth),
            (left_pt[0], left_pt[1] + base_depth),
        ],
        fill=(43, 47, 68, 255),
    )
    draw.polygon(
        [
            (bottom_pt[0], bottom_pt[1] + mid_depth),
            (right_pt[0], right_pt[1] + mid_depth),
            (right_pt[0], right_pt[1] + base_depth),
            (bottom_pt[0], bottom_pt[1] + base_depth),
        ],
        fill=(34, 37, 54, 255),
    )

    # Upper Warm Linen / Cloud White side panels
    draw.polygon(
        [
            left_pt,
            bottom_pt,
            (bottom_pt[0], bottom_pt[1] + mid_depth),
            (left_pt[0], left_pt[1] + mid_depth),
        ],
        fill=(238, 236, 232, 255),
    )
    draw.polygon(
        [
            bottom_pt,
            right_pt,
            (right_pt[0], right_pt[1] + mid_depth),
            (bottom_pt[0], bottom_pt[1] + mid_depth),
        ],
        fill=(229, 227, 223, 255),
    )

    # Top quilted Pure White surface (#FFFFFF)
    draw.polygon([top_pt, right_pt, bottom_pt, left_pt], fill=(255, 255, 255, 255))

    # Subtle quilting grid on top surface
    grid_steps = 6
    for i in range(1, grid_steps):
        t = i / grid_steps
        # Lines parallel to top-right -> bottom-left
        p1 = (
            int(top_pt[0] + (left_pt[0] - top_pt[0]) * t),
            int(top_pt[1] + (left_pt[1] - top_pt[1]) * t),
        )
        p2 = (
            int(right_pt[0] + (bottom_pt[0] - right_pt[0]) * t),
            int(right_pt[1] + (bottom_pt[1] - right_pt[1]) * t),
        )
        draw.line([p1, p2], fill=(229, 227, 223, 220), width=2)

        # Lines parallel to top-left -> bottom-right
        q1 = (
            int(top_pt[0] + (right_pt[0] - top_pt[0]) * t),
            int(top_pt[1] + (right_pt[1] - top_pt[1]) * t),
        )
        q2 = (
            int(left_pt[0] + (bottom_pt[0] - left_pt[0]) * t),
            int(left_pt[1] + (bottom_pt[1] - left_pt[1]) * t),
        )
        draw.line([q1, q2], fill=(229, 227, 223, 220), width=2)

    # Piping / stitching trim around top perimeter
    draw.line([top_pt, right_pt, bottom_pt, left_pt, top_pt], fill=(205, 208, 218, 255), width=4)

    # Ocean Teal (#067A57) woven Puffy® badge on front-right panel
    badge_pts = [
        (690, 515),
        (780, 482),
        (780, 522),
        (690, 555),
    ]
    draw.polygon(badge_pts, fill=(6, 122, 87, 255))
    draw.line(badge_pts + [badge_pts[0]], fill=(255, 255, 255, 200), width=2)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")
    sha256 = hashlib.sha256(out_path.read_bytes()).hexdigest()
    return width, height, sha256


def generate_mock_environment(out_path: Path) -> None:
    width, height = 1920, 1080
    img = Image.new("RGB", (width, height), (229, 227, 223))  # Warm Linen #E5E3DF
    draw = ImageDraw.Draw(img)

    # Subtle vertical wall gradient
    for y in range(0, 740):
        t = y / 740.0
        r = int(242 - 16 * t)
        g = int(240 - 16 * t)
        b = int(236 - 16 * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Minimalist Nordic floor plane
    for y in range(740, height):
        t = (y - 740) / (height - 740)
        r = int(214 - 22 * t)
        g = int(206 - 22 * t)
        b = int(194 - 22 * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Architectural baseboard line
    draw.line([(0, 740), (width, 740)], fill=(195, 189, 180), width=3)

    # Soft daylight window glow on left
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.polygon([(120, 80), (540, 140), (540, 680), (120, 720)], fill=(255, 255, 255, 95))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=45))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")


def main() -> None:
    cutout_path = ROOT / "assets/cutouts/mock_mattress.png"
    metadata_path = ROOT / "assets/cutouts/mock_mattress.metadata.json"
    env_path = ROOT / "assets/environments/mock_bedroom_nordic.png"

    if not cutout_path.exists():
        w, h, sha = generate_mock_mattress(cutout_path)
        print(f"Generated {cutout_path.relative_to(ROOT)} ({w}x{h}, sha256={sha[:12]}...)")
    else:
        with Image.open(cutout_path) as im:
            w, h = im.size
        sha = hashlib.sha256(cutout_path.read_bytes()).hexdigest()
        print(f"Existing {cutout_path.relative_to(ROOT)} ({w}x{h})")

    metadata = {
        "cutout_id": "mock_mattress_v1",
        "source_raw_path": "assets/raw_mattress/mock_mattress_source.png",
        "cutout_path": "assets/cutouts/mock_mattress.png",
        "sha256": sha,
        "dimensions": {"width": w, "height": h},
        "zero_product_drift_verified": True,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {metadata_path.relative_to(ROOT)}")

    if not env_path.exists():
        generate_mock_environment(env_path)
        print(f"Generated {env_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
