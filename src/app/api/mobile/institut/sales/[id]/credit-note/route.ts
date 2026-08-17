import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { createCreditNoteFromSale } from "@/lib/institut/pos-vouchers";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(3).max(240),
  settlement: z.enum(["credit", "cash", "card"]).default("credit"),
  intent: z.enum(["credit", "refund", "replacement"]).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id: saleId } = await context.params;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Montant et motif (3 caractères min.) requis." },
        { status: 400 },
      );
    }

    const note = await createCreditNoteFromSale(
      session.supabase,
      session.tenant.id,
      {
        saleId,
        amountCents: parsed.data.amountCents,
        reason: parsed.data.reason,
        settlement: parsed.data.settlement,
        intent: parsed.data.intent,
      },
    );

    return Response.json({
      ok: true,
      id: note.id,
      creditNumber: note.creditNumber,
      documentId: note.documentId,
      settlement: note.settlement,
      remainingRefundableCents: note.remainingRefundableCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "credit_note_failed";
    if (message === "sale_not_found") {
      return Response.json(
        { error: message, message: "Ticket introuvable" },
        { status: 404 },
      );
    }
    if (message === "sale_already_refunded") {
      return Response.json(
        { error: message, message: "Ce ticket a déjà été entièrement crédité." },
        { status: 409 },
      );
    }
    if (message === "credit_amount_invalid") {
      return Response.json(
        { error: message, message: "Montant d'avoir invalide." },
        { status: 400 },
      );
    }
    if (message === "reason_required") {
      return Response.json(
        { error: message, message: "Le motif est obligatoire." },
        { status: 400 },
      );
    }
    if (message === "no_open_session") {
      return Response.json(
        { error: message, message: "Ouvrez la caisse pour un remboursement espèces." },
        { status: 409 },
      );
    }
    if (message === "session_paused") {
      return Response.json(
        { error: message, message: "La caisse est en pause — reprenez la session." },
        { status: 409 },
      );
    }
    return mobileErrorResponse(error);
  }
}
