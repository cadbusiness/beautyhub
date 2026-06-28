import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EquipeManager } from "./equipe-manager";
import { WorkingHoursForm } from "./working-hours-form";

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
    <div className="space-y-6">
      <EquipeManager staff={staffRes.data ?? []} resources={resourcesRes.data ?? []} />

      <Card>
        <p className="mb-3 text-sm font-medium text-slate-900">Horaires d&apos;ouverture</p>
        <WorkingHoursForm hours={hoursRes.data ?? []} />
      </Card>
    </div>
  );
}
