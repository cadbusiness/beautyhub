import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  inviteStaffRecord,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";

const bodySchema = z.object({
  email: z.string().email(),
  tenantRoleId: z.string().uuid().optional().nullable(),
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
        { error: "invalid_body", message: "Email requis." },
        { status: 400 },
      );
    }
    const result = await inviteStaffRecord(
      session.supabase,
      mobileTeamActor(session),
      { staffId: id, ...parsed.data },
    );
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
