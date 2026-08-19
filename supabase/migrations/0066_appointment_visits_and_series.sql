-- Groupement de prestations d'une même visite + séries récurrentes.

alter table public.inst_appointments
  add column if not exists visit_id uuid,
  add column if not exists series_id uuid;

create table if not exists public.inst_appointment_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  until_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inst_appointment_series_tenant
  on public.inst_appointment_series(tenant_id);

alter table public.inst_appointments
  drop constraint if exists inst_appointments_series_id_fkey;

alter table public.inst_appointments
  add constraint inst_appointments_series_id_fkey
  foreign key (series_id) references public.inst_appointment_series(id) on delete set null;

create index if not exists idx_inst_appt_visit
  on public.inst_appointments(tenant_id, visit_id)
  where visit_id is not null;

create index if not exists idx_inst_appt_series
  on public.inst_appointments(tenant_id, series_id)
  where series_id is not null;

alter table public.inst_appointment_series enable row level security;

drop policy if exists inst_appointment_series_access on public.inst_appointment_series;
create policy inst_appointment_series_access on public.inst_appointment_series for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
