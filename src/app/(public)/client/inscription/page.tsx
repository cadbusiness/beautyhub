import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

export default async function ClientRegisterPage() {
  const t = await getTranslations("public.client.register");

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-600">{t("disabledDescription")}</p>
      <p className="text-center text-sm text-slate-500">
        <Link href="/client/login" className="underline">
          {t("hasAccount")}
        </Link>
      </p>
    </Card>
  );
}
