"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { savePlatformSettings } from "@/lib/platform/settings";

export interface SettingsActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function saveAssistantSettings(
  _prev: SettingsActionResult,
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.settings");

  const aiEnabled = formData.get("ai_enabled") === "on";
  const aiModel = String(formData.get("ai_model") ?? "").trim() || "gpt-4o-mini";
  const openAiApiKey = String(formData.get("openai_api_key") ?? "").trim();
  const clearOpenAiApiKey = formData.get("clear_openai_api_key") === "on";
  const supportNotifyEmail = String(formData.get("support_notify_email") ?? "").trim() || null;

  const result = await savePlatformSettings({
    aiEnabled,
    aiModel,
    openAiApiKey: openAiApiKey || undefined,
    clearOpenAiApiKey,
    supportNotifyEmail,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/admin/settings");
  return { ok: true, message: t("saved") };
}
