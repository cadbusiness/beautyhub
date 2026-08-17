import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { resolveConnection } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { saveLoyaltyEarnRuleRecord } from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

const bodySchema = z.object({
  programId: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  sourceType: z.enum([
    "appointment_completed",
    "pos_sale",
    "woocommerce_order",
    "shopify_order",
  ]),
  calcMode: z.enum(["fixed_per_event", "per_euro_spent"]),
  pointsValue: z.number().positive(),
  minAmountCents: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_rule", message: "Règle invalide." },
        { status: 400 },
      );
    }
    const woo = await resolveConnection(session.tenant.id, WOO_PROVIDER);
    await saveLoyaltyEarnRuleRecord(session.supabase, session.tenant.id, {
      ...parsed.data,
      wooConnected: woo?.status === "connected",
    });
    return Response.json({ ok: true });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500) return mapped;
    return mobileErrorResponse(error);
  }
}
