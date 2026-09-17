#!/usr/bin/env bash
# Fit a screenshot onto the 1280x800 canvas the Chrome Web Store expects,
# padding the leftover space with the extension's indigo.
#
#   ./tools/make_screenshot.sh ~/Desktop/shot.png store-assets/screenshot-1.png
set -euo pipefail

SRC=${1:?usage: make_screenshot.sh <source.png> [destination.png]}
DST=${2:-store-assets/screenshot.png}
PAD_COLOR=4F46E5
CANVAS_W=1280
CANVAS_H=800
MARGIN=48

command -v sips >/dev/null || { echo "sips not found (macOS only)" >&2; exit 1; }

mkdir -p "$(dirname "$DST")"
TMP=$(mktemp -t renametab-shot).png
trap 'rm -f "$TMP"' EXIT

W=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/{print $2}')

MAX_DIM=$(python3 -c "
w, h = $W, $H
fit = min(($CANVAS_W - 2 * $MARGIN) / w, ($CANVAS_H - 2 * $MARGIN) / h, 1.0)
print(round(max(w, h) * fit))
")

sips -Z "$MAX_DIM" "$SRC" --out "$TMP" >/dev/null
sips -p "$CANVAS_H" "$CANVAS_W" --padColor "$PAD_COLOR" "$TMP" --out "$DST" >/dev/null 2>&1

echo "$DST -> $(sips -g pixelWidth -g pixelHeight "$DST" | awk '/pixel/{printf "%s ", $2}')"
