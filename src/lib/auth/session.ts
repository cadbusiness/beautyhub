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
