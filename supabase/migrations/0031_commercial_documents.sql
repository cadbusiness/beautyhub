-- BeautyHub - Devis & demandes (Phase 1)

alter table public.inst_services
  add column if not exists booking_mode text not null default 'instant'
    check (booking_mode in ('instant', 'quote', 'manual'));

comment on column public.inst_services.booking_mode is
  'instant: reservation en ligne; quote: demande de devis; manual: contact sans calendrier';

-- ---------------------------------------------------------------------------
-- Documents commerciaux
-- ---------------------------------------------------------------------------
create table if not exists public.inst_commercial_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.inst_services(id) on delete set null,
  source_document_id uuid references public.inst_commercial_documents(id) on delete set null,
  appointment_id uuid references public.inst_appointments(id) on delete set null,
  doc_type text not null
    check (doc_type in ('quote_request', 'quote')),
  status text not null default 'draft'
    check (status in ('pending', 'draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted')),
  doc_number text,
  public_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  client_message text,
  internal_notes text,
  event_date date,
  valid_until date,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'eur',
  template_id text not null default 'elegant'
    check (template_id in ('elegant', 'minimal', 'wedding', 'artist')),
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_token)
);

create index if not exists idx_inst_com_docs_tenant
  on public.inst_commercial_documents(tenant_id, created_at desc);
create index if not exists idx_inst_com_docs_client
  on public.inst_commercial_documents(tenant_id, client_id);
create index if not exists idx_inst_com_docs_token
  on public.inst_commercial_documents(public_token);

create trigger trg_inst_com_docs_updated before update on public.inst_commercial_documents
  for each row execute function public.set_updated_at();

create table if not exists public.inst_commercial_document_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.inst_commercial_documents(id) on delete cascade,
  sort_order integer not null default 0,
  label text not null,
  description text,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0,
  service_id uuid references public.inst_services(id) on delete set null
);

create index if not exists idx_inst_com_doc_lines_doc
  on public.inst_commercial_document_lines(document_id, sort_order);

alter table public.inst_commercial_documents enable row level security;
alter table public.inst_commercial_document_lines enable row level security;

create policy inst_com_docs_access on public.inst_commercial_documents for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

create policy inst_com_doc_lines_access on public.inst_commercial_document_lines for all
  using (public.auth_has_tenant_access(tenant_id))
  with check (public.auth_has_tenant_access(tenant_id));

-- ---------------------------------------------------------------------------
-- Catalogue public : booking_mode
-- ---------------------------------------------------------------------------
drop function if exists public.get_public_services(uuid);

