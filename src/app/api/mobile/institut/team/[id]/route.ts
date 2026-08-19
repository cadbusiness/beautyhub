import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  updateStaffRecord,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";

const patchSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().email().optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  tenantRoleId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Données invalides." },
        { status: 400 },
      );
    }
    const result = await updateStaffRecord(
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
