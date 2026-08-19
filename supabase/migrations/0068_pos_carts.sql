-- Paniers caisse partagés (tickets en attente, multi-tablettes).

create table if not exists public.inst_pos_carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'checked_out', 'abandoned')),
  label text not null default 'Panier',
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.inst_appointments(id) on delete set null,
  staff_id uuid references public.inst_staff(id) on delete set null,
  lines jsonb not null default '{}'::jsonb,
  price_overrides jsonb not null default '{}'::jsonb,
  discount_kind text check (discount_kind in ('percent', 'fixed')),
  discount_value numeric,
  discount_reason text,
  cart_discount_cents integer not null default 0 check (cart_discount_cents >= 0),
  notes text,
  locked_by uuid,
  locked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inst_pos_carts_tenant_open
  on public.inst_pos_carts (tenant_id, status, updated_at desc);

create trigger trg_inst_pos_carts_updated
  before update on public.inst_pos_carts
  for each row execute function public.set_updated_at();

alter table public.inst_pos_carts enable row level security;

create policy inst_pos_carts_access on public.inst_pos_carts for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
