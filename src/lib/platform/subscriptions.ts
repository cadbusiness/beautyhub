import { createClient } from "@/lib/supabase/server";
import type { SupportStatus } from "@/lib/platform/support";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export type SubscriptionListRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planId: string | null;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
};

export async function fetchSubscriptionListRows(): Promise<SubscriptionListRow[]> {
  const supabase = await createClient();

  const [{ data: subscriptions }, { data: tenants }, { data: plans }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, tenant_id, plan_id, status, current_period_end")
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name, slug"),
    supabase.from("plans").select("id, name"),
  ]);

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const planById = new Map((plans ?? []).map((p) => [p.id, p.name]));

  return (subscriptions ?? []).map((s) => {
    const tenant = tenantById.get(s.tenant_id);
    return {
      id: s.id,
      tenantId: s.tenant_id,
      tenantName: tenant?.name ?? "—",
      tenantSlug: tenant?.slug ?? "—",
      planId: s.plan_id,
      planName: s.plan_id ? (planById.get(s.plan_id) ?? "—") : "—",
      status: s.status as SubscriptionStatus,
      currentPeriodEnd: s.current_period_end,
    };
  });
}

export type SupportStatusFilter = SupportStatus | "all";
