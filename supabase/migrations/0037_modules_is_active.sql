-- BeautyHub - modules catalogue: flag actif/inactif

alter table public.modules
  add column if not exists is_active boolean not null default true;

create index if not exists idx_modules_is_active on public.modules(is_active);
