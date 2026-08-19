import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  activateStaffRecord,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";

const bodySchema = z.object({
  email: z.string().email(),
  tenantRoleId: z.string().uuid().optional().nullable(),
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
        { error: "invalid_body", message: "Email requis." },
        { status: 400 },
      );
    }
    const result = await activateStaffRecord(
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
    return Response.json({
      ok: true,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
