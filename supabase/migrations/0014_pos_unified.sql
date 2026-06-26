-- BeautyHub - Caisse unifiee: prestations + produits internes + WooCommerce

alter table public.inst_products
  add column if not exists source text not null default 'internal'
    check (source in ('internal', 'woocommerce'));

update public.inst_products
  set source = 'woocommerce'
  where woo_id is not null and source = 'internal';

alter table public.inst_sales
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card', 'stripe')),
  add column if not exists notes text;

alter table public.inst_sale_items
  add column if not exists item_type text not null default 'product'
    check (item_type in ('product', 'service')),
  add column if not exists service_id uuid references public.inst_services(id) on delete set null,
  add column if not exists appointment_id uuid references public.inst_appointments(id) on delete set null;

create index if not exists idx_inst_sale_items_service on public.inst_sale_items(service_id);
create index if not exists idx_inst_products_source on public.inst_products(tenant_id, source);
