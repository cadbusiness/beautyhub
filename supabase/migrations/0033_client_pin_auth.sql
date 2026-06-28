-- Auth client : identifiant de connexion + code PIN (4 chiffres, hash côté app)

alter table public.clients
  add column if not exists login_id text,
  add column if not exists pin_hash text,
  add column if not exists pin_code text;

create unique index if not exists idx_clients_tenant_login_id
  on public.clients (tenant_id, login_id)
  where login_id is not null;

-- Attribuer un identifiant séquentiel aux clients existants
with numbered as (
  select
    id,
    tenant_id,
    row_number() over (partition by tenant_id order by created_at, id) as rn
  from public.clients
  where login_id is null
)
update public.clients c
set login_id = lpad((100000 + numbered.rn)::text, 6, '0')
from numbered
where c.id = numbered.id;

-- Les codes PIN sont générés par l'application (bcryptjs) à la création ou à l'ouverture de fiche.
