"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { WEEKDAYS } from "./equipe/constants";

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

// --- Personnel --------------------------------------------------------------

export async function createStaffMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  try {
    await assertQuota(session.tenant.id, "staff");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: e.message };
    throw e;
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Nom requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("inst_staff").insert({
    tenant_id: session.tenant.id,
    full_name: fullName,
    email: String(formData.get("email") ?? "").trim() || null,
    color: String(formData.get("color") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/equipe");
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function deleteStaffMember(formData: FormData): Promise<void> {
  await requireModule("institut");
  const supabase = await createClient();
  await supabase.from("inst_staff").delete().eq("id", String(formData.get("id")));
  revalidatePath("/institut/equipe");
  revalidatePath("/institut/rendez-vous");
}

// --- Cabines / ressources ---------------------------------------------------

export async function createResource(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nom requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("inst_resources").insert({
    tenant_id: session.tenant.id,
    name,
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/equipe");
  return { ok: true };
}

export async function deleteResource(formData: FormData): Promise<void> {
  await requireModule("institut");
  const supabase = await createClient();
  await supabase.from("inst_resources").delete().eq("id", String(formData.get("id")));
  revalidatePath("/institut/equipe");
}

// --- Horaires (tenant-wide, staff_id NULL) ----------------------------------

export async function saveWorkingHours(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  await supabase
    .from("inst_working_hours")
    .delete()
    .eq("tenant_id", tenantId)
    .is("staff_id", null);

  const rows: Array<{
    tenant_id: string;
    staff_id: null;
    weekday: number;
    start_time: string;
    end_time: string;
  }> = [];

  for (const day of WEEKDAYS) {
    const enabled = formData.get(`day_${day.value}`) === "on";
    if (!enabled) continue;
    const start = String(formData.get(`start_${day.value}`) ?? "09:00");
    const end = String(formData.get(`end_${day.value}`) ?? "18:00");
    if (start >= end) {
      return { error: `${day.label}: l'heure de fin doit etre apres le debut.` };
    }
    rows.push({
      tenant_id: tenantId,
      staff_id: null,
      weekday: day.value,
      start_time: start,
      end_time: end,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("inst_working_hours").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/institut/equipe");
  return { ok: true };
}
