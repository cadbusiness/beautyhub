import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { loadPosClientLoyalty } from "@/lib/institut/pos-client-loyalty";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim();
    if (!clientId) {
      return Response.json({ error: "client_id_required" }, { status: 400 });
    }
    const parsed = z.string().uuid().safeParse(clientId);
    if (!parsed.success) {
      return Response.json({ error: "invalid_client" }, { status: 400 });
    }
    const snapshot = await loadPosClientLoyalty(
      session.supabase,
      session.tenant.id,
      parsed.data,
    );
    return Response.json(snapshot ?? { active: false, balance: 0, rewards: [] });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
