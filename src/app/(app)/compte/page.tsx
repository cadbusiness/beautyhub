import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamSession } from "@/lib/auth/team-session";
import { getTeamProfile, profileDisplayName } from "@/lib/auth/profile";
import { ListPanel } from "@/components/ui/list-panel";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { AccountProfileForm } from "./account-profile-form";
import { AccountPasswordForm } from "./account-password-form";

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, session, locale, t, tRoles] = await Promise.all([
    getTeamProfile(),
    getTeamSession(),
    getLocale(),
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

  const preferredLocale = (profile?.preferred_locale ?? locale) as Locale;

  return (
    <ListPanel>
      <div className="border-b border-slate-200 px-4 py-5 lg:px-6">
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("subtitle")}
          {roleText ? ` · ${roleText}` : ""}
        </p>
      </div>

      <div className="space-y-6 px-4 py-6 lg:px-6">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-medium text-slate-900">{t("profile.sectionTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("profile.sectionDescription")}</p>
          </div>
          <AccountProfileForm
            email={user.email ?? ""}
            fullName={profile?.full_name ?? ""}
            phone={profile?.phone ?? ""}
            preferredLocale={preferredLocale}
          />
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-medium text-slate-900">{t("password.sectionTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("password.sectionDescription")}</p>
          </div>
          <AccountPasswordForm />
        </Card>
      </div>
    </ListPanel>
  );
}
