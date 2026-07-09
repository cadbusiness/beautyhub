"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { resolveConnection } from "@/lib/connections";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import {
  ensureLoyaltyProgram,
  loadLoyaltyProgramSnapshot,
  type LoyaltyCalcMode,
  type LoyaltyIntegrations,
  type LoyaltyProgramSnapshot,
  type LoyaltyRewardType,
  type LoyaltySourceType,
} from "@/lib/institut/loyalty";
import { buildLoyaltyPublicUrl } from "@/lib/institut/loyalty-public";

const LOYALTY_PATH = "/institut/marketing/fidelite";

export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  createdProgramId?: string;
};

export async function loadLoyaltyPageData(selectedProgramId?: string): Promise<{
  snapshot: LoyaltyProgramSnapshot;
  integrations: LoyaltyIntegrations;
  services: { id: string; name: string }[];
  loyaltyPublicUrl: string;
  selectedProgramId: string;
}> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [snapshot, wooConn, servicesRes, loyaltyPublicUrl] = await Promise.all([
    loadLoyaltyProgramSnapshot(supabase, tenantId, selectedProgramId),
    resolveConnection(tenantId, WOO_PROVIDER),
    supabase
      .from("inst_services")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    buildLoyaltyPublicUrl(session.tenant.slug),
  ]);

  return {
    snapshot,
    integrations: {
      woocommerce: wooConn?.status === "connected",
      shopify: false,
    },
    services: servicesRes.data ?? [],
    loyaltyPublicUrl,
    selectedProgramId: snapshot.program.id,
  };
}

export async function saveLoyaltyProgramSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const programId = String(formData.get("program_id") ?? "").trim() || undefined;
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id, programId);

  const name = String(formData.get("name") ?? "").trim();
  const pointsLabel = String(formData.get("points_label") ?? "").trim();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  if (!name || !pointsLabel) return { error: t("missingFields") };

  const isActive = formData.get("is_active") === "1";
  if (isActive) {
    await supabase
      .from("inst_loyalty_programs")
      .update({ is_active: false })
      .eq("tenant_id", session.tenant.id)
      .neq("id", program.id);
  }

  const { error } = await supabase
    .from("inst_loyalty_programs")
    .update({
      name,
      points_label: pointsLabel,
      is_active: isActive,
      birthday_bonus_points: Math.max(
        0,
        Math.round(Number(formData.get("birthday_bonus_points") ?? 0)),
      ),
      birthday_auto_enabled: formData.get("birthday_auto_enabled") === "1",
      portal_visible: formData.get("portal_visible") === "1",
      referral_points: Math.max(0, Math.round(Number(formData.get("referral_points") ?? 0))),
      same_day_rebook_points: Math.max(
        0,
        Math.round(Number(formData.get("same_day_rebook_points") ?? 0)),
      ),
    })
    .eq("id", program.id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidatePath(LOYALTY_PATH);
  const tSaved = await getTranslations("institut.marketing.loyalty.program");
  return { ok: true, message: tSaved("saved") };
}

