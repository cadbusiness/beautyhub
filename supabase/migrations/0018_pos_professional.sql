-- BeautyHub - Caisse professionnelle: paramètres, TVA, multi-paiement, tickets

-- ---------------------------------------------------------------------------
-- Paramètres caisse par tenant
-- ---------------------------------------------------------------------------
create table if not exists public.inst_pos_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  country_code text not null default 'FR',
  currency text not null default 'eur',
  price_display text not null default 'ttc'
    check (price_display in ('ttc', 'ht')),
  default_vat_rate_bps integer not null default 2000
    check (default_vat_rate_bps >= 0 and default_vat_rate_bps <= 10000),
  service_vat_rate_bps integer not null default 2000
    check (service_vat_rate_bps >= 0 and service_vat_rate_bps <= 10000),
  product_vat_rate_bps integer not null default 2000
    check (product_vat_rate_bps >= 0 and product_vat_rate_bps <= 10000),
  payment_methods jsonb not null default '{
    "cash": true,
    "card": true,
    "transfer": false,
    "gift_card": false,
    "stripe": true
  }'::jsonb,
  ticket_header text,
  ticket_footer text,
  legal_name text,
  legal_address text,
  vat_number text,
  siret text,
  ticket_prefix text not null default 'TK',
  fiscal_regime text not null default 'standard'
    check (fiscal_regime in ('standard', 'nf525', 'be_vat', 'be_gks')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_inst_pos_settings_updated before update on public.inst_pos_settings
  for each row execute function public.set_updated_at();

alter table public.inst_pos_settings enable row level security;
create policy inst_pos_settings_access on public.inst_pos_settings for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Numérotation tickets
-- ---------------------------------------------------------------------------
create table if not exists public.inst_document_sequences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doc_type text not null,
  last_number integer not null default 0,
  primary key (tenant_id, doc_type)
);

alter table public.inst_document_sequences enable row level security;
create policy inst_document_sequences_access on public.inst_document_sequences for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create or replace function public.next_document_number(p_tenant_id uuid, p_doc_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  if not public.auth_has_tenant_access(p_tenant_id) then
    raise exception 'access denied';
  end if;
  insert into public.inst_document_sequences (tenant_id, doc_type, last_number)
  values (p_tenant_id, p_doc_type, 1)
  on conflict (tenant_id, doc_type)
  do update set last_number = inst_document_sequences.last_number + 1
  returning last_number into v_num;
  return v_num;
end;
$$;

revoke all on function public.next_document_number(uuid, text) from public;
grant execute on function public.next_document_number(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Enrichissement ventes
-- ---------------------------------------------------------------------------
alter table public.inst_sales
  add column if not exists subtotal_cents integer not null default 0,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists vat_cents integer not null default 0,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists ticket_number text;

alter table public.inst_sales drop constraint if exists inst_sales_status_check;
alter table public.inst_sales
  add constraint inst_sales_status_check
  check (status in ('draft', 'open', 'partial', 'paid', 'refunded', 'failed', 'cancelled'));

alter table public.inst_sales drop constraint if exists inst_sales_payment_method_check;
alter table public.inst_sales
  add constraint inst_sales_payment_method_check
  check (payment_method in ('cash', 'card', 'stripe', 'transfer', 'gift_card', 'mixed', 'other'));

update public.inst_sales
set
  subtotal_cents = total_cents,
  amount_paid_cents = case when status = 'paid' then total_cents else 0 end
where subtotal_cents = 0 and total_cents > 0;

create index if not exists idx_inst_sales_ticket on public.inst_sales(tenant_id, ticket_number)
  where ticket_number is not null;

-- ---------------------------------------------------------------------------
-- Lignes vente: TVA et remises
-- ---------------------------------------------------------------------------
alter table public.inst_sale_items
  add column if not exists vat_rate_bps integer not null default 2000,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists line_subtotal_cents integer not null default 0,
  add column if not exists line_vat_cents integer not null default 0,
  add column if not exists line_total_cents integer not null default 0;

update public.inst_sale_items
set
  line_total_cents = unit_price_cents * quantity,
  line_subtotal_cents = unit_price_cents * quantity
where line_total_cents = 0;

-- ---------------------------------------------------------------------------
-- Paiements multi-moyens
-- ---------------------------------------------------------------------------
create table if not exists public.inst_sale_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.inst_sales(id) on delete cascade,
  method text not null
    check (method in ('cash', 'card', 'stripe', 'transfer', 'gift_card', 'other')),
  amount_cents integer not null check (amount_cents > 0),
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inst_sale_payments_sale on public.inst_sale_payments(sale_id);
create index if not exists idx_inst_sale_payments_tenant on public.inst_sale_payments(tenant_id);

alter table public.inst_sale_payments enable row level security;
create policy inst_sale_payments_access on public.inst_sale_payments for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
