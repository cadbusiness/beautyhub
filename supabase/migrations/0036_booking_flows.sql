-- BeautyHub - Parcours de réservation publique (multi-pages, config, embed)

create table if not exists public.inst_booking_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null default '',
  is_default boolean not null default false,
  is_published boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create unique index if not exists idx_inst_booking_flows_one_default
  on public.inst_booking_flows(tenant_id) where is_default = true;

create index if not exists idx_inst_booking_flows_tenant
  on public.inst_booking_flows(tenant_id);

create trigger trg_inst_booking_flows_updated before update on public.inst_booking_flows
  for each row execute function public.set_updated_at();

comment on table public.inst_booking_flows is
  'Parcours de réservation publique configurables (liens, embeds, règles du wizard).';
comment on column public.inst_booking_flows.slug is
  'Identifiant URL (/reserver/{slug}). Vide = page par défaut (/reserver).';
comment on column public.inst_booking_flows.config is
  'JSON : showStaffPicker, requireStaff, showExtrasStep, requirePhone, allowedServiceIds.';

alter table public.inst_booking_flows enable row level security;

create policy inst_booking_flows_access on public.inst_booking_flows for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_booking_flows_public_read on public.inst_booking_flows for select
  using (is_published = true);

-- Parcours par défaut pour les tenants existants
insert into public.inst_booking_flows (tenant_id, name, slug, is_default, is_published, config, sort_order)
select
  t.id,
  'Réservation en ligne',
  '',
  true,
  true,
  jsonb_build_object(
    'showStaffPicker', true,
    'requireStaff', false,
    'showExtrasStep', true,
    'requirePhone', false,
    'allowedServiceIds', null
  ),
  0
from public.tenants t
where not exists (
  select 1 from public.inst_booking_flows f
  where f.tenant_id = t.id and f.is_default = true
);

create or replace function public.get_public_booking_flow(
  p_tenant_id uuid,
  p_slug text default null
)
returns table (
  id uuid,
  name text,
  slug text,
  config jsonb
)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.slug, f.config
  from public.inst_booking_flows f
  where f.tenant_id = p_tenant_id
    and f.is_published = true
    and (
      (coalesce(nullif(trim(p_slug), ''), null) is null and f.is_default = true)
      or f.slug = nullif(trim(p_slug), '')
    )
  limit 1;
$$;

grant execute on function public.get_public_booking_flow(uuid, text) to anon, authenticated;
