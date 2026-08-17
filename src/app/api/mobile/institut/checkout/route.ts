import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  executePosCheckout,
  type SalePaymentInput,
} from "@/lib/institut/pos-checkout";

const paymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "other"]),
  amountCents: z.number().int().positive(),
  reference: z.string().optional(),
});

const bodySchema = z.object({
  cart: z.record(z.string(), z.number().int().min(0)),
  clientId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
  cartDiscountCents: z.number().int().min(0).optional(),
  discountReason: z.string().max(80).optional(),
  loyaltyRewardId: z.string().uuid().nullable().optional(),
  loyaltyCreditCents: z.number().int().min(0).optional(),
  payments: z.array(paymentSchema).min(0),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });

    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: parsed.error.message },
        { status: 400 },
      );
    }

    const {
      cart,
      clientId,
      staffId,
      notes,
      cartDiscountCents,
      discountReason,
      loyaltyRewardId,
      loyaltyCreditCents,
      payments,
    } = parsed.data;
    const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (cartEntries.length === 0) {
      return Response.json({ error: "empty_cart" }, { status: 400 });
    }

    const cartJson = JSON.stringify(Object.fromEntries(cartEntries));
    const salePayments: SalePaymentInput[] = payments.map((p) => ({
      method: p.method,
      amount_cents: p.amountCents,
      reference: p.reference,
    }));

    const result = await executePosCheckout(
      session.supabase,
      session.tenant.id,
      {
        cartJson,
        clientId: clientId ?? null,
        staffId: staffId ?? null,
        notes,
        cartDiscountCents: cartDiscountCents ?? 0,
        discountReason: discountReason ?? null,
        loyaltyRewardId: loyaltyRewardId ?? null,
        loyaltyCreditCents: loyaltyCreditCents ?? 0,
        payments: salePayments,
      },
    );

    return Response.json({
      saleId: result.saleId,
      ticketNumber: result.ticketNumber,
      status: result.status,
      totalCents: result.totalCents,
      amountPaidCents: result.amountPaidCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "checkout_failed";
    if (message === "session_paused") {
      return Response.json(
        {
          error: message,
          message: "La caisse est en pause — reprenez la session pour encaisser.",
        },
        { status: 409 },
      );
    }
    if (
      message === "empty_cart" ||
      message === "invalid_cart" ||
      message === "no_open_session" ||
      message === "invalid_amount" ||
      message === "no_payments" ||
      message.startsWith("payment_method_disabled:")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    return mobileErrorResponse(error);
  }
}
