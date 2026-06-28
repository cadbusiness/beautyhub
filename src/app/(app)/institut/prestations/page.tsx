import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { ServicesManager } from "./services-manager";

export default async function PrestationsPage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("inst_services")
    .select(
      "id, name, description, duration_min, price_cents, currency, color, is_active, buffer_before_min, buffer_after_min, min_advance_hours, max_advance_days",
    )
    .eq("tenant_id", session.tenant.id)
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prestations"
        description="Catalogue des services proposes en rendez-vous et en caisse."
      />
      <ServicesManager services={services ?? []} />
    </div>
  );
}
