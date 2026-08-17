-- Catégories pour les produits internes (caisse)

create table if not exists public.inst_product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists idx_inst_product_categories_tenant
  on public.inst_product_categories (tenant_id, sort_order, name);

create trigger trg_inst_product_categories_updated
  before update on public.inst_product_categories
  for each row execute function public.set_updated_at();

alter table public.inst_products
  add column if not exists category_id uuid
    references public.inst_product_categories(id) on delete set null;

create index if not exists idx_inst_products_category
  on public.inst_products (tenant_id, category_id)
  where category_id is not null;

alter table public.inst_product_categories enable row level security;

create policy inst_product_categories_access on public.inst_product_categories for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
