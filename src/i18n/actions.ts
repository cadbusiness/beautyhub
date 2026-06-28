"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("team_profiles").upsert(
      {
        user_id: user.id,
        preferred_locale: locale,
      },
      { onConflict: "user_id" },
    );
  }

  revalidatePath("/", "layout");
}
