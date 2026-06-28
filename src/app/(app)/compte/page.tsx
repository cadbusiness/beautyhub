import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamProfile } from "@/lib/auth/profile";
import { Card } from "@/components/ui/card";
import { AccountProfileForm } from "./account-profile-form";

export default async function CompteProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, t] = await Promise.all([getTeamProfile(), getTranslations("account.profile")]);

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-medium text-slate-900">{t("sectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("sectionDescription")}</p>
      </div>
      <AccountProfileForm
        email={user.email ?? ""}
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
      />
    </Card>
  );
}
