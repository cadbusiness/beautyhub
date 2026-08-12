import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { updateMobileAppointment } from "@/lib/institut/mobile-appointments";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const result = await updateMobileAppointment(
      session.supabase,
      session.tenant.id,
      id,
      {
        status: body.status != null ? String(body.status) : undefined,
        notes: body.notes !== undefined ? String(body.notes ?? "") : undefined,
      },
    );

    if ("error" in result) {
      const status = result.code === "not_found" ? 404 : 400;
      return Response.json(
        { error: result.code ?? "update_failed", message: result.error },
        { status },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
