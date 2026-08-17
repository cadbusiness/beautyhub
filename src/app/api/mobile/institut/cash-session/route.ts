import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { getPosSessionSummary, serializeCashSession } from "@/lib/institut/pos-session";

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
      session: summary ? serializeCashSession(summary) : null,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
