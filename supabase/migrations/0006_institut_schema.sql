-- BeautyHub - Module Institut (Phase 1)
-- Tables prefixees inst_* (convention modules), toujours scopees tenant_id + RLS.

-- Prestations (services)
create table if not exists public.inst_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_min integer not null default 30 check (duration_min > 0),
  price_cents integer not null default 0,
  currency text not null default 'eur',
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_services_tenant on public.inst_services(tenant_id);
create trigger trg_inst_services_updated before update on public.inst_services
  for each row execute function public.set_updated_at();

-- Personnel (staff)
create table if not exists public.inst_staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_staff_tenant on public.inst_staff(tenant_id);
create trigger trg_inst_staff_updated before update on public.inst_staff
  for each row execute function public.set_updated_at();

-- Ressources / cabines
create table if not exists public.inst_resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_resources_tenant on public.inst_resources(tenant_id);
create trigger trg_inst_resources_updated before update on public.inst_resources
  for each row execute function public.set_updated_at();

-- Horaires d'ouverture (par staff, ou tenant-wide si staff_id NULL)
create table if not exists public.inst_working_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.inst_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = dimanche
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);
create index if not exists idx_inst_wh_tenant on public.inst_working_hours(tenant_id);
create index if not exists idx_inst_wh_staff on public.inst_working_hours(staff_id);

-- Rendez-vous
create table if not exists public.inst_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.inst_services(id) on delete set null,
  staff_id uuid references public.inst_staff(id) on delete set null,
  resource_id uuid references public.inst_resources(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked','confirmed','completed','cancelled','no_show')),
  price_cents integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index if not exists idx_inst_appt_tenant on public.inst_appointments(tenant_id);
create index if not exists idx_inst_appt_staff_time on public.inst_appointments(staff_id, starts_at);
create index if not exists idx_inst_appt_time on public.inst_appointments(tenant_id, starts_at);
create trigger trg_inst_appt_updated before update on public.inst_appointments
  for each row execute function public.set_updated_at();

-- RLS: acces equipe via auth_has_tenant_access
alter table public.inst_services       enable row level security;
alter table public.inst_staff          enable row level security;
alter table public.inst_resources      enable row level security;
alter table public.inst_working_hours  enable row level security;
alter table public.inst_appointments   enable row level security;

create policy inst_services_access on public.inst_services for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_staff_access on public.inst_staff for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_resources_access on public.inst_resources for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_working_hours_access on public.inst_working_hours for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_appointments_access on public.inst_appointments for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
