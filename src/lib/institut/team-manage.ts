import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import {
  hasInstitutPermission,
  institutCapabilities,
  type InstitutPermissionHolder,
  type TeamCapabilities,
} from "@/lib/institut/permissions";
import {
  fetchStaffWithAccess,
  fetchTenantRoles,
  type StaffWithAccess,
  type TenantRole,
} from "@/lib/institut/team-access";
import { logInstitutAudit, type TeamAuditActor } from "@/lib/institut/team-audit";
import {
  generateTempPassword,
  provisionStaffAccount,
} from "@/lib/institut/team-provision";

type Db = SupabaseClient<Database>;

export type TeamManageError = { ok: false; error: string };
export type TeamManageOk<T extends object = object> = { ok: true } & T;
export type TeamManageResult<T extends object = object> =
  | TeamManageOk<T>
  | TeamManageError;

async function serviceClient(): Promise<Db> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  return createServiceClient();
}

function actorFromHolder(
  holder: InstitutPermissionHolder & TeamAuditActor,
): TeamAuditActor {
  return holder;
}

export async function loadMobileTeamSnapshot(
  supabase: Db,
  tenantId: string,
  holder: InstitutPermissionHolder,
): Promise<{
  items: StaffWithAccess[];
  roles: TenantRole[];
  capabilities: TeamCapabilities;
}> {
  const [items, roles] = await Promise.all([
    fetchStaffWithAccess(supabase, tenantId),
    fetchTenantRoles(supabase, tenantId),
  ]);
  return {
    items,
    roles,
    capabilities: institutCapabilities(holder),
  };
}

export async function createStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: { fullName: string; email?: string | null; color?: string | null },
): Promise<TeamManageResult<{ staffId: string }>> {
  if (!hasInstitutPermission(actor, "team", "write")) {
    return { ok: false, error: "forbidden" };
  }
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "name_required" };
  try {
    await assertQuota(actor.tenant.id, "staff");
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false, error: "quota_exceeded" };
    throw e;
  }
  const { data, error } = await supabase
    .from("inst_staff")
    .insert({
      tenant_id: actor.tenant.id,
      full_name: fullName,
      email: input.email?.trim() || null,
      color: input.color?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "create_failed" };
  await logInstitutAudit(supabase, actorFromHolder(actor), {
    action: "staff.created",
    resourceType: "staff",
    resourceId: data.id,
    metadata: { full_name: fullName },
  });
  return { ok: true, staffId: data.id };
}

export async function updateStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: {
    staffId: string;
    fullName: string;
    email?: string | null;
    color?: string | null;
    tenantRoleId?: string | null;
  },
): Promise<TeamManageResult> {
  if (!hasInstitutPermission(actor, "team", "write")) {
    return { ok: false, error: "forbidden" };
  }
  const fullName = input.fullName.trim();
  if (!input.staffId || !fullName) return { ok: false, error: "missing_fields" };

  const { data: staff, error: fetchErr } = await supabase
    .from("inst_staff")
    .select("id, user_id, email")
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!staff) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("inst_staff")
    .update({
      full_name: fullName,
      email: input.email?.trim() || null,
      color: input.color?.trim() || null,
    })
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId);
  if (error) return { ok: false, error: error.message };

  if (input.tenantRoleId) {
    if (!hasInstitutPermission(actor, "team.manage_roles", "write")) {
      return { ok: false, error: "role_forbidden" };
    }
    let membershipClient = supabase;
    try {
      membershipClient = await serviceClient();
    } catch {
      membershipClient = supabase;
    }
    if (staff.user_id) {
      await membershipClient
        .from("memberships")
        .update({ tenant_role_id: input.tenantRoleId })
        .eq("tenant_id", actor.tenant.id)
        .eq("user_id", staff.user_id);
    } else {
      await supabase
        .from("team_invitations")
        .update({ tenant_role_id: input.tenantRoleId })
        .eq("tenant_id", actor.tenant.id)
        .eq("staff_id", input.staffId)
        .eq("status", "pending");
    }
  }

  await logInstitutAudit(supabase, actor, {
    action: "staff.updated",
    resourceType: "staff",
    resourceId: input.staffId,
    metadata: { full_name: fullName, tenant_role_id: input.tenantRoleId ?? null },
  });
  return { ok: true };
}

