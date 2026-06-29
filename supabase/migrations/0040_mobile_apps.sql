-- Applications mobiles marque blanche (institut + client final)
-- Une entrée = une build store (bundle id) rattachée à une brand ou un tenant.

create table if not exists public.mobile_apps (
  id uuid primary key default gen_random_uuid(),
  -- institut = app équipe (RDV, caisse…) ; client = app client final (réservation, compte)
  audience text not null check (audience in ('institut', 'client')),
  -- brand = une app pour tous les instituts de la marque ; tenant = app dédiée à un institut
  scope_type text not null check (scope_type in ('brand', 'tenant')),
  scope_id uuid not null,
  app_name text not null,
  app_slug text not null,
  bundle_id_ios text,
  bundle_id_android text,
  deep_link_scheme text,
  branding jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_mobile_apps_slug
  on public.mobile_apps (audience, app_slug);

create unique index if not exists idx_mobile_apps_bundle_ios
  on public.mobile_apps (bundle_id_ios)
  where bundle_id_ios is not null;

create unique index if not exists idx_mobile_apps_bundle_android
  on public.mobile_apps (bundle_id_android)
  where bundle_id_android is not null;

create index if not exists idx_mobile_apps_scope
  on public.mobile_apps (scope_type, scope_id);

create trigger trg_mobile_apps_updated before update on public.mobile_apps
  for each row execute function public.set_updated_at();

create or replace function public.validate_mobile_app_scope()
returns trigger
language plpgsql as $$
begin
  if new.scope_type = 'brand' and not exists (select 1 from public.brands where id = new.scope_id) then
    raise exception 'mobile_apps: scope_id invalide pour scope_type brand';
  end if;
  if new.scope_type = 'tenant' and not exists (select 1 from public.tenants where id = new.scope_id) then
    raise exception 'mobile_apps: scope_id invalide pour scope_type tenant';
  end if;
  return new;
end;
$$;

create trigger trg_mobile_apps_scope before insert or update on public.mobile_apps
  for each row execute function public.validate_mobile_app_scope();

alter table public.mobile_apps enable row level security;

create policy mobile_apps_select on public.mobile_apps for select
  using (
    case scope_type
      when 'brand' then public.auth_has_brand_access(scope_id)
      when 'tenant' then public.auth_has_tenant_access(scope_id)
    end
  );

create policy mobile_apps_write on public.mobile_apps for all
  using (
    case scope_type
      when 'brand' then public.auth_has_brand_access(scope_id)
      when 'tenant' then public.auth_has_tenant_access(scope_id)
    end
  )
  with check (
    case scope_type
      when 'brand' then public.auth_has_brand_access(scope_id)
      when 'tenant' then public.auth_has_tenant_access(scope_id)
    end
  );

-- Bootstrap public : résolution par bundle id (iOS ou Android), sans secrets.
create or replace function public.get_mobile_app_bootstrap(p_bundle_id text)
returns table (
  app_id uuid,
  audience text,
  scope_type text,
  scope_id uuid,
  brand_id uuid,
  app_name text,
  app_slug text,
  deep_link_scheme text,
  branding jsonb,
  brand_name text,
  brand_slug text,
  brand_branding jsonb,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  tenant_branding jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as app_id,
    m.audience,
    m.scope_type,
    m.scope_id,
    coalesce(t.brand_id, b.id) as brand_id,
    m.app_name,
    m.app_slug,
    m.deep_link_scheme,
    m.branding,
    coalesce(b.name, tb.name) as brand_name,
    coalesce(b.slug, tb.slug) as brand_slug,
    coalesce(b.branding, tb.branding, '{}'::jsonb) as brand_branding,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.branding as tenant_branding
  from public.mobile_apps m
  left join public.brands b
    on m.scope_type = 'brand' and m.scope_id = b.id
  left join public.tenants t
    on m.scope_type = 'tenant' and m.scope_id = t.id
  left join public.brands tb
    on t.brand_id = tb.id
  where m.is_active
    and (
      m.bundle_id_ios = p_bundle_id
      or m.bundle_id_android = p_bundle_id
    )
  limit 1;
$$;

revoke all on function public.get_mobile_app_bootstrap(text) from public;
grant execute on function public.get_mobile_app_bootstrap(text) to anon, authenticated;

-- App marque blanche par défaut (BeautyHub) — build dev / preview
insert into public.mobile_apps (
  audience,
  scope_type,
  scope_id,
  app_name,
  app_slug,
  bundle_id_ios,
  bundle_id_android,
  deep_link_scheme,
  branding
)
select
  v.audience,
  'brand',
  b.id,
  v.app_name,
  v.app_slug,
  v.bundle_id_ios,
  v.bundle_id_android,
  v.deep_link_scheme,
  v.branding
from public.brands b
cross join (
  values
    (
      'institut'::text,
      'BeautyHub Pro'::text,
      'beautyhub-pro'::text,
      'app.beautyhub.pro'::text,
      'app.beautyhub.pro'::text,
      'beautyhub-pro'::text,
      '{"primaryColor":"#0f172a","accentColor":"#6366f1"}'::jsonb
    ),
    (
      'client'::text,
      'BeautyHub'::text,
      'beautyhub-client'::text,
      'app.beautyhub.client'::text,
      'app.beautyhub.client'::text,
      'beautyhub-client'::text,
      '{"primaryColor":"#0f172a","accentColor":"#6366f1"}'::jsonb
    )
) as v(audience, app_name, app_slug, bundle_id_ios, bundle_id_android, deep_link_scheme, branding)
where b.is_platform
on conflict (audience, app_slug) do nothing;
