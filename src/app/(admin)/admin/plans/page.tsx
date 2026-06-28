import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchActiveModulesForSelect } from "@/lib/platform/modules";
import { createClient } from "@/lib/supabase/server";
import { PlansManager } from "./plans-manager";

export default async function PlansPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: plans }, modules] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, price_cents, interval, is_active, modules")
      .is("brand_id", null)
      .order("price_cents"),
    fetchActiveModulesForSelect(),
  ]);

  return <PlansManager plans={plans ?? []} modules={modules} />;
}
