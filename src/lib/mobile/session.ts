import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { TeamRole } from "@/modules/types";
import { MOBILE_HEADERS } from "@/lib/mobile/types";
import {
  hasInstitutPermission,
  inferInstitutPermissionFromPath,
  WILDCARD_PERMISSIONS,
  type InstitutPermissions,
} from "@/lib/institut/permissions";
import { parsePermissionsJson } from "@/lib/institut/team-access";

export type MobileDb = SupabaseClient<Database>;

export interface MobileMembership {
  id: string;
  role: TeamRole;
  brand_id: string | null;
  tenant_id: string | null;
  tenant_role_id: string | null;
}

export interface MobileTenantOption {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
}

export interface MobileAuthContext {
  user: User;
  supabase: MobileDb;
  accessToken: string;
}

export interface MobileTenantSession extends MobileAuthContext {
  tenant: { id: string; name: string; slug: string; brandId: string };
  role: TeamRole;
  enabledModuleIds: string[];
  tenantRoleId: string | null;
  permissions: InstitutPermissions;
}

export class MobileAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "MobileAuthError";
  }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function createMobileSupabase(accessToken: string): MobileDb {
  const env = requireSupabaseEnv();
  return createClient<Database>(env.url, env.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireMobileAuth(
  request: Request,
): Promise<MobileAuthContext> {
  const accessToken = extractBearer(request);
  if (!accessToken) {
    throw new MobileAuthError("Authentication required", 401, "unauthorized");
  }

  const supabase = createMobileSupabase(accessToken);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new MobileAuthError("Invalid session", 401, "unauthorized");
  }

  return { user, supabase, accessToken };
}

async function loadMemberships(
  supabase: MobileDb,
  userId: string,
): Promise<MobileMembership[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, brand_id, tenant_id, tenant_role_id")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data as MobileMembership[];
}

export async function listAccessibleTenantsForUser(
  supabase: MobileDb,
  userId: string,
): Promise<MobileTenantOption[]> {
  const memberships = await loadMemberships(supabase, userId);
  if (memberships.length === 0) return [];

  const platformAdmin = memberships.some((m) => m.role === "platform_admin");
  if (platformAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .order("name");
    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: "platform_admin" as TeamRole,
    }));
  }

  const brandIds = [
    ...new Set(
      memberships
        .filter((m) => m.role === "brand_owner" && m.brand_id)
        .map((m) => m.brand_id as string),
    ),
  ];
  const tenantIds = [
    ...new Set(
      memberships
        .filter((m) => m.tenant_id)
        .map((m) => m.tenant_id as string),
    ),
  ];

  const results: MobileTenantOption[] = [];

  if (brandIds.length > 0) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, slug, brand_id")
      .in("brand_id", brandIds)
      .order("name");
    for (const t of data ?? []) {
      results.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: "brand_owner",
      });
    }
  }

  if (tenantIds.length > 0) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .in("id", tenantIds)
      .order("name");
    for (const t of data ?? []) {
      const mem = memberships.find((m) => m.tenant_id === t.id);
      if (!mem) continue;
      if (!results.some((r) => r.id === t.id)) {
        results.push({
          id: t.id,
          name: t.name,
          slug: t.slug,
          role: mem.role,
        });
      }
    }
  }

  return results;
}

function resolveTenantId(request: Request): string | null {
  return (
    request.headers.get(MOBILE_HEADERS.tenantId)?.trim() ||
    new URL(request.url).searchParams.get("tenantId")?.trim() ||
    null
  );
}

async function getEnabledModuleIds(
  supabase: MobileDb,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("tenant_modules")
    .select("module_id, enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  if (error || !data) return [];
  return data.map((row) => row.module_id);
}

export async function requireMobileTenantSession(
  request: Request,
  options?: { moduleId?: string },
): Promise<MobileTenantSession> {
  const auth = await requireMobileAuth(request);
  const tenantId = resolveTenantId(request);
  if (!tenantId) {
    throw new MobileAuthError("Tenant required", 400, "tenant_required");
  }

  const tenants = await listAccessibleTenantsForUser(
    auth.supabase,
    auth.user.id,
  );
  const match = tenants.find((t) => t.id === tenantId);
  if (!match) {
    throw new MobileAuthError("Tenant access denied", 403, "tenant_forbidden");
  }

  const { data: tenantRow, error } = await auth.supabase
    .from("tenants")
    .select("id, name, slug, brand_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !tenantRow) {
    throw new MobileAuthError("Tenant not found", 404, "tenant_not_found");
  }

  const enabledModuleIds = await getEnabledModuleIds(auth.supabase, tenantId);
  if (options?.moduleId && !enabledModuleIds.includes(options.moduleId)) {
    throw new MobileAuthError("Module not enabled", 403, "module_disabled");
  }

  const memberships = await loadMemberships(auth.supabase, auth.user.id);
  const membership = memberships.find((m) => m.tenant_id === tenantId);
  const tenantRoleId = membership?.tenant_role_id ?? null;
  let permissions: InstitutPermissions = {};

  if (
    match.role === "platform_admin" ||
    match.role === "brand_owner" ||
    match.role === "tenant_owner"
  ) {
    permissions = WILDCARD_PERMISSIONS;
  } else if (tenantRoleId) {
    const { data: tenantRole } = await auth.supabase
      .from("tenant_roles")
      .select("permissions")
      .eq("id", tenantRoleId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    permissions = parsePermissionsJson(tenantRole?.permissions);
  }

  const session: MobileTenantSession = {
    ...auth,
    tenant: {
      id: tenantRow.id,
      name: tenantRow.name,
      slug: tenantRow.slug,
      brandId: tenantRow.brand_id,
    },
    role: match.role,
    enabledModuleIds,
    tenantRoleId,
    permissions,
  };

  if (options?.moduleId === "institut") {
    const inferred = inferInstitutPermissionFromPath(
      new URL(request.url).pathname,
      request.method,
    );
    if (inferred && !hasInstitutPermission(session, inferred.key, inferred.level)) {
      throw new MobileAuthError("Permission denied", 403, "forbidden");
    }
  }

  return session;
}

export function mobileErrorResponse(error: unknown): Response {
  if (error instanceof MobileAuthError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "internal_error";
  return Response.json({ error: "internal_error", message }, { status: 500 });
}
