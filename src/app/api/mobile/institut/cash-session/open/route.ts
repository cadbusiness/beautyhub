import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  getOpenCashSession,
  getPosSessionSummary,
  serializeCashSession,
} from "@/lib/institut/pos-session";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });

    const existing = await getOpenCashSession(
      session.supabase,
      session.tenant.id,
    );
    if (existing) {
      return Response.json(
        { error: "session_already_open", message: "Cash session already open" },
        { status: 409 },
      );
    }

    let openingFloatCents = 0;
    try {
      const body = (await request.json()) as { openingFloatCents?: unknown };
      if (typeof body.openingFloatCents === "number") {
        openingFloatCents = Math.max(0, Math.round(body.openingFloatCents));
      } else if (typeof body.openingFloatCents === "string") {
        const n = Number.parseFloat(body.openingFloatCents.replace(",", "."));
        openingFloatCents = Number.isFinite(n)
          ? Math.max(0, Math.round(n))
          : 0;
      }
    } catch {
      openingFloatCents = 0;
    }

    const { error } = await session.supabase.from("inst_cash_sessions").insert({
      tenant_id: session.tenant.id,
      opening_float_cents: openingFloatCents,
      status: "open",
    });
    if (error) {
      return Response.json(
        { error: "open_failed", message: error.message },
        { status: 500 },
      );
    }

    const summary = await getPosSessionSummary(
      session.supabase,
      session.tenant.id,
    );
    return Response.json({
      ok: true,
      session: summary ? serializeCashSession(summary) : null,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
