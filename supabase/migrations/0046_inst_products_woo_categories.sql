-- BeautyHub — Catégories WooCommerce sur inst_products
-- Permet le filtrage en caisse par catégories du site Woo.

alter table public.inst_products
  add column if not exists woo_categories text[] not null default '{}'::text[];
