-- Parrainage : cliente parrainante liée à la filleule

alter table public.clients
  add column if not exists referred_by_client_id uuid
    references public.clients(id) on delete set null;

create index if not exists idx_clients_referred_by
  on public.clients(tenant_id, referred_by_client_id)
  where referred_by_client_id is not null;

comment on column public.clients.referred_by_client_id is
  'Cliente parrainante (points fidélité crédités à la première visite terminée de la filleule).';
