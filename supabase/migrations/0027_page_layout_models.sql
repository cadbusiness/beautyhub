-- BeautyHub - Modèles de page par type (layout_id libre, plus elegant/modern global)

alter table public.inst_site_pages
  drop constraint if exists inst_site_pages_template_id_check;

-- Migrer les anciens template_id globaux vers des modèles par page
update public.inst_site_pages
set template_id = case page_type
  when 'home' then case when template_id = 'modern' then 'home-impact' else 'home-vitrine' end
  when 'catalog' then 'catalog-grille'
  when 'booking' then 'booking-guide'
  when 'contact' then 'contact-complet'
  else template_id
end
where template_id in ('elegant', 'modern')
   or template_id is null
   or template_id = '';

comment on column public.inst_site_pages.template_id is
  'Identifiant du modèle de page (ex. home-vitrine, catalog-grille).';

-- Le thème global ne porte plus le template de page
alter table public.inst_site_settings
  drop column if exists template_id;

drop function if exists public.get_public_site_settings(uuid);

create or replace function public.get_public_site_settings(p_tenant_id uuid)
returns table (
  primary_color text,
  display_name text,
  logo_url text,
  footer_text text
)
language sql stable security definer set search_path = public as $$
  select s.primary_color, s.display_name, s.logo_url, s.footer_text
  from public.inst_site_settings s
  where s.tenant_id = p_tenant_id
  limit 1;
$$;