export async function saveLoyaltyEarnRule(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const programId = String(formData.get("program_id") ?? "").trim() || undefined;
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id, programId);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("source_type") ?? "") as LoyaltySourceType;
  const calcMode = String(formData.get("calc_mode") ?? "") as LoyaltyCalcMode;
  const pointsValue = Number(formData.get("points_value"));
  const minAmountEur = Number(formData.get("min_amount_eur") ?? 0);
  const t = await getTranslations("institut.marketing.loyalty.actions");

  if (!name || !sourceType || !calcMode || !Number.isFinite(pointsValue) || pointsValue <= 0) {
    return { error: t("invalidRule") };
  }

  if (sourceType === "shopify_order") {
    return { error: t("shopifyUnavailable") };
  }

  if (sourceType === "woocommerce_order") {
    const woo = await resolveConnection(session.tenant.id, WOO_PROVIDER);
    if (woo?.status !== "connected") {
      return { error: t("wooRequired") };
    }
  }

  const payload = {
    tenant_id: session.tenant.id,
    program_id: program.id,
    name,
    is_active: formData.get("is_active") === "1",
    source_type: sourceType,
    calc_mode: calcMode,
    points_value: Math.round(pointsValue),
    min_amount_cents: Math.max(0, Math.round(minAmountEur * 100)),
  };

  if (id) {
    const { error } = await supabase
      .from("inst_loyalty_earn_rules")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", session.tenant.id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("inst_loyalty_earn_rules")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id);
    const { error } = await supabase.from("inst_loyalty_earn_rules").insert({
      ...payload,
      sort_order: count ?? 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(LOYALTY_PATH);
  return { ok: true };
}

export async function deleteLoyaltyEarnRule(ruleId: string): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { error } = await supabase
    .from("inst_loyalty_earn_rules")
    .delete()
    .eq("id", ruleId)
    .eq("tenant_id", session.tenant.id);
  if (error) return { error: error.message };
  revalidatePath(LOYALTY_PATH);
  return { ok: true };
}

export async function saveLoyaltyReward(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const programId = String(formData.get("program_id") ?? "").trim() || undefined;
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id, programId);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const rewardType = String(formData.get("reward_type") ?? "") as LoyaltyRewardType;
  const pointsCost = Number(formData.get("points_cost"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const t = await getTranslations("institut.marketing.loyalty.actions");

  if (!name || !rewardType || !Number.isFinite(pointsCost) || pointsCost <= 0) {
    return { error: t("invalidReward") };
  }

  type RewardInsert = Database["public"]["Tables"]["inst_loyalty_rewards"]["Insert"];

  const payload: RewardInsert = {
    tenant_id: session.tenant.id,
    program_id: program.id,
    name,
    description,
    is_active: formData.get("is_active") === "1",
    reward_type: rewardType,
    points_cost: Math.round(pointsCost),
    discount_percent: null,
    discount_cents: null,
    service_id: null,
    new_service_only: formData.get("new_service_only") === "1",
  };

  if (rewardType === "discount_percent") {
    const pct = Number(formData.get("discount_percent"));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { error: t("invalidPercent") };
    payload.discount_percent = Math.round(pct);
  } else if (rewardType === "discount_fixed") {
    const eur = Number(formData.get("discount_eur"));
    if (!Number.isFinite(eur) || eur <= 0) return { error: t("invalidAmount") };
    payload.discount_cents = Math.round(eur * 100);
  } else {
    const serviceId = String(formData.get("service_id") ?? "").trim();
    if (!serviceId) return { error: t("serviceRequired") };
    payload.service_id = serviceId;
  }

  if (id) {
    const { error } = await supabase
      .from("inst_loyalty_rewards")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", session.tenant.id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("inst_loyalty_rewards")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id);
    const { error } = await supabase.from("inst_loyalty_rewards").insert({
      ...payload,
      sort_order: count ?? 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(LOYALTY_PATH);
  return { ok: true };
}

export async function deleteLoyaltyReward(rewardId: string): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { error } = await supabase
    .from("inst_loyalty_rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", session.tenant.id);
  if (error) return { error: error.message };
  revalidatePath(LOYALTY_PATH);
  return { ok: true };
}

export async function applyLoyaltyStarterPack(programId?: string): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id, programId);
  const t = await getTranslations("institut.marketing.loyalty.actions");

  const { count: ruleCount } = await supabase
    .from("inst_loyalty_earn_rules")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  const { count: rewardCount } = await supabase
    .from("inst_loyalty_rewards")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);

  if ((ruleCount ?? 0) > 0 || (rewardCount ?? 0) > 0) {
    return { error: t("starterNotEmpty") };
  }

  const { error: ruleError } = await supabase.from("inst_loyalty_earn_rules").insert({
    tenant_id: session.tenant.id,
    program_id: program.id,
    name: "Points par visite",
    source_type: "appointment_completed",
    calc_mode: "fixed_per_event",
    points_value: 10,
    min_amount_cents: 0,
    sort_order: 0,
    is_active: true,
  });
  if (ruleError) return { error: ruleError.message };

  const { error: rewardError } = await supabase.from("inst_loyalty_rewards").insert({
    tenant_id: session.tenant.id,
    program_id: program.id,
    name: "Réduction fidélité",
    description: "10 % de réduction sur une prestation",
    reward_type: "discount_percent",
    points_cost: 100,
    discount_percent: 10,
    sort_order: 0,
    is_active: true,
    new_service_only: false,
  });
  if (rewardError) return { error: rewardError.message };

  revalidatePath(LOYALTY_PATH);
  return { ok: true, message: t("starterApplied") };
}

export async function createLoyaltyProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingFields") };

  const { data, error } = await supabase
    .from("inst_loyalty_programs")
    .insert({
      tenant_id: session.tenant.id,
      name,
      is_active: false,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? t("invalidRule") };
  revalidatePath(LOYALTY_PATH);
  return { ok: true, createdProgramId: data.id };
}

export async function duplicateLoyaltyProgram(formData: FormData): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  const sourceProgramId = String(formData.get("source_program_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!sourceProgramId || !name) return { error: t("missingFields") };

  const { data: sourceProgram } = await supabase
    .from("inst_loyalty_programs")
    .select(
      "id, points_label, birthday_bonus_points, portal_visible, referral_points, same_day_rebook_points, birthday_auto_enabled",
    )
    .eq("tenant_id", session.tenant.id)
    .eq("id", sourceProgramId)
    .maybeSingle();

  if (!sourceProgram) return { error: t("invalidRule") };

  const { data: createdProgram, error: createError } = await supabase
    .from("inst_loyalty_programs")
    .insert({
      tenant_id: session.tenant.id,
      name,
      is_active: false,
      points_label: sourceProgram.points_label,
      birthday_bonus_points: sourceProgram.birthday_bonus_points,
      portal_visible: sourceProgram.portal_visible,
      referral_points: sourceProgram.referral_points,
      same_day_rebook_points: sourceProgram.same_day_rebook_points,
      birthday_auto_enabled: sourceProgram.birthday_auto_enabled,
    })
    .select("id")
    .single();

  if (createError || !createdProgram) {
    return { error: createError?.message ?? t("invalidRule") };
  }

  const [rulesRes, rewardsRes] = await Promise.all([
    supabase
      .from("inst_loyalty_earn_rules")
      .select("name, is_active, source_type, calc_mode, points_value, min_amount_cents, sort_order")
      .eq("tenant_id", session.tenant.id)
      .eq("program_id", sourceProgramId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("inst_loyalty_rewards")
      .select(
        "name, description, is_active, reward_type, points_cost, discount_percent, discount_cents, service_id, sort_order, new_service_only",
      )
      .eq("tenant_id", session.tenant.id)
      .eq("program_id", sourceProgramId)
      .order("sort_order")
      .order("created_at"),
  ]);

  if ((rulesRes.data ?? []).length > 0) {
    const { error } = await supabase.from("inst_loyalty_earn_rules").insert(
      (rulesRes.data ?? []).map((row) => ({
        tenant_id: session.tenant.id,
        program_id: createdProgram.id,
        name: row.name,
        is_active: row.is_active,
        source_type: row.source_type,
        calc_mode: row.calc_mode,
        points_value: row.points_value,
        min_amount_cents: row.min_amount_cents,
        sort_order: row.sort_order,
      })),
    );
    if (error) return { error: error.message };
  }

  if ((rewardsRes.data ?? []).length > 0) {
    const { error } = await supabase.from("inst_loyalty_rewards").insert(
      (rewardsRes.data ?? []).map((row) => ({
        tenant_id: session.tenant.id,
        program_id: createdProgram.id,
        name: row.name,
        description: row.description,
        is_active: row.is_active,
        reward_type: row.reward_type,
        points_cost: row.points_cost,
        discount_percent: row.discount_percent,
        discount_cents: row.discount_cents,
        service_id: row.service_id,
        sort_order: row.sort_order,
        new_service_only: row.new_service_only,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath(LOYALTY_PATH);
  return { ok: true, createdProgramId: createdProgram.id };
}