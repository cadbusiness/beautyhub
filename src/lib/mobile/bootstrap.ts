import { createClient } from "@/lib/supabase/server";
import { resolveMobileBranding } from "@/lib/mobile/branding";
import type { MobileBootstrap } from "@/lib/mobile/types";

type BootstrapRow = {
  app_id: string;
  audience: string;
  scope_type: string;
  scope_id: string;
  brand_id: string;
  app_name: string;
  app_slug: string;
  deep_link_scheme: string | null;
  branding: unknown;
  brand_name: string;
  brand_slug: string;
  brand_branding: unknown;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_branding: unknown;
};

function apiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

async function fetchEnabledModules(tenantId: string | null): Promise<string[]> {
  if (!tenantId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_modules")
    .select("module_id")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  return (data ?? []).map((row) => row.module_id);
}

async function fetchSiteBrandingHints(tenantId: string | null): Promise<{
  primaryColor: string | null;
  logoUrl: string | null;
}> {
  if (!tenantId) return { primaryColor: null, logoUrl: null };
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_public_site_settings", { p_tenant_id: tenantId })
    .maybeSingle();
  return {
    primaryColor: data?.primary_color ?? null,
    logoUrl: data?.logo_url ?? null,
  };
}

export async function fetchMobileBootstrapByBundleId(
  bundleId: string,
): Promise<MobileBootstrap | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_mobile_app_bootstrap", { p_bundle_id: bundleId })
    .maybeSingle();

  if (error || !data) return null;

  const row = data as BootstrapRow;
  const siteHints = await fetchSiteBrandingHints(row.tenant_id);
  const modules = await fetchEnabledModules(row.tenant_id);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requis.");
  }

  return {
    appId: row.app_id,
    audience: row.audience as MobileBootstrap["audience"],
    scopeType: row.scope_type as MobileBootstrap["scopeType"],
    appName: row.app_name,
    appSlug: row.app_slug,
    deepLinkScheme: row.deep_link_scheme,
    branding: resolveMobileBranding({
      brandBranding: row.brand_branding as Record<string, unknown>,
      tenantBranding: row.tenant_branding as Record<string, unknown> | null,
      appBranding: row.branding as Record<string, unknown>,
      sitePrimaryColor: siteHints.primaryColor,
      siteLogoUrl: siteHints.logoUrl,
    }),
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      slug: row.brand_slug,
    },
    tenant:
      row.tenant_id && row.tenant_name && row.tenant_slug
        ? {
            id: row.tenant_id,
            name: row.tenant_name,
            slug: row.tenant_slug,
          }
        : null,
    api: {
      baseUrl: apiBaseUrl(),
      supabaseUrl,
      supabaseAnonKey,
    },
    features: { modules },
  };
}
