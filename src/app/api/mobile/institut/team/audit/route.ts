import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { hasInstitutPermission } from "@/lib/institut/permissions";
import { fetchTeamAuditLogs } from "@/lib/institut/team-audit";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    if (!hasInstitutPermission(session, "audit.read", "read")) {
      return Response.json(
        { error: "forbidden", message: "Journal réservé aux managers." },
        { status: 403 },
      );
    }
    const logs = await fetchTeamAuditLogs(session.supabase, session.tenant.id, 150);
    return Response.json({
      items: logs.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        actorEmail: row.actor_email,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        metadata: row.metadata,
      })),
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
