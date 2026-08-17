import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { resolveConnection } from "@/lib/connections";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { loadLoyaltyProgramSnapshot } from "@/lib/institut/loyalty";
import { serializeLoyaltySnapshot } from "@/lib/institut/mobile-loyalty-json";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const programId = new URL(request.url).searchParams.get("programId");
    const [snapshot, wooConn, servicesRes] = await Promise.all([
      loadLoyaltyProgramSnapshot(
        session.supabase,
        session.tenant.id,
        programId,
      ),
      resolveConnection(session.tenant.id, WOO_PROVIDER),
      session.supabase
        .from("inst_services")
        .select("id, name")
        .eq("tenant_id", session.tenant.id)
        .eq("is_active", true)
        .order("name"),
    ]);
    return Response.json(
      serializeLoyaltySnapshot(snapshot, {
        integrations: {
          woocommerce: wooConn?.status === "connected",
          shopify: false,
        },
        services: servicesRes.data ?? [],
      }),
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
