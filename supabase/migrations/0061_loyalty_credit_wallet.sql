-- Bon fidélité en euros : taux de cashback + échange partiel sans récompense catalogue.

alter table public.inst_loyalty_programs
  add column if not exists credit_enabled boolean not null default false,
  add column if not exists credit_rate_bps integer not null default 0
    check (credit_rate_bps >= 0 and credit_rate_bps <= 10000);

comment on column public.inst_loyalty_programs.credit_enabled is
  'Si vrai, 1 point = 1 centime : la cliente cumule un bon en euros et peut en débiter tout ou partie en caisse.';
comment on column public.inst_loyalty_programs.credit_rate_bps is
  'Taux du bon en points de base (350 = 3,5 % = 17,50 € pour 500 €).';

alter table public.inst_loyalty_redemptions
  alter column reward_id drop not null;

-- Débit idempotent : récompense catalogue ou bon euros (reward_id null).
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
    where tenant_id = p_tenant_id
      and sale_id = p_sale_id
      and reward_id is not distinct from p_reward_id
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
