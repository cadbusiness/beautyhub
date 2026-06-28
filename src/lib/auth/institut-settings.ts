import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/guards";
import { requireTeamSession, type TeamSession } from "@/lib/auth/team-session";

export const INSTITUT_SETTINGS_ROLES = [
  "platform_admin",
  "brand_owner",
  "tenant_owner",
] as const;

export const COMPTE_INSTITUT_WOO = "/compte/institut/woocommerce";
export const COMPTE_INSTITUT_STRIPE = "/compte/institut/stripe";
export const COMPTE_INSTITUT_CAISSE = "/compte/institut/caisse";

export function canManageInstitutSettings(
  role: string,
  enabledModuleIds: string[],
): boolean {
  return (
    enabledModuleIds.includes("institut") &&
    (INSTITUT_SETTINGS_ROLES as readonly string[]).includes(role)
  );
}

export async function requireInstitutSettingsAccess(): Promise<TeamSession> {
  const session = await requireTeamSession();
  if (!canManageInstitutSettings(session.role, session.enabledModuleIds)) {
    redirect("/compte");
  }
  return session;
}

export async function requireInstitutSettingsModule(): Promise<TeamSession> {
  const session = await requireModule("institut");
  if (!canManageInstitutSettings(session.role, session.enabledModuleIds)) {
    redirect("/compte");
  }
  return session;
}
