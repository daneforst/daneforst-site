#!/bin/bash
# Runs sculpt-encode.sh across every folder in the 3D Sculpture drop.
# Folder name -> slug mapping lives here so it stays in one place.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="/Users/daneforst/Desktop/def-photos/3D Sculpture"
rm -f "$ROOT/tools/sculpt-manifest.txt"

map=(
  "Baron 2.0|baron-2-0"
  "Beast|beast"
  "Bretterling|bretterling"
  "Colossus|colossus"
  "Cyclops|cyclops"
  "Dharbe|dharbe"
  "Galactus|galactus"
  "Gambit|gambit"
  "Magneto|magneto"
  "Minker Ship|minker-ship"
  "Nightcrawler|nightcrawler"
  "Pinok|pinok"
  "Storm|storm"
  "Swamp Thing|swamp-thing"
  "The Baron |the-baron"
  "The Thing|the-thing"
  "Wolverine|wolverine"
)

for row in "${map[@]}"; do
  dir="${row%%|*}"; slug="${row##*|}"
  echo ">>> $slug" >&2
  "$ROOT/tools/sculpt-encode.sh" "$SRC/$dir" "$slug"
done
echo "ALL DONE" >&2
