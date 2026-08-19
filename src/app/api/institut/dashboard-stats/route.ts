import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantConnectionStatus } from "@/lib/connections";
import { getAnalyticsSettings } from "@/lib/institut/analytics-settings";
import {
  fetchDashboardSnapshot,
  parseDashboardPeriod,
  parseSalesChannel,
} from "@/lib/institut/dashboard-stats";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { getLocale } from "next-intl/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = parseDashboardPeriod(params.get("period"));
  const channel = parseSalesChannel(params.get("channel"));

  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const locale = await getLocale();
    const [analyticsSettings, woo] = await Promise.all([
      getAnalyticsSettings(supabase, session.tenant.id),
      getTenantConnectionStatus(session.tenant.id, WOO_PROVIDER),
    ]);

    const snapshot = await fetchDashboardSnapshot(
      supabase,
      session.tenant.id,
      period,
      locale,
      {
        channel,
        includeWooSales: analyticsSettings.include_woo_sales,
        wooConnected: woo?.status === "connected",
      },
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[dashboard-stats]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
