-- Fidélité : bonus anniversaire, visibilité portail, récompenses upsell (nouvelle prestation)

alter table public.inst_loyalty_programs
  add column if not exists birthday_bonus_points integer not null default 0
    check (birthday_bonus_points >= 0),
  add column if not exists portal_visible boolean not null default true;

comment on column public.inst_loyalty_programs.birthday_bonus_points is
  'Points offerts automatiquement le jour d''anniversaire (automatisation planifiée).';
comment on column public.inst_loyalty_programs.portal_visible is
  'Afficher le solde et les récompenses sur le portail cliente (/client/compte).';

alter table public.inst_loyalty_rewards
  add column if not exists new_service_only boolean not null default false;

comment on column public.inst_loyalty_rewards.new_service_only is
  'Récompense réservée aux prestations jamais réservées par la cliente (upsell).';
