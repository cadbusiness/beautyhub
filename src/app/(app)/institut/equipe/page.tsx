import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EquipeManager } from "./equipe-manager";

export default async function EquipePage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const pastCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [staffRes, resourcesRes, schedulesRes, timeOffRes] = await Promise.all([
    supabase
      .from("inst_staff")
      .select("id, full_name, email, color, is_active, schedule_id")
      .eq("tenant_id", tenantId)
      .order("full_name"),
    supabase
      .from("inst_resources")
      .select("id, name, is_active, schedule_id")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("inst_schedules")
      .select(
        "id, name, is_default, blocks:inst_schedule_blocks(weekday, start_time, end_time)",
      )
      .eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("inst_time_off")
      .select(
        "id, starts_at, ends_at, reason, staff_id, resource_id, staff:inst_staff(full_name), resource:inst_resources(name)",
      )
      .eq("tenant_id", tenantId)
      .gte("ends_at", pastCutoff)
      .order("starts_at"),
  ]);

  const schedules = (schedulesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    is_default: s.is_default,
    blocks: (s.blocks ?? []).map((b) => ({
      weekday: b.weekday,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
  }));

  return (
    <EquipeManager
      staff={staffRes.data ?? []}
      resources={resourcesRes.data ?? []}
      schedules={schedules}
      timeOffs={timeOffRes.data ?? []}
    />
  );
}
