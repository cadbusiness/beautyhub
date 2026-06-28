import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppFooter } from "@/components/app-shell/app-footer";
import {
  SitePageRenderer,
  type FormattedOpeningDay,
} from "@/components/site/site-page-renderer";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import type { PublicService } from "@/lib/public/booking-load";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
  weekdayMessageKey,
} from "@/lib/institut/opening-hours";
import type { SiteBlock, SitePageType } from "@/lib/institut/site-pages";
import { normalizeSiteBlocks } from "@/lib/institut/site-pages";
import { layoutVisualStyle } from "@/lib/institut/site-page-layouts";
import type { TenantContext } from "@/lib/tenant/context";
import { loadPublicSiteShellData } from "@/lib/institut/site-settings";

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
  previewMode = false,
  children,
}: {
  tenant: TenantContext;
  page: {
    page_type: SitePageType;
    layout_id: string;
    title: string;
    content: SiteBlock[];
    seo_title: string | null;
    seo_description: string | null;
  };
  services: PublicService[];
  activePath?: string;
  compactHero?: boolean;
  previewMode?: boolean;
  children?: React.ReactNode;
}) {
  const supabase = await createClient();
  const tNav = await getTranslations("public.site.nav");
  const [shell, scheduleDays] = await Promise.all([
    loadPublicSiteShellData(supabase, tenant, {
      home: tNav("home"),
      book: tNav("book"),
      account: tNav("account"),
    }),
    formatScheduleDays(tenant.id),
  ]);

  return (
    <PublicSiteShell shell={shell} activePath={activePath}>
      <SitePageRenderer
        blocks={normalizeSiteBlocks(page.content)}
        templateId={layoutVisualStyle(page.layout_id)}
        services={services}
        scheduleDays={scheduleDays}
        accent={shell.primaryColor}
        compactHero={compactHero}
      />
      {children}
      {!shell.footerText && !previewMode ? <AppFooter /> : null}
    </PublicSiteShell>
  );
}
