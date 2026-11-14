"""
Puffy AI Creative Engine - Unified Asset Processing CLI Runner
Combines 75% Grid Normalization, 2-Layer Contour Shadowing, and Manifest Indexing.
"""

from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from PIL import Image, ImageFilter

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from grid_normalizer import resolve_canvas_size  # noqa: E402
from shadow_engine import apply_puffy_contour_shadow  # noqa: E402

DEFAULT_INPUT = "assets/raw_mattress"
DEFAULT_OUTPUT = "assets/catalog/processed"
DEFAULT_MANIFEST = "assets/manifest.json"
IMAGE_EXTENSIONS = {".png", ".webp"}


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _aspect_ratio_label(width: int, height: int) -> str:
    divisor = math.gcd(width, height)
    return f"{width // divisor}:{height // divisor}"


def _parse_canvas_size(raw: str) -> Tuple[int, int]:
    if "x" in raw.lower():
        w_str, h_str = raw.lower().split("x", 1)
        return resolve_canvas_size((int(w_str), int(h_str)))
    return resolve_canvas_size(int(raw))


def _collect_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        return []
    files: List[Path] = []
    for root, _, filenames in os.walk(input_path):
        for name in sorted(filenames):
            candidate = Path(root) / name
            if candidate.suffix.lower() in IMAGE_EXTENSIONS:
                files.append(candidate)
    return files


def _resolve_output_path(
    src_file: Path, input_root: Path, output_root: Path, single_file_mode: bool
) -> Path:
    if single_file_mode and output_root.suffix.lower() == ".png":
        return output_root
    if input_root.is_dir():
        rel = src_file.relative_to(input_root)
        return (output_root / rel).with_suffix(".png")
    return output_root / f"{src_file.stem}.png"


