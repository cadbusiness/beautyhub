import { z } from "zod";
import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { mobileTeamActor } from "@/lib/mobile/team-actor";
import {
  createStaffRecord,
  loadMobileTeamSnapshot,
  teamManageHttpStatus,
  teamManageMessage,
} from "@/lib/institut/team-manage";
import type { StaffWithAccess } from "@/lib/institut/team-access";

function serializeStaff(s: StaffWithAccess) {
  return {
    id: s.id,
    fullName: s.full_name,
    email: s.email,
    avatarUrl: s.avatar_url,
    color: s.color,
    isActive: s.is_active,
    hasSchedule: Boolean(s.schedule_id),
    hasAccount: Boolean(s.user_id),
    accessStatus: s.access_status,
    tenantRoleId: s.tenant_role_id,
    tenantRoleName: s.tenant_role_name,
    invitationId: s.invitation_id,
  };
}

/**
 * GET /api/mobile/institut/team
 * Personnel + rôles + droits de l'opérateur.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const actor = mobileTeamActor(session);
    const snapshot = await loadMobileTeamSnapshot(
      session.supabase,
      session.tenant.id,
      actor,
    );
    return Response.json({
      items: snapshot.items.map(serializeStaff),
      roles: snapshot.roles.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        isSystem: r.is_system,
      })),
      capabilities: snapshot.capabilities,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

const createSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().email().optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: "Nom requis." },
        { status: 400 },
      );
    }
    const result = await createStaffRecord(
      session.supabase,
      mobileTeamActor(session),
      parsed.data,
    );
    if (!result.ok) {
      return Response.json(
        { error: result.error, message: teamManageMessage(result.error) },
        { status: teamManageHttpStatus(result.error) },
      );
    }
    return Response.json({ ok: true, staffId: result.staffId });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
