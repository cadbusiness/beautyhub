-- Extend preferred_locale to English and Spanish
alter table public.team_profiles
  drop constraint if exists team_profiles_preferred_locale_check;

alter table public.team_profiles
  add constraint team_profiles_preferred_locale_check
  check (preferred_locale is null or preferred_locale in ('fr', 'nl', 'en', 'es'));
