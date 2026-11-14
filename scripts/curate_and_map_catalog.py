"""
Puffy AI Creative Engine - Unified Single-Pass Asset Curation & Grounding Classifier.

Scans all images (.png, .webp, .jpg) under `assets/` in a single pass to:
1. Enforce the minimum resolution quality gate (width >= 600 and height >= 450).
2. Classify valid assets by alpha channel into lifestyle scenes (`scrim_overlay`)
   or product cutouts (`shadow_engine`).
3. Run the bottom-5% alpha grounding classifier on cutouts to distinguish
   `multi_leg` (leg_count >= 2) from `flat_slab` (leg_count: 1).
4. Compute SHA-256 checksums for deduplication and upsert metadata into `assets/manifest.json`.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from math import gcd
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

SUPPORTED_EXTENSIONS = (".png", ".webp", ".jpg")
MIN_WIDTH = 600
MIN_HEIGHT = 450
OPAQUE_MAX_TRANSPARENT_RATIO = 0.05
CUTOUT_MIN_TRANSPARENT_RATIO = 0.10
ALPHA_SOLID_THRESHOLD = 50


def _compute_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute hex SHA-256 checksum for a file."""
    digest = hashlib.sha256()
    with file_path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _format_aspect_ratio(width: int, height: int) -> str:
    """Return simplified W:H aspect ratio string."""
    divisor = gcd(width, height)
    return f"{width // divisor}:{height // divisor}"


def _has_alpha_channel(image: Image.Image) -> bool:
    """Return True if the image carries an alpha/transparency channel."""
    return image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )


