-- BeautyHub - Assistant IA plateforme + support client

create table if not exists public.platform_settings (
  id text primary key default 'default',
  ai_enabled boolean not null default true,
  ai_model text not null default 'gpt-4o-mini',
  openai_api_key_enc text,
  support_notify_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 'default')
);

create trigger trg_platform_settings_updated
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body text not null,
  category text not null check (category in ('help', 'bug', 'config', 'feature_request')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  ai_summary text,
  conversation_excerpt text,
  page_url text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_tenant on public.support_tickets(tenant_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status, created_at desc);
create index if not exists idx_support_tickets_user on public.support_tickets(user_id);

create trigger trg_support_tickets_updated
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;
alter table public.support_tickets enable row level security;

create policy platform_settings_admin on public.platform_settings
  for all
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());

create policy support_tickets_insert on public.support_tickets
  for insert
  with check (
    user_id = auth.uid()
    and public.auth_has_tenant_access(tenant_id)
  );

create policy support_tickets_select on public.support_tickets
  for select
  using (
    public.auth_is_platform_admin()
    or (user_id = auth.uid() and public.auth_has_tenant_access(tenant_id))
  );

create policy support_tickets_update_admin on public.support_tickets
  for update
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());
