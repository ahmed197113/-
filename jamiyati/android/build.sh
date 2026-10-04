#!/usr/bin/env bash
# بناء APK لتطبيق جمعيتي دون Android Studio أو Gradle.
# الأدوات تُنزّل مرة واحدة إلى android/.tools من npm وMaven Central وGitHub:
#   aapt2 (حزمة aaptjs3)، android.jar (API 33)، dx (dalvik-dx)، apksig (التوقيع v1+v2).
# الاستخدام:  cd jamiyati && npm run apk      →  الناتج: jamiyati/release/jamiyati.apk
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
TOOLS="$HERE/.tools"
OUT="$HERE/.build"
VERSION_NAME="$(node -p "require('$ROOT/package.json').version")"
VERSION_CODE="${VERSION_CODE:-$(node -p "const [a,b,c]=require('$ROOT/package.json').version.split('.').map(Number);a*10000+b*100+c")}"
KEYSTORE="${JAMIYATI_KEYSTORE:-$HOME/.jamiyati/release.p12}"
KEY_ALIAS="${JAMIYATI_KEY_ALIAS:-jamiyati}"
KEY_PASS="${JAMIYATI_KEY_PASS:-}"

mkdir -p "$TOOLS" "$OUT"

# ───── الأدوات ─────
if [ ! -x "$TOOLS/aapt2" ]; then
  (cd "$TOOLS" && npm pack aaptjs3@2.0.2 --silent >/dev/null && tar xzf aaptjs3-2.0.2.tgz && cp package/bin/x64/linux/aapt2 aapt2 && chmod +x aapt2 && rm -rf package aaptjs3-2.0.2.tgz)
fi
[ -f "$TOOLS/android.jar" ] || curl -fsSL -o "$TOOLS/android.jar" https://raw.githubusercontent.com/Sable/android-platforms/master/android-33/android.jar
[ -f "$TOOLS/dx.jar" ] || curl -fsSL -o "$TOOLS/dx.jar" https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
[ -f "$TOOLS/apksig.jar" ] || curl -fsSL -o "$TOOLS/apksig.jar" https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar

# ───── مفتاح التوقيع (يُنشأ مرة واحدة ويجب الاحتفاظ به لتحديث التطبيق لاحقاً) ─────
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  [ -n "$KEY_PASS" ] || KEY_PASS="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEY_PASS" -keypass "$KEY_PASS" -dname "CN=Jamiyati, O=Jamiyati, C=SA" >/dev/null 2>&1
  echo "$KEY_PASS" > "$KEYSTORE.pass"
  chmod 600 "$KEYSTORE" "$KEYSTORE.pass"
  echo "⚠️  أُنشئ مفتاح توقيع جديد: $KEYSTORE (كلمة المرور في $KEYSTORE.pass) — احتفظ بهما لتحديث التطبيق."
fi
[ -n "$KEY_PASS" ] || KEY_PASS="$(cat "$KEYSTORE.pass")"

# ───── 1) بناء الواجهة ─────
(cd "$ROOT" && npx vite build --logLevel warn)
rm -rf "$OUT"/*
mkdir -p "$OUT/assets/www" "$OUT/res_flat" "$OUT/classes" "$OUT/gen/app/jamiyati"
cp -r "$ROOT/dist/." "$OUT/assets/www/"
rm -f "$OUT/assets/www/sw.js"

# ───── 2) الموارد والـ Manifest ─────
"$TOOLS/aapt2" compile --dir "$HERE/res" -o "$OUT/res_flat"
"$TOOLS/aapt2" link -o "$OUT/unsigned.apk" -I "$TOOLS/android.jar" \
  --manifest "$HERE/AndroidManifest.xml" --min-sdk-version 24 --target-sdk-version 33 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" "$OUT"/res_flat/*.flat

# ───── 3) الكود الأصلي ─────
cat > "$OUT/gen/app/jamiyati/BuildInfo.java" <<JAVA
package app.jamiyati;
final class BuildInfo { static final String VERSION = "$VERSION_NAME"; }
JAVA
javac -nowarn -source 8 -target 8 -encoding UTF-8 -Xlint:-options -bootclasspath "$TOOLS/android.jar" \
  -d "$OUT/classes" $(find "$HERE/src" "$OUT/gen" -name '*.java') 2>&1 | grep -v "^Picked up" || true
[ -f "$OUT/classes/app/jamiyati/MainActivity.class" ] || { echo "فشل تجميع Java"; exit 1; }
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes" 2>&1 | grep -v "^Picked up" || true
[ -f "$OUT/classes.dex" ] || { echo "فشل dx"; exit 1; }
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)

# ───── 4) المحاذاة والتوقيع ─────
python3 "$HERE/tools/align.py" "$OUT/unsigned.apk" "$OUT/aligned.apk"
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$OUT" "$HERE/tools/Signer.java" 2>&1 | grep -v "^Picked up" || true
mkdir -p "$ROOT/release"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$OUT:$TOOLS/apksig.jar" Signer "$OUT/aligned.apk" "$ROOT/release/jamiyati.apk" "$KEYSTORE" "$KEY_ALIAS" "$KEY_PASS" 2>&1 | grep -v "^Picked up"
"$TOOLS/aapt2" dump badging "$ROOT/release/jamiyati.apk" | head -3
ls -la "$ROOT/release/jamiyati.apk"
