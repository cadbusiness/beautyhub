-- BeautyHub - Gift card flags + template mapping on products

alter table public.inst_products
  add column if not exists is_gift_card boolean not null default false;

alter table public.inst_products
  add column if not exists gift_template_id uuid
    references public.inst_voucher_templates(id) on delete set null;

-- Map Woo variation_id (as text) -> template uuid
alter table public.inst_products
  add column if not exists gift_variation_templates jsonb not null default '{}'::jsonb;

create index if not exists idx_inst_products_gift_card
  on public.inst_products(tenant_id, is_gift_card)
  where is_gift_card = true;
