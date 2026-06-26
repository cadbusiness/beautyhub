#!/usr/bin/env bash
# Pousse les variables d'environnement vers Vercel (Production + Preview).
# Prerequis: vercel login && supabase login (deja fait si le projet est lie).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! vercel whoami &>/dev/null; then
  echo "❌ Vercel non connecte. Lance d'abord: vercel login"
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "❌ Fichier .env.local introuvable."
  exit 1
fi

# Charge .env.local
set -a
# shellcheck disable=SC1091
source .env.local
set +a

# Complete service_role si vide
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  SUPABASE_SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref cmlnlwqjnqplsfemrvsp -o json \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(x['api_key'] for x in d if x['name']=='service_role'))")
fi

if [[ -z "${CONNECTIONS_ENCRYPTION_KEY:-}" ]]; then
  CONNECTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
  echo "CONNECTIONS_ENCRYPTION_KEY generee pour Vercel."
fi

VERCEL_DOMAIN="${VERCEL_DOMAIN:-beautyhub-seven.vercel.app}"

declare -A VARS=(
  [NEXT_PUBLIC_SUPABASE_URL]="${NEXT_PUBLIC_SUPABASE_URL}"
  [NEXT_PUBLIC_SUPABASE_ANON_KEY]="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
  [SUPABASE_SERVICE_ROLE_KEY]="${SUPABASE_SERVICE_ROLE_KEY}"
  [CONNECTIONS_ENCRYPTION_KEY]="${CONNECTIONS_ENCRYPTION_KEY}"
  [NEXT_PUBLIC_ROOT_DOMAIN]="${VERCEL_DOMAIN}"
)

echo "→ Liaison projet Vercel (si necessaire)..."
vercel link --yes 2>/dev/null || true

for name in "${!VARS[@]}"; do
  value="${VARS[$name]}"
  if [[ -z "$value" ]]; then
    echo "❌ Variable vide: $name"
    exit 1
  fi
  for env in production preview; do
    echo "→ $name ($env)"
    vercel env add "$name" "$env" --value "$value" --yes --force --sensitive 2>/dev/null \
      || vercel env add "$name" "$env" --value "$value" --yes --force
  done
done

echo ""
echo "✅ Variables poussees. Redeploie:"
echo "   vercel --prod"
