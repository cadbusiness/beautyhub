import { requireMobileTenantSession } from "@/lib/mobile/session";
import { claimPosCart } from "@/lib/institut/pos-carts";
import { posCartErrorResponse } from "@/lib/institut/pos-carts-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const force = raw && typeof raw === "object" && (raw as { force?: boolean }).force === true;
    const cart = await claimPosCart(
      session.supabase,
      session.tenant.id,
      id,
      session.user.id,
      { force },
    );
    return Response.json({ cart });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}
