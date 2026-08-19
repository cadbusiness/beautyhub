import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { createMobileAppointment } from "@/lib/institut/mobile-appointments";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const body = (await request.json()) as Record<string, unknown>;
    const result = await createMobileAppointment(
      session.supabase,
      session.tenant.id,
      {
        serviceId: body.serviceId != null ? String(body.serviceId) : undefined,
        startsAt: String(body.startsAt ?? ""),
        clientId: body.clientId != null ? String(body.clientId) : null,
        staffId: body.staffId != null ? String(body.staffId) : null,
        resourceId: body.resourceId != null ? String(body.resourceId) : null,
        notes: body.notes != null ? String(body.notes) : null,
        extras: body.extras,
        lines: body.lines,
        recurrenceFrequency:
          body.recurrenceFrequency != null ? String(body.recurrenceFrequency) : null,
        recurrenceUntil:
          body.recurrenceUntil != null ? String(body.recurrenceUntil) : null,
      },
    );

    if ("error" in result) {
      return Response.json(
        { error: result.code ?? "create_failed", message: result.error },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, id: result.id, ids: result.ids });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
