#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-candidate-image> [output-dir]" >&2
  exit 1
fi

INPUT_IMAGE="$1"
if [[ ! -f "$INPUT_IMAGE" ]]; then
  echo "Error: Input image not found: $INPUT_IMAGE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${2:-$REPO_ROOT/pipelines/banner_engine/out}"

BASE_NAME="$(basename "$INPUT_IMAGE")"
STEM="${BASE_NAME%.*}"
SHADOWED_DIR="$REPO_ROOT/pipelines/banner_engine/assets/shadowed"
SHADOWED_OUT="$SHADOWED_DIR/${STEM}_candidate_shadowed.png"

mkdir -p "$SHADOWED_DIR" "$OUT_DIR"

START_TS="$(python3 -c 'import time; print(time.perf_counter())')"

echo "[1/2] Normalizing & applying Zero-Gap contact shadow via run_pipeline.py..."
python3 "$REPO_ROOT/scripts/run_pipeline.py" \
  --input "$INPUT_IMAGE" \
  --output "$SHADOWED_OUT" \
  --no-manifest

echo "[2/2] Rendering 3 banner viewports (1440x900, 1080x1080, 1080x1920)..."
node "$REPO_ROOT/pipelines/banner_engine/render.mjs" \
  --cutout "$SHADOWED_OUT" \
  --pre-shadowed \
  --out "$OUT_DIR"

ELAPSED="$(python3 -c "import time; print(f'{time.perf_counter() - float($START_TS):.2f}s')")"
echo "Done in ${ELAPSED}. Banners saved to: $OUT_DIR"
