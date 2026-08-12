"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { saveTenantCustomDomain } from "@/lib/institut/tenant-domain";

const DOMAIN_PATH = "/compte/domaine";

export type DomainActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateDomainPaths() {
  revalidatePath(DOMAIN_PATH);
  revalidatePath("/institut/marketing/page-web");
  revalidatePath("/institut/rendez-vous/reservation-publique");
}

export async function saveInstitutDomain(
  _prev: DomainActionResult,
  formData: FormData,
): Promise<DomainActionResult> {
  const session = await requireInstitutSettingsModule();
  const t = await getTranslations("account.domain");
  const customDomain = String(formData.get("custom_domain") ?? "");

  const supabase = await createClient();
  const result = await saveTenantCustomDomain(
    supabase,
    session.tenant.id,
    session.tenant.slug,
    customDomain,
  );

  if (result.error) {
    if (result.code === "invalid_domain") {
      return { error: t("invalidDomain") };
    }
    if (result.code === "domain_taken") {
      return { error: t("domainTaken") };
    }
    return { error: result.error };
  }

  revalidateDomainPaths();
  return { ok: true, message: t("saved") };
}
