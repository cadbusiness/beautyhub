import { createClient } from "@/lib/supabase/server";

export class QuotaExceededError extends Error {
  constructor(
    public readonly key: string,
    public readonly limit: number,
  ) {
    super(
      `Limite atteinte pour "${key}" (max ${limit}). Passez a la formule superieure.`,
    );
    this.name = "QuotaExceededError";
  }
}

/** Limite definie par la formule active du tenant. null/absent = illimite. */
async function getLimit(
  tenantId: string,
  key: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plans(limits)")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const limits = (data?.plans as { limits?: Record<string, unknown> } | null)
    ?.limits;
  if (!limits || !(key in limits)) return null;
  const value = limits[key];
  return typeof value === "number" ? value : null;
}

/** Usage courant pour une cle de quota. */
async function getUsage(tenantId: string, key: string): Promise<number> {
  const supabase = await createClient();
  switch (key) {
    case "clients": {
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      return count ?? 0;
    }
    case "staff": {
      const { count } = await supabase
        .from("inst_staff")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      return count ?? 0;
    }
    case "appointments_per_month": {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("inst_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", start.toISOString())
        .neq("status", "cancelled");
      return count ?? 0;
    }
    default:
      return 0;
  }
}

/**
 * Verifie qu'une action reste dans le quota de la formule. Leve QuotaExceededError sinon.
 * A appeler cote serveur AVANT toute creation soumise a quota.
 */
export async function assertQuota(
  tenantId: string,
  key: string,
  increment = 1,
): Promise<void> {
  const limit = await getLimit(tenantId, key);
  if (limit === null) return; // illimite
  const usage = await getUsage(tenantId, key);
  if (usage + increment > limit) {
    throw new QuotaExceededError(key, limit);
  }
}
