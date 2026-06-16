-- BeautyHub - Resolution publique du tenant (Phase 0)
-- Permet de resoudre un tenant par domaine custom ou slug, sans authentification,
-- en ne renvoyant que des champs "publics" (pas les secrets Woo).

create or replace function public.get_public_tenant(p_host text, p_slug text)
returns table (id uuid, name text, slug text, branding jsonb, brand_id uuid)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.slug, t.branding, t.brand_id
  from public.tenants t
  where (p_host is not null and t.custom_domain = p_host)
     or (p_slug is not null and t.slug = p_slug)
  order by (t.custom_domain = p_host) desc nulls last
  limit 1;
$$;

grant execute on function public.get_public_tenant(text, text) to anon, authenticated;
