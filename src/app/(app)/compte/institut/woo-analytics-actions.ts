"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import { createClient } from "@/lib/supabase/server";
import { saveAnalyticsSettings } from "@/lib/institut/analytics-settings";

export type AnalyticsSettingsActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function saveWooAnalyticsSettings(
  _prev: AnalyticsSettingsActionResult,
  formData: FormData,
): Promise<AnalyticsSettingsActionResult> {
  const session = await requireInstitutSettingsModule();
  const t = await getTranslations("institut.woo.analytics");
  const includeWooSales = formData.get("include_woo_sales") === "on";

  const supabase = await createClient();
  await saveAnalyticsSettings(supabase, session.tenant.id, { include_woo_sales: includeWooSales });

  revalidatePath("/compte/institut/woocommerce");
  revalidatePath("/dashboard");
  revalidatePath("/api/institut/dashboard-stats");
  revalidatePath("/api/mobile/institut/dashboard");

  return { ok: true, message: t("saved") };
}
