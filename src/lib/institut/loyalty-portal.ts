import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { LoyaltyReward } from "./loyalty";
import { formatPrice } from "@/lib/utils";

type Db = SupabaseClient<Database>;

export interface ClientLoyaltyPortalView {
  programName: string;
  pointsLabel: string;
  balance: number;
  lifetimeEarned: number;
  rewards: {
    id: string;
    name: string;
    description: string | null;
    pointsCost: number;
    summary: string;
    newServiceOnly: boolean;
  }[];
}

function rewardSummary(reward: LoyaltyReward, serviceName?: string | null): string {
  if (reward.reward_type === "discount_percent") {
    return `−${reward.discount_percent ?? 0} %`;
  }
  if (reward.reward_type === "discount_fixed") {
    return `−${formatPrice(reward.discount_cents ?? 0)}`;
  }
  return serviceName ?? "Prestation offerte";
}

export async function loadClientLoyaltyPortalView(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientLoyaltyPortalView | null> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, is_active, points_label, portal_visible")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!program?.is_active || !program.portal_visible) return null;

  const [balanceRes, rewardsRes] = await Promise.all([
    supabase
      .from("inst_loyalty_balances")
      .select("points_balance, lifetime_earned")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("inst_loyalty_rewards")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id)
      .eq("is_active", true)
      .order("points_cost")
      .order("sort_order"),
  ]);

  const rewards = (rewardsRes.data ?? []) as LoyaltyReward[];
  const serviceIds = rewards
    .filter((r) => r.reward_type === "free_service" && r.service_id)
    .map((r) => r.service_id as string);

  let serviceNames = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await supabase
      .from("inst_services")
      .select("id, name")
      .in("id", serviceIds);
    serviceNames = new Map((services ?? []).map((s) => [s.id, s.name]));
  }

  return {
    programName: program.name,
    pointsLabel: program.points_label,
    balance: balanceRes.data?.points_balance ?? 0,
    lifetimeEarned: balanceRes.data?.lifetime_earned ?? 0,
    rewards: rewards.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.points_cost,
      summary: rewardSummary(r, r.service_id ? serviceNames.get(r.service_id) : null),
      newServiceOnly: r.new_service_only,
    })),
  };
}
