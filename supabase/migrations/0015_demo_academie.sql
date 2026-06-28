-- BeautyHub - Demo academie + reference data for test accounts (idempotent).

insert into public.tenant_modules (tenant_id, module_id, enabled)
values ('00000000-0000-0000-0000-0000000000d1', 'academie', true)
on conflict (tenant_id, module_id) do update set enabled = true;

-- Formations demo
insert into public.acad_courses (id, tenant_id, title, description, price_cents, is_published)
values
  (
    '00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-0000-0000-0000000000d1',
    'Initiation esthetique',
    'Bases du soin du visage et hygiene professionnelle.',
    49000,
    true
  ),
  (
    '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000d1',
    'Maquillage professionnel',
    'Techniques jour / soiree pour instituts.',
    79000,
    false
  )
on conflict (id) do nothing;

-- Client demo pour inscription academie
insert into public.clients (id, tenant_id, email, full_name, phone)
values (
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000d1',
  'eleve@demo.test',
  'Marie Dupont',
  '+33601020304'
)
on conflict (tenant_id, email) do nothing;

insert into public.acad_enrollments (tenant_id, course_id, client_id, student_email, student_name, status)
select
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c3',
  'eleve@demo.test',
  'Marie Dupont',
  'enrolled'
where not exists (
  select 1 from public.acad_enrollments
  where tenant_id = '00000000-0000-0000-0000-0000000000d1'
    and course_id = '00000000-0000-0000-0000-0000000000c1'
    and student_email = 'eleve@demo.test'
);
