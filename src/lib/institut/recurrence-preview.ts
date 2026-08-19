import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  parseRecurrenceFrequency,
  type AppointmentLineInput,
} from "@/lib/institut/appointment-booking";
import { resolveAppointmentLineTotals } from "@/lib/institut/appointment-extras";
import {
  dateKeyLocal,
  defaultUntilDate,
  occurrenceStarts,
  type RecurrenceFrequency,
} from "@/lib/institut/appointment-recurrence";

type Db = SupabaseClient<Database>;

export type RecurrenceConflictKind = "clientBusy" | "staffBusy" | "resourceBusy";

export type RecurrenceOccurrencePreview = {
  date: string;
  startsAt: string;
  endsAt: string;
  isFirst: boolean;
  conflict: boolean;
  kind: RecurrenceConflictKind | null;
  reason: string | null;
  otherClientName: string | null;
  otherServiceName: string | null;
};

export type RecurrencePreview = {
  frequency: RecurrenceFrequency;
  durationMin: number;
  freeCount: number;
  conflictCount: number;
  occurrences: RecurrenceOccurrencePreview[];
};

type BusyRow = {
  starts_at: string;
  ends_at: string;
  staff_id: string | null;
  resource_id: string | null;
  client_id: string | null;
  client_name: string | null;
  service_name: string | null;
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function describeConflict(
  kind: RecurrenceConflictKind,
  row: BusyRow,
): string {
  const when = formatTime(row.starts_at);
  const who = row.client_name?.trim() || "une cliente";
  const service = row.service_name?.trim() || "un rendez-vous";
  if (kind === "clientBusy") {
    return `Cette cliente a déjà un rendez-vous (${service} · ${when}).`;
  }
  if (kind === "staffBusy") {
    return `La praticienne est déjà prise (${who} · ${service} · ${when}).`;
  }
  return `La cabine est occupée (${who} · ${service} · ${when}).`;
}

function matchConflict(
  row: BusyRow,
  startMs: number,
  endMs: number,
  staffId: string | null,
  resourceId: string | null,
  clientId: string | null,
): RecurrenceConflictKind | null {
  const rowStart = Date.parse(row.starts_at);
  const rowEnd = Date.parse(row.ends_at);
  if (!Number.isFinite(rowStart) || !Number.isFinite(rowEnd)) return null;
  if (!overlap(startMs, endMs, rowStart, rowEnd)) return null;
  if (clientId && row.client_id === clientId) return "clientBusy";
  if (staffId && row.staff_id === staffId) return "staffBusy";
  if (resourceId && row.resource_id === resourceId) return "resourceBusy";
  return null;
}

export async function previewVisitRecurrence(
  supabase: Db,
  tenantId: string,
  input: {
    startsAt: Date;
    lines: AppointmentLineInput[];
    staffId?: string | null;
    resourceId?: string | null;
    clientId?: string | null;
    recurrenceFrequency?: string | null;
    recurrenceUntil?: string | null;
  },
): Promise<RecurrencePreview | { error: string; code: string }> {
  const lines = input.lines.filter((line) => line.serviceId);
  if (!lines.length) {
    return { error: "Choisissez au moins une prestation.", code: "invalid_input" };
  }
  if (Number.isNaN(input.startsAt.getTime())) {
    return { error: "Horaire invalide.", code: "invalid_input" };
  }

  const frequency = parseRecurrenceFrequency(input.recurrenceFrequency);
  const untilDate =
    frequency === "none"
      ? null
      : input.recurrenceUntil?.trim() || defaultUntilDate(input.startsAt, frequency);
  const starts = occurrenceStarts(input.startsAt, frequency, untilDate);

  let durationMin = 0;
  const staffId = input.staffId?.trim() || lines[0]?.staffId?.trim() || null;
  const resourceId = input.resourceId?.trim() || lines[0]?.resourceId?.trim() || null;
  const clientId = input.clientId?.trim() || null;

  for (const line of lines) {
    const totals = await resolveAppointmentLineTotals(
      supabase,
      tenantId,
      line.serviceId,
      line.extras,
    );
    if ("error" in totals) {
      return {
        error:
          totals.error === "service_not_found"
            ? "Prestation introuvable."
            : "Impossible de calculer la durée.",
        code: "invalid_input",
      };
    }
    durationMin += totals.durationMin;
  }

  const firstStart = starts[0]!;
  const lastStart = starts[starts.length - 1]!;
  const rangeStart = new Date(firstStart.getTime() - 2 * 60 * 60_000);
  const rangeEnd = new Date(lastStart.getTime() + (durationMin + 120) * 60_000);

  const { data: busyRows } = await supabase
    .from("inst_appointments")
    .select("starts_at, ends_at, staff_id, resource_id, client_id, service_id")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .neq("status", "no_show")
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());

  const serviceIds = [
    ...new Set((busyRows ?? []).map((row) => row.service_id).filter(Boolean)),
  ] as string[];
  const clientIds = [
    ...new Set((busyRows ?? []).map((row) => row.client_id).filter(Boolean)),
  ] as string[];

  const [servicesRes, clientsRes] = await Promise.all([
    serviceIds.length
      ? supabase.from("inst_services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    clientIds.length
      ? supabase.from("clients").select("id, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const serviceName = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
  const clientName = new Map(
    (clientsRes.data ?? []).map((c) => [c.id, c.full_name ?? ""]),
  );

  const busy: BusyRow[] = (busyRows ?? []).map((row) => ({
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    staff_id: row.staff_id,
    resource_id: row.resource_id,
    client_id: row.client_id,
    client_name: row.client_id ? clientName.get(row.client_id) ?? null : null,
    service_name: row.service_id ? serviceName.get(row.service_id) ?? null : null,
  }));

  const occurrences: RecurrenceOccurrencePreview[] = starts.map((start, index) => {
    const end = new Date(start.getTime() + durationMin * 60_000);
    const startMs = start.getTime();
    const endMs = end.getTime();
    let kind: RecurrenceConflictKind | null = null;
    let row: BusyRow | null = null;
    for (const candidate of busy) {
      const matched = matchConflict(
        candidate,
        startMs,
        endMs,
        staffId,
        resourceId,
        clientId,
      );
      if (!matched) continue;
      kind = matched;
      row = candidate;
      if (matched === "clientBusy") break;
    }
    return {
      date: dateKeyLocal(start),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      isFirst: index === 0,
      conflict: kind != null,
      kind,
      reason: kind && row ? describeConflict(kind, row) : null,
      otherClientName: row?.client_name ?? null,
      otherServiceName: row?.service_name ?? null,
    };
  });

  return {
    frequency,
    durationMin,
    freeCount: occurrences.filter((o) => !o.conflict).length,
    conflictCount: occurrences.filter((o) => o.conflict).length,
    occurrences,
  };
}
