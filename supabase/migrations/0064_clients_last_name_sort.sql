-- Clé de tri : dernier mot du nom, accents pliés, pour un annuaire A–Z.
alter table public.clients
  add column if not exists last_name_sort text
  generated always as (
    lower(
      translate(
        coalesce(
          nullif(
            btrim(regexp_replace(coalesce(full_name, ''), '^.*[[:space:]]+', '')),
            ''
          ),
          '~'
        ),
        'àáâäãåçéèêëìíîïñòóôöõùúûüýÿÀÁÂÄÃÅÇÉÈÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝŸ',
        'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy'
      )
    )
  ) stored;

create index if not exists idx_clients_tenant_last_name_sort
  on public.clients (tenant_id, last_name_sort, id);
