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

/** Charge les RDV d'une plage pour le calendrier. */
export async function fetchAppointmentsInRange(
  supabase: Db,
  tenantId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const { data, error } = await supabase
    .from("inst_appointments")
    .select(
      "id, starts_at, ends_at, status, notes, price_cents, staff_id, resource_id, service_id, client_id, service:inst_services(name, color, duration_min), staff:inst_staff(full_name, color), client:clients(full_name, email, phone), resource:inst_resources(name), extras:inst_appointment_extras(service_id, quantity, name, price_cents, duration_min)",
    )
    .eq("tenant_id", tenantId)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  if (error) throw new Error(error.message);
  return data ?? [];
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
