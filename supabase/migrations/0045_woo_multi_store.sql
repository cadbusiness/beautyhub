-- BeautyHub — Multi-boutiques WooCommerce
-- Chaque connexion WooCommerce = une boutique. Un institut peut en relier plusieurs.
-- Chaque produit miroir est rattaché à sa connexion (boutique) d'origine, ce qui
-- permet de décrémenter le stock de la bonne boutique lors d'une vente en caisse.

-- ---------------------------------------------------------------------------
-- 1) connections : identifiant externe (URL boutique) + unicité par boutique
-- ---------------------------------------------------------------------------
alter table public.connections
  add column if not exists external_id text;

-- L'ancienne unicité (scope, provider) empêchait plusieurs boutiques woo par tenant.
drop index if exists public.uniq_connection_scope_provider;

create unique index if not exists uniq_connection_scope_provider_external
  on public.connections(
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    provider,
    coalesce(external_id, '')
  );

-- Backfill : renseigne external_id des connexions woo existantes depuis config->>url.
update public.connections
set external_id = config->>'url'
where provider = 'woocommerce'
  and external_id is null
  and coalesce(config->>'url', '') <> '';

-- ---------------------------------------------------------------------------
-- 2) inst_products : rattachement à une connexion (boutique)
-- ---------------------------------------------------------------------------
alter table public.inst_products
  add column if not exists connection_id uuid references public.connections(id) on delete cascade;

create index if not exists idx_inst_products_connection
  on public.inst_products(connection_id);

-- Backfill : produits Woo existants -> connexion woo du tenant (une seule aujourd'hui).
update public.inst_products p
set connection_id = c.id
from public.connections c
where c.scope_type = 'tenant'
  and c.scope_id = p.tenant_id
  and c.provider = 'woocommerce'
  and p.woo_id is not null
  and p.connection_id is null;

-- ---------------------------------------------------------------------------
-- 3) Nouvelle unicité produit : (tenant, connexion, woo_id)
--    Deux boutiques peuvent avoir le même woo_id sans collision.
-- ---------------------------------------------------------------------------
alter table public.inst_products
  drop constraint if exists inst_products_tenant_id_woo_id_key;

create unique index if not exists uniq_inst_products_tenant_conn_woo
  on public.inst_products(tenant_id, connection_id, woo_id);
