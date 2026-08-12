"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  saveTenantBranding,
  uploadTenantLogo,
} from "@/lib/institut/tenant-branding";

const BRANDING_PATH = "/compte/branding";

export type BrandingActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  url?: string;
};

function revalidateBrandingPaths() {
  revalidatePath(BRANDING_PATH);
  revalidatePath("/institut/marketing/branding");
  revalidatePath("/institut/marketing/page-web/theme");
}

export async function saveInstitutBranding(
  _prev: BrandingActionResult,
  formData: FormData,
): Promise<BrandingActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const primaryColor = String(formData.get("primary_color") ?? "#0f172a").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

  const result = await saveTenantBranding(supabase, session.tenant.id, {
    displayName,
    primaryColor,
    logoUrl,
  });
  if (result.error) return { error: result.error };

  revalidateBrandingPaths();
  const t = await getTranslations("account.branding");
  return { ok: true, message: t("saved") };
}

export async function uploadInstitutLogo(
  formData: FormData,
): Promise<BrandingActionResult> {
  const session = await requireModule("institut");
  const t = await getTranslations("account.branding");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t("fileRequired") };
  }

  const supabase = await createClient();
  const result = await uploadTenantLogo(supabase, session.tenant.id, file);
  if (result.error) {
    if (result.error === "logo_images_only") {
      return { error: t("logoImagesOnly") };
    }
    if (result.error === "unsupportedFormat") {
      return { error: t("unsupportedFormat") };
    }
    if (result.error === "imageTooLarge") {
      return { error: t("imageTooLarge") };
    }
    return { error: result.error };
  }

  revalidateBrandingPaths();
  return { ok: true, url: result.logoUrl, message: t("logoUploaded") };
}
