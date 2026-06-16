-- BeautyHub - Module Institut: commerce / caisse (Phase 1)
-- Produits miroir de WooCommerce + ventes en boutique.

create table if not exists public.inst_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  woo_id bigint,                 -- id du produit dans WooCommerce
  name text not null,
  sku text,
  price_cents integer not null default 0,
  currency text not null default 'eur',
  stock_quantity integer,
  image_url text,
  status text not null default 'active',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, woo_id)
);
create index if not exists idx_inst_products_tenant on public.inst_products(tenant_id);
create trigger trg_inst_products_updated before update on public.inst_products
  for each row execute function public.set_updated_at();

create table if not exists public.inst_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  woo_order_id bigint,
  total_cents integer not null default 0,
  currency text not null default 'eur',
  status text not null default 'paid' check (status in ('open','paid','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_sales_tenant on public.inst_sales(tenant_id);
create trigger trg_inst_sales_updated before update on public.inst_sales
  for each row execute function public.set_updated_at();

create table if not exists public.inst_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.inst_sales(id) on delete cascade,
  product_id uuid references public.inst_products(id) on delete set null,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0
);
create index if not exists idx_inst_sale_items_sale on public.inst_sale_items(sale_id);

alter table public.inst_products    enable row level security;
alter table public.inst_sales       enable row level security;
alter table public.inst_sale_items  enable row level security;

create policy inst_products_access on public.inst_products for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_sales_access on public.inst_sales for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_sale_items_access on public.inst_sale_items for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
