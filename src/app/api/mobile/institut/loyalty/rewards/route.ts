import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { saveLoyaltyRewardRecord } from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

const bodySchema = z.object({
  programId: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  rewardType: z.enum(["discount_percent", "discount_fixed", "free_service"]),
  pointsCost: z.number().positive(),
  isActive: z.boolean().default(true),
  newServiceOnly: z.boolean().default(false),
  discountPercent: z.number().nullable().optional(),
  discountCents: z.number().int().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_reward", message: "Récompense invalide." },
        { status: 400 },
      );
    }
    await saveLoyaltyRewardRecord(session.supabase, session.tenant.id, parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500) return mapped;
    return mobileErrorResponse(error);
  }
}
