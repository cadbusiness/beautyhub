-- BeautyHub - Ventes WooCommerce dans les statistiques

alter table public.inst_sales
  add column if not exists source_channel text not null default 'pos'
  check (source_channel in ('pos', 'woo'));

create unique index if not exists uniq_inst_sales_tenant_woo_order
  on public.inst_sales(tenant_id, woo_order_id)
  where woo_order_id is not null;

create index if not exists idx_inst_sales_source_channel
  on public.inst_sales(tenant_id, source_channel, created_at desc);

create table if not exists public.inst_analytics_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  include_woo_sales boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_inst_analytics_settings_updated
  before update on public.inst_analytics_settings
  for each row execute function public.set_updated_at();

alter table public.inst_analytics_settings enable row level security;

create policy inst_analytics_settings_access on public.inst_analytics_settings for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
