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
): Promise<string | null> {
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
      return "Ce praticien a deja un rendez-vous sur ce creneau.";
    }
    if (params.resourceId && a.resource_id === params.resourceId) {
      return "Cette cabine est deja reservee sur ce creneau.";
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
      "id, starts_at, ends_at, status, notes, price_cents, staff_id, resource_id, service_id, client_id, service:inst_services(name, color, duration_min), staff:inst_staff(full_name, color), client:clients(full_name, email), resource:inst_resources(name)",
    )
    .eq("tenant_id", tenantId)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  if (error) throw new Error(error.message);
  return data ?? [];
}
