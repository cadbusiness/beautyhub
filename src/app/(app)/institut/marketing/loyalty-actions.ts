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

const LOYALTY_PATH = "/institut/marketing/fidelite";

export type ActionResult = { ok?: boolean; error?: string; message?: string };

export async function loadLoyaltyPageData(): Promise<{
  snapshot: LoyaltyProgramSnapshot;
  integrations: LoyaltyIntegrations;
  services: { id: string; name: string }[];
}> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [snapshot, wooConn, servicesRes] = await Promise.all([
    loadLoyaltyProgramSnapshot(supabase, tenantId),
    resolveConnection(tenantId, WOO_PROVIDER),
    supabase
      .from("inst_services")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    snapshot,
    integrations: {
      woocommerce: wooConn?.status === "connected",
      shopify: false,
    },
    services: servicesRes.data ?? [],
  };
}

export async function saveLoyaltyProgramSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id);

  const name = String(formData.get("name") ?? "").trim();
  const pointsLabel = String(formData.get("points_label") ?? "").trim();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  if (!name || !pointsLabel) return { error: t("missingFields") };

  const { error } = await supabase
    .from("inst_loyalty_programs")
    .update({
      name,
      points_label: pointsLabel,
      is_active: formData.get("is_active") === "1",
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
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id);

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
  const program = await ensureLoyaltyProgram(supabase, session.tenant.id);

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