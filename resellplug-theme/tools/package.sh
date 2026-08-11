#!/usr/bin/env bash
# Package the theme for Shopify's "Upload zip" flow.
#
# Shopify expects the theme directories at the root of the archive, and will
# reject an archive containing directories it does not recognise — so tools/
# and the README stay out of it.
set -euo pipefail

cd "$(dirname "$0")/.."

python3 tools/check.py
python3 tools/render.py

OUT="${1:-../resellplug-theme.zip}"
rm -f "$OUT"

zip -r -q "$OUT" \
  assets blocks config layout locales sections snippets templates \
  -x '*.DS_Store' '__MACOSX/*'

echo "wrote $(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
unzip -l "$OUT" | tail -1
