import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type ServiceDb = SupabaseClient<Database>;

export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type ProvisionStaffAccountInput = {
  tenantId: string;
  email: string;
  password: string;
  fullName: string;
  staffId: string | null;
  tenantRoleId: string | null;
  membershipRole?: "staff" | "tenant_owner" | "coach";
  updatePassword?: boolean;
  invitationId?: string | null;
};

export type ProvisionStaffAccountResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string };

async function findAuthUserByEmail(
  db: ServiceDb,
  email: string,
): Promise<User | null> {
  const admin = db.auth.admin as {
    getUserByEmail?: (e: string) => Promise<{
      data: { user: User | null } | User | null;
      error: { message: string } | null;
    }>;
  };

  if (typeof admin.getUserByEmail === "function") {
    const { data, error } = await admin.getUserByEmail(email);
    if (!error && data) {
      if ("user" in data && data.user) return data.user;
      if ("id" in data) return data as User;
    }
  }

  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

/** Crée ou relie un compte Auth + membership + fiche personnel (service role). */
export async function provisionStaffAccount(
  db: ServiceDb,
  input: ProvisionStaffAccountInput,
): Promise<ProvisionStaffAccountResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(db, email);

  let userId: string;
  let created = false;

  if (existing) {
    userId = existing.id;
    if (input.updatePassword !== false) {
      const { error } = await db.auth.admin.updateUserById(userId, {
        password: input.password,
        email_confirm: true,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const { data: createdUser, error: createErr } = await db.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (createErr || !createdUser.user) {
      return { ok: false, error: createErr?.message ?? "account_create_failed" };
    }
    userId = createdUser.user.id;
    created = true;
  }

  await db.from("team_profiles").upsert({
    user_id: userId,
    full_name: input.fullName,
  });

  const { data: existingMembership } = await db
    .from("memberships")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMembership) {
    const { error: memErr } = await db.from("memberships").insert({
      tenant_id: input.tenantId,
      user_id: userId,
      role: input.membershipRole ?? "staff",
      tenant_role_id: input.tenantRoleId,
    });
    if (memErr) return { ok: false, error: memErr.message };
  } else if (input.tenantRoleId) {
    await db
      .from("memberships")
      .update({ tenant_role_id: input.tenantRoleId })
      .eq("id", existingMembership.id);
  }

  if (input.staffId) {
    const { error: staffErr } = await db
      .from("inst_staff")
      .update({ user_id: userId, email })
      .eq("id", input.staffId)
      .eq("tenant_id", input.tenantId);
    if (staffErr) return { ok: false, error: staffErr.message };
  }

  if (input.invitationId) {
    await db
      .from("team_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", input.invitationId);
  } else {
    let query = db
      .from("team_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("tenant_id", input.tenantId)
      .eq("status", "pending");
    if (input.staffId) {
      query = query.or(`staff_id.eq.${input.staffId},email.eq.${email}`);
    } else {
      query = query.eq("email", email);
    }
    await query;
  }

  return { ok: true, userId, created };
}
