"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@/lib/supabase/service";
import { provisionStaffAccount } from "@/lib/institut/team-provision";

export interface InviteResult {
  error?: string;
  ok?: boolean;
}

export async function acceptTeamInvitation(
  _prev: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const t = await getTranslations("institut.actions");
  const token = String(formData.get("token") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!token || !fullName || !password || password.length < 8) {
    return { error: t("allFieldsRequired") };
  }

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return { error: t("serverConfigIncomplete") };
  }

  const { data: invitation } = await db
    .from("team_invitations")
    .select("id, tenant_id, staff_id, membership_role, tenant_role_id, status, expires_at, email")
    .eq("token", token)
    .maybeSingle();

  if (!invitation || invitation.status !== "pending") {
    return { error: t("teamInviteInvalid") };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: t("teamInviteExpired") };
  }
  if (invitation.email.toLowerCase() !== email) {
    return { error: t("invalidCredentials") };
  }

  const result = await provisionStaffAccount(db, {
    tenantId: invitation.tenant_id,
    email,
    password,
    fullName,
    staffId: invitation.staff_id,
    tenantRoleId: invitation.tenant_role_id,
    membershipRole:
      invitation.membership_role === "tenant_owner" || invitation.membership_role === "coach"
        ? invitation.membership_role
        : "staff",
    updatePassword: false,
    invitationId: invitation.id,
  });

  if (!result.ok) {
    return { error: result.error === "account_create_failed" ? t("accountCreateError") : result.error };
  }

  redirect("/login?joined=1");
}
