import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantSlugFromCookie } from "./cookie";
import { parseTenantIdentifier } from "./resolve";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  brandId: string;
}

function mapTenant(data: {
  id: string;
  name: string;
  slug: string;
  branding: unknown;
  brand_id: string;
}): TenantContext {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    branding: (data.branding as Record<string, unknown>) ?? {},
    brandId: data.brand_id,
  };
}

/**
 * Resout le tenant courant a partir de l'hote de la requete (sous-domaine ou domaine custom).
 * Utilise la fonction SQL publique get_public_tenant (ne renvoie pas les secrets).
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    process.env.VERCEL_URL ??
    "localhost:3000";

  const { host: normalizedHost, slug: hostSlug } = parseTenantIdentifier(
    host,
    rootDomain,
  );

  const supabase = await createClient();

  // 1. Domaine custom (ex: institut.com)
  if (!hostSlug) {
    const { data: byHost } = await supabase
      .rpc("get_public_tenant", { p_host: normalizedHost, p_slug: null })
      .maybeSingle();
    if (byHost) return mapTenant(byHost);
  }

  // 2. Sous-domaine ou cookie (domaine racine plateforme, alias Vercel inclus)
  const slug = hostSlug ?? (await getTenantSlugFromCookie());
  if (!slug) return null;

  const { data, error } = await supabase
    .rpc("get_public_tenant", { p_host: normalizedHost, p_slug: slug })
    .maybeSingle();

  if (error || !data) return null;
  return mapTenant(data);
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
