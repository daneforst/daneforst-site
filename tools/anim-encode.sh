#!/bin/bash
# ============================================================
# anim-encode.sh: prepare media for the Animation wing
#
#   ./tools/anim-encode.sh clip   <slug> <name> <source-file>
#   ./tools/anim-encode.sh film   <slug> <name> <source-file>
#   ./tools/anim-encode.sh stills <slug> <source-folder>
#
# clip   silent, looping, web-sized. For hero backdrops and the
#        tiles on animation.html. No audio track at all, because a
#        tile that autoplays sound is a tile people close.
# film   the finished piece or a timelapse: keeps audio, keeps its
#        full length, gets real controls on the page. Encoded a
#        notch better than a clip since somebody actually watches
#        this one all the way through.
# stills every image in a folder, numbered, max 2000px, stripped
#        of camera metadata.
#
# Everything lands in
#   assets/video/animation/<slug>/<slug>-<name>.mp4
#   assets/img/animation/<slug>/<slug>-<name>.jpg   (poster)
#   assets/img/animation/<slug>/<slug>-NN.jpg       (stills)
#
# Why the settings differ from sculpt-encode.sh: these are flat
# vector-ish frames with large areas of one colour and a halftone
# dot screen over the top. The dots are the whole look, so no
# denoise pass here -- it eats them. Instead the bitrate ceiling is
# higher and the GOP shorter, which is what keeps a dot screen from
# turning into porridge on a dark gradient.
# ============================================================
set -euo pipefail
export PATH="/usr/local/bin:$PATH"

MODE="${1:-}"; SLUG="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage(){ echo "usage: $0 clip|film <slug> <name> <file>   |   $0 stills <slug> <folder>" >&2; exit 1; }
[ -z "$MODE" ] || [ -z "$SLUG" ] && usage

VDIR="$ROOT/assets/video/animation/$SLUG"
IDIR="$ROOT/assets/img/animation/$SLUG"
mkdir -p "$VDIR" "$IDIR"

case "$MODE" in

clip)
  NAME="${3:-}"; SRC="${4:-}"
  [ -z "$NAME" ] || [ -z "$SRC" ] && usage
  # 1600px on the long edge is the most a full-bleed backdrop can
  # use on a 2x laptop before the file grows faster than the look.
  ffmpeg -nostdin -y -i "$SRC" -map 0:v:0 \
    -vf "fps=24,scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))':flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow \
    -crf 26 -maxrate 2600k -bufsize 5200k -g 24 -movflags +faststart -an \
    "$VDIR/$SLUG-$NAME.mp4"
  ffmpeg -nostdin -y -ss 1 -i "$SRC" -map 0:v:0 -frames:v 1 \
    -vf "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))':flags=lanczos" \
    -q:v 4 "$IDIR/$SLUG-$NAME.jpg"
  ;;

film)
  NAME="${3:-}"; SRC="${4:-}"
  [ -z "$NAME" ] || [ -z "$SRC" ] && usage
  ffmpeg -nostdin -y -i "$SRC" \
    -vf "scale='min(1280,iw)':-2:flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow \
    -crf 24 -maxrate 2200k -bufsize 4400k -g 48 -movflags +faststart \
    -c:a aac -b:a 128k -ac 2 \
    "$VDIR/$SLUG-$NAME.mp4"
  # poster from a third of the way in: the opening frame of a
  # timelapse is a blank canvas, which is a poor advertisement
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$SRC")
  AT=$(awk -v d="$DUR" 'BEGIN{printf "%.2f", (d>6 ? d/3 : 0)}')
  ffmpeg -nostdin -y -ss "$AT" -i "$SRC" -map 0:v:0 -frames:v 1 \
    -vf "scale='min(1280,iw)':-2:flags=lanczos" -q:v 4 "$IDIR/$SLUG-$NAME.jpg"
  ;;

stills)
  SRCDIR="${3:-}"
  [ -z "$SRCDIR" ] && usage
  i=0
  find "$SRCDIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) \
    ! -name '._*' | sort | while IFS= read -r f; do
    i=$((i+1)); n=$(printf "%02d" $i)
    ffmpeg -nostdin -y -i "$f" \
      -vf "scale='min(2000,iw)':-2:flags=lanczos" -map_metadata -1 -q:v 3 \
      "$IDIR/$SLUG-$n.jpg" >/dev/null 2>&1
    echo "  $n  <-  $(basename "$f")"
  done
  ;;

*) usage ;;
esac

echo "done: $MODE $SLUG"
