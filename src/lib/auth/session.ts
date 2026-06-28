import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/modules/types";

export interface Membership {
  id: string;
  role: TeamRole;
  brand_id: string | null;
  tenant_id: string | null;
}

/** Utilisateur equipe courant (Supabase Auth) ou null. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Memberships (roles/scopes) de l'utilisateur courant. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, brand_id, tenant_id")
    .eq("user_id", user.id);
  if (error) return [];
  return (data ?? []) as Membership[];
});

export async function isPlatformAdmin(): Promise<boolean> {
  const memberships = await getMemberships();
  return memberships.some((m) => m.role === "platform_admin");
}

/** Role effectif de l'utilisateur pour un tenant donne (le plus eleve applicable). */
export async function getRoleForTenant(
  tenantId: string,
): Promise<TeamRole | null> {
  const memberships = await getMemberships();
  if (memberships.some((m) => m.role === "platform_admin")) {
    return "platform_admin";
  }
  const direct = memberships.find((m) => m.tenant_id === tenantId);
  if (direct) return direct.role;
  const brandOwner = memberships.find((m) => m.role === "brand_owner");
  if (brandOwner) return "brand_owner";
  return null;
}

/** Tenants accessibles pour l'utilisateur courant (hors domaine racine). */
export const getAccessibleTenants = cache(async () => {
  const memberships = await getMemberships();
  if (memberships.length === 0) return [];

  const supabase = await createClient();
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

  const results: { id: string; name: string; slug: string; role: TeamRole }[] =
    [];

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
});
