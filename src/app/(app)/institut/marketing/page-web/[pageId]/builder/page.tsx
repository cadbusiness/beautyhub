import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadSitePageForBuilder } from "../../site-actions";
import { SitePageBuilder } from "../../site-page-builder";
import type { PublicService } from "@/app/(public)/reserver/actions";
import type { FormattedOpeningDay } from "@/components/site/site-page-renderer";
import {
  fetchPublicOpeningHours,
  formatTimeLabel,
  groupOpeningHoursByWeekday,
  weekdayMessageKey,
} from "@/lib/institut/opening-hours";

async function loadScheduleDays(tenantId: string): Promise<FormattedOpeningDay[]> {
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

export default async function SitePageBuilderPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const session = await requireModule("institut");
  const { pageId } = await params;
  const page = await loadSitePageForBuilder(pageId);
  if (!page) notFound();

  const supabase = await createClient();
  const [{ data: services }, scheduleDays] = await Promise.all([
    supabase.rpc("get_public_services", { p_tenant_id: session.tenant.id }),
    loadScheduleDays(session.tenant.id),
  ]);

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-7rem)] flex-col lg:-mx-6">
      <SitePageBuilder
        page={page}
        previewServices={(services ?? []) as PublicService[]}
        scheduleDays={scheduleDays}
      />
    </div>
  );
}
