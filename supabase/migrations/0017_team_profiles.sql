-- Profils equipe (nom, telephone, langue preferee) — un enregistrement par utilisateur Auth.

create table if not exists public.team_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  preferred_locale text check (preferred_locale in ('fr', 'nl')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_team_profiles_updated
  before update on public.team_profiles
  for each row execute function public.set_updated_at();

alter table public.team_profiles enable row level security;

create policy team_profiles_select on public.team_profiles
  for select using (user_id = auth.uid());

create policy team_profiles_insert on public.team_profiles
  for insert with check (user_id = auth.uid());

create policy team_profiles_update on public.team_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
