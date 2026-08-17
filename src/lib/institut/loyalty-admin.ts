import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  ensureLoyaltyProgram,
  type LoyaltyCalcMode,
  type LoyaltyRewardType,
  type LoyaltySourceType,
} from "./loyalty";

type Db = SupabaseClient<Database>;

export class LoyaltyAdminError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LoyaltyAdminError";
  }
}

export type LoyaltyProgramSettingsInput = {
  programId?: string | null;
  name: string;
  pointsLabel: string;
  isActive: boolean;
  birthdayBonusPoints: number;
  birthdayAutoEnabled: boolean;
  portalVisible: boolean;
  referralPoints: number;
  sameDayRebookPoints: number;
  creditEnabled: boolean;
  creditRateBps: number;
};

export type LoyaltyEarnRuleInput = {
  programId?: string | null;
  id?: string | null;
  name: string;
  sourceType: LoyaltySourceType;
  calcMode: LoyaltyCalcMode;
  pointsValue: number;
  minAmountCents: number;
  isActive: boolean;
  wooConnected?: boolean;
};

export type LoyaltyRewardInput = {
  programId?: string | null;
  id?: string | null;
  name: string;
  description?: string | null;
  rewardType: LoyaltyRewardType;
  pointsCost: number;
  isActive: boolean;
  newServiceOnly: boolean;
  discountPercent?: number | null;
  discountCents?: number | null;
  serviceId?: string | null;
};

const SOURCE_TYPES: LoyaltySourceType[] = [
  "appointment_completed",
  "pos_sale",
  "woocommerce_order",
  "shopify_order",
];
const CALC_MODES: LoyaltyCalcMode[] = ["fixed_per_event", "per_euro_spent"];
const REWARD_TYPES: LoyaltyRewardType[] = [
  "discount_percent",
  "discount_fixed",
  "free_service",
];

