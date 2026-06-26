-- BeautyHub - Module Academie (Phase 2)
-- Tables prefixees acad_* (convention modules), toujours scopees tenant_id + RLS.

create table if not exists public.acad_courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'eur',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_acad_courses_tenant on public.acad_courses(tenant_id);
create trigger trg_acad_courses_updated before update on public.acad_courses
  for each row execute function public.set_updated_at();

create table if not exists public.acad_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.acad_courses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  student_email text not null,
  student_name text not null,
  status text not null default 'enrolled'
    check (status in ('enrolled', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_acad_enrollments_tenant on public.acad_enrollments(tenant_id);
create index if not exists idx_acad_enrollments_course on public.acad_enrollments(course_id);

alter table public.acad_courses enable row level security;
alter table public.acad_enrollments enable row level security;

create policy acad_courses_access on public.acad_courses for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy acad_enrollments_access on public.acad_enrollments for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));
