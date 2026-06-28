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
  layoutVisualStyle,
  normalizeLayoutId,
} from "@/lib/institut/site-page-layouts";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
  weekdayMessageKey,
} from "@/lib/institut/opening-hours";
import {
  loadPublicSiteShellData,
} from "@/lib/institut/site-settings";

export default async function ReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const t = await getTranslations("public.booking");
  const tNav = await getTranslations("public.site.nav");
  const tenant = await getPublicSiteTenant();
  if (!tenant) return null;

  const { service: initialServiceId } = await searchParams;
  const services = await loadPublicServices();
  const bookingPage = await loadPublicSitePageByType(tenant.id, "booking");

  const supabase = await createClient();
  const [hoursRows, shell] = await Promise.all([
    fetchPublicOpeningHours(supabase, tenant.id),
    loadPublicSiteShellData(supabase, tenant, {
      home: tNav("home"),
      book: tNav("book"),
      account: tNav("account"),
    }),
  ]);

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

  const introBlocks = bookingPage
    ? normalizeSiteBlocks(parseSiteBlocks(bookingPage.content))
    : [];

  const templateId = bookingPage
    ? layoutVisualStyle(normalizeLayoutId("booking", bookingPage.template_id))
    : layoutVisualStyle("booking-guide");

  return (
    <PublicSiteShell shell={shell} activePath="/reserver">
      {introBlocks.length > 0 ? (
        <SitePageRenderer
          blocks={introBlocks}
          templateId={templateId}
          services={services}
          scheduleDays={scheduleDays}
          accent={shell.primaryColor}
          compactHero
        />
      ) : (
        <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-6">
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle", { name: shell.displayName })}</p>
        </div>
      )}

      <div id="booking" className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        {introBlocks.length > 0 ? (
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("wizardTitle")}</h2>
        ) : null}
        <BookingWizard initialServiceId={initialServiceId ?? ""} services={services} />
      </div>
      {!shell.footerText ? <AppFooter /> : null}
    </PublicSiteShell>
  );
}
