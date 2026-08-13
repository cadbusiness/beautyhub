-- Index pour retrouver rapidement les clients importés Overcache (upsert par référence)
create index if not exists idx_clients_tenant_overcache_ref
  on public.clients (tenant_id, (metadata->>'overcache_ref'))
  where metadata->>'overcache_ref' is not null;
