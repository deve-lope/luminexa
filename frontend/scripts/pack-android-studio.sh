#!/usr/bin/env bash
# Pack Capacitor Android for Android Studio (includes sibling node_modules).
# Usage: from repo root or frontend/
#   ./frontend/scripts/pack-android-studio.sh [version-label]
# Example: ./frontend/scripts/pack-android-studio.sh v7
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$ROOT/frontend"
LABEL="${1:-v$(date +%Y%m%d%H%M)}"
OUT_DIR="/tmp/luminexa-android-pack-${LABEL}"
ZIP_NAME="luminexa-android-studio-${LABEL}.zip"
ZIP_PATH="$ROOT/$ZIP_NAME"

cd "$FRONTEND"

if [[ ! -d node_modules/@capacitor/android ]]; then
  echo "Missing node_modules — run npm install in frontend first." >&2
  exit 1
fi

if command -v npx >/dev/null 2>&1; then
  npx cap sync android
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/frontend/node_modules/@capacitor" "$OUT_DIR/frontend/node_modules/@capawesome"

rsync -a \
  --exclude='.gradle' \
  --exclude='**/build' \
  --exclude='local.properties' \
  --exclude='.idea' \
  --exclude='*.iml' \
  android/ "$OUT_DIR/frontend/android/"

for pkg in android app filesystem geolocation push-notifications share splash-screen status-bar; do
  rsync -a "node_modules/@capacitor/$pkg/" "$OUT_DIR/frontend/node_modules/@capacitor/$pkg/"
done
rsync -a \
  "node_modules/@capawesome/capacitor-android-edge-to-edge-support/" \
  "$OUT_DIR/frontend/node_modules/@capawesome/capacitor-android-edge-to-edge-support/"
rsync -a \
  "node_modules/capacitor-native-settings/" \
  "$OUT_DIR/frontend/node_modules/capacitor-native-settings/"

cat > "$OUT_DIR/README.txt" <<EOF
Luminexa Android Studio pack (${LABEL})

1. Unzip this archive.
2. Android Studio → File → Open → select frontend/android
   (must be that folder so ../node_modules resolves).
3. Wait for Gradle sync (JDK 21).
4. Build → Generate Signed App Bundle / APK → Android App Bundle → release
5. Key alias: luminexa
   Keystore/key password: from your Play keystore backup (not in this zip)

Do NOT open android alone without the sibling node_modules under frontend/.
EOF

rm -f "$ZIP_PATH"
(cd "$(dirname "$OUT_DIR")" && zip -r "$ZIP_PATH" "$(basename "$OUT_DIR")" -q)

mkdir -p "$FRONTEND/public/downloads"
cp "$ZIP_PATH" "$FRONTEND/public/downloads/$ZIP_NAME"
if [[ -d "$FRONTEND/build" ]]; then
  mkdir -p "$FRONTEND/build/downloads"
  cp "$ZIP_PATH" "$FRONTEND/build/downloads/$ZIP_NAME"
fi

if command -v docker >/dev/null 2>&1 && docker compose -f "$ROOT/docker-compose.yml" ps --status running frontend 2>/dev/null | grep -q frontend; then
  docker compose -f "$ROOT/docker-compose.yml" exec -T frontend mkdir -p /usr/share/nginx/html/downloads || true
  docker compose -f "$ROOT/docker-compose.yml" cp "$ZIP_PATH" \
    "frontend:/usr/share/nginx/html/downloads/$ZIP_NAME" || true
  echo "Published: https://app.luminex-a.com/downloads/$ZIP_NAME"
fi

echo "Zip: $ZIP_PATH"
ls -lh "$ZIP_PATH"
