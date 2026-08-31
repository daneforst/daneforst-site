#!/bin/bash
# ============================================================
# lab-encode.sh: prepare clips for a Lab dossier page
#
#   ./tools/lab-encode.sh "/path/to/source folder" <slug>
#
# Writes web-sized silent loops + poster stills into
#   assets/video/lab/<slug>/<slug>-NN.mp4
#   assets/img/lab/<slug>/<slug>-NN.jpg
# and prints ready-to-paste <figure> markup for the .mosaic.
#
# Long edge is capped at 1280px, which is the size these clips are
# actually displayed at. Audio is dropped: mosaic clips are loops.
# For a finished spot that needs sound, see PIECE MODE at the bottom.
# ============================================================
set -euo pipefail
export PATH="/usr/local/bin:$PATH"

SRC="${1:-}"; SLUG="${2:-}"
if [ -z "$SRC" ] || [ -z "$SLUG" ]; then
  echo "usage: $0 <source-folder> <slug>" >&2; exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VDIR="$ROOT/assets/video/lab/$SLUG"
IDIR="$ROOT/assets/img/lab/$SLUG"
mkdir -p "$VDIR" "$IDIR"

i=0
find "$SRC" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) | sort | while IFS= read -r f; do
  i=$((i+1)); n=$(printf "%02d" $i)
  W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of default=nw=1:nk=1 "$f" | head -1)
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$f" | head -1)
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")
  if [ "$W" -ge "$H" ]; then SCALE="scale=1280:-2:flags=lanczos"; SHAPE="ar-wide";
  else SCALE="scale=-2:1280:flags=lanczos"; SHAPE="ar-tall"; fi

  ffmpeg -nostdin -y -i "$f" -map 0:v:0 -vf "$SCALE" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium \
    -crf 30 -maxrate 2M -bufsize 4M -g 48 -movflags +faststart -an \
    "$VDIR/$SLUG-$n.mp4" >/dev/null 2>&1

  ffmpeg -nostdin -y -ss 1 -i "$f" -map 0:v:0 -frames:v 1 \
    -vf "scale=900:-2:flags=lanczos" -q:v 4 "$IDIR/$SLUG-$n.jpg" >/dev/null 2>&1

  # markup for the .mosaic on lab/<slug>.html, adjust the span class
  # (m-full / m-two / m-half / m-third / m-quarter / m-bleed) to taste
  cat <<HTML
    <figure class="mo-item m-half $SHAPE reveal">
      <video class="labvid" data-src="assets/video/lab/$SLUG/$SLUG-$n.mp4" poster="assets/img/lab/$SLUG/$SLUG-$n.jpg" muted loop playsinline preload="none"></video>
      <figcaption class="mo-cap"><span class="n">XX-$n</span><span>$(printf '%.1f' "$DUR")s</span></figcaption>
    </figure>
HTML
done

echo "# done -> $VDIR" >&2
echo "#" >&2
echo "# PIECE MODE: a finished spot that should keep its audio," >&2
echo "# rather than a silent mosaic loop:" >&2
echo "#   ffmpeg -nostdin -y -i IN -map 0:v:0 -map 0:a:0? -vf scale=1280:-2 \\" >&2
echo "#     -c:v libx264 -preset slow -crf 31 -maxrate 2200k -bufsize 4400k \\" >&2
echo "#     -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart OUT.mp4" >&2
