import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { SiteTemplateId } from "@/lib/institut/site-pages";
import { publicPagePath, type SitePageRow } from "@/lib/institut/site-pages";
import type { TenantContext } from "@/lib/tenant/context";

type Db = SupabaseClient<Database>;

export interface SiteSettingsRow {
  tenant_id: string;
  template_id: SiteTemplateId;
  primary_color: string;
  display_name: string | null;
  logo_url: string | null;
  footer_text: string | null;
}

export interface PublicSiteSettings {
  template_id: SiteTemplateId;
  primary_color: string;
  display_name: string | null;
  logo_url: string | null;
  footer_text: string | null;
}

export interface PublicSiteNavItem {
  id: string;
  page_type: string;
  slug: string;
  title: string;
  sort_order: number;
  href: string;
}

export const DEFAULT_SITE_SETTINGS: Omit<SiteSettingsRow, "tenant_id"> = {
  template_id: "elegant",
  primary_color: "#0f172a",
  display_name: null,
  logo_url: null,
  footer_text: null,
};

export async function ensureSiteSettings(
  supabase: Db,
  tenantId: string,
): Promise<SiteSettingsRow> {
  const { data: existing } = await supabase
    .from("inst_site_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return existing as SiteSettingsRow;
  }

  const { data: created } = await supabase
    .from("inst_site_settings")
    .insert({ tenant_id: tenantId, ...DEFAULT_SITE_SETTINGS })
    .select("*")
    .single();

  return (created ?? { tenant_id: tenantId, ...DEFAULT_SITE_SETTINGS }) as SiteSettingsRow;
}

export async function fetchPublicSiteSettings(
  supabase: Db,
  tenantId: string,
): Promise<PublicSiteSettings | null> {
  const { data } = await supabase.rpc("get_public_site_settings", { p_tenant_id: tenantId }).maybeSingle();
  if (!data) return null;
  return {
    template_id: (data.template_id as SiteTemplateId) ?? "elegant",
    primary_color: data.primary_color ?? "#0f172a",
    display_name: data.display_name,
    logo_url: data.logo_url,
    footer_text: data.footer_text,
  };
}

export async function fetchPublicSiteNav(
  supabase: Db,
  tenantId: string,
): Promise<PublicSiteNavItem[]> {
  const { data } = await supabase.rpc("get_public_site_nav", { p_tenant_id: tenantId });
  return (data ?? []).map((row) => ({
    ...row,
    href: publicPagePath({
      slug: row.slug,
      is_home: false,
      page_type: row.page_type as SitePageRow["page_type"],
    }),
  }));
}

export async function fetchPublicBookingEnabled(
  supabase: Db,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("get_public_booking_enabled", { p_tenant_id: tenantId });
  return data === true;
}

export function resolveSiteBranding(
  tenantName: string,
  tenantBranding: Record<string, unknown>,
  settings: PublicSiteSettings | null,
): {
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
  templateId: SiteTemplateId;
  footerText: string | null;
} {
  const legacy = tenantBranding as { appName?: string; primaryColor?: string };
  return {
    displayName: settings?.display_name ?? legacy.appName ?? tenantName,
    primaryColor: settings?.primary_color ?? legacy.primaryColor ?? "#0f172a",
    logoUrl: settings?.logo_url ?? null,
    templateId: settings?.template_id ?? "elegant",
    footerText: settings?.footer_text ?? null,
  };
}

export interface PublicSiteShellData {
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
  footerText: string | null;
  navLinks: { href: string; label: string }[];
}

export async function loadPublicSiteShellData(
  supabase: Db,
  tenant: TenantContext,
  labels: {
    home: string;
    book: string;
    account: string;
  },
): Promise<PublicSiteShellData> {
  const [settings, navPages, bookingEnabled] = await Promise.all([
    fetchPublicSiteSettings(supabase, tenant.id),
    fetchPublicSiteNav(supabase, tenant.id),
    fetchPublicBookingEnabled(supabase, tenant.id),
  ]);

  const branding = resolveSiteBranding(tenant.name, tenant.branding, settings);
  const navLinks: { href: string; label: string }[] = [{ href: "/", label: labels.home }];

  for (const page of navPages) {
    navLinks.push({ href: page.href, label: page.title });
  }
  if (bookingEnabled) {
    navLinks.push({ href: "/reserver", label: labels.book });
  }
  navLinks.push({ href: "/client/login", label: labels.account });

  return {
    displayName: branding.displayName,
    primaryColor: branding.primaryColor,
    logoUrl: branding.logoUrl,
    footerText: branding.footerText,
    navLinks,
  };
}
