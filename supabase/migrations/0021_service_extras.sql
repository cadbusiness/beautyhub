-- BeautyHub - Service extras (prestations liees comme upsell Bookly)

alter table public.inst_services
  add column if not exists visibility text not null default 'catalog'
    check (visibility in ('catalog', 'extra_only')),
  add column if not exists image_url text,
  add column if not exists extras_step_position text not null default 'after_time'
    check (extras_step_position in ('before_time', 'after_time'));

comment on column public.inst_services.visibility is
  'catalog = visible au catalogue client ; extra_only = masquee, proposable uniquement comme extra';
comment on column public.inst_services.extras_step_position is
  'before_time = etape extras avant choix creneau ; after_time = apres creneau';

-- Quels services peuvent etre proposes comme extras d''une prestation
create table if not exists public.inst_service_extras (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.inst_services(id) on delete cascade,
  extra_service_id uuid not null references public.inst_services(id) on delete cascade,
  min_qty integer not null default 0 check (min_qty >= 0),
  max_qty integer not null default 1 check (max_qty >= 1),
  sort_order integer not null default 0,
  primary key (service_id, extra_service_id),
  check (service_id <> extra_service_id),
  check (min_qty <= max_qty)
);
create index if not exists idx_inst_service_extras_tenant on public.inst_service_extras(tenant_id);
create index if not exists idx_inst_service_extras_service on public.inst_service_extras(service_id);

