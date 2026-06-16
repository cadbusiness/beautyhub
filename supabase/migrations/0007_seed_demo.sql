-- BeautyHub - Seed demo (Phase 1). Idempotent.
-- Tenant "demo" sous la brand plateforme, module institut active, abonnement Pro.

insert into public.tenants (id, brand_id, name, slug, branding)
values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000b1',
  'Institut Demo',
  'demo',
  '{"primaryColor":"#be185d","appName":"Institut Demo"}'::jsonb
)
on conflict (id) do nothing;

insert into public.tenant_modules (tenant_id, module_id, enabled)
values ('00000000-0000-0000-0000-0000000000d1', 'institut', true)
on conflict (tenant_id, module_id) do nothing;

insert into public.subscriptions (tenant_id, plan_id, status)
select '00000000-0000-0000-0000-0000000000d1', p.id, 'active'
from public.plans p
where p.brand_id is null and p.name = 'Pro'
limit 1
on conflict (tenant_id) do nothing;

-- Prestations exemples
insert into public.inst_services (tenant_id, name, description, duration_min, price_cents, color)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Soin du visage', 'Nettoyage et hydratation', 60, 6500, '#be185d'),
  ('00000000-0000-0000-0000-0000000000d1', 'Epilation jambes', 'Cire chaude', 30, 3500, '#7c3aed'),
  ('00000000-0000-0000-0000-0000000000d1', 'Manucure', 'Pose vernis incluse', 45, 4000, '#0891b2')
on conflict do nothing;

-- Personnel + cabine
insert into public.inst_staff (tenant_id, full_name, email, color)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Sophie Martin', 'sophie@demo.test', '#be185d'),
  ('00000000-0000-0000-0000-0000000000d1', 'Lea Dubois', 'lea@demo.test', '#7c3aed')
on conflict do nothing;

insert into public.inst_resources (tenant_id, name)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Cabine 1'),
  ('00000000-0000-0000-0000-0000000000d1', 'Cabine 2')
on conflict do nothing;

-- Horaires tenant-wide: lundi-vendredi 9h-18h
insert into public.inst_working_hours (tenant_id, staff_id, weekday, start_time, end_time)
select '00000000-0000-0000-0000-0000000000d1', null, d, time '09:00', time '18:00'
from generate_series(1, 5) as d
on conflict do nothing;
