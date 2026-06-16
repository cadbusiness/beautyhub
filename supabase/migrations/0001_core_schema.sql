-- BeautyHub - Schema coeur (Phase 0)
-- Hierarchie: plateforme -> brands -> tenants -> clients finaux
-- Toutes les tables metier porteront tenant_id + RLS (voir 0002).

create extension if not exists "pgcrypto";

-- Trigger generique updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Brands (revendeurs marque blanche). La plateforme possede une brand "par defaut".
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_platform boolean not null default false,
  branding jsonb not null default '{}'::jsonb,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenants (instituts / ecoles) = clients du super admin
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  name text not null,
  slug text not null unique,
  custom_domain text unique,
  branding jsonb not null default '{}'::jsonb,
  woo_url text,
  woo_key text,
  woo_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tenants_brand on public.tenants(brand_id);
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memberships (utilisateurs equipe via Supabase Auth)
-- platform_admin: brand_id et tenant_id NULL (acces global)
-- brand_owner: brand_id renseigne
-- tenant_owner/staff/coach: tenant_id renseigne
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin','brand_owner','tenant_owner','staff','coach')),
  brand_id uuid references public.brands(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_tenant on public.memberships(tenant_id);
create index if not exists idx_memberships_brand on public.memberships(brand_id);

-- ---------------------------------------------------------------------------
-- Modules (catalogue) + activation par tenant
-- ---------------------------------------------------------------------------
create table if not exists public.modules (
  id text primary key,            -- slug, ex: 'institut', 'academie'
  name text not null,
  description text,
  category text,
  version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_id)
);
create trigger trg_tenant_modules_updated before update on public.tenant_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Connections (integrations: stripe_connect, woocommerce, ...) par scope
-- ---------------------------------------------------------------------------
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('platform','brand','tenant')),
  scope_id uuid,                  -- NULL si scope_type = 'platform'
  provider text not null,         -- 'stripe_connect', 'woocommerce', ...
  status text not null default 'disconnected' check (status in ('connected','disconnected')),
  credentials jsonb not null default '{}'::jsonb,  -- blob chiffre cote app
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_connection_scope_provider
  on public.connections(scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), provider);
create trigger trg_connections_updated before update on public.connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plans (abonnements simples: modules inclus + quotas) + subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,  -- NULL = plan global plateforme
  name text not null,
  price_cents integer not null default 0,
  currency text not null default 'eur',
  interval text not null default 'month' check (interval in ('month','year')),
  modules text[] not null default '{}',   -- ids de modules inclus
  limits jsonb not null default '{}'::jsonb, -- quotas: {"students":100,"staff":5,...} null = illimite
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'active' check (status in ('trialing','active','past_due','canceled')),
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clients finaux (clients des instituts) - identite CLOISONNEE par tenant.
-- Auth client distincte de Supabase Auth: meme email reutilisable entre tenants.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  password_hash text,             -- NULL = fiche CRM sans compte de connexion
  full_name text,
  phone text,
  marketing_opt_in boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create index if not exists idx_clients_tenant on public.clients(tenant_id);
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
