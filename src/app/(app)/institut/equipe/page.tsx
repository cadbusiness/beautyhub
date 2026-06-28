import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EquipeManager } from "./equipe-manager";
import { WorkingHoursForm } from "./working-hours-form";
import { SectionTitle } from "@/components/ui/section-title";

export default async function EquipePage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [staffRes, resourcesRes, hoursRes] = await Promise.all([
    supabase
      .from("inst_staff")
      .select("id, full_name, email, color, is_active")
      .eq("tenant_id", tenantId)
      .order("full_name"),
    supabase
      .from("inst_resources")
      .select("id, name, is_active")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("inst_working_hours")
      .select("weekday, start_time, end_time")
      .eq("tenant_id", tenantId)
      .is("staff_id", null)
      .order("weekday"),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Equipe"
        description="Personnel, cabines et horaires d'ouverture de l'institut."
      />

      <EquipeManager staff={staffRes.data ?? []} resources={resourcesRes.data ?? []} />

      <section className="space-y-4">
        <SectionTitle>Horaires d&apos;ouverture (institut)</SectionTitle>
        <Card>
          <WorkingHoursForm hours={hoursRes.data ?? []} />
        </Card>
      </section>
    </div>
  );
}
