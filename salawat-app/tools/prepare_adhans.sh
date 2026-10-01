#!/usr/bin/env bash
# Downloads the adhan recordings listed in adhans.tsv and re-encodes them to small mono MP3s
# (64 kbps), which are published as a GitHub release the app downloads from.
set -euo pipefail
out="$1"
mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
grep -v '^#' "$here/adhans.tsv" | while IFS=$'\t' read -r id url; do
  [ -z "$id" ] && continue
  curl -fsSL --retry 3 -o "$out/$id.src.mp3" "$url"
  ffmpeg -loglevel error -y -i "$out/$id.src.mp3" -ac 1 -ar 44100 -b:a 64k -map_metadata -1 "$out/$id.mp3"
  rm "$out/$id.src.mp3"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$id.mp3")
  echo "$id $(stat -c %s "$out/$id.mp3") bytes ${dur}s"
done
# Also list everything in the two big collections, to spot more muezzins later.
for item in adhan-mp3-collection SalatTimesMP3Adhan; do
  curl -fsSL "https://archive.org/metadata/$item" | python3 -c "import sys,json;[print('$item', f['name']) for f in json.load(sys.stdin)['files'] if f['name'].endswith('.mp3')]" > "$out/list-$item.txt" || true
done
