-- Accélère la liste paginée des clients par institut
create index if not exists idx_clients_tenant_created_at
  on public.clients (tenant_id, created_at desc);
