-- BeautyHub - RLS & fonctions d'acces (Phase 0)
-- Les fonctions sont SECURITY DEFINER pour eviter la recursion RLS sur memberships.

create or replace function public.auth_is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'platform_admin'
  );
$$;

create or replace function public.auth_has_brand_access(bid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and (m.role = 'platform_admin' or m.brand_id = bid)
  );
$$;

create or replace function public.auth_has_tenant_access(tid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and (
        m.role = 'platform_admin'
        or m.tenant_id = tid
        or (m.brand_id is not null
            and m.brand_id = (select t.brand_id from public.tenants t where t.id = tid))
      )
  );
$$;

-- Enable RLS
alter table public.brands          enable row level security;
alter table public.tenants         enable row level security;
alter table public.memberships     enable row level security;
alter table public.modules         enable row level security;
alter table public.tenant_modules  enable row level security;
alter table public.connections     enable row level security;
alter table public.plans           enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.clients         enable row level security;

-- BRANDS
create policy brands_select on public.brands for select
  using (public.auth_has_brand_access(id));
create policy brands_write_admin on public.brands for all
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());
create policy brands_update_owner on public.brands for update
  using (public.auth_has_brand_access(id))
  with check (public.auth_has_brand_access(id));

-- TENANTS
create policy tenants_select on public.tenants for select
  using (public.auth_has_tenant_access(id));
create policy tenants_insert on public.tenants for insert
  with check (public.auth_has_brand_access(brand_id));
create policy tenants_update on public.tenants for update
  using (public.auth_has_tenant_access(id))
  with check (public.auth_has_tenant_access(id));
create policy tenants_delete_admin on public.tenants for delete
  using (public.auth_is_platform_admin());

-- MEMBERSHIPS (un user voit les siennes; platform_admin voit tout)
create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.auth_is_platform_admin());
create policy memberships_admin_all on public.memberships for all
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());

-- MODULES (catalogue): lecture pour tout authentifie, ecriture platform_admin
create policy modules_select on public.modules for select
  using (auth.uid() is not null);
create policy modules_write_admin on public.modules for all
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());

-- TENANT_MODULES
create policy tenant_modules_select on public.tenant_modules for select
  using (public.auth_has_tenant_access(tenant_id));
create policy tenant_modules_write on public.tenant_modules for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- CONNECTIONS (selon le scope)
create policy connections_access on public.connections for all
  using (
    case scope_type
      when 'platform' then public.auth_is_platform_admin()
      when 'brand'    then public.auth_has_brand_access(scope_id)
      when 'tenant'   then public.auth_has_tenant_access(scope_id)
      else false
    end
  )
  with check (
    case scope_type
      when 'platform' then public.auth_is_platform_admin()
      when 'brand'    then public.auth_has_brand_access(scope_id)
      when 'tenant'   then public.auth_has_tenant_access(scope_id)
      else false
    end
  );

-- PLANS (globaux lisibles par tout authentifie; plans de brand selon acces)
create policy plans_select on public.plans for select
  using (brand_id is null or public.auth_has_brand_access(brand_id));
create policy plans_write on public.plans for all
  using (case when brand_id is null then public.auth_is_platform_admin()
              else public.auth_has_brand_access(brand_id) end)
  with check (case when brand_id is null then public.auth_is_platform_admin()
                   else public.auth_has_brand_access(brand_id) end);

-- SUBSCRIPTIONS
create policy subscriptions_access on public.subscriptions for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- CLIENTS (cote equipe). L'auth client final passe par le service_role cote serveur.
create policy clients_access on public.clients for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
