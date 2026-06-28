import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import type { BookingExtraLine } from "./service-extras";

type Db = SupabaseClient<Database>;

export function extrasPayload(extras: BookingExtraLine[]): Json {
  return extras.map((e) => ({ service_id: e.service_id, quantity: e.quantity })) as Json;
}

export async function resolveBookingTotals(
  supabase: Db,
  serviceId: string,
  extras: BookingExtraLine[],
) {
  const payload = extrasPayload(extras);
  const { data: durationMin, error: dErr } = await supabase.rpc("inst_booking_duration_min", {
    p_service_id: serviceId,
    p_extras: payload,
  });
  if (dErr) return { error: dErr.message } as const;
  const { data: priceCents, error: pErr } = await supabase.rpc("inst_booking_price_cents", {
    p_service_id: serviceId,
    p_extras: payload,
  });
  if (pErr) return { error: pErr.message } as const;
  if (durationMin == null || priceCents == null) {
    return { error: "service_not_found" } as const;
  }
  return { durationMin, priceCents } as const;
}

export async function syncAppointmentExtras(
  supabase: Db,
  tenantId: string,
  appointmentId: string,
  serviceId: string,
  extras: BookingExtraLine[],
) {
  await supabase.from("inst_appointment_extras").delete().eq("appointment_id", appointmentId);
  if (!extras.length) return null;

  const { data: rows, error } = await supabase
    .from("inst_service_extras")
    .select(
      "extra_service_id, extra:inst_services!inst_service_extras_extra_service_id_fkey(name, duration_min, price_cents)",
    )
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .in(
      "extra_service_id",
      extras.map((e) => e.service_id),
    );
  if (error) return error.message;

  const inserts = extras.flatMap((line) => {
    const row = rows?.find((r) => r.extra_service_id === line.service_id);
    if (!row) return [];
    const extra = Array.isArray(row.extra) ? row.extra[0] : row.extra;
    if (!extra) return [];
    return [
      {
        tenant_id: tenantId,
        appointment_id: appointmentId,
        service_id: line.service_id,
        quantity: line.quantity,
        price_cents: extra.price_cents,
        duration_min: extra.duration_min,
        name: extra.name,
      },
    ];
  });

  if (inserts.length) {
    const { error: insErr } = await supabase.from("inst_appointment_extras").insert(inserts);
    if (insErr) return insErr.message;
  }
  return null;
}

/** Valide que chaque extra est autorise pour la prestation principale. */
export async function validateExtrasForService(
  supabase: Db,
  tenantId: string,
  serviceId: string,
  extras: BookingExtraLine[],
): Promise<string | null> {
  if (!extras.length) return null;
  const totals = await resolveBookingTotals(supabase, serviceId, extras);
  if ("error" in totals) {
    if (totals.error === "service_not_found") return "Prestation introuvable.";
    return totals.error ?? "Extras invalides.";
  }
  return null;
}
