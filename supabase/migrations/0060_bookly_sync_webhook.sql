-- Résolution du webhook de synchro Bookly (token dans connections.config).
create index if not exists idx_connections_bookly_webhook_token
  on public.connections ((config->>'webhook_token'))
  where provider = 'bookly' and scope_type = 'tenant';
