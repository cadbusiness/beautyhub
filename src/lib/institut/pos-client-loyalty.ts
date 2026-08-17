import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { estimateLoyaltyValueCents } from "./client-loyalty";
import { resolveLoyaltyProgramForClient, type LoyaltyReward } from "./loyalty";
import { validateLoyaltyRedemption } from "./loyalty-redeem";

type Db = SupabaseClient<Database>;

export type PosLoyaltyRewardOption = {
  id: string;
  name: string;
  points_cost: number;
  reward_type: "discount_percent" | "discount_fixed";
  discount_percent: number | null;
  discount_cents: number | null;
  eligible: boolean;
  ineligible_code: string | null;
};

export type PosClientLoyaltySnapshot = {
  active: boolean;
  program_id: string;
  program_name: string;
  points_label: string;
  balance: number;
  value_cents: number;
  credit_enabled: boolean;
  credit_rate_bps: number;
  rewards: PosLoyaltyRewardOption[];
};

export async function loadPosClientLoyalty(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<PosClientLoyaltySnapshot | null> {
  const program = await resolveLoyaltyProgramForClient(supabase, tenantId, clientId);
  if (!program) return null;

  const { data: balanceRow } = await supabase
    .from("inst_loyalty_balances")
    .select("points_balance")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("program_id", program.id)
    .maybeSingle();

  const balance = balanceRow?.points_balance ?? 0;

  const { data: rewards } = await supabase
    .from("inst_loyalty_rewards")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("program_id", program.id)
    .eq("is_active", true)
    .in("reward_type", ["discount_percent", "discount_fixed"])
    .order("sort_order")
    .order("points_cost");

  const rewardOptions: PosLoyaltyRewardOption[] = [];
  for (const row of rewards ?? []) {
    const reward = row as LoyaltyReward;
    let eligible = balance >= reward.points_cost;
    let ineligible_code: string | null = eligible ? null : "insufficient_points";

    if (eligible) {
      try {
        await validateLoyaltyRedemption(supabase, tenantId, clientId, reward.id);
      } catch (e) {
        eligible = false;
        ineligible_code = (e as Error).message;
      }
    }

    rewardOptions.push({
      id: reward.id,
      name: reward.name,
      points_cost: reward.points_cost,
      reward_type: reward.reward_type as "discount_percent" | "discount_fixed",
      discount_percent: reward.discount_percent,
      discount_cents: reward.discount_cents,
      eligible,
      ineligible_code,
    });
  }

  return {
    active: true,
    program_id: program.id,
    program_name: program.name,
    points_label: program.points_label || "points",
    balance,
    value_cents: program.credit_enabled
      ? balance
      : estimateLoyaltyValueCents(balance, rewardOptions),
    credit_enabled: program.credit_enabled,
    credit_rate_bps: program.credit_rate_bps,
    rewards: rewardOptions,
  };
}
