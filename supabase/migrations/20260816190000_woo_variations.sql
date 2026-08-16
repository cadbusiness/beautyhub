-- Store WooCommerce product variations in `inst_products` so that sale lines
-- referencing a `variation_id` can be enriched (image, sku, price, stock)
-- just like a simple product.
--
-- We keep variations in the same table (rather than adding a new
-- `inst_product_variations`) because they behave identically for the mobile
-- app: same needs (image, price, stock) and the sale item already stores a
-- single `product_id` FK. Variations are linked back to their parent via
-- `parent_woo_id`, which lets the caisse UI group them if needed.

alter table public.inst_products
  add column if not exists parent_woo_id bigint,
  add column if not exists variation_attributes jsonb not null default '{}'::jsonb;

comment on column public.inst_products.parent_woo_id is
  'When set, this row is a WooCommerce variation whose parent product has woo_id = parent_woo_id.';

comment on column public.inst_products.variation_attributes is
  'Attributes selected by this variation (e.g. {"color":"red","size":"M"}). Empty object for simple products.';

create index if not exists inst_products_parent_woo_id_idx
  on public.inst_products (tenant_id, connection_id, parent_woo_id)
  where parent_woo_id is not null;
