import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import type { TeamRole } from "@/modules/types";
import type { TenantContext } from "@/lib/tenant/context";

export interface TenantSession {
  userId: string;
  email: string | null;
  tenant: TenantContext;
  role: TeamRole;
  enabledModuleIds: string[];
}

/**
 * Garde pour les pages back-office: exige un utilisateur connecte, un tenant
 * resolu et un role applicable. Redirige sinon.
 */
export async function requireTenantSession(): Promise<TenantSession> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tenant = await getTenantContext();
  if (!tenant) redirect("/dashboard");

  const platformAdmin = await isPlatformAdmin();
  const role = platformAdmin
    ? "platform_admin"
    : await getRoleForTenant(tenant.id);
  if (!role) redirect("/dashboard");

  const enabledModuleIds = await getEnabledModuleIds(tenant.id);

  return {
    userId: user.id,
    email: user.email ?? null,
    tenant,
    role,
    enabledModuleIds,
  };
}

/** Variante exigeant qu'un module precis soit actif. */
export async function requireModule(moduleId: string): Promise<TenantSession> {
  const session = await requireTenantSession();
  if (!session.enabledModuleIds.includes(moduleId)) {
    redirect("/dashboard");
  }
  return session;
}

export interface PlatformSession {
  userId: string;
  email: string | null;
}

/**
 * Garde pour le back-office super-admin (zone plateforme, domaine racine).
 * Exige un utilisateur connecte avec un role platform_admin. Pas de tenant requis.
 */
export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isPlatformAdmin())) redirect("/dashboard");
  return { userId: user.id, email: user.email ?? null };
}
