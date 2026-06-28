-- Rôles personnalisables et invitations équipe

create table if not exists public.tenant_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_tenant_roles_tenant on public.tenant_roles(tenant_id);

create trigger trg_tenant_roles_updated
  before update on public.tenant_roles
  for each row execute function public.set_updated_at();

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.inst_staff(id) on delete set null,
  email text not null,
  membership_role text not null default 'staff'
    check (membership_role in ('tenant_owner', 'staff', 'coach')),
  tenant_role_id uuid references public.tenant_roles(id) on delete set null,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_invitations_tenant on public.team_invitations(tenant_id);
create unique index if not exists idx_team_invitations_pending_email
  on public.team_invitations (tenant_id, lower(email))
  where status = 'pending';

create trigger trg_team_invitations_updated
  before update on public.team_invitations
  for each row execute function public.set_updated_at();

alter table public.memberships
  add column if not exists tenant_role_id uuid references public.tenant_roles(id) on delete set null;

alter table public.tenant_roles enable row level security;
alter table public.team_invitations enable row level security;

create policy tenant_roles_access on public.tenant_roles for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy team_invitations_access on public.team_invitations for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Rôles système par défaut pour chaque institut
insert into public.tenant_roles (tenant_id, name, slug, description, permissions, is_system)
select
  t.id,
  seed.name,
  seed.slug,
  seed.description,
  seed.permissions::jsonb,
  true
from public.tenants t
cross join (
  values
    (
      'Propriétaire',
      'owner',
      'Accès complet à l''espace institut',
      '{"*":{"read":true,"write":true}}'
    ),
    (
      'Manager',
      'manager',
      'Gestion quotidienne sans paramètres sensibles',
      '{"dashboard":{"read":true},"appointments":{"read":true,"write":true},"clients":{"read":true,"write":true},"services":{"read":true,"write":true},"team":{"read":true},"pos":{"read":true,"write":true},"marketing":{"read":true}}'
    ),
    (
      'Praticienne',
      'practitioner',
      'Agenda et consultation fiches clients',
      '{"dashboard":{"read":true},"appointments":{"read":true,"write":true},"clients":{"read":true},"services":{"read":true}}'
    ),
    (
      'Réception',
      'reception',
      'Accueil, RDV et caisse',
      '{"dashboard":{"read":true},"appointments":{"read":true,"write":true},"clients":{"read":true,"write":true},"pos":{"read":true,"write":true}}'
    )
) as seed(name, slug, description, permissions)
where not exists (
  select 1 from public.tenant_roles tr
  where tr.tenant_id = t.id and tr.slug = seed.slug
);
