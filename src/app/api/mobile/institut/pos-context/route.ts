import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  loadMobilePosContext,
  serializeMobilePosContext,
} from "@/lib/institut/pos-mobile-context";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const ctx = await loadMobilePosContext(session.supabase, session.tenant.id);
    return Response.json(serializeMobilePosContext(ctx));
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
