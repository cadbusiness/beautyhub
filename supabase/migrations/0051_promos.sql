-- BeautyHub - Promos marketing multi-canal (Woo + booking + POS)

create table if not exists public.inst_promos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  discount_type text not null
    check (discount_type in ('percent', 'fixed')),
  discount_percent integer
    check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  discount_cents integer
    check (discount_cents is null or discount_cents > 0),
  min_order_cents integer not null default 0
    check (min_order_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer
    check (usage_limit is null or usage_limit > 0),
  usage_limit_per_client integer
    check (usage_limit_per_client is null or usage_limit_per_client > 0),
  usage_count integer not null default 0
    check (usage_count >= 0),
  channel_woo boolean not null default true,
  channel_booking boolean not null default true,
  channel_pos boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (
    (discount_type = 'percent' and discount_percent is not null and discount_cents is null)
    or (discount_type = 'fixed' and discount_cents is not null and discount_percent is null)
  ),
  check (starts_at is null or ends_at is null or starts_at <= ends_at),
  check (channel_woo or channel_booking or channel_pos)
);

create index if not exists idx_inst_promos_tenant_active
  on public.inst_promos(tenant_id, is_active, created_at desc);
create index if not exists idx_inst_promos_tenant_code
  on public.inst_promos(tenant_id, code);

create trigger trg_inst_promos_updated before update on public.inst_promos
  for each row execute function public.set_updated_at();

create table if not exists public.inst_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  promo_id uuid not null references public.inst_promos(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  channel text not null
    check (channel in ('woo', 'booking', 'pos')),
  amount_cents integer not null check (amount_cents > 0),
  sale_id uuid references public.inst_sales(id) on delete set null,
  appointment_id uuid references public.inst_appointments(id) on delete set null,
  woo_order_id bigint,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_inst_promo_redemptions_idempotency
  on public.inst_promo_redemptions(tenant_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists idx_inst_promo_redemptions_promo
  on public.inst_promo_redemptions(promo_id, created_at desc);
create index if not exists idx_inst_promo_redemptions_client
  on public.inst_promo_redemptions(tenant_id, client_id)
  where client_id is not null;
create index if not exists idx_inst_promo_redemptions_sale
  on public.inst_promo_redemptions(sale_id)
  where sale_id is not null;
create index if not exists idx_inst_promo_redemptions_appointment
  on public.inst_promo_redemptions(appointment_id)
  where appointment_id is not null;

alter table public.inst_appointments
  add column if not exists promo_id uuid references public.inst_promos(id) on delete set null,
  add column if not exists promo_discount_cents integer
    check (promo_discount_cents is null or promo_discount_cents >= 0);

create index if not exists idx_inst_appointments_promo
  on public.inst_appointments(promo_id)
  where promo_id is not null;

alter table public.inst_promos enable row level security;
alter table public.inst_promo_redemptions enable row level security;

drop policy if exists inst_promos_access on public.inst_promos;
create policy inst_promos_access on public.inst_promos for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

drop policy if exists inst_promo_redemptions_access on public.inst_promo_redemptions;
create policy inst_promo_redemptions_access on public.inst_promo_redemptions for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create or replace function public.inst_redeem_promo(
  p_tenant_id uuid,
  p_code text,
  p_channel text,
  p_amount_cents integer,
  p_client_id uuid default null,
  p_sale_id uuid default null,
  p_appointment_id uuid default null,
  p_woo_order_id bigint default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  promo_id uuid,
  code text,
  amount_cents integer,
  usage_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.inst_promos%rowtype;
  v_redemption public.inst_promo_redemptions%rowtype;
  v_now timestamptz := now();
  v_client_uses integer;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code = '' then
    raise exception 'promo_code_required';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_channel not in ('woo', 'booking', 'pos') then
    raise exception 'promo_channel_invalid';
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select r.*
    into v_redemption
    from public.inst_promo_redemptions r
    where r.tenant_id = p_tenant_id
      and r.idempotency_key = trim(p_idempotency_key)
    limit 1;

    if found then
      select p.code, p.usage_count
      into code, usage_count
      from public.inst_promos p
      where p.id = v_redemption.promo_id;

      redemption_id := v_redemption.id;
      promo_id := v_redemption.promo_id;
      amount_cents := v_redemption.amount_cents;
      return next;
      return;
    end if;
  end if;

  select *
  into v_promo
  from public.inst_promos
  where tenant_id = p_tenant_id
    and code = v_code
  for update;

  if not found then
    raise exception 'promo_not_found';
  end if;

  if not v_promo.is_active then
    raise exception 'promo_inactive';
  end if;

  if v_promo.starts_at is not null and v_promo.starts_at > v_now then
    raise exception 'promo_not_started';
  end if;

  if v_promo.ends_at is not null and v_promo.ends_at < v_now then
    raise exception 'promo_expired';
  end if;

  if p_channel = 'woo' and not v_promo.channel_woo then
    raise exception 'promo_channel_disabled';
  end if;
  if p_channel = 'booking' and not v_promo.channel_booking then
    raise exception 'promo_channel_disabled';
  end if;
  if p_channel = 'pos' and not v_promo.channel_pos then
    raise exception 'promo_channel_disabled';
  end if;

  if v_promo.usage_limit is not null and v_promo.usage_count >= v_promo.usage_limit then
    raise exception 'promo_exhausted';
  end if;

  if p_client_id is not null and v_promo.usage_limit_per_client is not null then
    select count(*)::integer
    into v_client_uses
    from public.inst_promo_redemptions r
    where r.tenant_id = p_tenant_id
      and r.promo_id = v_promo.id
      and r.client_id = p_client_id;

    if v_client_uses >= v_promo.usage_limit_per_client then
      raise exception 'promo_client_limit';
    end if;
  end if;

  update public.inst_promos
  set usage_count = usage_count + 1
  where id = v_promo.id
  returning usage_count into usage_count;

  insert into public.inst_promo_redemptions (
    tenant_id,
    promo_id,
    client_id,
    channel,
    amount_cents,
    sale_id,
    appointment_id,
    woo_order_id,
    idempotency_key,
    metadata
  ) values (
    p_tenant_id,
    v_promo.id,
    p_client_id,
    p_channel,
    p_amount_cents,
    p_sale_id,
    p_appointment_id,
    p_woo_order_id,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into redemption_id;

  promo_id := v_promo.id;
  code := v_promo.code;
  amount_cents := p_amount_cents;
  return next;
end;
$$;

grant execute on function public.inst_redeem_promo(
  uuid, text, text, integer, uuid, uuid, uuid, bigint, text, jsonb
) to authenticated, service_role;
