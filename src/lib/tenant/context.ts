import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseTenantIdentifier } from "./resolve";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  brandId: string;
}

/**
 * Resout le tenant courant a partir de l'hote de la requete (sous-domaine ou domaine custom).
 * Utilise la fonction SQL publique get_public_tenant (ne renvoie pas les secrets).
 * Retourne null sur le domaine racine (zone plateforme).
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  const { host: normalizedHost, slug } = parseTenantIdentifier(host, rootDomain);
  if (!slug && normalizedHost === stripPort(rootDomain)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_public_tenant", { p_host: normalizedHost, p_slug: slug })
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    branding: (data.branding as Record<string, unknown>) ?? {},
    brandId: data.brand_id,
  };
});

/** Ids des modules actives pour un tenant (cote equipe authentifiee). */
export const getEnabledModuleIds = cache(
  async (tenantId: string): Promise<string[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_modules")
      .select("module_id, enabled")
      .eq("tenant_id", tenantId)
      .eq("enabled", true);
    if (error || !data) return [];
    return data.map((row) => row.module_id);
  },
);

function stripPort(value: string): string {
  return value.split(":")[0];
}
