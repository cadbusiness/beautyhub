-- BeautyHub - Phase 1: reference Stripe PaymentIntent sur les ventes caisse.

alter table public.inst_sales
  add column if not exists stripe_payment_intent_id text;

create index if not exists idx_inst_sales_stripe_pi
  on public.inst_sales(tenant_id, stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
