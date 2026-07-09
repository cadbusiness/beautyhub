import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getTenantPublicBaseUrl } from "@/lib/tenant/public-site";

type Db = SupabaseClient<Database>;

export interface PublicLoyaltyView {
  programName: string;
  pointsLabel: string;
  isActive: boolean;
  rewards: Array<{
    id: string;
    name: string;
    description: string | null;
    pointsCost: number;
    rewardType: string;
  }>;
}

export async function buildLoyaltyPublicUrl(
  tenantSlug: string,
): Promise<string> {
  const base = await getTenantPublicBaseUrl(tenantSlug);
  return `${base}/fidelite`;
}

export async function loadPublicLoyaltyView(
  supabase: Db,
  tenantId: string,
): Promise<PublicLoyaltyView | null> {
  const { data: program } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, points_label, is_active, portal_visible")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program?.is_active || !program.portal_visible) return null;

  const { data: rewards } = await supabase
    .from("inst_loyalty_rewards")
    .select("id, name, description, points_cost, reward_type")
    .eq("tenant_id", tenantId)
    .eq("program_id", program.id)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  return {
    programName: program.name,
    pointsLabel: program.points_label,
    isActive: program.is_active,
    rewards: (rewards ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.points_cost,
      rewardType: r.reward_type,
    })),
  };
}
