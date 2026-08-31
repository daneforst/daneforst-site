#!/bin/bash
# ============================================================
# sculpt-encode.sh: prepare turntable clips for the Sculpture wing
#
#   ./tools/sculpt-encode.sh "/path/to/source folder" <slug>
#
# Writes web-sized silent loops + poster stills into
#   assets/video/sculpture/<slug>/<slug>-NN.mp4
#   assets/img/sculpture/<slug>/<slug>-NN.jpg
# and appends a row per clip to tools/sculpt-manifest.txt, which
# tools/sculpt-build.py reads to write the page markup.
#
# Why these settings, since they are stricter than lab-encode.sh:
#   - the recordings come off the phone at 1440x1920 and 60-120fps,
#     which is several times more of both than a looping tile needs
#   - the sculpts carry a fine dither over every surface. Left alone
#     it triples the bitrate and reads as noise on the web, so a
#     light hqdn3d pass runs first. It buys more than any crf bump.
#   - clips are capped at 20s. A few runs go past a minute, and a
#     tile nobody watches to the end should not cost the visitor
#     the download.
# Together these land around 60KB/s, roughly a third of what the
# same clips cost untreated.
#
# Shape is read off the ENCODED file, not the source: these are
# screen recordings carrying rotation metadata, so the stored
# width/height are sideways to what actually gets displayed.
# ============================================================
set -euo pipefail
export PATH="/usr/local/bin:$PATH"

SRC="${1:-}"; SLUG="${2:-}"
if [ -z "$SRC" ] || [ -z "$SLUG" ]; then
  echo "usage: $0 <source-folder> <slug>" >&2; exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VDIR="$ROOT/assets/video/sculpture/$SLUG"
IDIR="$ROOT/assets/img/sculpture/$SLUG"
mkdir -p "$VDIR" "$IDIR"

i=0
find "$SRC" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) | sort | while IFS= read -r f; do
  i=$((i+1)); n=$(printf "%02d" $i)

  ffmpeg -nostdin -y -i "$f" -t 20 -map 0:v:0 \
    -vf "fps=24,hqdn3d=4:3:6:6,scale='min(960,iw)':'min(960,ih)':force_original_aspect_ratio=decrease:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium \
    -crf 34 -maxrate 750k -bufsize 1500k -g 48 -movflags +faststart -an \
    "$VDIR/$SLUG-$n.mp4" >/dev/null 2>&1

  # a second in, unless the clip is shorter than that, in which case
  # take the first frame rather than writing nothing at all
  POSTER_AT=1
  awk -v d="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")" \
      'BEGIN{exit !(d < 1.2)}' && POSTER_AT=0
  ffmpeg -nostdin -y -ss "$POSTER_AT" -i "$f" -map 0:v:0 -frames:v 1 \
    -vf "scale=720:720:force_original_aspect_ratio=decrease:flags=lanczos" \
    -q:v 5 "$IDIR/$SLUG-$n.jpg" >/dev/null 2>&1

  W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of default=nw=1:nk=1 "$VDIR/$SLUG-$n.mp4" | head -1)
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$VDIR/$SLUG-$n.mp4" | head -1)
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VDIR/$SLUG-$n.mp4")

  printf '%s|%s|%s|%s|%.1f\n' "$SLUG" "$n" "$W" "$H" "$DUR" >> "$ROOT/tools/sculpt-manifest.txt"
done

echo "# done -> $VDIR" >&2