export async function activateStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: {
    staffId: string;
    email: string;
    tenantRoleId?: string | null;
    password?: string | null;
  },
): Promise<TeamManageResult<{ temporaryPassword: string }>> {
  if (!hasInstitutPermission(actor, "team.manage_access", "write")) {
    return { ok: false, error: "forbidden" };
  }
  const email = input.email.trim().toLowerCase();
  if (!input.staffId) return { ok: false, error: "missing_fields" };
  if (!email) return { ok: false, error: "email_required" };
  if (input.password && input.password.length < 8) {
    return { ok: false, error: "password_min" };
  }

  const { data: staff } = await supabase
    .from("inst_staff")
    .select("id, full_name, user_id")
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId)
    .maybeSingle();
  if (!staff) return { ok: false, error: "not_found" };
  if (staff.user_id) return { ok: false, error: "already_active" };

  let service: Db;
  try {
    service = await serviceClient();
  } catch {
    return { ok: false, error: "server_config" };
  }

  const temporaryPassword =
    input.password && input.password.length >= 8
      ? input.password
      : generateTempPassword();
  const result = await provisionStaffAccount(service, {
    tenantId: actor.tenant.id,
    email,
    password: temporaryPassword,
    fullName: staff.full_name,
    staffId: input.staffId,
    tenantRoleId: input.tenantRoleId ?? null,
    updatePassword: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "account_create_failed"
          ? "account_create_failed"
          : result.error,
    };
  }

  await logInstitutAudit(supabase, actor, {
    action: "staff.activated",
    resourceType: "staff",
    resourceId: input.staffId,
    metadata: { email, full_name: staff.full_name },
  });
  return { ok: true, temporaryPassword };
}

export async function resetStaffRecordPassword(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: { staffId: string; password?: string | null },
): Promise<TeamManageResult<{ temporaryPassword: string }>> {
  if (!hasInstitutPermission(actor, "team.manage_access", "write")) {
    return { ok: false, error: "forbidden" };
  }
  if (!input.staffId) return { ok: false, error: "missing_fields" };
  if (input.password && input.password.length < 8) {
    return { ok: false, error: "password_min" };
  }

  const { data: staff } = await supabase
    .from("inst_staff")
    .select("id, user_id, full_name")
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId)
    .maybeSingle();
  if (!staff?.user_id) return { ok: false, error: "no_account" };

  let service: Db;
  try {
    service = await serviceClient();
  } catch {
    return { ok: false, error: "server_config" };
  }

  const temporaryPassword =
    input.password && input.password.length >= 8
      ? input.password
      : generateTempPassword();
  const { error } = await service.auth.admin.updateUserById(staff.user_id, {
    password: temporaryPassword,
  });
  if (error) return { ok: false, error: error.message };

  await logInstitutAudit(supabase, actor, {
    action: "staff.password_reset",
    resourceType: "staff",
    resourceId: input.staffId,
    metadata: { full_name: staff.full_name },
  });
  return { ok: true, temporaryPassword };
}

export async function inviteStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: { email: string; staffId?: string | null; tenantRoleId?: string | null },
): Promise<TeamManageResult> {
  if (!hasInstitutPermission(actor, "team.manage_access", "write")) {
    return { ok: false, error: "forbidden" };
  }
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "missing_fields" };

  const { data: existingPending } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("tenant_id", actor.tenant.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending) return { ok: false, error: "invite_pending" };

  const token =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase.from("team_invitations").insert({
    tenant_id: actor.tenant.id,
    email,
    staff_id: input.staffId ?? null,
    tenant_role_id: input.tenantRoleId ?? null,
    membership_role: "staff",
    invited_by: actor.userId,
    token,
  });
  if (error) return { ok: false, error: error.message };

  await logInstitutAudit(supabase, actor, {
    action: "staff.invited",
    resourceType: "invitation",
    metadata: { email, staff_id: input.staffId ?? null },
  });
  return { ok: true };
}

