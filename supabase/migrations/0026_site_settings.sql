-- BeautyHub - Site settings globaux, nav dynamique, ordre pages

create table if not exists public.inst_site_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  template_id text not null default 'elegant' check (template_id in ('elegant', 'modern')),
  primary_color text not null default '#0f172a',
  display_name text,
  logo_url text,
  footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_inst_site_settings_updated before update on public.inst_site_settings
  for each row execute function public.set_updated_at();

comment on table public.inst_site_settings is
  'Theme et identite visuelle globale du site public institut.';

alter table public.inst_site_settings enable row level security;

create policy inst_site_settings_access on public.inst_site_settings for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_site_settings_public_read on public.inst_site_settings for select
  using (true);

alter table public.inst_site_pages
  add column if not exists sort_order integer not null default 0,
  add column if not exists show_in_nav boolean not null default true;

-- Ordre par defaut pour les pages existantes
update public.inst_site_pages set sort_order = 0, show_in_nav = true where page_type = 'home';
update public.inst_site_pages set sort_order = 10, show_in_nav = true where page_type = 'catalog';
update public.inst_site_pages set sort_order = 20, show_in_nav = false where page_type = 'booking';
update public.inst_site_pages set sort_order = 30, show_in_nav = true where page_type = 'contact';

create or replace function public.get_public_site_settings(p_tenant_id uuid)
returns table (
  template_id text,
  primary_color text,
  display_name text,
  logo_url text,
  footer_text text
)
language sql stable security definer set search_path = public as $$
  select s.template_id, s.primary_color, s.display_name, s.logo_url, s.footer_text
  from public.inst_site_settings s
  where s.tenant_id = p_tenant_id
  limit 1;
$$;

grant execute on function public.get_public_site_settings(uuid) to anon, authenticated;

create or replace function public.get_public_site_nav(p_tenant_id uuid)
returns table (
  id uuid,
  page_type text,
  slug text,
  title text,
  sort_order integer
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.title, p.sort_order
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.is_published = true
    and p.show_in_nav = true
    and p.page_type not in ('home', 'booking')
  order by p.sort_order, p.created_at;
$$;

grant execute on function public.get_public_site_nav(uuid) to anon, authenticated;

-- Booking publie (lien Reserver dans la nav)
create or replace function public.get_public_booking_enabled(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inst_site_pages p
    where p.tenant_id = p_tenant_id
      and p.page_type = 'booking'
      and p.is_published = true
  );
$$;

grant execute on function public.get_public_booking_enabled(uuid) to anon, authenticated;