def _repo_relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(Path.cwd().resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def update_manifest(manifest_path: Path, processed_records: List[Dict[str, Any]]) -> None:
    """Upsert processed asset entries into assets/manifest.json without clobbering existing data."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    if manifest_path.exists():
        with manifest_path.open("r", encoding="utf-8") as fh:
            manifest = json.load(fh)
    else:
        manifest = {
            "schema_version": "1.0.0",
            "brand": "Puffy®",
            "source": "Puffy AI Creative Engine",
            "updated_at": now_iso,
            "total_assets": 0,
            "assets": [],
        }

    existing_assets: List[Dict[str, Any]] = manifest.get("assets", [])
    by_path = {
        entry.get("local_path"): idx
        for idx, entry in enumerate(existing_assets)
        if entry.get("local_path")
    }

    for rec in processed_records:
        out_path = Path(rec["output"])
        rel_path = _repo_relative(out_path)
        w, h = (int(x) for x in rec["resolution"].split("x"))
        entry = {
            "sku": f"PUFFY-PROC-{out_path.stem.upper()[:16]}",
            "name": out_path.stem.replace("_", " ").replace("-", " ").title(),
            "category": "processed",
            "local_path": rel_path,
            "source_input": _repo_relative(Path(rec["input"])),
            "downloaded_at": now_iso,
            "checksum": _sha256_file(out_path),
            "aspect_ratio": _aspect_ratio_label(w, h),
            "resolution": rec["resolution"],
            "processing_ms": rec["elapsed_ms"],
            "tags": ["zero-drift", "contour-shadow", "grid-75", "processed"],
        }
        if rel_path in by_path:
            existing_assets[by_path[rel_path]] = entry
        else:
            by_path[rel_path] = len(existing_assets)
            existing_assets.append(entry)

    manifest["assets"] = existing_assets
    manifest["total_assets"] = len(existing_assets)
    manifest["updated_at"] = now_iso

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def remove_background_to_rgba(image: Image.Image, tolerance: float = 30.0) -> Image.Image:
    """Remove background on-demand using rembg if available, else edge-connected alpha heuristic."""
    try:
        from rembg import remove  # type: ignore

        return remove(image.convert("RGBA")).convert("RGBA")
    except ImportError:
        pass

    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.float32)
    h, w, _ = arr.shape
    rgb = arr[:, :, :3]
    orig_alpha = arr[:, :, 3]

    # Estimate background color from outer 1px border median
    border_pixels = np.concatenate(
        [rgb[0, :], rgb[h - 1, :], rgb[:, 0], rgb[:, w - 1]], axis=0
    )
    bg_color = np.median(border_pixels, axis=0)
    dist = np.linalg.norm(rgb - bg_color, axis=2)

    # Flood-fill from all border pixels within color tolerance so interior highlights stay intact
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    queue: deque[Tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if dist[y, x] <= tolerance and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dist[y, x] <= tolerance and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))

    while queue:
        cy, cx = queue.popleft()
        bg_mask[cy, cx] = True
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if dist[ny, nx] <= tolerance:
                    visited[ny, nx] = True
                    queue.append((ny, nx))

    new_alpha = np.where(bg_mask, 0.0, orig_alpha).astype(np.uint8)
    alpha_img = Image.fromarray(new_alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=0.8))
    # Keep interior fully opaque where it was originally opaque and not adjacent to bg_mask
    soft_alpha = np.minimum(orig_alpha, np.array(alpha_img, dtype=np.float32)).astype(np.uint8)

    out = rgba.copy()
    out.putalpha(Image.fromarray(soft_alpha, mode="L"))
    return out


def run_pipeline(
    input_path: str = DEFAULT_INPUT,
    output_path: str = DEFAULT_OUTPUT,
    canvas_size: Tuple[int, int] = (1024, 1024),
    manifest_path: str | None = DEFAULT_MANIFEST,
    trim_transparent: bool = True,
    remove_bg: bool = False,
) -> Dict[str, Any]:
    in_root = Path(input_path)
    out_root = Path(output_path)
    files = _collect_inputs(in_root)

    if not files:
        return {
            "status": "skipped",
            "reason": f"No PNG/WebP inputs found at {input_path}",
            "processed_count": 0,
            "results": [],
        }

    single_mode = in_root.is_file()
    results: List[Dict[str, Any]] = []
    for src_file in files:
        dest_file = _resolve_output_path(src_file, in_root, out_root, single_mode)
        if remove_bg:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_bg_path = Path(tmp.name)
            try:
                with Image.open(src_file) as img:
                    cutout = remove_background_to_rgba(img)
                    cutout.save(tmp_bg_path, "PNG")
                res = apply_puffy_contour_shadow(
                    str(tmp_bg_path),
                    str(dest_file),
                    canvas_size=canvas_size,
                    trim_transparent=trim_transparent,
                )
                res["input"] = str(src_file)
                res["bg_removed"] = True
            finally:
                if tmp_bg_path.exists():
                    tmp_bg_path.unlink()
        else:
            res = apply_puffy_contour_shadow(
                str(src_file),
                str(dest_file),
                canvas_size=canvas_size,
                trim_transparent=trim_transparent,
            )
        results.append(res)

    if manifest_path:
        update_manifest(Path(manifest_path), results)

    return {
        "status": "success",
        "processed_count": len(results),
        "manifest_updated": bool(manifest_path),
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the Puffy AI Creative Engine (75% Grid + 2-Layer Contour Shadow)."
    )
    parser.add_argument(
        "--input",
        default=DEFAULT_INPUT,
        help=f"Input PNG/WebP file or directory (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output PNG file or directory (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--canvas-size",
        default="1024",
        help="Target canvas size as N or WxH (default: 1024)",
    )
    parser.add_argument(
        "--manifest",
        default=DEFAULT_MANIFEST,
        help=f"Manifest JSON path to update (default: {DEFAULT_MANIFEST})",
    )
    parser.add_argument(
        "--no-manifest",
        action="store_true",
        help="Skip updating assets/manifest.json",
    )
    parser.add_argument(
        "--no-trim",
        action="store_true",
        help="Disable transparent outer border trimming before 75%% grid fit",
    )
    parser.add_argument(
        "--remove-bg",
        action="store_true",
        help="Run on-demand background removal (rembg or alpha mask heuristic) before compositing",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print structured JSON summary (for CI/CD, Docker, n8n, or Dify)",
    )
    args = parser.parse_args()

    summary = run_pipeline(
        input_path=args.input,
        output_path=args.output,
        canvas_size=_parse_canvas_size(args.canvas_size),
        manifest_path=None if args.no_manifest else args.manifest,
        trim_transparent=not args.no_trim,
        remove_bg=args.remove_bg,
    )

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(
            f"Pipeline finished: {summary['processed_count']} asset(s) processed "
            f"(status={summary['status']})."
        )


if __name__ == "__main__":
    main()
