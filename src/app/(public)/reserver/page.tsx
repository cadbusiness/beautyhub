import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppFooter } from "@/components/app-shell/app-footer";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import { SitePageRenderer } from "@/components/site/site-page-renderer";
import { loadPublicServices } from "@/app/(public)/reserver/actions";
import { BookingWizard } from "./booking-wizard";
import {
  getPublicSiteTenant,
  loadPublicSitePageByType,
} from "@/lib/tenant/public-site";
import { normalizeSiteBlocks, parseSiteBlocks } from "@/lib/institut/site-pages";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
  weekdayMessageKey,
} from "@/lib/institut/opening-hours";

export default async function ReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const t = await getTranslations("public.booking");
  const tenant = await getPublicSiteTenant();
  if (!tenant) return null;

  const { service: initialServiceId } = await searchParams;
  const services = await loadPublicServices();
  const bookingPage = await loadPublicSitePageByType(tenant.id, "booking");

  const supabase = await createClient();
  const hoursRows = await fetchPublicOpeningHours(supabase, tenant.id);
  const grouped = groupOpeningHoursByWeekday(hoursRows);
  const tWeek = await getTranslations("weekdays");
  const scheduleDays = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const slots = grouped.get(day);
    if (!slots?.length) continue;
    scheduleDays.push({
      label: tWeek(weekdayMessageKey(day)),
      ranges: slots
        .map((s) => `${formatTimeLabel(s.start_time)} – ${formatTimeLabel(s.end_time)}`)
        .join(", "),
    });
  }

  const branding = tenant.branding as { primaryColor?: string };
  const introBlocks = bookingPage
    ? normalizeSiteBlocks(parseSiteBlocks(bookingPage.content))
    : [];

  return (
    <PublicSiteShell tenant={tenant} activePath="/reserver">
      {introBlocks.length > 0 ? (
        <SitePageRenderer
          blocks={introBlocks}
          templateId={(bookingPage!.template_id as "elegant" | "modern") ?? "elegant"}
          services={services}
          scheduleDays={scheduleDays}
          accent={branding.primaryColor ?? "#0f172a"}
          compactHero
        />
      ) : (
        <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-6">
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle", { name: tenant.name })}</p>
        </div>
      )}

      <div id="booking" className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        {introBlocks.length > 0 ? (
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("wizardTitle")}</h2>
        ) : null}
        <BookingWizard initialServiceId={initialServiceId ?? ""} />
      </div>
      <AppFooter />
    </PublicSiteShell>
  );
}
