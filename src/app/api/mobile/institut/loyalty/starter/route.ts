import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { applyLoyaltyStarterPackRecord } from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

const bodySchema = z.object({
  programId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Programme invalide." },
        { status: 400 },
      );
    }
    await applyLoyaltyStarterPackRecord(
      session.supabase,
      session.tenant.id,
      parsed.data.programId,
    );
    return Response.json({ ok: true });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500) return mapped;
    return mobileErrorResponse(error);
  }
}
