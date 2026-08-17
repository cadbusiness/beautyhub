-- Fidélité : rattacher une cliente à un programme (groupe)

alter table public.clients
  add column if not exists loyalty_program_id uuid
    references public.inst_loyalty_programs(id) on delete set null;

create index if not exists idx_clients_loyalty_program
  on public.clients (tenant_id, loyalty_program_id)
  where loyalty_program_id is not null;
