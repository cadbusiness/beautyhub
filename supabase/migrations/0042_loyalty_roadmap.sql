-- Fidélité : échange caisse, bonus automatisés (anniversaire, parrainage, rebooking), QR public

alter table public.inst_loyalty_programs
  add column if not exists referral_points integer not null default 0
    check (referral_points >= 0),
  add column if not exists same_day_rebook_points integer not null default 0
    check (same_day_rebook_points >= 0),
  add column if not exists birthday_auto_enabled boolean not null default false;

comment on column public.inst_loyalty_programs.referral_points is
  'Points offerts à la cliente parrainante lorsqu''une filleule effectue sa première visite (0 = désactivé).';
comment on column public.inst_loyalty_programs.same_day_rebook_points is
  'Points bonus si la cliente reprend RDV le jour même (0 = désactivé).';
comment on column public.inst_loyalty_programs.birthday_auto_enabled is
  'Créditer automatiquement birthday_bonus_points le jour d''anniversaire.';

alter table public.inst_loyalty_balances
  add column if not exists last_birthday_bonus_year smallint
    check (last_birthday_bonus_year is null or last_birthday_bonus_year >= 1900);

comment on column public.inst_loyalty_balances.last_birthday_bonus_year is
  'Dernière année civile où le bonus anniversaire a été crédité (évite les doublons).';

-- Historique des échanges (caisse, futur portail)
create table if not exists public.inst_loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  program_id uuid not null references public.inst_loyalty_programs(id) on delete cascade,
  reward_id uuid not null references public.inst_loyalty_rewards(id) on delete restrict,
  sale_id uuid references public.inst_sales(id) on delete set null,
  appointment_id uuid references public.inst_appointments(id) on delete set null,
  points_spent integer not null check (points_spent > 0),
  discount_cents integer check (discount_cents is null or discount_cents >= 0),
  status text not null default 'applied' check (status in ('pending', 'applied', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_inst_loyalty_redemptions_tenant_client
  on public.inst_loyalty_redemptions(tenant_id, client_id, created_at desc);
create index if not exists idx_inst_loyalty_redemptions_sale
  on public.inst_loyalty_redemptions(tenant_id, sale_id)
  where sale_id is not null;

comment on table public.inst_loyalty_redemptions is
  'Échanges de points contre récompenses (caisse ou portail).';

alter table public.inst_loyalty_redemptions enable row level security;

create policy inst_loyalty_redemptions_access on public.inst_loyalty_redemptions for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Débite des points et enregistre l''échange de façon atomique et idempotente.
create or replace function public.inst_loyalty_redeem(
  p_tenant_id uuid,
  p_client_id uuid,
  p_program_id uuid,
  p_reward_id uuid,
  p_points integer,
  p_sale_id uuid,
  p_discount_cents integer,
  p_idempotency_key text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_redemption_id uuid;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'invalid_points';
  end if;

  if exists (
    select 1 from public.inst_loyalty_transactions
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
  ) then
    select id into v_redemption_id
    from public.inst_loyalty_redemptions
    where tenant_id = p_tenant_id and sale_id = p_sale_id and reward_id = p_reward_id
    limit 1;
    return v_redemption_id;
  end if;

  insert into public.inst_loyalty_balances (tenant_id, client_id, points_balance, lifetime_earned, lifetime_redeemed)
  values (p_tenant_id, p_client_id, 0, 0, 0)
  on conflict (tenant_id, client_id) do nothing;

  update public.inst_loyalty_balances
  set points_balance = points_balance - p_points,
      lifetime_redeemed = lifetime_redeemed + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and points_balance >= p_points
  returning points_balance into v_balance;

  if not found then
    raise exception 'insufficient_points';
  end if;

  insert into public.inst_loyalty_transactions (
    tenant_id, client_id, program_id, reward_id, type, points_delta, balance_after,
    source_type, source_id, idempotency_key, notes
  ) values (
    p_tenant_id, p_client_id, p_program_id, p_reward_id, 'redeem', -p_points, v_balance,
    'pos_sale', p_sale_id, p_idempotency_key, p_notes
  );

  insert into public.inst_loyalty_redemptions (
    tenant_id, client_id, program_id, reward_id, sale_id, points_spent, discount_cents, status
  ) values (
    p_tenant_id, p_client_id, p_program_id, p_reward_id, p_sale_id, p_points, p_discount_cents, 'applied'
  )
  returning id into v_redemption_id;

  return v_redemption_id;
end;
$$;

revoke all on function public.inst_loyalty_redeem(uuid, uuid, uuid, uuid, integer, uuid, integer, text, text) from public;
grant execute on function public.inst_loyalty_redeem(uuid, uuid, uuid, uuid, integer, uuid, integer, text, text) to authenticated;

-- Crédit bonus sans règle de gain (anniversaire, parrainage, rebooking).
create or replace function public.inst_loyalty_credit_bonus(
  p_tenant_id uuid,
  p_client_id uuid,
  p_program_id uuid,
  p_points integer,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_points is null or p_points <= 0 then
    return false;
  end if;

  if exists (
    select 1 from public.inst_loyalty_transactions
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
  ) then
    return false;
  end if;

  insert into public.inst_loyalty_balances (tenant_id, client_id, points_balance, lifetime_earned)
  values (p_tenant_id, p_client_id, 0, 0)
  on conflict (tenant_id, client_id) do nothing;

  update public.inst_loyalty_balances
  set points_balance = points_balance + p_points,
      lifetime_earned = lifetime_earned + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id and client_id = p_client_id
  returning points_balance into v_balance;

  insert into public.inst_loyalty_transactions (
    tenant_id, client_id, program_id, type, points_delta, balance_after,
    source_type, source_id, idempotency_key, notes
  ) values (
    p_tenant_id, p_client_id, p_program_id, 'earn', p_points, v_balance,
    p_source_type, p_source_id, p_idempotency_key, p_notes
  );

  return true;
end;
$$;

revoke all on function public.inst_loyalty_credit_bonus(uuid, uuid, uuid, integer, text, uuid, text, text) from public;
grant execute on function public.inst_loyalty_credit_bonus(uuid, uuid, uuid, integer, text, uuid, text, text) to authenticated;
