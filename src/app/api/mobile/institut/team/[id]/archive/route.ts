import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  archiveStaffRecord,
  restoreStaffRecord,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";

const bodySchema = z.object({
  revokeAccess: z.boolean().optional(),
  restore: z.boolean().optional(),
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
    const body = parsed.success ? parsed.data : {};
    const result = body.restore
      ? await restoreStaffRecord(session.supabase, mobileTeamActor(session), id)
      : await archiveStaffRecord(session.supabase, mobileTeamActor(session), {
          staffId: id,
          revokeAccess: body.revokeAccess,
        });
    if (!result.ok) {
      return Response.json(
        { error: result.error, message: teamManageMessage(result.error) },
        { status: teamManageHttpStatus(result.error) },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
