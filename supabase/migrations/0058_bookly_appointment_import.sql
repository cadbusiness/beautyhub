-- Import Bookly : idempotence des RDV (customer_appointment id) et mapping staff.

alter table public.inst_appointments
  add column if not exists bookly_id integer;

create unique index if not exists idx_inst_appointments_tenant_bookly
  on public.inst_appointments (tenant_id, bookly_id)
  where bookly_id is not null;

alter table public.inst_staff
  add column if not exists bookly_id integer;

create unique index if not exists idx_inst_staff_tenant_bookly
  on public.inst_staff (tenant_id, bookly_id)
  where bookly_id is not null;
