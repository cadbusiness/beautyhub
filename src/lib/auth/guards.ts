import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth/session";
import { requireTeamSession, type TeamSession } from "@/lib/auth/team-session";
import {
  hasInstitutPermission,
  inferInstitutPermissionFromPath,
  type InstitutPermissionKey,
  type PermissionLevelKind,
} from "@/lib/institut/permissions";

export type { TeamSession as TenantSession };

/** Garde pour les pages back-office: exige un utilisateur connecte, un tenant et un role. */
export async function requireTenantSession(): Promise<TeamSession> {
  return requireTeamSession();
}

/** Variante exigeant qu'un module precis soit actif. */
export async function requireModule(moduleId: string): Promise<TeamSession> {
  const session = await requireTeamSession();
  if (!session.enabledModuleIds.includes(moduleId)) {
    redirect("/dashboard");
  }
  return session;
}

/** Garde module + droit institut (pages / server actions). */
export async function requireInstitutAccess(
  section: InstitutPermissionKey,
  level: PermissionLevelKind = "read",
): Promise<TeamSession> {
  const session = await requireModule("institut");
  if (!hasInstitutPermission(session, section, level)) {
    redirect("/dashboard");
  }
  return session;
}

/** Garde API institut : infère la section depuis l'URL. */
export async function requireInstitutApi(request: Request): Promise<TeamSession> {
  const session = await requireModule("institut");
  const inferred = inferInstitutPermissionFromPath(
    new URL(request.url).pathname,
    request.method,
  );
  if (inferred && !hasInstitutPermission(session, inferred.key, inferred.level)) {
    redirect("/dashboard");
  }
  return session;
}
export interface PlatformSession {
  userId: string;
  email: string | null;
}

export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isPlatformAdmin())) redirect("/dashboard");
  return { userId: user.id, email: user.email ?? null };
}
