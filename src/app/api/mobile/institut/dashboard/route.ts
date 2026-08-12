import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { fetchDashboardSnapshot } from "@/lib/institut/dashboard-stats";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const snapshot = await fetchDashboardSnapshot(
      session.supabase,
      session.tenant.id,
      "week",
      "fr",
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
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
