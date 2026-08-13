-- BeautyHub — catégories de prestations (+ refs Bookly pour import idempotent)

create table if not exists public.inst_service_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  bookly_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists idx_inst_service_categories_tenant
  on public.inst_service_categories (tenant_id);

create unique index if not exists idx_inst_service_categories_tenant_bookly
  on public.inst_service_categories (tenant_id, bookly_id)
  where bookly_id is not null;

create trigger trg_inst_service_categories_updated
  before update on public.inst_service_categories
  for each row execute function public.set_updated_at();

alter table public.inst_services
  add column if not exists category_id uuid
    references public.inst_service_categories(id) on delete set null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists bookly_id integer;

create index if not exists idx_inst_services_category
  on public.inst_services (category_id);

create unique index if not exists idx_inst_services_tenant_bookly
  on public.inst_services (tenant_id, bookly_id)
  where bookly_id is not null;

alter table public.inst_service_categories enable row level security;

create policy inst_service_categories_access on public.inst_service_categories for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Catalogue public : catégories + ordre Bookly
drop function if exists public.get_public_services(uuid);

create or replace function public.get_public_services(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  color text,
  extras_step_position text,
  image_url text,
  booking_mode text,
  category_id uuid,
  category_name text,
  category_sort_order integer,
  sort_order integer
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.name,
    s.description,
    s.duration_min,
    s.price_cents,
    s.color,
    s.extras_step_position,
    s.image_url,
    s.booking_mode,
    s.category_id,
    c.name as category_name,
    coalesce(c.sort_order, 9999) as category_sort_order,
    s.sort_order
  from public.inst_services s
  left join public.inst_service_categories c on c.id = s.category_id
  where s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.visibility = 'catalog'
  order by coalesce(c.sort_order, 9999), c.name nulls last, s.sort_order, s.name;
$$;

grant execute on function public.get_public_services(uuid) to anon, authenticated;
