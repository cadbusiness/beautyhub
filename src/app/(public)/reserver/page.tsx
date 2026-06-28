import { getTranslations } from "next-intl/server";
import { getTenantContext } from "@/lib/tenant/context";
import { BookingWizard } from "./booking-wizard";

export default async function ReserverPage() {
  const t = await getTranslations("public.booking");
  const tenant = await getTenantContext();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("subtitle", { name: tenant?.name ?? "" })}</p>
      </div>
      <BookingWizard />
    </div>
  );
}
