-- BeautyHub - Gift card PDF templates + storage

create table if not exists public.inst_voucher_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  background_path text,
  title text not null default 'Carte cadeau',
  subtitle text not null default '',
  footer_text text not null default '',
  layout jsonb not null default '{
    "code": {"x": 50, "y": 62},
    "amount": {"x": 50, "y": 42},
    "recipient": {"x": 50, "y": 28},
    "message": {"x": 50, "y": 78}
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inst_voucher_templates_tenant
  on public.inst_voucher_templates(tenant_id, is_active, created_at desc);

create unique index if not exists uniq_inst_voucher_templates_default
  on public.inst_voucher_templates(tenant_id)
  where is_default = true;

create trigger trg_inst_voucher_templates_updated before update on public.inst_voucher_templates
  for each row execute function public.set_updated_at();

alter table public.inst_voucher_templates enable row level security;

drop policy if exists inst_voucher_templates_access on public.inst_voucher_templates;
create policy inst_voucher_templates_access on public.inst_voucher_templates for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Background images (public read for PDF rendering / previews)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voucher-assets',
  'voucher-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Generated PDFs (private; signed URLs for download)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voucher-pdfs',
  'voucher-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists voucher_assets_public_read on storage.objects;
create policy voucher_assets_public_read
  on storage.objects for select
  using (bucket_id = 'voucher-assets');

drop policy if exists voucher_assets_tenant_insert on storage.objects;
create policy voucher_assets_tenant_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voucher-assets'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_assets_tenant_update on storage.objects;
create policy voucher_assets_tenant_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'voucher-assets'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'voucher-assets'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_assets_tenant_delete on storage.objects;
create policy voucher_assets_tenant_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voucher-assets'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_pdfs_tenant_select on storage.objects;
create policy voucher_pdfs_tenant_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voucher-pdfs'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_pdfs_tenant_insert on storage.objects;
create policy voucher_pdfs_tenant_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voucher-pdfs'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_pdfs_tenant_update on storage.objects;
create policy voucher_pdfs_tenant_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'voucher-pdfs'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'voucher-pdfs'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists voucher_pdfs_tenant_delete on storage.objects;
create policy voucher_pdfs_tenant_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voucher-pdfs'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );
