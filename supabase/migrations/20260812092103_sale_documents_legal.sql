-- BeautyHub - Documents de vente légaux (TIC, FAC, BLC, avoir)

alter table public.inst_sales
  add column if not exists sale_group_number integer;

alter table public.inst_pos_settings
  add column if not exists invoice_prefix text not null default 'FAC',
  add column if not exists delivery_note_prefix text not null default 'BLC',
  add column if not exists legal_email text,
  add column if not exists legal_mentions text,
  add column if not exists payment_terms_days integer not null default 0
    check (payment_terms_days >= 0),
  add column if not exists late_payment_penalty_text text,
  add column if not exists fixed_recovery_fee_cents integer not null default 4000
    check (fixed_recovery_fee_cents >= 0);

create table if not exists public.inst_sale_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid references public.inst_sales(id) on delete cascade,
  credit_note_id uuid references public.inst_credit_notes(id) on delete set null,
  doc_type text not null
    check (doc_type in ('ticket', 'invoice', 'delivery_note', 'credit_note')),
  doc_number text not null,
  sale_group_number integer,
  status text not null default 'issued'
    check (status in ('issued', 'partial', 'paid', 'settled', 'delivered', 'cancelled')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, doc_number)
);

create unique index if not exists uniq_inst_sale_docs_sale_type
  on public.inst_sale_documents(tenant_id, sale_id, doc_type)
  where sale_id is not null and credit_note_id is null;

create unique index if not exists uniq_inst_sale_docs_credit_note
  on public.inst_sale_documents(tenant_id, credit_note_id)
  where credit_note_id is not null;

create index if not exists idx_inst_sale_docs_tenant_issued
  on public.inst_sale_documents(tenant_id, issued_at desc);

create index if not exists idx_inst_sale_docs_sale
  on public.inst_sale_documents(sale_id);

create trigger trg_inst_sale_documents_updated
  before update on public.inst_sale_documents
  for each row execute function public.set_updated_at();

alter table public.inst_sale_documents enable row level security;

create policy inst_sale_documents_access on public.inst_sale_documents for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
