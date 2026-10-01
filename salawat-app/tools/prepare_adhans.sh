#!/usr/bin/env bash
# Downloads the adhan recordings listed in adhans.tsv and re-encodes them to small mono MP3s
# (64 kbps), which are published as a GitHub release the app downloads from.
set -euo pipefail
out="$1"
mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
pip install -q imageio-ffmpeg
ffmpeg="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
grep -v '^#' "$here/adhans.tsv" | while IFS=$'\t' read -r id url; do
  [ -z "$id" ] && continue
  curl -fsSL --retry 3 -o "$out/$id.src.mp3" "$url" < /dev/null
  "$ffmpeg" -nostdin -loglevel error -y -i "$out/$id.src.mp3" -ac 1 -ar 44100 -b:a 64k -map_metadata -1 "$out/$id.mp3"
  echo "$id src=$(stat -c %s "$out/$id.src.mp3") out=$(stat -c %s "$out/$id.mp3")"
  rm "$out/$id.src.mp3"
done
