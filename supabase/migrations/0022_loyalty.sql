-- BeautyHub - Programme de fidélité configurable (gains, récompenses, ledger)

create table if not exists public.inst_loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  name text not null default 'Programme fidélité',
  is_active boolean not null default false,
  points_label text not null default 'points',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_loyalty_programs_tenant on public.inst_loyalty_programs(tenant_id);
create trigger trg_inst_loyalty_programs_updated before update on public.inst_loyalty_programs
  for each row execute function public.set_updated_at();

comment on table public.inst_loyalty_programs is
  'Programme de fidélité par institut (règles de gain et récompenses associées).';

-- Règles de gain de points
create table if not exists public.inst_loyalty_earn_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  program_id uuid not null references public.inst_loyalty_programs(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  source_type text not null check (source_type in (
    'appointment_completed',
    'pos_sale',
    'woocommerce_order',
    'shopify_order'
  )),
  calc_mode text not null check (calc_mode in ('fixed_per_event', 'per_euro_spent')),
  points_value integer not null check (points_value > 0),
  min_amount_cents integer not null default 0 check (min_amount_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_loyalty_earn_rules_program on public.inst_loyalty_earn_rules(program_id);
create index if not exists idx_inst_loyalty_earn_rules_tenant on public.inst_loyalty_earn_rules(tenant_id, is_active);
create trigger trg_inst_loyalty_earn_rules_updated before update on public.inst_loyalty_earn_rules
  for each row execute function public.set_updated_at();

comment on column public.inst_loyalty_earn_rules.source_type is
  'appointment_completed = RDV terminé ; pos_sale = vente caisse institut ; woocommerce_order = commande Woo ; shopify_order = commande Shopify (futur).';
comment on column public.inst_loyalty_earn_rules.calc_mode is
  'fixed_per_event = points fixes ; per_euro_spent = points par euro dépensé (points_value = points pour 100 centimes).';

-- Récompenses échangeables contre des points
create table if not exists public.inst_loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  program_id uuid not null references public.inst_loyalty_programs(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  reward_type text not null check (reward_type in ('discount_percent', 'discount_fixed', 'free_service')),
  points_cost integer not null check (points_cost > 0),
  discount_percent integer check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  discount_cents integer check (discount_cents is null or discount_cents > 0),
  service_id uuid references public.inst_services(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (reward_type = 'discount_percent' and discount_percent is not null)
    or (reward_type = 'discount_fixed' and discount_cents is not null)
    or (reward_type = 'free_service' and service_id is not null)
  )
);
create index if not exists idx_inst_loyalty_rewards_program on public.inst_loyalty_rewards(program_id);
create index if not exists idx_inst_loyalty_rewards_tenant on public.inst_loyalty_rewards(tenant_id, is_active);
create trigger trg_inst_loyalty_rewards_updated before update on public.inst_loyalty_rewards
  for each row execute function public.set_updated_at();

-- Solde points par cliente
create table if not exists public.inst_loyalty_balances (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_redeemed integer not null default 0 check (lifetime_redeemed >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, client_id)
);
create index if not exists idx_inst_loyalty_balances_client on public.inst_loyalty_balances(client_id);
create trigger trg_inst_loyalty_balances_updated before update on public.inst_loyalty_balances
  for each row execute function public.set_updated_at();

-- Ledger des mouvements (idempotent via idempotency_key)
create table if not exists public.inst_loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  program_id uuid references public.inst_loyalty_programs(id) on delete set null,
  rule_id uuid references public.inst_loyalty_earn_rules(id) on delete set null,
  reward_id uuid references public.inst_loyalty_rewards(id) on delete set null,
  type text not null check (type in ('earn', 'redeem', 'adjust', 'expire')),
  points_delta integer not null check (points_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  source_type text,
  source_id uuid,
  idempotency_key text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index if not exists idx_inst_loyalty_tx_client on public.inst_loyalty_transactions(tenant_id, client_id, created_at desc);
create index if not exists idx_inst_loyalty_tx_source on public.inst_loyalty_transactions(tenant_id, source_type, source_id);

alter table public.inst_loyalty_programs enable row level security;
alter table public.inst_loyalty_earn_rules enable row level security;
alter table public.inst_loyalty_rewards enable row level security;
alter table public.inst_loyalty_balances enable row level security;
alter table public.inst_loyalty_transactions enable row level security;

create policy inst_loyalty_programs_access on public.inst_loyalty_programs for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_loyalty_earn_rules_access on public.inst_loyalty_earn_rules for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_loyalty_rewards_access on public.inst_loyalty_rewards for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_loyalty_balances_access on public.inst_loyalty_balances for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_loyalty_transactions_access on public.inst_loyalty_transactions for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Crédite des points de façon atomique et idempotente. Retourne true si crédité, false si déjà traité.
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
    tenant_id, client_id, program_id, rule_id, type, points_delta, balance_after,
    source_type, source_id, idempotency_key, notes
  ) values (
    p_tenant_id, p_client_id, p_program_id, p_rule_id, 'earn', p_points, v_balance,
    p_source_type, p_source_id, p_idempotency_key, p_notes
  );

  return true;
end;
$$;

revoke all on function public.inst_loyalty_credit(uuid, uuid, uuid, uuid, integer, text, uuid, text, text) from public;
grant execute on function public.inst_loyalty_credit(uuid, uuid, uuid, uuid, integer, text, uuid, text, text) to authenticated;
