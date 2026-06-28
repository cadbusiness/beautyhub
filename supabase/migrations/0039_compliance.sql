-- BeautyHub — conformité RGPD / traçabilité (audit, consentements)

-- ---------------------------------------------------------------------------
-- Journal d'audit (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_type text not null check (actor_type in ('team', 'client', 'system', 'anonymous')),
  actor_id uuid,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_tenant_created
  on public.audit_logs(tenant_id, created_at desc);
create index if not exists idx_audit_logs_resource
  on public.audit_logs(resource_type, resource_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs for select
  using (
    public.auth_is_platform_admin()
    or (tenant_id is not null and public.auth_has_tenant_access(tenant_id))
  );

create policy audit_logs_insert on public.audit_logs for insert
  with check (
    public.auth_is_platform_admin()
    or (tenant_id is not null and public.auth_has_tenant_access(tenant_id))
  );

-- ---------------------------------------------------------------------------
-- Événements de consentement (marketing, CGU, confidentialité)
-- ---------------------------------------------------------------------------
create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  consent_type text not null check (consent_type in ('marketing', 'terms', 'privacy')),
  granted boolean not null,
  source text not null,
  actor_type text not null check (actor_type in ('client', 'staff', 'system')),
  actor_id uuid,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_consent_events_client
  on public.consent_events(tenant_id, client_id, created_at desc);

alter table public.consent_events enable row level security;

create policy consent_events_select on public.consent_events for select
  using (public.auth_has_tenant_access(tenant_id));

create policy consent_events_insert on public.consent_events for insert
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- État conformité institut (checklist onboarding)
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists compliance jsonb not null default '{}'::jsonb,
  add column if not exists data_retention_days integer
    check (data_retention_days is null or (data_retention_days >= 30 and data_retention_days <= 3650));
