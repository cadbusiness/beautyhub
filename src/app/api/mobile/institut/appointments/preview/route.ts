import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { parseAppointmentLinesJson } from "@/lib/institut/appointment-booking";
import { previewVisitRecurrence } from "@/lib/institut/recurrence-preview";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const body = (await request.json()) as Record<string, unknown>;
    const lines = parseAppointmentLinesJson(JSON.stringify(body.lines ?? []));
    const result = await previewVisitRecurrence(
      session.supabase,
      session.tenant.id,
      {
        startsAt: new Date(String(body.startsAt ?? "")),
        lines,
        staffId: body.staffId != null ? String(body.staffId) : null,
        resourceId: body.resourceId != null ? String(body.resourceId) : null,
        clientId: body.clientId != null ? String(body.clientId) : null,
        recurrenceFrequency:
          body.recurrenceFrequency != null ? String(body.recurrenceFrequency) : null,
        recurrenceUntil:
          body.recurrenceUntil != null ? String(body.recurrenceUntil) : null,
      },
    );

    if ("error" in result) {
      return Response.json(
        { error: result.code, message: result.error },
        { status: 400 },
      );
    }

    return Response.json(result);
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
