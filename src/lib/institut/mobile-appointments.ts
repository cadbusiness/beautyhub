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
import {
  replaceAppointmentExtras,
  resolveAppointmentLineTotals,
} from "@/lib/institut/appointment-extras";
import {
  checkAppointmentConflict,
  validateStaffSchedule,
} from "@/lib/institut/slots";
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
  skipDates?: string[] | null;
  force?: boolean;
};

export type MobileUpdateAppointmentInput = {
  status?: string;
  notes?: string | null;
  startsAt?: string;
  serviceId?: string;
  extras?: unknown;
  force?: boolean;
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
    skipDates: Array.isArray(input.skipDates)
      ? input.skipDates.map((d) => String(d))
      : null,
    force: input.force === true,
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
    starts_at?: string;
    ends_at?: string;
    service_id?: string;
    price_cents?: number;
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

  const { data: previousAppt } = await supabase
    .from("inst_appointments")
    .select("status, starts_at, ends_at, staff_id, resource_id, service_id")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!previousAppt) {
    return { error: "Rendez-vous introuvable.", code: "not_found" };
  }

  const serviceChanged = input.serviceId != null && input.serviceId.trim() !== "";
  const extrasChanged = input.extras !== undefined;
  const timeChanged = input.startsAt != null;
  const force = input.force === true;
  let extrasToSync: ReturnType<typeof parseExtras> | null = extrasChanged
    ? parseExtras(input.extras)
    : null;

  if (serviceChanged || extrasChanged || timeChanged) {
    const startsAt = timeChanged
      ? new Date(input.startsAt!)
      : new Date(previousAppt.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      return { error: "Date invalide.", code: "invalid_input" };
    }

    const serviceId = serviceChanged
      ? String(input.serviceId).trim()
      : previousAppt.service_id;

    let extras = extrasToSync ?? [];
    if (!extrasChanged) {
      const { data: extraRows } = await supabase
        .from("inst_appointment_extras")
        .select("service_id, quantity")
        .eq("appointment_id", appointmentId);
      extras = (extraRows ?? [])
        .map((row) => ({
          service_id: row.service_id,
          quantity: row.quantity,
        }))
        .filter((e) => e.service_id && e.quantity > 0);
    }

    let endsAt: Date;
    let bufferBeforeMin = 0;
    let bufferAfterMin = 0;

    if (serviceId) {
      const totals = await resolveAppointmentLineTotals(
        supabase,
        tenantId,
        serviceId,
        extras,
      );
      if ("error" in totals) {
        return {
          error:
            totals.error === "service_not_found"
              ? "Prestation introuvable."
              : totals.error === "extra_not_found"
                ? "Prestation ajoutée introuvable."
                : totals.error,
          code: "invalid_input",
        };
      }
      endsAt = new Date(startsAt.getTime() + totals.durationMin * 60_000);
      bufferBeforeMin = totals.bufferBeforeMin;
      bufferAfterMin = totals.bufferAfterMin;
      if (serviceChanged) patch.service_id = serviceId;
      patch.price_cents = totals.priceCents;
    } else {
      const previousDuration = Math.max(
        15 * 60_000,
        new Date(previousAppt.ends_at).getTime() -
          new Date(previousAppt.starts_at).getTime(),
      );
      endsAt = new Date(startsAt.getTime() + previousDuration);
    }

    const conflict = await checkAppointmentConflict(supabase, tenantId, {
      staffId: previousAppt.staff_id,
      resourceId: previousAppt.resource_id,
      startsAt,
      endsAt,
      bufferBeforeMin,
      bufferAfterMin,
      excludeId: appointmentId,
    });
    if (conflict && !force) {
      return {
        error:
          conflict === "resourceBusy"
            ? "Cette cabine est déjà occupée sur ce créneau."
            : "Ce créneau est déjà occupé.",
        code: "conflict",
      };
    }

    const scheduleWarning = await validateStaffSchedule(
      supabase,
      tenantId,
      previousAppt.staff_id,
      startsAt,
      endsAt,
    );
    if (scheduleWarning && !force) {
      return {
        error:
          scheduleWarning === "noHoursToday"
            ? "Pas d’horaires ce jour-là."
            : "Ce créneau est hors horaires d’ouverture.",
        code: "schedule",
      };
    }

    patch.starts_at = startsAt.toISOString();
    patch.ends_at = endsAt.toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return { error: "Aucune modification.", code: "invalid_input" };
  }

  const { error } = await supabase
    .from("inst_appointments")
    .update(patch)
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);

  if (error) {
    return { error: error.message, code: "update_failed" };
  }

  if (extrasToSync) {
    const extraErr = await replaceAppointmentExtras(
      supabase,
      tenantId,
      appointmentId,
      extrasToSync,
    );
    if (extraErr) {
      return { error: extraErr, code: "update_failed" };
    }
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
