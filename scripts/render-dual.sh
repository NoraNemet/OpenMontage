#!/usr/bin/env bash
# scripts/render-dual.sh
# Usage: ./scripts/render-dual.sh <scene-plan.json> <output-dir>
set -euo pipefail

SCENE_PLAN="${1:?Usage: render-dual.sh <scene-plan.json> <output-dir>}"
OUTPUT_DIR="${2:?Usage: render-dual.sh <scene-plan.json> <output-dir>}"
REELS_PLAN="${SCENE_PLAN%.json}-reels.json"

mkdir -p "$OUTPUT_DIR"

echo "Generating Reels scene plan..."
python3 "$(dirname "$0")/reflow-for-reels.py" "$SCENE_PLAN" "$REELS_PLAN"

echo "Rendering 16:9 LinkedIn video..."
cd "$(dirname "$0")/../remotion-composer"
npx remotion render Explainer \
  --props "$(realpath "$SCENE_PLAN")" \
  --output "$(realpath "$OUTPUT_DIR")/flowstart-linkedin.mp4"

echo "Rendering 9:16 Reels video..."
npx remotion render Explainer9x16 \
  --props "$(realpath "$REELS_PLAN")" \
  --output "$(realpath "$OUTPUT_DIR")/flowstart-reels.mp4"

echo "Done. Output:"
ls -lh "$(realpath "$OUTPUT_DIR")"/*.mp4
