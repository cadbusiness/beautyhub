"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireInstitutAccess } from "@/lib/auth/guards";
import { resolveConnection } from "@/lib/connections";
import { createClient } from "@/lib/supabase/server";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import {
  loadLoyaltyProgramSnapshot,
  type LoyaltyCalcMode,
  type LoyaltyIntegrations,
  type LoyaltyProgramSnapshot,
  type LoyaltyRewardType,
  type LoyaltySourceType,
} from "@/lib/institut/loyalty";
import {
  LoyaltyAdminError,
  applyLoyaltyStarterPackRecord,
  createLoyaltyProgramRecord,
  deleteLoyaltyEarnRuleRecord,
  deleteLoyaltyRewardRecord,
  duplicateLoyaltyProgramRecord,
  saveLoyaltyEarnRuleRecord,
  saveLoyaltyProgramSettingsRecord,
  saveLoyaltyRewardRecord,
  setLoyaltyProgramActiveRecord,
} from "@/lib/institut/loyalty-admin";

const LOYALTY_PATHS = [
  "/institut/marketing/fidelite",
  "/compte/institut/fidelite",
] as const;

function revalidateLoyalty() {
  for (const path of LOYALTY_PATHS) revalidatePath(path);
}

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
  selectedProgramId: string;
}> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [snapshot, wooConn, servicesRes] = await Promise.all([
    loadLoyaltyProgramSnapshot(supabase, tenantId, selectedProgramId),
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
    selectedProgramId: snapshot.program.id,
  };
}

type LoyaltyActionKey =
  | "missingFields"
  | "invalidRule"
  | "shopifyUnavailable"
  | "wooRequired"
  | "invalidReward"
  | "invalidPercent"
  | "invalidAmount"
  | "serviceRequired"
  | "starterNotEmpty";

function mapAdminError(
  code: string,
  t: (key: LoyaltyActionKey) => string,
): string {
  switch (code) {
    case "missing_fields":
      return t("missingFields");
    case "invalid_rule":
      return t("invalidRule");
    case "shopify_unavailable":
      return t("shopifyUnavailable");
    case "woo_required":
      return t("wooRequired");
    case "invalid_reward":
      return t("invalidReward");
    case "invalid_percent":
      return t("invalidPercent");
    case "invalid_amount":
      return t("invalidAmount");
    case "service_required":
      return t("serviceRequired");
    case "starter_not_empty":
      return t("starterNotEmpty");
    default:
      return code;
  }
}

export async function saveLoyaltyProgramSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  try {
    await saveLoyaltyProgramSettingsRecord(supabase, session.tenant.id, {
      programId: String(formData.get("program_id") ?? "").trim() || null,
      name: String(formData.get("name") ?? ""),
      pointsLabel: String(formData.get("points_label") ?? ""),
      isActive: formData.get("is_active") === "1",
      birthdayBonusPoints: Number(formData.get("birthday_bonus_points") ?? 0),
      birthdayAutoEnabled: formData.get("birthday_auto_enabled") === "1",
      portalVisible: formData.get("portal_visible") === "1",
      referralPoints: Number(formData.get("referral_points") ?? 0),
      sameDayRebookPoints: Number(formData.get("same_day_rebook_points") ?? 0),
      creditEnabled: formData.get("credit_enabled") === "1",
      creditRateBps: Math.round(Number(formData.get("credit_rate_percent") ?? 0) * 100),
    });
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  const tSaved = await getTranslations("institut.marketing.loyalty.program");
  return { ok: true, message: tSaved("saved") };
}

