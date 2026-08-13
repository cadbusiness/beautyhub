-- Sync WooCommerce customers avec dedup Rovercash
-- Ajoute source + external_id sur clients pour tracer l'origine et
-- garantir l'idempotence des re-syncs (Woo, Rovercash, Bookly...).

alter table public.clients
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;

alter table public.clients
  drop constraint if exists clients_source_check;

alter table public.clients
  add constraint clients_source_check
    check (source in ('manual', 'rovercash', 'woo', 'bookly', 'import'));

-- Backfill : les clients importés Rovercash sont marqués via metadata ou tags
update public.clients
set source = 'rovercash'
where source = 'manual'
  and (metadata->>'import_source' = 'rovercash' or 'Rovercash' = any(coalesce(tags, '{}')));

update public.clients
set external_id = metadata->>'rovercash_ref'
where source = 'rovercash'
  and external_id is null
  and metadata->>'rovercash_ref' is not null;

-- Idempotence des re-syncs : (tenant_id, source, external_id) unique quand renseigne
create unique index if not exists uniq_clients_tenant_source_external
  on public.clients (tenant_id, source, external_id)
  where external_id is not null;

create index if not exists idx_clients_tenant_source on public.clients (tenant_id, source);

comment on column public.clients.source is
  'Origine du client : manual (créé dans BH), rovercash (import CSV), woo (customer WooCommerce), bookly (import Bookly), import (autre CSV générique).';
comment on column public.clients.external_id is
  'ID stable côté source externe (customer_id Woo, référence Rovercash, etc.). Nullable pour les créations BH natives.';

-- Fonction de normalisation de téléphone : garde uniquement les chiffres,
-- convertit un préfixe national FR "0X..." en "33X...", supprime les "+"
-- initiaux, sinon retourne null si moins de 6 chiffres significatifs.
-- Utilisée pour la dédup phone-first entre sources.
create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  digits text;
begin
  if raw is null then return null; end if;
  digits := regexp_replace(raw, '\D', '', 'g');
  if length(digits) < 6 then return null; end if;
  -- Convention : "0X..." avec 10 chiffres => "33X..."
  if length(digits) = 10 and left(digits, 1) = '0' then
    digits := '33' || substring(digits from 2);
  end if;
  -- Supprime le "00" international en début (00 33 X → 33 X)
  if left(digits, 2) = '00' then
    digits := substring(digits from 3);
  end if;
  return digits;
end;
$$;

comment on function public.normalize_phone(text) is
  'Normalise un numéro de téléphone pour la dédup : garde uniquement les chiffres, convertit 0X... en 33X..., renvoie null si trop court.';

-- Index expression sur normalize_phone pour permettre les lookups rapides
create index if not exists idx_clients_tenant_phone_normalized
  on public.clients (tenant_id, public.normalize_phone(phone))
  where phone is not null;
