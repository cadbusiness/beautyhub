import { z } from "zod";
import { PosCartError, type PosCartWriteInput } from "./pos-carts";

export const posCartWriteSchema = z.object({
  label: z.string().max(80).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  lines: z.record(z.string(), z.number().int().min(0)).optional(),
  lineStaff: z.record(z.string(), z.string().uuid()).optional(),
  priceOverrides: z.record(z.string(), z.number().int().min(0)).optional(),
  discountKind: z.enum(["percent", "fixed"]).nullable().optional(),
  discountValue: z.number().nullable().optional(),
  discountReason: z.string().max(80).nullable().optional(),
  cartDiscountCents: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
  force: z.boolean().optional(),
});

export function writeInputFromBody(
  body: z.infer<typeof posCartWriteSchema>,
): PosCartWriteInput {
  return {
    label: body.label,
    clientId: body.clientId,
    appointmentId: body.appointmentId,
    staffId: body.staffId,
    lines: body.lines,
    lineStaff: body.lineStaff,
    priceOverrides: body.priceOverrides,
    discountKind: body.discountKind,
    discountValue: body.discountValue,
    discountReason: body.discountReason,
    cartDiscountCents: body.cartDiscountCents,
    notes: body.notes,
  };
}

export function posCartErrorResponse(error: unknown): Response {
  if (error instanceof PosCartError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "locked"
          ? 409
          : 400;
    return Response.json(
      { error: error.code, message: error.message },
      { status },
    );
  }
  const message = error instanceof Error ? error.message : "pos_cart_failed";
  return Response.json({ error: "pos_cart_failed", message }, { status: 500 });
}