export async function setLoyaltyProgramActive(
  programId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  try {
    await setLoyaltyProgramActiveRecord(
      supabase,
      session.tenant.id,
      programId,
      isActive,
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  const tSaved = await getTranslations("institut.marketing.loyalty.program");
  return { ok: true, message: tSaved("saved") };
}

export async function saveLoyaltyEarnRule(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  const sourceType = String(formData.get("source_type") ?? "") as LoyaltySourceType;
  let wooConnected = false;
  if (sourceType === "woocommerce_order") {
    const woo = await resolveConnection(session.tenant.id, WOO_PROVIDER);
    wooConnected = woo?.status === "connected";
  }
  try {
    await saveLoyaltyEarnRuleRecord(supabase, session.tenant.id, {
      programId: String(formData.get("program_id") ?? "").trim() || null,
      id: String(formData.get("id") ?? "").trim() || null,
      name: String(formData.get("name") ?? ""),
      sourceType,
      calcMode: String(formData.get("calc_mode") ?? "") as LoyaltyCalcMode,
      pointsValue: Number(formData.get("points_value")),
      minAmountCents: Math.max(0, Math.round(Number(formData.get("min_amount_eur") ?? 0) * 100)),
      isActive: formData.get("is_active") === "1",
      wooConnected,
    });
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  return { ok: true };
}

export async function deleteLoyaltyEarnRule(ruleId: string): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  try {
    await deleteLoyaltyEarnRuleRecord(supabase, session.tenant.id, ruleId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  return { ok: true };
}

export async function saveLoyaltyReward(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  const rewardType = String(formData.get("reward_type") ?? "") as LoyaltyRewardType;
  const discountEur = Number(formData.get("discount_eur"));
  try {
    await saveLoyaltyRewardRecord(supabase, session.tenant.id, {
      programId: String(formData.get("program_id") ?? "").trim() || null,
      id: String(formData.get("id") ?? "").trim() || null,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      rewardType,
      pointsCost: Number(formData.get("points_cost")),
      isActive: formData.get("is_active") === "1",
      newServiceOnly: formData.get("new_service_only") === "1",
      discountPercent: Number(formData.get("discount_percent")),
      discountCents: Number.isFinite(discountEur) ? Math.round(discountEur * 100) : null,
      serviceId: String(formData.get("service_id") ?? "").trim() || null,
    });
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  return { ok: true };
}

export async function deleteLoyaltyReward(rewardId: string): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  try {
    await deleteLoyaltyRewardRecord(supabase, session.tenant.id, rewardId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  return { ok: true };
}

export async function applyLoyaltyStarterPack(programId?: string): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  try {
    await applyLoyaltyStarterPackRecord(supabase, session.tenant.id, programId);
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
  revalidateLoyalty();
  return { ok: true, message: t("starterApplied") };
}

export async function createLoyaltyProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  try {
    const created = await createLoyaltyProgramRecord(
      supabase,
      session.tenant.id,
      String(formData.get("name") ?? ""),
    );
    revalidateLoyalty();
    return { ok: true, createdProgramId: created.programId };
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
}

export async function duplicateLoyaltyProgram(formData: FormData): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.loyalty.actions");
  try {
    const created = await duplicateLoyaltyProgramRecord(
      supabase,
      session.tenant.id,
      String(formData.get("source_program_id") ?? "").trim(),
      String(formData.get("name") ?? ""),
    );
    revalidateLoyalty();
    return { ok: true, createdProgramId: created.programId };
  } catch (e) {
    if (e instanceof LoyaltyAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }
}

export async function assignLoyaltyProgramToClient(
  clientId: string,
  programId: string | null,
): Promise<ActionResult> {
  const session = await requireInstitutAccess("marketing", "write");
  const supabase = await createClient();
  const t = await getTranslations("institut.clients.detail.loyalty");
  try {
    const { assignClientLoyaltyProgram } = await import(
      "@/lib/institut/client-loyalty"
    );
    await assignClientLoyaltyProgram(
      supabase,
      session.tenant.id,
      clientId,
      programId,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "assign_failed";
    if (message === "loyalty_program_not_found") {
      return { error: t("programNotFound") };
    }
    return { error: message };
  }
  revalidatePath("/institut/clients");
  revalidatePath(`/institut/clients/${clientId}`);
  revalidateLoyalty();
  return { ok: true, message: t("saved") };
}