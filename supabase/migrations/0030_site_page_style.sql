-- Réglages visuels par page (fond, marges, padding, largeur, coins)

alter table public.inst_site_pages
  add column if not exists page_style jsonb not null default '{}'::jsonb;

comment on column public.inst_site_pages.page_style is
  'Style du corps de page : backgroundColor, marginX, paddingX, paddingY, maxWidth, borderRadius.';

drop function if exists public.get_public_site_home(uuid);
drop function if exists public.get_public_site_page(uuid, text);
drop function if exists public.get_public_site_page_by_type(uuid, text);

create or replace function public.get_public_site_home(p_tenant_id uuid)
returns table (
  id uuid,
  page_type text,
  slug text,
  template_id text,
  title text,
  content jsonb,
  seo_title text,
  seo_description text,
  page_style jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description, p.page_style
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
  seo_description text,
  page_style jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description, p.page_style
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.is_published = true
    and p.slug = coalesce(p_slug, '')
  limit 1;
$$;

create or replace function public.get_public_site_page_by_type(
  p_tenant_id uuid,
  p_page_type text
)
returns table (
  id uuid,
  page_type text,
  slug text,
  template_id text,
  title text,
  content jsonb,
  seo_title text,
  seo_description text,
  page_style jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description, p.page_style
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.is_published = true
    and p.page_type = p_page_type
  limit 1;
$$;

grant execute on function public.get_public_site_home(uuid) to anon, authenticated;
grant execute on function public.get_public_site_page(uuid, text) to anon, authenticated;
grant execute on function public.get_public_site_page_by_type(uuid, text) to anon, authenticated;
