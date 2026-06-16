"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { assertQuota, QuotaExceededError } from "@/lib/quota";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// --- Prestations -----------------------------------------------------------

export async function createService(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { error } = await supabase.from("inst_services").insert({
    tenant_id: session.tenant.id,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    duration_min: Number.parseInt(String(formData.get("duration_min") ?? "30"), 10),
    price_cents: eurosToCents(formData.get("price")),
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/prestations");
  return { ok: true };
}

export async function deleteService(formData: FormData): Promise<void> {
  await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("inst_services")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/institut/prestations");
}

// --- Clients ----------------------------------------------------------------

export async function createClientRecord(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  try {
    await assertQuota(session.tenant.id, "clients");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: e.message };
    throw e;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    tenant_id: session.tenant.id,
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    full_name: String(formData.get("full_name") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "Un client avec cet email existe deja." : error.message,
    };
  }
  revalidatePath("/institut/clients");
  return { ok: true };
}

// --- Rendez-vous ------------------------------------------------------------

export async function createAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  try {
    await assertQuota(session.tenant.id, "appointments_per_month");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: e.message };
    throw e;
  }

  const supabase = await createClient();
  const serviceId = String(formData.get("service_id") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  if (!serviceId || !startsAtRaw) {
    return { error: "Prestation et date/heure requises." };
  }

  const { data: service } = await supabase
    .from("inst_services")
    .select("duration_min, price_cents")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: "Prestation introuvable." };

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

  const { error } = await supabase.from("inst_appointments").insert({
    tenant_id: session.tenant.id,
    client_id: String(formData.get("client_id") ?? "") || null,
    service_id: serviceId,
    staff_id: String(formData.get("staff_id") ?? "") || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    price_cents: service.price_cents,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("inst_appointments")
    .update({ status: String(formData.get("status")) })
    .eq("id", String(formData.get("id")));
  revalidatePath("/institut/rendez-vous");
}
