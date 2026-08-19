import type { BookingExtraLine } from "@/lib/institut/service-extras";
import {
  createVisitAppointments,
  parseAppointmentLinesJson,
  parseRecurrenceFrequency,
  type AppointmentLineInput,
} from "@/lib/institut/appointment-booking";
import {
  processLoyaltyForCompletedAppointment,
} from "@/lib/institut/loyalty";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

function parseExtras(raw: unknown): BookingExtraLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as { service_id?: string; serviceId?: string; quantity?: number };
      return {
        service_id: String(row.service_id ?? row.serviceId ?? ""),
        quantity: Number(row.quantity ?? 0),
      };
    })
    .filter((e) => e.service_id && e.quantity > 0);
}

export type MobileCreateAppointmentInput = {
  serviceId?: string;
  startsAt: string;
  clientId?: string | null;
  staffId?: string | null;
  resourceId?: string | null;
  notes?: string | null;
  extras?: unknown;
  lines?: unknown;
  recurrenceFrequency?: string | null;
  recurrenceUntil?: string | null;
};

export type MobileUpdateAppointmentInput = {
  status?: string;
  notes?: string | null;
};

export async function createMobileAppointment(
  supabase: Db,
  tenantId: string,
  input: MobileCreateAppointmentInput,
): Promise<{ id: string; ids: string[] } | { error: string; code?: string }> {
  const defaultStaffId = input.staffId?.trim() || null;
  const defaultResourceId = input.resourceId?.trim() || null;
  let lines: AppointmentLineInput[] = [];

  if (Array.isArray(input.lines) && input.lines.length > 0) {
    lines = parseAppointmentLinesJson(JSON.stringify(input.lines));
  }
  if (!lines.length && input.serviceId) {
    lines = [
      {
        serviceId: String(input.serviceId),
        extras: parseExtras(input.extras),
        staffId: defaultStaffId,
        resourceId: defaultResourceId,
      },
    ];
  }
  lines = lines.map((line) => ({
    ...line,
    staffId: line.staffId || defaultStaffId,
    resourceId: line.resourceId || defaultResourceId,
  }));

  const result = await createVisitAppointments(supabase, tenantId, {
    clientId: input.clientId,
    notes: input.notes,
    startsAt: new Date(input.startsAt),
    lines,
    recurrenceFrequency: parseRecurrenceFrequency(input.recurrenceFrequency),
    recurrenceUntil: input.recurrenceUntil?.trim() || null,
  });

  if (!result.ok) {
    return { error: result.error, code: result.code };
  }
  return { id: result.ids[0] ?? "", ids: result.ids };
}

export async function updateMobileAppointment(
  supabase: Db,
  tenantId: string,
  appointmentId: string,
  input: MobileUpdateAppointmentInput,
): Promise<{ ok: true } | { error: string; code?: string }> {
  if (!appointmentId) {
    return { error: "Rendez-vous introuvable.", code: "invalid_input" };
  }

  const allowedStatuses = new Set([
    "booked",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ]);

  const patch: {
    status?: string;
    notes?: string | null;
  } = {};

  if (input.status != null) {
    if (!allowedStatuses.has(input.status)) {
      return { error: "Statut invalide.", code: "invalid_status" };
    }
    patch.status = input.status;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "Aucune modification.", code: "invalid_input" };
  }

  const { data: previousAppt } = await supabase
    .from("inst_appointments")
    .select("status")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!previousAppt) {
    return { error: "Rendez-vous introuvable.", code: "not_found" };
  }

  const { error } = await supabase
    .from("inst_appointments")
    .update(patch)
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);

  if (error) {
    return { error: error.message, code: "update_failed" };
  }

  if (patch.status === "completed") {
    await processLoyaltyForCompletedAppointment(
      supabase,
      tenantId,
      appointmentId,
      previousAppt.status,
    );
  }

  return { ok: true };
}
