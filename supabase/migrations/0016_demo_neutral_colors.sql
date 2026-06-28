-- Demo tenant: palette neutre (remplace mauve / rose vif)

update public.tenants
set branding = branding || '{"primaryColor":"#0f172a"}'::jsonb
where id = '00000000-0000-0000-0000-0000000000d1';

update public.inst_services
set color = case name
  when 'Soin du visage' then '#78716c'
  when 'Epilation jambes' then '#64748b'
  when 'Manucure' then '#57534e'
  else color
end
where tenant_id = '00000000-0000-0000-0000-0000000000d1'
  and color in ('#be185d', '#7c3aed', '#0891b2');

update public.inst_staff
set color = case full_name
  when 'Sophie Martin' then '#78716c'
  when 'Lea Dubois' then '#64748b'
  else color
end
where tenant_id = '00000000-0000-0000-0000-0000000000d1'
  and color in ('#be185d', '#7c3aed');
