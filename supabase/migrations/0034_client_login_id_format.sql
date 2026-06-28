-- Identifiants client lisibles : préfixe institut + numéro (ex. ins-001)

with tenant_prefix as (
  select
    id as tenant_id,
    lower(left(regexp_replace(split_part(name, ' ', 1), '[^a-zA-Z]', '', 'g'), 3)) as prefix
  from public.tenants
),
numbered as (
  select
    c.id,
    tp.prefix,
    row_number() over (partition by c.tenant_id order by c.created_at, c.id) as rn
  from public.clients c
  join tenant_prefix tp on tp.tenant_id = c.tenant_id
  where c.login_id is null
     or c.login_id ~ '^\d+$'
)
update public.clients c
set login_id = numbered.prefix || '-' || lpad(numbered.rn::text, 3, '0')
from numbered
where c.id = numbered.id
  and length(numbered.prefix) >= 2;
