-- BeautyHub - Bridge legacy gift cards / credit notes -> voucher core

alter table public.inst_sale_payments
  add column if not exists voucher_id uuid references public.inst_vouchers(id) on delete set null;

create index if not exists idx_inst_sale_payments_voucher
  on public.inst_sale_payments(voucher_id)
  where voucher_id is not null;

alter table public.inst_sale_payments drop constraint if exists inst_sale_payments_method_check;
alter table public.inst_sale_payments
  add constraint inst_sale_payments_method_check
  check (method in (
    'cash', 'card', 'stripe', 'transfer', 'voucher', 'gift_card', 'credit_note', 'other'
  ));

alter table public.inst_sales drop constraint if exists inst_sales_payment_method_check;
alter table public.inst_sales
  add constraint inst_sales_payment_method_check
  check (payment_method in (
    'cash', 'card', 'stripe', 'transfer', 'voucher', 'gift_card', 'credit_note', 'mixed', 'other'
  ));

-- Vue de coexistence pour migration progressive et contrôles comptables
create or replace view public.inst_legacy_vouchers as
select
  g.tenant_id,
  g.id as legacy_id,
  'inst_gift_cards'::text as legacy_type,
  upper(g.code) as code,
  g.initial_balance_cents as initial_amount_cents,
  g.balance_cents as current_balance_cents,
  g.status,
  g.created_at,
  g.updated_at
from public.inst_gift_cards g
union all
select
  c.tenant_id,
  c.id as legacy_id,
  'inst_credit_notes'::text as legacy_type,
  upper(c.credit_number) as code,
  c.amount_cents as initial_amount_cents,
  c.remaining_cents as current_balance_cents,
  c.status,
  c.created_at,
  c.updated_at
from public.inst_credit_notes c;

grant select on public.inst_legacy_vouchers to authenticated;
