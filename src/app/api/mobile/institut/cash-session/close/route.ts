import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { closeOpenCashSession } from "@/lib/institut/pos-session";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });

    let countedCashCents = 0;
    let notes: string | null = null;
    let closedAt: string | null = null;
    try {
      const body = (await request.json()) as {
        countedCashCents?: unknown;
        notes?: unknown;
        closedAt?: unknown;
      };
      if (typeof body.countedCashCents === "number") {
        countedCashCents = Math.max(0, Math.round(body.countedCashCents));
      } else if (typeof body.countedCashCents === "string") {
        const n = Number.parseFloat(body.countedCashCents.replace(",", "."));
        countedCashCents = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
      }
      if (typeof body.notes === "string") {
        notes = body.notes.trim() || null;
      }
      if (typeof body.closedAt === "string" && body.closedAt.trim()) {
        closedAt = body.closedAt.trim();
      }
    } catch {
      countedCashCents = 0;
    }

    const result = await closeOpenCashSession(session.supabase, session.tenant.id, {
      countedCashCents,
      notes,
      closedAt,
    });

    return Response.json({
      ok: true,
      reportId: result.reportId,
      reportNumber: result.reportNumber,
      varianceCents: result.varianceCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "close_failed";
    if (message === "no_open_session") {
      return Response.json(
        { error: message, message: "Aucune session ouverte" },
        { status: 409 },
      );
    }
    if (message === "variance_notes_required") {
      return Response.json(
        {
          error: message,
          message: "Un écart de caisse nécessite une note explicative.",
        },
        { status: 400 },
      );
    }
    return mobileErrorResponse(error);
  }
}
