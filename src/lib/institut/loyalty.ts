import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type LoyaltySourceType =
  | "appointment_completed"
  | "pos_sale"
  | "woocommerce_order"
  | "shopify_order";

export type LoyaltyCalcMode = "fixed_per_event" | "per_euro_spent";

export type LoyaltyRewardType = "discount_percent" | "discount_fixed" | "free_service";

export interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  points_label: string;
}

export interface LoyaltyEarnRule {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;
  is_active: boolean;
  source_type: LoyaltySourceType;
  calc_mode: LoyaltyCalcMode;
  points_value: number;
  min_amount_cents: number;
  sort_order: number;
}

export interface LoyaltyReward {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  reward_type: LoyaltyRewardType;
  points_cost: number;
  discount_percent: number | null;
  discount_cents: number | null;
  service_id: string | null;
  sort_order: number;
}

export interface LoyaltyProgramSnapshot {
  program: LoyaltyProgram;
  rules: LoyaltyEarnRule[];
  rewards: LoyaltyReward[];
  stats: {
    clientsWithPoints: number;
    totalPointsOutstanding: number;
  };
}

export interface LoyaltyIntegrations {
  woocommerce: boolean;
  shopify: boolean;
}

export function calcPointsForRule(
  rule: Pick<LoyaltyEarnRule, "calc_mode" | "points_value">,
  amountCents: number,
): number {
  if (rule.calc_mode === "fixed_per_event") {
    return rule.points_value;
  }
  if (amountCents <= 0) return 0;
  return Math.floor((amountCents * rule.points_value) / 100);
}

export async function ensureLoyaltyProgram(
  supabase: Db,
  tenantId: string,
): Promise<LoyaltyProgram> {
  const { data: existing } = await supabase
    .from("inst_loyalty_programs")
    .select("id, tenant_id, name, is_active, points_label")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("inst_loyalty_programs")
    .insert({ tenant_id: tenantId })
    .select("id, tenant_id, name, is_active, points_label")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Programme fidélité introuvable");
  return created;
}

export async function loadLoyaltyProgramSnapshot(
  supabase: Db,
  tenantId: string,
): Promise<LoyaltyProgramSnapshot> {
  const program = await ensureLoyaltyProgram(supabase, tenantId);

  const [rulesRes, rewardsRes, balancesRes] = await Promise.all([
    supabase
      .from("inst_loyalty_earn_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("inst_loyalty_rewards")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("inst_loyalty_balances")
      .select("points_balance")
      .eq("tenant_id", tenantId)
      .gt("points_balance", 0),
  ]);

  const balances = balancesRes.data ?? [];
  return {
    program,
    rules: (rulesRes.data ?? []) as LoyaltyEarnRule[],
    rewards: (rewardsRes.data ?? []) as LoyaltyReward[],
    stats: {
      clientsWithPoints: balances.length,
      totalPointsOutstanding: balances.reduce((sum, b) => sum + b.points_balance, 0),
    },
  };
}

function saleSourceType(sale: { woo_order_id: number | null }): LoyaltySourceType {
  return sale.woo_order_id ? "woocommerce_order" : "pos_sale";
}

async function applyEarnRules(
  supabase: Db,
  tenantId: string,
  program: LoyaltyProgram,
  rules: LoyaltyEarnRule[],
  input: {
    clientId: string;
    sourceType: LoyaltySourceType;
    sourceId: string;
    amountCents: number;
    idempotencyPrefix: string;
    notes?: string;
  },
): Promise<void> {
  if (!program.is_active) return;

  const matching = rules.filter((r) => r.is_active && r.source_type === input.sourceType);
  if (matching.length === 0) return;

  for (const rule of matching) {
    if (input.amountCents < rule.min_amount_cents) continue;

    const points =
      rule.calc_mode === "fixed_per_event"
        ? rule.points_value
        : calcPointsForRule(rule, input.amountCents);
    if (points <= 0) continue;

    await supabase.rpc("inst_loyalty_credit", {
      p_tenant_id: tenantId,
      p_client_id: input.clientId,
      p_program_id: program.id,
      p_rule_id: rule.id,
      p_points: points,
      p_source_type: input.sourceType,
      p_source_id: input.sourceId,
      p_idempotency_key: `${input.idempotencyPrefix}:rule:${rule.id}`,
      p_notes: input.notes ?? undefined,
    });
  }
}

export async function processLoyaltyForCompletedAppointment(
  supabase: Db,
  tenantId: string,
  appointmentId: string,
  previousStatus?: string | null,
): Promise<void> {
  if (previousStatus === "completed") return;

  const { data: appt } = await supabase
    .from("inst_appointments")
    .select("id, client_id, status, price_cents, tenant_id")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!appt || appt.status !== "completed" || !appt.client_id) return;

  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, tenant_id, name, is_active, points_label")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!program?.is_active) return;

  const { data: rules } = await supabase
    .from("inst_loyalty_earn_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("program_id", program.id)
    .eq("is_active", true)
    .eq("source_type", "appointment_completed");

  await applyEarnRules(supabase, tenantId, program, (rules ?? []) as LoyaltyEarnRule[], {
    clientId: appt.client_id,
    sourceType: "appointment_completed",
    sourceId: appt.id,
    amountCents: appt.price_cents ?? 0,
    idempotencyPrefix: `earn:appointment:${appt.id}`,
    notes: "RDV terminé",
  });
}

export async function processLoyaltyForPaidSale(
  supabase: Db,
  tenantId: string,
  saleId: string,
): Promise<void> {
  const { data: sale } = await supabase
    .from("inst_sales")
    .select("id, client_id, status, total_cents, woo_order_id, tenant_id")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sale || !sale.client_id || sale.status !== "paid") return;

  const sourceType = saleSourceType(sale);

  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, tenant_id, name, is_active, points_label")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!program?.is_active) return;

  const { data: rules } = await supabase
    .from("inst_loyalty_earn_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("program_id", program.id)
    .eq("is_active", true)
    .eq("source_type", sourceType);

  await applyEarnRules(supabase, tenantId, program, (rules ?? []) as LoyaltyEarnRule[], {
    clientId: sale.client_id,
    sourceType,
    sourceId: sale.id,
    amountCents: sale.total_cents ?? 0,
    idempotencyPrefix: `earn:sale:${sale.id}`,
    notes: sourceType === "woocommerce_order" ? "Commande WooCommerce" : "Vente caisse",
  });
}

export function sourceRequiresAmount(source: LoyaltySourceType): boolean {
  return source !== "appointment_completed";
}

export function defaultCalcModeForSource(source: LoyaltySourceType): LoyaltyCalcMode {
  return source === "appointment_completed" ? "fixed_per_event" : "per_euro_spent";
}

export const LOYALTY_SOURCE_TYPES: LoyaltySourceType[] = [
  "appointment_completed",
  "pos_sale",
  "woocommerce_order",
  "shopify_order",
];

export const LOYALTY_REWARD_TYPES: LoyaltyRewardType[] = [
  "discount_percent",
  "discount_fixed",
  "free_service",
];