def _detect_leg_clusters(alpha: np.ndarray) -> int:
    """
    Count disconnected opaque leg clusters in the bottom 5% of the product silhouette.

    Crops to the opaque silhouette bounding box first so outer transparent padding
    does not shift the bottom 5% slice away from the product base.
    """
    ys, xs = np.where(alpha > ALPHA_SOLID_THRESHOLD)
    if len(ys) == 0:
        return 0

    silhouette = alpha[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    sil_h = silhouette.shape[0]
    bottom_slice = silhouette[int(sil_h * 0.95) :, :]
    horizontal_density = (bottom_slice > ALPHA_SOLID_THRESHOLD).sum(axis=0) > 0
    padded = np.pad(horizontal_density.astype(np.int8), (1, 0), constant_values=0)
    return int(np.sum(np.diff(padded) == 1))


def _path_priority(rel_path: str) -> Tuple[int, str]:
    """Prefer canonical `assets/catalog/` paths over `raw_*` folders during deduplication."""
    if rel_path.startswith("assets/catalog/"):
        return (0, rel_path)
    if rel_path.startswith("assets/cutouts/") or rel_path.startswith("assets/environments/"):
        return (1, rel_path)
    if rel_path.startswith("assets/raw_"):
        return (3, rel_path)
    return (2, rel_path)


def _discover_images(assets_dir: Path, repo_root: Path) -> List[Path]:
    """Recursively collect supported image files under `assets_dir`, ordered by priority."""
    discovered: List[Tuple[Tuple[int, str], Path]] = []
    for root, _, filenames in os.walk(assets_dir):
        for filename in filenames:
            if filename.lower().endswith(SUPPORTED_EXTENSIONS):
                full_path = Path(root) / filename
                rel_posix = full_path.relative_to(repo_root).as_posix()
                discovered.append((_path_priority(rel_posix), full_path))
    discovered.sort(key=lambda item: item[0])
    return [item[1] for item in discovered]


def _classify_asset(image_path: Path, rel_path: str, checksum: str) -> Dict[str, Any]:
    """Run the single-pass quality gate, alpha inspection, and grounding classifier."""
    with Image.open(image_path) as im:
        width, height = im.size
        record: Dict[str, Any] = {
            "local_path": rel_path,
            "checksum": checksum,
            "width": width,
            "height": height,
            "resolution": f"{width}x{height}",
            "aspect_ratio": _format_aspect_ratio(width, height),
        }

        # 1. Dimension Check (Quality Gate)
        if width < MIN_WIDTH or height < MIN_HEIGHT:
            record["status"] = "quarantined"
            record["reason"] = "low_res"
            return record

        record["status"] = "valid"

        # 2. Alpha & Grounding Inspection (For Valid Assets)
        if not _has_alpha_channel(im):
            transparent_ratio = 0.0
            alpha: Optional[np.ndarray] = None
        else:
            rgba = im.convert("RGBA")
            alpha = np.asarray(rgba, dtype=np.uint8)[:, :, 3]
            transparent_ratio = float(np.mean(alpha < 255))

        if transparent_ratio < OPAQUE_MAX_TRANSPARENT_RATIO or alpha is None:
            record["intent"] = "lifestyle_scene"
            record["pipeline"] = "scrim_overlay"
        elif transparent_ratio > CUTOUT_MIN_TRANSPARENT_RATIO:
            record["intent"] = "cutout"
            record["pipeline"] = "shadow_engine"
            leg_clusters = _detect_leg_clusters(alpha)
            if leg_clusters >= 2:
                record["grounding_profile"] = "multi_leg"
                record["leg_count"] = leg_clusters
            else:
                record["grounding_profile"] = "flat_slab"
                record["leg_count"] = 1
        else:
            # Ambiguous 5%-10% transparency band: default safely to lifestyle scrim overlay
            record["intent"] = "lifestyle_scene"
            record["pipeline"] = "scrim_overlay"

        return record


def _upsert_manifest(manifest_path: Path, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Upsert curated records into `assets/manifest.json` while preserving existing metadata."""
    if manifest_path.exists():
        with manifest_path.open("r", encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = {
            "schema_version": "1.0.0",
            "brand": "Puffy\u00ae",
            "source": "Google Pomelli",
        }

    existing_assets: List[Dict[str, Any]] = manifest.get("assets", [])
    by_checksum: Dict[str, Dict[str, Any]] = {}
    by_path: Dict[str, Dict[str, Any]] = {}
    for entry in existing_assets:
        if entry.get("checksum"):
            by_checksum[entry["checksum"]] = entry
        if entry.get("local_path"):
            by_path[entry["local_path"]] = entry

    merged_assets: List[Dict[str, Any]] = []
    seen_output_checksums = set()

    for record in records:
        checksum = record["checksum"]
        local_path = record["local_path"]
        existing = by_checksum.get(checksum) or by_path.get(local_path)
        if existing:
            updated = dict(existing)
            updated.update(record)
            # Clear stale fields if asset classification changed
            if updated.get("status") == "quarantined":
                for key in ("intent", "pipeline", "grounding_profile", "leg_count"):
                    updated.pop(key, None)
            else:
                updated.pop("reason", None)
                if updated.get("intent") != "cutout":
                    updated.pop("grounding_profile", None)
                    updated.pop("leg_count", None)
            merged_assets.append(updated)
        else:
            merged_assets.append(record)
        seen_output_checksums.add(checksum)

    # Retain any pre-existing manifest entries whose checksums were not re-scanned
    for entry in existing_assets:
        c = entry.get("checksum")
        if c and c not in seen_output_checksums:
            merged_assets.append(entry)
            seen_output_checksums.add(c)

    manifest["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    manifest["total_assets"] = len(merged_assets)
    manifest["assets"] = merged_assets

    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return manifest


def _print_summary(counts: Dict[str, int], manifest_path: Path) -> None:
    """Print a clean summary table of the single-pass curation run."""
    rows = [
        ("Total Assets Scanned", counts["total_scanned"]),
        ("Quarantined (Low-res)", counts["quarantined"]),
        ("Lifestyle Scenes (Full-bleed)", counts["lifestyle_scene"]),
        ("Cutouts - Flat Slab (Nệm phẳng / Giường sát sàn)", counts["flat_slab"]),
        ("Cutouts - Multi-Leg (Giường có chân)", counts["multi_leg"]),
        ("Duplicates Skipped (SHA-256)", counts["duplicates_skipped"]),
        ("Unique Assets Upserted to Manifest", counts["unique_upserted"]),
    ]
    label_width = max(len(label) for label, _ in rows) + 2
    border = "+" + "-" * (label_width + 2) + "+" + "-" * 10 + "+"

    print("\nPuffy Asset Curation & Grounding Summary")
    print(border)
    print(f"| {'Metric':<{label_width}} | {'Count':>8} |")
    print(border)
    for label, value in rows:
        print(f"| {label:<{label_width}} | {value:>8} |")
    print(border)
    print(f"Manifest updated: {manifest_path}\n")


def run_curation(repo_root: Path, assets_dir: Path, manifest_path: Path) -> Dict[str, int]:
    """Execute the single-pass curation and grounding pipeline."""
    image_paths = _discover_images(assets_dir, repo_root)

    counts = {
        "total_scanned": len(image_paths),
        "quarantined": 0,
        "lifestyle_scene": 0,
        "flat_slab": 0,
        "multi_leg": 0,
        "duplicates_skipped": 0,
        "unique_upserted": 0,
    }

    seen_checksums = set()
    curated_records: List[Dict[str, Any]] = []

    for image_path in image_paths:
        checksum = _compute_sha256(image_path)
        if checksum in seen_checksums:
            counts["duplicates_skipped"] += 1
            continue
        seen_checksums.add(checksum)

        rel_path = image_path.relative_to(repo_root).as_posix()
        record = _classify_asset(image_path, rel_path, checksum)
        curated_records.append(record)

        if record["status"] == "quarantined":
            counts["quarantined"] += 1
        elif record.get("intent") == "lifestyle_scene":
            counts["lifestyle_scene"] += 1
        elif record.get("grounding_profile") == "multi_leg":
            counts["multi_leg"] += 1
        else:
            counts["flat_slab"] += 1

    counts["unique_upserted"] = len(curated_records)
    _upsert_manifest(manifest_path, curated_records)
    _print_summary(counts, manifest_path)
    return counts


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Single-pass asset curation and grounding classification for Puffy assets."
    )
    parser.add_argument(
        "--assets-dir",
        type=Path,
        default=repo_root / "assets",
        help="Root directory of assets to scan (default: <repo>/assets).",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=repo_root / "assets" / "manifest.json",
        help="Path to manifest.json to upsert (default: <repo>/assets/manifest.json).",
    )
    args = parser.parse_args()
    run_curation(repo_root, args.assets_dir.resolve(), args.manifest.resolve())


if __name__ == "__main__":
    main()
