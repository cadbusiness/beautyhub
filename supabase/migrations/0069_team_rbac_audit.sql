-- Rôles institut : Responsable + droits sensibles (sans écraser les custom)

-- Nouveau rôle système « Responsable »
insert into public.tenant_roles (tenant_id, name, slug, description, permissions, is_system)
select
  t.id,
  'Responsable',
  'responsable',
  'Agenda, clients et caisse — équipe en lecture',
  '{
    "dashboard":{"read":true},
    "appointments":{"read":true,"write":true},
    "clients":{"read":true,"write":true},
    "services":{"read":true},
    "team":{"read":true},
    "pos":{"read":true,"write":true}
  }'::jsonb,
  true
from public.tenants t
where not exists (
  select 1 from public.tenant_roles tr
  where tr.tenant_id = t.id and tr.slug = 'responsable'
);

-- Met à jour les presets système uniquement s'ils n'ont pas été personnalisés
update public.tenant_roles
set
  permissions = '{
    "dashboard":{"read":true},
    "appointments":{"read":true,"write":true},
    "clients":{"read":true,"write":true},
    "services":{"read":true,"write":true},
    "team":{"read":true,"write":true},
    "pos":{"read":true,"write":true},
    "marketing":{"read":true,"write":true},
    "audit.read":{"read":true,"write":true},
    "team.manage_access":{"read":true,"write":true}
  }'::jsonb,
  description = 'Gestion quotidienne, invitations et journal — sans modifier les rôles ni supprimer des clients',
  updated_at = now()
where slug = 'manager'
  and is_system = true
  and permissions = '{
    "dashboard":{"read":true},
    "appointments":{"read":true,"write":true},
    "clients":{"read":true,"write":true},
    "services":{"read":true,"write":true},
    "team":{"read":true},
    "pos":{"read":true,"write":true},
    "marketing":{"read":true}
  }'::jsonb;
