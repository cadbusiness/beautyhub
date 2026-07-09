import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { LoyaltyReward } from "./loyalty";

type Db = SupabaseClient<Database>;

export class LoyaltyRedeemError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "LoyaltyRedeemError";
  }
}

export function computeRewardDiscountCents(
  reward: Pick<LoyaltyReward, "reward_type" | "discount_percent" | "discount_cents">,
  subtotalCents: number,
): number {
  if (subtotalCents <= 0) return 0;
  if (reward.reward_type === "discount_percent" && reward.discount_percent) {
    return Math.min(subtotalCents, Math.round((subtotalCents * reward.discount_percent) / 100));
  }
  if (reward.reward_type === "discount_fixed" && reward.discount_cents) {
    return Math.min(subtotalCents, reward.discount_cents);
  }
  return 0;
}

async function clientHasPriorService(
  supabase: Db,
  tenantId: string,
  clientId: string,
  serviceId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("inst_appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .in("status", ["completed", "confirmed", "booked"]);
  return (count ?? 0) > 0;
}

export async function validateLoyaltyRedemption(
  supabase: Db,
  tenantId: string,
  clientId: string,
  rewardId: string,
): Promise<{ reward: LoyaltyReward; programId: string; balance: number }> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program?.is_active) throw new LoyaltyRedeemError("program_inactive");

  const { data: reward } = await supabase
    .from("inst_loyalty_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("tenant_id", tenantId)
    .eq("program_id", program.id)
    .maybeSingle();

  if (!reward?.is_active) throw new LoyaltyRedeemError("reward_invalid");

  if (reward.reward_type === "free_service") {
    throw new LoyaltyRedeemError("reward_not_pos_eligible");
  }

  const { data: balanceRow } = await supabase
    .from("inst_loyalty_balances")
    .select("points_balance")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("program_id", program.id)
    .maybeSingle();

  const balance = balanceRow?.points_balance ?? 0;
  if (balance < reward.points_cost) throw new LoyaltyRedeemError("insufficient_points");

  if (reward.new_service_only && reward.service_id) {
    const hasPrior = await clientHasPriorService(
      supabase,
      tenantId,
      clientId,
      reward.service_id,
    );
    if (hasPrior) throw new LoyaltyRedeemError("new_service_only");
  }

  return { reward: reward as LoyaltyReward, programId: program.id, balance };
}

export async function previewLoyaltyDiscountCents(
  supabase: Db,
  tenantId: string,
  clientId: string,
  rewardId: string,
  subtotalCents: number,
): Promise<number> {
  const { reward } = await validateLoyaltyRedemption(supabase, tenantId, clientId, rewardId);
  return computeRewardDiscountCents(reward, subtotalCents);
}

export async function redeemLoyaltyAtSale(
  supabase: Db,
  tenantId: string,
  clientId: string,
  rewardId: string,
  saleId: string,
  subtotalCents: number,
): Promise<string> {
  const { reward, programId } = await validateLoyaltyRedemption(
    supabase,
    tenantId,
    clientId,
    rewardId,
  );
  const discountCents = computeRewardDiscountCents(reward, subtotalCents);

  const { data: redemptionId, error } = await supabase.rpc("inst_loyalty_redeem", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_program_id: programId,
    p_reward_id: reward.id,
    p_points: reward.points_cost,
    p_sale_id: saleId,
    p_discount_cents: discountCents,
    p_idempotency_key: `redeem:sale:${saleId}:reward:${reward.id}`,
    p_notes: reward.name,
  });

  if (error) {
    if (error.message.includes("insufficient_points")) {
      throw new LoyaltyRedeemError("insufficient_points");
    }
    throw new Error(error.message);
  }

  return redemptionId as string;
}
