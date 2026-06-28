import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { AccountPasswordForm } from "../account-password-form";

export default async function CompteSecuritePage() {
  const t = await getTranslations("account.password");

  return (
    <Card className="w-full space-y-5 p-5 shadow-none sm:p-6 lg:p-8">
      <div>
        <h2 className="font-medium text-slate-900">{t("sectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("sectionDescription")}</p>
      </div>
      <AccountPasswordForm />
    </Card>
  );
}
