-- BeautyHub - Pages web institut (templates, blocs, publication)

create table if not exists public.inst_site_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_type text not null check (page_type in ('home', 'booking', 'catalog', 'contact')),
  slug text not null default '',
  template_id text not null default 'elegant' check (template_id in ('elegant', 'modern')),
  title text not null,
  is_published boolean not null default false,
  is_home boolean not null default false,
  content jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create unique index if not exists idx_inst_site_pages_one_home
  on public.inst_site_pages(tenant_id) where is_home = true;

create index if not exists idx_inst_site_pages_tenant on public.inst_site_pages(tenant_id);
create trigger trg_inst_site_pages_updated before update on public.inst_site_pages
  for each row execute function public.set_updated_at();

comment on table public.inst_site_pages is
  'Pages publiques configurables par institut (accueil, catalogue, etc.).';
comment on column public.inst_site_pages.content is
  'Blocs JSON : hero, about, services, cta, hours, etc.';

alter table public.inst_site_pages enable row level security;

create policy inst_site_pages_access on public.inst_site_pages for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Lecture publique des pages publiees (storefront)
create policy inst_site_pages_public_read on public.inst_site_pages for select
  using (is_published = true);

create or replace function public.get_public_site_home(p_tenant_id uuid)
returns table (
  id uuid,
  page_type text,
  slug text,
  template_id text,
  title text,
  content jsonb,
  seo_title text,
  seo_description text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.is_published = true
    and p.is_home = true
  limit 1;
$$;

create or replace function public.get_public_site_page(p_tenant_id uuid, p_slug text)
returns table (
  id uuid,
  page_type text,
  slug text,
  template_id text,
  title text,
  content jsonb,
  seo_title text,
  seo_description text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.is_published = true
    and p.slug = coalesce(p_slug, '')
  limit 1;
$$;

grant execute on function public.get_public_site_home(uuid) to anon, authenticated;
grant execute on function public.get_public_site_page(uuid, text) to anon, authenticated;
