import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth/session";
import { requireTeamSession, type TeamSession } from "@/lib/auth/team-session";

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
