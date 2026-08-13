-- Rovercash (ex-libellé erroné "Overcache") : index + migration metadata/tags

-- Migrer les anciennes clés metadata si présentes
update public.clients
set metadata =
  (metadata - 'overcache_ref' - 'overcache_type' - 'overcache_category'
           - 'overcache_civility' - 'overcache_language' - 'overcache_vat')
  || jsonb_strip_nulls(jsonb_build_object(
    'rovercash_ref', metadata->'overcache_ref',
    'rovercash_type', metadata->'overcache_type',
    'rovercash_category', metadata->'overcache_category',
    'rovercash_civility', metadata->'overcache_civility',
    'rovercash_language', metadata->'overcache_language',
    'rovercash_vat', metadata->'overcache_vat',
    'import_source', 'rovercash'
  ))
where metadata ? 'overcache_ref';

-- Badge tag
update public.clients
set tags = (
  select coalesce(array_agg(distinct t), '{}')
  from unnest(
    array_replace(coalesce(tags, '{}'), 'Overcache', 'Rovercash')
  ) as t
)
where tags is not null and 'Overcache' = any(tags);

create index if not exists idx_clients_tenant_rovercash_ref
  on public.clients (tenant_id, (metadata->>'rovercash_ref'))
  where metadata->>'rovercash_ref' is not null;
