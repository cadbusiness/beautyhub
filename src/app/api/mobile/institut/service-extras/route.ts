import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { loadServiceExtrasCatalog } from "@/lib/institut/service-extras-load";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const serviceId = new URL(request.url).searchParams.get("serviceId");
    if (!serviceId) {
      return Response.json({ error: "serviceId required" }, { status: 400 });
    }
    const catalog = await loadServiceExtrasCatalog(
      session.supabase,
      session.tenant.id,
      serviceId,
    );
    return Response.json({ extras: catalog });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
