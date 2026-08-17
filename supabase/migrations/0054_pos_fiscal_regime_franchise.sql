-- Allow VAT franchise regime on POS settings (0% VAT + exemption mention).
alter table public.inst_pos_settings
  drop constraint if exists inst_pos_settings_fiscal_regime_check;

alter table public.inst_pos_settings
  add constraint inst_pos_settings_fiscal_regime_check
  check (fiscal_regime in ('standard', 'nf525', 'be_vat', 'be_gks', 'franchise'));
