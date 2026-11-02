#!/usr/bin/env bash
# Generate HLS assets for CVP video banner (same pattern as vikki-one-connect).
#
# Usage:
#   ./scripts/generate-hls.sh <input.mp4> <output-assets-dir>
#
# Example (home-loan-cvp):
#   ./scripts/generate-hls.sh ~/Downloads/compressed.mp4 \
#     ../vikki-cvp/home-loan-cvp/assets
#
# Requires: ffmpeg

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input.mp4> <output-assets-dir>"
  exit 1
fi

INPUT="$1"
OUT_DIR="$2"
VIDEO_DIR="$OUT_DIR/video"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install with: brew install ffmpeg"
  exit 1
fi

mkdir -p "$VIDEO_DIR"
cp "$INPUT" "$OUT_DIR/video.mp4"

ffmpeg -y -i "$INPUT" -ss 00:00:00 -vframes 1 -update 1 "$OUT_DIR/poster.jpg"

ffmpeg -y -i "$INPUT" \
  -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -hls_time 3 -hls_list_size 0 \
  -hls_segment_filename "$VIDEO_DIR/playlist%d.ts" \
  "$VIDEO_DIR/playlist.m3u8"

echo "Done."
echo "  $OUT_DIR/video.mp4"
echo "  $OUT_DIR/poster.jpg"
echo "  $VIDEO_DIR/playlist.m3u8"
