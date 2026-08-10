import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { getPosSessionSummary } from "@/lib/institut/pos-session";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const summary = await getPosSessionSummary(
      session.supabase,
      session.tenant.id,
    );
    return Response.json({
      session: summary
        ? {
            id: summary.id,
            openedAt: summary.opened_at,
            openingFloatCents: summary.opening_float_cents,
            salesCount: summary.sales_count,
            totalCents: summary.total_cents,
            expectedCashCents: summary.expected_cash_cents,
          }
        : null,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
