#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d assets ] || [ "${1:-}" = "--assets" ]; then node assets.mjs; fi
node build.mjs
python -I animate.py out/deck-raw.pptx out/deck-anim.pptx
W=$(cygpath -w "$PWD")
powershell.exe -NoProfile -ExecutionPolicy Bypass -File export.ps1 -Source "$W\\out\\deck-anim.pptx" -Pptx "$W\\out\\Datum.pptx" -Pdf "$W\\out\\Datum.pdf" -Shots "$W\\out\\shots"
