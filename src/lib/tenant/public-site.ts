import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, type TenantContext } from "./context";
import { parseTenantIdentifier } from "./resolve";

export { parseTenantIdentifier };

/** Tenant résolu depuis l'hôte uniquement (sous-domaine ou domaine custom), sans cookie. */
export const getPublicTenantFromHost = cache(async (): Promise<TenantContext | null> => {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    process.env.VERCEL_URL ??
    "localhost:3000";

  const { host: normalizedHost, slug: hostSlug } = parseTenantIdentifier(host, rootDomain);
  const supabase = await createClient();

  if (!hostSlug) {
    const { data: byHost } = await supabase
      .rpc("get_public_tenant", { p_host: normalizedHost, p_slug: null })
      .maybeSingle();
    if (byHost) {
      return {
        id: byHost.id,
        name: byHost.name,
        slug: byHost.slug,
        branding: (byHost.branding as Record<string, unknown>) ?? {},
        brandId: byHost.brand_id,
      };
    }
    return null;
  }

  const { data } = await supabase
    .rpc("get_public_tenant", { p_host: normalizedHost, p_slug: hostSlug })
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    branding: (data.branding as Record<string, unknown>) ?? {},
    brandId: data.brand_id,
  };
});

/** URL publique de base pour le tenant courant (back-office ou public). */
export async function getTenantPublicBaseUrl(
  slug: string,
  tenantFromContext?: TenantContext | null,
): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const { slug: hostSlug } = parseTenantIdentifier(host, rootDomain);

  if (hostSlug === slug) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  const protocol = rootDomain.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}`;
}

/** Charge la page d'accueil publiée d'un tenant. */
export async function loadPublicSiteHome(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_site_home", { p_tenant_id: tenantId }).maybeSingle();
  return data;
}

/** Contexte tenant pour pages publiques : hôte d'abord, sinon cookie (preview back-office). */
export async function getPublicSiteTenant(): Promise<TenantContext | null> {
  return (await getPublicTenantFromHost()) ?? (await getTenantContext());
}
