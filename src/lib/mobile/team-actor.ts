import type { MobileTenantSession } from "@/lib/mobile/session";
import type { InstitutPermissionHolder } from "@/lib/institut/permissions";
import type { TeamAuditActor } from "@/lib/institut/team-audit";

export function mobileTeamActor(
  session: MobileTenantSession,
): TeamAuditActor & InstitutPermissionHolder {
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    tenant: { id: session.tenant.id },
    role: session.role,
    permissions: session.permissions,
  };
}
