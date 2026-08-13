-- Ajout du timestamp d'archivage sur inst_staff + index (tenant_id, is_active)
-- La colonne is_active existe deja (0006). archived_at rend l'operation auditable.

alter table public.inst_staff
  add column if not exists archived_at timestamptz;

create index if not exists idx_inst_staff_tenant_active
  on public.inst_staff(tenant_id, is_active);
