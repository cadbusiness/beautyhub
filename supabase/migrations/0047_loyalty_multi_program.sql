-- Fidélité : multi-programmes + soldes séparés par programme

-- Autoriser plusieurs programmes par institut (au plus 1 actif).
alter table public.inst_loyalty_programs
  drop constraint if exists inst_loyalty_programs_tenant_id_key;

create unique index if not exists idx_inst_loyalty_programs_one_active_per_tenant
  on public.inst_loyalty_programs(tenant_id)
  where is_active = true;

-- Chaque solde est désormais rattaché à un programme.
alter table public.inst_loyalty_balances
  add column if not exists program_id uuid references public.inst_loyalty_programs(id) on delete cascade;

update public.inst_loyalty_balances b
set program_id = (
  select p0.id
  from public.inst_loyalty_programs p0
  where p0.tenant_id = b.tenant_id
  order by p0.is_active desc, p0.created_at asc
  limit 1
)
where b.program_id is null;

alter table public.inst_loyalty_balances
  alter column program_id set not null;

alter table public.inst_loyalty_balances
  drop constraint if exists inst_loyalty_balances_pkey;

alter table public.inst_loyalty_balances
  add constraint inst_loyalty_balances_pkey primary key (tenant_id, client_id, program_id);

create index if not exists idx_inst_loyalty_balances_client on public.inst_loyalty_balances(client_id);
create index if not exists idx_inst_loyalty_balances_program
  on public.inst_loyalty_balances(tenant_id, program_id, points_balance);

-- Crédit idempotent par programme.
create or replace function public.inst_loyalty_credit(
  p_tenant_id uuid,
  p_client_id uuid,
  p_program_id uuid,
  p_rule_id uuid,
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

  insert into public.inst_loyalty_balances (tenant_id, client_id, program_id, points_balance, lifetime_earned)
  values (p_tenant_id, p_client_id, p_program_id, 0, 0)
  on conflict (tenant_id, client_id, program_id) do nothing;

  update public.inst_loyalty_balances
  set points_balance = points_balance + p_points,
      lifetime_earned = lifetime_earned + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and program_id = p_program_id
  returning points_balance into v_balance;

  insert into public.inst_loyalty_transactions (
    tenant_id, client_id, program_id, rule_id, type, points_delta, balance_after,
    source_type, source_id, idempotency_key, notes
  ) values (
    p_tenant_id, p_client_id, p_program_id, p_rule_id, 'earn', p_points, v_balance,
    p_source_type, p_source_id, p_idempotency_key, p_notes
  );

  return true;
end;
$$;

-- Débit idempotent par programme.
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

  insert into public.inst_loyalty_balances (
    tenant_id, client_id, program_id, points_balance, lifetime_earned, lifetime_redeemed
  )
  values (p_tenant_id, p_client_id, p_program_id, 0, 0, 0)
  on conflict (tenant_id, client_id, program_id) do nothing;

  update public.inst_loyalty_balances
  set points_balance = points_balance - p_points,
      lifetime_redeemed = lifetime_redeemed + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and program_id = p_program_id
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

-- Crédit bonus idempotent par programme.
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

  insert into public.inst_loyalty_balances (
    tenant_id, client_id, program_id, points_balance, lifetime_earned
  )
  values (p_tenant_id, p_client_id, p_program_id, 0, 0)
  on conflict (tenant_id, client_id, program_id) do nothing;

  update public.inst_loyalty_balances
  set points_balance = points_balance + p_points,
      lifetime_earned = lifetime_earned + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and program_id = p_program_id
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
