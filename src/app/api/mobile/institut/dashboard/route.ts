import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { getAnalyticsSettings } from "@/lib/institut/analytics-settings";
import {
  fetchDashboardSnapshot,
  parseSalesChannel,
} from "@/lib/institut/dashboard-stats";
import { WOO_PROVIDER } from "@/lib/woocommerce";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const channel = parseSalesChannel(new URL(request.url).searchParams.get("channel"));
    const [analyticsSettings, wooResult] = await Promise.all([
      getAnalyticsSettings(session.supabase, session.tenant.id),
      session.supabase
        .from("connections")
        .select("status")
        .eq("scope_type", "tenant")
        .eq("scope_id", session.tenant.id)
        .eq("provider", WOO_PROVIDER)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const snapshot = await fetchDashboardSnapshot(
      session.supabase,
      session.tenant.id,
      "week",
      "fr",
      {
        channel,
        includeWooSales: analyticsSettings.include_woo_sales,
        wooConnected: wooResult.data?.status === "connected",
      },
    );

    return Response.json({
      today: snapshot.today,
      week: {
        revenueCents: snapshot.analytics.revenueCents,
        revenueChangePct: snapshot.analytics.revenueChangePct,
        salesCount: snapshot.analytics.salesCount,
        salesChangePct: snapshot.analytics.salesChangePct,
        appointmentsTotal: snapshot.analytics.appointmentsTotal,
        series: snapshot.analytics.series,
      },
      salesChannel: snapshot.salesChannel,
      wooSalesAvailable: snapshot.wooSalesAvailable,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
