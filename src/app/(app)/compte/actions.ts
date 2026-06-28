"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export interface AccountActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function updateTeamProfile(
  _prev: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const t = await getTranslations("account.actions");
  const user = await getCurrentUser();
  if (!user) return { error: t("notAuthenticated") };

  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const localeRaw = String(formData.get("preferred_locale") ?? "");
  const preferredLocale = isLocale(localeRaw) ? localeRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.from("team_profiles").upsert(
    {
      user_id: user.id,
      full_name: fullName,
      phone,
      preferred_locale: preferredLocale,
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  if (preferredLocale) {
    await setLocale(preferredLocale as Locale);
  }

  revalidatePath("/compte");
  revalidatePath("/", "layout");
  return { ok: true, message: t("profileSaved") };
}

export async function updateTeamPassword(
  _prev: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const t = await getTranslations("account.actions");
  const user = await getCurrentUser();
  if (!user) return { error: t("notAuthenticated") };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }
  if (password !== confirm) {
    return { error: t("passwordMismatch") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { ok: true, message: t("passwordSaved") };
}
