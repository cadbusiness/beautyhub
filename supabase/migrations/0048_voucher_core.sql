-- BeautyHub - Voucher core omnicanal (POS + Woo)

create table if not exists public.inst_vouchers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  voucher_type text not null
    check (voucher_type in ('gift_card', 'credit_note', 'voucher')),
  source_channel text not null default 'pos'
    check (source_channel in ('pos', 'woo', 'legacy', 'admin', 'api')),
  currency text not null default 'eur',
  initial_amount_cents integer not null check (initial_amount_cents > 0),
  current_balance_cents integer not null check (current_balance_cents >= 0),
  status text not null default 'active'
    check (status in ('active', 'depleted', 'cancelled', 'expired')),
  recipient_name text,
  client_id uuid references public.clients(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_inst_vouchers_tenant_status
  on public.inst_vouchers(tenant_id, status, created_at desc);
create index if not exists idx_inst_vouchers_tenant_code
  on public.inst_vouchers(tenant_id, code);

create trigger trg_inst_vouchers_updated before update on public.inst_vouchers
  for each row execute function public.set_updated_at();

create table if not exists public.inst_voucher_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  voucher_id uuid not null references public.inst_vouchers(id) on delete cascade,
  event_type text not null
    check (event_type in ('issue', 'redeem', 'refund', 'void', 'sync', 'adjustment')),
  amount_cents integer not null default 0,
  balance_after_cents integer not null default 0,
  source_channel text not null default 'pos'
    check (source_channel in ('pos', 'woo', 'legacy', 'admin', 'api')),
  sale_id uuid references public.inst_sales(id) on delete set null,
  woo_order_id bigint,
  woo_coupon_code text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_inst_voucher_events_idempotency
  on public.inst_voucher_events(tenant_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists idx_inst_voucher_events_voucher_created
  on public.inst_voucher_events(voucher_id, created_at desc);

create table if not exists public.inst_voucher_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  voucher_id uuid not null references public.inst_vouchers(id) on delete cascade,
  sale_id uuid references public.inst_sales(id) on delete set null,
  woo_order_id bigint,
  woo_coupon_code text,
  legacy_type text
    check (legacy_type in ('inst_gift_cards', 'inst_credit_notes')),
  legacy_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_inst_voucher_links_voucher
  on public.inst_voucher_links(voucher_id);
create index if not exists idx_inst_voucher_links_sale
  on public.inst_voucher_links(sale_id)
  where sale_id is not null;
create index if not exists idx_inst_voucher_links_woo_order
  on public.inst_voucher_links(tenant_id, woo_order_id)
  where woo_order_id is not null;
create unique index if not exists uniq_inst_voucher_links_legacy
  on public.inst_voucher_links(tenant_id, legacy_type, legacy_id)
  where legacy_type is not null and legacy_id is not null;

alter table public.inst_vouchers enable row level security;
alter table public.inst_voucher_events enable row level security;
alter table public.inst_voucher_links enable row level security;

drop policy if exists inst_vouchers_access on public.inst_vouchers;
create policy inst_vouchers_access on public.inst_vouchers for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

drop policy if exists inst_voucher_events_access on public.inst_voucher_events;
create policy inst_voucher_events_access on public.inst_voucher_events for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

drop policy if exists inst_voucher_links_access on public.inst_voucher_links;
create policy inst_voucher_links_access on public.inst_voucher_links for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create or replace function public.inst_redeem_voucher(
  p_tenant_id uuid,
  p_code text,
  p_amount_cents integer,
  p_source_channel text default 'pos',
  p_sale_id uuid default null,
  p_woo_order_id bigint default null,
  p_woo_coupon_code text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  voucher_id uuid,
  code text,
  remaining_cents integer,
  status text,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.inst_vouchers%rowtype;
  v_event public.inst_voucher_events%rowtype;
  v_now timestamptz := now();
  v_balance integer;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select e.* into v_event
    from public.inst_voucher_events e
    where e.tenant_id = p_tenant_id
      and e.idempotency_key = p_idempotency_key
      and e.event_type = 'redeem'
    limit 1;

    if found then
      return query
      select v.id, v.code, e.balance_after_cents, v.status, e.id
      from public.inst_vouchers v
      join public.inst_voucher_events e on e.voucher_id = v.id
      where e.id = v_event.id;
      return;
    end if;
  end if;

  select *
  into v_voucher
  from public.inst_vouchers
  where tenant_id = p_tenant_id
    and upper(code) = upper(p_code)
  for update;

  if not found then
    raise exception 'voucher_not_found';
  end if;

  if v_voucher.status <> 'active' then
    raise exception 'voucher_invalid';
  end if;

  if v_voucher.expires_at is not null and v_voucher.expires_at < v_now then
    update public.inst_vouchers
    set status = 'expired'
    where id = v_voucher.id;
    raise exception 'voucher_expired';
  end if;

  if v_voucher.current_balance_cents < p_amount_cents then
    raise exception 'voucher_insufficient';
  end if;

  v_balance := v_voucher.current_balance_cents - p_amount_cents;

  update public.inst_vouchers
  set current_balance_cents = v_balance,
      status = case when v_balance = 0 then 'depleted' else 'active' end
  where id = v_voucher.id;

  insert into public.inst_voucher_events (
    tenant_id,
    voucher_id,
    event_type,
    amount_cents,
    balance_after_cents,
    source_channel,
    sale_id,
    woo_order_id,
    woo_coupon_code,
    idempotency_key,
    metadata
  ) values (
    p_tenant_id,
    v_voucher.id,
    'redeem',
    p_amount_cents,
    v_balance,
    case
      when p_source_channel in ('pos','woo','legacy','admin','api') then p_source_channel
      else 'api'
    end,
    p_sale_id,
    p_woo_order_id,
    nullif(p_woo_coupon_code, ''),
    nullif(p_idempotency_key, ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_event;

  return query
  select v_voucher.id, v_voucher.code, v_balance,
         case when v_balance = 0 then 'depleted' else 'active' end,
         v_event.id;
end;
$$;

grant execute on function public.inst_redeem_voucher(
  uuid, text, integer, text, uuid, bigint, text, text, jsonb
) to authenticated;

-- Backfill legacy gift cards
insert into public.inst_vouchers (
  tenant_id,
  code,
  voucher_type,
  source_channel,
  currency,
  initial_amount_cents,
  current_balance_cents,
  status,
  recipient_name,
  client_id,
  issued_at,
  expires_at,
  metadata
)
select
  g.tenant_id,
  upper(g.code),
  'gift_card',
  'legacy',
  'eur',
  g.initial_balance_cents,
  g.balance_cents,
  case
    when g.status = 'active' then 'active'
    when g.status = 'depleted' then 'depleted'
    else 'cancelled'
  end,
  g.recipient_name,
  g.client_id,
  g.created_at,
  g.expires_at,
  jsonb_build_object('legacy_table', 'inst_gift_cards', 'legacy_id', g.id)
from public.inst_gift_cards g
on conflict (tenant_id, code) do nothing;

insert into public.inst_voucher_links (
  tenant_id,
  voucher_id,
  sale_id,
  legacy_type,
  legacy_id
)
select
  g.tenant_id,
  v.id,
  g.sale_id,
  'inst_gift_cards',
  g.id
from public.inst_gift_cards g
join public.inst_vouchers v
  on v.tenant_id = g.tenant_id
 and v.code = upper(g.code)
on conflict do nothing;

-- Backfill legacy credit notes
insert into public.inst_vouchers (
  tenant_id,
  code,
  voucher_type,
  source_channel,
  currency,
  initial_amount_cents,
  current_balance_cents,
  status,
  recipient_name,
  client_id,
  issued_at,
  expires_at,
  metadata
)
select
  c.tenant_id,
  upper(c.credit_number),
  'credit_note',
  'legacy',
  'eur',
  c.amount_cents,
  c.remaining_cents,
  case
    when c.status = 'active' then 'active'
    when c.status = 'depleted' then 'depleted'
    else 'cancelled'
  end,
  null,
  c.client_id,
  c.created_at,
  c.expires_at,
  jsonb_build_object('legacy_table', 'inst_credit_notes', 'legacy_id', c.id)
from public.inst_credit_notes c
on conflict (tenant_id, code) do nothing;

insert into public.inst_voucher_links (
  tenant_id,
  voucher_id,
  sale_id,
  legacy_type,
  legacy_id
)
select
  c.tenant_id,
  v.id,
  c.sale_id,
  'inst_credit_notes',
  c.id
from public.inst_credit_notes c
join public.inst_vouchers v
  on v.tenant_id = c.tenant_id
 and v.code = upper(c.credit_number)
on conflict do nothing;
