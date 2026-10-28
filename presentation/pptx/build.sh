#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d assets ] || [ "${1:-}" = "--assets" ]; then node assets.mjs; fi
node build.mjs
STAMP=$(date +%s)
python -I animate.py out/deck-raw.pptx "out/deck-anim-$STAMP.pptx" out/plan.json
TARGET="Datum"
if ! ( : >> out/Datum.pptx ) 2>/dev/null; then TARGET="Datum-$STAMP"; fi
W=$(cygpath -w "$PWD")
powershell.exe -NoProfile -ExecutionPolicy Bypass -File export.ps1 -Source "$W\\out\\deck-anim-$STAMP.pptx" -Pptx "$W\\out\\$TARGET.pptx" -Pdf "$W\\out\\$TARGET.pdf" -Shots "$W\\out\\shots"
rm -f out/deck-anim-*.pptx 2>/dev/null || true
echo "out/$TARGET.pptx"