export async function saveLoyaltyProgramSettingsRecord(
  supabase: Db,
  tenantId: string,
  input: LoyaltyProgramSettingsInput,
): Promise<{ programId: string }> {
  const name = input.name.trim();
  const pointsLabel = input.pointsLabel.trim();
  if (!name || !pointsLabel) throw new LoyaltyAdminError("missing_fields");

  const program = await ensureLoyaltyProgram(supabase, tenantId, input.programId);
  if (input.isActive) {
    await supabase
      .from("inst_loyalty_programs")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .neq("id", program.id);
  }

  const { error } = await supabase
    .from("inst_loyalty_programs")
    .update({
      name,
      points_label: pointsLabel,
      is_active: input.isActive,
      birthday_bonus_points: Math.max(0, Math.round(input.birthdayBonusPoints)),
      birthday_auto_enabled: input.birthdayAutoEnabled,
      portal_visible: input.portalVisible,
      referral_points: Math.max(0, Math.round(input.referralPoints)),
      same_day_rebook_points: Math.max(0, Math.round(input.sameDayRebookPoints)),
      credit_enabled: input.creditEnabled,
      credit_rate_bps: Math.max(
        0,
        Math.min(10_000, Math.round(Number.isFinite(input.creditRateBps) ? input.creditRateBps : 0)),
      ),
    })
    .eq("id", program.id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return { programId: program.id };
}

export async function setLoyaltyProgramActiveRecord(
  supabase: Db,
  tenantId: string,
  programId: string,
  isActive: boolean,
): Promise<void> {
  const program = await ensureLoyaltyProgram(supabase, tenantId, programId);
  if (isActive) {
    await supabase
      .from("inst_loyalty_programs")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .neq("id", program.id);
  }
  const { error } = await supabase
    .from("inst_loyalty_programs")
    .update({ is_active: isActive })
    .eq("id", program.id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function saveLoyaltyEarnRuleRecord(
  supabase: Db,
  tenantId: string,
  input: LoyaltyEarnRuleInput,
): Promise<void> {
  const program = await ensureLoyaltyProgram(supabase, tenantId, input.programId);
  const name = input.name.trim();
  if (
    !name ||
    !SOURCE_TYPES.includes(input.sourceType) ||
    !CALC_MODES.includes(input.calcMode) ||
    !Number.isFinite(input.pointsValue) ||
    input.pointsValue <= 0
  ) {
    throw new LoyaltyAdminError("invalid_rule");
  }
  if (input.sourceType === "shopify_order") {
    throw new LoyaltyAdminError("shopify_unavailable");
  }
  if (input.sourceType === "woocommerce_order" && !input.wooConnected) {
    throw new LoyaltyAdminError("woo_required");
  }

  const payload = {
    tenant_id: tenantId,
    program_id: program.id,
    name,
    is_active: input.isActive,
    source_type: input.sourceType,
    calc_mode: input.calcMode,
    points_value: Math.round(input.pointsValue),
    min_amount_cents: Math.max(0, Math.round(input.minAmountCents)),
  };

  if (input.id) {
    const { error } = await supabase
      .from("inst_loyalty_earn_rules")
      .update(payload)
      .eq("id", input.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return;
  }

  const { count } = await supabase
    .from("inst_loyalty_earn_rules")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);
  const { error } = await supabase.from("inst_loyalty_earn_rules").insert({
    ...payload,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function deleteLoyaltyEarnRuleRecord(
  supabase: Db,
  tenantId: string,
  ruleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("inst_loyalty_earn_rules")
    .delete()
    .eq("id", ruleId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function saveLoyaltyRewardRecord(
  supabase: Db,
  tenantId: string,
  input: LoyaltyRewardInput,
): Promise<void> {
  const program = await ensureLoyaltyProgram(supabase, tenantId, input.programId);
  const name = input.name.trim();
  if (
    !name ||
    !REWARD_TYPES.includes(input.rewardType) ||
    !Number.isFinite(input.pointsCost) ||
    input.pointsCost <= 0
  ) {
    throw new LoyaltyAdminError("invalid_reward");
  }

  type RewardInsert = Database["public"]["Tables"]["inst_loyalty_rewards"]["Insert"];
  const payload: RewardInsert = {
    tenant_id: tenantId,
    program_id: program.id,
    name,
    description: input.description?.trim() || null,
    is_active: input.isActive,
    reward_type: input.rewardType,
    points_cost: Math.round(input.pointsCost),
    discount_percent: null,
    discount_cents: null,
    service_id: null,
    new_service_only: input.newServiceOnly,
  };

  if (input.rewardType === "discount_percent") {
    const pct = Number(input.discountPercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new LoyaltyAdminError("invalid_percent");
    }
    payload.discount_percent = Math.round(pct);
  } else if (input.rewardType === "discount_fixed") {
    const cents = Number(input.discountCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      throw new LoyaltyAdminError("invalid_amount");
    }
    payload.discount_cents = Math.round(cents);
  } else {
    const serviceId = input.serviceId?.trim() ?? "";
    if (!serviceId) throw new LoyaltyAdminError("service_required");
    payload.service_id = serviceId;
  }

  if (input.id) {
    const { error } = await supabase
      .from("inst_loyalty_rewards")
      .update(payload)
      .eq("id", input.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return;
  }

  const { count } = await supabase
    .from("inst_loyalty_rewards")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);
  const { error } = await supabase.from("inst_loyalty_rewards").insert({
    ...payload,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function deleteLoyaltyRewardRecord(
  supabase: Db,
  tenantId: string,
  rewardId: string,
): Promise<void> {
  const { error } = await supabase
    .from("inst_loyalty_rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function applyLoyaltyStarterPackRecord(
  supabase: Db,
  tenantId: string,
  programId?: string | null,
): Promise<void> {
  const program = await ensureLoyaltyProgram(supabase, tenantId, programId);
  const { count: ruleCount } = await supabase
    .from("inst_loyalty_earn_rules")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);
  const { count: rewardCount } = await supabase
    .from("inst_loyalty_rewards")
    .select("id", { count: "exact", head: true })
    .eq("program_id", program.id);
  if ((ruleCount ?? 0) > 0 || (rewardCount ?? 0) > 0) {
    throw new LoyaltyAdminError("starter_not_empty");
  }

  const { error: ruleError } = await supabase.from("inst_loyalty_earn_rules").insert({
    tenant_id: tenantId,
    program_id: program.id,
    name: "Points par visite",
    source_type: "appointment_completed",
    calc_mode: "fixed_per_event",
    points_value: 10,
    min_amount_cents: 0,
    sort_order: 0,
    is_active: true,
  });
  if (ruleError) throw new Error(ruleError.message);

  const { error: rewardError } = await supabase.from("inst_loyalty_rewards").insert({
    tenant_id: tenantId,
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
  if (rewardError) throw new Error(rewardError.message);
}

export async function createLoyaltyProgramRecord(
  supabase: Db,
  tenantId: string,
  name: string,
): Promise<{ programId: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new LoyaltyAdminError("missing_fields");
  const { data, error } = await supabase
    .from("inst_loyalty_programs")
    .insert({
      tenant_id: tenantId,
      name: trimmed,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create_failed");
  return { programId: data.id };
}

export async function duplicateLoyaltyProgramRecord(
  supabase: Db,
  tenantId: string,
  sourceProgramId: string,
  name: string,
): Promise<{ programId: string }> {
  const trimmed = name.trim();
  if (!sourceProgramId || !trimmed) throw new LoyaltyAdminError("missing_fields");

  const { data: sourceProgram } = await supabase
    .from("inst_loyalty_programs")
    .select(
      "id, points_label, birthday_bonus_points, portal_visible, referral_points, same_day_rebook_points, birthday_auto_enabled, credit_enabled, credit_rate_bps",
    )
    .eq("tenant_id", tenantId)
    .eq("id", sourceProgramId)
    .maybeSingle();
  if (!sourceProgram) throw new LoyaltyAdminError("invalid_rule");

  const { data: createdProgram, error: createError } = await supabase
    .from("inst_loyalty_programs")
    .insert({
      tenant_id: tenantId,
      name: trimmed,
      is_active: false,
      points_label: sourceProgram.points_label,
      birthday_bonus_points: sourceProgram.birthday_bonus_points,
      portal_visible: sourceProgram.portal_visible,
      referral_points: sourceProgram.referral_points,
      same_day_rebook_points: sourceProgram.same_day_rebook_points,
      birthday_auto_enabled: sourceProgram.birthday_auto_enabled,
      credit_enabled: sourceProgram.credit_enabled,
      credit_rate_bps: sourceProgram.credit_rate_bps,
    })
    .select("id")
    .single();
  if (createError || !createdProgram) {
    throw new Error(createError?.message ?? "create_failed");
  }

  const [rulesRes, rewardsRes] = await Promise.all([
    supabase
      .from("inst_loyalty_earn_rules")
      .select("name, is_active, source_type, calc_mode, points_value, min_amount_cents, sort_order")
      .eq("tenant_id", tenantId)
      .eq("program_id", sourceProgramId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("inst_loyalty_rewards")
      .select(
        "name, description, is_active, reward_type, points_cost, discount_percent, discount_cents, service_id, sort_order, new_service_only",
      )
      .eq("tenant_id", tenantId)
      .eq("program_id", sourceProgramId)
      .order("sort_order")
      .order("created_at"),
  ]);

  if ((rulesRes.data ?? []).length > 0) {
    const { error } = await supabase.from("inst_loyalty_earn_rules").insert(
      (rulesRes.data ?? []).map((row) => ({
        tenant_id: tenantId,
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
    if (error) throw new Error(error.message);
  }

  if ((rewardsRes.data ?? []).length > 0) {
    const { error } = await supabase.from("inst_loyalty_rewards").insert(
      (rewardsRes.data ?? []).map((row) => ({
        tenant_id: tenantId,
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
    if (error) throw new Error(error.message);
  }

  return { programId: createdProgram.id };
}
