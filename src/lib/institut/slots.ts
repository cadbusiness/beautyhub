import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export interface ServiceScheduling {
  duration_min: number;
  buffer_before_min: number;
  buffer_after_min: number;
  min_advance_hours: number;
  max_advance_days: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface AppointmentBlock {
  id: string;
  staff_id: string | null;
  resource_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
}

export type ConflictKey = "staffBusy" | "resourceBusy";
export type ScheduleWarningKey = "noHoursToday" | "outsideSchedule";

export interface CalendarAppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  price_cents: number | null;
  staff_id: string | null;
  resource_id: string | null;
  service_id: string | null;
  client_id: string | null;
  service: {
    name?: string;
    color?: string | null;
    duration_min?: number;
  } | null;
  staff: { full_name?: string; color?: string | null } | null;
  client: { full_name?: string | null; email?: string; phone?: string | null } | null;
  resource: { name?: string } | null;
  extras: {
    service_id: string;
    quantity: number;
    name: string;
    price_cents: number;
    duration_min: number;
  }[];
}

function uniqueIds(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/** Verifie chevauchement staff et/ou cabine (buffers inclus). */
export async function checkAppointmentConflict(
  supabase: Db,
  tenantId: string,
  params: {
    staffId: string | null;
    resourceId: string | null;
    startsAt: Date;
    endsAt: Date;
    bufferBeforeMin?: number;
    bufferAfterMin?: number;
    excludeId?: string;
  },
): Promise<ConflictKey | null> {
  const padStart = new Date(
    params.startsAt.getTime() - (params.bufferBeforeMin ?? 0) * 60_000,
  );
  const padEnd = new Date(
    params.endsAt.getTime() + (params.bufferAfterMin ?? 0) * 60_000,
  );

  let q = supabase
    .from("inst_appointments")
    .select("id, staff_id, resource_id, starts_at, ends_at")
    .eq("tenant_id", tenantId)
    .not("status", "eq", "cancelled")
    .lt("starts_at", padEnd.toISOString())
    .gt("ends_at", padStart.toISOString());

  if (params.excludeId) q = q.neq("id", params.excludeId);

  const { data } = await q;
  if (!data?.length) return null;

  for (const a of data) {
    if (params.staffId && a.staff_id === params.staffId) {
      return "staffBusy";
    }
    if (params.resourceId && a.resource_id === params.resourceId) {
      return "resourceBusy";
    }
  }
  return null;
}

/** Charge les RDV d'une plage pour le calendrier (sans embeds PostgREST). */
export async function fetchAppointmentsInRange(
  supabase: Db,
  tenantId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarAppointmentRow[]> {
  const { data, error } = await supabase
    .from("inst_appointments")
    .select(
      "id, starts_at, ends_at, status, notes, price_cents, staff_id, resource_id, service_id, client_id",
    )
    .eq("tenant_id", tenantId)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  if (error || !data?.length) return [];

  const serviceIds = uniqueIds(data.map((a) => a.service_id));
  const staffIds = uniqueIds(data.map((a) => a.staff_id));
  const clientIds = uniqueIds(data.map((a) => a.client_id));
  const resourceIds = uniqueIds(data.map((a) => a.resource_id));
  const apptIds = data.map((a) => a.id);

  const [servicesRes, staffRes, clientsRes, resourcesRes, extrasRes] = await Promise.all([
    serviceIds.length > 0
      ? supabase
          .from("inst_services")
          .select("id, name, color, duration_min")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string | null; duration_min: number }[], error: null }),
    staffIds.length > 0
      ? supabase.from("inst_staff").select("id, full_name, color").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; color: string | null }[], error: null }),
    clientIds.length > 0
      ? supabase.from("clients").select("id, full_name, email, phone").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string; phone: string | null }[], error: null }),
    resourceIds.length > 0
      ? supabase.from("inst_resources").select("id, name").in("id", resourceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    supabase
      .from("inst_appointment_extras")
      .select("appointment_id, service_id, quantity, name, price_cents, duration_min")
      .eq("tenant_id", tenantId)
      .in("appointment_id", apptIds),
  ]);

  let services = servicesRes.data ?? [];
  if (servicesRes.error && serviceIds.length > 0) {
    const fallback = await supabase
      .from("inst_services")
      .select("id, name, duration_min")
      .in("id", serviceIds);
    services = (fallback.data ?? []).map((s) => ({ ...s, color: null }));
  }

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const staffMap = new Map((staffRes.data ?? []).map((s) => [s.id, s]));
  const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c]));
  const resourceMap = new Map((resourcesRes.data ?? []).map((r) => [r.id, r]));

  const extrasByAppt = new Map<string, NonNullable<typeof extrasRes.data>>();
  if (!extrasRes.error) {
    for (const row of extrasRes.data ?? []) {
      const list = extrasByAppt.get(row.appointment_id) ?? [];
      list.push(row);
      extrasByAppt.set(row.appointment_id, list);
    }
  }

  if (extrasRes.error) {
    // Table absente ou colonnes snapshot manquantes — repli sans extras
    return data.map((a) => {
      const svc = a.service_id ? serviceMap.get(a.service_id) : undefined;
      const st = a.staff_id ? staffMap.get(a.staff_id) : undefined;
      const cl = a.client_id ? clientMap.get(a.client_id) : undefined;
      const res = a.resource_id ? resourceMap.get(a.resource_id) : undefined;
      return {
        ...a,
        service: svc ? { name: svc.name, color: svc.color, duration_min: svc.duration_min } : null,
        staff: st ? { full_name: st.full_name, color: st.color } : null,
        client: cl ? { full_name: cl.full_name, email: cl.email, phone: cl.phone } : null,
        resource: res ? { name: res.name } : null,
        extras: [],
      };
    });
  }

  return data.map((a) => {
    const svc = a.service_id ? serviceMap.get(a.service_id) : undefined;
    const st = a.staff_id ? staffMap.get(a.staff_id) : undefined;
    const cl = a.client_id ? clientMap.get(a.client_id) : undefined;
    const res = a.resource_id ? resourceMap.get(a.resource_id) : undefined;

    return {
      ...a,
      service: svc
        ? { name: svc.name, color: svc.color, duration_min: svc.duration_min }
        : null,
      staff: st ? { full_name: st.full_name, color: st.color } : null,
      client: cl
        ? { full_name: cl.full_name, email: cl.email, phone: cl.phone }
        : null,
      resource: res ? { name: res.name } : null,
      extras: (extrasByAppt.get(a.id) ?? []).map((e) => ({
        service_id: e.service_id,
        quantity: e.quantity,
        name: e.name,
        price_cents: e.price_cents,
        duration_min: e.duration_min,
      })),
    };
  });
}

