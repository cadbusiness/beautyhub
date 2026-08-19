import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { claimPosCart } from "@/lib/institut/pos-carts";
import { posCartErrorResponse } from "@/lib/institut/pos-carts-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const force =
      raw && typeof raw === "object" && (raw as { force?: boolean }).force === true;
    const cart = await claimPosCart(
      supabase,
      session.tenant.id,
      id,
      session.userId,
      { force },
    );
    return Response.json({ cart });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}
