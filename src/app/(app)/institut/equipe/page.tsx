import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EquipeManager } from "./equipe-manager";

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
    <EquipeManager
      staff={staffRes.data ?? []}
      resources={resourcesRes.data ?? []}
      hours={hoursRes.data ?? []}
    />
  );
}
