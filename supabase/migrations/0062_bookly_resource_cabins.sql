-- Bookly « staff » = cabines / événements, pas le personnel.

alter table public.inst_resources
  add column if not exists bookly_id integer;

create unique index if not exists idx_inst_resources_tenant_bookly
  on public.inst_resources (tenant_id, bookly_id)
  where bookly_id is not null;

alter table public.inst_resources
  add column if not exists kind text not null default 'cabin';

alter table public.inst_resources
  drop constraint if exists inst_resources_kind_check;

alter table public.inst_resources
  add constraint inst_resources_kind_check
  check (kind in ('cabin', 'event'));
