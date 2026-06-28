import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("invite");

  let invitation: {
    email: string;
    tenant_name: string;
    role_name: string | null;
  } | null = null;

  try {
    const db = createServiceClient();
    const { data } = await db
      .from("team_invitations")
      .select("email, status, expires_at, tenant_id, tenant_role_id, tenants(name)")
      .eq("token", token)
      .maybeSingle();

    if (!data || data.status !== "pending") notFound();
    if (new Date(data.expires_at) < new Date()) notFound();

    let roleName: string | null = null;
    if (data.tenant_role_id) {
      const { data: role } = await db
        .from("tenant_roles")
        .select("name")
        .eq("id", data.tenant_role_id)
        .maybeSingle();
      roleName = role?.name ?? null;
    }

    const tenant = data.tenants as { name: string } | null;
    invitation = {
      email: data.email,
      tenant_name: tenant?.name ?? "BeautyHub",
      role_name: roleName,
    };
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-600">
        {t("subtitle", {
          institute: invitation.tenant_name,
          role: invitation.role_name ?? t("defaultRole"),
        })}
      </p>
      <AcceptInviteForm token={token} email={invitation.email} />
    </div>
  );
}