export function serializeCalendarAppointments(rows: CalendarAppointmentRow[]): CalendarAppointmentRow[] {
  return rows.map((row) => ({
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    notes: row.notes ?? null,
    price_cents: row.price_cents ?? null,
    staff_id: row.staff_id ?? null,
    resource_id: row.resource_id ?? null,
    service_id: row.service_id ?? null,
    client_id: row.client_id ?? null,
    service: row.service
      ? {
          name: row.service.name,
          color: row.service.color ?? null,
          duration_min: row.service.duration_min,
        }
      : null,
    staff: row.staff
      ? { full_name: row.staff.full_name, color: row.staff.color ?? null }
      : null,
    client: row.client
      ? {
          full_name: row.client.full_name ?? null,
          email: row.client.email,
          phone: row.client.phone ?? null,
        }
      : null,
    resource: row.resource ? { name: row.resource.name } : null,
    extras: (row.extras ?? []).map((e) => ({
      service_id: e.service_id,
      quantity: e.quantity,
      name: e.name,
      price_cents: e.price_cents,
      duration_min: e.duration_min,
    })),
  }));
}

export interface WorkingHourRow {
  weekday: number;
  start_time: string;
  end_time: string;
  staff_id: string | null;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Retourne un message d'avertissement si le créneau est hors horaires d'ouverture. */
export async function validateStaffSchedule(
  supabase: Db,
  tenantId: string,
  staffId: string | null,
  startsAt: Date,
  endsAt: Date,
): Promise<ScheduleWarningKey | null> {
  const { fetchStaffScheduleBlocks, validateAgainstBlocks } = await import(
    "@/lib/institut/schedules"
  );
  const weekday = startsAt.getDay();
  const blocks = await fetchStaffScheduleBlocks(supabase, tenantId, staffId, weekday);

  if (blocks.length === 0) {
    return "noHoursToday";
  }

  if (!validateAgainstBlocks(blocks, weekday, startsAt, endsAt)) {
    return "outsideSchedule";
  }
  return null;
}

/** @deprecated Utiliser validateStaffSchedule */
export function validateStaffWorkingHours(
  hours: WorkingHourRow[],
  staffId: string | null,
  startsAt: Date,
  endsAt: Date,
): ScheduleWarningKey | null {
  if (!hours.length) return null;

  const weekday = startsAt.getDay();
  const staffHours = hours.filter((h) => h.staff_id === staffId);
  const tenantHours = hours.filter((h) => !h.staff_id);
  const applicable = staffHours.length > 0 ? staffHours : tenantHours;
  const dayWindows = applicable.filter((h) => h.weekday === weekday);

  if (dayWindows.length === 0) {
    return "noHoursToday";
  }

  const startMin = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMin = endsAt.getHours() * 60 + endsAt.getMinutes();

  const fits = dayWindows.some((w) => {
    const wStart = parseTimeToMinutes(w.start_time);
    const wEnd = parseTimeToMinutes(w.end_time);
    return startMin >= wStart && endMin <= wEnd;
  });

  if (!fits) {
    return "outsideSchedule";
  }
  return null;
}
