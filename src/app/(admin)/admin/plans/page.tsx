import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PlansManager } from "./plans-manager";

export default async function PlansPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: plans }, { data: modules }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, price_cents, interval, is_active, modules")
      .is("brand_id", null)
      .order("price_cents"),
    supabase.from("modules").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Formules" />
      <PlansManager plans={plans ?? []} modules={modules ?? []} />
    </div>
  );
}
