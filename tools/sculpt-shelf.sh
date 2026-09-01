#!/bin/bash
# ============================================================
# sculpt-shelf.sh: stills for the home page sculpture shelf
#
#   ./tools/sculpt-shelf.sh
#
# Pulls one frame per piece out of the encoded turntables and
# writes it to assets/img/arrival/sculpt/<slug>.jpg at 840px
# tall. The shelf fills the whole band now, about 420px, so this is
# 2x that for retina.
# The shelf runs them at full band height, so each keeps its own
# aspect and they tile into a continuous strip.
#
# The frame chosen per piece is hand-picked: "<slug> <clip-nn>
# <seconds-in>". Change a number here and re-run to swap a still.
# ============================================================
set -euo pipefail
export PATH="/usr/local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/img/arrival/sculpt"
mkdir -p "$OUT"

while read -r slug clip at; do
  [ -z "$slug" ] && continue
  SRC="$ROOT/assets/video/sculpture/$slug/$slug-$clip.mp4"
  [ -f "$SRC" ] || { echo "missing $SRC" >&2; continue; }
  ffmpeg -nostdin -y -ss "$at" -i "$SRC" -frames:v 1 \
    -vf "scale=-2:840:flags=lanczos" -q:v 4 "$OUT/$slug.jpg" >/dev/null 2>&1
  echo "$slug.jpg"
done <<'PICKS'
baron-2-0 01 6
galactus 03 5
the-thing 02 5
swamp-thing 04 6
beast 05 6
nightcrawler 03 5
pinok 02 5
magneto 04 5
gambit 06 5
colossus 03 5
dharbe 04 5
minker-ship 02 6
PICKS
