import type { TeamRole } from "@/modules/types";

export type PermissionLevel = { read?: boolean; write?: boolean };
export type InstitutPermissions = Record<string, PermissionLevel>;
export type PermissionLevelKind = "read" | "write";

export type InstitutPermissionKey =
  | "dashboard"
  | "appointments"
  | "clients"
  | "services"
  | "team"
  | "pos"
  | "marketing"
  | "clients.delete"
  | "team.manage_access"
  | "team.manage_roles"
  | "audit.read";

export const INSTITUT_PERMISSION_ACTIONS = [
  { key: "clients.delete", labelKey: "clientsDelete" },
  { key: "team.manage_access", labelKey: "teamManageAccess" },
  { key: "team.manage_roles", labelKey: "teamManageRoles" },
  { key: "audit.read", labelKey: "auditRead" },
] as const;

export const WILDCARD_PERMISSIONS: InstitutPermissions = {
  "*": { read: true, write: true },
};

const FULL_ACCESS_ROLES = new Set<TeamRole>([
  "platform_admin",
  "brand_owner",
  "tenant_owner",
]);

export type InstitutPermissionHolder = {
  role: TeamRole;
  permissions: InstitutPermissions;
};

export function hasInstitutPermission(
  holder: InstitutPermissionHolder,
  key: InstitutPermissionKey | string,
  level: PermissionLevelKind = "read",
): boolean {
  if (FULL_ACCESS_ROLES.has(holder.role)) return true;
  const wildcard = holder.permissions["*"];
  if (wildcard?.write) return true;
  if (level === "read" && wildcard?.read) return true;
  const entry = holder.permissions[key];
  if (level === "write") return Boolean(entry?.write);
  return Boolean(entry?.read || entry?.write);
}

export type TeamCapabilities = {
  canWriteTeam: boolean;
  canManageAccess: boolean;
  canManageRoles: boolean;
  canReadAudit: boolean;
};

export function institutCapabilities(holder: InstitutPermissionHolder): TeamCapabilities {
  return {
    canWriteTeam: hasInstitutPermission(holder, "team", "write"),
    canManageAccess: hasInstitutPermission(holder, "team.manage_access", "write"),
    canManageRoles: hasInstitutPermission(holder, "team.manage_roles", "write"),
    canReadAudit: hasInstitutPermission(holder, "audit.read", "read"),
  };
}

export function inferInstitutPermissionFromPath(
  pathname: string,
  method: string,
): { key: InstitutPermissionKey; level: PermissionLevelKind } | null {
  const level: PermissionLevelKind =
    method === "GET" || method === "HEAD" ? "read" : "write";
  const path = pathname.toLowerCase();

  if (path.includes("/staff") || path.includes("/team") || path.includes("/equipe")) {
    return { key: "team", level };
  }
  if (
    path.includes("/appointment") ||
    path.includes("/agenda") ||
    path.includes("/rendez-vous") ||
    /\/api\/(?:mobile\/)?institut\/day(?:\/|$)/.test(path)
  ) {
    return { key: "appointments", level };
  }
  if (path.includes("/clients")) {
    return { key: "clients", level };
  }
  if (
    path.includes("/service") ||
    path.includes("/prestation") ||
    path.includes("/service-extra")
  ) {
    return { key: "services", level };
  }
  if (
    path.includes("/pos") ||
    path.includes("/caisse") ||
    path.includes("/sales") ||
    path.includes("/checkout") ||
    path.includes("/cash-session") ||
    path.includes("/product") ||
    path.includes("/voucher") ||
    path.includes("/document")
  ) {
    return { key: "pos", level };
  }
  if (
    path.includes("/marketing") ||
    path.includes("/loyalty") ||
    path.includes("/promo") ||
    path.includes("/branding")
  ) {
    return { key: "marketing", level };
  }
  if (path.includes("/dashboard")) {
    return { key: "dashboard", level };
  }
  return { key: "dashboard", level: "read" };
}