create or replace function public.get_public_services(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_min integer,
  price_cents integer,
  color text,
  extras_step_position text,
  image_url text,
  booking_mode text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.duration_min, s.price_cents, s.color,
         s.extras_step_position, s.image_url, s.booking_mode
  from public.inst_services s
  where s.tenant_id = p_tenant_id
    and s.is_active = true
    and s.visibility = 'catalog'
  order by s.name;
$$;

grant execute on function public.get_public_services(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Demande de devis publique
-- ---------------------------------------------------------------------------
create or replace function public.submit_public_quote_request(
  p_tenant_id uuid,
  p_service_id uuid,
  p_email text,
  p_full_name text,
  p_phone text default null,
  p_message text default null,
  p_event_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_client_id uuid;
  v_doc_id uuid;
  v_service record;
begin
  if v_email = '' or trim(p_full_name) = '' then
    raise exception 'Email et nom requis';
  end if;

  select id, name, price_cents, currency into v_service
  from public.inst_services
  where id = p_service_id
    and tenant_id = p_tenant_id
    and is_active = true
    and visibility = 'catalog'
    and booking_mode in ('quote', 'manual');
  if v_service.id is null then
    raise exception 'Prestation introuvable ou non eligible au devis';
  end if;

  insert into public.clients (tenant_id, email, full_name, phone)
  values (p_tenant_id, v_email, trim(p_full_name), nullif(trim(p_phone), ''))
  on conflict (tenant_id, email) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, public.clients.phone)
  returning id into v_client_id;

  insert into public.inst_commercial_documents (
    tenant_id, client_id, service_id, doc_type, status,
    client_message, event_date, total_cents, currency
  ) values (
    p_tenant_id, v_client_id, p_service_id, 'quote_request', 'pending',
    nullif(trim(p_message), ''), p_event_date,
    v_service.price_cents, coalesce(v_service.currency, 'eur')
  )
  returning id into v_doc_id;

  return v_doc_id;
end;
$$;

grant execute on function public.submit_public_quote_request(uuid, uuid, text, text, text, text, date)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lecture publique d'un devis par token
-- ---------------------------------------------------------------------------
create or replace function public.get_public_quote_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_lines jsonb;
  v_tenant jsonb;
  v_client jsonb;
  v_service jsonb;
  v_settings jsonb;
  v_pos jsonb;
begin
  select d.* into v_doc
  from public.inst_commercial_documents d
  where d.public_token = p_token
    and d.doc_type = 'quote'
    and d.status in ('sent', 'accepted', 'declined', 'expired');

  if v_doc.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', l.label,
      'description', l.description,
      'quantity', l.quantity,
      'unit_price_cents', l.unit_price_cents
    ) order by l.sort_order
  ), '[]'::jsonb) into v_lines
  from public.inst_commercial_document_lines l
  where l.document_id = v_doc.id;

  select jsonb_build_object(
    'name', t.name,
    'slug', t.slug
  ) into v_tenant
  from public.tenants t
  where t.id = v_doc.tenant_id;

  select jsonb_build_object(
    'full_name', c.full_name,
    'email', c.email
  ) into v_client
  from public.clients c
  where c.id = v_doc.client_id;

  select jsonb_build_object('name', s.name) into v_service
  from public.inst_services s
  where s.id = v_doc.service_id;

  select jsonb_build_object(
    'primary_color', coalesce(ss.primary_color, '#0f172a'),
    'display_name', ss.display_name,
    'logo_url', ss.logo_url
  ) into v_settings
  from public.inst_site_settings ss
  where ss.tenant_id = v_doc.tenant_id;

  select jsonb_build_object(
    'legal_name', ps.legal_name,
    'legal_address', ps.legal_address,
    'vat_number', ps.vat_number,
    'siret', ps.siret
  ) into v_pos
  from public.inst_pos_settings ps
  where ps.tenant_id = v_doc.tenant_id;

  return jsonb_build_object(
    'id', v_doc.id,
    'doc_number', v_doc.doc_number,
    'status', v_doc.status,
    'template_id', v_doc.template_id,
    'client_message', v_doc.client_message,
    'event_date', v_doc.event_date,
    'valid_until', v_doc.valid_until,
    'subtotal_cents', v_doc.subtotal_cents,
    'discount_cents', v_doc.discount_cents,
    'total_cents', v_doc.total_cents,
    'currency', v_doc.currency,
    'sent_at', v_doc.sent_at,
    'accepted_at', v_doc.accepted_at,
    'declined_at', v_doc.declined_at,
    'lines', v_lines,
    'tenant', v_tenant,
    'client', v_client,
    'service', v_service,
    'branding', coalesce(v_settings, '{}'::jsonb),
    'legal', coalesce(v_pos, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_quote_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reponse client (accepter / refuser)
-- ---------------------------------------------------------------------------
create or replace function public.respond_public_quote(
  p_token text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'Action invalide';
  end if;

  select * into v_doc
  from public.inst_commercial_documents
  where public_token = p_token
    and doc_type = 'quote'
    and status = 'sent';

  if v_doc.id is null then
    raise exception 'Devis introuvable ou deja traite';
  end if;

  if v_doc.valid_until is not null and v_doc.valid_until < current_date then
    update public.inst_commercial_documents
    set status = 'expired', updated_at = now()
    where id = v_doc.id;
    raise exception 'Devis expire';
  end if;

  if p_action = 'accept' then
    update public.inst_commercial_documents
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_doc.id;
  else
    update public.inst_commercial_documents
    set status = 'declined', declined_at = now(), updated_at = now()
    where id = v_doc.id;
  end if;

  return true;
end;
$$;

grant execute on function public.respond_public_quote(text, text) to anon, authenticated;
