#!/usr/bin/env bash
# Build release iOS / Android — usage :
#   ./scripts/build_release.sh institut apk
#   ./scripts/build_release.sh client ios
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:?institut ou client}"
TARGET="${2:?apk|appbundle|ios|ipa}"

case "$APP" in
  institut) FLAVOR_FILE="$ROOT/flavors/beautyhub_pro.json" ;;
  client)   FLAVOR_FILE="$ROOT/flavors/beautyhub_client.json" ;;
  *) echo "App inconnue: $APP" >&2; exit 1 ;;
esac

cd "$ROOT/apps/$APP"
flutter pub get

case "$TARGET" in
  apk)        flutter build apk --release --dart-define-from-file="$FLAVOR_FILE" ;;
  appbundle)  flutter build appbundle --release --dart-define-from-file="$FLAVOR_FILE" ;;
  ios)        flutter build ios --release --dart-define-from-file="$FLAVOR_FILE" ;;
  ipa)        flutter build ipa --release --dart-define-from-file="$FLAVOR_FILE" ;;
  *) echo "Cible inconnue: $TARGET" >&2; exit 1 ;;
esac
