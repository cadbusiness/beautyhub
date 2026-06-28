import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type PermissionLevel = { read?: boolean; write?: boolean };

export type InstitutPermissions = Record<string, PermissionLevel>;

export const INSTITUT_PERMISSION_SECTIONS = [
  { key: "dashboard", labelKey: "dashboard" },
  { key: "appointments", labelKey: "appointments" },
  { key: "clients", labelKey: "clients" },
  { key: "services", labelKey: "services" },
  { key: "team", labelKey: "team" },
  { key: "pos", labelKey: "pos" },
  { key: "marketing", labelKey: "marketing" },
] as const;

export type TenantRole = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: InstitutPermissions;
  is_system: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  status: string;
  membership_role: string;
  tenant_role_id: string | null;
  tenant_role_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  token: string;
  expires_at: string;
  created_at: string;
};

export type TeamMember = {
  membership_id: string;
  user_id: string;
  role: string;
  tenant_role_id: string | null;
  tenant_role_name: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export type StaffAccessStatus = "active" | "pending" | "none";

export type StaffWithAccess = {
  id: string;
  full_name: string;
  email: string | null;
  color: string | null;
  schedule_id: string | null;
  user_id: string | null;
  access_status: StaffAccessStatus;
  tenant_role_name: string | null;
  invitation_id: string | null;
};

export function parsePermissionsJson(raw: unknown): InstitutPermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as InstitutPermissions;
}

export function permissionsFromForm(formData: FormData): InstitutPermissions {
  const perms: InstitutPermissions = {};
  for (const section of INSTITUT_PERMISSION_SECTIONS) {
    const read = formData.get(`perm_${section.key}_read`) === "on";
    const write = formData.get(`perm_${section.key}_write`) === "on";
    if (read || write) {
      perms[section.key] = { read, write };
    }
  }
  if (formData.get("perm_wildcard") === "on") {
    perms["*"] = { read: true, write: true };
  }
  return perms;
}

export function slugifyRoleName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "role";
}

export async function fetchTenantRoles(
  supabase: Db,
  tenantId: string,
): Promise<TenantRole[]> {
  const { data } = await supabase
    .from("tenant_roles")
    .select("id, name, slug, description, permissions, is_system")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    permissions: parsePermissionsJson(r.permissions),
    is_system: r.is_system,
  }));
}

export async function fetchTeamInvitations(
  supabase: Db,
  tenantId: string,
): Promise<TeamInvitation[]> {
  const { data } = await supabase
    .from("team_invitations")
    .select(
      "id, email, status, membership_role, tenant_role_id, staff_id, token, expires_at, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const roleIds = [
    ...new Set(
      (data ?? [])
        .map((i) => i.tenant_role_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffIds = [
    ...new Set(
      (data ?? [])
        .map((i) => i.staff_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [rolesRes, staffRes] = await Promise.all([
    roleIds.length
      ? supabase.from("tenant_roles").select("id, name").in("id", roleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    staffIds.length
      ? supabase.from("inst_staff").select("id, full_name").in("id", staffIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const roleNames = new Map((rolesRes.data ?? []).map((r) => [r.id, r.name]));
  const staffNames = new Map((staffRes.data ?? []).map((s) => [s.id, s.full_name]));

  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    status: i.status,
    membership_role: i.membership_role,
    tenant_role_id: i.tenant_role_id,
    tenant_role_name: i.tenant_role_id ? (roleNames.get(i.tenant_role_id) ?? null) : null,
    staff_id: i.staff_id,
    staff_name: i.staff_id ? (staffNames.get(i.staff_id) ?? null) : null,
    token: i.token,
    expires_at: i.expires_at,
    created_at: i.created_at,
  }));
}

export async function fetchTeamMembers(
  supabase: Db,
  tenantId: string,
): Promise<TeamMember[]> {
  const { data } = await supabase
    .from("memberships")
    .select("id, user_id, role, tenant_role_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at");

  const userIds = (data ?? []).map((m) => m.user_id);
  const roleIds = [
    ...new Set(
      (data ?? [])
        .map((m) => m.tenant_role_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [profilesRes, rolesRes] = await Promise.all([
    userIds.length
      ? supabase
          .from("team_profiles")
          .select("user_id, full_name")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string | null }> }),
    roleIds.length
      ? supabase.from("tenant_roles").select("id, name").in("id", roleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]),
  );
  const roleNames = new Map((rolesRes.data ?? []).map((r) => [r.id, r.name]));

  return (data ?? []).map((m) => ({
    membership_id: m.id,
    user_id: m.user_id,
    role: m.role,
    tenant_role_id: m.tenant_role_id,
    tenant_role_name: m.tenant_role_id ? (roleNames.get(m.tenant_role_id) ?? null) : null,
    full_name: profileMap.get(m.user_id) ?? null,
    email: null,
    created_at: m.created_at,
  }));
}

export async function fetchStaffWithAccess(
  supabase: Db,
  tenantId: string,
): Promise<StaffWithAccess[]> {
  const [staffRes, invitations] = await Promise.all([
    supabase
      .from("inst_staff")
      .select("id, full_name, email, color, schedule_id, user_id")
      .eq("tenant_id", tenantId)
      .order("full_name"),
    fetchTeamInvitations(supabase, tenantId),
  ]);

  const pendingByStaffId = new Map<string, TeamInvitation>();
  const pendingByEmail = new Map<string, TeamInvitation>();
  for (const inv of invitations) {
    if (inv.status !== "pending") continue;
    if (inv.staff_id) pendingByStaffId.set(inv.staff_id, inv);
    pendingByEmail.set(inv.email.toLowerCase(), inv);
  }

  const activeUserIds = new Set(
    (staffRes.data ?? []).map((s) => s.user_id).filter(Boolean) as string[],
  );

  const userIds = [...activeUserIds];
  const { data: memberships } = userIds.length
    ? await supabase
        .from("memberships")
        .select("user_id, tenant_role_id")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds)
    : { data: [] as Array<{ user_id: string; tenant_role_id: string | null }> };

  const roleIds = [
    ...new Set(
      [
        ...invitations.map((i) => i.tenant_role_id),
        ...(memberships ?? []).map((m) => m.tenant_role_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: roles } = roleIds.length
    ? await supabase.from("tenant_roles").select("id, name").in("id", roleIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const roleNames = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const membershipRoleByUser = new Map(
    (memberships ?? []).map((m) => [m.user_id, m.tenant_role_id]),
  );

  return (staffRes.data ?? []).map((s) => {
    let access_status: StaffAccessStatus = "none";
    let tenant_role_name: string | null = null;
    let invitation_id: string | null = null;

    if (s.user_id && activeUserIds.has(s.user_id)) {
      access_status = "active";
      const roleId = membershipRoleByUser.get(s.user_id);
      tenant_role_name = roleId ? (roleNames.get(roleId) ?? null) : null;
    } else {
      const inv =
        pendingByStaffId.get(s.id) ??
        (s.email ? pendingByEmail.get(s.email.toLowerCase()) : undefined);
      if (inv) {
        access_status = "pending";
        invitation_id = inv.id;
        tenant_role_name = inv.tenant_role_name;
      }
    }

    return {
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      color: s.color,
      schedule_id: s.schedule_id,
      user_id: s.user_id,
      access_status,
      tenant_role_name,
      invitation_id,
    };
  });
}
