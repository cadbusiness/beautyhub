-- BeautyHub - Caisse Phase B: sessions, avoirs, bons-cadeaux, rapports X/Z

-- ---------------------------------------------------------------------------
-- Paramètres caisse: session obligatoire + préfixes
-- ---------------------------------------------------------------------------
alter table public.inst_pos_settings
  add column if not exists require_open_session boolean not null default false,
  add column if not exists default_opening_float_cents integer not null default 0
    check (default_opening_float_cents >= 0),
  add column if not exists credit_note_prefix text not null default 'AV',
  add column if not exists gift_card_prefix text not null default 'GC';

-- ---------------------------------------------------------------------------
-- Sessions de caisse
-- ---------------------------------------------------------------------------
create table if not exists public.inst_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_float_cents integer not null default 0 check (opening_float_cents >= 0),
  closing_counted_cents integer,
  closing_expected_cents integer,
  closing_variance_cents integer,
  z_report_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_cash_sessions_tenant on public.inst_cash_sessions(tenant_id, opened_at desc);
create unique index if not exists uniq_inst_cash_sessions_open
  on public.inst_cash_sessions(tenant_id) where status = 'open';

create trigger trg_inst_cash_sessions_updated before update on public.inst_cash_sessions
  for each row execute function public.set_updated_at();

alter table public.inst_cash_sessions enable row level security;
create policy inst_cash_sessions_access on public.inst_cash_sessions for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Mouvements caisse (entrées / sorties / notes de frais)
-- ---------------------------------------------------------------------------
create table if not exists public.inst_cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.inst_cash_sessions(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'expense')),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inst_cash_movements_session on public.inst_cash_movements(session_id);

alter table public.inst_cash_movements enable row level security;
create policy inst_cash_movements_access on public.inst_cash_movements for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Rapports X / Z (snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.inst_cash_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.inst_cash_sessions(id) on delete cascade,
  report_type text not null check (report_type in ('x', 'z')),
  report_number text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_inst_cash_reports_session on public.inst_cash_reports(session_id);

alter table public.inst_cash_reports enable row level security;
create policy inst_cash_reports_access on public.inst_cash_reports for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Avoirs
-- ---------------------------------------------------------------------------
create table if not exists public.inst_credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.inst_sales(id) on delete set null,
  credit_number text not null,
  amount_cents integer not null check (amount_cents > 0),
  remaining_cents integer not null check (remaining_cents >= 0),
  status text not null default 'active'
    check (status in ('active', 'depleted', 'cancelled')),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, credit_number)
);
create index if not exists idx_inst_credit_notes_tenant on public.inst_credit_notes(tenant_id);
create trigger trg_inst_credit_notes_updated before update on public.inst_credit_notes
  for each row execute function public.set_updated_at();

alter table public.inst_credit_notes enable row level security;
create policy inst_credit_notes_access on public.inst_credit_notes for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Bons-cadeaux
-- ---------------------------------------------------------------------------
create table if not exists public.inst_gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.inst_sales(id) on delete set null,
  initial_balance_cents integer not null check (initial_balance_cents > 0),
  balance_cents integer not null check (balance_cents >= 0),
  recipient_name text,
  status text not null default 'active'
    check (status in ('active', 'depleted', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_inst_gift_cards_tenant on public.inst_gift_cards(tenant_id);
create trigger trg_inst_gift_cards_updated before update on public.inst_gift_cards
  for each row execute function public.set_updated_at();

alter table public.inst_gift_cards enable row level security;
create policy inst_gift_cards_access on public.inst_gift_cards for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Enrichissement ventes: praticien, session, solde
-- ---------------------------------------------------------------------------
alter table public.inst_sales
  add column if not exists staff_id uuid references public.inst_staff(id) on delete set null,
  add column if not exists cash_session_id uuid references public.inst_cash_sessions(id) on delete set null,
  add column if not exists parent_sale_id uuid references public.inst_sales(id) on delete set null,
  add column if not exists sale_kind text not null default 'sale'
    check (sale_kind in ('sale', 'balance', 'refund'));

create index if not exists idx_inst_sales_staff on public.inst_sales(tenant_id, staff_id)
  where staff_id is not null;
create index if not exists idx_inst_sales_session on public.inst_sales(cash_session_id)
  where cash_session_id is not null;
create index if not exists idx_inst_sales_parent on public.inst_sales(parent_sale_id)
  where parent_sale_id is not null;

-- Paiements: avoir + lien gift/credit
alter table public.inst_sale_payments
  add column if not exists credit_note_id uuid references public.inst_credit_notes(id) on delete set null,
  add column if not exists gift_card_id uuid references public.inst_gift_cards(id) on delete set null;

alter table public.inst_sale_payments drop constraint if exists inst_sale_payments_method_check;
alter table public.inst_sale_payments
  add constraint inst_sale_payments_method_check
  check (method in ('cash', 'card', 'stripe', 'transfer', 'gift_card', 'credit_note', 'other'));

alter table public.inst_sales drop constraint if exists inst_sales_payment_method_check;
alter table public.inst_sales
  add constraint inst_sales_payment_method_check
  check (payment_method in (
    'cash', 'card', 'stripe', 'transfer', 'gift_card', 'credit_note', 'mixed', 'other'
  ));
