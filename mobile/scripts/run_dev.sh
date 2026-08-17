#!/usr/bin/env bash
# Usage : ./scripts/run_dev.sh institut | client
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:?institut ou client}"

case "$APP" in
  institut) FLAVOR_FILE="$ROOT/flavors/beautyhub_pro.dev.json" ;;
  client)   FLAVOR_FILE="$ROOT/flavors/beautyhub_client.dev.json" ;;
  *) echo "App inconnue: $APP" >&2; exit 1 ;;
esac
if [[ ! -f "$FLAVOR_FILE" ]]; then
  # Fallback : si pas de variante .dev, on prend le fichier de base.
  FLAVOR_FILE="${FLAVOR_FILE%.dev.json}.json"
fi

cd "$ROOT/apps/$APP"
flutter pub get
exec flutter run --dart-define-from-file="$FLAVOR_FILE" "${@:2}"
