import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { deleteLoyaltyEarnRuleRecord } from "@/lib/institut/loyalty-admin";
import { loyaltyAdminHttp } from "@/lib/institut/mobile-loyalty-json";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    await deleteLoyaltyEarnRuleRecord(session.supabase, session.tenant.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    const mapped = loyaltyAdminHttp(error);
    if (mapped.status !== 500) return mapped;
    return mobileErrorResponse(error);
  }
}
