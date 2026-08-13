-- RPC de lookup pour la dedup (utilisées par src/lib/institut/clients-dedup.ts)
-- Évite de charger 5000+ lignes clients en JS à chaque appel.

create extension if not exists unaccent;

create or replace function public.dedup_find_by_phone(
  p_tenant_id uuid,
  p_normalized_phone text
)
returns table (
  id uuid,
  email text,
  phone text,
  full_name text,
  updated_at timestamptz,
  metadata jsonb,
  tags text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.email, c.phone, c.full_name, c.updated_at, c.metadata, c.tags
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.phone is not null
    and public.normalize_phone(c.phone) = p_normalized_phone
  order by c.updated_at desc
  limit 20;
$$;

comment on function public.dedup_find_by_phone(uuid, text) is
  'Retourne jusqu''à 20 clients dont le téléphone normalisé correspond exactement. Utilisé pour la dédup Woo/Rovercash.';

create or replace function public.dedup_find_by_name(
  p_tenant_id uuid,
  p_normalized_full_name text
)
returns table (
  id uuid,
  email text,
  phone text,
  full_name text,
  updated_at timestamptz,
  metadata jsonb,
  tags text[]
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.id, c.email, c.phone, c.full_name, c.updated_at, c.metadata, c.tags
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.full_name is not null
    and lower(public.unaccent(regexp_replace(c.full_name, '\s+', ' ', 'g'))) = p_normalized_full_name
  order by c.updated_at desc
  limit 20;
$$;

comment on function public.dedup_find_by_name(uuid, text) is
  'Retourne jusqu''à 20 clients dont le nom complet normalisé correspond exactement. Le paramètre doit déjà être normalisé (lowercased, sans accents, whitespaces réduits).';

grant execute on function public.dedup_find_by_phone(uuid, text) to authenticated, service_role;
grant execute on function public.dedup_find_by_name(uuid, text) to authenticated, service_role;
