import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  resetStaffRecordPassword,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";

const bodySchema = z.object({
  password: z.string().min(8).max(80).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Mot de passe trop court." },
        { status: 400 },
      );
    }
    const result = await resetStaffRecordPassword(
      session.supabase,
      mobileTeamActor(session),
      { staffId: id, password: parsed.data.password },
    );
    if (!result.ok) {
      return Response.json(
        { error: result.error, message: teamManageMessage(result.error) },
        { status: teamManageHttpStatus(result.error) },
      );
    }
    return Response.json({
      ok: true,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
