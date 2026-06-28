import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamSession } from "@/lib/auth/team-session";
import { getTeamProfile } from "@/lib/auth/profile";
import { Card } from "@/components/ui/card";
import { AccountProfileForm } from "./account-profile-form";
import { AccountPasswordForm } from "./account-password-form";

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, session, t, tRoles] = await Promise.all([
    getTeamProfile(),
    getTeamSession(),
    getTranslations("account"),
    getTranslations("roles"),
  ]);

  const knownRoles = [
    "platform_admin",
    "brand_owner",
    "tenant_owner",
    "staff",
    "coach",
  ] as const;
  const roleText =
    session && knownRoles.includes(session.role as (typeof knownRoles)[number])
      ? tRoles(session.role as (typeof knownRoles)[number])
      : (session?.role ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("subtitle")}
          {roleText ? ` · ${roleText}` : ""}
        </p>
      </div>

      <Card className="max-w-xl space-y-4">
        <div>
          <h2 className="font-medium text-slate-900">{t("profile.sectionTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("profile.sectionDescription")}</p>
        </div>
        <AccountProfileForm
          email={user.email ?? ""}
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone ?? ""}
        />
      </Card>

      <Card className="max-w-xl space-y-4">
        <div>
          <h2 className="font-medium text-slate-900">{t("password.sectionTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("password.sectionDescription")}</p>
        </div>
        <AccountPasswordForm />
      </Card>
    </div>
  );
}
