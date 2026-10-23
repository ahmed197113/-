#!/usr/bin/env bash
# يبني لوحة الويب ويجمعها مع خادم PHP في مجلد واحد وملف mawqi-siteground.zip
# جاهز للرفع وفكه في جذر النطاق الفرعي على SiteGround.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/siteground"

(cd "$ROOT/web" && npm ci --no-audit --no-fund && npm run build)

rm -rf "$OUT" "$ROOT/dist/mawqi-siteground.zip"
mkdir -p "$OUT"
cp -r "$ROOT/web/dist/." "$OUT/"
cp "$ROOT/server/api.php" "$ROOT/server/.htaccess" "$ROOT/server/.user.ini" "$OUT/"
cp -r "$ROOT/server/lib" "$ROOT/server/data" "$OUT/"
(cd "$OUT" && zip -qr -X "$ROOT/dist/mawqi-siteground.zip" .)
echo "$ROOT/dist/mawqi-siteground.zip"
