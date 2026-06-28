import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { TenantsManager } from "./tenants-manager";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subscriptions: { status: string; plans: { name: string } | null } | null;
  tenant_modules: { enabled: boolean }[];
}

export default async function TenantsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: tenants }, { data: plans }] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "id, name, slug, subscriptions(status, plans(name)), tenant_modules(enabled)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name").eq("is_active", true).order("price_cents"),
  ]);

  const rows = ((tenants ?? []) as unknown as TenantRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    planName: t.subscriptions?.plans?.name ?? "—",
    activeModules: t.tenant_modules.filter((m) => m.enabled).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Instituts" />
      <TenantsManager tenants={rows} plans={plans ?? []} />
    </div>
  );
}
