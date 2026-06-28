-- BeautyHub - Grilles horaires nommees, plages multiples, assignations staff/cabine, absences

create table if not exists public.inst_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inst_schedules_tenant on public.inst_schedules(tenant_id);
create unique index if not exists idx_inst_schedules_default
  on public.inst_schedules(tenant_id) where is_default;
create trigger trg_inst_schedules_updated before update on public.inst_schedules
  for each row execute function public.set_updated_at();

create table if not exists public.inst_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.inst_schedules(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);
create index if not exists idx_inst_schedule_blocks_schedule
  on public.inst_schedule_blocks(schedule_id, weekday);

alter table public.inst_staff
  add column if not exists schedule_id uuid references public.inst_schedules(id) on delete set null;

alter table public.inst_resources
  add column if not exists schedule_id uuid references public.inst_schedules(id) on delete set null;

alter table public.inst_time_off
  add column if not exists resource_id uuid references public.inst_resources(id) on delete cascade;

create index if not exists idx_inst_time_off_resource
  on public.inst_time_off(resource_id, starts_at) where resource_id is not null;

alter table public.inst_schedules enable row level security;
alter table public.inst_schedule_blocks enable row level security;

create policy inst_schedules_access on public.inst_schedules for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_schedule_blocks_access on public.inst_schedule_blocks for all
  using (
    exists (
      select 1 from public.inst_schedules s
      where s.id = schedule_id and public.auth_has_tenant_access(s.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.inst_schedules s
      where s.id = schedule_id and public.auth_has_tenant_access(s.tenant_id)
    )
  );

-- Migration depuis inst_working_hours
insert into public.inst_schedules (tenant_id, name, is_default)
select distinct wh.tenant_id, 'Horaires institut', true
from public.inst_working_hours wh
where wh.staff_id is null
  and not exists (
    select 1 from public.inst_schedules s
    where s.tenant_id = wh.tenant_id and s.is_default
  );

insert into public.inst_schedule_blocks (schedule_id, weekday, start_time, end_time)
select s.id, wh.weekday, wh.start_time, wh.end_time
from public.inst_working_hours wh
join public.inst_schedules s on s.tenant_id = wh.tenant_id and s.is_default
where wh.staff_id is null
  and not exists (
    select 1 from public.inst_schedule_blocks b
    where b.schedule_id = s.id and b.weekday = wh.weekday and b.start_time = wh.start_time
  );

-- Horaires specifiques staff -> grille dediee
do $$
declare
  r record;
  v_schedule_id uuid;
begin
  for r in
    select distinct wh.tenant_id, wh.staff_id, st.full_name
    from public.inst_working_hours wh
    join public.inst_staff st on st.id = wh.staff_id
    where wh.staff_id is not null
      and st.schedule_id is null
  loop
    insert into public.inst_schedules (tenant_id, name, is_default)
    values (r.tenant_id, 'Horaires ' || r.full_name, false)
    returning id into v_schedule_id;

    insert into public.inst_schedule_blocks (schedule_id, weekday, start_time, end_time)
    select v_schedule_id, wh.weekday, wh.start_time, wh.end_time
    from public.inst_working_hours wh
    where wh.staff_id = r.staff_id;

    update public.inst_staff set schedule_id = v_schedule_id where id = r.staff_id;
  end loop;
end $$;

-- Creneaux d'un praticien pour une date (grille assignee ou defaut institut)
create or replace function public.get_staff_schedule_blocks(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_weekday smallint
)
returns table (start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  with assigned as (
    select st.schedule_id as sid
    from public.inst_staff st
    where st.id = p_staff_id and st.tenant_id = p_tenant_id
  ),
  resolved as (
    select coalesce(
      (select sid from assigned where sid is not null),
      (select s.id from public.inst_schedules s where s.tenant_id = p_tenant_id and s.is_default limit 1)
    ) as schedule_id
  )
  select b.start_time, b.end_time
  from public.inst_schedule_blocks b
  join resolved r on r.schedule_id = b.schedule_id
  where b.weekday = p_weekday
  order by b.start_time;
$$;

-- Creneaux disponibles (grilles horaires + absences)
create or replace function public.get_public_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_date date,
  p_staff_id uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz, staff_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_duration integer;
  v_buffer_before integer;
  v_buffer_after integer;
  v_min_advance integer;
  v_max_advance integer;
  v_weekday smallint;
  v_now timestamptz := now();
begin
  select s.duration_min, s.buffer_before_min, s.buffer_after_min,
         s.min_advance_hours, s.max_advance_days
  into v_duration, v_buffer_before, v_buffer_after, v_min_advance, v_max_advance
  from public.inst_services s
  where s.id = p_service_id and s.tenant_id = p_tenant_id and s.is_active;

  if v_duration is null then return; end if;

  if p_date < (v_now + (v_min_advance || ' hours')::interval)::date
     or p_date > (v_now + (v_max_advance || ' days')::interval)::date then
    return;
  end if;

  v_weekday := extract(dow from p_date)::smallint;

  return query
  with staff_list as (
    select st.id as sid
    from public.inst_staff st
    where st.tenant_id = p_tenant_id and st.is_active
      and (p_staff_id is null or st.id = p_staff_id)
      and (
        p_staff_id is not null
        or not exists (select 1 from public.inst_staff_services ss where ss.service_id = p_service_id)
        or exists (select 1 from public.inst_staff_services ss where ss.staff_id = st.id and ss.service_id = p_service_id)
      )
  ),
  windows as (
    select sl.sid,
           (p_date + b.start_time) at time zone 'UTC' as w_start,
           (p_date + b.end_time) at time zone 'UTC' as w_end
    from staff_list sl
    cross join lateral public.get_staff_schedule_blocks(p_tenant_id, sl.sid, v_weekday) b
  ),
  slots as (
    select w.sid,
           gs as slot_start,
           gs + (v_duration || ' minutes')::interval as slot_end
    from windows w,
    lateral generate_series(
      w.w_start,
      w.w_end - (v_duration || ' minutes')::interval,
      '15 minutes'::interval
    ) gs
    where gs >= v_now + (v_min_advance || ' hours')::interval
  )
  select s.slot_start, s.slot_end, s.sid
  from slots s
  where not exists (
    select 1 from public.inst_appointments a
    where a.tenant_id = p_tenant_id
      and a.status not in ('cancelled')
      and a.staff_id = s.sid
      and tstzrange(a.starts_at, a.ends_at, '[)')
          && tstzrange(
            s.slot_start - (v_buffer_before || ' minutes')::interval,
            s.slot_end + (v_buffer_after || ' minutes')::interval,
            '[)'
          )
  )
  and not exists (
    select 1 from public.inst_time_off t
    where t.tenant_id = p_tenant_id
      and (t.staff_id is null or t.staff_id = s.sid)
      and t.resource_id is null
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(s.slot_start, s.slot_end, '[)')
  )
  order by s.slot_start, s.sid;
end;
$$;

grant execute on function public.get_staff_schedule_blocks(uuid, uuid, smallint) to anon, authenticated;
