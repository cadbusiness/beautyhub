-- Pause de session caisse : une seule session active (ouverte ou en pause) par institut.

alter table public.inst_cash_sessions
  drop constraint if exists inst_cash_sessions_status_check;

alter table public.inst_cash_sessions
  add constraint inst_cash_sessions_status_check
  check (status in ('open', 'paused', 'closed'));

drop index if exists uniq_inst_cash_sessions_open;

create unique index uniq_inst_cash_sessions_open
  on public.inst_cash_sessions (tenant_id)
  where status in ('open', 'paused');
