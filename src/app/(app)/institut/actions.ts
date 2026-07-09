"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";
import { requireModule } from "@/lib/auth/guards";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { translateQuotaError } from "@/lib/i18n/quota";
import { weekdayMessageKey } from "@/lib/i18n/nav";
import {
  checkAppointmentConflict,
  fetchAppointmentsInRange,
  serializeCalendarAppointments,
  type CalendarAppointmentRow,
  validateStaffSchedule,
} from "@/lib/institut/slots";
import {
  parseExtrasJson,
  type BookingExtraLine,
} from "@/lib/institut/service-extras";
import {
  resolveBookingTotals,
  syncAppointmentExtras,
} from "@/lib/institut/appointment-extras";
import { processLoyaltyForCompletedAppointment } from "@/lib/institut/loyalty";
import { processSameDayRebookOnNewAppointment } from "@/lib/institut/loyalty-events";
import { WEEKDAYS } from "./equipe/constants";

export interface ActionResult {
  error?: string;
  warning?: string;
  ok?: boolean;
  serviceId?: string;
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// --- Prestations -----------------------------------------------------------

async function parseServiceForm(formData: FormData) {
  const t = await getTranslations("institut.actions");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("nameRequired") };

  const durationMin = Number.parseInt(String(formData.get("duration_min") ?? "30"), 10);
  if (!Number.isFinite(durationMin) || durationMin < 1) {
    return { error: t("durationInvalid") };
  }

  return {
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      duration_min: durationMin,
      price_cents: eurosToCents(formData.get("price")),
      color: String(formData.get("color") ?? "").trim() || null,
      is_active: formData.get("is_active") === "on",
      visibility:
        String(formData.get("visibility") ?? "") === "extra_only" ? "extra_only" : "catalog",
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      extras_step_position:
        String(formData.get("extras_step_position") ?? "") === "before_time"
          ? "before_time"
          : "after_time",
      buffer_before_min: Number.parseInt(String(formData.get("buffer_before_min") ?? "0"), 10) || 0,
      buffer_after_min: Number.parseInt(String(formData.get("buffer_after_min") ?? "0"), 10) || 0,
      min_advance_hours:
        Number.parseInt(String(formData.get("min_advance_hours") ?? "0"), 10) || 0,
      max_advance_days:
        Number.parseInt(String(formData.get("max_advance_days") ?? "60"), 10) || 60,
      booking_mode: (() => {
        const mode = String(formData.get("booking_mode") ?? "instant");
        if (mode === "quote" || mode === "manual") return mode;
        return "instant";
      })(),
    },
  };
}

export async function createService(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const parsed = await parseServiceForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("inst_services")
    .insert({
      tenant_id: session.tenant.id,
      ...parsed.data,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const extrasRaw = String(formData.get("extras_links_json") ?? "").trim();
  if (extrasRaw && extrasRaw !== "[]") {
    try {
      const links = JSON.parse(extrasRaw) as Array<{
        extra_service_id: string;
        min_qty: number;
        max_qty: number;
        sort_order: number;
      }>;
      if (links.length > 0) {
        const tActions = await getTranslations("institut.actions");
        const { persistServiceExtras } = await import("@/lib/institut/service-extras-persist");
        const stepPos =
          parsed.data.extras_step_position === "before_time" ? "before_time" : "after_time";
        const extraErr = await persistServiceExtras(
          supabase,
          session.tenant.id,
          created.id,
          links,
          stepPos,
        );
        if (extraErr) {
          return {
            error:
              extraErr === "invalid_extra_selection" ? tActions("extrasInvalid") : extraErr,
          };
        }
      }
    } catch {
      const t = await getTranslations("institut.actions");
      return { error: t("extrasInvalid") };
    }
  }

  revalidatePath("/institut/prestations");
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/rendez-vous");
  revalidatePath("/reserver");
  return { ok: true, serviceId: created.id };
}

export async function updateService(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  await requireModule("institut");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t("serviceNotFound") };

  const parsed = await parseServiceForm(formData);
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
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  try {
    await assertQuota(session.tenant.id, "clients");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: await translateQuotaError(e) };
    throw e;
  }

  const { clientFormFields } = await import("@/lib/institut/clients");
  const fields = clientFormFields(formData);
  if (!fields.email) return { error: t("missingFields") };

  const supabase = await createClient();
  const referredBy = fields.referred_by_client_id;
  if (referredBy) {
    const { data: referrer } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant_id", session.tenant.id)
      .eq("id", referredBy)
      .maybeSingle();
    if (!referrer) return { error: t("missingFields") };
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: session.tenant.id,
      ...fields,
    } as Database["public"]["Tables"]["clients"]["Insert"])
    .select("id")
    .single();
  if (error) {
    return {
      error: error.code === "23505" ? t("clientEmailExists") : error.message,
    };
  }

  if (created) {
    const { provisionClientAccess } = await import("@/lib/institut/client-access");
    await provisionClientAccess(supabase, session.tenant.id, created.id);
  }

  revalidatePath("/institut/clients");
  return { ok: true };
}

