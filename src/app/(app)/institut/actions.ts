"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import {
  checkAppointmentConflict,
  fetchAppointmentsInRange,
  validateStaffWorkingHours,
} from "@/lib/institut/slots";
import { WEEKDAYS } from "./equipe/constants";

export interface ActionResult {
  error?: string;
  warning?: string;
  ok?: boolean;
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// --- Prestations -----------------------------------------------------------

function parseServiceForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nom requis." as const };

  const durationMin = Number.parseInt(String(formData.get("duration_min") ?? "30"), 10);
  if (!Number.isFinite(durationMin) || durationMin < 1) {
    return { error: "Duree invalide." as const };
  }

  return {
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      duration_min: durationMin,
      price_cents: eurosToCents(formData.get("price")),
      color: String(formData.get("color") ?? "").trim() || null,
      is_active: formData.get("is_active") === "on",
      buffer_before_min: Number.parseInt(String(formData.get("buffer_before_min") ?? "0"), 10) || 0,
      buffer_after_min: Number.parseInt(String(formData.get("buffer_after_min") ?? "0"), 10) || 0,
      min_advance_hours:
        Number.parseInt(String(formData.get("min_advance_hours") ?? "0"), 10) || 0,
      max_advance_days:
        Number.parseInt(String(formData.get("max_advance_days") ?? "60"), 10) || 60,
    },
  };
}

export async function createService(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("inst_services").insert({
    tenant_id: session.tenant.id,
    ...parsed.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/prestations");
  revalidatePath("/institut/caisse");
  return { ok: true };
}

export async function updateService(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireModule("institut");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Prestation introuvable." };

  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("inst_services").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/prestations");
  revalidatePath("/institut/caisse");
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
  revalidatePath("/institut/caisse");
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

async function appointmentMessages() {
  const actions = await getTranslations("institut.actions");
  const scheduling = await getTranslations("institut.scheduling");
  return { actions, scheduling };
}

export async function createAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { actions, scheduling } = await appointmentMessages();
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
    return { error: actions("serviceDateRequired") };
  }

  const { data: service } = await supabase
    .from("inst_services")
    .select("duration_min, price_cents, buffer_before_min, buffer_after_min")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: actions("serviceNotFound") };

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);
  const staffId = String(formData.get("staff_id") ?? "") || null;
  const resourceId = String(formData.get("resource_id") ?? "") || null;

  const conflict = await checkAppointmentConflict(supabase, session.tenant.id, {
    staffId,
    resourceId,
    startsAt,
    endsAt,
    bufferBeforeMin: service.buffer_before_min ?? 0,
    bufferAfterMin: service.buffer_after_min ?? 0,
  });
  if (conflict) return { error: scheduling(`conflict.${conflict}`) };

  const { error } = await supabase.from("inst_appointments").insert({
    tenant_id: session.tenant.id,
    client_id: String(formData.get("client_id") ?? "") || null,
    service_id: serviceId,
    staff_id: staffId,
    resource_id: resourceId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    price_cents: service.price_cents,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function updateAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { actions, scheduling } = await appointmentMessages();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const endsAtRaw = String(formData.get("ends_at") ?? "");

  if (!id || !serviceId || !startsAtRaw) {
    return { error: actions("missingFields") };
  }

  const { data: service } = await supabase
    .from("inst_services")
    .select("duration_min, price_cents, buffer_before_min, buffer_after_min")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: actions("serviceNotFound") };

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw
    ? new Date(endsAtRaw)
    : new Date(startsAt.getTime() + service.duration_min * 60_000);
  const staffId = String(formData.get("staff_id") ?? "") || null;
  const resourceId = String(formData.get("resource_id") ?? "") || null;

  const conflict = await checkAppointmentConflict(supabase, session.tenant.id, {
    staffId,
    resourceId,
    startsAt,
    endsAt,
    bufferBeforeMin: service.buffer_before_min ?? 0,
    bufferAfterMin: service.buffer_after_min ?? 0,
    excludeId: id,
  });
  if (conflict) return { error: scheduling(`conflict.${conflict}`) };

  const { data: hours } = await supabase
    .from("inst_working_hours")
    .select("weekday, start_time, end_time, staff_id")
    .eq("tenant_id", session.tenant.id);

  const scheduleWarning = validateStaffWorkingHours(hours ?? [], staffId, startsAt, endsAt);
  const ignoreSchedule = formData.get("ignore_schedule") === "1";
  if (scheduleWarning && !ignoreSchedule) {
    const warning = scheduling(`schedule.${scheduleWarning}`);
    return { error: warning, warning };
  }

  const { error } = await supabase
    .from("inst_appointments")
    .update({
      client_id: String(formData.get("client_id") ?? "") || null,
      service_id: serviceId,
      staff_id: staffId,
      resource_id: resourceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: service.price_cents,
      status: String(formData.get("status") ?? "booked"),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function cancelAppointment(formData: FormData): Promise<ActionResult> {
  await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("inst_appointments")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function updateAppointmentDetails(formData: FormData): Promise<ActionResult> {
  await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("inst_appointments")
    .update({
      status: String(formData.get("status")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function moveAppointment(formData: FormData): Promise<ActionResult> {
  const { scheduling } = await appointmentMessages();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const startsAt = new Date(String(formData.get("starts_at")));
  const endsAt = new Date(String(formData.get("ends_at")));
  const staffId = String(formData.get("staff_id") ?? "") || null;
  const resourceId = String(formData.get("resource_id") ?? "") || null;

  const { data: appt } = await supabase
    .from("inst_appointments")
    .select("service_id")
    .eq("id", id)
    .maybeSingle();

  let bufferBefore = 0;
  let bufferAfter = 0;
  if (appt?.service_id) {
    const { data: svc } = await supabase
      .from("inst_services")
      .select("buffer_before_min, buffer_after_min")
      .eq("id", appt.service_id)
      .maybeSingle();
    bufferBefore = svc?.buffer_before_min ?? 0;
    bufferAfter = svc?.buffer_after_min ?? 0;
  }

  const conflict = await checkAppointmentConflict(supabase, session.tenant.id, {
    staffId,
    resourceId,
    startsAt,
    endsAt,
    bufferBeforeMin: bufferBefore,
    bufferAfterMin: bufferAfter,
    excludeId: id,
  });
  if (conflict) return { error: scheduling(`conflict.${conflict}`) };

  const { error } = await supabase
    .from("inst_appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      ...(formData.has("staff_id") ? { staff_id: staffId } : {}),
      ...(formData.has("resource_id") ? { resource_id: resourceId } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function getCalendarAppointments(rangeStart: string, rangeEnd: string) {
  const session = await requireModule("institut");
  const supabase = await createClient();
  return fetchAppointmentsInRange(
    supabase,
    session.tenant.id,
    new Date(rangeStart),
    new Date(rangeEnd),
  );
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
