import { createClient } from "@/lib/supabase/server";
import { isLocale, type Locale } from "@/i18n/config";

export async function getProfilePreferredLocale(): Promise<Locale | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("team_profiles")
      .select("preferred_locale")
      .eq("user_id", user.id)
      .maybeSingle();

    const locale = data?.preferred_locale;
    return locale && isLocale(locale) ? locale : null;
  } catch {
    return null;
  }
}
