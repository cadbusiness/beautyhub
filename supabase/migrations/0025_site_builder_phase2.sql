-- BeautyHub - Site builder phase 2: galerie, horaires publics, images prestations, page booking

-- Images prestations dans le catalogue public
drop function if exists public.get_public_services(uuid);

create or replace function public.get_public_services(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  color text,
  extras_step_position text,
  image_url text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.duration_min, s.price_cents, s.color,
         s.extras_step_position, s.image_url
  from public.inst_services s
  where s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.visibility = 'catalog'
  order by s.name;
$$;

grant execute on function public.get_public_services(uuid) to anon, authenticated;

-- Horaires d'ouverture (grille par defaut de l'institut)
create or replace function public.get_public_opening_hours(p_tenant_id uuid)
returns table (
  weekday integer,
  start_time time,
  end_time time
)
language sql stable security definer set search_path = public as $$
  select b.weekday, b.start_time::time, b.end_time::time
  from public.inst_schedules sch
  join public.inst_schedule_blocks b on b.schedule_id = sch.id
  where sch.tenant_id = p_tenant_id
    and sch.is_default = true
  order by b.weekday, b.start_time;
$$;

grant execute on function public.get_public_opening_hours(uuid) to anon, authenticated;

-- Page publiee par type (ex. booking pour intro reservation)
create or replace function public.get_public_site_page_by_type(
  p_tenant_id uuid,
  p_page_type text
)
returns table (
  id uuid,
  page_type text,
  slug text,
  template_id text,
  title text,
  content jsonb,
  seo_title text,
  seo_description text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.page_type, p.slug, p.template_id, p.title, p.content, p.seo_title, p.seo_description
  from public.inst_site_pages p
  where p.tenant_id = p_tenant_id
    and p.page_type = p_page_type
    and p.is_published = true
  limit 1;
$$;

grant execute on function public.get_public_site_page_by_type(uuid, text) to anon, authenticated;

-- Storage images galerie site web
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "site_images_public_read"
  on storage.objects for select
  using (bucket_id = 'site-images');

create policy "site_images_tenant_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] is not null
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "site_images_tenant_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'site-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'site-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

create policy "site_images_tenant_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-images'
    and public.auth_has_tenant_access((storage.foldername(name))[1]::uuid)
  );
