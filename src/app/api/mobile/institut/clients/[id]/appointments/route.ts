import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { fetchClientAppointments } from "@/lib/institut/clients";
import { serializeAppointment } from "@/lib/institut/mobile-loyalty-json";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const payload = await fetchClientAppointments(
      session.supabase,
      session.tenant.id,
      id,
    );
    return Response.json({
      upcoming: payload.upcoming.map(serializeAppointment),
      past: payload.past.map(serializeAppointment),
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
