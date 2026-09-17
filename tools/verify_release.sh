#!/usr/bin/env bash
# Prove the build published on the Chrome Web Store matches this source tree.
#
# Downloads the signed CRX Chrome itself would install, strips the signature
# header, and diffs the contents against extension/.
#
#   ./tools/verify_release.sh <extension-id>
#
# A clean run prints "MATCH" and nothing else. Anyone can run it - a security
# reviewer does not have to trust the maintainer, only this diff.
set -euo pipefail

ID=${1:?usage: verify_release.sh <extension-id>}
cd "$(dirname "$0")/.."

WORK=$(mktemp -d -t renametab-verify)
trap 'rm -rf "$WORK"' EXIT

URL="https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=120&x=id%3D${ID}%26uc"

echo "Downloading published package for $ID ..."
curl -fsSL "$URL" -o "$WORK/published.crx"

python3 - "$WORK/published.crx" "$WORK/published.zip" <<'PY'
import struct, sys

src, dst = sys.argv[1], sys.argv[2]
blob = open(src, "rb").read()
if blob[:4] != b"Cr24":
    sys.exit("not a CRX file")

version = struct.unpack("<I", blob[4:8])[0]
if version == 3:
    header_len = struct.unpack("<I", blob[8:12])[0]
    offset = 12 + header_len
elif version == 2:
    pubkey_len, sig_len = struct.unpack("<II", blob[8:16])
    offset = 16 + pubkey_len + sig_len
else:
    sys.exit(f"unsupported CRX version {version}")

open(dst, "wb").write(blob[offset:])
print(f"stripped CRX{version} header ({offset} bytes)")
PY

mkdir -p "$WORK/published"
unzip -q "$WORK/published.zip" -d "$WORK/published"

# _metadata/ is added by the Web Store at signing time and is not part of the
# uploaded source, so it is excluded from the comparison.
rm -rf "$WORK/published/_metadata"

if diff -r --brief "$WORK/published" extension >/dev/null; then
  echo "MATCH — the published extension is byte-for-byte this source tree."
else
  echo "DIFFERENCES FOUND:"
  diff -r "$WORK/published" extension || true
  exit 1
fi
