-- BeautyHub - Reservation publique (RPC security definer, anon-safe)

-- Prestations actives d'un tenant (sans auth)
create or replace function public.get_public_services(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  color text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.duration_min, s.price_cents, s.color
  from public.inst_services s
  where s.tenant_id = p_tenant_id and s.is_active = true
  order by s.name;
$$;

-- Praticiens actifs pour une prestation
create or replace function public.get_public_staff_for_service(
  p_tenant_id uuid,
  p_service_id uuid
)
returns table (id uuid, full_name text, color text)
language sql stable security definer set search_path = public as $$
  select st.id, st.full_name, st.color
  from public.inst_staff st
  where st.tenant_id = p_tenant_id
    and st.is_active = true
    and (
      not exists (
        select 1 from public.inst_staff_services ss
        where ss.service_id = p_service_id and ss.tenant_id = p_tenant_id
      )
      or exists (
        select 1 from public.inst_staff_services ss
        where ss.staff_id = st.id and ss.service_id = p_service_id
      )
    )
  order by st.full_name;
$$;

-- Creneaux disponibles (fenetres de travail - RDV - conges)
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
           (p_date + wh.start_time) at time zone 'UTC' as w_start,
           (p_date + wh.end_time) at time zone 'UTC' as w_end
    from staff_list sl
    join public.inst_working_hours wh
      on wh.tenant_id = p_tenant_id and wh.weekday = v_weekday
     and (wh.staff_id = sl.sid or (wh.staff_id is null and not exists (
           select 1 from public.inst_working_hours wh2
           where wh2.tenant_id = p_tenant_id and wh2.staff_id = sl.sid and wh2.weekday = v_weekday
         )))
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
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(s.slot_start, s.slot_end, '[)')
  )
  order by s.slot_start, s.sid;
end;
$$;

-- Reservation publique: upsert client + creer RDV
create or replace function public.book_public_appointment(
  p_tenant_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_email text,
  p_full_name text,
  p_phone text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_client_id uuid;
  v_duration integer;
  v_price integer;
  v_ends_at timestamptz;
  v_appt_id uuid;
  v_email text := lower(trim(p_email));
begin
  if v_email = '' or trim(p_full_name) = '' then
    raise exception 'Email et nom requis';
  end if;

  select duration_min, price_cents into v_duration, v_price
  from public.inst_services
  where id = p_service_id and tenant_id = p_tenant_id and is_active;
  if v_duration is null then raise exception 'Prestation introuvable'; end if;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;

  if not exists (
    select 1 from public.get_public_available_slots(p_tenant_id, p_service_id, p_starts_at::date, p_staff_id) g
    where g.starts_at = p_starts_at and g.staff_id = p_staff_id
  ) then
    raise exception 'Creneau indisponible';
  end if;

  insert into public.clients (tenant_id, email, full_name, phone)
  values (p_tenant_id, v_email, trim(p_full_name), nullif(trim(p_phone), ''))
  on conflict (tenant_id, email) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, public.clients.phone)
  returning id into v_client_id;

  insert into public.inst_appointments (
    tenant_id, client_id, service_id, staff_id, starts_at, ends_at, price_cents, status
  ) values (
    p_tenant_id, v_client_id, p_service_id, p_staff_id, p_starts_at, v_ends_at, v_price, 'booked'
  )
  returning id into v_appt_id;

  return v_appt_id;
end;
$$;

grant execute on function public.get_public_services(uuid) to anon, authenticated;
grant execute on function public.get_public_staff_for_service(uuid, uuid) to anon, authenticated;
grant execute on function public.get_public_available_slots(uuid, uuid, date, uuid) to anon, authenticated;
grant execute on function public.book_public_appointment(uuid, uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
