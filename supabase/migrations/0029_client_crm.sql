-- Fiche client CRM : coordonnées étendues, notes et badges

alter table public.clients
  add column if not exists date_of_birth date,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists country text default 'FR',
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_clients_tags on public.clients using gin (tags);
