"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { weekdayMessageKey } from "@/lib/i18n/nav";
import { parseBlocksJson } from "@/lib/institut/schedules";

export type ActionResult = { ok?: boolean; error?: string; id?: string };

const REVALIDATE = "/institut/equipe";

export async function createSchedule(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const isDefault = formData.get("is_default") === "1";

  if (!name) return { error: t("scheduleNameRequired") };

  const { count } = await supabase
    .from("inst_schedules")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", session.tenant.id);

  const makeDefault = isDefault || count === 0;

  if (makeDefault) {
    await supabase
      .from("inst_schedules")
      .update({ is_default: false })
      .eq("tenant_id", session.tenant.id)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("inst_schedules")
    .insert({
      tenant_id: session.tenant.id,
      name,
      is_default: makeDefault,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true, id: data.id };
}

export async function deleteSchedule(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: schedule } = await supabase
    .from("inst_schedules")
    .select("is_default")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!schedule || schedule.is_default) return;

  await supabase.from("inst_schedules").delete().eq("id", id);
  revalidatePath(REVALIDATE);
}

export async function saveScheduleBlocks(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const tWeekdays = await getTranslations("weekdays");
  const session = await requireModule("institut");
  const supabase = await createClient();
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const blocksRaw = String(formData.get("blocks") ?? "");

  if (!scheduleId) return { error: t("scheduleNotFound") };

  const { data: schedule } = await supabase
    .from("inst_schedules")
    .select("id, is_default")
    .eq("id", scheduleId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!schedule) return { error: t("scheduleNotFound") };

  const blocks = parseBlocksJson(blocksRaw);
  if (!blocks) return { error: t("scheduleBlocksInvalid") };

  for (const block of blocks) {
    if (block.start_time >= block.end_time) {
      return {
        error: t("workingHoursEndBeforeStart", {
          day: tWeekdays(weekdayMessageKey(block.weekday)),
        }),
      };
    }
  }

  if (name) {
    const { error: nameErr } = await supabase
      .from("inst_schedules")
      .update({ name })
      .eq("id", scheduleId);
    if (nameErr) return { error: nameErr.message };
  }

  await supabase.from("inst_schedule_blocks").delete().eq("schedule_id", scheduleId);

  if (blocks.length > 0) {
    const { error } = await supabase.from("inst_schedule_blocks").insert(
      blocks.map((b) => ({
        schedule_id: scheduleId,
        weekday: b.weekday,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function assignStaffSchedule(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const staffId = String(formData.get("staff_id") ?? "");
  const scheduleId = String(formData.get("schedule_id") ?? "") || null;

  if (scheduleId) {
    const { data } = await supabase
      .from("inst_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle();
    if (!data) return { error: "Schedule not found" };
  }

  const { error } = await supabase
    .from("inst_staff")
    .update({ schedule_id: scheduleId })
    .eq("id", staffId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function assignResourceSchedule(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const resourceId = String(formData.get("resource_id") ?? "");
  const scheduleId = String(formData.get("schedule_id") ?? "") || null;

  if (scheduleId) {
    const { data } = await supabase
      .from("inst_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle();
    if (!data) return { error: "Schedule not found" };
  }

  const { error } = await supabase
    .from("inst_resources")
    .update({ schedule_id: scheduleId })
    .eq("id", resourceId)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function createTimeOff(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();
  const scope = String(formData.get("scope") ?? "tenant");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!startsAt || !endsAt) return { error: t("timeOffDatesRequired") };
  if (new Date(startsAt) >= new Date(endsAt)) return { error: t("timeOffEndBeforeStart") };

  const staffId =
    scope === "staff" ? String(formData.get("staff_id") ?? "") || null : null;
  const resourceId =
    scope === "resource" ? String(formData.get("resource_id") ?? "") || null : null;

  if (scope === "staff" && !staffId) return { error: t("timeOffStaffRequired") };
  if (scope === "resource" && !resourceId) return { error: t("timeOffResourceRequired") };

  const { error } = await supabase.from("inst_time_off").insert({
    tenant_id: session.tenant.id,
    staff_id: staffId,
    resource_id: resourceId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason,
  });

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function deleteTimeOff(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  await supabase
    .from("inst_time_off")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("tenant_id", session.tenant.id);
  revalidatePath(REVALIDATE);
}
