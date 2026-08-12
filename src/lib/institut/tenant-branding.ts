import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  ensureSiteSettings,
  type SiteSettingsRow,
} from "@/lib/institut/site-settings";
import {
  extForSiteMedia,
  SITE_MEDIA_BUCKET,
  validateSiteMediaFile,
} from "@/lib/institut/site-media-upload";

type Db = SupabaseClient<Database>;

export type TenantBrandingSnapshot = {
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
};

export async function fetchTenantBranding(
  supabase: Db,
  tenantId: string,
  tenantName: string,
): Promise<TenantBrandingSnapshot> {
  const settings = await ensureSiteSettings(supabase, tenantId);
  return serializeTenantBranding(settings, tenantName);
}

export function serializeTenantBranding(
  settings: SiteSettingsRow,
  tenantName: string,
): TenantBrandingSnapshot {
  return {
    displayName: settings.display_name?.trim() || tenantName,
    primaryColor: settings.primary_color || "#0f172a",
    logoUrl: settings.logo_url,
  };
}

export async function saveTenantBranding(
  supabase: Db,
  tenantId: string,
  input: {
    displayName?: string | null;
    primaryColor?: string;
    logoUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await ensureSiteSettings(supabase, tenantId);

  const patch: {
    display_name?: string | null;
    primary_color?: string;
    logo_url?: string | null;
  } = {};

  if (input.displayName !== undefined) {
    patch.display_name = input.displayName?.trim() || null;
  }
  if (input.primaryColor !== undefined) {
    patch.primary_color = input.primaryColor.trim() || "#0f172a";
  }
  if (input.logoUrl !== undefined) {
    patch.logo_url = input.logoUrl?.trim() || null;
  }

  if (Object.keys(patch).length === 0) return {};

  const { error } = await supabase
    .from("inst_site_settings")
    .update(patch)
    .eq("tenant_id", tenantId);

  return error ? { error: error.message } : {};
}

export async function uploadTenantLogo(
  supabase: Db,
  tenantId: string,
  file: File,
): Promise<{ logoUrl?: string; error?: string }> {
  const validation = validateSiteMediaFile(file);
  if (validation.errorKey) {
    return { error: validation.errorKey };
  }
  if (validation.kind !== "image") {
    return { error: "logo_images_only" };
  }

  const path = `${tenantId}/logo/${crypto.randomUUID()}.${extForSiteMedia(file.type)}`;
  const { error: upErr } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path);

  const saveRes = await saveTenantBranding(supabase, tenantId, {
    logoUrl: publicUrl,
  });
  if (saveRes.error) return { error: saveRes.error };

  return { logoUrl: publicUrl };
}
