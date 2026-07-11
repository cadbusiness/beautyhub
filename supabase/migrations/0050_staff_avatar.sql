-- BeautyHub — Avatar personnel + bucket storage

alter table public.inst_staff
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-images',
  'staff-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "staff_images_public_read"
  on storage.objects for select
  using (bucket_id = 'staff-images');

create policy "staff_images_tenant_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'staff-images'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "staff_images_tenant_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'staff-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'staff-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "staff_images_tenant_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'staff-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );
