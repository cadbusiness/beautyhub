import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { fetchClientSales } from "@/lib/institut/clients";
import { serializeClientSale } from "@/lib/institut/mobile-loyalty-json";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const payload = await fetchClientSales(
      session.supabase,
      session.tenant.id,
      id,
    );
    return Response.json({
      sales: payload.sales.map(serializeClientSale),
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
