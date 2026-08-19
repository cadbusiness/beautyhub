-- Attribution prestataire pour les stats : praticien par ligne de vente,
-- caissier (compte qui encaisse), overrides par ligne sur les paniers.

alter table public.inst_sale_items
  add column if not exists staff_id uuid references public.inst_staff(id) on delete set null;

create index if not exists idx_inst_sale_items_tenant_staff
  on public.inst_sale_items (tenant_id, staff_id)
  where staff_id is not null;

alter table public.inst_sales
  add column if not exists cashier_user_id uuid;

create index if not exists idx_inst_sales_cashier
  on public.inst_sales (tenant_id, cashier_user_id)
  where cashier_user_id is not null;

alter table public.inst_pos_carts
  add column if not exists line_staff jsonb not null default '{}'::jsonb;

-- Historique : recopier le praticien du ticket sur chaque ligne.
update public.inst_sale_items i
set staff_id = s.staff_id
from public.inst_sales s
where i.sale_id = s.id
  and i.staff_id is null
  and s.staff_id is not null;
