import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { listPromos, resolvePromoStatus, type PromoRow } from "@/lib/institut/promos-core";
import {
  PromoAdminError,
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

export function serializePromo(promo: PromoRow) {
  return {
    id: promo.id,
    code: promo.code,
    name: promo.name,
    description: promo.description,
    discountType: promo.discount_type,
    discountPercent: promo.discount_percent,
    discountCents: promo.discount_cents,
    minOrderCents: promo.min_order_cents,
    startsAt: promo.starts_at,
    endsAt: promo.ends_at,
    usageCount: promo.usage_count,
    usageLimit: promo.usage_limit,
    usageLimitPerClient: promo.usage_limit_per_client,
    channelWoo: promo.channel_woo,
    channelBooking: promo.channel_booking,
    channelPos: promo.channel_pos,
    isActive: promo.is_active,
    status: resolvePromoStatus(promo),
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const search = new URL(request.url).searchParams.get("q") ?? undefined;
    const promos = await listPromos(session.supabase, session.tenant.id, {
      search,
    });
    return Response.json({ promos: promos.map(serializePromo) });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = writeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Paramètres invalides." },
        { status: 400 },
      );
    }
    const created = await savePromoRecord(session.supabase, session.tenant.id, parsed.data);
    return Response.json({ ok: true, promoId: created.promoId });
  } catch (error) {
    if (error instanceof PromoAdminError) return promoAdminHttp(error);
    return mobileErrorResponse(error);
  }
}
