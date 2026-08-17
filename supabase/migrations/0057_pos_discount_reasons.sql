-- Motifs de remise réutilisables à la caisse (par institut)

alter table public.inst_pos_settings
  add column if not exists discount_reasons text[] not null default array[
    'Geste commercial',
    'Promotion',
    'Fidélité',
    'Erreur de prix',
    'Personnel'
  ];
