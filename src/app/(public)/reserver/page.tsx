import { getTranslations } from "next-intl/server";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import { AppFooter } from "@/components/app-shell/app-footer";
import { BookingWizard } from "./booking-wizard";

export default async function ReserverPage() {
  const t = await getTranslations("public.booking");
  const tenant = await getPublicSiteTenant();
  if (!tenant) return null;

  return (
    <PublicSiteShell tenant={tenant} activePath="/reserver">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle", { name: tenant.name })}</p>
        </div>
        <BookingWizard />
      </div>
      <AppFooter />
    </PublicSiteShell>
  );
}
