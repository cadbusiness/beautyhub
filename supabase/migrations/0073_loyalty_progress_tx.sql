-- Autoriser un mouvement à 0 € pour garder l’idempotence du cumul
-- (un ticket de 80 € n’ouvre pas encore de tranche, mais ne doit pas se rejouer).

alter table public.inst_loyalty_transactions
  drop constraint if exists inst_loyalty_transactions_points_delta_check;

create or replace function public.inst_loyalty_add_progress(
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
  v_threshold integer;
  v_rate integer;
  v_tranche_cents integer;
  v_progress integer;
  v_credit integer;
  v_tranches integer;
  v_added integer := 0;
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

  select
    greatest(1, coalesce(credit_threshold_points, 500)),
    greatest(0, coalesce(credit_rate_bps, 0))
  into v_threshold, v_rate
  from public.inst_loyalty_programs
  where id = p_program_id and tenant_id = p_tenant_id;

  if not found then
    raise exception 'loyalty_program_not_found';
  end if;

  v_tranche_cents := floor((v_threshold::numeric * 100 * v_rate) / 10000);

  insert into public.inst_loyalty_balances (
    tenant_id, client_id, program_id, points_balance, lifetime_earned, progress_points
  )
  values (p_tenant_id, p_client_id, p_program_id, 0, 0, 0)
  on conflict (tenant_id, client_id, program_id) do nothing;

  update public.inst_loyalty_balances
  set progress_points = progress_points + p_points,
      updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and program_id = p_program_id
  returning progress_points, points_balance into v_progress, v_credit;

  if v_tranche_cents > 0 and v_progress >= v_threshold then
    v_tranches := v_progress / v_threshold;
    v_added := v_tranches * v_tranche_cents;
    v_progress := v_progress - v_tranches * v_threshold;
    v_credit := v_credit + v_added;

    update public.inst_loyalty_balances
    set progress_points = v_progress,
        points_balance = v_credit,
        lifetime_earned = lifetime_earned + v_added,
        updated_at = now()
    where tenant_id = p_tenant_id
      and client_id = p_client_id
      and program_id = p_program_id;
  end if;

  insert into public.inst_loyalty_transactions (
    tenant_id, client_id, program_id, type, points_delta, balance_after,
    source_type, source_id, idempotency_key, notes
  ) values (
    p_tenant_id, p_client_id, p_program_id, 'earn', v_added, v_credit,
    p_source_type, p_source_id, p_idempotency_key,
    coalesce(p_notes, 'Cumul fidélité')
  );

  return true;
end;
$$;
