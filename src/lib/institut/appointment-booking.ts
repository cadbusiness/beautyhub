import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import {
  parseExtrasJson,
  type BookingExtraLine,
} from "@/lib/institut/service-extras";
import {
  resolveBookingTotals,
  syncAppointmentExtras,
} from "@/lib/institut/appointment-extras";
import { processSameDayRebookOnNewAppointment } from "@/lib/institut/loyalty-events";
import { checkAppointmentConflict, type ConflictKey } from "@/lib/institut/slots";
import {
  defaultUntilDate,
  isRecurrenceFrequency,
  occurrenceStarts,
  type RecurrenceFrequency,
} from "@/lib/institut/appointment-recurrence";

type Db = SupabaseClient<Database>;

export type AppointmentLineInput = {
  serviceId: string;
  extras: BookingExtraLine[];
  staffId?: string | null;
  resourceId?: string | null;
};

export type CreateVisitInput = {
  clientId?: string | null;
  notes?: string | null;
  startsAt: Date;
  lines: AppointmentLineInput[];
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceUntil?: string | null;
};

export type CreateVisitSuccess = {
  ok: true;
  ids: string[];
  seriesId: string | null;
};

export type CreateVisitFailure =
  | { ok: false; code: "invalid_input"; error: string }
  | { ok: false; code: "service_not_found"; error: string }
  | { ok: false; code: "quota_exceeded"; error: string; key: string; limit: number }
  | { ok: false; code: "conflict"; error: string; conflict: ConflictKey }
  | { ok: false; code: "booking_error"; error: string }
  | { ok: false; code: "create_failed"; error: string };

export type CreateVisitResult = CreateVisitSuccess | CreateVisitFailure;

type ResolvedLine = AppointmentLineInput & {
  durationMin: number;
  priceCents: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
};

export function parseAppointmentLinesJson(raw: string | null | undefined): AppointmentLineInput[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = item as {
          service_id?: string;
          serviceId?: string;
          extras?: unknown;
          extras_json?: string;
          staff_id?: string | null;
          staffId?: string | null;
          resource_id?: string | null;
          resourceId?: string | null;
        };
        const serviceId = String(row.service_id ?? row.serviceId ?? "");
        const extras = Array.isArray(row.extras)
          ? (row.extras as BookingExtraLine[])
              .map((e) => ({
                service_id: String(e.service_id ?? ""),
                quantity: Number(e.quantity ?? 0),
              }))
              .filter((e) => e.service_id && e.quantity > 0)
          : parseExtrasJson(
              typeof row.extras_json === "string" ? row.extras_json : JSON.stringify(row.extras ?? []),
            );
        return {
          serviceId,
          extras,
          staffId: row.staff_id ?? row.staffId ?? null,
          resourceId: row.resource_id ?? row.resourceId ?? null,
        };
      })
      .filter((line) => line.serviceId);
  } catch {
    return [];
  }
}

export function parseRecurrenceFrequency(raw: string | null | undefined): RecurrenceFrequency {
  const value = String(raw ?? "none");
  return isRecurrenceFrequency(value) ? value : "none";
}

