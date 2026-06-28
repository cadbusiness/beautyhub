import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getAccessibleTenants,
  getCurrentUser,
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import type { PosSessionSummary } from "@/lib/institut/pos-session";
import { getPosSessionSummary } from "@/lib/institut/pos-session";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/modules/types";
import type { TenantContext } from "@/lib/tenant/context";

export interface TeamSession {
  userId: string;
  email: string | null;
  tenant: TenantContext;
  role: TeamRole;
  enabledModuleIds: string[];
}

/** Session equipe + tenant, dedupliquee sur une requete (layout + pages). */
export const getTeamSession = cache(async (): Promise<TeamSession | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const tenant = await getTenantContext();
  if (!tenant) return null;

  const [platformAdmin, enabledModuleIds] = await Promise.all([
    isPlatformAdmin(),
    getEnabledModuleIds(tenant.id),
  ]);

  const role = platformAdmin
    ? ("platform_admin" as TeamRole)
    : await getRoleForTenant(tenant.id);
  if (!role) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    tenant,
    role,
    enabledModuleIds,
  };
});

export interface AppShellData {
  session: TeamSession;
  accessibleTenants: Awaited<ReturnType<typeof getAccessibleTenants>>;
  posSession: PosSessionSummary | null;
}

export const getAppShellData = cache(async (): Promise<AppShellData | null> => {
  const session = await getTeamSession();
  if (!session) return null;

  const [accessibleTenants, posSession] = await Promise.all([
    getAccessibleTenants(),
    session.enabledModuleIds.includes("institut")
      ? getPosSessionSummary(await createClient(), session.tenant.id)
      : Promise.resolve(null),
  ]);

  return { session, accessibleTenants, posSession };
});

export async function requireTeamSession(): Promise<TeamSession> {
  const session = await getTeamSession();
  if (!session) {
    if (!(await getCurrentUser())) redirect("/login");
    redirect("/dashboard");
  }
  return session;
}