export async function regenerateClientPinAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: t("missingFields") };

  const supabase = await createClient();
  try {
    const { regenerateClientPin } = await import("@/lib/institut/client-access");
    await regenerateClientPin(supabase, session.tenant.id, clientId);
  } catch {
    return { error: t("clientPinRegenerateFailed") };
  }

  revalidatePath("/institut/clients");
  revalidatePath(`/institut/clients/${clientId}`);
  return { ok: true };
}

export async function updateClientRecord(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: t("missingFields") };

  const { clientFormFields } = await import("@/lib/institut/clients");
  const fields = clientFormFields(formData);
  if (!fields.email) return { error: t("missingFields") };

  const supabase = await createClient();

  const referredBy = fields.referred_by_client_id;
  if (referredBy) {
    if (referredBy === clientId) return { error: t("clientReferrerSelf") };
    const { data: referrer } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant_id", session.tenant.id)
      .eq("id", referredBy)
      .maybeSingle();
    if (!referrer) return { error: t("missingFields") };
  }

  const { data: before } = await supabase
    .from("clients")
    .select("marketing_opt_in")
    .eq("tenant_id", session.tenant.id)
    .eq("id", clientId)
    .maybeSingle();

  const { error } = await supabase
    .from("clients")
    .update(fields)
    .eq("tenant_id", session.tenant.id)
    .eq("id", clientId);
  if (error) {
    return {
      error: error.code === "23505" ? t("clientEmailExists") : error.message,
    };
  }

  if (before && before.marketing_opt_in !== fields.marketing_opt_in) {
    const { recordConsentEvent } = await import("@/lib/compliance/consent");
    const user = await (await import("@/lib/auth/session")).getCurrentUser();
    await recordConsentEvent(supabase, {
      tenantId: session.tenant.id,
      clientId,
      consentType: "marketing",
      granted: fields.marketing_opt_in,
      source: "client_form",
      actorType: "staff",
      actorId: user?.id ?? null,
    });
  }
  revalidatePath("/institut/clients");
  revalidatePath(`/institut/clients/${clientId}`);
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
    if (e instanceof QuotaExceededError) return { error: await translateQuotaError(e) };
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

  const extras = parseExtrasJson(String(formData.get("extras_json") ?? ""));
  const totals = await resolveBookingTotals(supabase, serviceId, extras);
  if ("error" in totals) {
    return {
      error: totals.error === "service_not_found" ? actions("serviceNotFound") : totals.error,
    };
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(startsAt.getTime() + totals.durationMin! * 60_000);
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

  const { data: appt, error } = await supabase
    .from("inst_appointments")
    .insert({
      tenant_id: session.tenant.id,
      client_id: String(formData.get("client_id") ?? "") || null,
      service_id: serviceId,
      staff_id: staffId,
      resource_id: resourceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: totals.priceCents,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const extraErr = await syncAppointmentExtras(
    supabase,
    session.tenant.id,
    appt.id,
    serviceId,
    extras,
  );
  if (extraErr) return { error: extraErr };

  const bookedClientId = String(formData.get("client_id") ?? "") || null;
  if (bookedClientId) {
    await processSameDayRebookOnNewAppointment(
      supabase,
      session.tenant.id,
      bookedClientId,
      appt.id,
    );
  }

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

  const extras = parseExtrasJson(String(formData.get("extras_json") ?? ""));
  const totals = await resolveBookingTotals(supabase, serviceId, extras);
  if ("error" in totals) {
    return {
      error: totals.error === "service_not_found" ? actions("serviceNotFound") : totals.error,
    };
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw
    ? new Date(endsAtRaw)
    : new Date(startsAt.getTime() + totals.durationMin! * 60_000);
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

  const scheduleWarning = await validateStaffSchedule(
    supabase,
    session.tenant.id,
    staffId,
    startsAt,
    endsAt,
  );
  const ignoreSchedule = formData.get("ignore_schedule") === "1";
  if (scheduleWarning && !ignoreSchedule) {
    const warning = scheduling(`schedule.${scheduleWarning}`);
    return { error: warning, warning };
  }

  const { data: previousAppt } = await supabase
    .from("inst_appointments")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  const newStatus = String(formData.get("status") ?? "booked");

  const { error } = await supabase
    .from("inst_appointments")
    .update({
      client_id: String(formData.get("client_id") ?? "") || null,
      service_id: serviceId,
      staff_id: staffId,
      resource_id: resourceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: totals.priceCents,
      status: newStatus,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  if (newStatus === "completed") {
    await processLoyaltyForCompletedAppointment(
      supabase,
      session.tenant.id,
      id,
      previousAppt?.status,
    );
  }

  const extraErr = await syncAppointmentExtras(
    supabase,
    session.tenant.id,
    id,
    serviceId,
    extras,
  );
  if (extraErr) return { error: extraErr };
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
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const newStatus = String(formData.get("status"));

  const { data: previousAppt } = await supabase
    .from("inst_appointments")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  const { error } = await supabase
    .from("inst_appointments")
    .update({
      status: newStatus,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  if (newStatus === "completed") {
    await processLoyaltyForCompletedAppointment(
      supabase,
      session.tenant.id,
      id,
      previousAppt?.status,
    );
  }

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

export type CalendarAppointmentsResult =
  | { ok: true; appointments: CalendarAppointmentRow[] }
  | { ok: false; error: string };

export async function getCalendarAppointments(
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarAppointmentsResult> {
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const appointments = await fetchAppointmentsInRange(
      supabase,
      session.tenant.id,
      new Date(rangeStart),
      new Date(rangeEnd),
    );
    return { ok: true, appointments: serializeCalendarAppointments(appointments) };
  } catch (e) {
    if (isNextNavigationError(e)) throw e;
    const message = e instanceof Error ? e.message : "calendar_load_failed";
    return { ok: false, error: message };
  }
}

function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = String((error as { digest?: string }).digest ?? "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
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
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  try {
    await assertQuota(session.tenant.id, "staff");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { error: await translateQuotaError(e) };
    throw e;
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: t("nameRequired") };

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

export async function updateStaffMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!id || !fullName) return { error: t("missingFields") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inst_staff")
    .update({
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      color: String(formData.get("color") ?? "").trim() || null,
    })
    .eq("tenant_id", session.tenant.id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/equipe");
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}

export async function inviteTeamMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  if (session.role !== "tenant_owner" && session.role !== "platform_admin") {
    return { error: t("teamInviteForbidden") };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const staffId = String(formData.get("staff_id") ?? "").trim() || null;
  const tenantRoleId = String(formData.get("tenant_role_id") ?? "").trim() || null;
  if (!email) return { error: t("missingFields") };

  const supabase = await createClient();

  const { data: existingPending } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("tenant_id", session.tenant.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return { error: t("teamInviteAlreadyPending") };
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const { error } = await supabase.from("team_invitations").insert({
    tenant_id: session.tenant.id,
    email,
    staff_id: staffId,
    tenant_role_id: tenantRoleId,
    membership_role: "staff",
    invited_by: session.userId,
    token,
  });
  if (error) return { error: error.message };

  revalidatePath("/institut/equipe");
  return { ok: true };
}

export async function resendTeamInvitation(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const id = String(formData.get("invitation_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await supabase
    .from("team_invitations")
    .update({
      token,
      status: "pending",
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    })
    .eq("tenant_id", session.tenant.id)
    .eq("id", id);
  revalidatePath("/institut/equipe");
}

export async function revokeTeamInvitation(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("team_invitations")
    .update({ status: "revoked" })
    .eq("tenant_id", session.tenant.id)
    .eq("id", String(formData.get("invitation_id")));
  revalidatePath("/institut/equipe");
}

export async function createTenantRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  if (session.role !== "tenant_owner" && session.role !== "platform_admin") {
    return { error: t("teamRoleForbidden") };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("nameRequired") };

  const { permissionsFromForm, slugifyRoleName } = await import("@/lib/institut/team-access");
  const supabase = await createClient();
  const { error } = await supabase.from("tenant_roles").insert({
    tenant_id: session.tenant.id,
    name,
    slug: slugifyRoleName(name),
    description: String(formData.get("description") ?? "").trim() || null,
    permissions: permissionsFromForm(formData),
    is_system: false,
  });
  if (error) {
    return { error: error.code === "23505" ? t("teamRoleSlugTaken") : error.message };
  }
  revalidatePath("/institut/equipe");
  return { ok: true };
}

export async function updateTenantRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  if (session.role !== "tenant_owner" && session.role !== "platform_admin") {
    return { error: t("teamRoleForbidden") };
  }

  const id = String(formData.get("role_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { error: t("missingFields") };

  const { permissionsFromForm } = await import("@/lib/institut/team-access");
  const supabase = await createClient();

  const { data: role } = await supabase
    .from("tenant_roles")
    .select("is_system")
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (!role) return { error: t("teamRoleNotFound") };

  const { error } = await supabase
    .from("tenant_roles")
    .update({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      permissions: permissionsFromForm(formData),
    })
    .eq("tenant_id", session.tenant.id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/institut/equipe");
  return { ok: true };
}

export async function deleteTenantRole(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("tenant_roles")
    .delete()
    .eq("tenant_id", session.tenant.id)
    .eq("id", String(formData.get("role_id")))
    .eq("is_system", false);
  revalidatePath("/institut/equipe");
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
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("nameRequired") };

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
  const t = await getTranslations("institut.actions");
  const tWeekdays = await getTranslations("weekdays");
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
      return {
        error: t("workingHoursEndBeforeStart", {
          day: tWeekdays(weekdayMessageKey(day.value)),
        }),
      };
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
