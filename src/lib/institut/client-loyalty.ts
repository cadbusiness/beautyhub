import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { computeRewardDiscountCents } from "./loyalty-redeem";
import {
  resolveLoyaltyProgramForClient,
  type LoyaltyProgramListItem,
  type LoyaltyReward,
} from "./loyalty";

type Db = SupabaseClient<Database>;

export type ClientLoyaltyNextReward = {
  name: string;
  pointsCost: number;
  missing: number;
};

export type ClientLoyaltyCard = {
  assignedProgramId: string | null;
  programId: string | null;
  programName: string | null;
  pointsLabel: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  nextReward: ClientLoyaltyNextReward | null;
  valueCents: number;
  programs: LoyaltyProgramListItem[];
};

export function estimateLoyaltyValueCents(
  balance: number,
  rewards: Array<
    Pick<LoyaltyReward, "points_cost" | "reward_type" | "discount_percent" | "discount_cents">
  >,
  subtotalCents = 10_000,
): number {
  let best = 0;
  for (const reward of rewards) {
    if (reward.points_cost <= 0 || balance < reward.points_cost) continue;
    const discount = computeRewardDiscountCents(reward, subtotalCents);
    if (discount > best) best = discount;
  }
  return best;
}

export async function loadClientLoyaltyCard(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientLoyaltyCard> {
  const { data: programRows } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, is_active, points_label")
    .eq("tenant_id", tenantId)
    .order("created_at");

  const programs: LoyaltyProgramListItem[] = (programRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    is_active: p.is_active,
    points_label: p.points_label,
  }));

  const { data: client } = await supabase
    .from("clients")
    .select("loyalty_program_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();

  const assignedProgramId = client?.loyalty_program_id ?? null;
  const program = await resolveLoyaltyProgramForClient(supabase, tenantId, clientId);

  if (!program) {
    return {
      assignedProgramId,
      programId: null,
      programName: null,
      pointsLabel: "points",
      balance: 0,
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
      nextReward: null,
      valueCents: 0,
      programs,
    };
  }

  const [{ data: balanceRow }, { data: rewardRows }] = await Promise.all([
    supabase
      .from("inst_loyalty_balances")
      .select("points_balance, lifetime_earned, lifetime_redeemed")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("program_id", program.id)
      .maybeSingle(),
    supabase
      .from("inst_loyalty_rewards")
      .select("name, points_cost, reward_type, discount_percent, discount_cents, is_active")
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id)
      .eq("is_active", true)
      .order("points_cost"),
  ]);

  const balance = balanceRow?.points_balance ?? 0;
  const rewards = (rewardRows ?? []) as LoyaltyReward[];
  const next = rewards.find((reward) => reward.points_cost > balance) ?? null;

  return {
    assignedProgramId,
    programId: program.id,
    programName: program.name,
    pointsLabel: program.points_label || "points",
    balance,
    lifetimeEarned: balanceRow?.lifetime_earned ?? 0,
    lifetimeRedeemed: balanceRow?.lifetime_redeemed ?? 0,
    nextReward: next
      ? {
          name: next.name,
          pointsCost: next.points_cost,
          missing: Math.max(0, next.points_cost - balance),
        }
      : null,
    valueCents: estimateLoyaltyValueCents(balance, rewards),
    programs,
  };
}

export async function assignClientLoyaltyProgram(
  supabase: Db,
  tenantId: string,
  clientId: string,
  programId: string | null,
): Promise<void> {
  let nextProgramId: string | null = null;
  if (programId) {
    const { data: program } = await supabase
      .from("inst_loyalty_programs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", programId)
      .maybeSingle();
    if (!program) throw new Error("loyalty_program_not_found");
    nextProgramId = program.id;
  }

  const { error } = await supabase
    .from("clients")
    .update({ loyalty_program_id: nextProgramId })
    .eq("tenant_id", tenantId)
    .eq("id", clientId);
  if (error) throw new Error(error.message);

  if (nextProgramId) {
    const { data: existing } = await supabase
      .from("inst_loyalty_balances")
      .select("client_id")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("program_id", nextProgramId)
      .maybeSingle();
    if (!existing) {
      const { error: balanceError } = await supabase.from("inst_loyalty_balances").insert({
        tenant_id: tenantId,
        client_id: clientId,
        program_id: nextProgramId,
        points_balance: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
      });
      if (balanceError && balanceError.code !== "23505") {
        throw new Error(balanceError.message);
      }
    }
  }
}
