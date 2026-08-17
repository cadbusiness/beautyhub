import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  getPosSessionSummary,
  pauseOpenCashSession,
  serializeCashSession,
} from "@/lib/institut/pos-session";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    await pauseOpenCashSession(session.supabase, session.tenant.id);
    const summary = await getPosSessionSummary(
      session.supabase,
      session.tenant.id,
    );
    return Response.json({
      ok: true,
      session: summary ? serializeCashSession(summary) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "pause_failed";
    if (message === "no_open_session") {
      return Response.json(
        { error: message, message: "Aucune session ouverte" },
        { status: 409 },
      );
    }
    return mobileErrorResponse(error);
  }
}