export async function createVisitAppointments(
  supabase: Db,
  tenantId: string,
  input: CreateVisitInput,
): Promise<CreateVisitResult> {
  const lines = input.lines.filter((line) => line.serviceId);
  if (!lines.length) {
    return { ok: false, code: "invalid_input", error: "Au moins une prestation est requise." };
  }
  if (Number.isNaN(input.startsAt.getTime())) {
    return { ok: false, code: "invalid_input", error: "Horaire invalide." };
  }

  const frequency = input.recurrenceFrequency ?? "none";
  const untilDate =
    frequency === "none"
      ? null
      : input.recurrenceUntil || defaultUntilDate(input.startsAt, frequency);
  const starts = occurrenceStarts(input.startsAt, frequency, untilDate);

  const resolved: ResolvedLine[] = [];
  for (const line of lines) {
    const { data: service } = await supabase
      .from("inst_services")
      .select("duration_min, price_cents, buffer_before_min, buffer_after_min")
      .eq("id", line.serviceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!service) {
      return { ok: false, code: "service_not_found", error: "Prestation introuvable." };
    }
    const totals = await resolveBookingTotals(supabase, line.serviceId, line.extras);
    if ("error" in totals) {
      const err = totals.error ?? "booking_error";
      return {
        ok: false,
        code: err === "service_not_found" ? "service_not_found" : "booking_error",
        error: err === "service_not_found" ? "Prestation introuvable." : err,
      };
    }
    resolved.push({
      ...line,
      staffId: line.staffId?.trim() || null,
      resourceId: line.resourceId?.trim() || null,
      durationMin: totals.durationMin!,
      priceCents: totals.priceCents!,
      bufferBeforeMin: service.buffer_before_min ?? 0,
      bufferAfterMin: service.buffer_after_min ?? 0,
    });
  }

  const planned = starts.flatMap((occurrenceStart) => {
    let cursor = occurrenceStart.getTime();
    return resolved.map((line) => {
      const startsAt = new Date(cursor);
      const endsAt = new Date(cursor + line.durationMin * 60_000);
      cursor = endsAt.getTime();
      return { line, startsAt, endsAt };
    });
  });

  try {
    await assertQuota(tenantId, "appointments_per_month", planned.length);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return { ok: false, code: "quota_exceeded", error: e.message, key: e.key, limit: e.limit };
    }
    throw e;
  }

  for (const item of planned) {
    const conflict = await checkAppointmentConflict(supabase, tenantId, {
      staffId: item.line.staffId ?? null,
      resourceId: item.line.resourceId ?? null,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      bufferBeforeMin: item.line.bufferBeforeMin,
      bufferAfterMin: item.line.bufferAfterMin,
    });
    if (conflict) {
      return {
        ok: false,
        code: "conflict",
        conflict,
        error: "Ce créneau est déjà occupé.",
      };
    }
  }

  let seriesId: string | null = null;
  if (frequency !== "none") {
    const { data: series, error: seriesErr } = await supabase
      .from("inst_appointment_series")
      .insert({
        tenant_id: tenantId,
        client_id: input.clientId?.trim() || null,
        frequency,
        until_date: untilDate!,
      })
      .select("id")
      .single();
    if (seriesErr || !series) {
      return {
        ok: false,
        code: "create_failed",
        error: seriesErr?.message ?? "Impossible de créer la série.",
      };
    }
    seriesId = series.id;
  }

  const clientId = input.clientId?.trim() || null;
  const notes = input.notes?.trim() || null;
  const ids: string[] = [];

  for (const occurrenceStart of starts) {
    const visitId = crypto.randomUUID();
    let cursor = occurrenceStart.getTime();
    for (const line of resolved) {
      const id = crypto.randomUUID();
      const startsAt = new Date(cursor);
      const endsAt = new Date(cursor + line.durationMin * 60_000);
      cursor = endsAt.getTime();

      const { error } = await supabase.from("inst_appointments").insert({
        id,
        tenant_id: tenantId,
        client_id: clientId,
        service_id: line.serviceId,
        staff_id: line.staffId ?? null,
        resource_id: line.resourceId ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_cents: line.priceCents,
        notes,
        visit_id: visitId,
        series_id: seriesId,
      });
      if (error) {
        return { ok: false, code: "create_failed", error: error.message };
      }

      const extraErr = await syncAppointmentExtras(
        supabase,
        tenantId,
        id,
        line.serviceId,
        line.extras,
      );
      if (extraErr) {
        return { ok: false, code: "create_failed", error: extraErr };
      }
      ids.push(id);
    }
  }

  if (clientId && ids[0]) {
    await processSameDayRebookOnNewAppointment(supabase, tenantId, clientId, ids[0]);
  }

  return { ok: true, ids, seriesId };
}

export async function cancelSeriesFromAppointment(
  supabase: Db,
  tenantId: string,
  appointmentId: string,
  scope: "one" | "future",
): Promise<{ ok: true } | { error: string }> {
  const { data: appt } = await supabase
    .from("inst_appointments")
    .select("id, series_id, starts_at")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!appt) return { error: "Rendez-vous introuvable." };

  if (scope === "one" || !appt.series_id) {
    const { error } = await supabase
      .from("inst_appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const { error } = await supabase
    .from("inst_appointments")
    .update({ status: "cancelled" })
    .eq("tenant_id", tenantId)
    .eq("series_id", appt.series_id)
    .gte("starts_at", appt.starts_at)
    .neq("status", "cancelled");
  if (error) return { error: error.message };
  return { ok: true };
}
