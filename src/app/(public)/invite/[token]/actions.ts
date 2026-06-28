"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@/lib/supabase/service";

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

  const { data: existingUsers } = await db.auth.admin.listUsers();
  const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) {
      return { error: createErr?.message ?? t("accountCreateError") };
    }
    userId = created.user.id;
  }

  await db.from("team_profiles").upsert({
    user_id: userId,
    full_name: fullName,
  });

  const { data: existingMembership } = await db
    .from("memberships")
    .select("id")
    .eq("tenant_id", invitation.tenant_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMembership) {
    await db.from("memberships").insert({
      tenant_id: invitation.tenant_id,
      user_id: userId,
      role: invitation.membership_role,
      tenant_role_id: invitation.tenant_role_id,
    });
  }

  if (invitation.staff_id) {
    await db
      .from("inst_staff")
      .update({ user_id: userId })
      .eq("id", invitation.staff_id);
  }

  await db
    .from("team_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  redirect("/login?joined=1");
}
