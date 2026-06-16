-- BeautyHub - Seed (Phase 0)
-- Idempotent: rejouable sans casser (utilise par l'installateur self-hosted).

-- Brand plateforme par defaut (les tenants directs du super admin y sont rattaches)
insert into public.brands (id, name, slug, is_platform, branding)
values ('00000000-0000-0000-0000-0000000000b1', 'BeautyHub', 'platform', true,
        '{"primaryColor":"#0f172a","appName":"BeautyHub"}'::jsonb)
on conflict (slug) do nothing;

-- Catalogue de modules
insert into public.modules (id, name, description, category) values
  ('institut', 'Institut', 'Prise de rendez-vous, prestations, caisse et fiches clients.', 'core'),
  ('academie', 'Academie', 'Formations en ligne, coachs, eleves et inscriptions.', 'core')
on conflict (id) do nothing;

-- Formules d'abonnement globales (modules inclus + quotas)
insert into public.plans (brand_id, name, price_cents, currency, interval, modules, limits, is_active) values
  (null, 'Starter', 2900, 'eur', 'month', array['institut'],
   '{"staff":3,"clients":1000,"appointments_per_month":300,"students":0}'::jsonb, true),
  (null, 'Pro', 5900, 'eur', 'month', array['institut'],
   '{"staff":10,"clients":null,"appointments_per_month":null,"students":0}'::jsonb, true),
  (null, 'Academie', 7900, 'eur', 'month', array['institut','academie'],
   '{"staff":10,"clients":null,"appointments_per_month":null,"students":500}'::jsonb, true)
on conflict do nothing;
