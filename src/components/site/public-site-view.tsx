import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppFooter } from "@/components/app-shell/app-footer";
import {
  SitePageRenderer,
  type FormattedOpeningDay,
} from "@/components/site/site-page-renderer";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import type { PublicService } from "@/app/(public)/reserver/actions";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
  weekdayMessageKey,
} from "@/lib/institut/opening-hours";
import type { SiteBlock, SiteTemplateId } from "@/lib/institut/site-pages";
import { normalizeSiteBlocks } from "@/lib/institut/site-pages";
import type { TenantContext } from "@/lib/tenant/context";

async function formatScheduleDays(tenantId: string): Promise<FormattedOpeningDay[]> {
  const supabase = await createClient();
  const rows = await fetchPublicOpeningHours(supabase, tenantId);
  const grouped = groupOpeningHoursByWeekday(rows);
  const tWeek = await getTranslations("weekdays");
  const days: FormattedOpeningDay[] = [];

  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const slots = grouped.get(day);
    if (!slots?.length) continue;
    days.push({
      label: tWeek(weekdayMessageKey(day)),
      ranges: slots
        .map((s) => `${formatTimeLabel(s.start_time)} – ${formatTimeLabel(s.end_time)}`)
        .join(", "),
    });
  }
  return days;
}

export async function PublicSiteView({
  tenant,
  page,
  services,
  activePath = "/",
  compactHero = false,
  children,
}: {
  tenant: TenantContext;
  page: {
    template_id: SiteTemplateId;
    title: string;
    content: SiteBlock[];
    seo_title: string | null;
    seo_description: string | null;
  };
  services: PublicService[];
  activePath?: string;
  compactHero?: boolean;
  children?: React.ReactNode;
}) {
  const branding = tenant.branding as { primaryColor?: string };
  const scheduleDays = await formatScheduleDays(tenant.id);

  return (
    <PublicSiteShell tenant={tenant} activePath={activePath}>
      <SitePageRenderer
        blocks={normalizeSiteBlocks(page.content)}
        templateId={page.template_id}
        services={services}
        scheduleDays={scheduleDays}
        accent={branding.primaryColor ?? "#0f172a"}
        compactHero={compactHero}
      />
      {children}
      <AppFooter />
    </PublicSiteShell>
  );
}
