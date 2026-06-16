-- BeautyHub - Durcissement (Phase 0)
-- 1) search_path fixe sur la fonction trigger
-- 2) restreindre l'execution RPC des fonctions d'acces (anon n'en a pas besoin)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.auth_is_platform_admin() from anon, public;
revoke execute on function public.auth_has_brand_access(uuid) from anon, public;
revoke execute on function public.auth_has_tenant_access(uuid) from anon, public;

grant execute on function public.auth_is_platform_admin() to authenticated;
grant execute on function public.auth_has_brand_access(uuid) to authenticated;
grant execute on function public.auth_has_tenant_access(uuid) to authenticated;
