# BeautyHub

SaaS tout-en-un multi-tenant pour instituts (rendez-vous + caisse), academies de
formation, revendable en marque blanche et pilotable par IA. Distribuable en SaaS
heberge ou en self-hosted (CodeCanyon / "bring your own Supabase").

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres + Auth + RLS + Storage + Edge Functions)
- zod (schemas + parametres d'actions IA)

## Hierarchie

Plateforme (super admin) -> Brand (revendeur marque blanche) -> Tenant
(institut/ecole) -> Client final (client de l'institut).

- Auth equipe via Supabase Auth (`memberships`: platform_admin, brand_owner,
  tenant_owner, staff, coach).
- Auth client final cloisonnee par tenant (`clients`, `unique(tenant_id, email)`):
  un meme email peut etre client de plusieurs instituts independamment.

## Architecture (Phase 0 livree)

- `src/lib/supabase/` — clients browser / server / service role + helper de session.
- `src/lib/tenant/` — resolution du tenant par sous-domaine ou domaine custom
  (fonction SQL publique `get_public_tenant`) + modules actives.
- `src/lib/auth/` — session equipe, roles, scopes.
- `src/lib/connections/` — framework d'integrations (Stripe Connect, WooCommerce...)
  par scope plateforme/brand/tenant, resolution en cascade, credentials chiffres (AES-256-GCM).
- `src/lib/quota.ts` — quotas d'abonnement (`assertQuota`).
- `src/modules/` — systeme de modules: contrat (`ModuleManifest`) avec nav,
  permissions et **actions IA** declarees par module; registre agrege pour l'assistant IA.
- `src/proxy.ts` — proxy Next.js (rafraichissement de session).

## Base de donnees

Migrations versionnees dans `supabase/migrations/` (source de verite, portable):

| Migration | Contenu |
| --- | --- |
| 0001_core_schema | brands, tenants, memberships, modules, tenant_modules, connections, plans, subscriptions, clients |
| 0002_rls_policies | RLS + fonctions d'acces (`auth_*`) |
| 0003_seed | brand plateforme, catalogue modules, formules |
| 0004_harden | search_path + restriction RPC |
| 0005_public_tenant_resolution | `get_public_tenant` (resolution publique) |

## Demarrage

```bash
cp .env.example .env.local   # remplir les valeurs
# CONNECTIONS_ENCRYPTION_KEY: openssl rand -base64 32
npm install
npm run dev
```

Variables d'environnement (toutes pilotees par env pour la portabilite self-hosted):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (operations admin serveur, jamais expose au client)
- `NEXT_PUBLIC_ROOT_DOMAIN` (resolution des sous-domaines)
- `CONNECTIONS_ENCRYPTION_KEY` (chiffrement des credentials d'integrations)
- `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true` (optionnel, affiche les comptes de test sur `/login`)

## Deploiement Vercel

```bash
vercel login
cp .env.example .env.local   # remplir Supabase + secrets
bash scripts/push-vercel-env.sh
vercel --prod
```

Sur le domaine racine (`beautyhub-seven.vercel.app`), choisis l'institut depuis le
tableau de bord apres connexion. En local : `demo.localhost:3000` ou cookie tenant.

## Comptes de test

Apres migrations, creer les utilisateurs :

```bash
npm run seed:test-users
```

| Email | Role | Institut |
| --- | --- | --- |
| `admin@beautyhub.test` | Super admin plateforme | — |
| `brand@beautyhub.test` | Proprietaire marque | Tous (brand plateforme) |
| `owner@demo.test` | Proprietaire | Institut Demo |
| `staff@demo.test` | Staff | Institut Demo |
| `coach@demo.test` | Coach | Institut Demo |

Mot de passe commun (dev/staging) : `BeautyHub2026!`

## Roadmap

- Phase 1 — Institut MVP (RDV, prestations, clients, caisse WooCommerce, Stripe Connect)
- Phase 2 — Academie
- Phase 3 — Marque blanche + abonnements + installateur self-hosted / CodeCanyon
- Phase 4 — Assistant IA (runtime + UI) sur le registre d'actions des modules