-- Extras selectionnes sur un rendez-vous (snapshot prix/duree/nom)
create table if not exists public.inst_appointment_extras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.inst_appointments(id) on delete cascade,
  service_id uuid not null references public.inst_services(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  price_cents integer not null,
  duration_min integer not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inst_appt_extras_appt on public.inst_appointment_extras(appointment_id);

alter table public.inst_service_extras enable row level security;
alter table public.inst_appointment_extras enable row level security;

create policy inst_service_extras_access on public.inst_service_extras for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_appointment_extras_access on public.inst_appointment_extras for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- Calcule duree totale (prestation + extras valides)
create or replace function public.inst_booking_duration_min(
  p_service_id uuid,
  p_extras jsonb default '[]'::jsonb
)
returns integer
language plpgsql stable set search_path = public as $$
declare
  v_base integer;
  v_row record;
  v_total integer := 0;
begin
  select duration_min into v_base
  from public.inst_services
  where id = p_service_id and is_active;
  if v_base is null then return null; end if;
  v_total := v_base;

  if p_extras is null or jsonb_typeof(p_extras) <> 'array' or jsonb_array_length(p_extras) = 0 then
    return v_total;
  end if;

  for v_row in
    select e.extra_service_id, e.min_qty, e.max_qty, s.duration_min,
           coalesce((elem->>'quantity')::integer, 0) as qty
    from jsonb_array_elements(p_extras) elem
    join public.inst_service_extras e
      on e.service_id = p_service_id
     and e.extra_service_id = (elem->>'service_id')::uuid
    join public.inst_services s
      on s.id = e.extra_service_id and s.is_active
  loop
    if v_row.qty < v_row.min_qty or v_row.qty > v_row.max_qty then
      raise exception 'Quantite extra invalide';
    end if;
    v_total := v_total + v_row.duration_min * v_row.qty;
  end loop;

  -- Extras obligatoires (min_qty > 0) non fournis
  if exists (
    select 1 from public.inst_service_extras e
    join public.inst_services s on s.id = e.extra_service_id and s.is_active
    where e.service_id = p_service_id and e.min_qty > 0
      and not exists (
        select 1 from jsonb_array_elements(p_extras) elem
        where (elem->>'service_id')::uuid = e.extra_service_id
          and coalesce((elem->>'quantity')::integer, 0) >= e.min_qty
      )
  ) then
    raise exception 'Extras obligatoires manquants';
  end if;

  return v_total;
end;
$$;

-- Calcule prix total (prestation + extras valides)
create or replace function public.inst_booking_price_cents(
  p_service_id uuid,
  p_extras jsonb default '[]'::jsonb
)
returns integer
language plpgsql stable set search_path = public as $$
declare
  v_base integer;
  v_row record;
  v_total integer := 0;
begin
  select price_cents into v_base
  from public.inst_services
  where id = p_service_id and is_active;
  if v_base is null then return null; end if;
  v_total := v_base;

  if p_extras is null or jsonb_typeof(p_extras) <> 'array' or jsonb_array_length(p_extras) = 0 then
    return v_total;
  end if;

  for v_row in
    select e.extra_service_id, e.min_qty, e.max_qty, s.price_cents,
           coalesce((elem->>'quantity')::integer, 0) as qty
    from jsonb_array_elements(p_extras) elem
    join public.inst_service_extras e
      on e.service_id = p_service_id
     and e.extra_service_id = (elem->>'service_id')::uuid
    join public.inst_services s
      on s.id = e.extra_service_id and s.is_active
  loop
    if v_row.qty < v_row.min_qty or v_row.qty > v_row.max_qty then
      raise exception 'Quantite extra invalide';
    end if;
    v_total := v_total + v_row.price_cents * v_row.qty;
  end loop;

  return v_total;
end;
$$;

-- Catalogue public : prestations visibles uniquement
drop function if exists public.get_public_services(uuid);

create or replace function public.get_public_services(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  color text,
  extras_step_position text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.duration_min, s.price_cents, s.color,
         s.extras_step_position
  from public.inst_services s
  where s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.visibility = 'catalog'
  order by s.name;
$$;

-- Extras disponibles pour une prestation (reservation publique)
create or replace function public.get_public_service_extras(
  p_tenant_id uuid,
  p_service_id uuid
)
returns table (
  extra_service_id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  image_url text,
  min_qty integer,
  max_qty integer,
  sort_order integer
)
language sql stable security definer set search_path = public as $$
  select e.extra_service_id, s.name, s.description, s.duration_min, s.price_cents,
         s.image_url, e.min_qty, e.max_qty, e.sort_order
  from public.inst_service_extras e
  join public.inst_services s on s.id = e.extra_service_id
  where e.tenant_id = p_tenant_id
    and e.service_id = p_service_id
    and s.is_active = true
  order by e.sort_order, s.name;
$$;

-- Creneaux avec duree totale (prestation + extras)
drop function if exists public.get_public_available_slots(uuid, uuid, date, uuid);

create or replace function public.get_public_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_date date,
  p_staff_id uuid default null,
  p_extras jsonb default '[]'::jsonb
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
  v_duration := public.inst_booking_duration_min(p_service_id, p_extras);
  if v_duration is null then return; end if;

  select s.buffer_before_min, s.buffer_after_min,
         s.min_advance_hours, s.max_advance_days
  into v_buffer_before, v_buffer_after, v_min_advance, v_max_advance
  from public.inst_services s
  where s.id = p_service_id and s.tenant_id = p_tenant_id and s.is_active;

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
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(s.slot_start, s.slot_end, '[)')
  )
  order by s.slot_start, s.sid;
end;
$$;

-- Reservation publique avec extras
drop function if exists public.book_public_appointment(uuid, uuid, uuid, timestamptz, text, text, text);

create or replace function public.book_public_appointment(
  p_tenant_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_email text,
  p_full_name text,
  p_phone text default null,
  p_extras jsonb default '[]'::jsonb
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
  v_extra record;
  v_qty integer;
begin
  if v_email = '' or trim(p_full_name) = '' then
    raise exception 'Email et nom requis';
  end if;

  v_duration := public.inst_booking_duration_min(p_service_id, p_extras);
  v_price := public.inst_booking_price_cents(p_service_id, p_extras);
  if v_duration is null or v_price is null then
    raise exception 'Prestation introuvable';
  end if;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;

  if not exists (
    select 1 from public.get_public_available_slots(
      p_tenant_id, p_service_id, p_starts_at::date, p_staff_id, p_extras
    ) g
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

  if p_extras is not null and jsonb_typeof(p_extras) = 'array' then
    for v_extra in
      select e.extra_service_id, e.min_qty, e.max_qty, s.price_cents, s.duration_min, s.name,
             (elem->>'quantity')::integer as qty
      from jsonb_array_elements(p_extras) elem
      join public.inst_service_extras e
        on e.service_id = p_service_id and e.tenant_id = p_tenant_id
       and e.extra_service_id = (elem->>'service_id')::uuid
      join public.inst_services s on s.id = e.extra_service_id
    loop
      v_qty := coalesce(v_extra.qty, 0);
      if v_qty >= v_extra.min_qty and v_qty <= v_extra.max_qty and v_qty > 0 then
        insert into public.inst_appointment_extras (
          tenant_id, appointment_id, service_id, quantity, price_cents, duration_min, name
        ) values (
          p_tenant_id, v_appt_id, v_extra.extra_service_id, v_qty,
          v_extra.price_cents, v_extra.duration_min, v_extra.name
        );
      end if;
    end loop;
  end if;

  return v_appt_id;
end;
$$;

grant execute on function public.get_public_service_extras(uuid, uuid) to anon, authenticated;
grant execute on function public.get_public_services(uuid) to anon, authenticated;
grant execute on function public.get_public_available_slots(uuid, uuid, date, uuid, jsonb) to anon, authenticated;
grant execute on function public.book_public_appointment(uuid, uuid, uuid, timestamptz, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.inst_booking_duration_min(uuid, jsonb) to authenticated;
grant execute on function public.inst_booking_price_cents(uuid, jsonb) to authenticated;
