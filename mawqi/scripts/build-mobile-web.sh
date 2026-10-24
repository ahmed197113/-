#!/usr/bin/env bash
# Builds the phone app as an installable web app into mawqi/mobile-web (served by the server at /m).
set -euo pipefail
cd "$(dirname "$0")/../mobile"
rm -rf ../mobile-web
npx expo export -p web --output-dir ../mobile-web --clear
echo "{\"v\":\"$(date -u +%Y%m%d%H%M%S)\"}" > ../mobile-web/version.json
du -sh ../mobile-web
