#!/usr/bin/env bash
# Build the Chrome Web Store upload package.
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
OUT="dist/rename-tab-v${VERSION}.zip"

python3 tools/make_icons.py >/dev/null

mkdir -p dist
rm -f "$OUT"
# The zip must contain manifest.json at its root, not a wrapping folder.
(cd extension && zip -qr "../$OUT" . -x '.*' -x '__MACOSX/*')

echo "Built $OUT"
unzip -l "$OUT"
