import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  resolveBookingTotals,
  syncAppointmentExtras,
} from "@/lib/institut/appointment-extras";
import { processSameDayRebookOnNewAppointment } from "@/lib/institut/loyalty-events";
import { processLoyaltyForCompletedAppointment } from "@/lib/institut/loyalty";
import { checkAppointmentConflict } from "@/lib/institut/slots";
import { assertQuota, QuotaExceededError } from "@/lib/quota";

type Db = SupabaseClient<Database>;

export type MobileCreateAppointmentInput = {
  serviceId: string;
  startsAt: string;
  clientId?: string | null;
  staffId?: string | null;
  resourceId?: string | null;
  notes?: string | null;
};

export type MobileUpdateAppointmentInput = {
  status?: string;
  notes?: string | null;
};

export async function createMobileAppointment(
  supabase: Db,
  tenantId: string,
  input: MobileCreateAppointmentInput,
): Promise<{ id: string } | { error: string; code?: string }> {
  try {
    await assertQuota(tenantId, "appointments_per_month");
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return { error: e.message, code: "quota_exceeded" };
    }
    throw e;
  }

  const { serviceId, startsAt: startsAtRaw } = input;
  if (!serviceId || !startsAtRaw) {
    return { error: "Prestation et horaire requis.", code: "invalid_input" };
  }

  const { data: service } = await supabase
    .from("inst_services")
    .select("duration_min, price_cents, buffer_before_min, buffer_after_min")
    .eq("id", serviceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!service) {
    return { error: "Prestation introuvable.", code: "service_not_found" };
  }

  const totals = await resolveBookingTotals(supabase, serviceId, []);
  if ("error" in totals) {
    const err = totals.error ?? "booking_error";
    return {
      error: err === "service_not_found" ? "Prestation introuvable." : err,
      code: err === "service_not_found" ? "service_not_found" : "booking_error",
    };
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "Horaire invalide.", code: "invalid_input" };
  }

  const endsAt = new Date(startsAt.getTime() + totals.durationMin! * 60_000);
  const staffId = input.staffId?.trim() || null;
  const resourceId = input.resourceId?.trim() || null;

  const conflict = await checkAppointmentConflict(supabase, tenantId, {
    staffId,
    resourceId,
    startsAt,
    endsAt,
    bufferBeforeMin: service.buffer_before_min ?? 0,
    bufferAfterMin: service.buffer_after_min ?? 0,
  });
  if (conflict) {
    return { error: "Ce créneau est déjà occupé.", code: `conflict_${conflict}` };
  }

  const { data: appt, error } = await supabase
    .from("inst_appointments")
    .insert({
      tenant_id: tenantId,
      client_id: input.clientId?.trim() || null,
      service_id: serviceId,
      staff_id: staffId,
      resource_id: resourceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: totals.priceCents,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !appt) {
    return { error: error?.message ?? "Création impossible.", code: "create_failed" };
  }

  const extraErr = await syncAppointmentExtras(
    supabase,
    tenantId,
    appt.id,
    serviceId,
    [],
  );
  if (extraErr) {
    return { error: extraErr, code: "extras_failed" };
  }

  const bookedClientId = input.clientId?.trim() || null;
  if (bookedClientId) {
    await processSameDayRebookOnNewAppointment(
      supabase,
      tenantId,
      bookedClientId,
      appt.id,
    );
  }

  return { id: appt.id };
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
