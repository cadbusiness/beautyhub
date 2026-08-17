#!/bin/bash
# Double-clique ce fichier sur le Mac.
# Il construit l'app institut, copie l'IPA sur le Bureau, et l'ouvre dans Transporter.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/apps/institut"
FLAVOR="$ROOT/flavors/beautyhub_pro.prod.json"
DEST="$HOME/Desktop/BeautyHub-TestFlight"

fail() {
  osascript -e "display dialog \"$1\" buttons {\"OK\"} default button 1 with icon stop" >/dev/null 2>&1 || true
  echo "$1" >&2
  exit 1
}

if [[ "$(uname)" != "Darwin" ]]; then
  fail "Ce fichier doit être lancé sur le Mac (pas sur le cloud)."
fi

if command -v flutter >/dev/null 2>&1; then
  FLUTTER="flutter"
elif [[ -x "$HOME/flutter/bin/flutter" ]]; then
  FLUTTER="$HOME/flutter/bin/flutter"
elif [[ -x /opt/homebrew/bin/flutter ]]; then
  FLUTTER="/opt/homebrew/bin/flutter"
else
  fail "Flutter est introuvable sur ce Mac. Ouvre Xcode une fois, installe Flutter, puis re-double-clique."
fi

mkdir -p "$DEST"
cd "$APP"

osascript -e 'display notification "Construction de l’app institut…" with title "BeautyHub TestFlight"' >/dev/null 2>&1 || true

"$FLUTTER" pub get
"$FLUTTER" build ipa --release \
  --export-method app-store \
  --dart-define-from-file="$FLAVOR"

IPA="$(find "$APP/build/ios/ipa" -name '*.ipa' | head -n 1)"
if [[ -z "$IPA" || ! -f "$IPA" ]]; then
  fail "L’IPA n’a pas été créé. Ouvre Xcode, connecte-toi avec le compte Apple, puis réessaie."
fi

cp "$IPA" "$DEST/"
open "$DEST"
open -a Transporter "$IPA" || open -a "Transporter" "$IPA" || true

osascript -e "display dialog \"C’est prêt.\n\nLe fichier est sur le Bureau, dossier BeautyHub-TestFlight.\nTransporter s’ouvre avec le paquet. Clique Envoyer.\" buttons {\"OK\"} default button 1" >/dev/null 2>&1 || true
