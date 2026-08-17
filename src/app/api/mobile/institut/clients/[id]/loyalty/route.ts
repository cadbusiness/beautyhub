import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  assignClientLoyaltyProgram,
  loadClientLoyaltyCard,
  loadClientLoyaltyLedger,
} from "@/lib/institut/client-loyalty";
import { serializeLoyaltyCard } from "@/lib/institut/mobile-loyalty-json";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const [card, ledger] = await Promise.all([
      loadClientLoyaltyCard(session.supabase, session.tenant.id, id),
      loadClientLoyaltyLedger(session.supabase, session.tenant.id, id),
    ]);
    return Response.json({
      card: serializeLoyaltyCard(card),
      ledger,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

const patchSchema = z.object({
  loyaltyProgramId: z.string().uuid().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Programme invalide." },
        { status: 400 },
      );
    }
    try {
      await assignClientLoyaltyProgram(
        session.supabase,
        session.tenant.id,
        id,
        parsed.data.loyaltyProgramId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "assign_failed";
      if (message === "loyalty_program_not_found") {
        return Response.json(
          { error: message, message: "Programme introuvable." },
          { status: 404 },
        );
      }
      throw error;
    }
    const [card, ledger] = await Promise.all([
      loadClientLoyaltyCard(session.supabase, session.tenant.id, id),
      loadClientLoyaltyLedger(session.supabase, session.tenant.id, id),
    ]);
    return Response.json({
      ok: true,
      card: serializeLoyaltyCard(card),
      ledger,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
