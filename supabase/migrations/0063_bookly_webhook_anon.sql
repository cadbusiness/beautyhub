-- Webhook Bookly sans service_role : le token (dans l’URL / header) authentifie le tenant.

create or replace function public.bookly_webhook_token()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-bookly-webhook-token', ''),
    nullif(current_setting('request.header.x-bookly-webhook-token', true), '')
  );
$$;

create or replace function public.bookly_webhook_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.scope_id
  from public.connections c
  where c.provider = 'bookly'
    and c.scope_type = 'tenant'
    and c.status = 'connected'
    and length(coalesce(public.bookly_webhook_token(), '')) >= 16
    and c.config->>'webhook_token' = public.bookly_webhook_token()
  limit 1;
$$;

create or replace function public.bookly_resolve_webhook(p_token text)
returns table (connection_id uuid, tenant_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.scope_id
  from public.connections c
  where c.provider = 'bookly'
    and c.scope_type = 'tenant'
    and c.status = 'connected'
    and length(coalesce(p_token, '')) >= 16
    and c.config->>'webhook_token' = p_token
  limit 1;
$$;

revoke all on function public.bookly_webhook_token() from public;
revoke all on function public.bookly_webhook_tenant_id() from public;
revoke all on function public.bookly_resolve_webhook(text) from public;
grant execute on function public.bookly_webhook_token() to anon, authenticated, service_role;
grant execute on function public.bookly_webhook_tenant_id() to anon, authenticated, service_role;
grant execute on function public.bookly_resolve_webhook(text) to anon, authenticated, service_role;

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
    and (
      public.bookly_webhook_tenant_id() is null
      or public.bookly_webhook_tenant_id() = p_tenant_id
    )
  order by c.updated_at desc
  limit 20;
$$;

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
    and (
      public.bookly_webhook_tenant_id() is null
      or public.bookly_webhook_tenant_id() = p_tenant_id
    )
  order by c.updated_at desc
  limit 20;
$$;

grant execute on function public.dedup_find_by_phone(uuid, text) to anon, authenticated, service_role;
grant execute on function public.dedup_find_by_name(uuid, text) to anon, authenticated, service_role;

drop policy if exists bookly_webhook_connections on public.connections;
create policy bookly_webhook_connections on public.connections
  for all
  using (
    provider = 'bookly'
    and scope_type = 'tenant'
    and scope_id = public.bookly_webhook_tenant_id()
  )
  with check (
    provider = 'bookly'
    and scope_type = 'tenant'
    and scope_id = public.bookly_webhook_tenant_id()
  );

drop policy if exists bookly_webhook_appointments on public.inst_appointments;
create policy bookly_webhook_appointments on public.inst_appointments
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_appointment_extras on public.inst_appointment_extras;
create policy bookly_webhook_appointment_extras on public.inst_appointment_extras
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_resources on public.inst_resources;
create policy bookly_webhook_resources on public.inst_resources
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_staff on public.inst_staff;
create policy bookly_webhook_staff on public.inst_staff
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_services on public.inst_services;
create policy bookly_webhook_services on public.inst_services
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_service_extras on public.inst_service_extras;
create policy bookly_webhook_service_extras on public.inst_service_extras
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());

drop policy if exists bookly_webhook_clients on public.clients;
create policy bookly_webhook_clients on public.clients
  for all
  using (tenant_id = public.bookly_webhook_tenant_id())
  with check (tenant_id = public.bookly_webhook_tenant_id());
