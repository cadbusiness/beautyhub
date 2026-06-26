-- BeautyHub - Institut scheduling (buffers, staff-services, time off, sales link, plan features)

alter table public.inst_services
  add column if not exists buffer_before_min integer not null default 0 check (buffer_before_min >= 0),
  add column if not exists buffer_after_min integer not null default 0 check (buffer_after_min >= 0),
  add column if not exists min_advance_hours integer not null default 0 check (min_advance_hours >= 0),
  add column if not exists max_advance_days integer not null default 60 check (max_advance_days >= 1);

alter table public.inst_sales
  add column if not exists appointment_id uuid references public.inst_appointments(id) on delete set null;

create index if not exists idx_inst_sales_appointment
  on public.inst_sales(appointment_id) where appointment_id is not null;

-- Quelles prestations chaque praticien propose
create table if not exists public.inst_staff_services (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.inst_staff(id) on delete cascade,
  service_id uuid not null references public.inst_services(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index if not exists idx_inst_staff_services_tenant on public.inst_staff_services(tenant_id);

-- Conges / indisponibilites (staff_id NULL = fermeture institut)
create table if not exists public.inst_time_off (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.inst_staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index if not exists idx_inst_time_off_tenant on public.inst_time_off(tenant_id, starts_at);
create index if not exists idx_inst_time_off_staff on public.inst_time_off(staff_id, starts_at);

-- Feature flags par formule (calendar, booking client, sms...)
alter table public.plans
  add column if not exists features jsonb not null default '{}'::jsonb;

alter table public.inst_staff_services enable row level security;
alter table public.inst_time_off enable row level security;

create policy inst_staff_services_access on public.inst_staff_services for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_time_off_access on public.inst_time_off for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
