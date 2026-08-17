import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  PromoAdminError,
  deletePromoRecord,
  promoAdminHttp,
  savePromoRecord,
} from "@/lib/institut/promos-admin";

const writeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  discountType: z.enum(["percent", "fixed"]),
  discountPercent: z.number().nullable().optional(),
  discountCents: z.number().int().nullable().optional(),
  minOrderCents: z.number().int().min(0).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  usageLimit: z.number().int().nullable().optional(),
  usageLimitPerClient: z.number().int().nullable().optional(),
  channelWoo: z.boolean(),
  channelBooking: z.boolean(),
  channelPos: z.boolean(),
  isActive: z.boolean(),
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
    const parsed = writeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Paramètres invalides." },
        { status: 400 },
      );
    }
    await savePromoRecord(session.supabase, session.tenant.id, {
      ...parsed.data,
      id,
    });
    return Response.json({ ok: true, promoId: id });
  } catch (error) {
    if (error instanceof PromoAdminError) return promoAdminHttp(error);
    return mobileErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(_request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    await deletePromoRecord(session.supabase, session.tenant.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof PromoAdminError) return promoAdminHttp(error);
    return mobileErrorResponse(error);
  }
}
