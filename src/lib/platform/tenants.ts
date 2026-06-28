import { createClient } from "@/lib/supabase/server";

export type TenantListRow = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  brandName: string;
  planName: string;
  subscriptionStatus: string | null;
  activeModules: number;
};

export async function fetchTenantListRows(): Promise<TenantListRow[]> {
  const supabase = await createClient();

  const [
    { data: tenants },
    { data: subscriptions },
    { data: plans },
    { data: tenantModules },
    { data: brands },
  ] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, brand_id").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("tenant_id, plan_id, status"),
    supabase.from("plans").select("id, name"),
    supabase.from("tenant_modules").select("tenant_id, enabled"),
    supabase.from("brands").select("id, name"),
  ]);

  const planById = new Map((plans ?? []).map((p) => [p.id, p.name]));
  const brandById = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const subByTenant = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, { planId: s.plan_id, status: s.status }]),
  );

  const moduleCountByTenant = new Map<string, number>();
  for (const tm of tenantModules ?? []) {
    if (!tm.enabled) continue;
    moduleCountByTenant.set(tm.tenant_id, (moduleCountByTenant.get(tm.tenant_id) ?? 0) + 1);
  }

  return (tenants ?? []).map((t) => {
    const sub = subByTenant.get(t.id);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      brandId: t.brand_id,
      brandName: brandById.get(t.brand_id) ?? "—",
      planName: sub?.planId ? (planById.get(sub.planId) ?? "—") : "—",
      subscriptionStatus: sub?.status ?? null,
      activeModules: moduleCountByTenant.get(t.id) ?? 0,
    };
  });
}

export async function fetchActivePlansForSelect(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("id, name")
    .eq("is_active", true)
    .order("price_cents");
  return data ?? [];
}
