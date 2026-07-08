-- Index pour résolution webhook WooCommerce (token dans connections.config).
create index if not exists idx_connections_woo_webhook_token
  on public.connections ((config->>'webhook_token'))
  where provider = 'woocommerce' and scope_type = 'tenant';