export async function archiveStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  input: { staffId: string; revokeAccess?: boolean },
): Promise<TeamManageResult> {
  if (!hasInstitutPermission(actor, "team.manage_access", "write")) {
    return { ok: false, error: "forbidden" };
  }
  if (!input.staffId) return { ok: false, error: "missing_fields" };

  const { data: staff } = await supabase
    .from("inst_staff")
    .select("id, user_id")
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId)
    .maybeSingle();
  if (!staff) return { ok: false, error: "not_found" };

  if (input.revokeAccess && staff.user_id) {
    try {
      const service = await serviceClient();
      await service
        .from("memberships")
        .delete()
        .eq("tenant_id", actor.tenant.id)
        .eq("user_id", staff.user_id);
    } catch {
      await supabase
        .from("memberships")
        .delete()
        .eq("tenant_id", actor.tenant.id)
        .eq("user_id", staff.user_id);
    }
    await supabase
      .from("team_invitations")
      .update({ status: "revoked" })
      .eq("tenant_id", actor.tenant.id)
      .eq("staff_id", input.staffId)
      .eq("status", "pending");
  }

  const { error } = await supabase
    .from("inst_staff")
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq("tenant_id", actor.tenant.id)
    .eq("id", input.staffId);
  if (error) return { ok: false, error: error.message };

  await logInstitutAudit(supabase, actor, {
    action: "staff.archived",
    resourceType: "staff",
    resourceId: input.staffId,
    metadata: { revoke_access: Boolean(input.revokeAccess) },
  });
  return { ok: true };
}

export async function restoreStaffRecord(
  supabase: Db,
  actor: TeamAuditActor & InstitutPermissionHolder,
  staffId: string,
): Promise<TeamManageResult> {
  if (!hasInstitutPermission(actor, "team.manage_access", "write")) {
    return { ok: false, error: "forbidden" };
  }
  if (!staffId) return { ok: false, error: "missing_fields" };
  const { error } = await supabase
    .from("inst_staff")
    .update({ is_active: true, archived_at: null })
    .eq("tenant_id", actor.tenant.id)
    .eq("id", staffId);
  if (error) return { ok: false, error: error.message };
  await logInstitutAudit(supabase, actor, {
    action: "staff.restored",
    resourceType: "staff",
    resourceId: staffId,
  });
  return { ok: true };
}

export function teamManageHttpStatus(error: string): number {
  if (error === "forbidden" || error === "role_forbidden") return 403;
  if (error === "not_found") return 404;
  return 400;
}

export function teamManageMessage(error: string): string {
  switch (error) {
    case "forbidden":
    case "role_forbidden":
      return "Action non autorisée.";
    case "not_found":
      return "Membre introuvable.";
    case "name_required":
      return "Le nom est requis.";
    case "missing_fields":
      return "Champs manquants.";
    case "email_required":
      return "L’email est requis.";
    case "password_min":
      return "Le mot de passe doit faire au moins 8 caractères.";
    case "already_active":
      return "Ce compte est déjà actif.";
    case "no_account":
      return "Ce membre n’a pas encore de compte.";
    case "invite_pending":
      return "Une invitation est déjà en attente pour cet email.";
    case "quota_exceeded":
      return "Quota d’équipe atteint.";
    case "server_config":
      return "Configuration serveur incomplète.";
    case "account_create_failed":
      return "Impossible de créer le compte.";
    default:
      return error;
  }
}
