-- Import Bookly en SQL (security definer) : le webhook n’a pas de service_role sur Vercel.

create or replace function public.bookly_import_payload(
  p_token text,
  p_rows jsonb default '[]'::jsonb,
  p_keep_ids integer[] default '{}'::integer[],
  p_mode text default 'upsert'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_conn uuid;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_missing int := 0;
  v_cancelled int := 0;
  v_resources int := 0;
  v_errors text[] := '{}';
  v_missing_titles text[] := '{}';
  v_row jsonb;
  v_ca int;
  v_service_bookly int;
  v_staff_bookly int;
  v_staff_name text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_status text;
  v_service_id uuid;
  v_staff_id uuid;
  v_resource_id uuid;
  v_client_id uuid;
  v_appt_id uuid;
  v_kind text;
  v_email text;
  v_phone text;
  v_full_name text;
  v_cust_bookly text;
  v_keep int[];
  v_price int;
  v_incoming int := 0;
begin
  if length(coalesce(p_token, '')) < 16 then
    raise exception 'invalid_token';
  end if;

  select connection_id, tenant_id into v_conn, v_tenant
  from public.bookly_resolve_webhook(p_token);
  if v_tenant is null or v_conn is null then
    raise exception 'invalid_token';
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    p_rows := '[]'::jsonb;
  end if;

  v_incoming := jsonb_array_length(p_rows);
  v_keep := coalesce(p_keep_ids, '{}'::integer[]);

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_ca := nullif(coalesce(v_row->>'bookly_ca_id', v_row->>'booklyCaId'), '')::int;
      v_service_bookly := nullif(coalesce(v_row->>'service_bookly_id', v_row->>'serviceBooklyId'), '')::int;
      v_starts := nullif(coalesce(v_row->>'starts_at', v_row->>'startsAt'), '')::timestamptz;
      if v_ca is null or v_service_bookly is null or v_starts is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_status := lower(coalesce(v_row->>'status', v_row->>'bookly_status', 'booked'));
      v_status := case v_status
        when 'pending' then 'booked'
        when 'approved' then 'confirmed'
        when 'canceled' then 'cancelled'
        when 'rejected' then 'cancelled'
        when 'done' then 'completed'
        when 'waitlisted' then 'skip'
        when 'waiting' then 'skip'
        when 'no-show' then 'no_show'
        when 'noshow' then 'no_show'
        else v_status
      end;
      if v_status = 'skip' then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if v_status not in ('booked', 'confirmed', 'completed', 'cancelled', 'no_show') then
        v_status := 'booked';
      end if;

      v_ends := nullif(coalesce(v_row->>'ends_at', v_row->>'endsAt'), '')::timestamptz;
      if v_ends is null or v_ends <= v_starts then
        v_ends := v_starts + interval '30 minutes';
      end if;

      begin
        v_price := round(nullif(coalesce(v_row->>'price_cents', v_row->>'priceCents'), '')::numeric)::int;
      exception when others then
        v_price := null;
      end;

      select s.id into v_service_id
      from public.inst_services s
      where s.tenant_id = v_tenant and s.bookly_id = v_service_bookly
      limit 1;
      if v_service_id is null then
        v_missing := v_missing + 1;
        if coalesce(array_length(v_missing_titles, 1), 0) < 8 then
          v_missing_titles := array_append(v_missing_titles,
            coalesce(nullif(v_row->>'service_title', ''), 'bookly#' || v_service_bookly::text));
        end if;
        continue;
      end if;

      v_staff_bookly := nullif(coalesce(v_row->>'staff_bookly_id', v_row->>'staffBooklyId'), '')::int;
      v_staff_name := nullif(trim(coalesce(v_row->>'staff_name', v_row->>'staffName', '')), '');

      v_staff_id := null;
      if v_staff_bookly is not null then
        select st.id into v_staff_id
        from public.inst_staff st
        where st.tenant_id = v_tenant and st.bookly_id = v_staff_bookly
        limit 1;
      end if;
      if v_staff_id is null and v_staff_name is not null then
        select st.id into v_staff_id
        from public.inst_staff st
        where st.tenant_id = v_tenant
          and lower(public.unaccent(st.full_name)) = lower(public.unaccent(v_staff_name))
        limit 1;
      end if;

      v_resource_id := null;
      if v_staff_id is null and (v_staff_name is not null or v_staff_bookly is not null) then
        if v_staff_bookly is not null then
          select r.id into v_resource_id
          from public.inst_resources r
          where r.tenant_id = v_tenant and r.bookly_id = v_staff_bookly
          limit 1;
        end if;
        if v_resource_id is null and v_staff_name is not null then
          select r.id into v_resource_id
          from public.inst_resources r
          where r.tenant_id = v_tenant
            and lower(public.unaccent(r.name)) = lower(public.unaccent(v_staff_name))
          limit 1;
        end if;
        if v_resource_id is null then
          v_kind := case
            when coalesce(v_staff_name, '') ~* '(anniversaire|atelier|event|evenement|soiree|workshop|seminaire|masterclass)'
              then 'event'
            else 'cabin'
          end;
          begin
            insert into public.inst_resources (tenant_id, name, bookly_id, kind)
            values (
              v_tenant,
              coalesce(v_staff_name, 'Cabine ' || v_staff_bookly::text),
              v_staff_bookly,
              v_kind
            )
            returning id into v_resource_id;
            v_resources := v_resources + 1;
          exception when unique_violation then
            select r.id into v_resource_id
            from public.inst_resources r
            where r.tenant_id = v_tenant and r.bookly_id = v_staff_bookly
            limit 1;
          end;
        elsif v_staff_bookly is not null then
          update public.inst_resources
          set bookly_id = coalesce(bookly_id, v_staff_bookly)
          where id = v_resource_id;
        end if;
      end if;

      v_cust_bookly := nullif(coalesce(v_row->>'customer_bookly_id', v_row->>'customerBooklyId'), '');
      v_phone := nullif(trim(coalesce(v_row->>'customer_phone', v_row->>'customerPhone', '')), '');
      v_email := lower(nullif(trim(coalesce(v_row->>'customer_email', v_row->>'customerEmail', '')), ''));
      v_full_name := nullif(trim(concat_ws(
        ' ',
        nullif(trim(coalesce(v_row->>'customer_first_name', v_row->>'customerFirstName', '')), ''),
        nullif(trim(coalesce(v_row->>'customer_last_name', v_row->>'customerLastName', '')), '')
      )), '');
      if v_full_name is null then
        v_full_name := nullif(trim(coalesce(v_row->>'customer_full_name', v_row->>'customerFullName', '')), '');
      end if;

      v_client_id := null;
      if v_cust_bookly is not null then
        select c.id into v_client_id
        from public.clients c
        where c.tenant_id = v_tenant and c.source = 'bookly' and c.external_id = v_cust_bookly
        limit 1;
      end if;
      if v_client_id is null and v_phone is not null and public.normalize_phone(v_phone) is not null then
        select c.id into v_client_id
        from public.clients c
        where c.tenant_id = v_tenant
          and public.normalize_phone(c.phone) = public.normalize_phone(v_phone)
        order by c.updated_at desc
        limit 1;
      end if;
      if v_client_id is null and v_email is not null then
        select c.id into v_client_id
        from public.clients c
        where c.tenant_id = v_tenant and lower(c.email) = v_email
        order by c.updated_at desc
        limit 1;
      end if;
      if v_client_id is null and (v_cust_bookly is not null or v_email is not null or v_phone is not null or v_full_name is not null) then
        begin
          insert into public.clients (tenant_id, email, phone, full_name, source, external_id, tags, metadata)
          values (
            v_tenant,
            coalesce(v_email, 'bookly-' || coalesce(v_cust_bookly, v_ca::text) || '@import.bookly.local'),
            v_phone,
            v_full_name,
            'bookly',
            v_cust_bookly,
            array['Bookly']::text[],
            jsonb_build_object('bookly_customer_id', v_cust_bookly)
          )
          returning id into v_client_id;
        exception when unique_violation then
          if v_cust_bookly is not null then
            select c.id into v_client_id
            from public.clients c
            where c.tenant_id = v_tenant and c.source = 'bookly' and c.external_id = v_cust_bookly
            limit 1;
          end if;
          if v_client_id is null and v_email is not null then
            select c.id into v_client_id
            from public.clients c
            where c.tenant_id = v_tenant and lower(c.email) = v_email
            limit 1;
          end if;
        end;
      end if;

      select a.id into v_appt_id
      from public.inst_appointments a
      where a.tenant_id = v_tenant and a.bookly_id = v_ca
      limit 1;

      if v_appt_id is not null then
        update public.inst_appointments
        set
          client_id = v_client_id,
          service_id = v_service_id,
          staff_id = v_staff_id,
          resource_id = v_resource_id,
          starts_at = v_starts,
          ends_at = v_ends,
          status = v_status,
          price_cents = v_price,
          notes = nullif(v_row->>'notes', '')
        where id = v_appt_id;
        v_updated := v_updated + 1;
      else
        begin
          insert into public.inst_appointments (
            tenant_id, client_id, service_id, staff_id, resource_id,
            starts_at, ends_at, status, price_cents, notes, bookly_id
          ) values (
            v_tenant, v_client_id, v_service_id, v_staff_id, v_resource_id,
            v_starts, v_ends, v_status, v_price,
            nullif(v_row->>'notes', ''),
            v_ca
          );
          v_created := v_created + 1;
        exception when unique_violation then
          update public.inst_appointments
          set
            client_id = v_client_id,
            service_id = v_service_id,
            staff_id = v_staff_id,
            resource_id = v_resource_id,
            starts_at = v_starts,
            ends_at = v_ends,
            status = v_status,
            price_cents = v_price,
            notes = nullif(v_row->>'notes', '')
          where tenant_id = v_tenant and bookly_id = v_ca;
          v_updated := v_updated + 1;
        end;
      end if;

      v_keep := array_append(v_keep, v_ca);
    exception when others then
      v_skipped := v_skipped + 1;
      if coalesce(array_length(v_errors, 1), 0) < 8 then
        v_errors := array_append(v_errors, sqlerrm);
      end if;
    end;
  end loop;

  if p_mode = 'full' and coalesce(array_length(v_keep, 1), 0) > 0 then
    update public.inst_appointments a
    set status = 'cancelled'
    where a.tenant_id = v_tenant
      and a.bookly_id is not null
      and a.starts_at >= date_trunc('day', timezone('utc', now()))
      and a.status <> 'cancelled'
      and not (a.bookly_id = any (v_keep));
    get diagnostics v_cancelled = row_count;
  end if;

  update public.connections
  set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'last_sync_at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'last_error', case when coalesce(array_length(v_errors, 1), 0) > 0 then array_to_string(v_errors, ' | ') else null end,
    'last_sync_stats', jsonb_build_object(
      'mode', p_mode,
      'incoming', v_incoming,
      'created', v_created,
      'updated', v_updated,
      'skipped', v_skipped,
      'missingService', v_missing,
      'missingTitles', to_jsonb(v_missing_titles),
      'resourcesCreated', v_resources,
      'cancelled', v_cancelled,
      'errors', to_jsonb(v_errors)
    )
  )
  where id = v_conn;

  return jsonb_build_object(
    'ok', true,
    'incoming', v_incoming,
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'cancelled', v_cancelled,
    'missingService', v_missing,
    'missingTitles', to_jsonb(v_missing_titles),
    'resourcesCreated', v_resources,
    'errors', to_jsonb(v_errors)
  );
end;
$$;

revoke all on function public.bookly_import_payload(text, jsonb, integer[], text) from public;
grant execute on function public.bookly_import_payload(text, jsonb, integer[], text) to anon, authenticated, service_role;
