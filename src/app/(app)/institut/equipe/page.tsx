import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchStaffWithAccess,
  fetchTeamInvitations,
  fetchTeamMembers,
  fetchTenantRoles,
} from "@/lib/institut/team-access";
import { EquipeManager } from "./equipe-manager";

export default async function EquipePage() {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const pastCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [staff, roles, members, invitations, resourcesRes, schedulesRes, timeOffRes] =
    await Promise.all([
      fetchStaffWithAccess(supabase, tenantId),
      fetchTenantRoles(supabase, tenantId),
      fetchTeamMembers(supabase, tenantId),
      fetchTeamInvitations(supabase, tenantId),
      supabase
        .from("inst_resources")
        .select("id, name, kind, is_active, schedule_id")
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

  const archivedStaff = staff.filter((s) => !s.is_active);
  const archivedIds = archivedStaff.map((s) => s.id);

  const [apptRefsRes, saleRefsRes] = archivedIds.length
    ? await Promise.all([
        supabase
          .from("inst_appointments")
          .select("staff_id")
          .eq("tenant_id", tenantId)
          .in("staff_id", archivedIds),
        supabase
          .from("inst_sales")
          .select("staff_id")
          .eq("tenant_id", tenantId)
          .in("staff_id", archivedIds),
      ])
    : [{ data: [] as Array<{ staff_id: string | null }> }, { data: [] as Array<{ staff_id: string | null }> }];

  const withHistory = new Set<string>();
  for (const row of apptRefsRes.data ?? []) {
    if (row.staff_id) withHistory.add(row.staff_id);
  }
  for (const row of saleRefsRes.data ?? []) {
    if (row.staff_id) withHistory.add(row.staff_id);
  }

  const canHardDeleteByStaffId: Record<string, boolean> = {};
  for (const s of archivedStaff) {
    canHardDeleteByStaffId[s.id] = !withHistory.has(s.id);
  }

  return (
    <EquipeManager
      staff={staff}
      roles={roles}
      members={members}
      invitations={invitations}
      resources={resourcesRes.data ?? []}
      schedules={schedules}
      timeOffs={timeOffRes.data ?? []}
      canHardDeleteByStaffId={canHardDeleteByStaffId}
    />
  );
}
