-- BeautyHub - Storage images prestations (extras / catalogue)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique (reservation client)
create policy "service_images_public_read"
  on storage.objects for select
  using (bucket_id = 'service-images');

-- Upload / mise a jour / suppression par l'equipe du tenant (1er segment = tenant_id)
create policy "service_images_tenant_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'service-images'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "service_images_tenant_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'service-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'service-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "service_images_tenant_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'service-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );
