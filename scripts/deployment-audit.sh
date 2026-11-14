#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Puffy AI Creative Engine: Deployment Audit ==="

# 1. Cache eviction: purge node_modules/.vite across workspace
echo "[1/3] Purging Vite caches (node_modules/.vite)..."
find "$ROOT_DIR" -type d -path "*/node_modules/.vite" -prune -exec rm -rf {} +

# 2. Config & Schema JSON syntax verification
echo "[2/3] Validating JSON configuration and schemas..."
while IFS= read -r -d '' json_file; do
  python3 -m json.tool "$json_file" > /dev/null
  echo "  OK: ${json_file#"$ROOT_DIR/"}"
done < <(find "$ROOT_DIR/config" -type f -name "*.json" -print0)

# 3. Bundle hash verification (when webapp/dist exists)
echo "[3/3] Checking bundle hash integrity..."
DIST_DIR="$ROOT_DIR/webapp/dist"
HASH_FILE="$ROOT_DIR/.agent/last_bundle_hash"

if [ -d "$DIST_DIR" ]; then
  CURRENT_HASH="$(find "$DIST_DIR" -type f | sort | xargs sha256sum | sha256sum | awk '{print $1}')"
  if [ -f "$HASH_FILE" ]; then
    PREV_HASH="$(cat "$HASH_FILE")"
    if [ "$CURRENT_HASH" = "$PREV_HASH" ]; then
      echo "  WARNING: Bundle hash unchanged ($CURRENT_HASH). Verify build output before deploying." >&2
      exit 1
    fi
  fi
  echo "$CURRENT_HASH" > "$HASH_FILE"
  echo "  OK: Bundle hash verified and mutated ($CURRENT_HASH)."
else
  echo "  SKIP: webapp/dist not present (pre-build repository state)."
fi

echo "=== Deployment Audit Passed ==="
