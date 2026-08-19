import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { getAnalyticsSettings } from "@/lib/institut/analytics-settings";
import {
  fetchDashboardSnapshot,
  parseDashboardPeriod,
  parseSalesChannel,
} from "@/lib/institut/dashboard-stats";
import { WOO_PROVIDER } from "@/lib/woocommerce";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const params = new URL(request.url).searchParams;
    const channel = parseSalesChannel(params.get("channel"));
    const period = parseDashboardPeriod(params.get("period"));
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
      period,
      "fr",
      {
        channel,
        includeWooSales: analyticsSettings.include_woo_sales,
        wooConnected: wooResult.data?.status === "connected",
      },
    );

    return Response.json({
      today: snapshot.today,
      analytics: snapshot.analytics,
      week: {
        period: snapshot.analytics.period,
        revenueCents: snapshot.analytics.revenueCents,
        revenueChangePct: snapshot.analytics.revenueChangePct,
        salesCount: snapshot.analytics.salesCount,
        salesChangePct: snapshot.analytics.salesChangePct,
        appointmentsTotal: snapshot.analytics.appointmentsTotal,
        appointmentsChangePct: snapshot.analytics.appointmentsChangePct,
        appointmentsCancelled: snapshot.analytics.appointmentsCancelled,
        appointmentsCompleted: snapshot.analytics.appointmentsCompleted,
        appointmentsNoShow: snapshot.analytics.appointmentsNoShow,
        cancellationRate: snapshot.analytics.cancellationRate,
        series: snapshot.analytics.series,
      },
      salesChannel: snapshot.salesChannel,
      wooSalesAvailable: snapshot.wooSalesAvailable,
      byStaff: snapshot.byStaff,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
